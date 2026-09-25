/**
 * Password Security Utility for TeamForge
 * 
 * Implements:
 * 1. PBKDF2-HMAC-SHA-256 with 100,000 iterations & random 16-byte salt
 * 2. Backward compatibility with legacy unsalted SHA-256 hashes with auto-migration flag
 * 3. Constant-time digest comparison to prevent timing attacks
 * 4. Password complexity and entropy strength analysis
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH_BYTES = 32;

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Hash a password using PBKDF2-HMAC-SHA-256 with a cryptographically secure salt
 * Format: `pbkdf2:{salt_hex}:{hash_hex}`
 */
export async function hashPassword(password: string, customSalt?: Uint8Array): Promise<string> {
  const salt = customSalt || crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    KEY_LENGTH_BYTES * 8
  );

  const saltHex = bufferToHex(salt);
  const hashHex = bufferToHex(derivedBits);
  return `pbkdf2:${saltHex}:${hashHex}`;
}

export interface VerifyResult {
  valid: boolean;
  needsUpgrade: boolean;
}

/**
 * Verify a password against a stored hash.
 * Supports both modern `pbkdf2:salt:hash` and legacy raw SHA-256 digests.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<VerifyResult> {
  if (!storedHash) {
    return { valid: false, needsUpgrade: false };
  }

  // Modern PBKDF2 hash format
  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) {
      return { valid: false, needsUpgrade: false };
    }
    const saltHex = parts[1];
    const targetHashHex = parts[2];
    const salt = hexToBuffer(saltHex);

    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      passwordKey,
      KEY_LENGTH_BYTES * 8
    );

    const computedHashHex = bufferToHex(derivedBits);
    const valid = timingSafeEqual(computedHashHex, targetHashHex);
    return { valid, needsUpgrade: false };
  }

  // Legacy raw SHA-256 hash (64 hex characters)
  const encoder = new TextEncoder();
  const legacyDigest = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  const legacyHex = bufferToHex(legacyDigest);
  const valid = timingSafeEqual(legacyHex, storedHash);

  // If valid with legacy hash, signal that it needs upgrade to PBKDF2
  return { valid, needsUpgrade: valid };
}

export interface PasswordStrength {
  score: number; // 0 to 4
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  feedback: string[];
}

/**
 * Evaluates password entropy and policy criteria
 */
export function evaluatePasswordStrength(password: string): PasswordStrength {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  let criteriaCount = 0;
  if (hasMinLength) criteriaCount++;
  if (hasUppercase) criteriaCount++;
  if (hasLowercase) criteriaCount++;
  if (hasNumber) criteriaCount++;
  if (hasSpecial) criteriaCount++;

  const feedback: string[] = [];
  if (!hasMinLength) feedback.push('At least 8 characters');
  if (!hasUppercase) feedback.push('One uppercase letter');
  if (!hasLowercase) feedback.push('One lowercase letter');
  if (!hasNumber) feedback.push('One number');
  if (!hasSpecial) feedback.push('One special character');

  let score = 0;
  let label: PasswordStrength['label'] = 'Weak';
  let color = 'var(--color-destructive, #ef4444)';

  if (password.length === 0) {
    score = 0;
    label = 'Weak';
  } else if (criteriaCount <= 2 || password.length < 6) {
    score = 1;
    label = 'Weak';
    color = 'var(--color-destructive, #ef4444)';
  } else if (criteriaCount === 3 || criteriaCount === 4) {
    if (password.length >= 8) {
      score = 3;
      label = 'Good';
      color = 'var(--color-info, #3b82f6)';
    } else {
      score = 2;
      label = 'Fair';
      color = 'var(--color-warning, #f59e0b)';
    }
  } else if (criteriaCount === 5 && password.length >= 10) {
    score = 4;
    label = 'Strong';
    color = 'var(--color-success, #10b981)';
  } else {
    score = 3;
    label = 'Good';
    color = 'var(--color-info, #3b82f6)';
  }

  return {
    score,
    label,
    color,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
    feedback
  };
}
