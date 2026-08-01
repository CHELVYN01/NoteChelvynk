import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends, url }) => {
	depends('app:notes');
	depends('app:tags');

	if (!locals.user) {
		return { session: null, user: null, notes: [], tags: [], activeTagId: null };
	}

	const activeTagId = url.searchParams.get('tag');

	// Filtering through the join table via !inner keeps this to one query
	// instead of fetching matching note_tags first and re-querying by id.
	const notesQuery = activeTagId
		? locals.supabase
				.from('notes')
				.select('id, title, content, is_pinned, is_locked, updated_at, note_tags!inner(tag_id)')
				.eq('is_archived', false)
				.eq('note_tags.tag_id', activeTagId)
				.order('is_pinned', { ascending: false })
				.order('updated_at', { ascending: false })
		: locals.supabase
				.from('notes')
				.select('id, title, content, is_pinned, is_locked, updated_at')
				.eq('is_archived', false)
				.order('is_pinned', { ascending: false })
				.order('updated_at', { ascending: false });

	const [{ data: notes, error }, { data: tags, error: tagsError }] = await Promise.all([
		notesQuery,
		locals.supabase.from('tags').select('id, user_id, name, color, created_at').order('name')
	]);

	if (error) {
		console.error('failed to load notes list:', error);
	}
	if (tagsError) {
		console.error('failed to load tags:', tagsError);
	}

	// The sidebar snippet must never leak a locked note's content to the
	// client — the point of locking is that content isn't visible without
	// the PIN, and that has to hold even before the PIN check happens.
	const sanitized = (notes ?? []).map((note) => (note.is_locked ? { ...note, content: '' } : note));

	return {
		session: locals.session,
		user: locals.user,
		notes: sanitized,
		tags: tags ?? [],
		activeTagId
	};
};
