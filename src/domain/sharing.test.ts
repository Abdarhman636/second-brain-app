import { describe, expect, it } from 'vitest';
import {
  buildProjectSnapshot,
  buildShelfSnapshot,
  countSkippedImageCards,
  countSnapshot,
  createShareId,
  getCopyBlock,
  parseSnapshot,
  SHARE_ID_PATTERN,
} from './sharing';
import type { Card, CardBody, Project, Shelf } from './types';

const project = (id: string, extra: Partial<Project> = {}): Project => ({
  id,
  name: `مشروع ${id}`,
  type: 'book',
  customTypeLabel: null,
  color: 'teal',
  shelfId: null,
  archived: false,
  createdAt: `2026-10-0${id.length}T00:00:00Z`,
  updatedAt: '2026-10-01T00:00:00Z',
  ...extra,
});

let created = 0;
const card = (projectId: string, body: CardBody): Card =>
  ({
    ...body,
    id: `c${++created}`,
    projectId,
    reviewStage: 4,
    nextReviewDate: '2026-11-01',
    lastReviewedAt: '2026-10-01',
    lastReviewResult: 'remembered',
    createdAt: `2026-10-01T00:00:${String(created).padStart(2, '0')}Z`,
    updatedAt: '2026-10-01T00:00:00Z',
  }) as Card;

const shelf: Shelf = { id: 's1', name: 'كتب', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };

describe('createShareId', () => {
  it('makes a 12-character letters-and-digits id', () => {
    const id = createShareId();
    expect(id).toMatch(SHARE_ID_PATTERN);
    expect(createShareId()).not.toBe(id);
  });
});

describe('snapshots', () => {
  const cards = [
    card('p1', { type: 'qa', content: { question: 'س', answer: 'ج' } }),
    card('p1', { type: 'image', content: { title: 'صورة', imageUrl: 'storage:u/x.jpg' } }),
    card('p2', { type: 'note', content: { text: 'ملاحظة' } }),
    card('p3', { type: 'note', content: { text: 'مؤرشف' } }),
  ];

  it('shares a project without review progress or image cards', () => {
    const snapshot = buildProjectSnapshot(project('p1'), cards);
    expect(snapshot.kind).toBe('project');
    expect(snapshot.projects).toHaveLength(1);
    expect(snapshot.projects[0]!.cards).toEqual([{ type: 'qa', content: { question: 'س', answer: 'ج' } }]);
    expect(JSON.stringify(snapshot)).not.toContain('reviewStage');
    expect(countSkippedImageCards(['p1'], cards)).toBe(1);
  });

  it('shares a shelf with its active projects', () => {
    const projects = [project('p1', { shelfId: 's1' }), project('p2', { shelfId: 's1' }), project('p3', { shelfId: 's1', archived: true }), project('p4')];
    const snapshot = buildShelfSnapshot(shelf, projects, cards);
    expect(snapshot.shelfName).toBe('كتب');
    expect(snapshot.projects.map((item) => item.name)).toEqual(['مشروع p1', 'مشروع p2']);
    expect(countSnapshot(snapshot)).toEqual({ shelves: 1, projects: 2, cards: 2 });
  });

  it('reads back what it wrote', () => {
    const snapshot = buildProjectSnapshot(project('p1'), cards);
    expect(parseSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  it('drops anything malformed from a link', () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot({ kind: 'project', projects: [] })).toBeNull();
    expect(parseSnapshot({ kind: 'shelf', shelfName: '', projects: [{ name: 'أ', cards: [] }] })).toBeNull();
    const parsed = parseSnapshot({
      kind: 'project',
      projects: [
        {
          name: 'أ',
          type: 'not-a-type',
          color: 'neon',
          cards: [
            { type: 'image', content: { title: 'x', imageUrl: 'javascript:alert(1)' } },
            { type: 'qa', content: { question: 'س' } },
            { type: 'note', content: { text: 'تبقى', extra: '<script>' } },
          ],
        },
      ],
    });
    expect(parsed?.projects[0]).toMatchObject({ type: 'other', color: 'graphite', cards: [{ type: 'note', content: { text: 'تبقى' } }] });
  });
});

describe('getCopyBlock', () => {
  const counts = { shelves: 0, projects: 1, cards: 15 };

  it('allows a copy that fits the plan', () => {
    expect(getCopyBlock('free', counts, { shelves: 0, projects: 1, cards: 5 })).toBeNull();
    expect(getCopyBlock('pro', counts, { shelves: 1, projects: 40, cards: 5000 })).toBeNull();
  });

  it('names the first limit a copy would pass', () => {
    expect(getCopyBlock('free', counts, { shelves: 0, projects: 1, cards: 6 })).toEqual({ resource: 'cards', limit: 20, wouldHave: 21 });
    expect(getCopyBlock('free', counts, { shelves: 0, projects: 2, cards: 1 })).toEqual({ resource: 'projects', limit: 2, wouldHave: 3 });
    expect(getCopyBlock('plus', { shelves: 7, projects: 0, cards: 0 }, { shelves: 1, projects: 1, cards: 1 })).toEqual({
      resource: 'shelves',
      limit: 7,
      wouldHave: 8,
    });
  });
});
