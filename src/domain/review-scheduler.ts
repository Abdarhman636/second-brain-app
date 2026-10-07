/*
 * Spaced-review scheduling. Pure functions only: no UI, no state access.
 * Every function receives the current date explicitly, which keeps the logic
 * deterministic and portable (web, React Native, or a database function).
 */
import { addDays, addMonths, diffInDays } from './date-utils';
import type { Card, DailyLimit, ISODate, ReviewResult, ReviewSchedule } from './types';

export const REVIEW_RESULT = {
  remembered: 'remembered',
  forgot: 'forgot',
} as const satisfies Record<ReviewResult, ReviewResult>;

interface ReviewStage {
  stage: number;
  label: string;
  interval: { days?: number; months?: number };
  /** When a card at this stage comes back, phrased for the user. */
  returnLabel: string;
}

/**
 * A card's `reviewStage` is the interval it is currently waiting on. A new card
 * sits at stage 0 (due immediately); each successful review moves it one stage
 * forward until it settles into the monthly cycle (the final stage).
 */
export const REVIEW_STAGES: readonly ReviewStage[] = Object.freeze([
  { stage: 0, label: 'جديدة', interval: { days: 0 }, returnLabel: 'اليوم' },
  { stage: 1, label: 'يوم', interval: { days: 1 }, returnLabel: 'غدًا' },
  { stage: 2, label: 'يومان', interval: { days: 2 }, returnLabel: 'بعد يومين' },
  { stage: 3, label: 'أسبوع', interval: { days: 7 }, returnLabel: 'بعد أسبوع' },
  { stage: 4, label: 'أسبوعان', interval: { days: 14 }, returnLabel: 'بعد أسبوعين' },
  { stage: 5, label: 'شهر', interval: { months: 1 }, returnLabel: 'بعد شهر' },
  { stage: 6, label: 'مراجعة شهرية', interval: { months: 1 }, returnLabel: 'بعد شهر' },
]);

export const INITIAL_STAGE = 0;
export const MONTHLY_STAGE = REVIEW_STAGES.length - 1;
const ONE_MONTH_STAGE = 5;
const FORGOT_RETRY_DAYS = 1;
/** How many stages a forgotten card falls back. */
export const FORGOT_STAGE_DROP = 2;

function getStage(stage: number): ReviewStage {
  const clamped = Math.min(Math.max(Math.trunc(stage) || 0, INITIAL_STAGE), MONTHLY_STAGE);
  return REVIEW_STAGES[clamped] as ReviewStage;
}

/* ---------- Stage information ---------- */

export function getReviewStageLabel(stage: number): string {
  return getStage(stage).label;
}

export function getReviewStageInterval(stage: number): ReviewStage['interval'] {
  return getStage(stage).interval;
}

export function getReturnLabel(stage: number): string {
  return getStage(stage).returnLabel;
}

export function getNextStage(stage: number): number {
  return Math.min(getStage(stage).stage + 1, MONTHLY_STAGE);
}

/**
 * Where a forgotten card falls back to. The monthly cycle counts as the
 * one-month stage, so forgetting a monthly card returns it to the 1-week
 * stage, and the next success brings it back after 2 weeks rather than a month.
 */
export function getForgottenStage(stage: number): number {
  const effective = Math.min(getStage(stage).stage, ONE_MONTH_STAGE);
  return Math.max(INITIAL_STAGE, effective - FORGOT_STAGE_DROP);
}

export function getNextReviewDate(stage: number, fromDate: ISODate): ISODate {
  const { days = 0, months = 0 } = getReviewStageInterval(stage);
  return months ? addMonths(fromDate, months) : addDays(fromDate, days);
}

/* ---------- Transitions ---------- */

/** Schedule fields for a newly created card: due today, at the first stage. */
export function createInitialSchedule(today: ISODate): ReviewSchedule {
  return { reviewStage: INITIAL_STAGE, nextReviewDate: today, lastReviewedAt: null, lastReviewResult: null };
}

/** Success: advance one stage and schedule by the new stage's interval. */
export function handleRemembered<T extends Card>(card: T, today: ISODate): T {
  const reviewStage = getNextStage(card.reviewStage);
  return {
    ...card,
    reviewStage,
    nextReviewDate: getNextReviewDate(reviewStage, today),
    lastReviewedAt: today,
    lastReviewResult: REVIEW_RESULT.remembered,
  };
}

/** Miss: fall back two stages and bring the card back tomorrow. */
export function handleForgot<T extends Card>(card: T, today: ISODate): T {
  return {
    ...card,
    reviewStage: getForgottenStage(card.reviewStage),
    nextReviewDate: addDays(today, FORGOT_RETRY_DAYS),
    lastReviewedAt: today,
    lastReviewResult: REVIEW_RESULT.forgot,
  };
}

export function applyReview<T extends Card>(card: T, result: ReviewResult, today: ISODate): T {
  return result === REVIEW_RESULT.remembered ? handleRemembered(card, today) : handleForgot(card, today);
}

/* ---------- Queries ---------- */

/** Overdue cards count as due: anything scheduled today or earlier. */
export function isCardDue(card: Pick<Card, 'nextReviewDate'>, today: ISODate): boolean {
  return card.nextReviewDate <= today;
}

export function getDaysOverdue(card: Pick<Card, 'nextReviewDate'>, today: ISODate): number {
  return Math.max(0, diffInDays(card.nextReviewDate, today));
}

/** Oldest due date first, then oldest card first. */
export function compareByReviewDate(a: Card, b: Card): number {
  return a.nextReviewDate.localeCompare(b.nextReviewDate) || a.createdAt.localeCompare(b.createdAt);
}

export function getCardsDueToday(cards: readonly Card[], today: ISODate): Card[] {
  return cards.filter((card) => isCardDue(card, today)).sort(compareByReviewDate);
}

/* ---------- Project review ---------- */

/**
 * Every card in one project, for reviewing that project on its own: the due
 * cards first (oldest first), then the rest by their next review date.
 */
export function getProjectReviewQueue(cards: readonly Card[], projectId: string): Card[] {
  return cards.filter((card) => card.projectId === projectId).sort(compareByReviewDate);
}

/**
 * Practising a card that isn't due yet. Remembering it changes nothing, so
 * reviewing early doesn't stretch its spacing. Forgetting it sends it back
 * to the daily review: it drops stages as any forgotten card does and is
 * due again today.
 */
export function applyPracticeResult<T extends Card>(card: T, result: ReviewResult, today: ISODate): T {
  if (result === REVIEW_RESULT.remembered) return card;
  return { ...card, reviewStage: getForgottenStage(card.reviewStage), nextReviewDate: today };
}

/* ---------- Daily limit ---------- */

export type { DailyLimit };

/** A rough pace for time estimates. */
export const CARDS_PER_MINUTE = 3;

export const DAILY_LIMIT_OPTIONS: readonly DailyLimit[] = [20, 30, 50, 100, null];
/** About ten minutes of review: enough to keep up, not so much that it becomes a chore. */
export const DEFAULT_DAILY_LIMIT = 30;

export interface TodaysReviews {
  /** The cards left for today, oldest due first. */
  cards: Card[];
  /** Due cards past today's limit. They stay due and come first tomorrow. */
  deferred: number;
}

/**
 * Today's share of the due cards: up to what's left of the daily limit after
 * the cards already reviewed today.
 */
export function getTodaysReviews(cards: readonly Card[], today: ISODate, reviewedToday: number, limit: DailyLimit): TodaysReviews {
  const due = getCardsDueToday(cards, today);
  const room = limit === null ? due.length : Math.max(0, limit - reviewedToday);
  return { cards: due.slice(0, room), deferred: Math.max(0, due.length - room) };
}

/* ---------- Progress toward long-term memory ---------- */

export type StageGroupId = 'learning' | 'strengthening' | 'rooted';

/** Stages grouped into three plain-language phases. */
export const STAGE_GROUPS: readonly { id: StageGroupId; label: string; stages: readonly number[] }[] = [
  { id: 'learning', label: 'قيد التعلّم', stages: [0, 1, 2] },
  { id: 'strengthening', label: 'تتقوّى', stages: [3, 4] },
  { id: 'rooted', label: 'راسخة', stages: [5, 6] },
];

export function summarizeStages(cards: readonly Card[]) {
  return STAGE_GROUPS.map((group) => ({
    ...group,
    count: cards.filter((card) => group.stages.includes(getStage(card.reviewStage).stage)).length,
  }));
}
