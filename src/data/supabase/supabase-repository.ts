/*
 * Supabase persistence for a signed-in user. Maps between table rows
 * (snake_case, see supabase/schema.sql) and the domain model, and keeps card
 * images in the private "card-images" bucket.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays } from '../../domain/date-utils';
import type {
  Card,
  CardBody,
  ISODate,
  Project,
  ProjectColorId,
  ProjectTypeId,
  ReviewLogEntry,
  ReviewResult,
  Shelf,
  UserData,
  Vacation,
} from '../../domain/types';
import type { Repository } from '../repository';

const IMAGE_BUCKET = 'card-images';
/** Prefix marking an image stored in the bucket (vs. a data URL not yet uploaded). */
const STORAGE_PREFIX = 'storage:';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
/** How much review history to load; enough for the streak and the 30-day stats. */
const REVIEW_HISTORY_DAYS = 400;
const PAGE_SIZE = 1000;

/* ---------- Row types ---------- */

interface ShelfRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  type: ProjectTypeId;
  custom_type_label: string | null;
  color: ProjectColorId;
  /** Added with shelves; missing until supabase/schema.sql is run again. */
  shelf_id?: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface CardRow {
  id: string;
  user_id: string;
  project_id: string;
  type: CardBody['type'];
  content: CardBody['content'];
  review_stage: number;
  next_review_date: string;
  last_reviewed_at: string | null;
  last_review_result: ReviewResult | null;
  created_at: string;
  updated_at: string;
}

interface ReviewRow {
  id: string;
  user_id: string;
  card_id: string;
  result: ReviewResult;
  date: string;
  due_date: string;
  reviewed_at: string;
}

interface VacationRow {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string | null;
}

/* ---------- Mapping ---------- */

const toShelf = (row: ShelfRow): Shelf => ({ id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at });

const fromShelf = (shelf: Shelf, userId: string): ShelfRow => ({
  id: shelf.id,
  user_id: userId,
  name: shelf.name,
  created_at: shelf.createdAt,
  updated_at: shelf.updatedAt,
});

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  type: row.type,
  customTypeLabel: row.custom_type_label,
  color: row.color,
  shelfId: row.shelf_id ?? null,
  archived: row.archived,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const fromProject = (project: Project, userId: string): ProjectRow => ({
  id: project.id,
  user_id: userId,
  name: project.name,
  type: project.type,
  custom_type_label: project.customTypeLabel,
  color: project.color,
  shelf_id: project.shelfId,
  archived: project.archived,
  created_at: project.createdAt,
  updated_at: project.updatedAt,
});

const toCard = (row: CardRow): Card =>
  ({
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    content: row.content,
    reviewStage: row.review_stage,
    nextReviewDate: row.next_review_date,
    lastReviewedAt: row.last_reviewed_at,
    lastReviewResult: row.last_review_result,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }) as Card;

const fromCard = (card: Card, userId: string, content: CardBody['content']): CardRow => ({
  id: card.id,
  user_id: userId,
  project_id: card.projectId,
  type: card.type,
  content,
  review_stage: card.reviewStage,
  next_review_date: card.nextReviewDate,
  last_reviewed_at: card.lastReviewedAt,
  last_review_result: card.lastReviewResult,
  created_at: card.createdAt,
  updated_at: card.updatedAt,
});

const toReview = (row: ReviewRow): ReviewLogEntry => ({
  id: row.id,
  cardId: row.card_id,
  result: row.result,
  date: row.date,
  dueDate: row.due_date,
  reviewedAt: row.reviewed_at,
});

const toVacation = (row: VacationRow): Vacation => ({ id: row.id, start: row.start_date, end: row.end_date });

/* ---------- Helpers ---------- */

function check<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/** PostgREST returns at most 1000 rows per request; read every page. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const batch = check(await page(from, from + PAGE_SIZE - 1));
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/* ---------- Repository ---------- */

export function createSupabaseRepository(client: SupabaseClient, userId: string): Repository {
  // Storage path of each image card's picture: the app holds a signed URL or a
  // fresh data URL, while the database stores this path.
  const imagePaths = new Map<string, string>();

  const removeImages = async (paths: string[]) => {
    if (!paths.length) return;
    // Best effort: a leftover file is harmless, so failures are only logged.
    const { error } = await client.storage.from(IMAGE_BUCKET).remove(paths);
    if (error) console.warn('[storage] could not remove images', error.message);
  };

  /** Content as it should be stored: new images are uploaded first. */
  const toStoredContent = async (card: Card): Promise<CardBody['content']> => {
    if (card.type !== 'image') return card.content;

    const { imageUrl } = card.content;
    if (!imageUrl.startsWith('data:')) {
      const path = imagePaths.get(card.id);
      return { ...card.content, imageUrl: path ? `${STORAGE_PREFIX}${path}` : imageUrl };
    }

    const blob = await (await fetch(imageUrl)).blob();
    const path = `${userId}/${card.id}/${crypto.randomUUID()}.${EXTENSIONS[blob.type] ?? 'png'}`;
    check(await client.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: blob.type }));

    const previous = imagePaths.get(card.id);
    imagePaths.set(card.id, path);
    if (previous) await removeImages([previous]);
    return { ...card.content, imageUrl: `${STORAGE_PREFIX}${path}` };
  };

  /** Swap stored image paths for signed URLs the browser can display. */
  const resolveImages = async (cards: Card[]): Promise<Card[]> => {
    const stored = cards.filter(
      (card): card is Extract<Card, { type: 'image' }> => card.type === 'image' && card.content.imageUrl.startsWith(STORAGE_PREFIX),
    );
    if (!stored.length) return cards;

    stored.forEach((card) => imagePaths.set(card.id, card.content.imageUrl.slice(STORAGE_PREFIX.length)));
    const paths = stored.map((card) => imagePaths.get(card.id) as string);
    const signed = check(await client.storage.from(IMAGE_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS));
    const urlByPath = new Map(signed.map((item) => [item.path, item.signedUrl]));

    return cards.map((card) => {
      if (card.type !== 'image') return card;
      const url = urlByPath.get(imagePaths.get(card.id) ?? '');
      return url ? { ...card, content: { ...card.content, imageUrl: url } } : card;
    });
  };

  return {
    kind: 'supabase',

    async loadUserData(today: ISODate): Promise<UserData> {
      const historyStart = addDays(today, -REVIEW_HISTORY_DAYS);
      const [shelfRows, projectRows, cardRows, reviewRows, dayRows, vacationRows] = await Promise.all([
        fetchAll<ShelfRow>((from, to) => client.from('shelves').select('*').order('created_at').range(from, to)),
        fetchAll<ProjectRow>((from, to) => client.from('projects').select('*').order('created_at', { ascending: false }).range(from, to)),
        fetchAll<CardRow>((from, to) => client.from('cards').select('*').order('created_at').range(from, to)),
        fetchAll<ReviewRow>((from, to) =>
          client.from('review_log').select('*').gte('date', historyStart).order('reviewed_at').range(from, to),
        ),
        fetchAll<{ date: string }>((from, to) => client.from('completed_days').select('date').order('date').range(from, to)),
        fetchAll<VacationRow>((from, to) => client.from('vacations').select('*').order('start_date').range(from, to)),
      ]);

      return {
        shelves: shelfRows.map(toShelf),
        projects: projectRows.map(toProject),
        cards: await resolveImages(cardRows.map(toCard)),
        reviewLog: reviewRows.map(toReview),
        completedDays: dayRows.map((row) => row.date),
        vacations: vacationRows.map(toVacation),
      };
    },

    async saveShelf(shelf) {
      check(await client.from('shelves').upsert(fromShelf(shelf, userId)));
    },

    async deleteShelf(shelfId) {
      // Its projects stay, on no shelf (ON DELETE SET NULL).
      check(await client.from('shelves').delete().eq('id', shelfId));
    },

    async saveProject(project) {
      check(await client.from('projects').upsert(fromProject(project, userId)));
    },

    async deleteProject(project, cards) {
      // Cards go with the project (ON DELETE CASCADE); their images are removed here.
      check(await client.from('projects').delete().eq('id', project.id));
      const paths = cards.flatMap((card) => {
        const path = imagePaths.get(card.id);
        imagePaths.delete(card.id);
        return path ? [path] : [];
      });
      await removeImages(paths);
    },

    async saveCards(cards) {
      if (!cards.length) return;
      const rows = await Promise.all(cards.map(async (card) => fromCard(card, userId, await toStoredContent(card))));
      check(await client.from('cards').upsert(rows));
    },

    async deleteCard(card) {
      check(await client.from('cards').delete().eq('id', card.id));
      const path = imagePaths.get(card.id);
      imagePaths.delete(card.id);
      if (path) await removeImages([path]);
    },

    async addReview(entry) {
      check(
        await client.from('review_log').insert({
          id: entry.id,
          user_id: userId,
          card_id: entry.cardId,
          result: entry.result,
          date: entry.date,
          due_date: entry.dueDate,
          reviewed_at: entry.reviewedAt,
        }),
      );
    },

    async addCompletedDay(date) {
      check(await client.from('completed_days').upsert({ user_id: userId, date }, { ignoreDuplicates: true }));
    },

    async saveVacation(vacation) {
      check(
        await client.from('vacations').upsert({ id: vacation.id, user_id: userId, start_date: vacation.start, end_date: vacation.end }),
      );
    },

    async deleteVacation(vacationId) {
      check(await client.from('vacations').delete().eq('id', vacationId));
    },
  };
}
