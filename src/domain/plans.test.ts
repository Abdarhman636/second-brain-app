import { describe, expect, it } from 'vitest';
import {
  getDaysUntilExpiry,
  getEffectivePlan,
  getPlanPrice,
  describeLimits,
  isAtLimit,
  monthlyEquivalent,
  PLANS,
  priceDiscount,
  studentDiscount,
  toPlanId,
  yearlySaving,
} from './plans';

describe('plans', () => {
  const counts = { shelves: 1, projects: 1, cards: 20 };

  it('stops the free plan at one shelf, two projects and twenty cards', () => {
    expect(isAtLimit('free', 'shelves', counts)).toBe(true);
    expect(isAtLimit('free', 'projects', counts)).toBe(false);
    expect(isAtLimit('free', 'cards', counts)).toBe(true);
  });

  it('gives جذور roomy limits, and راسخ none', () => {
    expect(isAtLimit('plus', 'cards', { ...counts, cards: 599 })).toBe(false);
    expect(isAtLimit('plus', 'cards', { ...counts, cards: 600 })).toBe(true);
    expect(isAtLimit('plus', 'shelves', { ...counts, shelves: 7 })).toBe(true);
    expect(isAtLimit('pro', 'cards', { ...counts, cards: 100_000 })).toBe(false);
    expect(isAtLimit('pro', 'shelves', counts)).toBe(false);
  });

  it('describes the limits in Arabic', () => {
    expect(describeLimits('free')).toBe('رف واحد، ومشروعان، و20 بطاقة');
    expect(describeLimits('plus')).toBe('7 رفوف، و30 مشروعًا، و600 بطاقة');
    expect(describeLimits('pro')).toBeNull();
  });

  it('treats anything unknown as the free plan', () => {
    expect(toPlanId('pro')).toBe('pro');
    expect(toPlanId('enterprise')).toBe('free');
    expect(toPlanId(undefined)).toBe('free');
  });

  it('prices a year below two halves', () => {
    const plus = PLANS.plus.price!;
    expect(monthlyEquivalent(plus, 'year')).toBe(6.58);
    expect(yearlySaving(plus)).toBe(19);
    expect(yearlySaving(PLANS.pro.price!)).toBe(25);
  });

  it('gives students about a third off, and founders the launch prices', () => {
    const regular = { student: false, founder: false };
    expect(getPlanPrice(PLANS.plus, 'year', regular)).toBe(79);
    expect(getPlanPrice(PLANS.plus, 'year', { student: true, founder: false })).toBe(49);
    expect(getPlanPrice(PLANS.plus, 'year', { student: false, founder: true })).toBe(49);
    expect(getPlanPrice(PLANS.plus, 'year', { student: true, founder: true })).toBe(35);
    expect(getPlanPrice(PLANS.free, 'year', regular)).toBeNull();
    expect(studentDiscount(PLANS.plus, 'year')).toBe(38);
    expect(priceDiscount(PLANS.pro, 'year', { student: true, founder: true })).toBe(54);
  });

  it('falls back to the free plan once a paid plan expires', () => {
    const now = new Date('2026-10-07T12:00:00Z');
    expect(getEffectivePlan('plus', '2026-10-08T00:00:00Z', now)).toBe('plus');
    expect(getEffectivePlan('plus', '2026-10-07T00:00:00Z', now)).toBe('free');
    expect(getEffectivePlan('plus', null, now)).toBe('free');
    expect(getDaysUntilExpiry('2026-10-17T12:00:00Z', now)).toBe(10);
  });
});
