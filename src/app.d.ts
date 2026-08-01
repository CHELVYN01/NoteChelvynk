// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Note, Tag } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			/**
			 * Returns the session only after verifying the JWT with the auth server.
			 * Never trust `supabase.auth.getSession()` on the server: it reads the
			 * cookie without validating its signature, so a forged cookie passes.
			 */
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session: Session | null;
			user: User | null;
		}
		interface PageData {
			session: Session | null;
			user: User | null;
			notes: Pick<Note, 'id' | 'title' | 'content' | 'is_pinned' | 'is_locked' | 'updated_at'>[];
			tags: Tag[];
			activeTagId: string | null;
		}
		// interface Error {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
