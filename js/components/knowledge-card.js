import { icon } from './icons.js';
import { projectAccent } from './accent.js';
import { renderStageIndicator } from './stage-indicator.js';
import { getCardType } from '../data/card-types.js';
import { isCardDue } from '../utils/review-scheduler.js';
import { formatRelativeDate } from '../utils/date-utils.js';
import { escapeHtml } from '../utils/helpers.js';
import { routes } from '../router.js';

function renderContent({ type, content }) {
  switch (type) {
    case 'qa':
      return `
        <p class="k-card__question">${escapeHtml(content.question)}</p>
        <p class="k-card__answer"><span class="k-card__answer-label">الإجابة: </span>${escapeHtml(content.answer)}</p>`;
    case 'definition':
      return `
        <p class="k-card__term">${escapeHtml(content.term)}</p>
        <p class="k-card__text">${escapeHtml(content.definition)}</p>`;
    case 'quote':
      return `<blockquote class="k-card__quote"><p>${escapeHtml(content.text)}</p></blockquote>`;
    default:
      return `<p class="k-card__text">${escapeHtml(content.text)}</p>`;
  }
}

function renderProjectLink(project) {
  if (!project) return '';
  return `
    <a class="k-card__project" href="${routes.project(project.id)}">
      <span class="type-dot" aria-hidden="true"></span>${escapeHtml(project.name)}
    </a>`;
}

/**
 * The one card layout used everywhere cards are listed (home, all cards,
 * project details): content, schedule, and management actions.
 *
 * @param {object} options
 * @param {string} options.today
 * @param {object} options.project       the card's project (sets the accent color)
 * @param {boolean} [options.showProject] label the card with its project, for mixed lists
 */
export function renderKnowledgeCard(card, { today, project, showProject = false }) {
  const cardType = getCardType(card.type);
  const due = isCardDue(card, today);

  return `
    <article class="k-card" data-card-id="${escapeHtml(card.id)}" ${projectAccent(project)}>
      <header class="k-card__header">
        <div class="k-card__labels">
          ${showProject ? renderProjectLink(project) : ''}
          <span class="card-type">${icon(cardType.icon, { size: 16 })}${cardType.label}</span>
        </div>
        ${due ? '<span class="badge badge--due">مستحقة اليوم</span>' : ''}
      </header>

      <div class="k-card__content">${renderContent(card)}</div>

      <footer class="k-card__footer">
        <dl class="k-card__schedule">
          <div>
            <dt>المرحلة</dt>
            <dd>${renderStageIndicator(card.reviewStage)}</dd>
          </div>
          <div>
            <dt>المراجعة القادمة</dt>
            <dd>${due ? 'اليوم' : formatRelativeDate(card.nextReviewDate, today)}</dd>
          </div>
        </dl>
        <div class="k-card__actions">
          <button type="button" class="text-btn" data-action="edit-card" data-card-id="${escapeHtml(card.id)}" aria-label="تعديل البطاقة">
            ${icon('edit', { size: 15 })}تعديل
          </button>
          <button type="button" class="text-btn" data-action="move-card" data-card-id="${escapeHtml(card.id)}" aria-label="نقل البطاقة">
            ${icon('move', { size: 15 })}نقل
          </button>
          <button type="button" class="text-btn text-btn--danger" data-action="delete-card" data-card-id="${escapeHtml(card.id)}" aria-label="حذف البطاقة">
            ${icon('trash', { size: 15 })}حذف
          </button>
        </div>
      </footer>
    </article>`;
}
