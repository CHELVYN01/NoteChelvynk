import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

// This config passes options directly to the sveltekit() plugin rather than
// a separate svelte.config.js — SvelteKit 2.62+ reads config from whichever
// one is used first, and ignores the other (with a warning) if both exist.
//
// vite.config.ts runs outside SvelteKit's module graph, so $env/static/public
// isn't reachable here — loadEnv(mode, ...) is Vite's own equivalent, and
// needs the Vite `mode` from defineConfig's callback form, not NODE_ENV
// (which Vite doesn't set and isn't guaranteed to match `mode` anyway).
export default defineConfig(({ mode }) => {
	const { PUBLIC_SUPABASE_URL } = loadEnv(mode, process.cwd(), '');

	// The CSP directive type wants a template-literal-typed host source
	// matching a specific scheme/host/port grammar, which TypeScript can't
	// verify for a value that only exists at build/run time as a plain env
	// string — even though a Supabase project URL (https://xxx.supabase.co)
	// always matches that grammar.
	const supabaseHostSource = PUBLIC_SUPABASE_URL as unknown as `${string}.${string}`;

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				adapter: adapter(),
				csp: {
					directives: {
						'default-src': ['self'],
						// mode: 'auto' means SvelteKit stamps its own inline hydration
						// script with a nonce or hash per request, so 'script-src' can
						// stay nonce/hash-only instead of needing 'unsafe-inline'.
						'script-src': ['self'],
						'style-src': ['self', 'unsafe-inline'],
						'img-src': ['self', 'data:'],
						'connect-src': ['self', supabaseHostSource],
						'base-uri': ['self'],
						'form-action': ['self'],
						'frame-ancestors': ['none']
					}
				}
			})
		]
	};
});
