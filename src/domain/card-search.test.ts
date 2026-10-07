import { describe, expect, it } from 'vitest';
import { createMockData } from '../data/mock-data';
import { filterCards, normalizeArabic } from './card-search';

const { cards, projects } = createMockData('2026-10-06');
const getProject = (id: string) => projects.find((project) => project.id === id);
const search = (query: string, extra = {}) =>
  filterCards(cards, { query, projectId: '', type: '', ...extra }, getProject);

describe('card search', () => {
  it('ignores hamza variants, taa marbuta and diacritics', () => {
    expect(normalizeArabic('أَثَرُ المَعرِفةِ')).toBe('اثر المعرفه');
    expect(search('اثر').length).toBeGreaterThan(0);
  });

  it('matches every search term', () => {
    expect(search('قانون').map((card) => card.content)).toHaveLength(2);
    expect(search('قانون فيتس')).toHaveLength(1);
  });

  it('filters by project and type', () => {
    expect(search('', { projectId: 'project-psychology' })).toHaveLength(6);
    expect(search('', { projectId: 'project-psychology', type: 'definition' })).toHaveLength(3);
  });

  it('never matches inside image data', () => {
    // Base64 image data contains plenty of short Latin sequences.
    expect(search('svg')).toHaveLength(0);
    expect(search('منحنى النسيان')).toHaveLength(2);
  });

  it('finds cards by their project name', () => {
    expect(search('فنجان')).toHaveLength(4);
  });
});
