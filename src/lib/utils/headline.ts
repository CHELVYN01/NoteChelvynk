// search_notes_headline() (Postgres ts_headline) wraps matched words in
// literal <b>...</b> around plain-text note content — content the user
// typed, which can contain anything including '<script>' as literal text.
// This needs the same rule as markdown.ts: sanitize before {@html}. It's
// kept out of markdown.ts and off DOMPurify/jsdom on purpose — jsdom is
// server-rendered wherever Sidebar.svelte appears (the root layout, so
// every route), and pulling in jsdom just for a single-tag allowlist is
// what dragged an unrelated jsdom/Vercel ESM bug into routes that never
// touch markdown at all. Escaping everything and then only reinstating
// the exact <b>/</b> pair ts_headline emits gets the same guarantee
// without a DOM parser.
export function sanitizeHeadline(html: string): string {
	const escaped = html.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

	return escaped.replaceAll('&lt;b&gt;', '<b>').replaceAll('&lt;/b&gt;', '</b>');
}
