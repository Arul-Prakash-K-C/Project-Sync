// @vitest-environment node
/*
  Runs the real migration on PGlite (Postgres compiled to WASM) with a minimal
  stand-in for the Supabase platform — auth.uid(), auth.jwt(), the realtime
  publication and the storage tables — then checks the security model by acting
  as different people. No Docker or Supabase project needed.
*/
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migration = readFileSync(
  fileURLToPath(new URL('../migrations/20260925000000_teamforge_init.sql', import.meta.url)),
  'utf8'
);

const db = new PGlite();
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

type Who = readonly [number, string] | null;
const A = [1, 'alex@uni.edu'] as const; // student, project owner
const B = [2, 'bea@uni.edu'] as const; // student, invited then member
const C = [3, 'cal@uni.edu'] as const; // student, outsider
const F = [4, 'fay@uni.edu'] as const; // faculty (mentor)
const M = [5, 'max@uni.edu'] as const; // admin
const [aId, bId, cId, fId] = [uid(1), uid(2), uid(3), uid(4)];

async function run(who: Who, sql: string, params: unknown[] = []) {
  await db.exec('reset role');
  if (who) {
    const [n, email] = who;
    await db.query('insert into auth.users (id, email) values ($1, $2) on conflict do nothing', [uid(n), email]);
    await db.query(
      `select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)`,
      [uid(n), JSON.stringify({ sub: uid(n), email })]
    );
    await db.exec('set role authenticated');
  } else {
    await db.query(`select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false)`);
  }
  try {
    return await db.query<Record<string, unknown>>(sql, params);
  } finally {
    await db.exec('reset role');
  }
}
const ok = (who: Who, sql: string, params: unknown[] = []) => expect(run(who, sql, params)).resolves.toBeDefined();
const refused = (who: Who, sql: string, params: unknown[] = []) => expect(run(who, sql, params)).rejects.toThrow();
const count = async (who: Who, sql: string, params: unknown[] = []) => (await run(who, sql, params)).rows.length;

const profile = (role: string, name: string) =>
  JSON.stringify({ name, role, department: 'CSE', avatar: '', skills: [], interests: [], availability: true });
const project = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: 'p1', name: 'P', status: 'pending', ownerId: aId, mentorId: fId,
    members: [{ userId: aId, name: 'Alex' }], pendingInvites: [], pendingRequests: [], ...over
  });

beforeAll(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create publication supabase_realtime;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
  `);
  await db.exec(migration);
  // Supabase grants these by default on new tables.
  await db.exec(`
    grant usage on schema public, auth, storage to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated;
    grant all on storage.objects to authenticated;
    grant execute on all functions in schema auth to anon, authenticated;
  `);
}, 60_000);

describe('seeding', () => {
  it('seeds once, departments only unless demo', async () => {
    const payload = JSON.stringify({ departments: [{ id: 'd1', name: 'CSE' }], projects: [{ id: 'x', status: 'active' }] });
    const first = await run(A, 'select public.seed_database($1::jsonb, false) as r', [payload]);
    expect(first.rows[0].r).toBe(true);
    expect(await count(null, `select 1 from public.projects where id = 'x'`)).toBe(0);
    const second = await run(A, `select public.seed_database('{}'::jsonb, false) as r`);
    expect(second.rows[0].r).toBe(false);
  });

  it('lets anonymous visitors read departments', async () => {
    expect(await count(null, 'select * from public.departments')).toBe(1);
  });
});

describe('registration', () => {
  it('lets students register', async () => {
    await ok(A, 'select public.register_profile($1::jsonb)', [profile('student', 'Alex')]);
    await ok(B, 'select public.register_profile($1::jsonb)', [profile('student', 'Bea')]);
    await ok(C, 'select public.register_profile($1::jsonb)', [profile('student', 'Cal')]);
  });

  it('refuses faculty and admin self-signup unless bootstrapped', async () => {
    await refused(F, 'select public.register_profile($1::jsonb)', [profile('faculty', 'Fay')]);
    await refused(M, 'select public.register_profile($1::jsonb)', [profile('admin', 'Max')]);
    await db.exec(`update public.app_config set value = '{"adminEmails":["max@uni.edu"],"facultyEmails":["fay@uni.edu"]}' where key = 'bootstrap'`);
    await ok(F, 'select public.register_profile($1::jsonb)', [profile('faculty', 'Fay')]);
    await ok(M, 'select public.register_profile($1::jsonb)', [profile('admin', 'Max')]);
  });

  it('refuses duplicates, anonymous callers and demo claims on real deployments', async () => {
    await refused(A, 'select public.register_profile($1::jsonb)', [profile('student', 'Alex')]);
    await refused(null, 'select public.register_profile($1::jsonb)', [profile('student', 'X')]);
    await refused(C, 'select public.claim_demo_profile()');
  });
});

describe('profiles', () => {
  it('lets people edit their own profile but never keeps a password hash', async () => {
    await ok(A, `update public.users set data = data || '{"bio":"hi","passwordHash":"x"}' where id = $1`, [aId]);
    expect(await count(null, `select 1 from public.users where id = $1 and data->>'bio' = 'hi' and not data ? 'passwordHash'`, [aId])).toBe(1);
  });

  it('stops self-promotion and editing others', async () => {
    await refused(A, `update public.users set data = jsonb_set(data, '{role}', '"admin"') where id = $1`, [aId]);
    expect(await count(A, `update public.users set data = data || '{"bio":"x"}' where id = $1 returning id`, [bId])).toBe(0);
  });

  it('lets an admin change roles', async () => {
    await ok(M, `update public.users set data = jsonb_set(data, '{bio}', '"set by admin"') where id = $1`, [cId]);
  });
});

describe('projects', () => {
  it('validates proposals', async () => {
    await refused(A, `insert into public.projects (id, data) values ('p1', $1)`, [project({ mentorId: bId })]);
    await refused(A, `insert into public.projects (id, data) values ('p1', $1)`, [project({ status: 'active' })]);
    await refused(B, `insert into public.projects (id, data) values ('p1', $1)`, [project()]);
    await refused(A, `insert into public.projects (id, data) values ('other', $1)`, [project()]);
    await ok(A, `insert into public.projects (id, data) values ('p1', $1)`, [project()]);
  });

  it('keeps approval with faculty', async () => {
    await refused(A, `update public.projects set data = jsonb_set(data, '{status}', '"active"') where id = 'p1'`);
  });

  it('lets outsiders only ask to join', async () => {
    await refused(C, `update public.projects set data = jsonb_set(data, '{name}', '"Mine"') where id = 'p1'`);
    await ok(C, `update public.projects set data = jsonb_set(data, '{pendingRequests}', $1::jsonb) where id = 'p1'`, [JSON.stringify([cId])]);
  });

  it('runs the invite flow', async () => {
    await ok(A, `update public.projects set data = jsonb_set(data, '{pendingInvites}', $1::jsonb) where id = 'p1'`, [JSON.stringify([bId])]);
    const accept = `update public.projects
      set data = data || jsonb_build_object('members', data->'members' || $1::jsonb, 'pendingInvites', '[]'::jsonb)
      where id = 'p1'`;
    await refused(B, accept, [JSON.stringify([{ userId: bId }, { userId: cId }])]);
    await ok(B, accept, [JSON.stringify([{ userId: bId, name: 'Bea' }])]);
    expect(await count(null, 'select 1 from public.projects where member_ids ? $1', [bId])).toBe(1);
  });

  it('lets members work and faculty approve', async () => {
    await ok(B, `update public.projects set data = jsonb_set(data, '{description}', '"Updated"') where id = 'p1'`);
    await ok(F, `update public.projects set data = jsonb_set(data, '{status}', '"active"') where id = 'p1'`);
  });
});

describe('project work', () => {
  it('limits tasks to members', async () => {
    await ok(B, `insert into public.tasks (id, data) values ('t1', '{"id":"t1","projectId":"p1"}')`);
    await refused(C, `insert into public.tasks (id, data) values ('t2', '{"id":"t2","projectId":"p1"}')`);
  });

  it('keeps report review with faculty', async () => {
    const report = (status: string) => JSON.stringify({ id: 'r1', projectId: 'p1', submittedBy: aId, status, feedback: '' });
    await refused(A, `insert into public.weekly_reports (id, data) values ('r1', $1)`, [report('approved')]);
    await ok(A, `insert into public.weekly_reports (id, data) values ('r1', $1)`, [report('pending')]);
    await ok(A, `update public.weekly_reports set data = jsonb_set(data, '{achievements}', '"Shipped"') where id = 'r1'`);
    await refused(A, `update public.weekly_reports set data = jsonb_set(data, '{status}', '"approved"') where id = 'r1'`);
    await ok(F, `update public.weekly_reports set data = jsonb_set(data, '{status}', '"approved"') where id = 'r1'`);
  });
});

describe('notifications', () => {
  it('can be sent to others but only read by the recipient', async () => {
    await ok(A, `insert into public.notifications (id, data) values ('n1', $1)`, [JSON.stringify({ id: 'n1', userId: bId, read: false })]);
    expect(await count(A, 'select * from public.notifications')).toBe(0);
    expect(await count(B, 'select * from public.notifications')).toBe(1);
    await ok(B, `insert into public.notifications (id, data) values ('n1', $1) on conflict (id) do update set data = excluded.data`,
      [JSON.stringify({ id: 'n1', userId: bId, read: true })]);
    expect(await count(C, `delete from public.notifications where id = 'n1' returning id`)).toBe(0);
  });
});

describe('supervision', () => {
  it('keeps faculty notes, meetings and the audit log with staff', async () => {
    expect(await count(A, 'select * from public.faculty_notes')).toBe(0);
    await refused(A, `insert into public.faculty_notes (id, data) values ('fn', '{"id":"fn","projectId":"p1"}')`);
    await ok(F, `insert into public.faculty_notes (id, data) values ('fn', '{"id":"fn","projectId":"p1"}')`);
    await refused(A, `insert into public.meetings (id, data) values ('m', '{"id":"m","projectId":"p1"}')`);
    await ok(F, `insert into public.audit_log (id, data) values ('a1', $1)`, [JSON.stringify({ id: 'a1', actorId: fId })]);
    await refused(F, `insert into public.audit_log (id, data) values ('a2', $1)`, [JSON.stringify({ id: 'a2', actorId: aId })]);
    expect(await count(F, `update public.audit_log set data = data where id = 'a1' returning id`)).toBe(0);
  });

  it('hides private ideas from other students', async () => {
    await ok(A, `insert into public.project_ideas (id, data) values ('i1', $1)`, [JSON.stringify({ id: 'i1', ownerId: aId, visibility: 'private' })]);
    expect(await count(C, 'select * from public.project_ideas')).toBe(0);
    expect(await count(F, 'select * from public.project_ideas')).toBe(1);
  });
});

describe('storage', () => {
  it('accepts bytes only from members, for existing file records', async () => {
    await ok(A, `insert into public.files (id, data) values ('f1', '{"id":"f1","projectId":"p1"}')`);
    await ok(A, `insert into storage.objects (bucket_id, name, owner) values ('project-files', 'files/f1', $1)`, [aId]);
    await refused(C, `insert into storage.objects (bucket_id, name, owner) values ('project-files', 'files/f1', $1)`, [cId]);
    await refused(A, `insert into storage.objects (bucket_id, name, owner) values ('project-files', 'files/ghost', $1)`, [aId]);
  });
});

describe('demo deployments', () => {
  it('seeds demo data only when the operator allows it, and each profile is claimed once', async () => {
    await db.exec(`delete from public.app_config where key = 'seed'`);
    await refused(A, `select public.seed_database('{}'::jsonb, true)`);
    await db.exec(`update public.app_config set value = value || '{"allowDemoSeed": true}' where key = 'bootstrap'`);
    await ok(A, 'select public.seed_database($1::jsonb, true)', [
      JSON.stringify({ users: [{ id: 'student_demo', email: 'demo@uni.edu', role: 'student', passwordHash: 'x' }] })
    ]);
    expect(await count(null, `select 1 from public.users where id = 'student_demo' and data ? 'passwordHash'`)).toBe(0);
    await ok([9, 'demo@uni.edu'], 'select public.claim_demo_profile()');
    await refused([8, 'demo@uni.edu'], 'select public.claim_demo_profile()');
  });
});
