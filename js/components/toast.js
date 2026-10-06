import { icon } from './icons.js';

const VISIBLE_MS = 2800;
const MAX_TOASTS = 2;

/** Subtle, self-dismissing confirmation. Text is set via textContent (no HTML). */
export function showToast(message) {
  const region = document.getElementById('toast-region');
  if (!region) return;

  const toast = document.createElement('p');
  toast.className = 'toast';
  toast.innerHTML = icon('check', { size: 18 });
  toast.append(document.createTextNode(message));
  region.append(toast);

  while (region.children.length > MAX_TOASTS) region.firstElementChild.remove();

  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    window.setTimeout(() => toast.remove(), 400); // fallback when animations are disabled
  }, VISIBLE_MS);
}
