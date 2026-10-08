import { describe, expect, it } from 'vitest';
import { PAYMENT } from '../config';
import { createPaymentReference, formatIban, isValidSaudiIban } from './payments';

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
