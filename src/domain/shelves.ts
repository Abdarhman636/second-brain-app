/*
 * Shelves group projects: a "كتب" shelf holds one project per book, and each
 * project keeps its own cards. A project sits on one shelf or on none.
 */
import type { Project, Shelf } from './types';

export const SHELF_NAME_MAX_LENGTH = 40;

const nameCollator = new Intl.Collator('ar');

/** Shelves in alphabetical order, the way they're listed everywhere. */
export function sortShelves(shelves: readonly Shelf[]): Shelf[] {
  return [...shelves].sort((a, b) => nameCollator.compare(a.name, b.name));
}

export interface ShelfGroup<T> {
  /** null for the projects on no shelf. */
  shelf: Shelf | null;
  items: T[];
}

/**
 * Split (already sorted) projects by shelf: every shelf in name order, even
 * an empty one, then the projects on no shelf if there are any.
 */
export function groupByShelf<T extends { project: Pick<Project, 'shelfId'> }>(items: readonly T[], shelves: readonly Shelf[]): ShelfGroup<T>[] {
  const known = new Set(shelves.map((shelf) => shelf.id));
  const groups: ShelfGroup<T>[] = sortShelves(shelves).map((shelf) => ({
    shelf,
    items: items.filter((item) => item.project.shelfId === shelf.id),
  }));
  const loose = items.filter((item) => !item.project.shelfId || !known.has(item.project.shelfId));
  return loose.length ? [...groups, { shelf: null, items: loose }] : groups;
}

/** Projects left on no shelf once a shelf is deleted. */
export function removeShelfFromProjects(projects: readonly Project[], shelfId: string): Project[] {
  return projects.map((project) => (project.shelfId === shelfId ? { ...project, shelfId: null } : project));
}
