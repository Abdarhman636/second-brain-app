/*
 * The signed-in user's data and every action that changes it.
 *
 * Each action updates state immediately (so the UI never waits on the
 * network) and then queues the matching write on the session's Repository —
 * Supabase for accounts, a no-op for demo mode. No UI code lives here, so the
 * same store can back the React Native app.
 */
import { create } from 'zustand';
import { memoryRepository } from '../data/memory-repository';
import { enqueueWrite, type Repository } from '../data/repository';
import { hasHiddenPart } from '../domain/card-types';
import { getActiveCards } from '../domain/projects';
import {
  applyPracticeResult,
  applyReview,
  createInitialSchedule,
  DEFAULT_DAILY_LIMIT,
  getProjectReviewQueue,
  getTodaysReviews,
  isCardDue,
} from '../domain/review-scheduler';
import { removeShelfFromProjects } from '../domain/shelves';
import { shouldCompleteDay } from '../domain/streak';
import type {
  Card,
  CardInput,
  DailyLimit,
  ISODate,
  Project,
  ProjectInput,
  ReviewLogEntry,
  ReviewResult,
  Shelf,
  User,
  UserData,
} from '../domain/types';
import { endVacation, getActiveVacation, isVacationOver, shiftReviewsAfterVacation, startVacation } from '../domain/vacation';
import { getCurrentReviewItem, getReviewSummary } from './selectors';

export interface ReviewSession {
  queue: string[];
  currentIndex: number;
  answerRevealed: boolean;
  startedOn: ISODate | null;
  /** Set when reviewing one project on its own; null for the daily review. */
  projectId: string | null;
  /** This session's results, for its closing summary. */
  results: Record<ReviewResult, number>;
}

/** 'account' = signed in with Supabase; 'demo' = sample data that isn't saved. */
export type SessionMode = 'account' | 'demo';

interface AppState extends UserData {
  user: User | null;
  mode: SessionMode | null;
  lastUsedProjectId: string | null;
  reviewSession: ReviewSession;
}

interface AppActions {
  startSession: (user: User, data: UserData, repository: Repository) => void;
  endSession: () => void;

  addShelf: (name: string) => Shelf;
  renameShelf: (shelfId: string, name: string) => void;
  /** Delete a shelf; its projects stay, on no shelf. */
  deleteShelf: (shelfId: string) => void;

  addProject: (input: ProjectInput) => Project;
  updateProject: (projectId: string, input: ProjectInput) => void;
  setProjectArchived: (projectId: string, archived: boolean) => void;
  deleteProject: (projectId: string) => void;

  addCard: (input: CardInput, today: ISODate) => Card;
  editCard: (cardId: string, input: CardInput) => void;
  moveCard: (cardId: string, projectId: string) => void;
  deleteCard: (cardId: string) => void;

  /** Turn vacation mode on, starting today. */
  startVacation: (today: ISODate) => void;
  /** Turn it off; returns how many reviews were pushed back. */
  endVacation: (today: ISODate) => number;
  /**
   * End a vacation that reached its maximum length. Returns how many reviews
   * were pushed back, or null when there was nothing to end.
   */
  expireVacation: (today: ISODate) => number | null;

  /** Change the daily limit (the account copy is saved by the session). */
  setDailyLimit: (limit: DailyLimit, today: ISODate) => void;

  /**
   * Start a review with today's share of the due cards. `extra` starts one
   * more batch past the daily limit, for days the user wants to do more.
   */
  startReviewSession: (today: ISODate, options?: { extra?: boolean }) => void;
  /**
   * Review every card of one project. Due cards are graded as usual; cards
   * that aren't due are practice (see applyPracticeResult): a forgotten one
   * goes back to today's daily review.
   */
  startProjectReview: (projectId: string, today: ISODate) => void;
  revealAnswer: () => void;
  gradeCurrentCard: (result: ReviewResult, today: ISODate) => void;
}

export type AppStore = AppState & AppActions;

const newSession = (queue: string[], startedOn: ISODate | null, projectId: string | null = null): ReviewSession => ({
  queue,
  currentIndex: 0,
  answerRevealed: false,
  startedOn,
  projectId,
  results: { remembered: 0, forgot: 0 },
});

const emptySession = (): ReviewSession => newSession([], null);

/** Move past the current card, counting its result. */
const advanceSession = (session: ReviewSession, result: ReviewResult): ReviewSession => ({
  ...session,
  currentIndex: session.currentIndex + 1,
  answerRevealed: false,
  results: { ...session.results, [result]: session.results[result] + 1 },
});

const initialState = (): AppState => ({
  user: null,
  mode: null,
  shelves: [],
  projects: [],
  cards: [],
  reviewLog: [],
  completedDays: [],
  vacations: [],
  lastUsedProjectId: null,
  reviewSession: emptySession(),
});

const now = () => new Date().toISOString();

// Where the current session's changes are saved.
let repository: Repository = memoryRepository;
const persist = (write: (repo: Repository) => Promise<void>) => {
  const repo = repository;
  void enqueueWrite(() => write(repo));
};

/** Drop cards from the review queue, keeping the current position stable. */
function withoutQueuedCards(session: ReviewSession, removedIds: Set<string>): ReviewSession {
  if (!session.queue.some((id) => removedIds.has(id))) return session;
  const removedBefore = session.queue.slice(0, session.currentIndex).filter((id) => removedIds.has(id)).length;
  const currentRemoved = removedIds.has(session.queue[session.currentIndex] ?? '');
  return {
    ...session,
    queue: session.queue.filter((id) => !removedIds.has(id)),
    currentIndex: session.currentIndex - removedBefore,
    answerRevealed: currentRemoved ? false : session.answerRevealed,
  };
}

function getDailyLimit(state: Pick<AppState, 'user'>): DailyLimit {
  return state.user ? state.user.dailyLimit : DEFAULT_DAILY_LIMIT;
}

/** True when today's share of reviews was just finished and today isn't counted yet. */
function isDayDone(state: Pick<AppState, 'user' | 'cards' | 'projects' | 'reviewLog' | 'completedDays'>, today: ISODate): boolean {
  const reviewedCount = getReviewSummary(state.reviewLog, today).reviewed;
  return shouldCompleteDay({
    completedDays: state.completedDays,
    today,
    dueCount: getTodaysReviews(getActiveCards(state.cards, state.projects), today, reviewedCount, getDailyLimit(state)).cards.length,
    reviewedCount,
  });
}

/** Count today toward the streak if nothing is left of today's share. */
function completeDayIfDone(today: ISODate) {
  const state = useAppStore.getState();
  if (!isDayDone(state, today)) return;
  useAppStore.setState({ completedDays: [...state.completedDays, today] });
  persist((repo) => repo.addCompletedDay(today));
}

export const useAppStore = create<AppStore>()((set, get) => ({
  ...initialState(),

  /* ---------- Session ---------- */

  startSession: (user, data, repo) => {
    repository = repo;
    set({
      ...initialState(),
      ...structuredClone(data),
      user,
      mode: repo.kind === 'memory' ? 'demo' : 'account',
    });
  },

  endSession: () => {
    repository = memoryRepository;
    set(initialState());
  },

  /* ---------- Shelves ---------- */

  addShelf: (name) => {
    const timestamp = now();
    const shelf: Shelf = { id: crypto.randomUUID(), name, createdAt: timestamp, updatedAt: timestamp };
    set((state) => ({ shelves: [...state.shelves, shelf] }));
    persist((repo) => repo.saveShelf(shelf));
    return shelf;
  },

  renameShelf: (shelfId, name) => {
    const current = get().shelves.find((shelf) => shelf.id === shelfId);
    if (!current) return;
    const updated = { ...current, name, updatedAt: now() };
    set((state) => ({ shelves: state.shelves.map((shelf) => (shelf.id === shelfId ? updated : shelf)) }));
    persist((repo) => repo.saveShelf(updated));
  },

  deleteShelf: (shelfId) => {
    set((state) => ({
      shelves: state.shelves.filter((shelf) => shelf.id !== shelfId),
      projects: removeShelfFromProjects(state.projects, shelfId),
    }));
    // The database clears the projects' shelf (ON DELETE SET NULL).
    persist((repo) => repo.deleteShelf(shelfId));
  },

  /* ---------- Projects ---------- */

  addProject: (input) => {
    const timestamp = now();
    const project: Project = { ...input, id: crypto.randomUUID(), archived: false, createdAt: timestamp, updatedAt: timestamp };
    set((state) => ({ projects: [project, ...state.projects] }));
    persist((repo) => repo.saveProject(project));
    return project;
  },

  updateProject: (projectId, input) => {
    const current = get().projects.find((project) => project.id === projectId);
    if (!current) return;
    const updated = { ...current, ...input, updatedAt: now() };
    set((state) => ({ projects: state.projects.map((project) => (project.id === projectId ? updated : project)) }));
    persist((repo) => repo.saveProject(updated));
  },

  setProjectArchived: (projectId, archived) => {
    const state = get();
    const current = state.projects.find((project) => project.id === projectId);
    if (!current) return;
    const updated = { ...current, archived, updatedAt: now() };
    const projectCardIds = new Set(state.cards.filter((card) => card.projectId === projectId).map((card) => card.id));
    set({
      projects: state.projects.map((project) => (project.id === projectId ? updated : project)),
      // Paused cards leave any review in progress.
      reviewSession: archived ? withoutQueuedCards(state.reviewSession, projectCardIds) : state.reviewSession,
      lastUsedProjectId: archived && state.lastUsedProjectId === projectId ? null : state.lastUsedProjectId,
    });
    persist((repo) => repo.saveProject(updated));
  },

  deleteProject: (projectId) => {
    const state = get();
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) return;
    const removed = state.cards.filter((card) => card.projectId === projectId);
    set({
      projects: state.projects.filter((item) => item.id !== projectId),
      cards: state.cards.filter((card) => card.projectId !== projectId),
      reviewSession: withoutQueuedCards(state.reviewSession, new Set(removed.map((card) => card.id))),
      lastUsedProjectId: state.lastUsedProjectId === projectId ? null : state.lastUsedProjectId,
    });
    persist((repo) => repo.deleteProject(project, removed));
  },

  /* ---------- Cards ---------- */

  addCard: (input, today) => {
    const timestamp = now();
    // New cards are due immediately, at the first review stage.
    const card: Card = { ...input, ...createInitialSchedule(today), id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp };
    set((state) => ({ cards: [...state.cards, card], lastUsedProjectId: input.projectId }));
    persist((repo) => repo.saveCards([card]));
    return card;
  },

  // Editing never resets the card's place in the review schedule.
  editCard: (cardId, input) => {
    const current = get().cards.find((card) => card.id === cardId);
    if (!current) return;
    const updated: Card = { ...current, ...input, updatedAt: now() };
    set((state) => ({
      cards: state.cards.map((card) => (card.id === cardId ? updated : card)),
      lastUsedProjectId: input.projectId,
    }));
    persist((repo) => repo.saveCards([updated]));
  },

  moveCard: (cardId, projectId) => {
    const current = get().cards.find((card) => card.id === cardId);
    if (!current) return;
    const updated: Card = { ...current, projectId, updatedAt: now() };
    set((state) => ({ cards: state.cards.map((card) => (card.id === cardId ? updated : card)) }));
    persist((repo) => repo.saveCards([updated]));
  },

  deleteCard: (cardId) => {
    const card = get().cards.find((item) => item.id === cardId);
    if (!card) return;
    set((state) => ({
      cards: state.cards.filter((item) => item.id !== cardId),
      reviewSession: withoutQueuedCards(state.reviewSession, new Set([cardId])),
    }));
    persist((repo) => repo.deleteCard(card));
  },

  /* ---------- Vacation ---------- */

  startVacation: (today) => {
    const vacations = startVacation(get().vacations, today, crypto.randomUUID());
    const started = getActiveVacation(vacations);
    set({ vacations });
    if (started) persist((repo) => repo.saveVacation(started));
  },

  endVacation: (today) => {
    const state = get();
    const active = getActiveVacation(state.vacations);
    if (!active) return 0;

    const { cards, shifted } = shiftReviewsAfterVacation(state.cards, active, today);
    const vacations = endVacation(state.vacations, today);
    const ended = vacations.find((vacation) => vacation.id === active.id);
    const movedCards = cards.filter((card, index) => card !== state.cards[index]);

    set({
      cards,
      vacations,
      // Due dates moved, so any review in progress starts over from today's list.
      reviewSession: shifted ? emptySession() : state.reviewSession,
    });
    persist(async (repo) => {
      await repo.saveCards(movedCards);
      // Ended on the day it started: the vacation is simply removed.
      await (ended ? repo.saveVacation(ended) : repo.deleteVacation(active.id));
    });
    return shifted;
  },

  expireVacation: (today) => {
    const active = getActiveVacation(get().vacations);
    return active && isVacationOver(active, today) ? get().endVacation(today) : null;
  },

  /* ---------- Settings ---------- */

  setDailyLimit: (limit, today) => {
    const state = get();
    if (!state.user) return;
    set({ user: { ...state.user, dailyLimit: limit } });
    // A lower limit can mean today's reviews are already done.
    completeDayIfDone(today);
  },

  /* ---------- Review ---------- */

  startReviewSession: (today, options = {}) => {
    const state = get();
    const reviewed = options.extra ? 0 : getReviewSummary(state.reviewLog, today).reviewed;
    const queue = getTodaysReviews(getActiveCards(state.cards, state.projects), today, reviewed, getDailyLimit(state)).cards.map(
      (card) => card.id,
    );
    set({ reviewSession: newSession(queue, today) });
  },

  startProjectReview: (projectId, today) => {
    const state = get();
    const project = state.projects.find((item) => item.id === projectId);
    const queue = project && !project.archived ? getProjectReviewQueue(state.cards, projectId).map((card) => card.id) : [];
    set({ reviewSession: newSession(queue, today, projectId) });
  },

  revealAnswer: () =>
    set((state) => (state.reviewSession.answerRevealed ? state : { reviewSession: { ...state.reviewSession, answerRevealed: true } })),

  /**
   * Grade the current card: reschedule it, log the review, move to the next
   * card, and count the day toward the streak once nothing is left due.
   */
  gradeCurrentCard: (result, today) => {
    const state = get();
    const item = getCurrentReviewItem(state.reviewSession, state.cards, today);
    if (!item) return;
    const { card } = item;
    // Anything with a hidden part has to be revealed (recalled) before grading.
    if (hasHiddenPart(card) && !state.reviewSession.answerRevealed) return;

    // Reviewing one project: cards that aren't due yet are only practice.
    if (state.reviewSession.projectId !== null && !isCardDue(card, today)) {
      const practiced = applyPracticeResult(card, result, today);
      const changed = practiced !== card;
      const saved = { ...practiced, updatedAt: changed ? now() : card.updatedAt };
      set({
        cards: changed ? state.cards.map((existing) => (existing.id === card.id ? saved : existing)) : state.cards,
        reviewSession: advanceSession(state.reviewSession, result),
      });
      if (changed) persist((repo) => repo.saveCards([saved]));
      return;
    }

    const reviewed = { ...applyReview(card, result, today), updatedAt: now() };
    const cards = state.cards.map((existing) => (existing.id === card.id ? reviewed : existing));
    const entry: ReviewLogEntry = {
      id: crypto.randomUUID(),
      cardId: card.id,
      result,
      date: today,
      dueDate: card.nextReviewDate,
      reviewedAt: now(),
    };
    const reviewLog = [...state.reviewLog, entry];

    const dayComplete = isDayDone({ ...state, cards, reviewLog }, today);

    set({
      cards,
      reviewLog,
      completedDays: dayComplete ? [...state.completedDays, today] : state.completedDays,
      reviewSession: advanceSession(state.reviewSession, result),
    });
    persist(async (repo) => {
      await repo.saveCards([reviewed]);
      await repo.addReview(entry);
      if (dayComplete) await repo.addCompletedDay(today);
    });
  },
}));
