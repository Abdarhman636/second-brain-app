/*
 * Dashboard statistics. Pure functions over the review log and cards.
 */
import { addDays } from './date-utils';
import { summarizeStages } from './review-scheduler';
import type { Card, ISODate, Project, ReviewLogEntry } from './types';

export const STATS_WINDOW_DAYS = 30;
/** A project needs this many recent reviews before we call it "hard". */
export const MIN_REVIEWS_FOR_DIFFICULTY = 3;

export interface RecallStats {
  reviews: number;
  remembered: number;
  forgot: number;
  /** Share of reviews remembered, 0–100; null when there are no reviews yet. */
  rate: number | null;
}

function toRecallStats(entries: readonly Pick<ReviewLogEntry, 'result'>[]): RecallStats {
  const remembered = entries.filter((entry) => entry.result === 'remembered').length;
  return {
    reviews: entries.length,
    remembered,
    forgot: entries.length - remembered,
    rate: entries.length ? Math.round((remembered / entries.length) * 100) : null,
  };
}

function recentEntries(reviewLog: readonly ReviewLogEntry[], today: ISODate, days: number) {
  const since = addDays(today, -(days - 1));
  return reviewLog.filter((entry) => entry.date >= since && entry.date <= today);
}

/** How often reviews in the last `days` days were remembered. */
export function getRecallStats(reviewLog: readonly ReviewLogEntry[], today: ISODate, days = STATS_WINDOW_DAYS): RecallStats {
  return toRecallStats(recentEntries(reviewLog, today, days));
}

/** Cards that reached the monthly stages, out of all active cards. */
export function getRootedStats(cards: readonly Card[]) {
  const rooted = summarizeStages(cards).find((group) => group.id === 'rooted')?.count ?? 0;
  return { rooted, total: cards.length, percent: cards.length ? Math.round((rooted / cards.length) * 100) : 0 };
}

export interface ProjectDifficulty extends RecallStats {
  project: Project;
}

/**
 * The project with the lowest recall rate over the last `days` days, among
 * projects with enough reviews to judge. Null when none qualifies or every
 * project is fully remembered.
 */
export function getHardestProject(
  reviewLog: readonly ReviewLogEntry[],
  cards: readonly Card[],
  projects: readonly Project[],
  today: ISODate,
  days = STATS_WINDOW_DAYS,
): ProjectDifficulty | null {
  const projectOfCard = new Map(cards.map((card) => [card.id, card.projectId]));
  const entriesByProject = new Map<string, ReviewLogEntry[]>();

  recentEntries(reviewLog, today, days).forEach((entry) => {
    const projectId = projectOfCard.get(entry.cardId);
    if (!projectId) return;
    entriesByProject.set(projectId, [...(entriesByProject.get(projectId) ?? []), entry]);
  });

  const candidates = projects
    .filter((project) => !project.archived)
    .map((project) => ({ project, ...toRecallStats(entriesByProject.get(project.id) ?? []) }))
    .filter((item) => item.reviews >= MIN_REVIEWS_FOR_DIFFICULTY && item.forgot > 0);

  candidates.sort((a, b) => (a.rate ?? 100) - (b.rate ?? 100) || b.forgot - a.forgot);
  return candidates[0] ?? null;
}
