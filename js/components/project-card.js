import { projectAccent } from './accent.js';
import { renderProjectBadge } from './project-badge.js';
import { getProjectTypeLabel } from '../data/project-types.js';
import { escapeHtml } from '../utils/helpers.js';
import { routes } from '../router.js';

export function renderProjectCard(project, { cardCount, dueCount }) {
  return `
    <article class="project-card" ${projectAccent(project)}>
      <a class="project-card__link" href="${routes.project(project.id)}">
        <div class="project-card__top">
          ${renderProjectBadge(project)}
          <p class="type-tag">${escapeHtml(getProjectTypeLabel(project))}</p>
        </div>
        <h2 class="project-card__name">${escapeHtml(project.name)}</h2>
        <dl class="project-card__stats">
          <div>
            <dt>بطاقات</dt>
            <dd>${cardCount}</dd>
          </div>
          <div class="${dueCount ? 'is-due' : ''}">
            <dt>للمراجعة اليوم</dt>
            <dd>${dueCount}</dd>
          </div>
        </dl>
      </a>
    </article>`;
}
