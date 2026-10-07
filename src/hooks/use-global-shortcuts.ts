import { useEffect } from 'react';
import { useUiStore } from '../store/ui-store';

/** Is the user typing somewhere (so single-key shortcuts must stay quiet)? */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

/**
 * App-wide keyboard shortcuts.
 *   N → add a card, from any page.
 * Uses `event.code` so it works on Arabic keyboard layouts too.
 */
export function useGlobalShortcuts() {
  const openDialog = useUiStore((state) => state.openDialog);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyN' || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (isTypingTarget(event.target) || useUiStore.getState().dialog) return;

      event.preventDefault();
      openDialog({ kind: 'create-card' });
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [openDialog]);
}
