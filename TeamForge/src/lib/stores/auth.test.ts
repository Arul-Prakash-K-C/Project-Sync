import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { auth, SESSION_DURATION_MS } from './auth.svelte';
import { db } from '$lib/services/db';
import { recordSuccessfulAttempt } from '$lib/utils/rateLimiter';

beforeEach(async () => {
  await auth.logout();
  localStorage.clear();
  sessionStorage.clear();
  ['alex@teamforge.edu', 'nohash@teamforge.edu', 'new@teamforge.edu'].forEach(recordSuccessfulAttempt);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AuthStore (local mode)', () => {
  it('signs in a demo account and upgrades its legacy SHA-256 hash to PBKDF2', async () => {
    const user = await auth.login('alex@teamforge.edu', 'demo1234');
    expect(user.id).toBe('student_alex');
    expect(db.getUser('student_alex')?.passwordHash).toMatch(/^pbkdf2:/);
  });

  it('never keeps the password hash in the session copy', async () => {
    await auth.login('alex@teamforge.edu', 'demo1234');
    expect(auth.user).not.toHaveProperty('passwordHash');
    expect(localStorage.getItem('teamforge_auth_session')).not.toContain('pbkdf2');
  });

  it('rejects a wrong password and counts the attempt', async () => {
    await expect(auth.login('alex@teamforge.edu', 'wrong-password')).rejects.toThrow(/4 attempts remaining/);
  });

  it('refuses accounts that have no password hash instead of adopting the first password typed', async () => {
    const users = db.getUsers();
    users.push({ ...users[0], id: 'nohash', email: 'nohash@teamforge.edu', passwordHash: undefined });
    db.saveUsers(users);
    await expect(auth.login('nohash@teamforge.edu', 'anything123')).rejects.toThrow(/no password set/);
    expect(db.getUser('nohash')?.passwordHash).toBeUndefined();
  });

  it('rejects weak passwords at registration', async () => {
    await expect(
      auth.register('New Person', 'new@teamforge.edu', 'password', 'student', 'Computer Science & Engineering')
    ).rejects.toThrow(/too weak/);
  });

  it('ends the session on its own once 24 hours pass', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T09:00:00Z') });
    await auth.login('alex@teamforge.edu', 'demo1234');
    expect(auth.checkExpiry()).toBe(false);

    vi.setSystemTime(new Date(Date.now() + SESSION_DURATION_MS + 1000));
    expect(auth.checkExpiry()).toBe(true);
    expect(auth.user).toBeNull();
    expect(auth.expiredNotice).toBe(true);
  });

  it('refreshUser picks up profile edits without extending the session', async () => {
    await auth.login('alex@teamforge.edu', 'demo1234');
    const expiresAt = auth.session!.expiresAt;
    db.updateUserProfile('student_alex', { bio: 'Updated bio' });
    auth.refreshUser();
    expect(auth.user?.bio).toBe('Updated bio');
    expect(auth.session!.expiresAt).toBe(expiresAt);
  });
});

describe('registration departments', () => {
  it('records administrators under Administration, whatever department was sent', async () => {
    const admin = await auth.register('Ada Admin', 'ada@teamforge.edu', 'Str0ng!Pass', 'admin', 'Software Engineering');
    expect(admin.department).toBe('Administration');
  });

  it('keeps the chosen department for students', async () => {
    const student = await auth.register('Sam Student', 'sam@teamforge.edu', 'Str0ng!Pass', 'student', 'Software Engineering');
    expect(student.department).toBe('Software Engineering');
  });
});
