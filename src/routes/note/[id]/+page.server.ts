import { error, fail, redirect } from '@sveltejs/kit';
import { hashPin, verifyPin } from '$lib/server/pin';
import type { Actions, PageServerLoad } from './$types';

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 200_000;
const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 12;

export const load: PageServerLoad = async ({ params, locals }) => {
	const { data: note, error: dbError } = await locals.supabase
		.from('notes')
		.select('id, title, content, is_pinned, is_archived, is_locked, created_at, updated_at')
		.eq('id', params.id)
		.eq('is_archived', false)
		.single();

	// RLS already scopes this to the caller's own rows; a missing row and a
	// row owned by someone else look identical here, which is the point —
	// don't leak which case it was.
	if (dbError || !note) {
		error(404, 'Note not found.');
	}

	// The server doesn't know whether the client already unlocked this note
	// in a previous page load (that state lives in sessionStorage, not a
	// cookie) — so content is withheld here regardless, and only handed
	// over via the unlock action once the PIN is verified for this request.
	if (note.is_locked) {
		return { note: { ...note, content: '' } };
	}

	return { note };
};

export const actions: Actions = {
	update: async ({ params, request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(401);

		const formData = await request.formData();
		const title = formData.get('title');
		const content = formData.get('content');

		if (typeof title !== 'string' || typeof content !== 'string') {
			return fail(400, { error: 'Invalid form data.' });
		}
		if (title.length > MAX_TITLE_LENGTH) {
			return fail(400, { error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` });
		}
		if (content.length > MAX_CONTENT_LENGTH) {
			return fail(400, { error: 'Content is too long.' });
		}

		const { error: dbError } = await locals.supabase
			.from('notes')
			.update({ title: title.trim() || 'Untitled', content })
			.eq('id', params.id)
			.eq('user_id', user.id);

		if (dbError) {
			console.error('failed to update note:', dbError);
			return fail(500, { error: 'Could not save note.' });
		}

		return { success: true };
	},

	togglePin: async ({ params, request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(401);

		const formData = await request.formData();
		const isPinned = formData.get('is_pinned') === 'true';

		const { error: dbError } = await locals.supabase
			.from('notes')
			.update({ is_pinned: !isPinned })
			.eq('id', params.id)
			.eq('user_id', user.id);

		if (dbError) {
			console.error('failed to toggle pin:', dbError);
			return fail(500, { error: 'Could not update note.' });
		}

		return { success: true };
	},

	delete: async ({ params, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(401);

		const { error: dbError } = await locals.supabase
			.from('notes')
			.update({ is_archived: true })
			.eq('id', params.id)
			.eq('user_id', user.id);

		if (dbError) {
			console.error('failed to archive note:', dbError);
			return fail(500, { error: 'Could not delete note.' });
		}

		redirect(303, '/');
	},

	lock: async ({ params, request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(401);

		const formData = await request.formData();
		const pin = formData.get('pin');

		if (typeof pin !== 'string' || pin.length < MIN_PIN_LENGTH || pin.length > MAX_PIN_LENGTH) {
			return fail(400, { error: `PIN must be ${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} characters.` });
		}

		const { error: dbError } = await locals.supabase
			.from('notes')
			.update({ is_locked: true, pin_hash: hashPin(pin) })
			.eq('id', params.id)
			.eq('user_id', user.id);

		if (dbError) {
			console.error('failed to lock note:', dbError);
			return fail(500, { error: 'Could not lock note.' });
		}

		return { locked: true };
	},

	unlock: async ({ params, request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(401);

		const formData = await request.formData();
		const pin = formData.get('pin');
		const removeLock = formData.get('remove') === 'true';

		if (typeof pin !== 'string') {
			return fail(400, { error: 'PIN is required.' });
		}

		const { data: note, error: dbError } = await locals.supabase
			.from('notes')
			.select('id, title, content, is_pinned, is_archived, is_locked, pin_hash, updated_at')
			.eq('id', params.id)
			.eq('user_id', user.id)
			.single();

		if (dbError || !note || !note.pin_hash) {
			return fail(404, { error: 'Note not found.' });
		}

		if (!verifyPin(pin, note.pin_hash)) {
			return fail(401, { error: 'Incorrect PIN.' });
		}

		if (removeLock) {
			const { error: updateError } = await locals.supabase
				.from('notes')
				.update({ is_locked: false, pin_hash: null })
				.eq('id', params.id)
				.eq('user_id', user.id);

			if (updateError) {
				console.error('failed to remove lock:', updateError);
				return fail(500, { error: 'Could not remove lock.' });
			}

			return { note: { ...note, is_locked: false, pin_hash: null } };
		}

		return { note };
	}
};
