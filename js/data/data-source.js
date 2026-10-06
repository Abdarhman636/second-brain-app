/*
 * Data access boundary — the only module that knows where user data lives.
 *
 * Today it is an in-memory store keyed by user id: the demo account starts
 * with mock data, new accounts start empty, and each user's data is kept
 * here when they sign out so it is still there if they sign back in (until
 * the page reloads). To move to Supabase (or any API), replace these two
 * functions with real queries that use the same shape:
 *   { projects, cards, reviewLog, completedDays }
 */
import { createMockData, DEMO_ACCOUNT } from './mock-data.js';
import { getToday } from '../utils/date-utils.js';

const store = new Map(); // userId → data

const createEmptyData = () => ({ projects: [], cards: [], reviewLog: [], completedDays: [] });

export async function fetchUserData(userId) {
  if (!store.has(userId)) {
    store.set(userId, userId === DEMO_ACCOUNT.id ? createMockData(getToday()) : createEmptyData());
  }
  return store.get(userId);
}

export async function saveUserData(userId, data) {
  store.set(userId, data);
}
