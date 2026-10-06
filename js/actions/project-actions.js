import { openModal, closeModal } from '../components/modal.js';
import { renderProjectForm, bindProjectForm } from '../components/project-form.js';
import { showToast } from '../components/toast.js';
import { addProject, getProjectById, getProjects, updateProject } from '../state/app-state.js';
import { DEFAULT_PROJECT_TYPE } from '../data/project-types.js';
import { suggestProjectColor } from '../data/project-colors.js';
import { navigate, routes } from '../router.js';

/**
 * @param {object} [options]
 * @param {string} [options.lead]            short context shown above the form
 * @param {Function} [options.onCreated]     continue another flow instead of opening the project
 */
export function openCreateProject({ lead, onCreated } = {}) {
  const values = { type: DEFAULT_PROJECT_TYPE, color: suggestProjectColor(getProjects()) };

  openModal({
    title: 'مشروع جديد',
    body: renderProjectForm({ values, submitLabel: 'إنشاء المشروع', lead }),
    onMount: (dialog) =>
      bindProjectForm(dialog.querySelector('[data-project-form]'), {
        onSubmit: (data) => {
          const project = addProject(data);
          closeModal();

          if (onCreated) {
            onCreated(project);
            return;
          }
          navigate(routes.project(project.id));
          showToast(`أُنشئ مشروع «${project.name}»`);
        },
      }),
  });
}

export function openEditProject(projectId) {
  const project = getProjectById(projectId);
  if (!project) return;

  openModal({
    title: 'تعديل المشروع',
    body: renderProjectForm({ values: project, submitLabel: 'حفظ التغييرات' }),
    onMount: (dialog) =>
      bindProjectForm(dialog.querySelector('[data-project-form]'), {
        onSubmit: (data) => {
          updateProject(project.id, data);
          closeModal();
          showToast('حُفظت تغييرات المشروع');
        },
      }),
  });
}
