/*
 * Light / dark theme. With no choice made, the app follows the system setting
 * (pure CSS, see variables.css). Toggling pins a theme on <html data-theme>
 * for the rest of the visit; like the rest of the app, it isn't persisted.
 */
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

export function getActiveTheme() {
  return document.documentElement.dataset.theme ?? (systemDark.matches ? 'dark' : 'light');
}

export function toggleTheme() {
  document.documentElement.dataset.theme = getActiveTheme() === 'dark' ? 'light' : 'dark';
}
