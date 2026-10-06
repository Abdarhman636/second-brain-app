import { icon } from './icons.js';

/** Moon in light mode, sun in dark mode; CSS picks which icon shows. */
export function renderThemeToggle({ className = '' } = {}) {
  return `
    <button type="button" class="icon-btn theme-toggle ${className}" data-action="toggle-theme"
      aria-label="تبديل المظهر بين الفاتح والداكن" title="الوضع الفاتح / الداكن">
      ${icon('moon', { size: 18, className: 'theme-toggle__moon' })}
      ${icon('sun', { size: 18, className: 'theme-toggle__sun' })}
    </button>`;
}
