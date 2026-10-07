/*
 * Daily streak. Pure functions over:
 *   completedDays — days on which every due card was reviewed
 *   cards         — current (active) cards, for work still outstanding
 *   reviewLog     — past reviews, each with the `dueDate` the card had
 *
 * Rules:
 * - A completed day adds 1, at most once per day.
 * - A day with nothing due is a rest day: it neither adds to nor breaks the streak.
 * - A vacation day works the same way, whatever was due.
 * - A day that had due cards left unfinished breaks the streak.
 * - Today never breaks the streak while it is still in progress.
 */
import { addDays } from './date-utils';
import type { Card, ISODate, ReviewLogEntry, Vacation } from './types';
import { isOnVacation } from './vacation';

export interface StreakData {
  completedDays: readonly ISODate[];
  cards: readonly Pick<Card, 'nextReviewDate'>[];
  reviewLog: readonly Pick<ReviewLogEntry, 'date' | 'dueDate'>[];
  vacations?: readonly Pick<Vacation, 'start' | 'end'>[];
}

export type DayKind = 'completed' | 'rest' | 'vacation' | 'missed' | 'today';

export interface StreakSummary {
  current: number;
  longest: number;
  completedToday: boolean;
  recentDays: { date: ISODate; kind: DayKind }[];
}

export function isDayCompleted(completedDays: readonly ISODate[], date: ISODate): boolean {
  return completedDays.includes(date);
}

/** True when today's reviews were just finished and today isn't counted yet. */
export function shouldCompleteDay(input: {
  completedDays: readonly ISODate[];
  today: ISODate;
  dueCount: number;
  reviewedCount: number;
}): boolean {
  const { completedDays, today, dueCount, reviewedCount } = input;
  return dueCount === 0 && reviewedCount > 0 && !isDayCompleted(completedDays, today);
}

/**
 * A card due on `date` but not reviewed that day is either still due now
 * (nextReviewDate <= date) or was reviewed later with a dueDate <= date.
 */
function createDayClassifier({ completedDays, cards, reviewLog, vacations = [] }: StreakData) {
  const completed = new Set(completedDays);
  const hadUnfinishedWork = (date: ISODate) =>
    cards.some((card) => card.nextReviewDate <= date) ||
    reviewLog.some((entry) => entry.date > date && entry.dueDate <= date);

  return (date: ISODate): Exclude<DayKind, 'today'> => {
    if (completed.has(date)) return 'completed';
    if (isOnVacation(vacations, date)) return 'vacation';
    return hadUnfinishedWork(date) ? 'missed' : 'rest';
  };
}

export function getCurrentStreak(data: StreakData, today: ISODate): number {
  const earliest = [...data.completedDays].sort()[0];
  if (!earliest) return 0;

  const classify = createDayClassifier(data);
  let cursor = isDayCompleted(data.completedDays, today) ? today : addDays(today, -1);
  let count = 0;

  while (cursor >= earliest) {
    const kind = classify(cursor);
    if (kind === 'missed') break;
    if (kind === 'completed') count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function getLongestStreak(data: StreakData, today: ISODate): number {
  const sorted = [...new Set(data.completedDays)].sort();
  const classify = createDayClassifier(data);
  let longest = 0;
  let run = 0;

  sorted.forEach((day, index) => {
    const previous = sorted[index - 1];
    let connected = previous !== undefined;
    // Two completed days stay connected if every day between them was a rest day.
    for (let cursor = addDays(day, -1); connected && previous !== undefined && cursor > previous; cursor = addDays(cursor, -1)) {
      if (cursor < today && classify(cursor) === 'missed') connected = false;
    }
    run = connected ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}

/** The last `length` days ending today, oldest first. */
export function getRecentDays(data: StreakData, today: ISODate, length = 7): StreakSummary['recentDays'] {
  const classify = createDayClassifier(data);
  return Array.from({ length }, (_, index) => {
    const date = addDays(today, index - (length - 1));
    const kind = classify(date);
    const pendingToday = date === today && kind !== 'completed' && kind !== 'vacation';
    return { date, kind: pendingToday ? 'today' : kind };
  });
}

export function getStreakSummary(data: StreakData, today: ISODate): StreakSummary {
  return {
    current: getCurrentStreak(data, today),
    longest: getLongestStreak(data, today),
    completedToday: isDayCompleted(data.completedDays, today),
    recentDays: getRecentDays(data, today),
  };
}
