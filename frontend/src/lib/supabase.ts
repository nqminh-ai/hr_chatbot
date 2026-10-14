import { createClient } from '@supabase/supabase-js';

// Strip any accidental trailing /rest/v1 or trailing slashes
function sanitizeSupabaseUrl(url: string | undefined): string {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabaseUrl = sanitizeSupabaseUrl(rawUrl);
export const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('your-project-id')
);

// Fallback-safe client instance
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Function to check live connection to Supabase
export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  tableCount?: number;
  error?: string;
}> {
  if (!supabase) {
    return { connected: false, error: 'Chưa cấu hình Supabase URL hoặc Key' };
  }
  try {
    const { data, error } = await supabase.from('personas').select('user_id').limit(10);
    if (error) {
      return { connected: false, error: error.message };
    }
    return { connected: true, tableCount: data?.length || 0 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { connected: false, error: message };
  }
}
