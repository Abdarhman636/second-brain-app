import { beforeEach, describe, expect, it } from 'vitest';
import { memoryRepository } from '../data/memory-repository';
import type { Repository } from '../data/repository';
import type { PlanId } from '../domain/plans';
import type { User } from '../domain/types';
import { useAppStore } from './app-store';
import { isPlanLimitReached } from './selectors';
import { useUiStore } from './ui-store';

const TODAY = '2026-10-07';
const emptyData = { shelves: [], projects: [], cards: [], reviewLog: [], completedDays: [], vacations: [] };
/** Saves nothing, but counts as an account (limits only apply to accounts). */
const accountRepository: Repository = { ...memoryRepository, kind: 'supabase' };
const user = (plan: PlanId): User => ({ id: 'u1', name: 'سارة', email: 'sara@example.com', dailyLimit: null, isStudent: true, plan, planExpiresAt: plan === 'free' ? null : '2099-01-01T00:00:00Z', isAdmin: false });

const app = () => useAppStore.getState();
const ui = () => useUiStore.getState();

describe('plan limits', () => {
  beforeEach(() => {
    useUiStore.setState({ dialog: null, upgradeReason: null });
  });

  it('sends a free account to the plans instead of a third project', () => {
    app().startSession(user('free'), emptyData, accountRepository);
    const input = { type: 'book', customTypeLabel: null, color: 'clay', shelfId: null } as const;
    app().addProject({ ...input, name: 'أ' });
    ui().openDialog({ kind: 'create-project' });
    expect(ui().dialog?.kind).toBe('create-project');

    app().addProject({ ...input, name: 'ب' });
    ui().openDialog({ kind: 'create-project' });
    expect(ui().dialog).toBeNull();
    expect(ui().upgradeReason).toBe('projects');
  });

  it('allows one shelf and twenty cards on the free plan', () => {
    app().startSession(user('free'), emptyData, accountRepository);
    expect(isPlanLimitReached(app(), 'shelves')).toBe(false);
    app().addShelf('كتب');
    expect(isPlanLimitReached(app(), 'shelves')).toBe(true);

    const project = app().addProject({ name: 'أ', type: 'book', customTypeLabel: null, color: 'clay', shelfId: null });
    for (let i = 0; i < 20; i++) app().addCard({ projectId: project.id, type: 'note', content: { text: `${i}` } }, TODAY);
    ui().openDialog({ kind: 'create-card' });
    expect(ui().upgradeReason).toBe('cards');
  });

  it('has no limits on paid plans or in demo mode', () => {
    app().startSession(user('plus'), emptyData, accountRepository);
    app().addShelf('كتب');
    expect(isPlanLimitReached(app(), 'shelves')).toBe(false);

    app().startSession(user('free'), emptyData, memoryRepository);
    app().addShelf('كتب');
    expect(isPlanLimitReached(app(), 'shelves')).toBe(false);
  });
});
