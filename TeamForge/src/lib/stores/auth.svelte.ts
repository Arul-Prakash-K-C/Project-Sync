import { db, type User } from '$lib/services/db';
import { hashPassword, verifyPassword, evaluatePasswordStrength } from '$lib/utils/password';
import {
  getRateLimitStatus,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  applyProgressiveDelay
} from '$lib/utils/rateLimiter';
import { isCloudMode, cloudOptions, DEMO_PASSWORD } from '$lib/supabase/config';
import type { User as AuthUser, Session } from '@supabase/supabase-js';
import { newId } from '$lib/utils/id';

export interface UserSession {
  user: User;
  sessionId: string;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
}

const SESSION_STORAGE_KEY = 'teamforge_auth_session';
const LEGACY_USER_KEY = 'teamforge_current_user';
export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const EXPIRY_CHECK_INTERVAL_MS = 30 * 1000;
/** Department label recorded for administrators (matches the seeded demo admin). */
export const ADMIN_DEPARTMENT = 'Administration';

type Role = User['role'];

/** The session copy of a user never carries the password hash. */
function publicUser(user: User): User {
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}

/**
 * Thrown when sign-up succeeded but Supabase is waiting for the person to
 * confirm their email address. The UI treats it as guidance, not a failure.
 */
export class PendingConfirmationError extends Error {
  constructor(email: string) {
    super(`We sent a confirmation link to ${email}. Open it, then sign in.`);
    this.name = 'PendingConfirmationError';
  }
}

/** Human-readable text for the auth and database errors a person can actually hit. */
function cloudAuthMessage(err: { code?: string; message?: string } | null | undefined): string {
  switch (err?.code) {
    case 'invalid_credentials':
    case 'email_address_invalid':
      return 'Invalid email or password';
    case 'email_not_confirmed':
      return 'Confirm your email address first — check your inbox for the link.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts. The server has paused this for a while — try again later.';
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists';
    case 'weak_password':
      return 'Password is too weak.';
    case 'signup_disabled':
      return 'New sign-ups are currently disabled.';
    case '42501':
      // Raised by register_profile() with a message written for people.
      return err.message ?? "This account type can't be created by self-registration.";
    default:
      if (err?.message && /fetch|network/i.test(err.message)) {
        return "Can't reach the server. Check your connection and try again.";
      }
      return err?.message || 'Something went wrong while signing in. Please try again.';
  }
}

class AuthStore {
  user = $state<User | null>(null);
  loading = $state<boolean>(true);
  session = $state<UserSession | null>(null);
  /** Set when a session ended on its own, so the sign-in page can say why. */
  expiredNotice = $state(false);

  private expiryTimer: ReturnType<typeof setInterval> | null = null;
  /**
   * Cloud mode: the sign-in currently being completed. The explicit login call
   * and Supabase's auth-state listener both fire for the same sign-in; sharing
   * one promise keeps sync from starting twice.
   */
  private inflight: { uid: string; promise: Promise<User> } | null = null;

  constructor() {
    if (typeof window === 'undefined') {
      this.loading = false;
      return;
    }
    if (isCloudMode) {
      db.useDemoDefaults = false;
      void this.initCloud();
    } else {
      this.initLocal();
    }
    this.expiryTimer = setInterval(() => this.checkExpiry(), EXPIRY_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.checkExpiry();
    });
  }

  // ---------------------------------------------------------------- sessions

  private readSession(): UserSession | null {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as UserSession) : null;
    } catch {
      return null;
    }
  }

  private establishSession(user: User): UserSession {
    const now = Date.now();
    const session: UserSession = {
      user: publicUser(user),
      sessionId: newId('sess'),
      createdAt: now,
      lastActiveAt: now,
      expiresAt: now + SESSION_DURATION_MS
    };
    this.user = session.user;
    this.session = session;
    this.expiredNotice = false;
    this.persistSession();
    return session;
  }

  private persistSession() {
    if (typeof window === 'undefined' || !this.session) return;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.session));
    localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(this.session.user));
  }

  private clearSession() {
    this.user = null;
    this.session = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(LEGACY_USER_KEY);
    }
  }

  /**
   * Sessions have an absolute 24-hour lifetime. This runs on a timer and when
   * the tab regains focus, so a session left open overnight ends on its own
   * rather than only being noticed on the next full page load.
   */
  checkExpiry(): boolean {
    if (!this.session) return false;
    if (this.session.expiresAt > Date.now()) {
      this.session.lastActiveAt = Date.now();
      return false;
    }
    this.expiredNotice = true;
    void this.logout();
    return true;
  }

  // --------------------------------------------------------------- local mode

  private initLocal() {
    try {
      const stored = this.readSession();
      if (stored) {
        if (stored.expiresAt > Date.now() && stored.user) {
          stored.lastActiveAt = Date.now();
          stored.user = publicUser(db.getUser(stored.user.id) ?? stored.user);
          this.session = stored;
          this.user = stored.user;
          this.persistSession();
        } else {
          this.expiredNotice = true;
          this.clearSession();
        }
      } else {
        // Sessions written before expiry existed: honour once, then they expire normally.
        const legacy = localStorage.getItem(LEGACY_USER_KEY);
        const user: User | null = legacy ? JSON.parse(legacy) : null;
        if (user?.id) this.establishSession(db.getUser(user.id) ?? user);
      }
    } catch {
      this.clearSession();
    }
    this.loading = false;
  }

  private async loginLocal(email: string, password: string): Promise<User> {
    const users = db.getUsers();
    const matched = users.find((u) => u.email.toLowerCase() === email);
    if (!matched) {
      recordFailedAttempt(email);
      throw new Error('Invalid email or password');
    }

    // An account without a stored hash cannot be verified. Letting the first
    // password typed become the password would hand the account to whoever
    // tried first, so it is refused and needs an administrator to reset it.
    if (!matched.passwordHash) {
      recordFailedAttempt(email);
      throw new Error('This account has no password set. Ask an administrator to reset it.');
    }

    const { valid, needsUpgrade } = await verifyPassword(password, matched.passwordHash);
    if (!valid) {
      const afterFail = recordFailedAttempt(email);
      if (afterFail.locked) {
        throw new Error(`Too many failed attempts. Account locked for ${afterFail.remainingSeconds} seconds.`);
      }
      const left = afterFail.attemptsLeft;
      throw new Error(`Invalid email or password${left > 0 ? ` (${left} attempt${left === 1 ? '' : 's'} remaining)` : ''}`);
    }

    // Transparently move legacy unsalted SHA-256 hashes to PBKDF2.
    if (needsUpgrade) {
      matched.passwordHash = await hashPassword(password);
      db.saveUsers(users);
    }
    return matched;
  }

  // --------------------------------------------------------------- cloud mode

  private async initCloud() {
    try {
      const { getSupabase } = await import('$lib/supabase/client');
      const { preloadPublicCollections } = await import('$lib/services/cloudSync');
      const sb = await getSupabase();
      void preloadPublicCollections();
      sb.auth.onAuthStateChange((event, session) => {
        // Supabase warns against awaiting its own calls inside this callback,
        // so the follow-up work runs on the next tick.
        setTimeout(() => void this.handleCloudAuth(event, session), 0);
      });
    } catch (err) {
      console.error('[TeamForge] Supabase failed to initialise', err);
      this.loading = false;
    }
  }

  private async handleCloudAuth(event: string, session: Session | null) {
    if (!session) {
      if (this.user) this.clearSession();
      this.loading = false;
      return;
    }
    if (event === 'TOKEN_REFRESHED' && this.user) return;
    const stored = this.readSession();
    if (stored && stored.expiresAt <= Date.now()) {
      this.expiredNotice = true;
      await this.logout();
      this.loading = false;
      return;
    }
    try {
      await this.completeCloudSignIn(session.user, stored);
    } catch (err) {
      console.error('[TeamForge] Could not restore session', err);
      await this.logout();
    }
    this.loading = false;
  }

  /** Resolves the app user for a Supabase login, starts realtime sync and opens a session. */
  private completeCloudSignIn(authUser: AuthUser, resume?: UserSession | null): Promise<User> {
    if (this.inflight?.uid === authUser.id) return this.inflight.promise;
    const promise = this.doCompleteCloudSignIn(authUser, resume).catch((err) => {
      if (this.inflight?.uid === authUser.id) this.inflight = null;
      throw err;
    });
    this.inflight = { uid: authUser.id, promise };
    return promise;
  }

  private async doCompleteCloudSignIn(authUser: AuthUser, resume?: UserSession | null): Promise<User> {
    const { getSupabase } = await import('$lib/supabase/client');
    const { startSync } = await import('$lib/services/cloudSync');
    const sb = await getSupabase();

    let { data: account } = await sb.from('accounts').select('user_id').eq('auth_uid', authUser.id).maybeSingle();

    if (!account) {
      // First sign-in after registering (possibly after confirming an email):
      // the profile the person filled in travels in their auth metadata, and the
      // database validates it — role included — before creating anything.
      const pendingProfile = authUser.user_metadata?.teamforge_profile;
      const { error } = pendingProfile
        ? await sb.rpc('register_profile', { profile: pendingProfile })
        : cloudOptions.seedDemo
          ? await sb.rpc('claim_demo_profile')
          : { error: { code: 'P0002', message: 'No TeamForge profile is linked to this sign-in.' } };
      // 23505 = the profile already exists. Confirming by email opens a second
      // tab, and both tabs pick up the new session at once; whichever loses the
      // race just reads the profile the other one created.
      if (error && error.code !== '23505') throw new Error(cloudAuthMessage(error));
      ({ data: account } = await sb.from('accounts').select('user_id').eq('auth_uid', authUser.id).maybeSingle());
      if (!account) throw new Error('No TeamForge profile is linked to this sign-in.');
    }

    const userId = account.user_id as string;
    const { data: row, error: profileError } = await sb.from('users').select('data').eq('id', userId).maybeSingle();
    if (profileError || !row) throw new Error('Your TeamForge profile could not be found.');
    const profile = row.data as User;

    await startSync({ uid: authUser.id, userId, role: profile.role });
    const user = db.getUser(userId) ?? profile;

    if (resume && resume.user.id === userId && resume.expiresAt > Date.now()) {
      resume.user = publicUser(user);
      resume.lastActiveAt = Date.now();
      this.session = resume;
      this.user = resume.user;
      this.persistSession();
    } else {
      this.establishSession(user);
    }
    return user;
  }

  private async loginCloud(email: string, password: string): Promise<User> {
    const { getSupabase } = await import('$lib/supabase/client');
    const sb = await getSupabase();

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      try {
        return await this.completeCloudSignIn(data.user);
      } catch (err) {
        await this.logout();
        throw err;
      }
    }

    // Demo deployments: the seeded demo profiles have no login until someone
    // first signs in as them with the demo password.
    const canProvisionDemo = cloudOptions.seedDemo && password === DEMO_PASSWORD && error?.code === 'invalid_credentials';
    if (!canProvisionDemo) {
      recordFailedAttempt(email);
      throw new Error(cloudAuthMessage(error));
    }
    const { data: signUp, error: signUpError } = await sb.auth.signUp({ email, password });
    if (signUpError || !signUp.user) {
      recordFailedAttempt(email);
      throw new Error(cloudAuthMessage(signUpError));
    }
    if (!signUp.session) {
      throw new Error('Demo sign-in needs email confirmation turned off in the Supabase Auth settings.');
    }
    try {
      return await this.completeCloudSignIn(signUp.user);
    } catch (err) {
      await this.logout();
      throw err;
    }
  }

  private async registerCloud(newUser: User, password: string): Promise<User> {
    const { getSupabase } = await import('$lib/supabase/client');
    const sb = await getSupabase();

    // The profile rides along as auth metadata and becomes a row on the first
    // signed-in moment — right away, or after the email is confirmed.
    const { id: _clientId, ...profile } = publicUser(newUser);
    const { data, error } = await sb.auth.signUp({
      email: newUser.email,
      password,
      options: {
        data: { teamforge_profile: JSON.parse(JSON.stringify(profile)) },
        emailRedirectTo: typeof location !== 'undefined' ? `${location.origin}/auth` : undefined
      }
    });
    if (error) throw new Error(cloudAuthMessage(error));
    if (!data.session || !data.user) throw new PendingConfirmationError(newUser.email);

    try {
      return await this.completeCloudSignIn(data.user);
    } catch (err) {
      await this.logout();
      throw err;
    }
  }

  // -------------------------------------------------------------- public API

  async login(email: string, password: string) {
    const trimmedEmail = email.trim().toLowerCase();

    const rateLimit = getRateLimitStatus(trimmedEmail);
    if (rateLimit.locked) {
      throw new Error(`Account temporarily locked due to too many failed attempts. Try again in ${rateLimit.remainingSeconds}s.`);
    }
    if (rateLimit.failedAttempts > 0) {
      await applyProgressiveDelay(rateLimit.failedAttempts);
    }

    const matched = isCloudMode
      ? await this.loginCloud(trimmedEmail, password)
      : await this.loginLocal(trimmedEmail, password);

    recordSuccessfulAttempt(trimmedEmail);
    if (!isCloudMode) this.establishSession(matched);
    return this.user ?? matched;
  }

  async logout() {
    this.clearSession();
    if (isCloudMode) {
      this.inflight = null;
      const { stopSync } = await import('$lib/services/cloudSync');
      await stopSync();
      // Cached collections belong to the account that just left; never show
      // them to whoever uses this browser next.
      db.clearLocalCache();
      const { getSupabase } = await import('$lib/supabase/client');
      const sb = await getSupabase();
      // 'local' ends the session in this browser only; the default ('global')
      // would also revoke the person's sessions on every other device.
      await sb.auth.signOut({ scope: 'local' }).catch(() => {});
    }
  }

  async register(
    name: string,
    email: string,
    password: string,
    role: Role,
    department: string,
    academicYear?: string
  ) {
    const trimmedEmail = email.trim().toLowerCase();
    const users = db.getUsers();

    if (!isCloudMode && users.some((u) => u.email.toLowerCase() === trimmedEmail)) {
      throw new Error('An account with this email already exists');
    }

    const strength = evaluatePasswordStrength(password);
    if (!strength.hasMinLength) {
      throw new Error('Password must be at least 8 characters long');
    }
    if (strength.score < 2) {
      throw new Error('Password is too weak. Include a mix of letters, numbers, and special characters.');
    }

    const newUser: User = {
      id: newId('user'),
      name: name.trim(),
      email: trimmedEmail,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name.trim())}`,
      role,
      // Administrators are platform-wide, not part of an academic department.
      department: role === 'admin' ? ADMIN_DEPARTMENT : department,
      academicYear: role === 'student' ? academicYear || 'Year 1' : undefined,
      bio: '',
      skills: [],
      interests: [],
      availability: true,
      previousProjects: []
    };

    if (isCloudMode) return this.registerCloud(newUser, password);

    newUser.passwordHash = await hashPassword(password);
    users.push(newUser);
    db.saveUsers(users);
    this.establishSession(newUser);
    return newUser;
  }

  /** Re-reads the signed-in user's profile after an edit, without extending the session. */
  refreshUser() {
    if (!this.user || !this.session) return;
    const refreshed = db.getUser(this.user.id);
    if (!refreshed) return;
    this.session.user = publicUser(refreshed);
    this.user = this.session.user;
    this.persistSession();
  }
}

export const auth = new AuthStore();
