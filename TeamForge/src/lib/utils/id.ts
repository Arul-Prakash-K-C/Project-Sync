/**
 * Collision-safe record id. `Date.now()` alone collides as soon as two records
 * are created in the same millisecond — a loop notifying every team member, or
 * two people on different devices writing to the same Supabase table.
 */
export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}
