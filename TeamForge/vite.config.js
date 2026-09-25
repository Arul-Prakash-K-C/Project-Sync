/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

/**
 * Every VITE_* value is inlined into the JavaScript that visitors download, so
 * a Supabase secret/service-role key there would hand out full database access.
 * Refuse to start rather than ship one.
 * @param {string} mode
 */
function assertBrowserSafeSupabaseKey(mode) {
	const key = (loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_ANON_KEY ?? '').trim();
	let jwtRole = '';
	if (key.split('.').length === 3) {
		try {
			jwtRole = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role ?? '';
		} catch {
			// not a JWT
		}
	}
	if (key.startsWith('sb_secret_') || jwtRole === 'service_role') {
		throw new Error(
			'VITE_SUPABASE_ANON_KEY holds a Supabase SECRET key, which would be published in the browser bundle.\n' +
				'Use the publishable key (sb_publishable_…) or the legacy "anon" key from Project Settings → API Keys.'
		);
	}
}

export default defineConfig(({ mode }) => {
	if (mode !== 'test') assertBrowserSafeSupabaseKey(mode);

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
				},

				// The app is a client-rendered SPA (all state lives in the browser or in
				// Supabase, never on a Node server), so it ships as static files with an
				// index.html fallback — deployable to any static host.
				adapter: adapter({ fallback: 'index.html' })
			})
		],
		test: {
			environment: 'jsdom',
			include: ['src/**/*.{test,spec}.{js,ts}', 'supabase/tests/**/*.test.ts'],
			// Unit tests always exercise local mode, whatever the developer's .env says.
			env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }
		}
	};
});
