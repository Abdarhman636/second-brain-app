/*
 * All cards, across every project, with a light search and two filters.
 * Typing only re-renders the results list, so the search field keeps focus.
 */
import { renderEmptyState } from '../components/empty-state.js';
import { renderKnowledgeCard } from '../components/knowledge-card.js';
import { getCards, getDueCards, getProjectById, getProjects } from '../state/app-state.js';
import { CARD_TYPE_ORDER, getCardType } from '../data/card-types.js';
import { compareByReviewDate } from '../utils/review-scheduler.js';
import { filterCards } from '../utils/card-search.js';
import { getToday } from '../utils/date-utils.js';
import { escapeHtml, formatCount } from '../utils/helpers.js';

// Kept between visits so returning to the page restores the last search.
const filter = { query: '', projectId: '', type: '' };

function renderToolbar(projects) {
  // Drop a project filter whose project no longer exists.
  if (filter.projectId && !getProjectById(filter.projectId)) filter.projectId = '';

  const projectOptions = projects
    .map(
      (project) =>
        `<option value="${escapeHtml(project.id)}" ${project.id === filter.projectId ? 'selected' : ''}>${escapeHtml(project.name)}</option>`,
    )
    .join('');

  const typeOptions = CARD_TYPE_ORDER.map(
    (typeId) => `<option value="${typeId}" ${typeId === filter.type ? 'selected' : ''}>${getCardType(typeId).label}</option>`,
  ).join('');

  return `
    <form class="cards-toolbar" role="search" data-cards-filter>
      <label class="visually-hidden" for="cards-search">ابحث في البطاقات</label>
      <input class="input cards-toolbar__search" id="cards-search" name="query" type="search"
        placeholder="ابحث في البطاقات…" autocomplete="off" value="${escapeHtml(filter.query)}" />

      <label class="visually-hidden" for="cards-project">المشروع</label>
      <select class="select" id="cards-project" name="projectId">
        <option value="">كل المشاريع</option>${projectOptions}
      </select>

      <label class="visually-hidden" for="cards-type">نوع البطاقة</label>
      <select class="select" id="cards-type" name="type">
        <option value="">كل الأنواع</option>${typeOptions}
      </select>
    </form>`;
}

function renderResults(resultsElement) {
  const today = getToday();
  const matches = filterCards(getCards(), filter, getProjectById).sort(compareByReviewDate);
  const isFiltered = Boolean(filter.query || filter.projectId || filter.type);

  resultsElement.innerHTML = matches.length
    ? `
      <p class="cards-results__count" aria-live="polite">${isFiltered ? `${formatCount(matches.length, 'cards')} مطابقة` : ''}</p>
      <ul class="card-list" role="list">
        ${matches
          .map((card) => `<li>${renderKnowledgeCard(card, { today, project: getProjectById(card.projectId), showProject: true })}</li>`)
          .join('')}
      </ul>`
    : renderEmptyState({
        icon: 'cards',
        title: 'لا توجد بطاقات مطابقة',
        message: 'جرّب كلمة أخرى، أو غيّر المشروع أو النوع.',
      });
}

export function renderCardsPage(container) {
  const cards = getCards();
  const projects = getProjects();

  if (!cards.length) {
    container.innerHTML = `
      <div class="page page--narrow">
        ${renderEmptyState({
          icon: 'cardPlus',
          title: 'لا توجد بطاقات بعد',
          message: 'أضف أول بطاقة وابدأ بحفظ ما تتعلمه.',
          actions: [{ label: 'إضافة بطاقة', action: 'create-card' }],
          headingLevel: 1,
        })}
      </div>`;
    return;
  }

  const dueCount = getDueCards(getToday()).length;

  container.innerHTML = `
    <div class="page page--medium">
      <header class="page-header">
        <div>
          <h1 class="page-title">كل البطاقات</h1>
          <p class="page-subtitle">
            ${formatCount(cards.length, 'cards')} في ${formatCount(projects.length, 'projectsGenitive')}${dueCount ? ` · ${dueCount} للمراجعة اليوم` : ''}
          </p>
        </div>
      </header>

      ${renderToolbar(projects)}
      <div class="cards-results" data-cards-results></div>
    </div>`;

  const resultsElement = container.querySelector('[data-cards-results]');
  const form = container.querySelector('[data-cards-filter]');

  renderResults(resultsElement);

  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', (event) => {
    const { name, value } = event.target;
    if (!(name in filter)) return;
    filter[name] = value;
    renderResults(resultsElement);
  });
}
