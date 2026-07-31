import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('app:notes');

	if (!locals.user) {
		return { session: null, user: null, notes: [] };
	}

	const { data: notes, error } = await locals.supabase
		.from('notes')
		.select('id, title, content, is_pinned, is_locked, updated_at')
		.eq('is_archived', false)
		.order('is_pinned', { ascending: false })
		.order('updated_at', { ascending: false });

	if (error) {
		console.error('failed to load notes list:', error);
	}

	// The sidebar snippet must never leak a locked note's content to the
	// client — the point of locking is that content isn't visible without
	// the PIN, and that has to hold even before the PIN check happens.
	const sanitized = (notes ?? []).map((note) => (note.is_locked ? { ...note, content: '' } : note));

	return {
		session: locals.session,
		user: locals.user,
		notes: sanitized
	};
};
