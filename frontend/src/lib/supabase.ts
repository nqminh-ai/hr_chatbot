import { createClient } from '@supabase/supabase-js';

export type SupabaseStatus = {
  configured: boolean;
  connected: boolean;
  ready?: boolean;
  error?: 'not_configured' | 'invalid_config' | 'health_unavailable';
};

// Check Supabase readiness: support RPC knowledge_health() with fallback to dataset_info / personas table
export async function checkSupabaseConnection(): Promise<SupabaseStatus> {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key || /placeholder|your-project-id/.test(url)) {
    return { configured: false, connected: false, error: 'not_configured' };
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return { configured: true, connected: false, error: 'invalid_config' };
    }
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // 1. Try RPC function knowledge_health() first
    try {
      const { data: rpcData, error: rpcError } = await client
        .rpc('knowledge_health')
        .abortSignal(AbortSignal.timeout(3000));
      if (!rpcError && typeof rpcData === 'boolean') {
        return { configured: true, connected: true, ready: rpcData };
      }
    } catch {
      // Proceed to fallback query
    }

    // 2. Fallback: query dataset_info or personas table directly
    const { data: datasetData, error: datasetError } = await client
      .from('dataset_info')
      .select('singleton')
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));

    if (!datasetError && datasetData && datasetData.length > 0) {
      return { configured: true, connected: true, ready: true };
    }

    const { data: personaData, error: personaError } = await client
      .from('personas')
      .select('user_id')
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));

    if (!personaError && personaData && personaData.length > 0) {
      return { configured: true, connected: true, ready: true };
    }

    return { configured: true, connected: false, error: 'health_unavailable' };
  } catch {
    return { configured: true, connected: false, error: 'health_unavailable' };
  }
}
