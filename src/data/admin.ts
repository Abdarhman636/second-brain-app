/*
 * Admin dashboard data. Each call runs a database function that refuses
 * anyone who isn't an admin (supabase/schema.sql → Admin dashboard).
 */
import type { PlanId } from '../domain/plans';
import { refreshSubscription } from './payments';
import { supabase } from './supabase/client';

export class AdminError extends Error {}

export interface AdminStats {
  usersTotal: number;
  usersUnconfirmed: number;
  usersNew7d: number;
  usersNew30d: number;
  activeToday: number;
  active7d: number;
  active30d: number;
  students: number;
  academicEmails: number;
  planPlus: number;
  planPro: number;
  expiring14d: number;
  foundersTaken: number;
  founderSeats: number;
  revenueTotal: number;
  revenueMonth: number;
  paymentsPending: number;
  shelves: number;
  projects: number;
  cards: number;
  reviewsTotal: number;
  reviews7d: number;
  aiCardsMonth: number;
  aiCardsCap: number;
  signupsByDay: { day: string; count: number }[];
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  isStudent: boolean;
  academicEmail: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  isAdmin: boolean;
  /** The stored plan; check `expiresAt` to know whether it's still running. */
  plan: Exclude<PlanId, 'free'> | null;
  expiresAt: string | null;
  founder: boolean;
  shelves: number;
  projects: number;
  cards: number;
  reviews30d: number;
  lastReview: string | null;
  aiCardsMonth: number;
  paidTotal: number;
}

function client() {
  if (!supabase) throw new AdminError('لوحة التحكم تحتاج الاتصال بقاعدة البيانات.');
  return supabase;
}

const toNumber = (value: unknown) => Number(value ?? 0);

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await client().rpc('admin_dashboard_stats');
  if (error || !data) throw new AdminError('تعذّر تحميل الإحصائيات. هل شغّلت supabase/schema.sql بعد آخر تحديث؟');
  const row = data as Record<string, unknown>;
  return {
    usersTotal: toNumber(row.users_total),
    usersUnconfirmed: toNumber(row.users_unconfirmed),
    usersNew7d: toNumber(row.users_new_7d),
    usersNew30d: toNumber(row.users_new_30d),
    activeToday: toNumber(row.active_today),
    active7d: toNumber(row.active_7d),
    active30d: toNumber(row.active_30d),
    students: toNumber(row.students),
    academicEmails: toNumber(row.academic_emails),
    planPlus: toNumber(row.plan_plus),
    planPro: toNumber(row.plan_pro),
    expiring14d: toNumber(row.expiring_14d),
    foundersTaken: toNumber(row.founders_taken),
    founderSeats: toNumber(row.founder_seats),
    revenueTotal: toNumber(row.revenue_total),
    revenueMonth: toNumber(row.revenue_month),
    paymentsPending: toNumber(row.payments_pending),
    shelves: toNumber(row.shelves),
    projects: toNumber(row.projects),
    cards: toNumber(row.cards),
    reviewsTotal: toNumber(row.reviews_total),
    reviews7d: toNumber(row.reviews_7d),
    aiCardsMonth: toNumber(row.ai_cards_month),
    aiCardsCap: toNumber(row.ai_cards_cap),
    signupsByDay: ((row.signups_by_day as { day: string; count: number }[] | null) ?? []).map((item) => ({
      day: item.day,
      count: toNumber(item.count),
    })),
  };
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await client().rpc('admin_list_users');
  if (error || !data) throw new AdminError('تعذّر تحميل المستخدمين.');
  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    email: String(row.email ?? ''),
    name: (row.name as string | null) ?? null,
    isStudent: Boolean(row.is_student),
    academicEmail: Boolean(row.academic_email),
    createdAt: String(row.created_at),
    lastSignInAt: (row.last_sign_in_at as string | null) ?? null,
    confirmed: Boolean(row.confirmed),
    isAdmin: Boolean(row.is_admin),
    plan: row.plan === 'plus' || row.plan === 'pro' ? row.plan : null,
    expiresAt: (row.expires_at as string | null) ?? null,
    founder: Boolean(row.founder),
    shelves: toNumber(row.shelves),
    projects: toNumber(row.projects),
    cards: toNumber(row.cards),
    reviews30d: toNumber(row.reviews_30d),
    lastReview: (row.last_review as string | null) ?? null,
    aiCardsMonth: toNumber(row.ai_cards_month),
    paidTotal: toNumber(row.paid_total),
  }));
}

/** The plan in effect for a listed user. */
export function currentPlan(user: Pick<AdminUser, 'plan' | 'expiresAt'>): PlanId {
  return user.plan && user.expiresAt && new Date(user.expiresAt) > new Date() ? user.plan : 'free';
}

/** Give a user a plan until `expiresAt`, or move them back to the free plan. */
export async function setUserPlan(userId: string, plan: PlanId, expiresAt: string | null): Promise<void> {
  const { error } = await client().rpc('admin_set_plan', { target: userId, new_plan: plan, new_expires_at: expiresAt });
  if (error) throw new AdminError(error.message.includes('bad_request') ? 'اختر تاريخ انتهاء في المستقبل.' : 'تعذّر تغيير الخطة.');
  // Changing your own plan shows right away.
  await refreshSubscription();
}
