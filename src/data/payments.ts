/*
 * Manual payments on Supabase: payment requests with an uploaded receipt,
 * the user's subscription, and the admin's review (set_payment_request_status,
 * a database function that checks the caller is an admin). Emails about a
 * request go through the payment-emails Edge Function.
 *
 * See supabase/schema.sql for the tables, policies and functions.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_RECEIPT_BYTES, RECEIPT_TYPES, type PaymentMethod, type PaymentRequest, type PaymentStatus } from '../domain/payments';
import { getEffectivePlan, isBillingPeriod, isPaidPlan, type BillingPeriod, type PaidPlanId, type PlanId } from '../domain/plans';
import { ImageFileError, prepareImageFile } from '../lib/image-file';
import { useAppStore } from '../store/app-store';
import { supabase } from './supabase/client';

const RECEIPT_BUCKET = 'payment-receipts';
const RECEIPT_URL_TTL_SECONDS = 60 * 60;

export class PaymentError extends Error {}

const MESSAGES = {
  unavailable: 'الدفع متاح للحسابات فقط. أنشئ حسابًا مجانيًا أولًا.',
  receiptType: 'ارفع صورة الإيصال (لقطة شاشة) أو ملف PDF.',
  receiptSize: 'ملف الإيصال كبير. الحد الأقصى 5 ميجابايت.',
  alreadyPending: 'لديك طلب قيد المراجعة بالفعل. تابعه من صفحة «الطلبات».',
  failed: 'تعذّر إرسال الطلب. تأكد من اتصالك وحاول مرة أخرى.',
};

function requireClient(): SupabaseClient {
  if (!supabase) throw new PaymentError(MESSAGES.unavailable);
  return supabase;
}

/* ---------- Rows ---------- */

interface PaymentRequestRow {
  id: string;
  user_id: string;
  user_email: string;
  plan: PaidPlanId;
  period: BillingPeriod;
  amount: number | string;
  student_price: boolean | null;
  founder_price: boolean | null;
  method: PaymentMethod;
  reference: string;
  payer_name: string | null;
  note: string | null;
  receipt_path: string | null;
  status: PaymentStatus;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  status_changed_at: string | null;
}

const toPaymentRequest = (row: PaymentRequestRow): PaymentRequest => ({
  id: row.id,
  userId: row.user_id,
  userEmail: row.user_email,
  plan: row.plan,
  period: row.period,
  amount: Number(row.amount),
  studentPrice: Boolean(row.student_price),
  founderPrice: Boolean(row.founder_price),
  method: row.method,
  reference: row.reference,
  payerName: row.payer_name,
  note: row.note ?? null,
  receiptPath: row.receipt_path,
  status: row.status,
  reviewNote: row.review_note,
  createdAt: row.created_at,
  reviewedAt: row.reviewed_at,
  statusChangedAt: row.status_changed_at ?? row.reviewed_at ?? row.created_at,
});

/* ---------- Subscription ---------- */

export interface Subscription {
  plan: PlanId;
  expiresAt: string | null;
}

/**
 * The user's plan as stored on the server. If it can't be read (e.g. the
 * database hasn't been updated yet), the account simply counts as free.
 */
export async function fetchSubscription(client: SupabaseClient, userId: string): Promise<Subscription> {
  const { data, error } = await client.from('subscriptions').select('plan, expires_at').eq('user_id', userId).maybeSingle();
  if (error) {
    console.warn('[payments] could not read the subscription; run supabase/schema.sql again?', error.message);
    return { plan: 'free', expiresAt: null };
  }
  if (!data || !isPaidPlan(data.plan)) return { plan: 'free', expiresAt: null };
  const expiresAt = data.expires_at as string;
  return { plan: getEffectivePlan(data.plan, expiresAt), expiresAt };
}

/** Read the subscription again (e.g. after an admin approved a payment) and update the signed-in user. */
export async function refreshSubscription(): Promise<Subscription | null> {
  const { user, mode } = useAppStore.getState();
  if (!supabase || mode !== 'account' || !user) return null;
  const subscription = await fetchSubscription(supabase, user.id);
  const current = useAppStore.getState().user;
  if (current?.id === user.id) {
    useAppStore.setState({ user: { ...current, plan: subscription.plan, planExpiresAt: subscription.expiresAt } });
  }
  return subscription;
}

/* ---------- Public counters ---------- */

export interface FounderStatus {
  seats: number;
  taken: number;
  /** The signed-in user holds a seat (keeps the founder price on renewal). */
  isFounder: boolean;
}

/** Founder seats left. null when it can't be read (no backend, or the database isn't updated yet). */
export async function fetchFounderStatus(): Promise<FounderStatus | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('founder_status');
  if (error || !data) return null;
  const status = data as { seats: number; taken: number; is_founder: boolean };
  return { seats: Number(status.seats), taken: Number(status.taken), isFounder: Boolean(status.is_founder) };
}

/** How many people use Rusookh (confirmed accounts). null when it can't be read. */
export async function fetchUserCount(): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('public_user_count');
  return error || typeof data !== 'number' ? null : data;
}

/* ---------- Emails ---------- */

/**
 * Ask the server to email about a request: "created" tells the admin about a
 * new request, "status" tells the customer its new status. The server builds
 * the email from the database and checks who may ask. Returns whether it was
 * sent; a failed email never undoes the request itself.
 */
export async function notifyPayment(requestId: string, event: 'created' | 'status'): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.functions.invoke('payment-emails', { body: { requestId, event } });
    if (error) {
      console.warn('[payments] email not sent', error.message);
      return false;
    }
    return Boolean((data as { sent?: boolean } | null)?.sent);
  } catch (error) {
    console.warn('[payments] email not sent', error);
    return false;
  }
}

/* ---------- The student's requests ---------- */

export async function listMyPaymentRequests(): Promise<PaymentRequest[]> {
  const client = requireClient();
  const userId = useAppStore.getState().user?.id ?? '';
  // Filtered by owner: an admin can read everyone's requests.
  const { data, error } = await client.from('payment_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
  if (error) throw new PaymentError(MESSAGES.failed);
  return (data as PaymentRequestRow[]).map(toPaymentRequest);
}

/** Images are re-encoded and scaled down (smaller, and safe to show); PDFs are kept as they are. */
async function prepareReceipt(file: File): Promise<Blob> {
  if (!RECEIPT_TYPES.includes(file.type) && !file.type.startsWith('image/')) throw new PaymentError(MESSAGES.receiptType);
  if (file.type === 'application/pdf') {
    if (file.size > MAX_RECEIPT_BYTES) throw new PaymentError(MESSAGES.receiptSize);
    return file;
  }
  try {
    const dataUrl = await prepareImageFile(file);
    const blob = await (await fetch(dataUrl)).blob();
    if (blob.size > MAX_RECEIPT_BYTES) throw new PaymentError(MESSAGES.receiptSize);
    return blob;
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    if (error instanceof ImageFileError) throw new PaymentError(error.message);
    throw new PaymentError(MESSAGES.receiptType);
  }
}

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export async function submitPaymentRequest(input: {
  plan: PaidPlanId;
  period: BillingPeriod;
  method: PaymentMethod;
  reference: string;
  payerName: string;
  note: string;
  receipt: File;
}): Promise<PaymentRequest> {
  const client = requireClient();
  const user = useAppStore.getState().user;
  if (!user || useAppStore.getState().mode !== 'account') throw new PaymentError(MESSAGES.unavailable);
  if (!isPaidPlan(input.plan) || !isBillingPeriod(input.period)) throw new PaymentError(MESSAGES.failed);

  const receipt = await prepareReceipt(input.receipt);
  const id = crypto.randomUUID();
  const path = `${user.id}/${id}.${EXTENSIONS[receipt.type] ?? 'jpg'}`;

  const upload = await client.storage.from(RECEIPT_BUCKET).upload(path, receipt, { contentType: receipt.type });
  if (upload.error) throw new PaymentError(MESSAGES.failed);

  const { data, error } = await client
    .from('payment_requests')
    .insert({
      id,
      user_id: user.id,
      plan: input.plan,
      period: input.period,
      method: input.method,
      reference: input.reference,
      payer_name: input.payerName.trim() || null,
      note: input.note.trim() || null,
      receipt_path: path,
    })
    .select()
    .single();

  if (error) {
    await client.storage.from(RECEIPT_BUCKET).remove([path]);
    // 23505: unique violation, i.e. a request is already waiting.
    throw new PaymentError(error.code === '23505' ? MESSAGES.alreadyPending : MESSAGES.failed);
  }
  // Email the customer and the admin, without making the customer wait.
  void notifyPayment(id, 'created');
  return toPaymentRequest(data as PaymentRequestRow);
}

/* ---------- Admin ---------- */

/** The latest requests from everyone, newest first (admins only, by RLS). */
export async function listAllPaymentRequests(): Promise<PaymentRequest[]> {
  const { data, error } = await requireClient().from('payment_requests').select('*').order('created_at', { ascending: false }).limit(300);
  if (error) throw new PaymentError('تعذّر تحميل الطلبات.');
  return (data as PaymentRequestRow[]).map(toPaymentRequest);
}

export async function getReceiptUrl(path: string): Promise<string | null> {
  const { data } = await requireClient().storage.from(RECEIPT_BUCKET).createSignedUrl(path, RECEIPT_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

/**
 * Move a request to another status. Approving gives the plan (on the server);
 * rejecting keeps `note` for the customer.
 */
export async function setPaymentRequestStatus(request: PaymentRequest, status: PaymentStatus, note = ''): Promise<void> {
  const { error } = await requireClient().rpc('set_payment_request_status', { request_id: request.id, new_status: status, note });
  if (error) {
    if (error.message.includes('already_approved')) throw new PaymentError('هذا الطلب مقبول، ولا تتغير حالته بعد القبول.');
    // payment_requests_one_open_idx: reopening while the customer has another open request.
    if (error.code === '23505') throw new PaymentError('لدى هذا العميل طلب آخر مفتوح، فلا يمكن إعادة فتح هذا الطلب.');
    throw new PaymentError('تعذّر تغيير الحالة. هل شغّلت supabase/schema.sql بعد آخر تحديث؟');
  }
  // An admin approving their own request sees the plan right away.
  if (status === 'approved' && request.userId === useAppStore.getState().user?.id) await refreshSubscription();
}
