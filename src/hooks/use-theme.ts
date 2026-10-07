import { useCallback, useEffect } from 'react';
import { saveTheme, type Theme } from '../lib/theme-storage';
import { useUiStore } from '../store/ui-store';

const THEME_COLORS: Record<Theme, string> = { light: '#e6e6e4', dark: '#0f0f0f' };

/** Applies the theme to <html data-theme> and remembers it on this device. */
export function useApplyTheme() {
  const theme = useUiStore((state) => state.theme);
  useEffect(() => {
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
    saveTheme(theme);
  }, [theme]);
}

export function useToggleTheme() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  return useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);
}
