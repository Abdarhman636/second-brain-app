/*
 * Spaced-review scheduling. Pure functions only: no DOM, no state access.
 * Every function receives the current date explicitly, which keeps the logic
 * deterministic and easy to move to a server or database function later.
 */
import { addDays, addMonths, diffInDays } from './date-utils.js';

export const REVIEW_RESULT = Object.freeze({
  remembered: 'remembered',
  forgot: 'forgot',
});

/**
 * A card's `reviewStage` is the interval it is currently waiting on. A new card
 * sits at stage 0 (due immediately); each successful review moves it one stage
 * forward until it settles into the monthly cycle (the final stage).
 */
export const REVIEW_STAGES = Object.freeze([
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
const FORGOT_RETRY_DAYS = 1;

function clampStage(stage) {
  return Math.min(Math.max(Number(stage) || 0, INITIAL_STAGE), MONTHLY_STAGE);
}

/* ---------- Stage information ---------- */

export function getReviewStageLabel(stage) {
  return REVIEW_STAGES[clampStage(stage)].label;
}

export function getReviewStageInterval(stage) {
  return REVIEW_STAGES[clampStage(stage)].interval;
}

/** When a card at `stage` comes back, phrased for the user ("بعد أسبوع"). */
export function getReturnLabel(stage) {
  return REVIEW_STAGES[clampStage(stage)].returnLabel;
}

export function getNextStage(stage) {
  return Math.min(clampStage(stage) + 1, MONTHLY_STAGE);
}

export function getNextReviewDate(stage, fromDate) {
  const { days = 0, months = 0 } = getReviewStageInterval(stage);
  return months ? addMonths(fromDate, months) : addDays(fromDate, days);
}

/* ---------- Transitions ---------- */

/** Schedule fields for a newly created card: due today, at the first stage. */
export function createInitialSchedule(today) {
  return {
    reviewStage: INITIAL_STAGE,
    nextReviewDate: today,
    lastReviewedAt: null,
    lastReviewResult: null,
  };
}

/** Success: advance one stage and schedule by the new stage's interval. */
export function handleRemembered(card, today) {
  const reviewStage = getNextStage(card.reviewStage);
  return {
    ...card,
    reviewStage,
    nextReviewDate: getNextReviewDate(reviewStage, today),
    lastReviewedAt: today,
    lastReviewResult: REVIEW_RESULT.remembered,
  };
}

/** Miss: keep the stage and bring the card back tomorrow. */
export function handleForgot(card, today) {
  return {
    ...card,
    nextReviewDate: addDays(today, FORGOT_RETRY_DAYS),
    lastReviewedAt: today,
    lastReviewResult: REVIEW_RESULT.forgot,
  };
}

/* ---------- Queries ---------- */

/** Overdue cards count as due: anything scheduled today or earlier. */
export function isCardDue(card, today) {
  return card.nextReviewDate <= today;
}

export function getDaysOverdue(card, today) {
  return Math.max(0, diffInDays(card.nextReviewDate, today));
}

/** Oldest due date first, then oldest card first. */
export function compareByReviewDate(a, b) {
  return (
    a.nextReviewDate.localeCompare(b.nextReviewDate) ||
    String(a.createdAt).localeCompare(String(b.createdAt))
  );
}

export function getCardsDueToday(cards, today) {
  return cards.filter((card) => isCardDue(card, today)).sort(compareByReviewDate);
}

/* ---------- Progress toward long-term memory ---------- */

/** Stages grouped into three plain-language phases for the dashboard. */
export const STAGE_GROUPS = Object.freeze([
  { id: 'learning', label: 'قيد التعلّم', stages: [0, 1, 2] },
  { id: 'strengthening', label: 'تتقوّى', stages: [3, 4] },
  { id: 'rooted', label: 'راسخة', stages: [5, 6] },
]);

export function summarizeStages(cards) {
  return STAGE_GROUPS.map((group) => ({
    ...group,
    count: cards.filter((card) => group.stages.includes(clampStage(card.reviewStage))).length,
  }));
}
