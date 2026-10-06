import { icon } from '../components/icons.js';
import { renderEmptyState } from '../components/empty-state.js';
import { renderProjectCard } from '../components/project-card.js';
import { getCards, getProjects, getProjectStats } from '../state/app-state.js';
import { getToday } from '../utils/date-utils.js';
import { formatCount } from '../utils/helpers.js';

export function renderProjectsPage(container) {
  const projects = getProjects();

  if (!projects.length) {
    container.innerHTML = `
      <div class="page page--narrow">
        ${renderEmptyState({
          icon: 'folderPlus',
          title: 'ابدأ أول مشروع لك',
          message: 'اجمع المعلومات التي تريد تذكرها، ونرتب لك مراجعتها مع الوقت.',
          actions: [{ label: 'إنشاء مشروع', action: 'create-project' }],
          headingLevel: 1,
        })}
      </div>`;
    return;
  }

  const today = getToday();

  container.innerHTML = `
    <div class="page">
      <header class="page-header">
        <div>
          <h1 class="page-title">المشاريع</h1>
          <p class="page-subtitle">${formatCount(projects.length, 'projects')} · ${formatCount(getCards().length, 'cards')}</p>
        </div>
        <button type="button" class="btn btn--secondary" data-action="create-project">
          ${icon('plus', { size: 18 })}مشروع جديد
        </button>
      </header>

      <ul class="project-grid" role="list">
        ${projects.map((project) => `<li>${renderProjectCard(project, getProjectStats(project.id, today))}</li>`).join('')}
      </ul>
    </div>`;
}
