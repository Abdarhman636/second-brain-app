/*
 * The one Supabase client. Without configuration the app still runs, in
 * demo mode only (in-memory data, no accounts).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && publishableKey ? createClient(url, publishableKey) : null;

export const isBackendConfigured = supabase !== null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).');
  return supabase;
}
