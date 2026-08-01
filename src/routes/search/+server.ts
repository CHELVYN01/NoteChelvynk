import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SearchResult } from '$lib/types';

const MAX_QUERY_LENGTH = 200;

export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401);

	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length === 0) {
		return json([]);
	}
	if (q.length > MAX_QUERY_LENGTH) {
		error(400, 'Search query is too long.');
	}

	const { data, error: dbError } = await locals.supabase.rpc('search_notes_headline', {
		search_query: q
	});

	if (dbError) {
		console.error('search failed:', dbError);
		error(500, 'Search failed.');
	}

	// The RPC runs with security invoker (RLS still applies), but it doesn't
	// know about the lock feature's own extra rule: a locked note's content
	// must never leave the server unless it was just verified with a PIN —
	// that includes the snippet ts_headline extracts from content.
	const results: SearchResult[] = (data ?? []).map((row: SearchResult) =>
		row.is_locked ? { ...row, snippet: '' } : row
	);

	return json(results);
};
