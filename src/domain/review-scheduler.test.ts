import { describe, expect, it } from 'vitest';
import {
  createInitialSchedule,
  getCardsDueToday,
  getNextReviewDate,
  getTodaysReviews,
  handleForgot,
  handleRemembered,
  MONTHLY_STAGE,
  summarizeStages,
} from './review-scheduler';
import type { Card } from './types';

const TODAY = '2026-10-06';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    projectId: 'p1',
    type: 'note',
    content: { text: 'x' },
    ...createInitialSchedule(TODAY),
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  } as Card;
}

describe('review scheduler', () => {
  it('makes new cards due today at stage 0', () => {
    expect(createInitialSchedule(TODAY)).toMatchObject({ reviewStage: 0, nextReviewDate: TODAY });
  });

  it('walks the interval ladder: 1 day, 2 days, 1 week, 2 weeks, 1 month', () => {
    let card = makeCard();
    const expected = ['2026-10-07', '2026-10-08', '2026-10-13', '2026-10-20', '2026-11-06'];
    for (const nextDate of expected) {
      card = handleRemembered(card, TODAY);
      expect(card.nextReviewDate).toBe(nextDate);
    }
  });

  it('stays on the monthly cycle after the last stage', () => {
    const card = handleRemembered(makeCard({ reviewStage: MONTHLY_STAGE }), TODAY);
    expect(card.reviewStage).toBe(MONTHLY_STAGE);
    expect(card.nextReviewDate).toBe('2026-11-06');
  });

  it('clamps month-end dates', () => {
    expect(getNextReviewDate(5, '2026-01-31')).toBe('2026-02-28');
  });

  it('brings a forgotten card back tomorrow, two stages lower', () => {
    const card = handleForgot(makeCard({ reviewStage: 3 }), TODAY);
    expect(card).toMatchObject({ reviewStage: 1, nextReviewDate: '2026-10-07', lastReviewResult: 'forgot' });
  });

  it('never drops below the first stage', () => {
    expect(handleForgot(makeCard({ reviewStage: 1 }), TODAY).reviewStage).toBe(0);
    expect(handleForgot(makeCard({ reviewStage: 0 }), TODAY).reviewStage).toBe(0);
  });

  it('sends a forgotten monthly card back to weekly, so the next success waits 2 weeks', () => {
    const forgotten = handleForgot(makeCard({ reviewStage: MONTHLY_STAGE }), TODAY);
    expect(forgotten.reviewStage).toBe(3);
    const relearned = handleRemembered(forgotten, '2026-10-07');
    expect(relearned.nextReviewDate).toBe('2026-10-21');
  });

  it('treats overdue cards as due, oldest first', () => {
    const cards = [
      makeCard({ id: 'a', nextReviewDate: TODAY }),
      makeCard({ id: 'b', nextReviewDate: '2026-10-03' }),
      makeCard({ id: 'c', nextReviewDate: '2026-10-07' }),
    ];
    expect(getCardsDueToday(cards, TODAY).map((card) => card.id)).toEqual(['b', 'a']);
  });

  it('groups stages into learning / strengthening / rooted', () => {
    const cards = [0, 2, 3, 5, 6].map((reviewStage, index) => makeCard({ id: String(index), reviewStage }));
    expect(summarizeStages(cards).map((group) => group.count)).toEqual([2, 1, 2]);
  });
});

describe('daily limit', () => {
  const due = ['2026-10-01', '2026-10-03', '2026-10-05', TODAY].map((date, index) =>
    makeCard({ id: `c${index}`, nextReviewDate: date }),
  );

  it('takes the oldest due cards up to what is left of the limit', () => {
    const { cards, deferred } = getTodaysReviews(due, TODAY, 1, 3);
    expect(cards.map((card) => card.id)).toEqual(['c0', 'c1']);
    expect(deferred).toBe(2);
  });

  it('asks for nothing more once the limit is reached', () => {
    expect(getTodaysReviews(due, TODAY, 5, 3)).toEqual({ cards: [], deferred: 4 });
  });

  it('has no limit when set to null', () => {
    expect(getTodaysReviews(due, TODAY, 50, null)).toMatchObject({ deferred: 0 });
    expect(getTodaysReviews(due, TODAY, 50, null).cards).toHaveLength(4);
  });
});
