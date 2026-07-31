import { fail, redirect } from '@sveltejs/kit';
import { isRateLimited } from '$lib/server/rateLimit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (user) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');

		if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
			return fail(400, { error: 'Email and password are required.' });
		}

		// Keyed by IP + email so one attacker can't lock out the real owner by
		// spamming failed logins against their email from a different IP.
		if (isRateLimited(`${getClientAddress()}:${email}`)) {
			return fail(429, { error: 'Too many attempts. Try again in a minute.' });
		}

		const { error } = await locals.supabase.auth.signInWithPassword({ email, password });

		if (error) {
			return fail(400, { error: 'Invalid email or password.' });
		}

		redirect(303, '/');
	}
};
