/*
 * Derived data. Pure functions over store slices — components call them
 * inside `useMemo`, and the store's actions reuse them.
 */
import { getCardsDueToday, isCardDue } from '../domain/review-scheduler';
import type { Card, ISODate, ReviewLogEntry } from '../domain/types';
import type { ReviewSession } from './app-store';

export interface ReviewSummary {
  reviewed: number;
  remembered: number;
  forgot: number;
}

/** What happened on `date`, counting each card once by its latest result. */
export function getReviewSummary(reviewLog: readonly ReviewLogEntry[], date: ISODate): ReviewSummary {
  const latestByCard = new Map<string, ReviewLogEntry['result']>();
  reviewLog.filter((entry) => entry.date === date).forEach((entry) => latestByCard.set(entry.cardId, entry.result));

  const results = [...latestByCard.values()];
  return {
    reviewed: results.length,
    remembered: results.filter((result) => result === 'remembered').length,
    forgot: results.filter((result) => result === 'forgot').length,
  };
}

/** The next `limit` days that have reviews scheduled, with card counts. */
export function getUpcomingSchedule(cards: readonly Card[], today: ISODate, limit = 3) {
  const counts = new Map<ISODate, number>();
  cards
    .filter((card) => !isCardDue(card, today))
    .forEach((card) => counts.set(card.nextReviewDate, (counts.get(card.nextReviewDate) ?? 0) + 1));

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, limit)
    .map(([date, count]) => ({ date, count }));
}

export function isReviewSessionActive(session: ReviewSession, today: ISODate): boolean {
  return session.startedOn === today && session.currentIndex < session.queue.length;
}

export interface ReviewItem {
  card: Card;
  position: number;
  total: number;
}

/** The card currently under review, with its position in the session. */
export function getCurrentReviewItem(session: ReviewSession, cards: readonly Card[], today: ISODate): ReviewItem | null {
  if (!isReviewSessionActive(session, today)) return null;
  const card = cards.find((item) => item.id === session.queue[session.currentIndex]);
  return card ? { card, position: session.currentIndex + 1, total: session.queue.length } : null;
}

export { getCardsDueToday as getDueCards };
