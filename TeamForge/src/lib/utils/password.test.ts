import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  timingSafeEqual,
  evaluatePasswordStrength
} from './password';

describe('password hashing & verification with PBKDF2', () => {
  it('produces a valid pbkdf2 hash format (pbkdf2:salt:hash)', async () => {
    const hash = await hashPassword('mySecretPassword123');
    expect(hash).toMatch(/^pbkdf2:[0-9a-f]{32}:[0-9a-f]{64}$/);
  });

  it('produces unique hashes for the same password due to random salt', async () => {
    const a = await hashPassword('demo1234');
    const b = await hashPassword('demo1234');
    expect(a).not.toBe(b);
  });

  it('verifyPassword succeeds for valid PBKDF2 password and rejects invalid', async () => {
    const hash = await hashPassword('correct-horse-battery');
    const validRes = await verifyPassword('correct-horse-battery', hash);
    expect(validRes.valid).toBe(true);
    expect(validRes.needsUpgrade).toBe(false);

    const invalidRes = await verifyPassword('wrong-horse-battery', hash);
    expect(invalidRes.valid).toBe(false);
  });

  it('supports legacy raw SHA-256 hashes and flags them for upgrade', async () => {
    // SHA-256 for 'demo1234'
    const legacyHash = '0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d';
    
    const validRes = await verifyPassword('demo1234', legacyHash);
    expect(validRes.valid).toBe(true);
    expect(validRes.needsUpgrade).toBe(true); // Should signal upgrade needed

    const invalidRes = await verifyPassword('wrongpass', legacyHash);
    expect(invalidRes.valid).toBe(false);
  });
});

describe('timingSafeEqual', () => {
  it('returns true for matching strings and false for mismatched strings', () => {
    expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
    expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
    expect(timingSafeEqual('abcdef', 'abc')).toBe(false);
  });
});

describe('evaluatePasswordStrength', () => {
  it('identifies weak passwords', () => {
    const empty = evaluatePasswordStrength('');
    expect(empty.score).toBe(0);
    expect(empty.label).toBe('Weak');

    const short = evaluatePasswordStrength('abc');
    expect(short.score).toBe(1);
    expect(short.hasMinLength).toBe(false);
  });

  it('identifies fair, good, and strong passwords based on criteria', () => {
    const fair = evaluatePasswordStrength('Pass1234');
    expect(fair.hasMinLength).toBe(true);
    expect(fair.hasUppercase).toBe(true);
    expect(fair.hasLowercase).toBe(true);
    expect(fair.hasNumber).toBe(true);
    expect(fair.score).toBeGreaterThanOrEqual(2);

    const strong = evaluatePasswordStrength('V3ry$tr0ngP@ssw0rd!');
    expect(strong.score).toBe(4);
    expect(strong.label).toBe('Strong');
    expect(strong.hasSpecial).toBe(true);
  });
});
