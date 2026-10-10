/*
 * Suggestions and complaints, sent through the send-feedback Edge Function
 * (saved in the `feedback` table, then emailed to support).
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase/client';

export type FeedbackKind = 'suggestion' | 'complaint' | 'problem' | 'other';

export const FEEDBACK_KINDS: { id: FeedbackKind; label: string }[] = [
  { id: 'suggestion', label: 'اقتراح' },
  { id: 'complaint', label: 'شكوى' },
  { id: 'problem', label: 'مشكلة تقنية' },
  { id: 'other', label: 'أخرى' },
];

export const FEEDBACK_MIN_LENGTH = 5;
export const FEEDBACK_MAX_LENGTH = 3000;

export class FeedbackError extends Error {}

const MESSAGES: Record<string, string> = {
  feedback_limit: 'أرسلت عدة رسائل اليوم. شكرًا لك! أرسل رسالتك التالية غدًا.',
  not_signed_in: 'سجّل دخولك أولًا، ثم أرسل رسالتك.',
  failed: 'تعذّر إرسال رسالتك. تأكد من اتصالك وحاول مرة أخرى.',
};

export async function sendFeedback(kind: FeedbackKind, message: string): Promise<void> {
  if (!supabase) throw new FeedbackError(MESSAGES.not_signed_in);
  const { data, error } = await supabase.functions.invoke('send-feedback', { body: { kind, message } });
  if (error) {
    let code = 'failed';
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as { error?: string } | null;
      code = body?.error ?? code;
    }
    throw new FeedbackError(MESSAGES[code] ?? MESSAGES.failed);
  }
  if (!(data as { ok?: boolean } | null)?.ok) throw new FeedbackError(MESSAGES.failed);
}
