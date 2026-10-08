import { beforeEach, describe, expect, it } from 'vitest';
import { memoryRepository } from '../data/memory-repository';
import { createMockData } from '../data/mock-data';
import { getActiveCards } from '../domain/projects';
import { getCardsDueToday } from '../domain/review-scheduler';
import { getCurrentStreak } from '../domain/streak';
import { useAppStore } from './app-store';
import { getReviewSummary } from './selectors';

const TODAY = '2026-10-06';
const store = () => useAppStore.getState();
const reviewedToday = () => getReviewSummary(store().reviewLog, TODAY).reviewed;
const dueCount = () => getCardsDueToday(getActiveCards(store().cards, store().projects), TODAY).length;

/** Answer every card in the current session as "remembered". */
function reviewEverything() {
  while (store().reviewSession.currentIndex < store().reviewSession.queue.length) {
    store().revealAnswer();
    store().gradeCurrentCard('remembered', TODAY);
  }
}

beforeEach(() => {
  store().startSession({ id: 'user-demo', name: 'نور', email: '', dailyLimit: null, isStudent: null, plan: 'free', planExpiresAt: null, isAdmin: false }, createMockData(TODAY), memoryRepository);
});

describe('review flow', () => {
  it('requires revealing a Q&A answer before grading', () => {
    store().startReviewSession(TODAY);
    const first = store().cards.find((card) => card.id === store().reviewSession.queue[0]);
    expect(first?.type).toBe('qa');

    store().gradeCurrentCard('remembered', TODAY);
    expect(store().reviewSession.currentIndex).toBe(0);

    store().revealAnswer();
    store().gradeCurrentCard('remembered', TODAY);
    expect(store().reviewSession.currentIndex).toBe(1);
  });

  it('completes the day once everything due is reviewed, and only once', () => {
    store().startReviewSession(TODAY);
    expect(store().reviewSession.queue).toHaveLength(9);
    reviewEverything();

    expect(dueCount()).toBe(0);
    expect(store().completedDays).toContain(TODAY);
    expect(getCurrentStreak(store(), TODAY)).toBe(7);

    // A card added and reviewed later the same day doesn't count again.
    store().addCard({ projectId: 'project-psychology', type: 'note', content: { text: 'extra' } }, TODAY);
    store().startReviewSession(TODAY);
    reviewEverything();
    expect(store().completedDays.filter((day) => day === TODAY)).toHaveLength(1);
    expect(getCurrentStreak(store(), TODAY)).toBe(7);
  });

  it('stops at the daily limit, counts the day, and offers an extra batch', () => {
    // The demo data already has some reviews today; they count toward the limit.
    store().setDailyLimit(reviewedToday() + 4, TODAY);
    store().startReviewSession(TODAY);
    expect(store().reviewSession.queue).toHaveLength(4);
    reviewEverything();

    expect(dueCount()).toBe(5); // the rest stay due for tomorrow
    expect(store().completedDays).toContain(TODAY);

    store().startReviewSession(TODAY);
    expect(store().reviewSession.queue).toHaveLength(0);
    // An extra batch holds up to a full day's limit: here, the 5 cards left.
    store().startReviewSession(TODAY, { extra: true });
    expect(store().reviewSession.queue).toHaveLength(5);
  });

  it('counts the day when a lower limit is already met', () => {
    store().startReviewSession(TODAY);
    for (let i = 0; i < 3; i++) {
      store().revealAnswer();
      store().gradeCurrentCard('remembered', TODAY);
    }
    expect(store().completedDays).not.toContain(TODAY);
    store().setDailyLimit(reviewedToday(), TODAY);
    expect(store().completedDays).toContain(TODAY);
  });

  it('requires revealing a definition, quote ending or image before grading', () => {
    store().startReviewSession(TODAY);
    let guard = 0;
    while (guard++ < 20) {
      const current = store().cards.find((card) => card.id === store().reviewSession.queue[store().reviewSession.currentIndex]);
      if (!current || current.type === 'definition') break;
      store().revealAnswer();
      store().gradeCurrentCard('remembered', TODAY);
    }
    const index = store().reviewSession.currentIndex;
    store().gradeCurrentCard('remembered', TODAY);
    expect(store().reviewSession.currentIndex).toBe(index);
    store().revealAnswer();
    store().gradeCurrentCard('remembered', TODAY);
    expect(store().reviewSession.currentIndex).toBe(index + 1);
  });

  it('logs the original due date of each review', () => {
    store().startReviewSession(TODAY);
    const card = store().cards.find((item) => item.id === store().reviewSession.queue[0])!;
    store().revealAnswer();
    store().gradeCurrentCard('forgot', TODAY);
    expect(store().reviewLog.at(-1)).toMatchObject({ cardId: card.id, dueDate: card.nextReviewDate, result: 'forgot' });
  });
});

describe('vacation', () => {
  it('pushes back reviews that came due while away', () => {
    const before = dueCount();
    store().startVacation('2026-10-03');
    const shifted = store().endVacation(TODAY);
    // Cards due on Oct 3–5 move forward by the 3 vacation days; older overdue ones stay.
    expect(shifted).toBeGreaterThan(0);
    expect(dueCount()).toBe(before - shifted);
    expect(store().vacations).toMatchObject([{ start: '2026-10-03', end: '2026-10-05' }]);
  });
});

describe('projects', () => {
  it('pauses an archived project’s cards and removes them from the session', () => {
    store().startReviewSession(TODAY);
    const before = dueCount();
    store().setProjectArchived('project-ux-basics', true);

    expect(dueCount()).toBe(before - 2);
    const queued = store().reviewSession.queue.map((id) => store().cards.find((card) => card.id === id)?.projectId);
    expect(queued).not.toContain('project-ux-basics');

    store().setProjectArchived('project-ux-basics', false);
    expect(dueCount()).toBe(before);
  });

  it('deletes a project together with its cards', () => {
    store().deleteProject('project-fenjan');
    expect(store().projects.find((project) => project.id === 'project-fenjan')).toBeUndefined();
    expect(store().cards.some((card) => card.projectId === 'project-fenjan')).toBe(false);
  });
});

describe('project review', () => {
  const PROJECT = 'project-atomic-habits';
  const projectCards = () => store().cards.filter((card) => card.projectId === PROJECT);
  const grade = (result: 'remembered' | 'forgot') => {
    store().revealAnswer();
    store().gradeCurrentCard(result, TODAY);
  };

  it('queues every card of the project, due ones first', () => {
    store().startProjectReview(PROJECT, TODAY);
    const queued = store().reviewSession.queue.map((id) => store().cards.find((card) => card.id === id));
    expect(queued).toHaveLength(projectCards().length);
    expect(store().reviewSession.projectId).toBe(PROJECT);
    const firstNotDue = queued.findIndex((card) => card && card.nextReviewDate > TODAY);
    expect(queued.slice(firstNotDue).every((card) => card && card.nextReviewDate > TODAY)).toBe(true);
  });

  it('leaves a remembered practice card as it was, and sends a forgotten one to today’s review', () => {
    store().startProjectReview(PROJECT, TODAY);
    const { queue } = store().reviewSession;
    const notDue = queue.map((id) => store().cards.find((card) => card.id === id)).filter((card) => card && card.nextReviewDate > TODAY);
    expect(notDue.length).toBeGreaterThanOrEqual(2);
    const [first, second] = notDue as NonNullable<(typeof notDue)[number]>[];

    // Skip to the practice cards.
    while (store().reviewSession.queue[store().reviewSession.currentIndex] !== first?.id) grade('remembered');
    const logBefore = store().reviewLog.length;
    grade('remembered');
    expect(store().cards.find((card) => card.id === first?.id)).toEqual(first);

    while (store().reviewSession.queue[store().reviewSession.currentIndex] !== second?.id) grade('remembered');
    grade('forgot');
    const sent = store().cards.find((card) => card.id === second?.id);
    expect(sent?.nextReviewDate).toBe(TODAY);
    expect(sent?.reviewStage).toBeLessThan(second?.reviewStage ?? 0);
    expect(store().reviewLog).toHaveLength(logBefore); // practice isn't logged
    expect(store().reviewSession.results.forgot).toBe(1);
  });
});

describe('shelves', () => {
  it('deleting a shelf keeps its projects, on no shelf', () => {
    const shelf = store().addShelf('روايات');
    const project = store().addProject({ name: 'ثلاثية', type: 'book', customTypeLabel: null, color: 'clay', shelfId: shelf.id });
    store().deleteShelf(shelf.id);
    expect(store().shelves.some((item) => item.id === shelf.id)).toBe(false);
    expect(store().projects.find((item) => item.id === project.id)?.shelfId).toBeNull();
  });
});
