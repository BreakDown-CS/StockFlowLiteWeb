import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Session cookie crypto (pure, no Next.js imports, unit-testable).
 *
 * The cookie payload is the only place the backend bearer token is stored. It is
 * sealed with AES-256-GCM so the browser can neither read nor modify it:
 *  - confidentiality: the token must not be readable by the user (or an extension)
 *  - integrity: GCM's auth tag makes silent tampering detectable (fail closed)
 *
 * Layout: "v1." + base64url(iv[12] | tag[16] | ciphertext)
 * The version prefix exists so key/payload changes can ship without breaking
 * existing sessions (an old version simply fails to open and forces a re-login).
 */

export const SESSION_VERSION = 1;

const VERSION_PREFIX = 'v1.';
const IV_LENGTH = 12; // 96-bit nonce, the GCM standard
const TAG_LENGTH = 16;
const MIN_SECRET_LENGTH = 32;

export type SessionRole = 'ADMIN' | 'STOREKEEPER' | 'REQUESTER';

export type SessionUser = {
  id: string;
  username: string;
  role: SessionRole;
};

export type SessionPayload = {
  /** Payload version. */
  v: number;
  /** Opaque backend bearer token. Server-to-server only. */
  token: string;
  /** Backend session expiry, epoch seconds. Never extended locally. */
  exp: number;
  /** CSRF secret; the client echoes it, the server validates against this value. */
  csrf: string;
  /** Cached identity for rendering. Never an authorization source. */
  user: SessionUser;
};

/** Raised when a cookie cannot be trusted; callers must treat it as "no session". */
export class SessionDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionDecodeError';
  }
}

function keyFrom(secret: string): Buffer {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  // The secret is arbitrary text; hash it to a fixed 32-byte AES key.
  return createHash('sha256').update(secret, 'utf8').digest();
}

/** A fresh 256-bit CSRF secret, URL-safe. */
export function createCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Encrypts and authenticates a session payload into a cookie-safe string. */
export function sealSession(payload: SessionPayload, secret: string): string {
  const key = keyFrom(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, ciphertext]);
  return VERSION_PREFIX + combined.toString('base64url');
}

/**
 * Decrypts and validates a session cookie.
 *
 * @throws SessionDecodeError on any malformed, tampered, foreign-key or
 * wrong-version value. Callers must never fall back to trusting partial input.
 */
export function openSession(blob: string, secret: string): SessionPayload {
  if (!blob.startsWith(VERSION_PREFIX)) {
    throw new SessionDecodeError('Unsupported session payload version');
  }

  const combined = Buffer.from(blob.slice(VERSION_PREFIX.length), 'base64url');
  if (combined.length <= IV_LENGTH + TAG_LENGTH) {
    throw new SessionDecodeError('Session payload is too short');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

  let plaintext: string;
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), iv);
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // Wrong key, tampered ciphertext or broken tag: indistinguishable on purpose.
    throw new SessionDecodeError('Session payload failed authentication');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new SessionDecodeError('Session payload is not valid JSON');
  }

  if (!isSessionPayload(parsed)) {
    throw new SessionDecodeError('Session payload has an unexpected shape');
  }
  if (parsed.v !== SESSION_VERSION) {
    throw new SessionDecodeError('Session payload version mismatch');
  }

  return parsed;
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const user = candidate.user;

  return (
    typeof candidate.v === 'number' &&
    typeof candidate.token === 'string' &&
    candidate.token.length > 0 &&
    typeof candidate.exp === 'number' &&
    Number.isFinite(candidate.exp) &&
    typeof candidate.csrf === 'string' &&
    candidate.csrf.length > 0 &&
    typeof user === 'object' &&
    user !== null &&
    typeof (user as Record<string, unknown>).id === 'string' &&
    typeof (user as Record<string, unknown>).username === 'string' &&
    isSessionRole((user as Record<string, unknown>).role)
  );
}

function isSessionRole(value: unknown): value is SessionRole {
  return value === 'ADMIN' || value === 'STOREKEEPER' || value === 'REQUESTER';
}

/** True when the backend session has already expired (epoch seconds). */
export function isSessionExpired(payload: SessionPayload, nowMs: number = Date.now()): boolean {
  return payload.exp * 1000 <= nowMs;
}

/** Converts the backend RFC3339 `expires_at` into epoch seconds. */
export function toEpochSeconds(rfc3339: string): number {
  const ms = Date.parse(rfc3339);
  if (!Number.isFinite(ms)) {
    throw new SessionDecodeError('Invalid expires_at from upstream');
  }
  return Math.floor(ms / 1000);
}

/** Constant-time comparison for the CSRF secret. */
export function secretsMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
