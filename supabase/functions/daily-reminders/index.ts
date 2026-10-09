/*
 * daily-reminders: the daily review reminder email ("عندك 12 بطاقة تراجعها
 * اليوم"). Runs every hour from Supabase → Integrations → Cron.
 *
 *   1. claim_due_reminders (supabase/schema.sql) picks everyone whose chosen
 *      hour has come in their time zone and who wasn't reminded today, marks
 *      them, and returns those with cards waiting.
 *   2. Each gets one email, with a link to stop the reminders.
 *
 * Calling it again in the same hour sends nothing new, so it's safe for
 * anyone to call. Deploy it without JWT checks, so the scheduler can call it:
 *   npx supabase functions deploy daily-reminders --no-verify-jwt --project-ref <ref>
 *
 * Secrets: see ../_shared/mail.ts (APP_URL is needed for the links).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { APP_URL, layout, MAIL_FROM, mailConfigured, reply, transport } from '../_shared/mail.ts';

interface DueReminder {
  user_id: string;
  email: string;
  name: string | null;
  due: number;
  unsubscribe_token: string;
}

// Keep in sync with CARDS_PER_MINUTE in src/domain/review-scheduler.ts.
const CARDS_PER_MINUTE = 3;
// Gmail allows a handful of connections at a time.
const PARALLEL_SENDS = 5;

const pluralRules = new Intl.PluralRules('ar');

/** "بطاقة واحدة", "بطاقتان", "5 بطاقات", "12 بطاقة". */
function formatCards(count: number): string {
  const forms: Record<Intl.LDMLPluralRule, string> = {
    zero: '{n} بطاقة',
    one: 'بطاقة واحدة',
    two: 'بطاقتان',
    few: '{n} بطاقات',
    many: '{n} بطاقة',
    other: '{n} بطاقة',
  };
  return forms[pluralRules.select(count)].replace('{n}', String(count));
}

/** "دقيقة واحدة", "دقيقتين", "4 دقائق". */
function formatMinutes(count: number): string {
  const forms: Record<Intl.LDMLPluralRule, string> = {
    zero: '{n} دقيقة',
    one: 'دقيقة واحدة',
    two: 'دقيقتين',
    few: '{n} دقائق',
    many: '{n} دقيقة',
    other: '{n} دقيقة',
  };
  return forms[pluralRules.select(count)].replace('{n}', String(count));
}

export function reminderEmail(reminder: Pick<DueReminder, 'name' | 'due' | 'unsubscribe_token'>) {
  const cards = formatCards(reminder.due);
  const minutes = formatMinutes(Math.max(1, Math.ceil(reminder.due / CARDS_PER_MINUTE)));
  const unsubscribeUrl = APP_URL ? `${APP_URL}/unsubscribe?token=${reminder.unsubscribe_token}` : '';
  // Two cards take the dual pronoun: "تراجعهما".
  const subject = `عندك ${cards} ${reminder.due === 2 ? 'تراجعهما' : 'تراجعها'} اليوم`;
  const html = layout({
    title: subject,
    paragraphs: [
      reminder.name ? `أهلًا ${reminder.name}،` : 'أهلًا،',
      `مراجعة اليوم تأخذ نحو ${minutes} من وقتك. كل بطاقة تراجعها في موعدها تثبت في ذاكرتك أكثر.`,
    ],
    action: APP_URL ? { label: 'ابدأ المراجعة', href: `${APP_URL}/review` } : undefined,
    footer: unsubscribeUrl
      ? { text: 'يصلك هذا التذكير لأنه مفعّل في حسابك على رسوخ.', link: { label: 'إيقاف التذكير', href: unsubscribeUrl } }
      : { text: 'يصلك هذا التذكير لأنه مفعّل في حسابك على رسوخ. يمكنك إيقافه من الإعدادات.' },
  });
  return { subject, html, unsubscribeUrl };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') return reply(405, { ok: false, error: 'bad_request' });
  if (!mailConfigured()) {
    console.error('[daily-reminders] SMTP_USER / SMTP_PASS are not set');
    return reply(503, { ok: false, error: 'mail_not_configured' });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.rpc('claim_due_reminders');
  if (error) {
    console.error('[daily-reminders] claim failed; run supabase/schema.sql again?', error.message);
    return reply(500, { ok: false, error: 'claim_failed' });
  }

  const reminders = (data ?? []) as DueReminder[];
  let sent = 0;
  let failed = 0;
  for (let start = 0; start < reminders.length; start += PARALLEL_SENDS) {
    const batch = reminders.slice(start, start + PARALLEL_SENDS);
    const results = await Promise.allSettled(
      batch.map((reminder) => {
        const { subject, html, unsubscribeUrl } = reminderEmail(reminder);
        return transport.sendMail({
          from: MAIL_FROM,
          to: reminder.email,
          subject,
          html,
          headers: unsubscribeUrl ? { 'List-Unsubscribe': `<${unsubscribeUrl}>` } : undefined,
        });
      }),
    );
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        sent += 1;
        continue;
      }
      failed += 1;
      const reminder = batch[index]!;
      console.error('[daily-reminders] email failed', reminder.user_id, result.reason);
      // Not sent: the next hourly run tries again (within the user's 3-hour window).
      await admin.from('reminder_settings').update({ last_sent_on: null }).eq('user_id', reminder.user_id);
    }
  }

  return reply(200, { ok: true, due: reminders.length, sent, failed });
});
