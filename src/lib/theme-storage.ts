/** The theme chosen on this device; light unless the user picked dark. */
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'rusookh-theme';

export function readSavedTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing: the choice just won't be remembered.
  }
}
