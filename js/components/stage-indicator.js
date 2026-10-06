import { getReviewStageLabel, MONTHLY_STAGE } from '../utils/review-scheduler.js';

/** A row of small steps showing how far a card is on its way to long-term memory. */
export function renderStageIndicator(stage) {
  const label = getReviewStageLabel(stage);
  const steps = Array.from(
    { length: MONTHLY_STAGE },
    (_, index) => `<span class="stage__step${index < stage ? ' is-filled' : ''}"></span>`,
  ).join('');

  return `
    <span class="stage" role="img" aria-label="مرحلة المراجعة: ${label}">
      <span class="stage__track" aria-hidden="true">${steps}</span>
      <span class="stage__label" aria-hidden="true">${label}</span>
    </span>`;
}
