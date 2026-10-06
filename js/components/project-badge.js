import { escapeHtml } from '../utils/helpers.js';

/** First meaningful letter of a project name, skipping the Arabic article "ال". */
export function getProjectInitial(name = '') {
  const trimmed = name.trim();
  const base = trimmed.startsWith('ال') && trimmed.length > 3 ? trimmed.slice(2) : trimmed;
  return [...base][0] ?? '•';
}

/** Monogram tile in the project's accent color. Must sit inside a [data-accent] scope. */
export function renderProjectBadge(project, { size = 'md' } = {}) {
  return `<span class="project-badge project-badge--${size}" aria-hidden="true">${escapeHtml(getProjectInitial(project.name))}</span>`;
}
