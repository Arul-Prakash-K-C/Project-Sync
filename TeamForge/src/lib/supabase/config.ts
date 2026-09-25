/**
 * Supabase is opt-in. With no `VITE_SUPABASE_*` variables the app runs in local
 * mode — every collection lives in this browser's localStorage, exactly as the
 * demo always has. Fill in `.env` (see `.env.example`) and the same build runs
 * in cloud mode against Supabase Auth, Postgres, Storage and Realtime.
 */
const env = import.meta.env;

export const supabaseConfig = {
  url: env.VITE_SUPABASE_URL ?? '',
  /** The project's anon / publishable key. Safe in the browser: RLS guards the data. */
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? ''
};

export const isCloudMode = Boolean(supabaseConfig.url && supabaseConfig.anonKey);

export const cloudOptions = {
  /** Seed the demo projects/users and let the demo accounts self-provision. */
  seedDemo: env.VITE_SUPABASE_SEED_DEMO === 'true'
};

/** Storage bucket for project file bytes (created by the migration). */
export const FILES_BUCKET = 'project-files';

/** Demo accounts shipped with the seed data; they share this password. */
export const DEMO_PASSWORD = 'demo1234';
