import { icon } from './icons.js';
import { getNextStage, getReturnLabel } from '../utils/review-scheduler.js';

/**
 * Q&A cards first offer "إظهار الإجابة"; every other card (and a revealed Q&A)
 * shows the two outcome buttons. Each outcome hints when the card comes back,
 * so the schedule is felt rather than explained.
 */
export function renderReviewActions({ card, revealed }) {
  if (card.type === 'qa' && !revealed) {
    return `
      <div class="review-actions">
        <button type="button" class="review-action review-action--reveal" data-action="reveal-answer" data-autofocus>
          <span class="review-action__label">${icon('eye')}إظهار الإجابة</span>
        </button>
      </div>`;
  }

  // تذكرتها sits on the right, matching the → key; لم أتذكرها on the left, matching ←.
  return `
    <div class="review-actions" role="group" aria-label="هل تذكرت هذه البطاقة؟">
      <button type="button" class="review-action review-action--remembered" data-action="review-remembered" data-autofocus>
        <span class="review-action__label">${icon('check', { size: 18 })}تذكرتها</span>
        <span class="review-action__hint">تعود ${getReturnLabel(getNextStage(card.reviewStage))}</span>
      </button>
      <button type="button" class="review-action review-action--forgot" data-action="review-forgot">
        <span class="review-action__label">${icon('retry', { size: 18 })}لم أتذكرها</span>
        <span class="review-action__hint">تعود غدًا</span>
      </button>
    </div>`;
}

export function renderReviewShortcuts({ card, revealed }) {
  const shortcuts =
    card.type === 'qa' && !revealed
      ? ['<span><kbd>مسافة</kbd> أو اضغط على البطاقة لإظهار الإجابة</span>']
      : // Same visual order as the buttons above.
        ['<span><kbd>→</kbd> تذكرتها</span>', '<span><kbd>←</kbd> لم أتذكرها</span>'];

  return `<p class="review-shortcuts" aria-hidden="true">${shortcuts.join('')}</p>`;
}
