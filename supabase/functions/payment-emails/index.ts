/*
 * payment-emails: the emails around a manual payment. Runs on Supabase Edge
 * Functions (Deno), so the mail password stays on the server.
 *
 *   event "created" — the customer just sent a request: email the customer
 *     its details, and the admin a heads-up with the receipt attached. Only the request's owner can
 *     ask, and it's sent once per request (payment_requests.admin_notified_at).
 *   event "status"  — the admin changed a request's status: email the
 *     customer where their request stands. Only admins can ask.
 *
 * The emails are built here from the database row, never from what the
 * caller sends, so the function can't be used to mail anything else.
 *
 * Secrets: see ../_shared/mail.ts. SUPABASE_URL, the anon key and
 * SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
 *
 * Deploy: npx supabase functions deploy payment-emails --project-ref <ref>
 */
import { Buffer } from 'node:buffer';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ADMIN_EMAIL, APP_URL, CORS_HEADERS, layout, MAIL_FROM, mailConfigured, reply, transport } from '../_shared/mail.ts';

// The admin dashboard's address; keep in sync with ADMIN_PATH in src/config.ts.
const ADMIN_PATH = '/admrusskh';

type ErrorCode = 'not_signed_in' | 'bad_request' | 'forbidden' | 'not_found' | 'mail_not_configured' | 'mail_failed';

function fail(status: number, error: ErrorCode): Response {
  return reply(status, { ok: false, error });
}

/* ---------- The request ---------- */

type Status = 'pending' | 'reviewing' | 'approved' | 'rejected';

interface RequestRow {
  id: string;
  user_id: string;
  user_email: string;
  plan: 'plus' | 'pro';
  period: 'half' | 'year';
  amount: number | string;
  student_price: boolean;
  founder_price: boolean;
  reference: string;
  payer_name: string | null;
  note: string | null;
  receipt_path: string | null;
  status: Status;
  review_note: string | null;
  created_at: string;
  admin_notified_at: string | null;
}

// Keep in sync with src/domain/plans.ts and src/domain/payments.ts.
const PLAN_NAMES = { plus: 'جذور', pro: 'راسخ' } as const;
const PERIOD_LABELS = { half: '6 أشهر', year: '12 شهرًا' } as const;
const STATUS_LABELS: Record<Status, string> = {
  pending: 'بانتظار المراجعة',
  reviewing: 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
};

function parseBody(body: unknown): { requestId: string; event: 'created' | 'status' } | null {
  if (!body || typeof body !== 'object') return null;
  const { requestId, event } = body as Record<string, unknown>;
  if (typeof requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestId)) return null;
  if (event !== 'created' && event !== 'status') return null;
  return { requestId, event };
}

/* ---------- Emails ---------- */

const formatDateTime = (timestamp: string) =>
  new Intl.DateTimeFormat('ar', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Riyadh',
    numberingSystem: 'latn',
  }).format(
    new Date(timestamp),
  );

const formatDate = (timestamp: string) =>
  new Intl.DateTimeFormat('ar', { dateStyle: 'long', timeZone: 'Asia/Riyadh', numberingSystem: 'latn' }).format(new Date(timestamp));

function requestRows(request: RequestRow): [string, string][] {
  const price = [request.student_price && 'سعر طالب', request.founder_price && 'سعر مؤسس'].filter(Boolean).join(' · ');
  return [
    ['رقم الطلب', request.reference],
    ['الخطة', `${PLAN_NAMES[request.plan]} · ${PERIOD_LABELS[request.period]}`],
    ['المبلغ', `${Number(request.amount)} ر.س${price ? ` (${price})` : ''}`],
    ['أُرسل', formatDateTime(request.created_at)],
  ];
}

function adminEmail(request: RequestRow, customerName: string | null) {
  const subject = `طلب اشتراك جديد ${request.reference} · ${Number(request.amount)} ر.س`;
  const html = layout({
    title: 'طلب اشتراك جديد',
    paragraphs: [
      `وصل طلب تحويل بنكي جديد. تأكد من وصول المبلغ إلى حسابك قبل قبوله.${request.receipt_path ? ' الإيصال مرفق.' : ''}`,
    ],
    rows: [
      ['العميل', customerName ?? '—'],
      ['الإيميل', request.user_email],
      ['اسم المحوِّل', request.payer_name ?? '—'],
      ...(request.note ? ([['ملاحظة العميل', request.note]] as [string, string][]) : []),
      ...requestRows(request),
    ],
    action: APP_URL ? { label: 'افتح لوحة التحكم', href: `${APP_URL}${ADMIN_PATH}#orders` } : undefined,
  });
  return { subject, html };
}

function customerEmail(request: RequestRow, name: string | null, expiresAt: string | null) {
  const hello = name ? `أهلًا ${name}،` : 'أهلًا،';
  const plan = PLAN_NAMES[request.plan];
  const byStatus: Record<Status, { subject: string; title: string; text: string[] }> = {
    pending: {
      subject: `استلمنا طلبك ${request.reference}`,
      title: 'استلمنا طلب اشتراكك',
      text: [
        hello,
        `شكرًا لاشتراكك في ${plan}. سنتأكد من وصول تحويلك ونفعّل اشتراكك، ونرسل لك رسالة عند كل تحديث لحالة الطلب.`,
      ],
    },
    reviewing: {
      subject: `نراجع طلبك ${request.reference}`,
      title: 'نراجع طلبك الآن',
      text: [hello, 'بدأنا مراجعة تحويلك. سنرسل لك رسالة فور الانتهاء.'],
    },
    approved: {
      subject: `فُعّل اشتراكك في ${plan}`,
      title: `أهلًا بك في ${plan}`,
      text: [
        hello,
        `وصل تحويلك وفُعّل اشتراكك${expiresAt ? ` حتى ${formatDate(expiresAt)}` : ''}. شكرًا لثقتك برسوخ.`,
      ],
    },
    rejected: {
      subject: `تعذّر قبول طلبك ${request.reference}`,
      title: 'تعذّر قبول طلبك',
      text: [
        hello,
        request.review_note ? `السبب: ${request.review_note}` : 'لم نتمكن من مطابقة التحويل.',
        'إن كان هناك خطأ، ردّ على هذه الرسالة أو أرسل طلبًا جديدًا.',
      ],
    },
  };
  const content = byStatus[request.status];
  const html = layout({
    title: content.title,
    paragraphs: content.text,
    rows: [['الحالة', STATUS_LABELS[request.status]], ...requestRows(request)],
    action: APP_URL ? { label: 'تابع طلباتك', href: `${APP_URL}/orders` } : undefined,
  });
  return { subject: content.subject, html };
}

/* ---------- Handler ---------- */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail(405, 'bad_request');

  // Who is asking.
  const authorization = req.headers.get('Authorization');
  const apiKey = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!authorization) return fail(401, 'not_signed_in');
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const asUser = createClient(url, apiKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData.user) return fail(401, 'not_signed_in');
  const caller = userData.user;

  const body = parseBody(await req.json().catch(() => null));
  if (!body) return fail(400, 'bad_request');
  if (!mailConfigured()) {
    console.error('[payment-emails] SMTP_USER / SMTP_PASS are not set');
    return fail(503, 'mail_not_configured');
  }

  // The service role reads the customer's name and plan, and marks the request as emailed.
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const { data: row } = await admin.from('payment_requests').select('*').eq('id', body.requestId).maybeSingle();
  const request = row as RequestRow | null;
  if (!request) return fail(404, 'not_found');

  const { data: owner } = await admin.auth.admin.getUserById(request.user_id);
  const rawName = owner.user?.user_metadata?.name;
  const customerName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null;
  const from = MAIL_FROM;

  if (body.event === 'created') {
    if (request.user_id !== caller.id) return fail(403, 'forbidden');
    // Claim the email first, so two calls can't both send it.
    const { data: claimed } = await admin
      .from('payment_requests')
      .update({ admin_notified_at: new Date().toISOString() })
      .eq('id', request.id)
      .is('admin_notified_at', null)
      .select('id');
    if (!claimed?.length) return reply(200, { ok: true, sent: false });

    const toAdmin = adminEmail(request, customerName);
    const toCustomer = customerEmail(request, customerName, null);
    const receipt = request.receipt_path ? await admin.storage.from('payment-receipts').download(request.receipt_path) : null;
    const attachments = receipt?.data
      ? [
          {
            filename: `receipt-${request.reference}.${request.receipt_path!.split('.').pop() ?? 'jpg'}`,
            content: Buffer.from(await receipt.data.arrayBuffer()),
          },
        ]
      : [];
    const sent = await Promise.allSettled([
      transport.sendMail({ from, to: ADMIN_EMAIL, replyTo: request.user_email, ...toAdmin, attachments }),
      transport.sendMail({ from, to: request.user_email, replyTo: ADMIN_EMAIL, ...toCustomer }),
    ]);
    const failed = sent.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed.length) {
      console.error('[payment-emails] new-request email failed', ...failed.map((result) => result.reason));
      // Nothing went out: let a later call try again.
      if (failed.length === sent.length) {
        await admin.from('payment_requests').update({ admin_notified_at: null }).eq('id', request.id);
        return fail(502, 'mail_failed');
      }
    }
    return reply(200, { ok: true, sent: true });
  }

  // event === 'status'
  if (caller.app_metadata?.role !== 'admin') return fail(403, 'forbidden');
  let expiresAt: string | null = null;
  if (request.status === 'approved') {
    const { data: subscription } = await admin.from('subscriptions').select('expires_at').eq('user_id', request.user_id).maybeSingle();
    expiresAt = (subscription?.expires_at as string | undefined) ?? null;
  }
  const { subject, html } = customerEmail(request, customerName, expiresAt);
  try {
    await transport.sendMail({ from, to: request.user_email, replyTo: ADMIN_EMAIL, subject, html });
  } catch (error) {
    console.error('[payment-emails] customer email failed', error);
    return fail(502, 'mail_failed');
  }
  return reply(200, { ok: true, sent: true });
});
