/*
 * Vacation mode. Pure functions over the user's vacations.
 *
 * - While on vacation, days don't break the streak (reviewing is optional,
 *   and a completed day still counts).
 * - Ending a vacation pushes every review that came due during it back by
 *   the vacation's length, so the user returns to a normal day, not a pile.
 * - A vacation lasts at most MAX_VACATION_DAYS. If it isn't ended by then,
 *   it ends on its own: a long break shouldn't hide a broken habit forever.
 */
import { addDays, diffInDays } from './date-utils';
import type { Card, ISODate, Vacation } from './types';

export const MAX_VACATION_DAYS = 14;

/** The first day after a vacation that runs its full length. */
export function getVacationReturnDate(vacation: Pick<Vacation, 'start'>): ISODate {
  return addDays(vacation.start, MAX_VACATION_DAYS);
}

/** Vacation days left, counting today. */
export function getVacationDaysLeft(vacation: Pick<Vacation, 'start'>, today: ISODate): number {
  return Math.max(0, diffInDays(today, getVacationReturnDate(vacation)));
}

/** True when a running vacation has reached its maximum length. */
export function isVacationOver(vacation: Pick<Vacation, 'start' | 'end'>, today: ISODate): boolean {
  return vacation.end === null && today >= getVacationReturnDate(vacation);
}

export function getActiveVacation(vacations: readonly Vacation[]): Vacation | null {
  return vacations.find((vacation) => vacation.end === null) ?? null;
}

export function isOnVacation(vacations: readonly Pick<Vacation, 'start' | 'end'>[], date: ISODate): boolean {
  return vacations.some(
    (vacation) => vacation.start <= date && date <= (vacation.end ?? addDays(getVacationReturnDate(vacation), -1)),
  );
}

/** Start a vacation today (no-op if one is already running). */
export function startVacation(vacations: readonly Vacation[], today: ISODate, id: string): Vacation[] {
  if (getActiveVacation(vacations)) return [...vacations];
  return [...vacations, { id, start: today, end: null }];
}

/**
 * The day a running vacation ends on: today, or its return date if it ran
 * its full length while the user was away.
 */
export function getVacationEndDay(vacation: Pick<Vacation, 'start'>, today: ISODate): ISODate {
  const returnDate = getVacationReturnDate(vacation);
  return today < returnDate ? today : returnDate;
}

/**
 * End the running vacation. It covers the days up to the day before it ends
 * (see getVacationEndDay); ending it on the day it started removes it entirely.
 */
export function endVacation(vacations: readonly Vacation[], today: ISODate): Vacation[] {
  return vacations.flatMap((vacation) => {
    if (vacation.end !== null) return [vacation];
    const end = addDays(getVacationEndDay(vacation, today), -1);
    return end < vacation.start ? [] : [{ ...vacation, end }];
  });
}

/**
 * Push back reviews that came due during a vacation (start … its last day) by
 * the vacation's length, keeping their original spacing.
 */
export function shiftReviewsAfterVacation(cards: readonly Card[], vacation: Vacation, today: ISODate): { cards: Card[]; shifted: number } {
  const endDay = getVacationEndDay(vacation, today);
  const length = diffInDays(vacation.start, endDay);
  if (length <= 0) return { cards: [...cards], shifted: 0 };

  let shifted = 0;
  const result = cards.map((card) => {
    if (card.nextReviewDate < vacation.start || card.nextReviewDate >= endDay) return card;
    shifted += 1;
    return { ...card, nextReviewDate: addDays(card.nextReviewDate, length) };
  });
  return { cards: result, shifted };
}
