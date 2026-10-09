import { describe, expect, it } from 'vitest';
import { PAYMENT } from '../config';
import { formatTimeAgo } from './date-utils';
import { createPaymentReference, formatIban, getNextPaymentStatuses, isOpenPaymentStatus, isValidSaudiIban } from './payments';

describe('payments', () => {
  it('makes short references without look-alike characters', () => {
    for (let i = 0; i < 50; i++) expect(createPaymentReference()).toMatch(/^RS-[A-HJKMNP-Z2-9]{5}$/);
  });

  it('checks Saudi IBANs, including the one students transfer to', () => {
    if (PAYMENT.bank.iban) expect(isValidSaudiIban(PAYMENT.bank.iban)).toBe(true);
    expect(isValidSaudiIban('SA4005000068203011267000')).toBe(true);
    expect(isValidSaudiIban('SA4005000068203011267001')).toBe(false); // one digit off
    expect(isValidSaudiIban('SA40050000682030112670')).toBe(false); // too short
  });

  it('groups numbers so students can check them at a glance', () => {
    expect(formatIban('SA0380000000608010167519')).toBe('SA03 8000 0000 6080 1016 7519');
  });
});

describe('payment statuses', () => {
  it('counts pending and reviewing requests as open', () => {
    expect(isOpenPaymentStatus('pending')).toBe(true);
    expect(isOpenPaymentStatus('reviewing')).toBe(true);
    expect(isOpenPaymentStatus('approved')).toBe(false);
    expect(isOpenPaymentStatus('rejected')).toBe(false);
  });

  it('lets the admin move a request anywhere except out of approved', () => {
    expect(getNextPaymentStatuses('pending')).toEqual(['reviewing', 'approved', 'rejected']);
    expect(getNextPaymentStatuses('rejected')).toEqual(['pending', 'reviewing', 'approved']);
    expect(getNextPaymentStatuses('approved')).toEqual([]);
  });
});

describe('formatTimeAgo', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('says how long ago, in minutes, hours, then days', () => {
    expect(formatTimeAgo(ago(20_000), now)).toBe('الآن');
    expect(formatTimeAgo(ago(2 * 60_000), now)).toBe('منذ دقيقتين');
    expect(formatTimeAgo(ago(5 * 60_000), now)).toBe('منذ 5 دقائق');
    expect(formatTimeAgo(ago(60 * 60_000), now)).toBe('منذ ساعة');
    expect(formatTimeAgo(ago(15 * 60 * 60_000), now)).toBe('منذ 15 ساعة');
    expect(formatTimeAgo(ago(3 * 24 * 60 * 60_000), now)).toBe('منذ 3 أيام');
  });
});
