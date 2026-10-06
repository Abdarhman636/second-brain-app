import { icon } from './icons.js';
import { dataAttributes, escapeHtml } from '../utils/helpers.js';

function renderAction({ label, href, action, data, variant = 'primary' }) {
  const className = `btn btn--${variant}`;
  if (href) return `<a class="${className}" href="${href}">${escapeHtml(label)}</a>`;
  return `<button type="button" class="${className}" data-action="${action}" ${dataAttributes(data)}>${escapeHtml(label)}</button>`;
}

/**
 * @param {object} options
 * @param {string} options.icon       icon name
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.note]     secondary line, e.g. the next review date
 * @param {Array}  [options.actions]  [{ label, href | action, data, variant }]
 * @param {number} [options.headingLevel]
 */
export function renderEmptyState({ icon: iconName, title, message, note, actions = [], headingLevel = 2 }) {
  const heading = `h${headingLevel}`;
  return `
    <section class="empty-state">
      <div class="empty-state__icon">${icon(iconName, { size: 24 })}</div>
      <${heading} class="empty-state__title">${escapeHtml(title)}</${heading}>
      <p class="empty-state__message">${escapeHtml(message)}</p>
      ${note ? `<p class="empty-state__note">${escapeHtml(note)}</p>` : ''}
      ${actions.length ? `<div class="empty-state__actions">${actions.map(renderAction).join('')}</div>` : ''}
    </section>`;
}
