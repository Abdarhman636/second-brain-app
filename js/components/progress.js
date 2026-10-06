import { escapeHtml } from '../utils/helpers.js';

export function renderProgress({ value, max, label }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  const isComplete = max > 0 && value >= max;

  return `
    <div class="progress${isComplete ? ' progress--complete' : ''}" role="progressbar"
      aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}">
      <span class="progress__fill" style="width: ${percent}%"></span>
    </div>`;
}
