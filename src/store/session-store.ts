/*
 * Where the app is in the sign-in lifecycle. Separate from app-store so that
 * resetting the user's data never resets the auth status.
 */
import { create } from 'zustand';

export type SessionPhase =
  | 'starting' // checking for a saved session
  | 'signed-out'
  | 'loading' // signed in, fetching the user's data
  | 'signed-in'
  | 'error'; // signed in, but the data couldn't be loaded

interface SessionStore {
  phase: SessionPhase;
  error: string | null;
  /** Signed in through a password-reset link: the user still has to choose a new password. */
  passwordRecovery: boolean;
  setPhase: (phase: SessionPhase, error?: string | null) => void;
  setPasswordRecovery: (value: boolean) => void;
}

export const useSessionStore = create<SessionStore>()((set) => ({
  phase: 'starting',
  error: null,
  passwordRecovery: false,
  setPhase: (phase, error = null) => set({ phase, error }),
  setPasswordRecovery: (passwordRecovery) => set({ passwordRecovery }),
}));
