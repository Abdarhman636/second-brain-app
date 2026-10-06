/*
 * Daily streak. Pure functions over:
 *   completedDays — dates ("YYYY-MM-DD") on which every due card was reviewed
 *   cards         — current cards (for work still outstanding)
 *   reviewLog     — past reviews, each with the `dueDate` the card had
 *
 * Rules:
 * - A completed day adds 1, at most once per day.
 * - A day with nothing due is a rest day: it neither adds to nor breaks the streak.
 * - A day that had due cards left unfinished breaks the streak.
 * - Today never breaks the streak while it is still in progress.
 */
import { addDays } from './date-utils.js';

export function isDayCompleted(completedDays, date) {
  return completedDays.includes(date);
}

/** True when today's reviews were just finished and today isn't counted yet. */
export function shouldCompleteDay({ completedDays, today, dueCount, reviewedCount }) {
  return dueCount === 0 && reviewedCount > 0 && !isDayCompleted(completedDays, today);
}

/**
 * Builds a check for "did this past day have work that wasn't finished?".
 * A card due on `date` but not reviewed that day is either still due now
 * (nextReviewDate <= date) or was reviewed later with a dueDate <= date.
 */
function createUnfinishedWorkCheck({ cards, reviewLog }) {
  return (date) =>
    cards.some((card) => card.nextReviewDate <= date) ||
    reviewLog.some((entry) => entry.date > date && entry.dueDate && entry.dueDate <= date);
}

function createDayClassifier({ completedDays, cards, reviewLog }) {
  const completed = new Set(completedDays);
  const hadUnfinishedWork = createUnfinishedWorkCheck({ cards, reviewLog });

  return (date) => {
    if (completed.has(date)) return 'completed';
    return hadUnfinishedWork(date) ? 'missed' : 'rest';
  };
}

export function getCurrentStreak(data, today) {
  const { completedDays } = data;
  if (!completedDays.length) return 0;

  const classify = createDayClassifier(data);
  const earliest = [...completedDays].sort()[0];
  let cursor = isDayCompleted(completedDays, today) ? today : addDays(today, -1);
  let count = 0;

  while (cursor >= earliest) {
    const kind = classify(cursor);
    if (kind === 'missed') break;
    if (kind === 'completed') count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function getLongestStreak(data, today) {
  const sorted = [...new Set(data.completedDays)].sort();
  const classify = createDayClassifier(data);
  let longest = 0;
  let run = 0;

  sorted.forEach((day, index) => {
    let connected = index > 0;
    // Two completed days stay connected if every day between them was a rest day.
    for (let cursor = addDays(day, -1); connected && cursor > sorted[index - 1]; cursor = addDays(cursor, -1)) {
      if (cursor < today && classify(cursor) === 'missed') connected = false;
    }
    run = connected ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}

/** The last `length` days ending today, oldest first, each tagged completed/rest/missed/today. */
export function getRecentDays(data, today, length = 7) {
  const classify = createDayClassifier(data);
  return Array.from({ length }, (_, index) => {
    const date = addDays(today, index - (length - 1));
    const isToday = date === today;
    const kind = classify(date);
    return { date, isToday, kind: isToday && kind !== 'completed' ? 'today' : kind };
  });
}

/** @param {{ completedDays: string[], cards: object[], reviewLog: object[] }} data */
export function getStreakSummary(data, today) {
  return {
    current: getCurrentStreak(data, today),
    longest: getLongestStreak(data, today),
    completedToday: isDayCompleted(data.completedDays, today),
    recentDays: getRecentDays(data, today),
  };
}
