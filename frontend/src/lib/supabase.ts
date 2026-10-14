import { createClient } from '@supabase/supabase-js';

export type SupabaseStatus = {
  configured: boolean; connected: boolean; ready?: boolean;
  error?: 'not_configured' | 'invalid_config' | 'health_unavailable';
};

// The connection probe exposes only readiness, never corpus or persona rows.
export async function checkSupabaseConnection(): Promise<SupabaseStatus> {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key || /placeholder|your-project-id/.test(url)) return { configured: false, connected: false, error: 'not_configured' };
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return { configured: true, connected: false, error: 'invalid_config' };
    }
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await client.rpc('knowledge_health').abortSignal(AbortSignal.timeout(5000));
    if (error || typeof data !== 'boolean') return { configured: true, connected: false, error: 'health_unavailable' };
    return { configured: true, connected: true, ready: data };
  } catch {
    return { configured: true, connected: false, error: 'health_unavailable' };
  }
}
