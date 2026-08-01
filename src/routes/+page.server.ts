import { error, fail, redirect } from '@sveltejs/kit';
import { isTagColor } from '$lib/utils/tagColors';
import type { Actions } from './$types';

const MAX_TAG_NAME_LENGTH = 40;

export const actions: Actions = {
	create: async ({ locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(401);

		const { data, error: dbError } = await locals.supabase
			.from('notes')
			.insert({ user_id: user.id })
			.select('id')
			.single();

		if (dbError || !data) {
			console.error('failed to create note:', dbError);
			error(500, 'Could not create note.');
		}

		redirect(303, `/note/${data.id}`);
	},

	createTag: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(401);

		const formData = await request.formData();
		const name = formData.get('name');
		const color = formData.get('color');

		if (typeof name !== 'string' || typeof color !== 'string') {
			return fail(400, { error: 'Invalid form data.' });
		}
		const trimmed = name.trim();
		if (trimmed.length === 0 || trimmed.length > MAX_TAG_NAME_LENGTH) {
			return fail(400, { error: `Tag name must be 1-${MAX_TAG_NAME_LENGTH} characters.` });
		}
		if (!isTagColor(color)) {
			return fail(400, { error: 'Invalid tag color.' });
		}

		const { data, error: dbError } = await locals.supabase
			.from('tags')
			.insert({ user_id: user.id, name: trimmed, color })
			.select('id, user_id, name, color, created_at')
			.single();

		if (dbError) {
			// unique(user_id, name)
			if (dbError.code === '23505') {
				return fail(409, { error: 'A tag with this name already exists.' });
			}
			console.error('failed to create tag:', dbError);
			return fail(500, { error: 'Could not create tag.' });
		}

		return { tag: data };
	},

	renameTag: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(401);

		const formData = await request.formData();
		const tagId = formData.get('tag_id');
		const name = formData.get('name');

		if (typeof tagId !== 'string' || typeof name !== 'string') {
			return fail(400, { error: 'Invalid form data.' });
		}
		const trimmed = name.trim();
		if (trimmed.length === 0 || trimmed.length > MAX_TAG_NAME_LENGTH) {
			return fail(400, { error: `Tag name must be 1-${MAX_TAG_NAME_LENGTH} characters.` });
		}

		const { error: dbError } = await locals.supabase
			.from('tags')
			.update({ name: trimmed })
			.eq('id', tagId)
			.eq('user_id', user.id);

		if (dbError) {
			if (dbError.code === '23505') {
				return fail(409, { error: 'A tag with this name already exists.' });
			}
			console.error('failed to rename tag:', dbError);
			return fail(500, { error: 'Could not rename tag.' });
		}

		return { success: true };
	},

	deleteTag: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(401);

		const formData = await request.formData();
		const tagId = formData.get('tag_id');

		if (typeof tagId !== 'string') {
			return fail(400, { error: 'Invalid form data.' });
		}

		// note_tags rows for this tag are removed by the FK's own cascade.
		const { error: dbError } = await locals.supabase
			.from('tags')
			.delete()
			.eq('id', tagId)
			.eq('user_id', user.id);

		if (dbError) {
			console.error('failed to delete tag:', dbError);
			return fail(500, { error: 'Could not delete tag.' });
		}

		return { success: true };
	}
};
