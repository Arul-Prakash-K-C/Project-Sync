import { db, COLLECTION_KEYS, DEMO_SEED, type CollectionKey, type User } from './db';
import { diffCollection, toRow, sameRecord, chunk, type Item } from './syncDiff';
import { getSupabase } from '$lib/supabase/client';
import { cloudOptions } from '$lib/supabase/config';
import { syncState } from '$lib/stores/sync.svelte';
import { toast } from '$lib/stores/toast.svelte';
import type { SupabaseClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/*
  Mirrors the app's collections between Supabase (one table per collection,
  the record in a `data` jsonb column) and the browser cache.

  The rest of the app keeps its synchronous `db.getX()` / `db.saveX()` API and
  never learns Supabase exists: reads come from the local cache, which this
  module keeps current through Realtime, and every local save is diffed and
  written through as row inserts, updates and deletes. Row Level Security on the
  server decides what each person may read and write.
*/

export interface SyncIdentity {
  uid: string;
  userId: string;
  role: User['role'];
}

type Row = { id: string; data: Item };

const STAFF_ONLY: CollectionKey[] = ['faculty_notes', 'audit_log'];
const PAGE = 1000;

let sb: SupabaseClient | null = null;
let identity: SyncIdentity | null = null;
let channel: RealtimeChannel | null = null;
let stopWriteHook: (() => void) | null = null;
/** Last known server-side content of each collection, by id. */
const caches = new Map<CollectionKey, Map<string, Item>>();
/** Realtime events that arrived while a collection was still loading. */
const buffered = new Map<CollectionKey, RealtimePostgresChangesPayload<Row>[]>();
const inFlight = new Set<Promise<void>>();

/** Resolves once every write-through issued so far has reached the server (or failed). */
export async function flushWrites(): Promise<void> {
  while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
}

function collectionsFor(who: SyncIdentity): CollectionKey[] {
  const staff = who.role === 'faculty' || who.role === 'admin';
  return COLLECTION_KEYS.filter((k) => staff || !STAFF_ONLY.includes(k));
}

function publish(key: CollectionKey) {
  db.applyRemote(key, [...(caches.get(key)?.values() ?? [])]);
}

// ------------------------------------------------------------------ reading

async function fetchAll(key: CollectionKey): Promise<Item[]> {
  const out: Item[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb!.from(key).select('id, data').order('id').range(from, from + PAGE - 1);
    if (key === 'notifications') q = q.eq('user_id', identity!.userId);
    const { data, error } = await q;
    if (error) throw error;
    (data as Row[]).forEach((r) => out.push(r.data));
    if (!data || data.length < PAGE) return out;
  }
}

async function load(key: CollectionKey) {
  const items = await fetchAll(key);
  caches.set(key, new Map(items.map((i) => [i.id, i])));
  publish(key);
  // Replay anything that changed while the snapshot was in flight.
  const pending = buffered.get(key) ?? [];
  buffered.delete(key);
  pending.forEach((p) => applyChange(key, p));
}

function applyChange(key: CollectionKey, payload: RealtimePostgresChangesPayload<Row>) {
  const cache = caches.get(key);
  if (!cache) {
    buffered.set(key, [...(buffered.get(key) ?? []), payload]);
    return;
  }
  let changed = false;
  if (payload.eventType === 'DELETE') {
    const id = (payload.old as Partial<Row>).id;
    if (id && cache.has(id)) {
      cache.delete(id);
      changed = true;
    }
  } else {
    const item = (payload.new as Row).data;
    // Our own writes come back through Realtime too; identical content is an echo.
    if (item && !sameRecord(cache.get(item.id), item)) {
      cache.set(item.id, item);
      changed = true;
    }
  }
  if (changed) {
    publish(key);
    syncState.markRemoteChange(key);
  }
}

// ------------------------------------------------------------------ writing

function reportWriteError(key: CollectionKey, error: { code?: string; message: string }) {
  console.error(`[TeamForge] Could not save "${key}"`, error);
  toast.error(
    error.code === '42501' || /row-level security|permission/i.test(error.message)
      ? "That change wasn't saved — your account doesn't have permission for it."
      : error.message.includes('Only') || error.message.includes('Invitees')
        ? error.message
        : "That change couldn't be saved. Check your connection and try again."
  );
  // Re-read the collection so the optimistic local change is rolled back.
  void load(key).catch(() => {});
}

async function pushWrite(key: CollectionKey, prev: unknown[], next: unknown[]) {
  if (!sb || !identity) return;
  const { inserts, updates, deletes } = diffCollection(prev, next);
  if (inserts.length + updates.length + deletes.length === 0) return;

  // The cache now reflects what we are about to write, so the Realtime echo
  // of this change is recognised as ours.
  const cache = caches.get(key) ?? new Map<string, Item>();
  [...inserts, ...updates].forEach((i) => cache.set(i.id, i));
  deletes.forEach((id) => cache.delete(id));
  caches.set(key, cache);

  for (const rows of chunk(inserts.map((i) => toRow(key, i)))) {
    const { error } = await sb.from(key).insert(rows);
    if (error) return reportWriteError(key, error);
  }
  for (const rows of chunk(updates.map((i) => toRow(key, i)))) {
    const { error } = await sb.from(key).upsert(rows, { onConflict: 'id' });
    if (error) return reportWriteError(key, error);
  }
  for (const ids of chunk(deletes)) {
    const { error } = await sb.from(key).delete().in('id', ids);
    if (error) return reportWriteError(key, error);
  }
}

// ----------------------------------------------------------------- lifecycle

/**
 * First-run bootstrap. `seed_database` refuses to run twice (it records a
 * marker in the same transaction), so every sign-in can safely call it.
 */
async function seedIfEmpty() {
  const keys = cloudOptions.seedDemo ? (Object.keys(DEMO_SEED) as CollectionKey[]) : ['departments' as const];
  const payload = Object.fromEntries(keys.map((k) => [k, DEMO_SEED[k] ?? []]));
  const { error } = await sb!.rpc('seed_database', { payload, demo: cloudOptions.seedDemo });
  if (error) console.info('[TeamForge] Seed skipped:', error.message);
}

/** Reads the department list without signing in (the registration form needs it). */
export async function preloadPublicCollections() {
  sb ??= await getSupabase();
  const { data, error } = await sb.from('departments').select('id, data');
  if (error) return console.warn('[TeamForge] Could not load departments', error);
  if (data && data.length > 0) db.applyRemote('departments', (data as Row[]).map((r) => r.data));
}

/** Starts realtime sync for a signed-in user. Resolves once every collection has loaded. */
export async function startSync(who: SyncIdentity): Promise<void> {
  await stopSync();
  sb ??= await getSupabase();
  identity = who;
  syncState.status = 'connecting';
  syncState.error = '';

  await seedIfEmpty();

  stopWriteHook = db.onWrite((key, prev, next) => {
    const p = pushWrite(key, prev, next).finally(() => inFlight.delete(p));
    inFlight.add(p);
  });

  const keys = collectionsFor(who);

  // Subscribe before loading, so nothing that changes mid-load is missed.
  channel = sb.channel(`teamforge-sync-${who.uid}`);
  keys.forEach((key) => {
    channel!.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: key,
        ...(key === 'notifications' ? { filter: `user_id=eq.${who.userId}` } : {})
      },
      (payload: RealtimePostgresChangesPayload<Row>) => applyChange(key, payload)
    );
  });

  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 5000); // never hold the UI hostage to the socket
    channel!.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        syncState.status = 'live';
        clearTimeout(timer);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        syncState.status = 'offline';
        syncState.error = err?.message ?? 'Realtime connection lost — retrying';
      } else if (status === 'CLOSED' && identity) {
        syncState.status = 'offline';
      }
    });
  });

  const results = await Promise.allSettled(keys.map((key) => load(key)));
  const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
  if (failed.length > 0) {
    console.error('[TeamForge] Some collections failed to load', failed.map((f) => f.reason));
    syncState.status = 'error';
    syncState.error = String(failed[0].reason?.message ?? failed[0].reason);
  } else if (syncState.status === 'connecting') {
    syncState.status = 'offline'; // loaded, but the live channel has not confirmed yet
  }
}

export async function stopSync() {
  stopWriteHook?.();
  stopWriteHook = null;
  if (channel && sb) await sb.removeChannel(channel);
  channel = null;
  identity = null;
  caches.clear();
  buffered.clear();
  syncState.acknowledge();
}
