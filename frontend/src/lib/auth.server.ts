import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { NextRequest } from 'next/server';

const USER_ID = /^[a-z0-9_-]{1,100}$/;
const MAX_CLOCK_SKEW_SECONDS = 60;

export type RequestIdentity = {
  mode: 'demo' | 'trusted-header';
  userId: string | null;
};

export class AuthenticationError extends Error {
  constructor(public readonly status: 401 | 503, public readonly code: 'authentication_required' | 'auth_not_configured') {
    super(code);
  }
}

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function canonicalIdentity(timestamp: string, userId: string, method: string, pathname: string) {
  return `${timestamp}\n${userId}\n${method.toUpperCase()}\n${pathname}`;
}

export function signTrustedIdentity(secret: string, timestamp: string, userId: string, method: string, pathname: string) {
  return createHmac('sha256', secret).update(canonicalIdentity(timestamp, userId, method, pathname)).digest('base64url');
}

export function demoMode() {
  if (enabled(process.env.APPOTA_DEMO_MODE)) return true;
  return process.env.NODE_ENV !== 'production' && process.env.APPOTA_DEMO_MODE?.trim().toLowerCase() !== 'false';
}

export function authenticateRequest(request: NextRequest, now = Date.now()): RequestIdentity {
  if (demoMode()) return { mode: 'demo', userId: null };
  if (process.env.APPOTA_AUTH_MODE?.trim().toLowerCase() !== 'trusted-header') {
    throw new AuthenticationError(503, 'auth_not_configured');
  }

  const secret = process.env.APPOTA_AUTH_SECRET || '';
  if (secret.length < 32) throw new AuthenticationError(503, 'auth_not_configured');
  const userId = request.headers.get('x-appota-user-id')?.trim().toLowerCase() || '';
  const timestamp = request.headers.get('x-appota-auth-timestamp')?.trim() || '';
  const signature = request.headers.get('x-appota-auth-signature')?.trim() || '';
  if (!USER_ID.test(userId) || !/^\d{10}$/.test(timestamp) || !signature) {
    throw new AuthenticationError(401, 'authentication_required');
  }
  const requestSeconds = Number(timestamp);
  if (!Number.isSafeInteger(requestSeconds) || Math.abs(Math.floor(now / 1000) - requestSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    throw new AuthenticationError(401, 'authentication_required');
  }
  const pathname = new URL(request.url).pathname;
  const expected = signTrustedIdentity(secret, timestamp, userId, request.method, pathname);
  if (!safeEqual(signature, expected)) throw new AuthenticationError(401, 'authentication_required');
  return { mode: 'trusted-header', userId };
}
