import type { CollectionKey } from './db';

export type Item = { id: string } & Record<string, unknown>;

export interface CollectionDiff {
  /** Records that did not exist before — written with a plain INSERT. */
  inserts: Item[];
  /** Existing records whose content changed — written with an UPDATE. */
  updates: Item[];
  /** Ids that disappeared. */
  deletes: string[];
}

/**
 * JSON text with object keys sorted at every level. Postgres `jsonb` does not
 * keep key order, so a record read back from the database and the same record
 * rebuilt by the app serialise differently with plain JSON.stringify — which
 * made every unchanged row look edited and re-sent whole tables on each save.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v
  );
}

function isItem(v: unknown): v is Item {
  return typeof v === 'object' && v !== null && typeof (v as Item).id === 'string';
}

/**
 * Turns a whole-collection save (`saveProjects(all)`) into the minimal set of
 * row writes. The service layer always saves full collections, so an id missing
 * from `next` really is a deletion rather than a partial save.
 *
 * New rows are kept apart from changed ones on purpose: a plain INSERT needs no
 * read access to the row it creates (so you can notify someone else), and a
 * plain UPDATE is judged only by the UPDATE policy — an upsert would also be
 * held to the (stricter) INSERT policy and the SELECT policy.
 */
export function diffCollection(prev: unknown[], next: unknown[]): CollectionDiff {
  const before = new Map<string, string>();
  prev.filter(isItem).forEach((item) => before.set(item.id, canonicalJson(item)));

  const inserts: Item[] = [];
  const updates: Item[] = [];
  const seen = new Set<string>();
  next.filter(isItem).forEach((item) => {
    seen.add(item.id);
    const old = before.get(item.id);
    if (old === undefined) inserts.push(item);
    else if (old !== canonicalJson(item)) updates.push(item);
  });

  const deletes = [...before.keys()].filter((id) => !seen.has(id));
  return { inserts, updates, deletes };
}

/**
 * Shapes a record as a table row. Password hashes never leave the browser in
 * cloud mode (Supabase Auth owns credentials). Everything the security policies
 * key on is derived from `data` by the database, never sent separately.
 */
export function toRow(key: CollectionKey, item: Item): { id: string; data: Record<string, unknown> } {
  const data: Record<string, unknown> = JSON.parse(JSON.stringify(item)); // drops undefined
  if (key === 'users') delete data.passwordHash;
  return { id: item.id, data };
}

/** True when two records carry the same content. */
export function sameRecord(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

/** Splits a list into request-sized groups. */
export function chunk<T>(list: T[], size = 400): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
