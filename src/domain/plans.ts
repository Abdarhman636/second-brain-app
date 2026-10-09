/*
 * Plans and their limits. Named after the app's idea of knowledge taking
 * root: بذرة (seed, free) → جذور (roots) → راسخ (firmly rooted, with AI).
 *
 * Prices are in Saudi riyals. Paid plans are bought for 6 or 12 months at a
 * time (paid once, no automatic renewal); a year costs less than two halves.
 * Students on a university email pay about a third less (see students.ts).
 *
 * Founders: the first FOUNDER_SEATS subscribers pay the launch prices
 * (founderPrice / founderStudentPrice), and keep them on every renewal. A
 * seat is taken when the subscription is approved.
 *
 * The database sets the amount of every payment request from the same
 * prices (public.plan_price in supabase/schema.sql). Keep the two in sync.
 *
 * The limits (بذرة and جذور; راسخ has none) are enforced twice: here (to send
 * the user to the pricing page instead of failing) and in the database
 * (supabase/schema.sql), so they can't be bypassed. Keep the two in sync.
 */
import { formatCount } from './format';

export type PlanId = 'free' | 'plus' | 'pro';
export type LimitedResource = 'shelves' | 'projects' | 'cards';
export type BillingPeriod = 'half' | 'year';

export const PERIOD_MONTHS: Record<BillingPeriod, number> = { half: 6, year: 12 };
export const PERIOD_LABELS: Record<BillingPeriod, string> = { half: '6 أشهر', year: '12 شهرًا' };

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** null = no limit. */
  limits: Record<LimitedResource, number | null>;
  /** AI-made cards per month; 0 when the plan has no AI. */
  aiCardsPerMonth: number;
  /** Prices in SAR for the whole period; null for the free plan. */
  price: Record<BillingPeriod, number> | null;
  /** The same, for students on a university email. */
  studentPrice: Record<BillingPeriod, number> | null;
  /** Launch prices, kept by the first FOUNDER_SEATS subscribers. */
  founderPrice: Record<BillingPeriod, number> | null;
  founderStudentPrice: Record<BillingPeriod, number> | null;
  /** False while a paid plan can't be bought yet (e.g. its features aren't ready). */
  available: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'بذرة',
    tagline: 'لتجرّب رسوخ وتبني عادة المراجعة.',
    limits: { shelves: 1, projects: 2, cards: 20 },
    aiCardsPerMonth: 0,
    price: null,
    studentPrice: null,
    founderPrice: null,
    founderStudentPrice: null,
    available: true,
  },
  plus: {
    id: 'plus',
    name: 'جذور',
    tagline: 'مساحة واسعة لكل موادك وكتبك.',
    // Room for a year of study; راسخ is for those who need more.
    limits: { shelves: 7, projects: 30, cards: 600 },
    aiCardsPerMonth: 0,
    price: { half: 49, year: 79 },
    studentPrice: { half: 29, year: 49 },
    founderPrice: { half: 29, year: 49 },
    founderStudentPrice: { half: 19, year: 35 },
    available: true,
  },
  pro: {
    id: 'pro',
    name: 'راسخ',
    tagline: 'دع الذكاء الاصطناعي يكتب بطاقاتك، وركّز أنت على الفهم.',
    limits: { shelves: null, projects: null, cards: null },
    aiCardsPerMonth: 300,
    price: { half: 99, year: 149 },
    studentPrice: { half: 59, year: 99 },
    founderPrice: { half: 59, year: 99 },
    founderStudentPrice: { half: 39, year: 69 },
    // Opens once AI card creation is built: until then there's nothing extra to pay for.
    available: false,
  },
};

export const PLAN_ORDER: readonly PlanId[] = ['free', 'plus', 'pro'];

export const RESOURCE_LABELS: Record<LimitedResource, { more: string; limitText: (limit: number) => string }> = {
  shelves: { more: 'رفوفًا أخرى', limitText: (limit) => formatCount(limit, 'shelves') },
  projects: { more: 'مشاريع أخرى', limitText: (limit) => formatCount(limit, 'projects') },
  cards: { more: 'بطاقات أخرى', limitText: (limit) => formatCount(limit, 'cards') },
};

/** The plan's limits in one line, e.g. "7 رفوف، و30 مشروعًا، و600 بطاقة"; null when it has none. */
export function describeLimits(planId: PlanId): string | null {
  const { shelves, projects, cards } = PLANS[planId].limits;
  if (shelves === null || projects === null || cards === null) return null;
  return `${RESOURCE_LABELS.shelves.limitText(shelves)}، و${RESOURCE_LABELS.projects.limitText(projects)}، و${RESOURCE_LABELS.cards.limitText(cards)}`;
}

export function toPlanId(value: unknown): PlanId {
  return isPaidPlan(value) ? value : 'free';
}

/** A paid plan bought with a request, as stored and approved on the server. */
export type PaidPlanId = Exclude<PlanId, 'free'>;

export function isPaidPlan(value: unknown): value is PaidPlanId {
  return value === 'plus' || value === 'pro';
}

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === 'half' || value === 'year';
}

/** The plan in effect: a paid plan counts only until it expires. */
export function getEffectivePlan(plan: PlanId, expiresAt: string | null, now: Date = new Date()): PlanId {
  if (plan === 'free') return 'free';
  return expiresAt && new Date(expiresAt) > now ? plan : 'free';
}

/** Whole days until a paid plan ends (0 on its last day). */
export function getDaysUntilExpiry(expiresAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000));
}

/** Within this many days of expiry, the app suggests renewing. */
export const RENEWAL_REMINDER_DAYS = 14;

export type ResourceCounts = Record<LimitedResource, number>;

/** True when the plan doesn't allow one more of `resource`. */
export function isAtLimit(planId: PlanId, resource: LimitedResource, counts: ResourceCounts): boolean {
  const limit = PLANS[planId].limits[resource];
  return limit !== null && counts[resource] >= limit;
}

/** What a period costs per month, rounded to the halala. */
export function monthlyEquivalent(price: Record<BillingPeriod, number>, period: BillingPeriod): number {
  return Math.round((price[period] / PERIOD_MONTHS[period]) * 100) / 100;
}

/** Keep in sync with founder_status() and prepare_payment_request() in supabase/schema.sql. */
export const FOUNDER_SEATS = 30;

/** Who is paying: a student on a university email, and/or a founder. */
export interface PriceFor {
  student: boolean;
  founder: boolean;
}

/** The price list that applies to this buyer. */
export function getPriceList(plan: Plan, buyer: PriceFor): Record<BillingPeriod, number> | null {
  if (buyer.founder) return buyer.student ? plan.founderStudentPrice : plan.founderPrice;
  return buyer.student ? plan.studentPrice : plan.price;
}

/** What the buyer pays for a plan and period. */
export function getPlanPrice(plan: Plan, period: BillingPeriod, buyer: PriceFor): number | null {
  return getPriceList(plan, buyer)?.[period] ?? null;
}

/** Whole-percent saving on the regular price for this buyer. */
export function priceDiscount(plan: Plan, period: BillingPeriod, buyer: PriceFor): number {
  const price = getPlanPrice(plan, period, buyer);
  if (!plan.price || price === null) return 0;
  return Math.round((1 - price / plan.price[period]) * 100);
}

/** Whole-percent student discount on the regular price. */
export function studentDiscount(plan: Plan, period: BillingPeriod): number {
  return priceDiscount(plan, period, { student: true, founder: false });
}

/** Whole-percent saving of a year over two six-month periods. */
export function yearlySaving(price: Record<BillingPeriod, number>): number {
  return Math.round((1 - price.year / (price.half * 2)) * 100);
}
