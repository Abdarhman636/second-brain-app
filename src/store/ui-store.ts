/*
 * Web-only UI state: which dialog is open, toast messages, and the theme.
 * Kept apart from app-store so the data store stays portable.
 */
import { create } from 'zustand';
import { readSavedTheme, type Theme } from '../lib/theme-storage';

export type Dialog =
  | { kind: 'create-card'; projectId?: string }
  | { kind: 'edit-card'; cardId: string }
  | { kind: 'move-card'; cardId: string }
  | { kind: 'create-project'; lead?: string; thenCreateCard?: boolean; shelfId?: string }
  | { kind: 'edit-project'; projectId: string }
  | { kind: 'create-shelf' }
  | { kind: 'rename-shelf'; shelfId: string }
  | {
      kind: 'confirm';
      title: string;
      message: string;
      confirmLabel: string;
      /** "danger" for destructive actions (the default), "primary" otherwise. */
      tone?: 'danger' | 'primary';
      resolve: (confirmed: boolean) => void;
    };

export interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'error';
}

export type { Theme };

interface UiStore {
  dialog: Dialog | null;
  toasts: Toast[];
  theme: Theme;

  openDialog: (dialog: Dialog) => void;
  closeDialog: () => void;
  confirm: (options: Omit<Extract<Dialog, { kind: 'confirm' }>, 'kind' | 'resolve'>) => Promise<boolean>;

  showToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;

  setTheme: (theme: Theme) => void;
}

const MAX_TOASTS = 2;

export const useUiStore = create<UiStore>()((set, get) => ({
  dialog: null,
  toasts: [],
  theme: readSavedTheme(),

  openDialog: (dialog) => {
    // Opening a new dialog over a pending confirmation counts as "cancel".
    const current = get().dialog;
    if (current?.kind === 'confirm') current.resolve(false);
    set({ dialog });
  },

  closeDialog: () => {
    const current = get().dialog;
    if (current?.kind === 'confirm') current.resolve(false);
    set({ dialog: null });
  },

  confirm: (options) =>
    new Promise<boolean>((resolve) => {
      get().openDialog({
        ...options,
        kind: 'confirm',
        resolve: (confirmed) => {
          resolve(confirmed);
        },
      });
    }),

  showToast: (message, tone = 'success') =>
    set((state) => ({ toasts: [...state.toasts, { id: crypto.randomUUID(), message, tone }].slice(-MAX_TOASTS) })),

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  setTheme: (theme) => set({ theme }),
}));
