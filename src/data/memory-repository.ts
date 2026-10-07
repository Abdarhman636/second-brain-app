/*
 * Demo mode: starts from the mock data and keeps nothing. Every write is a
 * no-op, because the store already holds the current state in memory.
 */
import { createMockData } from './mock-data';
import type { Repository } from './repository';

const noop = async () => {};

export const memoryRepository: Repository = {
  kind: 'memory',
  loadUserData: async (today) => createMockData(today),
  saveShelf: noop,
  deleteShelf: noop,
  saveProject: noop,
  deleteProject: noop,
  saveCards: noop,
  deleteCard: noop,
  addReview: noop,
  addCompletedDay: noop,
  saveVacation: noop,
  deleteVacation: noop,
};
