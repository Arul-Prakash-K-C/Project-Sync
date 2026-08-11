import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('produces a deterministic 64-char hex SHA-256 digest', async () => {
    const hash = await hashPassword('demo1234');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPassword('demo1234')).toBe(hash);
  });

  it('produces different hashes for different passwords', async () => {
    const a = await hashPassword('password-one');
    const b = await hashPassword('password-two');
    expect(a).not.toBe(b);
  });

  it('verifyPassword accepts the correct password and rejects the wrong one', async () => {
    const hash = await hashPassword('correct-horse');
    expect(await verifyPassword('correct-horse', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});
