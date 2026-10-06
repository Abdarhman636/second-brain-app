/*
 * Sign in / sign up / sign out. Each successful sign-in loads that user's
 * data into state, then returns them to the page they originally asked for.
 */
import * as authService from '../data/auth-service.js';
import { fetchUserData, saveUserData } from '../data/data-source.js';
import { endSession, exportUserData, getCurrentUser, startSession } from '../state/app-state.js';
import { navigate, routes, takeRememberedRoute } from '../router.js';
import { showToast } from '../components/toast.js';

async function openSession(user) {
  startSession(user, await fetchUserData(user.id));
  navigate(takeRememberedRoute());
}

/** @returns {Promise<{ error?: string }>} */
export async function signIn(credentials) {
  const { user, error } = await authService.signIn(credentials);
  if (error) return { error };
  await openSession(user);
  return {};
}

/** @returns {Promise<{ error?: string }>} */
export async function signUp(details) {
  const { user, error } = await authService.signUp(details);
  if (error) return { error };
  await openSession(user);
  showToast(`أهلًا ${user.name}، حسابك جاهز`);
  return {};
}

export async function signInWithDemo() {
  const { user } = await authService.signInWithDemo();
  await openSession(user);
}

export async function signOut() {
  const user = getCurrentUser();
  if (!user) return;

  await saveUserData(user.id, exportUserData());
  endSession();
  navigate(routes.login);
}
