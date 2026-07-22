import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import { MAX_AUDIT_METADATA_BYTES, SESSION_IDLE_MS } from './constants.js';

const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 } as const;
const SENSITIVE_KEY = /(password|password_hash|token|token_hash|cookie|authorization|csrf|secret)/i;

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
export const hashPassword = (password: string): Promise<string> => argon2.hash(password, ARGON2_OPTIONS);
export const verifyPassword = (hash: string, password: string): Promise<boolean> => argon2.verify(hash, password);
export const needsPasswordRehash = (hash: string): boolean => argon2.needsRehash(hash, ARGON2_OPTIONS);
export const generateSessionToken = (): string => randomBytes(32).toString('hex');
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
export const hashSessionToken = sha256;
export const hashRateLimitKey = sha256;
export const generateCsrfToken = (): string => randomBytes(32).toString('hex');

export function safeTokenCompare(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function calculateSessionRenewal(now: Date, lastSeenAt: Date, absoluteExpiresAt: Date): Date | null {
  if (now.getTime() - lastSeenAt.getTime() < 5 * 60 * 1000) return null;
  return new Date(Math.min(now.getTime() + SESSION_IDLE_MS, absoluteExpiresAt.getTime()));
}

export function sanitizeAuditMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.slice(0, 50).map(clean);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).filter(([key]) => !SENSITIVE_KEY.test(key)).map(([k, v]) => [k, clean(v)]));
    }
    return typeof value === 'string' ? value.slice(0, 1_000) : value;
  };
  const result = clean(input) as Record<string, unknown>;
  return Buffer.byteLength(JSON.stringify(result)) <= MAX_AUDIT_METADATA_BYTES ? result : { truncated: true };
}
