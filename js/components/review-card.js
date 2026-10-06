import { icon } from './icons.js';
import { projectAccent } from './accent.js';
import { renderStageIndicator } from './stage-indicator.js';
import { getCardLength, getCardType } from '../data/card-types.js';
import { getProjectTypeLabel } from '../data/project-types.js';
import { getDaysOverdue, INITIAL_STAGE, REVIEW_RESULT } from '../utils/review-scheduler.js';
import { escapeHtml, formatCount, prefersReducedMotion } from '../utils/helpers.js';

const LONG_CONTENT_THRESHOLD = 180;
const EXIT_DURATION_MS = 140; // keep in sync with .review-card.is-leaving in review.css

function renderBody({ type, content }, revealed) {
  switch (type) {
    case 'qa':
      return `
        <p class="review-card__question">${escapeHtml(content.question)}</p>
        ${
          revealed
            ? `<div class="review-card__answer">
                 <p class="review-card__answer-label">الإجابة</p>
                 <p class="review-card__answer-text">${escapeHtml(content.answer)}</p>
               </div>`
            : ''
        }`;
    case 'quote':
      return `<blockquote class="review-card__quote"><p>${escapeHtml(content.text)}</p></blockquote>`;
    case 'definition':
      return `
        <p class="review-card__term">${escapeHtml(content.term)}</p>
        <p class="review-card__definition">${escapeHtml(content.definition)}</p>`;
    default:
      return `<p class="review-card__text">${escapeHtml(content.text)}</p>`;
  }
}

/** Only surfaces review context when it is useful. */
function renderReviewNote(card, today) {
  const overdueDays = getDaysOverdue(card, today);
  if (overdueDays === 1) return '<p class="review-card__note review-card__note--warning">كانت مستحقة أمس</p>';
  if (overdueDays > 1) {
    return `<p class="review-card__note review-card__note--warning">متأخرة منذ ${formatCount(overdueDays, 'days')}</p>`;
  }
  if (card.lastReviewResult === REVIEW_RESULT.forgot) {
    return '<p class="review-card__note">لم تتذكرها في المرة السابقة</p>';
  }
  if (card.reviewStage === INITIAL_STAGE) return '<p class="review-card__note">أول مراجعة</p>';
  return '';
}

export function renderReviewCard({ card, project, revealed, today, animate }) {
  const cardType = getCardType(card.type);
  // An unanswered Q&A card reveals its answer when clicked anywhere.
  const revealable = card.type === 'qa' && !revealed;
  const classes = [
    'review-card',
    animate ? 'is-entering' : '',
    revealable ? 'is-revealable' : '',
    getCardLength(card) > LONG_CONTENT_THRESHOLD ? 'is-long' : '',
  ].join(' ');

  return `
    <article class="${classes.replace(/\s+/g, ' ').trim()}" data-review-card ${projectAccent(project)}
      ${revealable ? 'data-action="reveal-answer"' : ''} aria-labelledby="review-card-meta">
      <header class="review-card__meta" id="review-card-meta">
        <span class="review-card__project">
          <span class="type-tag"><span class="type-dot" aria-hidden="true"></span>${escapeHtml(project?.name ?? '')}</span>
          <span class="review-card__project-type">${escapeHtml(getProjectTypeLabel(project))}</span>
        </span>
        <span class="card-type">${icon(cardType.icon, { size: 16 })}${cardType.label}</span>
      </header>

      <div class="review-card__body">
        ${renderBody(card, revealed)}
        ${revealable ? '<p class="review-card__reveal-hint" aria-hidden="true">اضغط على البطاقة لإظهار الإجابة</p>' : ''}
      </div>

      <footer class="review-card__info">
        ${renderStageIndicator(card.reviewStage)}
        ${renderReviewNote(card, today)}
      </footer>
    </article>`;
}

/** Plays the short exit animation on the current card; resolves when done. */
export function playCardExit() {
  const cardElement = document.querySelector('[data-review-card]');
  if (!cardElement || prefersReducedMotion()) return Promise.resolve();

  cardElement.classList.add('is-leaving');
  return new Promise((resolve) => window.setTimeout(resolve, EXIT_DURATION_MS));
}
