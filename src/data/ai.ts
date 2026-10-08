/*
 * AI-made cards: calls the generate-cards Edge Function (which holds the
 * Anthropic key and enforces the monthly limits) and reads what's left.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { SuggestedCard } from '../domain/ai-cards';
import { supabase } from './supabase/client';

export interface AiUsage {
  /** The account may make AI cards (راسخ plan, or an admin). */
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  perRequest: number;
}

/** null when it can't be read (demo mode, no backend, or the database isn't updated yet). */
export async function fetchAiUsage(): Promise<AiUsage | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('ai_usage_status');
  if (error || !data) return null;
  const usage = data as { allowed: boolean; used: number; limit: number; remaining: number; per_request: number };
  return {
    allowed: Boolean(usage.allowed),
    used: Number(usage.used),
    limit: Number(usage.limit),
    remaining: Number(usage.remaining),
    perRequest: Number(usage.per_request),
  };
}

const MESSAGES: Record<string, string> = {
  not_signed_in: 'سجّل دخولك أولًا.',
  bad_request: 'تأكد من النص أو الصورة، ثم حاول مرة أخرى.',
  ai_not_allowed: 'البطاقات الذكية متاحة في خطة راسخ.',
  ai_user_limit: 'استخدمت كل بطاقاتك الذكية لهذا الشهر. يتجدد رصيدك أول الشهر القادم.',
  ai_global_limit: 'البطاقات الذكية مشغولة جدًا هذا الشهر. حاول لاحقًا، ورصيدك محفوظ.',
  ai_refused: 'لم نستطع إنشاء بطاقات من هذا المحتوى. جرّب نصًا أو صورة أخرى.',
  ai_no_cards: 'لم نجد في هذا المحتوى ما يصلح لبطاقات. جرّب نصًا أوضح أو صورة أقرب.',
  ai_unavailable: 'تعذّر الوصول إلى خدمة البطاقات الذكية الآن. لم يُخصم شيء من رصيدك، حاول بعد قليل.',
};

export class AiCardsError extends Error {}

export type GenerateInput =
  | { mode: 'text'; count: number; text: string }
  | { mode: 'image'; count: number; image: { mediaType: string; data: string } };

export async function generateCards(input: GenerateInput): Promise<{ cards: SuggestedCard[]; remaining: number }> {
  if (!supabase) throw new AiCardsError(MESSAGES.ai_not_allowed);
  const { data, error } = await supabase.functions.invoke('generate-cards', { body: input });
  if (error) {
    let code = 'ai_unavailable';
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as { error?: string } | null;
      code = body?.error ?? code;
    }
    throw new AiCardsError(MESSAGES[code] ?? MESSAGES.ai_unavailable);
  }
  const result = data as { ok: boolean; cards?: SuggestedCard[]; remaining?: number; error?: string };
  if (!result.ok || !result.cards) throw new AiCardsError(MESSAGES[result.error ?? ''] ?? MESSAGES.ai_unavailable);
  return { cards: result.cards, remaining: Number(result.remaining ?? 0) };
}
