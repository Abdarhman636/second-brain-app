import { icon } from './icons.js';
import { projectAccent } from './accent.js';
import { getProjectTypeLabel } from '../data/project-types.js';
import { escapeHtml, formatCount } from '../utils/helpers.js';

/** A list of projects to choose from; the current project is shown but disabled. */
export function renderProjectPicker({ projects, currentProjectId, getCardCount }) {
  const options = projects
    .map((project) => {
      const isCurrent = project.id === currentProjectId;
      const meta = `${escapeHtml(getProjectTypeLabel(project))} · ${formatCount(getCardCount(project.id), 'cards')}`;

      return `
        <li>
          <button type="button" class="choice" data-target-project="${escapeHtml(project.id)}"
            ${projectAccent(project)} ${isCurrent ? 'disabled' : ''}>
            <span class="type-dot" aria-hidden="true"></span>
            <span class="choice__body">
              <span class="choice__name">${escapeHtml(project.name)}</span>
              <span class="choice__meta">${meta}</span>
            </span>
            ${isCurrent ? '<span class="choice__current">المشروع الحالي</span>' : icon('arrowLeft', { size: 18 })}
          </button>
        </li>`;
    })
    .join('');

  const hasOtherProjects = projects.some((project) => project.id !== currentProjectId);

  return `
    <ul class="choice-list" role="list" data-project-picker>${options}</ul>
    ${hasOtherProjects ? '' : '<p class="choice-list__empty">لا توجد مشاريع أخرى بعد. أنشئ مشروعًا جديدًا لتنقل إليه البطاقة.</p>'}
    <div class="form-footer">
      <button type="button" class="btn btn--ghost" data-modal-close>إلغاء</button>
    </div>`;
}
