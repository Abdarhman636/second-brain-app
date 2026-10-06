import { openModal, closeModal, confirmAction } from '../components/modal.js';
import { renderCardForm, bindCardForm } from '../components/card-form.js';
import { renderProjectPicker } from '../components/project-picker.js';
import { showToast } from '../components/toast.js';
import {
  addCard,
  deleteCard,
  getCardById,
  getCardsByProject,
  getLastUsedProjectId,
  getProjectById,
  getProjects,
  getSelectedProjectId,
  moveCard,
  updateCard,
} from '../state/app-state.js';
import { DEFAULT_CARD_TYPE } from '../data/card-types.js';
import { createInitialSchedule } from '../utils/review-scheduler.js';
import { getToday } from '../utils/date-utils.js';
import { openCreateProject } from './project-actions.js';

function openCardForm({ title, submitLabel, values, onSubmit }) {
  openModal({
    title,
    body: renderCardForm({ values, projects: getProjects(), submitLabel }),
    onMount: (dialog) => bindCardForm(dialog.querySelector('[data-card-form]'), { values, onSubmit }),
  });
}

/**
 * Preselect the project the user is looking at, else the one they last added
 * to. With neither, the form asks the user to choose.
 */
function getDefaultProjectId(preferredId) {
  const candidates = [preferredId, getSelectedProjectId(), getLastUsedProjectId()];
  return candidates.find((id) => id && getProjectById(id)) ?? '';
}

export function openCreateCard({ projectId } = {}) {
  if (!getProjects().length) {
    // Cards live inside projects, so the first card starts with a project.
    openCreateProject({
      lead: 'تُحفظ البطاقات داخل مشاريع. أنشئ مشروعك الأول، ثم أضف إليه بطاقتك.',
      onCreated: (project) => openCreateCard({ projectId: project.id }),
    });
    return;
  }

  openCardForm({
    title: 'بطاقة جديدة',
    submitLabel: 'إضافة البطاقة',
    values: { projectId: getDefaultProjectId(projectId), type: DEFAULT_CARD_TYPE, content: {} },
    onSubmit: (values) => {
      // New cards are due immediately, at the first review stage.
      addCard({ ...values, ...createInitialSchedule(getToday()) });
      closeModal();
      showToast('أُضيفت البطاقة إلى مراجعة اليوم');
    },
  });
}

export function openEditCard(cardId) {
  const card = getCardById(cardId);
  if (!card) return;

  openCardForm({
    title: 'تعديل البطاقة',
    submitLabel: 'حفظ التغييرات',
    values: { projectId: card.projectId, type: card.type, content: card.content },
    onSubmit: (values) => {
      // Editing never resets the card's place in the review schedule.
      updateCard(card.id, values);
      closeModal();
      showToast('حُفظت التعديلات');
    },
  });
}

export function openMoveCard(cardId) {
  const card = getCardById(cardId);
  if (!card) return;

  openModal({
    title: 'نقل إلى مشروع',
    body: renderProjectPicker({
      projects: getProjects(),
      currentProjectId: card.projectId,
      getCardCount: (projectId) => getCardsByProject(projectId).length,
    }),
    onMount: (dialog) => {
      dialog.querySelector('[data-project-picker]').addEventListener('click', (event) => {
        const option = event.target.closest('[data-target-project]');
        if (!option || option.disabled) return;

        const target = getProjectById(option.dataset.targetProject);
        moveCard(card.id, target.id);
        closeModal();
        showToast(`نُقلت البطاقة إلى «${target.name}»`);
      });
    },
  });
}

export async function confirmDeleteCard(cardId) {
  if (!getCardById(cardId)) return;

  const confirmed = await confirmAction({
    title: 'حذف البطاقة؟',
    message: 'سيتم حذف هذه البطاقة نهائيًا.',
    confirmLabel: 'حذف',
  });
  if (!confirmed) return;

  deleteCard(cardId);
  showToast('حُذفت البطاقة');
}
