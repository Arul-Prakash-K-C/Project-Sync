import { describe, it, expect } from 'vitest';
import { diffCollection, toRow, sameRecord, chunk } from './syncDiff';

describe('diffCollection', () => {
  const a = { id: 'a', v: 1 };
  const b = { id: 'b', v: 1 };

  it('reports nothing when the collection is unchanged', () => {
    expect(diffCollection([a, b], [{ ...a }, { ...b }])).toEqual({ inserts: [], updates: [], deletes: [] });
  });

  it('separates new records from changed ones', () => {
    const changed = { id: 'b', v: 2 };
    const added = { id: 'c', v: 1 };
    const { inserts, updates, deletes } = diffCollection([a, b], [a, changed, added]);
    expect(inserts).toEqual([added]);
    expect(updates).toEqual([changed]);
    expect(deletes).toEqual([]);
  });

  it('deletes ids that disappeared', () => {
    expect(diffCollection([a, b], [a]).deletes).toEqual(['b']);
  });

  it('ignores entries without a string id', () => {
    const { inserts } = diffCollection([], [{ nope: true }, null, a]);
    expect(inserts).toEqual([a]);
  });
});

describe('row shaping', () => {
  it('never sends a password hash to the database', () => {
    const row = toRow('users', { id: 'u1', email: 'x@y.z', passwordHash: 'pbkdf2:aa:bb' });
    expect(row).toEqual({ id: 'u1', data: { id: 'u1', email: 'x@y.z' } });
  });

  it('keeps the id inside data (the table enforces that they match)', () => {
    expect(toRow('projects', { id: 'p1', name: 'P' }).data.id).toBe('p1');
  });

  it('drops undefined fields rather than sending them', () => {
    expect(toRow('meetings', { id: 'm', attendance: undefined }).data).toEqual({ id: 'm' });
  });

  it('compares records by content', () => {
    expect(sameRecord({ id: 'a', v: 1 }, { id: 'a', v: 1 })).toBe(true);
    expect(sameRecord({ id: 'a', v: 1 }, { id: 'a', v: 2 })).toBe(false);
  });
});

describe('chunk', () => {
  it('splits into request-sized groups', () => {
    const groups = chunk(Array.from({ length: 950 }, (_, i) => i));
    expect(groups.map((g) => g.length)).toEqual([400, 400, 150]);
  });
});
