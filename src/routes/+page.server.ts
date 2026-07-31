import { error, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

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
	}
};
