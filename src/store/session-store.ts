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
  setPhase: (phase: SessionPhase, error?: string | null) => void;
}

export const useSessionStore = create<SessionStore>()((set) => ({
  phase: 'starting',
  error: null,
  setPhase: (phase, error = null) => set({ phase, error }),
}));
