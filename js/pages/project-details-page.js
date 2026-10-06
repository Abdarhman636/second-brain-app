import { icon } from '../components/icons.js';
import { projectAccent } from '../components/accent.js';
import { renderProjectBadge } from '../components/project-badge.js';
import { renderEmptyState } from '../components/empty-state.js';
import { renderKnowledgeCard } from '../components/knowledge-card.js';
import { getCardsByProject, getProjectById, getProjectStats, getSelectedProjectId } from '../state/app-state.js';
import { getProjectTypeLabel } from '../data/project-types.js';
import { compareByReviewDate } from '../utils/review-scheduler.js';
import { getToday } from '../utils/date-utils.js';
import { escapeHtml, formatCount } from '../utils/helpers.js';
import { routes } from '../router.js';

function renderBackLink() {
  return `<a class="back-link" href="${routes.projects}">${icon('arrowRight', { size: 18 })}المشاريع</a>`;
}

function renderNotFound() {
  return `
    <div class="page page--narrow">
      ${renderBackLink()}
      ${renderEmptyState({
        icon: 'projects',
        title: 'لم نجد هذا المشروع',
        message: 'ربما حُذف أو تغيّر الرابط.',
        actions: [{ label: 'استعراض المشاريع', href: routes.projects }],
        headingLevel: 1,
      })}
    </div>`;
}

export function renderProjectDetailsPage(container) {
  const project = getProjectById(getSelectedProjectId());
  if (!project) {
    container.innerHTML = renderNotFound();
    return;
  }

  const today = getToday();
  const projectId = escapeHtml(project.id);
  const { cardCount, dueCount } = getProjectStats(project.id, today);
  const cards = [...getCardsByProject(project.id)].sort(compareByReviewDate);

  const cardsSection = cards.length
    ? `
      <section aria-labelledby="project-cards-heading">
        <h2 class="visually-hidden" id="project-cards-heading">بطاقات المشروع</h2>
        <ul class="card-list" role="list">
          ${cards.map((card) => `<li>${renderKnowledgeCard(card, { today, project })}</li>`).join('')}
        </ul>
      </section>`
    : renderEmptyState({
        icon: 'cardPlus',
        title: 'هذا المشروع فارغ',
        message: 'أضف أول بطاقة وابدأ بحفظ ما تتعلمه.',
        actions: [{ label: 'إضافة بطاقة', action: 'create-card', data: { projectId: project.id } }],
      });

  container.innerHTML = `
    <div class="page page--medium" ${projectAccent(project)}>
      ${renderBackLink()}

      <header class="project-hero">
        <div class="project-hero__identity">
          ${renderProjectBadge(project, { size: 'lg' })}
          <div>
            <p class="type-tag">${escapeHtml(getProjectTypeLabel(project))}</p>
            <h1 class="project-hero__title">${escapeHtml(project.name)}</h1>
          </div>
        </div>
        <p class="project-hero__meta">
          ${formatCount(cardCount, 'cards')}${dueCount ? ` · ${dueCount} للمراجعة اليوم` : ''}
        </p>
        <div class="project-hero__actions">
          <button type="button" class="btn btn--primary" data-action="create-card" data-project-id="${projectId}">
            ${icon('plus', { size: 18 })}إضافة بطاقة
          </button>
          <button type="button" class="btn btn--ghost" data-action="edit-project" data-project-id="${projectId}">
            ${icon('edit', { size: 16 })}تعديل المشروع
          </button>
        </div>
      </header>

      ${cardsSection}
    </div>`;
}
