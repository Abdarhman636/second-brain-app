/*
 * Manual payments. A student transfers the price by bank transfer, uploads
 * the receipt, and the request waits until an admin approves it. Approval
 * (on the server) gives the plan for 6 or 12 months.
 */
import type { BillingPeriod, PaidPlanId } from './plans';

/** Only bank transfer for now; kept as a type so other methods can be added. */
export type PaymentMethod = 'bank';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface PaymentRequest {
  id: string;
  userId: string;
  userEmail: string;
  plan: PaidPlanId;
  period: BillingPeriod;
  /** Set by the server from the plan's price, whatever the client sends. */
  amount: number;
  /** Priced at the student rate (set by the server from the account's email). */
  studentPrice: boolean;
  /** Priced at the founders' launch rate (set by the server). */
  founderPrice: boolean;
  method: PaymentMethod;
  /** Short code the student adds to the transfer note, to match it with this request. */
  reference: string;
  /** Name on the sending account, to help find the transfer. */
  payerName: string | null;
  /** Path of the uploaded receipt in the private "payment-receipts" bucket. */
  receiptPath: string;
  status: PaymentStatus;
  /** Why a request was rejected, shown to the student. */
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank: 'تحويل بنكي',
};

/** The label for a request's method, including methods since removed (old requests keep theirs). */
export function getPaymentMethodLabel(method: string): string {
  return method in PAYMENT_METHOD_LABELS ? PAYMENT_METHOD_LABELS[method as PaymentMethod] : method === 'stc_pay' ? 'STC Pay' : method;
}

// No 0/O or 1/I/L, so the code can't be misread when typed into a transfer note.
const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A short, easy-to-type code such as "RS-7KQ2M". */
export function createPaymentReference(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 5; i++) code += REFERENCE_ALPHABET[Math.floor(random() * REFERENCE_ALPHABET.length)];
  return `RS-${code}`;
}

/** A Saudi IBAN: "SA", 22 digits, and a valid ISO 13616 check (mod 97). */
export function isValidSaudiIban(iban: string): boolean {
  const compact = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^SA\d{22}$/.test(compact)) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

/** "SA0380000000608010167519" → groups of four, the way banks print IBANs. */
export function formatIban(iban: string): string {
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

export const RECEIPT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
