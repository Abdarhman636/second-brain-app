/*
 * One reusable modal built on the native <dialog> element, which provides
 * focus trapping, Escape handling, and inert background content for free.
 */
import { escapeHtml } from '../utils/helpers.js';
import { icon } from './icons.js';

const dialog = document.getElementById('app-modal');
let current = null; // { onClose, opener }

dialog.addEventListener('click', (event) => {
  // A click on the dialog element itself means the backdrop was clicked.
  if (event.target === dialog || event.target.closest('[data-modal-close]')) closeModal();
});

dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeModal();
});

// Safety net in case the browser closes the dialog on its own.
dialog.addEventListener('close', () => {
  if (!dialog.open && current) finalizeClose();
});

export function openModal({ title, body, onMount, onClose, variant }) {
  if (dialog.open) closeModal();

  current = { onClose, opener: describeOpener(document.activeElement) };
  dialog.className = variant ? `modal modal--${variant}` : 'modal';
  dialog.innerHTML = `
    <div class="modal__panel">
      <header class="modal__header">
        <h2 class="modal__title" id="modal-title">${escapeHtml(title)}</h2>
        <button type="button" class="icon-btn modal__close" data-modal-close aria-label="إغلاق">
          ${icon('close')}
        </button>
      </header>
      <div class="modal__body">${body}</div>
    </div>`;

  dialog.showModal();
  onMount?.(dialog);
}

export function closeModal() {
  if (!dialog.open) return;
  dialog.close();
  finalizeClose();
}

function finalizeClose() {
  const closed = current;
  current = null;
  closed?.onClose?.();
  restoreFocus(closed?.opener);
}

/**
 * The element that opened the modal may have been re-rendered while the modal
 * was open, so we remember a selector that can find its replacement.
 */
function describeOpener(element) {
  if (!element || element === document.body) return null;

  const { action, cardId, projectId } = element.dataset ?? {};
  if (!action) return { element, selector: null };

  const selector = [
    `[data-action="${CSS.escape(action)}"]`,
    cardId ? `[data-card-id="${CSS.escape(cardId)}"]` : '',
    projectId ? `[data-project-id="${CSS.escape(projectId)}"]` : '',
  ].join('');
  return { element, selector };
}

function restoreFocus(opener) {
  if (!opener || dialog.open) return;
  const target = opener.element.isConnected
    ? opener.element
    : opener.selector && document.querySelector(opener.selector);
  target?.focus({ preventScroll: true });
}

/** Promise-based confirmation for destructive actions. */
export function confirmAction({ title, message, confirmLabel, cancelLabel = 'إلغاء' }) {
  return new Promise((resolve) => {
    let confirmed = false;

    openModal({
      title,
      variant: 'compact',
      body: `
        <p class="modal__message">${escapeHtml(message)}</p>
        <div class="form-footer">
          <button type="button" class="btn btn--danger" data-confirm>${escapeHtml(confirmLabel)}</button>
          <button type="button" class="btn btn--secondary" data-modal-close autofocus>${escapeHtml(cancelLabel)}</button>
        </div>`,
      onMount: (element) => {
        element.querySelector('[data-confirm]').addEventListener('click', () => {
          confirmed = true;
          closeModal();
        });
      },
      onClose: () => resolve(confirmed),
    });
  });
}
