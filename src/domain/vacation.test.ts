import { describe, expect, it } from 'vitest';
import { addDays } from './date-utils';
import { getCurrentStreak, getRecentDays } from './streak';
import type { Card } from './types';
import {
  endVacation,
  getActiveVacation,
  getVacationDaysLeft,
  isOnVacation,
  isVacationOver,
  MAX_VACATION_DAYS,
  shiftReviewsAfterVacation,
  startVacation,
} from './vacation';

const TODAY = '2026-10-07';
const d = (offset: number) => addDays(TODAY, offset);

const card = (id: string, nextReviewDate: string) =>
  ({ id, nextReviewDate, reviewStage: 2 }) as Card;

describe('vacation mode', () => {
  it('starts once and ends on yesterday', () => {
    const started = startVacation([], d(-5), 'v1');
    expect(startVacation(started, d(-4), 'v2')).toHaveLength(1);
    expect(getActiveVacation(started)).toEqual({ id: 'v1', start: d(-5), end: null });

    const ended = endVacation(started, TODAY);
    expect(ended).toEqual([{ id: 'v1', start: d(-5), end: d(-1) }]);
    expect(isOnVacation(ended, d(-1))).toBe(true);
    expect(isOnVacation(ended, TODAY)).toBe(false);
  });

  it('disappears when ended on the day it started', () => {
    expect(endVacation(startVacation([], TODAY, 'v1'), TODAY)).toEqual([]);
  });

  it('pushes back reviews that came due during the vacation, keeping their spacing', () => {
    const cards = [card('before', d(-9)), card('during', d(-3)), card('today', TODAY), card('later', d(4))];
    const { cards: shifted, shifted: count } = shiftReviewsAfterVacation(cards, { id: 'v1', start: d(-5), end: null }, TODAY);
    expect(count).toBe(1);
    expect(shifted.map((item) => item.nextReviewDate)).toEqual([d(-9), d(2), TODAY, d(4)]);
  });

  it(`lasts at most ${MAX_VACATION_DAYS} days`, () => {
    const running = { id: 'v1', start: d(-20), end: null };
    expect(getVacationDaysLeft({ start: TODAY }, TODAY)).toBe(14);
    expect(isVacationOver(running, TODAY)).toBe(true);
    expect(isVacationOver({ ...running, start: d(-13) }, TODAY)).toBe(false);

    // Days past the limit no longer count as vacation, even before it's closed.
    expect(isOnVacation([running], d(-7))).toBe(true);
    expect(isOnVacation([running], d(-6))).toBe(false);

    // Ending it late closes it on its last allowed day and shifts by 14 days only.
    expect(endVacation([running], TODAY)).toEqual([{ id: 'v1', start: d(-20), end: d(-7) }]);
    const cards = [card('during', d(-10)), card('after', d(-3))];
    const { cards: shifted, shifted: count } = shiftReviewsAfterVacation(cards, running, TODAY);
    expect(count).toBe(1);
    expect(shifted.map((item) => item.nextReviewDate)).toEqual([d(4), d(-3)]);
  });

  it('keeps the streak through vacation days, even with reviews left undone', () => {
    const data = {
      completedDays: [d(-6), d(-5)],
      cards: [{ nextReviewDate: d(-4) }], // due during the vacation, never reviewed
      reviewLog: [],
      vacations: [{ start: d(-4), end: d(-1) }],
    };
    expect(getCurrentStreak(data, TODAY)).toBe(2);
    expect(getCurrentStreak({ ...data, vacations: [] }, TODAY)).toBe(0);
    expect(getRecentDays(data, TODAY).map((day) => day.kind).slice(-5)).toEqual([
      'vacation',
      'vacation',
      'vacation',
      'vacation',
      'today',
    ]);
  });
});
