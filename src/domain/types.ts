/*
 * Core data model. Shared by every layer (and later by the React Native app),
 * and shaped to map directly onto database tables.
 */
import type { PlanId } from './plans';

/** A calendar day as "YYYY-MM-DD" in the user's local time. Sorts lexically. */
export type ISODate = string;

/** A full timestamp, e.g. "2026-10-06T08:30:00.000Z". */
export type ISODateTime = string;

/** The most cards a day's review asks for; `null` means no limit. */
export type DailyLimit = number | null;

export interface User {
  id: string;
  name: string;
  email: string;
  /** Saved with the account, so it follows the user to other devices. */
  dailyLimit: DailyLimit;
  /** Asked when signing up; null when the user hasn't answered. */
  isStudent: boolean | null;
  /** The plan in effect: a paid plan until it expires, else free. Set on the server only. */
  plan: PlanId;
  /** When the paid plan ends; null on the free plan. */
  planExpiresAt: ISODateTime | null;
  /** Reviews payments. Set on the server only (Supabase app_metadata). */
  isAdmin: boolean;
}

/* ---------- Shelves ---------- */

/** A named group of projects, e.g. "كتب" holding one project per book. */
export interface Shelf {
  id: string;
  name: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* ---------- Projects ---------- */

export type ProjectTypeId =
  | 'book'
  | 'podcast'
  | 'course'
  | 'curriculum'
  | 'topic'
  | 'skill'
  | 'personal'
  | 'other';

export type ProjectColorId =
  | 'graphite'
  | 'clay'
  | 'terracotta'
  | 'rose'
  | 'plum'
  | 'blue'
  | 'teal'
  | 'sage'
  | 'olive'
  | 'ochre';

export interface Project {
  id: string;
  name: string;
  type: ProjectTypeId;
  /** The user's own type name, used when `type` is "other". */
  customTypeLabel: string | null;
  color: ProjectColorId;
  /** The shelf the project sits on; null when it's on none. */
  shelfId: string | null;
  /** Archived projects keep their cards, but their reviews are paused. */
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type ProjectInput = Pick<Project, 'name' | 'type' | 'customTypeLabel' | 'color' | 'shelfId'>;

/* ---------- Cards ---------- */

export type CardType = 'note' | 'qa' | 'quote' | 'definition' | 'image';

export interface NoteContent {
  text: string;
}
export interface QaContent {
  question: string;
  answer: string;
}
export interface QuoteContent {
  /** The opening, shown during review. */
  text: string;
  /** The rest of the quote, hidden until the card is revealed. */
  continuation: string;
}
export interface DefinitionContent {
  term: string;
  definition: string;
}
export interface ImageContent {
  /** Shown during review; the image itself is the hidden part. */
  title: string;
  /** A data URL while the app has no backend; a storage URL once it does. */
  imageUrl: string;
}

/** A card's type together with its matching content shape. */
export type CardBody =
  | { type: 'note'; content: NoteContent }
  | { type: 'qa'; content: QaContent }
  | { type: 'quote'; content: QuoteContent }
  | { type: 'definition'; content: DefinitionContent }
  | { type: 'image'; content: ImageContent };

export type ReviewResult = 'remembered' | 'forgot';

export interface ReviewSchedule {
  reviewStage: number;
  nextReviewDate: ISODate;
  lastReviewedAt: ISODate | null;
  lastReviewResult: ReviewResult | null;
}

export type Card = CardBody &
  ReviewSchedule & {
    id: string;
    projectId: string;
    createdAt: ISODateTime;
    updatedAt: ISODateTime;
  };

export type CardInput = CardBody & { projectId: string };

/* ---------- Reviews & streak ---------- */

export interface ReviewLogEntry {
  id: string;
  cardId: string;
  result: ReviewResult;
  /** The day the review happened. */
  date: ISODate;
  /** The day the card was due — lets the streak tell a missed day from a rest day. */
  dueDate: ISODate;
  reviewedAt: ISODateTime;
}

/**
 * A break from reviewing. Vacation days never break the streak, and reviews
 * that come due during one are pushed back when it ends.
 */
export interface Vacation {
  id: string;
  start: ISODate;
  /** Last day of the vacation; null while it's still going on. */
  end: ISODate | null;
}

/** Everything that belongs to one user, as loaded from the data source. */
export interface UserData {
  shelves: Shelf[];
  projects: Project[];
  cards: Card[];
  reviewLog: ReviewLogEntry[];
  /** Days on which every due card was reviewed. */
  completedDays: ISODate[];
  vacations: Vacation[];
}
