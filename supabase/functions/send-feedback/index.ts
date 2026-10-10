/*
 * send-feedback: a suggestion or complaint from the /feedback page.
 *
 *   1. Check who is asking (their Supabase session).
 *   2. Save it in `feedback` as that user (the database allows 5 a day).
 *   3. Email it to support, with the user's address as Reply-To, so
 *      replying to the email answers them directly.
 *
 * Secrets: see ../_shared/mail.ts, plus SUPPORT_EMAIL (default
 * support@rsookh.com).
 *
 * Deploy: npx supabase functions deploy send-feedback --project-ref <ref>
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS_HEADERS, layout, MAIL_FROM, mailConfigured, reply, transport } from '../_shared/mail.ts';

const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') || 'support@rsookh.com';

type Kind = 'suggestion' | 'complaint' | 'problem' | 'other';

// Keep in sync with FEEDBACK_KINDS in src/data/feedback.ts.
const KIND_LABELS: Record<Kind, string> = {
  suggestion: 'اقتراح',
  complaint: 'شكوى',
  problem: 'مشكلة تقنية',
  other: 'أخرى',
};

function parseBody(body: unknown): { kind: Kind; message: string } | null {
  if (!body || typeof body !== 'object') return null;
  const { kind, message } = body as Record<string, unknown>;
  if (typeof kind !== 'string' || !(kind in KIND_LABELS)) return null;
  if (typeof message !== 'string') return null;
  const trimmed = message.trim();
  if (trimmed.length < 5 || trimmed.length > 3000) return null;
  return { kind: kind as Kind, message: trimmed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'bad_request' });

  const authorization = req.headers.get('Authorization');
  const apiKey = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!authorization) return reply(401, { ok: false, error: 'not_signed_in' });
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const asUser = createClient(url, apiKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData.user) return reply(401, { ok: false, error: 'not_signed_in' });
  const user = userData.user;

  const body = parseBody(await req.json().catch(() => null));
  if (!body) return reply(400, { ok: false, error: 'bad_request' });

  // Saved as the user, so the daily limit and RLS apply.
  const { data: saved, error: saveError } = await asUser
    .from('feedback')
    .insert({ kind: body.kind, message: body.message })
    .select('id, created_at')
    .single();
  if (saveError || !saved) {
    if (saveError?.message.includes('feedback_limit')) return reply(429, { ok: false, error: 'feedback_limit' });
    console.error('[send-feedback] could not save; run supabase/schema.sql again?', saveError?.message);
    return reply(500, { ok: false, error: 'failed' });
  }

  if (!mailConfigured()) {
    console.error('[send-feedback] SMTP_USER / SMTP_PASS are not set; saved without emailing', saved.id);
    return reply(200, { ok: true, emailed: false });
  }

  const name = typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim() ? user.user_metadata.name.trim() : null;
  const label = KIND_LABELS[body.kind];
  try {
    await transport.sendMail({
      from: MAIL_FROM,
      to: SUPPORT_EMAIL,
      replyTo: user.email,
      subject: `${label} من ${name ?? user.email ?? 'مستخدم'}`,
      html: layout({
        title: label,
        paragraphs: body.message.split(/\n+/),
        rows: [
          ['من', name ?? '—'],
          ['الإيميل', user.email ?? '—'],
          ['النوع', label],
          [
            'أُرسل',
            new Intl.DateTimeFormat('ar', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZone: 'Asia/Riyadh',
              numberingSystem: 'latn',
            }).format(new Date(saved.created_at)),
          ],
        ],
        footer: { text: 'ردّك على هذه الرسالة يصل إلى المستخدم مباشرة.' },
      }),
    });
  } catch (error) {
    console.error('[send-feedback] email failed; saved in the feedback table', saved.id, error);
    return reply(200, { ok: true, emailed: false });
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  await admin.from('feedback').update({ emailed_at: new Date().toISOString() }).eq('id', saved.id);
  return reply(200, { ok: true, emailed: true });
});
