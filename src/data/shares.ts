/*
 * Shared links on Supabase (supabase/schema.sql → Sharing). The owner reads
 * and writes their own `shares` rows; anyone reads a share by its id through
 * get_share, which never exposes the owner's email.
 */
import { createShareId, parseSnapshot, SHARE_ID_PATTERN, type Share, type ShareKind, type ShareSnapshot } from '../domain/sharing';
import { supabase } from './supabase/client';

export class ShareError extends Error {}

const MESSAGES = {
  unavailable: 'المشاركة تحتاج حسابًا. أنشئ حسابًا مجانيًا أولًا.',
  failed: 'تعذّرت المشاركة. تأكد من اتصالك وحاول مرة أخرى.',
  tooBig: 'هذا كبير جدًا على رابط واحد. شارك المشاريع واحدًا واحدًا.',
};

function client() {
  if (!supabase) throw new ShareError(MESSAGES.unavailable);
  return supabase;
}

/** The address of a share, on this site. */
export function getShareUrl(id: string): string {
  return `${window.location.origin}/s/${id}`;
}

/** The owner's link for a project or shelf, if it's shared. */
export interface OwnShare {
  id: string;
  updatedAt: string;
}

async function fetchOwnShare(sourceId: string): Promise<OwnShare | null> {
  const { data, error } = await client().from('shares').select('id, updated_at').eq('source_id', sourceId).maybeSingle();
  if (error) throw new ShareError('تعذّر تحميل حالة المشاركة. هل شغّلت supabase/schema.sql بعد آخر تحديث؟');
  return data ? { id: String(data.id), updatedAt: String(data.updated_at) } : null;
}

async function writeShare(kind: ShareKind, sourceId: string, snapshot: ShareSnapshot): Promise<OwnShare> {
  const db = client();
  const update = (id: string) => db.from('shares').update({ snapshot }).eq('id', id).select('id, updated_at').single();
  const existing = await fetchOwnShare(sourceId);
  let result = existing
    ? await update(existing.id)
    : await db.from('shares').insert({ id: createShareId(), kind, source_id: sourceId, snapshot }).select('id, updated_at').single();
  // 23505: made meanwhile (another tab): one link per item, so update that one.
  if (!existing && result.error?.code === '23505') {
    const made = await fetchOwnShare(sourceId);
    if (made) result = await update(made.id);
  }
  if (result.error || !result.data) throw new ShareError(result.error?.code === '23514' ? MESSAGES.tooBig : MESSAGES.failed);
  return { id: String(result.data.id), updatedAt: String(result.data.updated_at) };
}

// Calls for the same item while one is running share its result.
const inFlight = new Map<string, Promise<OwnShare>>();

/** Share a project or shelf, or refresh its snapshot with the latest cards. The link stays the same. */
export function publishShare(kind: ShareKind, sourceId: string, snapshot: ShareSnapshot): Promise<OwnShare> {
  const running = inFlight.get(sourceId);
  if (running) return running;
  const call = writeShare(kind, sourceId, snapshot).finally(() => inFlight.delete(sourceId));
  inFlight.set(sourceId, call);
  return call;
}

/** A share for its page. null when the link is wrong or no longer shared. */
export async function fetchShare(id: string): Promise<Share | null> {
  if (!SHARE_ID_PATTERN.test(id)) return null;
  const { data, error } = await client().rpc('get_share', { share_id: id });
  if (error) throw new ShareError('تعذّر فتح الرابط. تأكد من اتصالك وحاول مرة أخرى.');
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const snapshot = parseSnapshot(row.snapshot);
  if (!snapshot) return null;
  return {
    id: String(row.id),
    kind: snapshot.kind,
    snapshot,
    updatedAt: String(row.updated_at),
    ownerName: typeof row.owner_name === 'string' ? row.owner_name : null,
    copies: Number(row.copies ?? 0),
    isOwner: Boolean(row.is_owner),
    copiedByMe: Boolean(row.copied_by_me),
  };
}

/** Count the signed-in user's copy (once per person). A failure only loses the count. */
export async function recordShareCopy(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('record_share_copy', { share_id: id });
  if (error) console.warn('[shares] copy not counted', error.message);
}

/* ---------- Coming back to a share after signing up ---------- */

const PENDING_KEY = 'rusookh:pending-share';

/** Remember a share to reopen once the visitor has an account (even after confirming their email in another tab). */
export function rememberPendingShare(id: string) {
  try {
    localStorage.setItem(PENDING_KEY, id);
  } catch {
    // Private mode: they'll come back through the link instead.
  }
}

/** The share to reopen, once; null when there's none. */
export function takePendingShare(): string | null {
  try {
    const id = localStorage.getItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    return id && SHARE_ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}
