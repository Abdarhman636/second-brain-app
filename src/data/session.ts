/*
 * Accounts and sessions.
 *
 * Supabase Auth is the source of truth: `initSession` listens to it, and
 * whenever a user is signed in (on page load, after sign-in, or after
 * confirming their email) their data is loaded into the store. Sign-in and
 * sign-up only talk to Supabase; the listener does the rest.
 *
 * Demo mode skips Supabase entirely: mock data, nothing saved.
 */
import type { AuthError, User as SupabaseUser } from '@supabase/supabase-js';
import { getToday } from '../domain/date-utils';
import { DEFAULT_DAILY_LIMIT } from '../domain/review-scheduler';
import type { DailyLimit, User } from '../domain/types';
import { useAppStore } from '../store/app-store';
import { useSessionStore } from '../store/session-store';
import { memoryRepository } from './memory-repository';
import { fetchSubscription } from './payments';
import { ensureReminderSettings } from './reminders';
import { DEMO_USER } from './mock-data';
import { flushWrites } from './repository';
import { supabase } from './supabase/client';
import { createSupabaseRepository } from './supabase/supabase-repository';

export const PASSWORD_MIN_LENGTH = 8;

const MESSAGES = {
  invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  emailNotConfirmed: 'لم يُؤكَّد بريدك بعد. افتح رسالة التأكيد التي أرسلناها إليك، أو اطلب رسالة جديدة.',
  emailTaken: 'هذا البريد مسجّل بالفعل. جرّب تسجيل الدخول.',
  samePassword: 'اختر كلمة مرور مختلفة عن القديمة.',
  resetExpired: 'انتهت صلاحية رابط تغيير كلمة المرور. اطلب رابطًا جديدًا.',
  weakPassword: `كلمة المرور ضعيفة. استخدم ${PASSWORD_MIN_LENGTH} أحرف على الأقل، ومزيجًا من الحروف والأرقام.`,
  rateLimited: 'محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.',
  invalidEmail: 'تأكد من صيغة البريد الإلكتروني.',
  network: 'تعذّر الاتصال بالخادم. تأكد من اتصالك بالإنترنت.',
  unavailable: 'تسجيل الحسابات غير متاح الآن. يمكنك تجربة التطبيق بدون حساب.',
  unknown: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
  loadFailed: 'تعذّر تحميل بياناتك.',
};

function describeAuthError(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return MESSAGES.invalidCredentials;
    case 'email_not_confirmed':
      return MESSAGES.emailNotConfirmed;
    case 'user_already_exists':
    case 'email_exists':
      return MESSAGES.emailTaken;
    case 'weak_password':
      return MESSAGES.weakPassword;
    case 'same_password':
      return MESSAGES.samePassword;
    case 'session_not_found':
    case 'session_expired':
      return MESSAGES.resetExpired;
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return MESSAGES.rateLimited;
    case 'email_address_invalid':
      return MESSAGES.invalidEmail;
    default:
      return error.name === 'AuthRetryableFetchError' ? MESSAGES.network : MESSAGES.unknown;
  }
}

/** Stored in the account's metadata: a positive whole number, or null for no limit. Missing means the default. */
function readDailyLimit(metadata: Record<string, unknown>): DailyLimit {
  const value = metadata.daily_review_limit;
  if (value === null) return null;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT;
}

function toUser(user: SupabaseUser): User {
  const email = user.email ?? '';
  const name = typeof user.user_metadata.name === 'string' && user.user_metadata.name.trim() ? user.user_metadata.name : email.split('@')[0];
  const isStudent = typeof user.user_metadata.is_student === 'boolean' ? user.user_metadata.is_student : null;
  // Roles live in app_metadata, which only the server can change (user_metadata is editable by the user).
  // The plan is filled in from the subscriptions table when the account loads.
  const isAdmin = user.app_metadata.role === 'admin';
  return { id: user.id, name: name ?? '', email, dailyLimit: readDailyLimit(user.user_metadata), isStudent, plan: 'free', planExpiresAt: null, isAdmin };
}

/* ---------- Loading a signed-in user ---------- */

let loadingUserId: string | null = null;

/**
 * The user as the server has it now. The saved session can be stale: a role
 * given by SQL (e.g. admin) only reaches it at the next sign-in or token
 * refresh. When the role changed, refresh the session too, so the database
 * (which reads the role from the session token) sees it as well.
 */
async function fetchCurrentUser(sessionUser: SupabaseUser): Promise<SupabaseUser> {
  if (!supabase) return sessionUser;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return sessionUser;
  if (data.user.app_metadata.role !== sessionUser.app_metadata.role) await supabase.auth.refreshSession();
  return data.user;
}

async function loadAccount(supabaseUser: SupabaseUser) {
  if (!supabase || loadingUserId === supabaseUser.id || useAppStore.getState().user?.id === supabaseUser.id) return;

  loadingUserId = supabaseUser.id;
  const { setPhase } = useSessionStore.getState();
  setPhase('loading');
  try {
    const repository = createSupabaseRepository(supabase, supabaseUser.id);
    const [data, subscription, currentUser] = await Promise.all([
      repository.loadUserData(getToday()),
      fetchSubscription(supabase, supabaseUser.id),
      fetchCurrentUser(supabaseUser),
    ]);
    const user = { ...toUser(currentUser), plan: subscription.plan, planExpiresAt: subscription.expiresAt };
    useAppStore.getState().startSession(user, data, repository);
    setPhase('signed-in');
    // A new account gets the daily reminder, in this device's time zone.
    void ensureReminderSettings();
  } catch (error) {
    console.error('[session] could not load user data', error);
    setPhase('error', MESSAGES.loadFailed);
  } finally {
    loadingUserId = null;
  }
}

/**
 * Start listening to Supabase Auth. Call once at app start; returns an
 * unsubscribe function. Without Supabase configured, only demo mode exists.
 */
export function initSession(): () => void {
  const { setPhase } = useSessionStore.getState();
  if (!supabase) {
    setPhase('signed-out');
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    // Supabase recommends not awaiting other auth calls inside this callback.
    window.setTimeout(() => {
      if (event === 'SIGNED_OUT') {
        if (useAppStore.getState().mode === 'account') useAppStore.getState().endSession();
        setPhase('signed-out');
      } else if (event === 'PASSWORD_RECOVERY' && session?.user) {
        // Opened a password-reset link: signed in, but a new password comes first.
        useSessionStore.getState().setPasswordRecovery(true);
        void loadAccount(session.user);
      } else if (session?.user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        void loadAccount(session.user);
      } else if (event === 'INITIAL_SESSION') {
        // A demo session in progress shouldn't be interrupted.
        if (useAppStore.getState().mode !== 'demo') setPhase('signed-out');
      } else if (event === 'USER_UPDATED' && session?.user) {
        const current = useAppStore.getState().user;
        // Keep the plan: it comes from the subscriptions table, not the auth user.
        if (current?.id === session.user.id) {
          useAppStore.setState({ user: { ...toUser(session.user), plan: current.plan, planExpiresAt: current.planExpiresAt } });
        }
      }
    }, 0);
  });

  return () => data.subscription.unsubscribe();
}

/** Try loading the signed-in user's data again after a failure. */
export async function retryLoad() {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (session?.user) await loadAccount(session.user);
  else useSessionStore.getState().setPhase('signed-out');
}

/* ---------- Actions ---------- */

export type AuthOutcome = { error?: string; needsConfirmation?: boolean };

export async function signIn(email: string, password: string): Promise<AuthOutcome> {
  if (!supabase) return { error: MESSAGES.unavailable };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { error: describeAuthError(error) } : {};
}

export async function signUp(name: string, email: string, password: string, isStudent: boolean): Promise<AuthOutcome> {
  if (!supabase) return { error: MESSAGES.unavailable };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, is_student: isStudent }, emailRedirectTo: window.location.origin },
  });
  if (error) return { error: describeAuthError(error) };
  // With email confirmation on, an existing address comes back as a user with no identities.
  if (data.user && data.user.identities?.length === 0) return { error: MESSAGES.emailTaken };
  return data.session ? {} : { needsConfirmation: true };
}

export async function resendConfirmation(email: string): Promise<AuthOutcome> {
  if (!supabase) return { error: MESSAGES.unavailable };
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin } });
  return error ? { error: describeAuthError(error) } : {};
}

/* ---------- Forgotten password ---------- */

/**
 * Email a link for choosing a new password. The link signs the user in and
 * opens /reset-password. For privacy, the answer is the same whether or not
 * the address has an account.
 */
export async function requestPasswordReset(email: string): Promise<AuthOutcome> {
  if (!supabase) return { error: MESSAGES.unavailable };
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
  return error ? { error: describeAuthError(error) } : {};
}

/** Set a new password for the signed-in user (after following a reset link). */
export async function updatePassword(password: string): Promise<AuthOutcome> {
  if (!supabase) return { error: MESSAGES.unavailable };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: describeAuthError(error) };
  useSessionStore.getState().setPasswordRecovery(false);
  return {};
}

/** Answer (or change) "are you a student?": saved on the account, or just for this visit in demo mode. */
export async function updateIsStudent(isStudent: boolean): Promise<AuthOutcome> {
  const { user, mode } = useAppStore.getState();
  if (!user) return {};
  if (mode === 'account' && supabase) {
    const { error } = await supabase.auth.updateUser({ data: { is_student: isStudent } });
    if (error) return { error: describeAuthError(error) };
  }
  useAppStore.setState({ user: { ...user, isStudent } });
  return {};
}

/**
 * Move the account to a new email (e.g. a university one, for the student
 * price). Supabase emails a confirmation link; the change happens once it's
 * followed, and the session listener then picks up the new address.
 */
export async function requestEmailChange(email: string): Promise<AuthOutcome> {
  if (!supabase || useAppStore.getState().mode !== 'account') return { error: MESSAGES.unavailable };
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${window.location.origin}/settings` });
  return error ? { error: describeAuthError(error) } : {};
}

/** Change the display name: saved on the account, or just for this visit in demo mode. */
export async function updateName(name: string): Promise<AuthOutcome> {
  const { user, mode } = useAppStore.getState();
  if (!user) return {};
  if (mode === 'account' && supabase) {
    const { error } = await supabase.auth.updateUser({ data: { name } });
    if (error) return { error: describeAuthError(error) };
  }
  useAppStore.setState({ user: { ...user, name } });
  return {};
}

/** Change the daily review limit: saved on the account, or just for this visit in demo mode. */
export async function updateDailyLimit(limit: DailyLimit): Promise<AuthOutcome> {
  const { user, mode } = useAppStore.getState();
  if (!user) return {};
  if (mode === 'account' && supabase) {
    const { error } = await supabase.auth.updateUser({ data: { daily_review_limit: limit } });
    if (error) return { error: describeAuthError(error) };
  }
  useAppStore.getState().setDailyLimit(limit, getToday());
  return {};
}

export async function startDemo() {
  const data = await memoryRepository.loadUserData(getToday());
  useAppStore.getState().startSession(DEMO_USER, data, memoryRepository);
  useSessionStore.getState().setPhase('signed-in');
}

export async function signOut() {
  const { mode, endSession } = useAppStore.getState();
  // Let pending saves finish before the session (and its access token) goes away.
  await flushWrites();
  endSession();
  useSessionStore.getState().setPhase('signed-out');
  useSessionStore.getState().setPasswordRecovery(false);
  if (mode === 'account') await supabase?.auth.signOut();
}
