import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Card, Project } from '../../domain/types';
import { createSupabaseRepository } from './supabase-repository';

/* A tiny in-memory stand-in for the parts of the Supabase client the repository uses. */
function createFakeClient() {
  const tables: Record<string, Record<string, unknown>[]> = {
    shelves: [],
    projects: [],
    cards: [],
    review_log: [],
    completed_days: [],
    vacations: [],
  };
  const files = new Map<string, Blob>();
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });

  const query = (table: string) => {
    const rows = () => tables[table] ?? [];
    const keyOf = (row: Record<string, unknown>) => (table === 'completed_days' ? `${row.user_id}:${row.date}` : String(row.id));
    const builder = {
      select: () => builder,
      order: () => builder,
      gte: () => builder,
      range: () => ok([...rows()]),
      upsert: (input: Record<string, unknown> | Record<string, unknown>[]) => {
        for (const row of [input].flat()) {
          const index = rows().findIndex((existing) => keyOf(existing) === keyOf(row));
          if (index >= 0) rows()[index] = { ...rows()[index], ...row };
          else rows().push(row);
        }
        return ok(null);
      },
      insert: (row: Record<string, unknown>) => {
        rows().push(row);
        return ok(null);
      },
      delete: () => ({
        eq: (column: string, value: unknown) => {
          tables[table] = rows().filter((row) => row[column] !== value);
          return ok(null);
        },
      }),
    };
    return builder;
  };

  const client = {
    from: query,
    storage: {
      from: () => ({
        upload: (path: string, blob: Blob) => {
          files.set(path, blob);
          return ok({ path });
        },
        remove: (paths: string[]) => {
          paths.forEach((path) => files.delete(path));
          return ok([]);
        },
        createSignedUrls: (paths: string[]) => ok(paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}`, error: null }))),
      }),
    },
  } as unknown as SupabaseClient;

  return { client, tables, files };
}

const USER = 'user-1';
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==';

const project: Project = {
  id: 'p1',
  name: 'علم النفس',
  type: 'topic',
  customTypeLabel: null,
  color: 'terracotta',
  shelfId: 's1',
  archived: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const imageCard: Card = {
  id: 'c1',
  projectId: 'p1',
  type: 'image',
  content: { title: 'منحنى', imageUrl: PIXEL },
  reviewStage: 0,
  nextReviewDate: '2026-10-07',
  lastReviewedAt: null,
  lastReviewResult: null,
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
};

describe('Supabase repository', () => {
  it('stores rows in snake_case and reads them back as domain objects', async () => {
    const { client, tables } = createFakeClient();
    const repo = createSupabaseRepository(client, USER);

    await repo.saveShelf({ id: 's1', name: 'كتب', createdAt: project.createdAt, updatedAt: project.createdAt });
    await repo.saveProject(project);
    await repo.addCompletedDay('2026-10-06');
    await repo.addCompletedDay('2026-10-06');
    await repo.saveVacation({ id: 'v1', start: '2026-10-01', end: null });

    expect(tables.projects?.[0]).toMatchObject({ user_id: USER, custom_type_label: null, shelf_id: 's1', archived: false });
    expect(tables.completed_days).toHaveLength(1);

    const data = await createSupabaseRepository(client, USER).loadUserData('2026-10-07');
    expect(data.shelves).toEqual([{ id: 's1', name: 'كتب', createdAt: project.createdAt, updatedAt: project.createdAt }]);
    expect(data.projects).toEqual([project]);
    expect(data.completedDays).toEqual(['2026-10-06']);
    expect(data.vacations).toEqual([{ id: 'v1', start: '2026-10-01', end: null }]);
  });

  it('uploads a new image under the user’s folder and stores its path, not the data', async () => {
    const { client, tables, files } = createFakeClient();
    const repo = createSupabaseRepository(client, USER);

    await repo.saveCards([imageCard]);
    const stored = tables.cards?.[0] as { content: { imageUrl: string } };
    expect(stored.content.imageUrl).toMatch(new RegExp(`^storage:${USER}/c1/.+\\.png$`));
    expect(files.size).toBe(1);

    // Loading turns the path into a signed URL…
    const loaded = (await createSupabaseRepository(client, USER).loadUserData('2026-10-07')).cards[0];
    expect(loaded?.type === 'image' && loaded.content.imageUrl).toMatch(/^https:\/\/signed\.example\//);
  });

  it('keeps the stored path when a loaded image card is saved again (e.g. after a review)', async () => {
    const { client, tables } = createFakeClient();
    await createSupabaseRepository(client, USER).saveCards([imageCard]);
    const path = (tables.cards?.[0] as { content: { imageUrl: string } }).content.imageUrl;

    const repo = createSupabaseRepository(client, USER);
    const [loaded] = (await repo.loadUserData('2026-10-07')).cards;
    await repo.saveCards([{ ...(loaded as Card), reviewStage: 1, nextReviewDate: '2026-10-08' }]);

    expect(tables.cards?.[0]).toMatchObject({ review_stage: 1, content: { imageUrl: path } });
  });

  it('replaces the old file when the image changes, and removes it with the card', async () => {
    const { client, files } = createFakeClient();
    const repo = createSupabaseRepository(client, USER);

    await repo.saveCards([imageCard]);
    await repo.saveCards([{ ...imageCard, content: { title: 'منحنى', imageUrl: PIXEL } }]);
    expect(files.size).toBe(1);

    await repo.deleteCard(imageCard);
    expect(files.size).toBe(0);
  });
});
