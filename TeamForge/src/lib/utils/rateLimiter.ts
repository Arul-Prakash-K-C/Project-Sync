/**
 * Rate Limiter and Account Lockout Utility for TeamForge
 * 
 * Provides client-side defense against brute-force attacks and credential stuffing:
 * - Tracks failed attempts per email identifier
 * - Enforces progressive delay on consecutive failures
 * - Triggers a 60-second account lockout after 5 failed attempts
 * - Exposes live lockout status and remaining seconds for UI timers
 */

export interface RateLimitStatus {
  locked: boolean;
  remainingSeconds: number;
  failedAttempts: number;
  attemptsLeft: number;
}

interface AttemptRecord {
  count: number;
  lastAttempt: number;
  lockedUntil: number;
}

const STORAGE_KEY = 'teamforge_rate_limit_records';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds

function getRecords(): Record<string, AttemptRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRecords(records: Record<string, AttemptRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    const json = JSON.stringify(records);
    sessionStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Ignore storage quota errors
  }
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

/**
 * Gets the current lockout status for an email identifier
 */
export function getRateLimitStatus(email: string): RateLimitStatus {
  const normKey = normalizeKey(email);
  if (!normKey) {
    return { locked: false, remainingSeconds: 0, failedAttempts: 0, attemptsLeft: MAX_ATTEMPTS };
  }

  const records = getRecords();
  const record = records[normKey];
  const now = Date.now();

  if (!record) {
    return { locked: false, remainingSeconds: 0, failedAttempts: 0, attemptsLeft: MAX_ATTEMPTS };
  }

  if (record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      locked: true,
      remainingSeconds,
      failedAttempts: record.count,
      attemptsLeft: 0
    };
  }

  // Lockout expired, reset attempt count if window passed
  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    delete records[normKey];
    saveRecords(records);
    return { locked: false, remainingSeconds: 0, failedAttempts: 0, attemptsLeft: MAX_ATTEMPTS };
  }

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - record.count);
  return {
    locked: false,
    remainingSeconds: 0,
    failedAttempts: record.count,
    attemptsLeft
  };
}

/**
 * Record a failed authentication attempt
 */
export function recordFailedAttempt(email: string): RateLimitStatus {
  const normKey = normalizeKey(email);
  if (!normKey) {
    return { locked: false, remainingSeconds: 0, failedAttempts: 0, attemptsLeft: MAX_ATTEMPTS };
  }

  const records = getRecords();
  const now = Date.now();
  const existing = records[normKey] || { count: 0, lastAttempt: 0, lockedUntil: 0 };

  existing.count += 1;
  existing.lastAttempt = now;

  if (existing.count >= MAX_ATTEMPTS) {
    existing.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  records[normKey] = existing;
  saveRecords(records);

  return getRateLimitStatus(email);
}

/**
 * Reset rate limit records upon successful authentication
 */
export function recordSuccessfulAttempt(email: string): void {
  const normKey = normalizeKey(email);
  if (!normKey) return;

  const records = getRecords();
  if (records[normKey]) {
    delete records[normKey];
    saveRecords(records);
  }
}

/**
 * Artificial progressive delay to mitigate fast automated password guessing
 */
export async function applyProgressiveDelay(failedAttempts: number): Promise<void> {
  if (failedAttempts <= 1) return;
  // Delay 200ms - 800ms depending on failed attempts
  const delayMs = Math.min(800, failedAttempts * 200);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
