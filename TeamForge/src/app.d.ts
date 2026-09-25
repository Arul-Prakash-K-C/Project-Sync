// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {}

	interface ImportMetaEnv {
		readonly VITE_SUPABASE_URL?: string;
		readonly VITE_SUPABASE_ANON_KEY?: string;
		readonly VITE_SUPABASE_SEED_DEMO?: string;
	}
}

export {};
