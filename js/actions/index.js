/*
 * Maps `data-action` attributes in rendered markup to handlers. A single
 * delegated listener (see main.js) dispatches through this table, so
 * components stay free of event wiring and no inline handlers are needed.
 */
import { openCreateProject, openEditProject } from './project-actions.js';
import { confirmDeleteCard, openCreateCard, openEditCard, openMoveCard } from './card-actions.js';
import { forgetCard, rememberCard, restartReview, revealAnswer } from './review-actions.js';
import { signOut } from './auth-actions.js';
import { toggleTheme } from './theme-actions.js';

export const actionHandlers = {
  'create-project': () => openCreateProject(),
  'edit-project': ({ projectId }) => openEditProject(projectId),
  'create-card': ({ projectId }) => openCreateCard({ projectId }),
  'edit-card': ({ cardId }) => openEditCard(cardId),
  'move-card': ({ cardId }) => openMoveCard(cardId),
  'delete-card': ({ cardId }) => confirmDeleteCard(cardId),
  'reveal-answer': () => revealAnswer(),
  'review-remembered': () => rememberCard(),
  'review-forgot': () => forgetCard(),
  'restart-review': () => restartReview(),
  'sign-out': () => signOut(),
  'toggle-theme': () => toggleTheme(),
};
