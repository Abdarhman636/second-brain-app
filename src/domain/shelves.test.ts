import { describe, expect, it } from 'vitest';
import { groupByShelf, removeShelfFromProjects } from './shelves';
import type { Project, Shelf } from './types';

const shelf = (id: string, name: string) => ({ id, name, createdAt: '', updatedAt: '' }) as Shelf;
const item = (id: string, shelfId: string | null) => ({ project: { id, shelfId } as Project });

describe('shelves', () => {
  it('groups projects by shelf in name order, keeping empty shelves, then the loose ones', () => {
    const shelves = [shelf('s2', 'كورسات'), shelf('s1', 'تب')];
    const groups = groupByShelf([item('a', 's2'), item('b', null), item('c', 's2'), item('d', 'deleted')], shelves);

    expect(groups.map((group) => group.shelf?.id ?? null)).toEqual(['s1', 's2', null]);
    expect(groups[0]?.items).toEqual([]);
    expect(groups[1]?.items.map((entry) => entry.project.id)).toEqual(['a', 'c']);
    // A project pointing at a shelf that no longer exists counts as loose.
    expect(groups[2]?.items.map((entry) => entry.project.id)).toEqual(['b', 'd']);
  });

  it('leaves no "no shelf" group when every project is on a shelf', () => {
    expect(groupByShelf([item('a', 's1')], [shelf('s1', 'كتب')])).toHaveLength(1);
  });

  it('takes a deleted shelf off its projects', () => {
    const projects = [{ id: 'a', shelfId: 's1' }, { id: 'b', shelfId: 's2' }] as Project[];
    expect(removeShelfFromProjects(projects, 's1').map((project) => project.shelfId)).toEqual([null, 's2']);
  });
});
