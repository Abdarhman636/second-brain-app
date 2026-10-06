import { icon } from '../components/icons.js';
import { renderProgress } from '../components/progress.js';
import { renderReviewCard } from '../components/review-card.js';
import { renderReviewActions, renderReviewShortcuts } from '../components/review-actions.js';
import { renderReviewCompletion } from '../components/review-completion.js';
import { renderEmptyState } from '../components/empty-state.js';
import {
  getCurrentReviewItem,
  getDueCards,
  getProjectById,
  getReviewSession,
  getReviewSummary,
  getStreakData,
  getUpcomingReview,
} from '../state/app-state.js';
import { getToday } from '../utils/date-utils.js';
import { getStreakSummary } from '../utils/streak.js';
import { routes } from '../router.js';

// Used to animate only when a new card appears, not on every re-render.
let lastRenderedCardId = null;

function renderFinished(container, today) {
  lastRenderedCardId = null;
  const summary = getReviewSummary(today);

  const content = summary.reviewed
    ? renderReviewCompletion({
        summary,
        upcoming: getUpcomingReview(today),
        today,
        streak: getStreakSummary(getStreakData(), today),
        pendingCount: getDueCards(today).length,
        headingLevel: 1,
      })
    : renderEmptyState({
        icon: 'sun',
        title: 'لا توجد مراجعات اليوم',
        message: 'أنت مخلص كل شيء حاليًا.',
        actions: [{ label: 'العودة إلى اليوم', href: routes.today, variant: 'secondary' }],
        headingLevel: 1,
      });

  container.innerHTML = `<div class="page page--narrow">${content}</div>`;
}

export function renderReviewPage(container) {
  const today = getToday();
  const item = getCurrentReviewItem(today);

  if (!item) {
    renderFinished(container, today);
    return;
  }

  const { card, position, total } = item;
  const { answerRevealed } = getReviewSession();
  const animate = card.id !== lastRenderedCardId;
  lastRenderedCardId = card.id;

  container.innerHTML = `
    <section class="review" aria-labelledby="review-title">
      <h1 class="visually-hidden" id="review-title">مراجعة اليوم</h1>

      <header class="review-bar">
        <a class="review-bar__exit" href="${routes.today}">${icon('close', { size: 18 })}إنهاء</a>
        <div class="review-bar__progress">
          ${renderProgress({ value: position - 1, max: total, label: 'تقدّم الجلسة' })}
          <span class="review-bar__count">${position} من ${total}</span>
        </div>
      </header>

      <div class="review-main">
        ${renderReviewCard({ card, project: getProjectById(card.projectId), revealed: answerRevealed, today, animate })}

        <footer class="review-footer">
          ${renderReviewActions({ card, revealed: answerRevealed })}
          ${renderReviewShortcuts({ card, revealed: answerRevealed })}
        </footer>
      </div>
    </section>`;

  // The clicked button was replaced by the re-render; keep keyboard focus in the flow.
  if (document.activeElement === document.body) {
    container.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
  }
}
