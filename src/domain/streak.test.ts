import { describe, expect, it } from 'vitest';
import { createMockData } from '../data/mock-data';
import { addDays } from './date-utils';
import { getCurrentStreak, getStreakSummary, shouldCompleteDay } from './streak';

const TODAY = '2026-10-06';
const d = (offset: number) => addDays(TODAY, offset);
const futureCard = [{ nextReviewDate: d(3) }];

describe('streak', () => {
  it('matches the demo data: 6 days now, longest 12, today pending', () => {
    const summary = getStreakSummary(createMockData(TODAY), TODAY);
    expect(summary.current).toBe(6);
    expect(summary.longest).toBe(12);
    expect(summary.recentDays.map((day) => day.kind[0]).join('')).toBe('cccccct');
  });

  it('lets a rest day (nothing due) bridge the streak', () => {
    const data = { completedDays: [d(-3), d(-1)], cards: futureCard, reviewLog: [] };
    expect(getCurrentStreak(data, TODAY)).toBe(2);
  });

  it('breaks on a day whose cards were only reviewed late', () => {
    const data = { completedDays: [d(-3), d(-1)], cards: futureCard, reviewLog: [{ date: d(-1), dueDate: d(-2) }] };
    expect(getCurrentStreak(data, TODAY)).toBe(1);
  });

  it('breaks on a day whose cards are still overdue', () => {
    const data = { completedDays: [d(-3)], cards: [{ nextReviewDate: d(-2) }], reviewLog: [] };
    expect(getCurrentStreak(data, TODAY)).toBe(0);
  });

  it('keeps the streak through a quiet today', () => {
    const data = { completedDays: [d(-2), d(-1)], cards: futureCard, reviewLog: [] };
    expect(getCurrentStreak(data, TODAY)).toBe(2);
  });

  it('counts a completed today once', () => {
    const data = { completedDays: [d(-1), TODAY], cards: futureCard, reviewLog: [] };
    expect(getCurrentStreak(data, TODAY)).toBe(2);
  });

  it('only completes a day once, and only after reviewing everything due', () => {
    expect(shouldCompleteDay({ completedDays: [], today: TODAY, dueCount: 0, reviewedCount: 3 })).toBe(true);
    expect(shouldCompleteDay({ completedDays: [TODAY], today: TODAY, dueCount: 0, reviewedCount: 4 })).toBe(false);
    expect(shouldCompleteDay({ completedDays: [], today: TODAY, dueCount: 1, reviewedCount: 3 })).toBe(false);
    expect(shouldCompleteDay({ completedDays: [], today: TODAY, dueCount: 0, reviewedCount: 0 })).toBe(false);
  });
});
