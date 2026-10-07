import { describe, expect, it } from 'vitest';
import { createMockData } from '../data/mock-data';
import { getHardestProject, getRecallStats, getRootedStats } from './stats';
import type { ReviewLogEntry } from './types';

const TODAY = '2026-10-07';
const entry = (cardId: string, date: string, result: ReviewLogEntry['result']): ReviewLogEntry => ({
  id: `${cardId}-${date}`,
  cardId,
  result,
  date,
  dueDate: date,
  reviewedAt: `${date}T08:00:00.000Z`,
});

describe('stats', () => {
  it('computes the recall rate over the last 30 days only', () => {
    const log = [entry('a', TODAY, 'remembered'), entry('a', '2026-10-01', 'forgot'), entry('a', '2026-08-01', 'forgot')];
    expect(getRecallStats(log, TODAY)).toEqual({ reviews: 2, remembered: 1, forgot: 1, rate: 50 });
    expect(getRecallStats([], TODAY).rate).toBeNull();
  });

  it('counts rooted cards', () => {
    const { cards } = createMockData(TODAY);
    const stats = getRootedStats(cards);
    expect(stats.total).toBe(cards.length);
    expect(stats.rooted).toBe(cards.filter((card) => card.reviewStage >= 5).length);
  });

  it('finds the demo’s hardest project: the UX course', () => {
    const { reviewLog, cards, projects } = createMockData(TODAY);
    const hardest = getHardestProject(reviewLog, cards, projects, TODAY);
    expect(hardest?.project.id).toBe('project-ux-basics');
    expect(hardest?.forgot).toBe(3);
  });

  it('needs enough reviews and at least one miss before naming a project', () => {
    const { cards, projects } = createMockData(TODAY);
    const fewReviews = [entry('card-ux-hick', TODAY, 'forgot'), entry('card-ux-fitts', TODAY, 'forgot')];
    expect(getHardestProject(fewReviews, cards, projects, TODAY)).toBeNull();
    const allRemembered = ['card-ux-hick', 'card-ux-fitts', 'card-ux-vs-ui'].map((id) => entry(id, TODAY, 'remembered'));
    expect(getHardestProject(allRemembered, cards, projects, TODAY)).toBeNull();
  });
});
