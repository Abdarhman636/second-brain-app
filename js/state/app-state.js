/*
 * Centralized in-memory state.
 *
 * - Reads go through selector functions (getProjects, getDueCards, …).
 * - Writes go through named mutations (addCard, recordReview, …), each of
 *   which notifies subscribers exactly once.
 *
 * Mutations are the seam for a future backend: each one maps to a single
 * insert/update/delete, so they can be made async and call Supabase without
 * the UI changing shape.
 */
import { createId } from '../utils/helpers.js';
import { getCardsDueToday, isCardDue } from '../utils/review-scheduler.js';

const state = createInitialState();

function createInitialState() {
  return {
    status: 'idle',
    currentUser: null,
    projects: [],
    cards: [],
    reviewLog: [],
    completedDays: [],
    currentPage: 'today',
    selectedProjectId: null,
    lastUsedProjectId: null,
    reviewSession: createEmptySession(),
  };
}

const listeners = new Set();

function createEmptySession() {
  return { queue: [], currentIndex: 0, answerRevealed: false, startedOn: null };
}

function commit(type) {
  listeners.forEach((listener) => listener({ type }));
}

const now = () => new Date().toISOString();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Read-only snapshot by convention; never mutate the returned object. */
export function getState() {
  return state;
}

/* ==========================================================================
   Session
   ========================================================================== */

export function getCurrentUser() {
  return state.currentUser;
}

/** Sign a user in with their data, in a single change. */
export function startSession(user, data) {
  Object.assign(state, createInitialState(), { currentUser: user, currentPage: state.currentPage });
  hydrateData(data);
  commit('session:start');
}

/** Clear everything belonging to the signed-in user. */
export function endSession() {
  Object.assign(state, createInitialState(), { currentPage: 'login' });
  commit('session:end');
}

/** The user's persistent data, in the same shape the data source loads. */
export function exportUserData() {
  const { projects, cards, reviewLog, completedDays } = state;
  return { projects, cards, reviewLog, completedDays };
}

function hydrateData({ projects = [], cards = [], reviewLog = [], completedDays = [] }) {
  state.projects = projects.map((project) => ({ ...project }));
  state.cards = cards.map((card) => ({ ...card, content: { ...card.content } }));
  state.reviewLog = [...reviewLog];
  state.completedDays = [...completedDays];
  state.status = 'ready';
}

/* ==========================================================================
   Navigation
   ========================================================================== */

export function setCurrentPage(page, { projectId = null } = {}) {
  state.currentPage = page;
  state.selectedProjectId = projectId;
  commit('route');
}

export function getCurrentPage() {
  return state.currentPage;
}

export function getSelectedProjectId() {
  return state.selectedProjectId;
}

export function getLastUsedProjectId() {
  return state.lastUsedProjectId;
}

/* ==========================================================================
   Projects
   ========================================================================== */

export function getProjects() {
  return state.projects;
}

export function getProjectById(projectId) {
  return state.projects.find((project) => project.id === projectId) ?? null;
}

export function getProjectStats(projectId, today) {
  const cards = getCardsByProject(projectId);
  return {
    cardCount: cards.length,
    dueCount: cards.filter((card) => isCardDue(card, today)).length,
  };
}

export function addProject({ name, type, customTypeLabel = null, color }) {
  const timestamp = now();
  const project = { id: createId(), name, type, customTypeLabel, color, createdAt: timestamp, updatedAt: timestamp };
  state.projects = [project, ...state.projects];
  commit('project:add');
  return project;
}

export function updateProject(projectId, changes) {
  state.projects = state.projects.map((project) =>
    project.id === projectId ? { ...project, ...changes, updatedAt: now() } : project,
  );
  commit('project:update');
}

/* ==========================================================================
   Cards
   ========================================================================== */

export function getCards() {
  return state.cards;
}

export function getCardById(cardId) {
  return state.cards.find((card) => card.id === cardId) ?? null;
}

export function getCardsByProject(projectId) {
  return state.cards.filter((card) => card.projectId === projectId);
}

export function getDueCards(today) {
  return getCardsDueToday(state.cards, today);
}

/** `schedule` comes from the review scheduler (see createInitialSchedule). */
export function addCard({ projectId, type, content, ...schedule }) {
  const timestamp = now();
  const card = {
    id: createId(),
    projectId,
    type,
    content: { ...content },
    ...schedule,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.cards = [...state.cards, card];
  state.lastUsedProjectId = projectId;
  commit('card:add');
  return card;
}

export function updateCard(cardId, changes) {
  state.cards = state.cards.map((card) =>
    card.id === cardId ? { ...card, ...changes, updatedAt: now() } : card,
  );
  if (changes.projectId) state.lastUsedProjectId = changes.projectId;
  commit('card:update');
}

export function moveCard(cardId, projectId) {
  updateCard(cardId, { projectId });
}

export function deleteCard(cardId) {
  state.cards = state.cards.filter((card) => card.id !== cardId);
  removeFromReviewSession(cardId);
  commit('card:delete');
}

/* ==========================================================================
   Reviews
   ========================================================================== */

/**
 * Persist one review: the rescheduled card, a log entry, and the session's
 * advance to the next card — committed together as a single change.
 */
export function recordReview({ card, result, date }) {
  // The date the card was due, so the streak can tell a missed day from a rest day.
  const dueDate = getCardById(card.id)?.nextReviewDate ?? date;

  state.cards = state.cards.map((item) => (item.id === card.id ? { ...card, updatedAt: now() } : item));
  state.reviewLog = [
    ...state.reviewLog,
    { id: createId(), cardId: card.id, result, date, dueDate, reviewedAt: now() },
  ];

  const session = state.reviewSession;
  if (session.queue[session.currentIndex] === card.id) {
    state.reviewSession = { ...session, currentIndex: session.currentIndex + 1, answerRevealed: false };
  }

  commit('review:record');
}

/** What happened on `date`, counting each card once by its latest result. */
export function getReviewSummary(date) {
  const latestByCard = new Map();
  state.reviewLog
    .filter((entry) => entry.date === date)
    .forEach((entry) => latestByCard.set(entry.cardId, entry.result));

  const results = [...latestByCard.values()];
  return {
    reviewed: results.length,
    remembered: results.filter((result) => result === 'remembered').length,
    forgot: results.filter((result) => result === 'forgot').length,
  };
}

/** The next `limit` days that have reviews scheduled, with card counts. */
export function getUpcomingSchedule(today, limit = 3) {
  const counts = new Map();
  state.cards
    .filter((card) => card.nextReviewDate > today)
    .forEach((card) => counts.set(card.nextReviewDate, (counts.get(card.nextReviewDate) ?? 0) + 1));

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, limit)
    .map(([date, count]) => ({ date, count }));
}

/** The next day that has reviews scheduled, and how many. */
export function getUpcomingReview(today) {
  return getUpcomingSchedule(today, 1)[0] ?? null;
}

/* ==========================================================================
   Streak
   ========================================================================== */

export function getCompletedDays() {
  return state.completedDays;
}

/** Everything the streak rules need (see utils/streak.js). */
export function getStreakData() {
  return { completedDays: state.completedDays, cards: state.cards, reviewLog: state.reviewLog };
}

/** Idempotent: a day counts toward the streak at most once. */
export function markDayCompleted(date) {
  if (state.completedDays.includes(date)) return;
  state.completedDays = [...state.completedDays, date];
  commit('streak:complete');
}

/* ==========================================================================
   Review session
   ========================================================================== */

export function getReviewSession() {
  return state.reviewSession;
}

export function startReviewSession(cardIds, date) {
  state.reviewSession = { queue: [...cardIds], currentIndex: 0, answerRevealed: false, startedOn: date };
  commit('session:start');
}

export function isReviewSessionActive(today) {
  const { startedOn, currentIndex, queue } = state.reviewSession;
  return startedOn === today && currentIndex < queue.length;
}

/** The card currently under review, with its position in the session. */
export function getCurrentReviewItem(today) {
  if (!isReviewSessionActive(today)) return null;

  const { queue, currentIndex } = state.reviewSession;
  const card = getCardById(queue[currentIndex]);
  return card ? { card, position: currentIndex + 1, total: queue.length } : null;
}

export function setAnswerRevealed() {
  if (state.reviewSession.answerRevealed) return;
  state.reviewSession = { ...state.reviewSession, answerRevealed: true };
  commit('session:reveal');
}

function removeFromReviewSession(cardId) {
  const session = state.reviewSession;
  const index = session.queue.indexOf(cardId);
  if (index === -1) return;

  state.reviewSession = {
    ...session,
    queue: session.queue.filter((id) => id !== cardId),
    currentIndex: index < session.currentIndex ? session.currentIndex - 1 : session.currentIndex,
    answerRevealed: index === session.currentIndex ? false : session.answerRevealed,
  };
}
