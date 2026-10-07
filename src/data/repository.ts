/*
 * Persistence boundary. The store updates its state first (so the UI reacts
 * instantly) and then hands the change to a Repository. There are two:
 *   - SupabaseRepository: signed-in accounts
 *   - MemoryRepository:   demo mode; nothing is saved
 *
 * Writes are queued and run one at a time, in order, so a card is always
 * created before its review is recorded.
 */
import type { Card, ISODate, Project, ReviewLogEntry, Shelf, UserData, Vacation } from '../domain/types';

export interface Repository {
  readonly kind: 'supabase' | 'memory';
  loadUserData(today: ISODate): Promise<UserData>;
  saveShelf(shelf: Shelf): Promise<void>;
  /** Projects on the shelf stay, on no shelf. */
  deleteShelf(shelfId: string): Promise<void>;
  saveProject(project: Project): Promise<void>;
  /** Deletes the project together with its cards (and their images). */
  deleteProject(project: Project, cards: readonly Card[]): Promise<void>;
  /** Create or update cards (content, project, schedule). Uploads new images. */
  saveCards(cards: readonly Card[]): Promise<void>;
  deleteCard(card: Card): Promise<void>;
  addReview(entry: ReviewLogEntry): Promise<void>;
  addCompletedDay(date: ISODate): Promise<void>;
  saveVacation(vacation: Vacation): Promise<void>;
  deleteVacation(vacationId: string): Promise<void>;
}

/* ---------- Ordered write queue ---------- */

type ErrorHandler = (error: unknown) => void;

let queue: Promise<void> = Promise.resolve();
let handleError: ErrorHandler = (error) => console.error('[sync]', error);

/** Called once by the UI to surface failed saves. */
export function setSyncErrorHandler(handler: ErrorHandler) {
  handleError = handler;
}

/** Run a write after every earlier one has finished; failures go to the error handler. */
export function enqueueWrite(write: () => Promise<void>): Promise<void> {
  queue = queue.then(write).catch((error: unknown) => handleError(error));
  return queue;
}

/** Resolves when every queued write has finished (e.g. before signing out). */
export function flushWrites(): Promise<void> {
  return queue;
}
