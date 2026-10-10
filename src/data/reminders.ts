/*
 * The daily reminder email (supabase/schema.sql → Daily reminder). Settings
 * live in `reminder_settings`; the daily-reminders Edge Function sends them.
 */
import { supabase } from './supabase/client';

export interface ReminderSettings {
  enabled: boolean;
  /** Local hour, 0–23. */
  hour: number;
  /** IANA time zone, e.g. "Asia/Riyadh". */
  timeZone: string;
}

/** Everyone is reminded at 8 pm, in their own time zone. */
export const REMINDER_HOUR = 20;

export class ReminderError extends Error {}

/** The device's time zone, e.g. "Asia/Riyadh". */
export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh';
  } catch {
    return 'Asia/Riyadh';
  }
}

/**
 * Turn the reminder on for an account that has no settings yet (8 pm in the
 * device's time zone). Existing settings are left alone.
 */
export async function ensureReminderSettings(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('reminder_settings')
    .upsert({ time_zone: getDeviceTimeZone() }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (error) console.warn('[reminders] could not set up the reminder; run supabase/schema.sql again?', error.message);
}

export async function fetchReminderSettings(): Promise<ReminderSettings | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('reminder_settings').select('enabled, hour, time_zone').maybeSingle();
  if (error) throw new ReminderError('تعذّر تحميل إعداد التذكير.');
  return data ? { enabled: Boolean(data.enabled), hour: Number(data.hour), timeZone: String(data.time_zone) } : null;
}

/** Save the reminder, with the device's current time zone. */
export async function saveReminderSettings(settings: Pick<ReminderSettings, 'enabled' | 'hour'>): Promise<ReminderSettings> {
  if (!supabase) throw new ReminderError('التذكير متاح للحسابات فقط.');
  const { data, error } = await supabase
    .from('reminder_settings')
    .upsert({ enabled: settings.enabled, hour: settings.hour, time_zone: getDeviceTimeZone() }, { onConflict: 'user_id' })
    .select('enabled, hour, time_zone')
    .single();
  if (error) throw new ReminderError('تعذّر حفظ التذكير. حاول مرة أخرى.');
  return { enabled: Boolean(data.enabled), hour: Number(data.hour), timeZone: String(data.time_zone) };
}

/** The email's "stop" link. True when a reminder was turned off. */
export async function unsubscribeReminders(token: string): Promise<boolean> {
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(token)) return false;
  const { data, error } = await supabase.rpc('unsubscribe_reminders', { token });
  if (error) throw new ReminderError('تعذّر إيقاف التذكير. حاول مرة أخرى.');
  return Boolean(data);
}
