/*
 * Project-level queries: archiving, activity and sorting. Pure functions.
 */
import { isCardDue } from './review-scheduler';
import type { Card, ISODate, ISODateTime, Project } from './types';

/** Cards of archived projects are paused: they never come up for review. */
export function getActiveCards(cards: readonly Card[], projects: readonly Project[]): Card[] {
  const archived = new Set(projects.filter((project) => project.archived).map((project) => project.id));
  return archived.size ? cards.filter((card) => !archived.has(card.projectId)) : [...cards];
}

export interface ProjectStats {
  cardCount: number;
  dueCount: number;
  /** Most recent change to the project or any of its cards (including reviews). */
  lastActivity: ISODateTime;
}

export function getProjectStats(project: Project, cards: readonly Card[], today: ISODate): ProjectStats {
  const projectCards = cards.filter((card) => card.projectId === project.id);
  return {
    cardCount: projectCards.length,
    dueCount: project.archived ? 0 : projectCards.filter((card) => isCardDue(card, today)).length,
    lastActivity: projectCards.reduce(
      (latest, card) => (card.updatedAt > latest ? card.updatedAt : latest),
      project.updatedAt,
    ),
  };
}

export type ProjectSort = 'activity' | 'due' | 'name' | 'newest';

export const PROJECT_SORT_OPTIONS: readonly { id: ProjectSort; label: string }[] = [
  { id: 'activity', label: 'آخر نشاط' },
  { id: 'due', label: 'الأكثر استحقاقًا' },
  { id: 'name', label: 'الاسم' },
  { id: 'newest', label: 'الأحدث إنشاءً' },
];

const nameCollator = new Intl.Collator('ar');

export function sortProjects<T extends { project: Project; stats: ProjectStats }>(items: readonly T[], sort: ProjectSort): T[] {
  const byActivity = (a: T, b: T) => b.stats.lastActivity.localeCompare(a.stats.lastActivity);

  const compare: Record<ProjectSort, (a: T, b: T) => number> = {
    activity: byActivity,
    due: (a, b) => b.stats.dueCount - a.stats.dueCount || byActivity(a, b),
    name: (a, b) => nameCollator.compare(a.project.name, b.project.name),
    newest: (a, b) => b.project.createdAt.localeCompare(a.project.createdAt),
  };
  return [...items].sort(compare[sort]);
}
