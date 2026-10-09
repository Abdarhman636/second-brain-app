/*
 * Sharing a project or a shelf by link. The link holds a snapshot: the
 * projects and their cards as they were when shared (the owner can refresh
 * it). It never carries review progress, and image cards stay private (their
 * pictures live in the owner's private storage).
 *
 * Copying a snapshot gives the copier their own new projects and cards, due
 * from today, which they can edit like anything they wrote. It counts toward
 * their plan's limits.
 */
import { CARD_TYPES } from './card-types';
import { PROJECT_COLORS } from './project-colors';
import { PROJECT_TYPES } from './project-types';
import { isAtLimit, PLANS, type LimitedResource, type PlanId, type ResourceCounts } from './plans';
import type { Card, CardBody, CardType, Project, ProjectColorId, ProjectTypeId, Shelf } from './types';

export type ShareKind = 'project' | 'shelf';

/** Card bodies that can be shared: every type except images. */
export type SharedCard = Exclude<CardBody, { type: 'image' }>;

export interface SharedProject {
  name: string;
  type: ProjectTypeId;
  customTypeLabel: string | null;
  color: ProjectColorId;
  cards: SharedCard[];
}

export interface ShareSnapshot {
  version: 1;
  kind: ShareKind;
  /** The shelf's name, for a shared shelf. */
  shelfName: string | null;
  projects: SharedProject[];
}

/** A shared item as its page shows it. */
export interface Share {
  id: string;
  kind: ShareKind;
  snapshot: ShareSnapshot;
  updatedAt: string;
  /** The owner's display name; null when they have none. */
  ownerName: string | null;
  /** How many people copied it. */
  copies: number;
  isOwner: boolean;
  copiedByMe: boolean;
}

/** Keeps a snapshot (and its page) a reasonable size. */
export const MAX_SHARED_CARDS = 2000;

const SHARE_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const SHARE_ID_PATTERN = /^[A-Za-z0-9]{12}$/;

/** A random, unguessable link id such as "aZ3kQ9mP2xLw". */
export function createShareId(): string {
  // 62 × 4 = 248, so bytes below 248 map evenly onto the alphabet.
  let id = '';
  while (id.length < 12) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte < 248 && id.length < 12) id += SHARE_ID_ALPHABET[byte % 62];
    }
  }
  return id;
}

/* ---------- Building a snapshot ---------- */

function toSharedCard(card: Card): SharedCard | null {
  if (card.type === 'image') return null;
  return { type: card.type, content: { ...card.content } } as SharedCard;
}

function toSharedProject(project: Project, cards: readonly Card[]): SharedProject {
  const shared = cards
    .filter((card) => card.projectId === project.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toSharedCard)
    .filter((card): card is SharedCard => card !== null);
  return { name: project.name, type: project.type, customTypeLabel: project.customTypeLabel, color: project.color, cards: shared };
}

export function buildProjectSnapshot(project: Project, cards: readonly Card[]): ShareSnapshot {
  return { version: 1, kind: 'project', shelfName: null, projects: [toSharedProject(project, cards)] };
}

/** A shelf with its projects (archived ones stay out). */
export function buildShelfSnapshot(shelf: Shelf, projects: readonly Project[], cards: readonly Card[]): ShareSnapshot {
  const onShelf = projects
    .filter((project) => project.shelfId === shelf.id && !project.archived)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { version: 1, kind: 'shelf', shelfName: shelf.name, projects: onShelf.map((project) => toSharedProject(project, cards)) };
}

/** Image cards left out of a snapshot of these projects. */
export function countSkippedImageCards(projectIds: readonly string[], cards: readonly Card[]): number {
  const ids = new Set(projectIds);
  return cards.filter((card) => ids.has(card.projectId) && card.type === 'image').length;
}

/* ---------- Reading a snapshot ---------- */

const PROJECT_TYPE_IDS = new Set<string>(PROJECT_TYPES.map((type) => type.id));
const PROJECT_COLOR_IDS = new Set<string>(PROJECT_COLORS.map((color) => color.id));

const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;

function parseCard(value: unknown): SharedCard | null {
  if (!value || typeof value !== 'object') return null;
  const { type, content } = value as { type?: unknown; content?: unknown };
  if (typeof type !== 'string' || type === 'image' || !(type in CARD_TYPES) || !content || typeof content !== 'object') return null;
  const fields = CARD_TYPES[type as CardType].fields.map((field) => field.name);
  const parsed: Record<string, string> = {};
  for (const name of fields) {
    const text = (content as Record<string, unknown>)[name];
    if (!isText(text, 5000)) return null;
    parsed[name] = text;
  }
  return { type, content: parsed } as unknown as SharedCard;
}

function parseProject(value: unknown): SharedProject | null {
  if (!value || typeof value !== 'object') return null;
  const project = value as Record<string, unknown>;
  if (!isText(project.name, 80) || !project.name.trim() || !Array.isArray(project.cards)) return null;
  const type = typeof project.type === 'string' && PROJECT_TYPE_IDS.has(project.type) ? (project.type as ProjectTypeId) : 'other';
  const color = typeof project.color === 'string' && PROJECT_COLOR_IDS.has(project.color) ? (project.color as ProjectColorId) : PROJECT_COLORS[0]!.id;
  const customTypeLabel = isText(project.customTypeLabel, 30) && project.customTypeLabel.trim() ? project.customTypeLabel : null;
  const cards = project.cards.map(parseCard).filter((card): card is SharedCard => card !== null);
  return { name: project.name, type, customTypeLabel, color, cards };
}

/**
 * A snapshot read from a link, checked field by field: it's written by
 * whoever shared it, so nothing is trusted. Null when it isn't usable.
 */
export function parseSnapshot(value: unknown): ShareSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as Record<string, unknown>;
  if (snapshot.kind !== 'project' && snapshot.kind !== 'shelf') return null;
  if (!Array.isArray(snapshot.projects)) return null;
  const projects = snapshot.projects.map(parseProject).filter((project): project is SharedProject => project !== null);
  if (!projects.length || (snapshot.kind === 'project' && projects.length !== 1)) return null;
  const shelfName = snapshot.kind === 'shelf' && isText(snapshot.shelfName, 40) && snapshot.shelfName.trim() ? snapshot.shelfName : null;
  if (snapshot.kind === 'shelf' && !shelfName) return null;
  return { version: 1, kind: snapshot.kind, shelfName, projects };
}

/* ---------- Copying ---------- */

/** What copying a snapshot adds to an account. */
export function countSnapshot(snapshot: ShareSnapshot): ResourceCounts {
  return {
    shelves: snapshot.kind === 'shelf' ? 1 : 0,
    projects: snapshot.projects.length,
    cards: snapshot.projects.reduce((sum, project) => sum + project.cards.length, 0),
  };
}

export interface CopyBlock {
  resource: LimitedResource;
  /** What the plan allows. */
  limit: number;
  /** How many the account would have after copying. */
  wouldHave: number;
}

/** The first limit that copying would pass, or null when it fits the plan. */
export function getCopyBlock(planId: PlanId, current: ResourceCounts, incoming: ResourceCounts): CopyBlock | null {
  for (const resource of ['shelves', 'projects', 'cards'] as const) {
    if (!incoming[resource]) continue;
    const wouldHave = current[resource] + incoming[resource];
    const limit = PLANS[planId].limits[resource];
    // isAtLimit asks "may I add one more?": one fewer than the total must still leave room.
    if (limit !== null && isAtLimit(planId, resource, { ...current, [resource]: wouldHave - 1 })) {
      return { resource, limit, wouldHave };
    }
  }
  return null;
}
