/*
 * Review flow:
 *   click "تذكرتها" → submitReview → scheduler computes the next date
 *   → recordReview updates state → subscribers re-render the next card
 *   → when nothing is left due today, the day counts toward the streak.
 */
import {
  getCompletedDays,
  getCurrentPage,
  getCurrentReviewItem,
  getDueCards,
  getReviewSession,
  getReviewSummary,
  isReviewSessionActive,
  markDayCompleted,
  recordReview,
  setAnswerRevealed,
  startReviewSession,
} from '../state/app-state.js';
import { handleForgot, handleRemembered, REVIEW_RESULT } from '../utils/review-scheduler.js';
import { shouldCompleteDay } from '../utils/streak.js';
import { getToday } from '../utils/date-utils.js';
import { playCardExit } from '../components/review-card.js';

let isSubmitting = false;

function startSessionFromDueCards() {
  const today = getToday();
  const dueCards = getDueCards(today);
  if (dueCards.length) startReviewSession(dueCards.map((card) => card.id), today);
}

/** Called when entering #review: keep an in-progress session, else start a fresh one. */
export function prepareReviewSession() {
  if (!isReviewSessionActive(getToday())) startSessionFromDueCards();
}

export function restartReview() {
  startSessionFromDueCards();
}

/** Count the day toward the streak once every card due today has been reviewed. */
function completeDayIfDone(today) {
  const done = shouldCompleteDay({
    completedDays: getCompletedDays(),
    today,
    dueCount: getDueCards(today).length,
    reviewedCount: getReviewSummary(today).reviewed,
  });
  if (done) markDayCompleted(today);
}

/** Q&A cards must have their answer revealed before they can be graded. */
function canGrade(card) {
  return card.type !== 'qa' || getReviewSession().answerRevealed;
}

export function revealAnswer() {
  if (getCurrentReviewItem(getToday())) setAnswerRevealed();
}

async function submitReview(result) {
  if (isSubmitting) return;

  const today = getToday();
  const item = getCurrentReviewItem(today);
  if (!item || !canGrade(item.card)) return;

  isSubmitting = true;
  try {
    await playCardExit();
    const schedule = result === REVIEW_RESULT.remembered ? handleRemembered : handleForgot;
    recordReview({ card: schedule(item.card, today), result, date: today });
    completeDayIfDone(today);
  } finally {
    isSubmitting = false;
  }
}

export const rememberCard = () => submitReview(REVIEW_RESULT.remembered);
export const forgetCard = () => submitReview(REVIEW_RESULT.forgot);

/** Space reveals; → = تذكرتها, ← = لم أتذكرها. Uses `code` so Arabic layouts work too. */
export function handleReviewKeydown(event) {
  if (getCurrentPage() !== 'review') return;
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (document.querySelector('dialog[open]')) return;

  const item = getCurrentReviewItem(getToday());
  if (!item) return;

  if (!canGrade(item.card)) {
    if (event.code === 'Space') {
      event.preventDefault();
      revealAnswer();
    }
    return;
  }

  if (event.code === 'ArrowRight') {
    event.preventDefault();
    rememberCard();
  } else if (event.code === 'ArrowLeft') {
    event.preventDefault();
    forgetCard();
  }
}
