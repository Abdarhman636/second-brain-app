/*
 * Memoized views of the store. Zustand selectors must return stable values,
 * so components select raw slices and derive everything else here.
 */
import { useMemo } from 'react';
import { getActiveCards } from '../domain/projects';
import { DEFAULT_DAILY_LIMIT, getCardsDueToday, getTodaysReviews } from '../domain/review-scheduler';
import { getStreakSummary } from '../domain/streak';
import type { ISODate, Project } from '../domain/types';
import { useAppStore } from '../store/app-store';
import { getReviewSummary } from '../store/selectors';

export function useActiveCards() {
  const cards = useAppStore((state) => state.cards);
  const projects = useAppStore((state) => state.projects);
  return useMemo(() => getActiveCards(cards, projects), [cards, projects]);
}

export function useDueCards(today: ISODate) {
  const activeCards = useActiveCards();
  return useMemo(() => getCardsDueToday(activeCards, today), [activeCards, today]);
}

/** Today's share of the due cards under the daily limit, and how many wait for tomorrow. */
export function useTodaysReviews(today: ISODate) {
  const activeCards = useActiveCards();
  const { reviewed } = useReviewSummary(today);
  const limit = useAppStore((state) => (state.user ? state.user.dailyLimit : DEFAULT_DAILY_LIMIT));
  return useMemo(() => ({ ...getTodaysReviews(activeCards, today, reviewed, limit), limit }), [activeCards, today, reviewed, limit]);
}

export function useProjectMap(): Map<string, Project> {
  const projects = useAppStore((state) => state.projects);
  return useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
}

export function useReviewSummary(today: ISODate) {
  const reviewLog = useAppStore((state) => state.reviewLog);
  return useMemo(() => getReviewSummary(reviewLog, today), [reviewLog, today]);
}

export function useStreak(today: ISODate) {
  const completedDays = useAppStore((state) => state.completedDays);
  const reviewLog = useAppStore((state) => state.reviewLog);
  const vacations = useAppStore((state) => state.vacations);
  const cards = useActiveCards();
  return useMemo(
    () => getStreakSummary({ completedDays, cards, reviewLog, vacations }, today),
    [completedDays, cards, reviewLog, vacations, today],
  );
}
