import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { emitErrorTelemetry } from './telemetry.server';

export type SupabaseStatus = {
  configured: boolean;
  connected: boolean;
  ready?: boolean;
  checking?: boolean;
  stale?: boolean;
  error?: 'not_configured' | 'invalid_config' | 'health_unavailable';
};

type SupabaseConfiguration =
  | { valid: true; id: string; url: string; key: string }
  | { valid: false; status: SupabaseStatus };
type CacheEntry = { id: string; status: SupabaseStatus; expiresAt: number };
type PendingProbe = { id: string; promise: Promise<SupabaseStatus> };

const HEALTH_TIMEOUT_MS = 2000;
const HEALTH_CACHE_MS = 30_000;
let cached: CacheEntry | undefined;
let pending: PendingProbe | undefined;

function configuration(): SupabaseConfiguration {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key || /placeholder|your-project-id/.test(url)) {
    return { valid: false, status: { configured: false, connected: false, error: 'not_configured' } };
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return { valid: false, status: { configured: true, connected: false, error: 'invalid_config' } };
    }
  } catch {
    return { valid: false, status: { configured: true, connected: false, error: 'invalid_config' } };
  }
  return { valid: true, id: `${url}\0${key}`, url, key };
}

async function probe(config: Extract<SupabaseConfiguration, { valid: true }>, requestId: string): Promise<SupabaseStatus> {
  const startedAt = Date.now();
  try {
    const client = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.rpc('knowledge_health').abortSignal(AbortSignal.timeout(HEALTH_TIMEOUT_MS));
    if (!error && typeof data === 'boolean') return { configured: true, connected: true, ready: data };
    emitErrorTelemetry({
      event: 'dependency_error', requestId, stage: 'supabase.health', code: 'health_unavailable',
      errorClass: error ? 'SupabaseRpcError' : 'InvalidHealthPayload', startedAt,
    });
  } catch (error) {
    emitErrorTelemetry({ event: 'dependency_error', requestId, stage: 'supabase.health', code: 'health_unavailable', error, startedAt });
  }
  return { configured: true, connected: false, error: 'health_unavailable' };
}

export function cachedSupabaseStatus(now = Date.now()): SupabaseStatus {
  const config = configuration();
  if (!config.valid) return config.status;
  if (!cached || cached.id !== config.id) return { configured: true, connected: false, checking: true };
  return cached.expiresAt > now ? cached.status : { ...cached.status, stale: true };
}

export function supabaseStatusNeedsRefresh(status: SupabaseStatus) {
  return status.configured && (status.checking === true || status.stale === true);
}

export function checkSupabaseConnection(options: { requestId?: string } = {}): Promise<SupabaseStatus> {
  const config = configuration();
  if (!config.valid) return Promise.resolve(config.status);
  if (cached?.id === config.id && cached.expiresAt > Date.now()) return Promise.resolve(cached.status);
  if (pending?.id === config.id) return pending.promise;

  const promise = probe(config, options.requestId || randomUUID()).then(status => {
    cached = { id: config.id, status, expiresAt: Date.now() + HEALTH_CACHE_MS };
    return status;
  }).finally(() => {
    if (pending?.id === config.id) pending = undefined;
  });
  pending = { id: config.id, promise };
  return promise;
}
