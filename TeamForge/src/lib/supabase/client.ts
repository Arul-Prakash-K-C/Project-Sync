import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from './config';

/*
  The SDK is only ever loaded through a dynamic import: a local-mode build never
  downloads it, and a cloud-mode build fetches it after first paint.
*/
let pending: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  pending ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'teamforge_supabase_auth' },
      realtime: { params: { eventsPerSecond: 20 } }
    })
  );
  return pending;
}
