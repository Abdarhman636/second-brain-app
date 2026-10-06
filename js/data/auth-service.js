/*
 * In-memory authentication — a stand-in for a real auth backend.
 *
 * The API mirrors what a hosted service (e.g. Supabase Auth) provides:
 * async signUp / signIn returning { user } or { error }. Passwords are
 * salted and hashed with SHA-256 so plaintext is never kept, but nothing
 * persists: accounts and the session live only until the page reloads.
 */
import { createId } from '../utils/helpers.js';
import { DEMO_ACCOUNT } from './mock-data.js';

export const PASSWORD_MIN_LENGTH = 8;

export const AUTH_ERRORS = Object.freeze({
  invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  emailTaken: 'هذا البريد مسجّل بالفعل. جرّب تسجيل الدخول.',
});

const users = []; // { id, name, email, salt, passwordHash, createdAt }

const normalizeEmail = (email) => email.trim().toLowerCase();

async function hashPassword(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Only ever expose the public part of a user record. */
const toPublicUser = ({ id, name, email }) => ({ id, name, email });

async function createUser({ id = createId(), name, email, password }) {
  const salt = createId();
  const user = {
    id,
    name: name.trim(),
    email: normalizeEmail(email),
    salt,
    passwordHash: await hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return user;
}

// The demo account is seeded lazily, the first time auth is used.
let seeded = null;
function ensureSeeded() {
  seeded ??= createUser(DEMO_ACCOUNT);
  return seeded;
}

export async function signUp({ name, email, password }) {
  await ensureSeeded();
  if (users.some((user) => user.email === normalizeEmail(email))) return { error: AUTH_ERRORS.emailTaken };

  const user = await createUser({ name, email, password });
  return { user: toPublicUser(user) };
}

export async function signIn({ email, password }) {
  await ensureSeeded();
  const user = users.find((item) => item.email === normalizeEmail(email));
  if (!user || (await hashPassword(password, user.salt)) !== user.passwordHash) {
    return { error: AUTH_ERRORS.invalidCredentials };
  }
  return { user: toPublicUser(user) };
}

export function signInWithDemo() {
  return signIn(DEMO_ACCOUNT);
}
