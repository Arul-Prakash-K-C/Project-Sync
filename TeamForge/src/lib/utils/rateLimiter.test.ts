import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRateLimitStatus,
  recordFailedAttempt,
  recordSuccessfulAttempt
} from './rateLimiter';

describe('rateLimiter utility', () => {
  const testEmail = 'attacker@test.edu';

  beforeEach(() => {
    recordSuccessfulAttempt(testEmail);
  });

  it('starts with zero failed attempts and 5 attempts left', () => {
    const status = getRateLimitStatus(testEmail);
    expect(status.locked).toBe(false);
    expect(status.failedAttempts).toBe(0);
    expect(status.attemptsLeft).toBe(5);
  });

  it('increments failed attempts on failure', () => {
    const status1 = recordFailedAttempt(testEmail);
    expect(status1.failedAttempts).toBe(1);
    expect(status1.attemptsLeft).toBe(4);
    expect(status1.locked).toBe(false);

    const status2 = recordFailedAttempt(testEmail);
    expect(status2.failedAttempts).toBe(2);
    expect(status2.attemptsLeft).toBe(3);
  });

  it('locks account after 5 failed attempts', () => {
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt(testEmail);
    }
    const finalAttempt = recordFailedAttempt(testEmail);
    expect(finalAttempt.locked).toBe(true);
    expect(finalAttempt.remainingSeconds).toBeGreaterThan(0);
    expect(finalAttempt.attemptsLeft).toBe(0);

    const currentStatus = getRateLimitStatus(testEmail);
    expect(currentStatus.locked).toBe(true);
  });

  it('resets attempts after successful authentication', () => {
    recordFailedAttempt(testEmail);
    recordFailedAttempt(testEmail);
    recordSuccessfulAttempt(testEmail);

    const status = getRateLimitStatus(testEmail);
    expect(status.locked).toBe(false);
    expect(status.failedAttempts).toBe(0);
    expect(status.attemptsLeft).toBe(5);
  });
});
