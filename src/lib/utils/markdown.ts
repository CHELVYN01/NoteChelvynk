import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { browser } from '$app/environment';

marked.setOptions({
	// Treat a single newline as a line break. Notes are written like notes,
	// not like prose that gets reflowed — pressing Enter should show up.
	breaks: true,
	gfm: true
});

// Links in a note point outward. Opening them in the same tab loses the
// editor, and opening them without noopener hands the destination page a
// window.opener reference back into this app.
//
// Only registered in the browser: DOMPurify's default export auto-inits
// itself against `window` at import time, and addHook touches that same
// instance — calling it during SSR (no window) would run against whatever
// no-op/degraded instance that import produced there, for no benefit since
// renderMarkdown() never actually sanitizes anything server-side (below).
if (browser) {
	DOMPurify.addHook('afterSanitizeAttributes', (node) => {
		if (node.tagName === 'A' && node.hasAttribute('href')) {
			node.setAttribute('target', '_blank');
			node.setAttribute('rel', 'noopener noreferrer');
		}
	});
}

// Markdown permits raw HTML by design, so anything pasted from the web can
// carry a <script>, an onerror handler, or a javascript: URL straight into
// the preview. Sanitizing turns that back into inert markup — it must happen
// *after* marked() produces HTML and *before* the result reaches {@html},
// because at that point everything is already a string and nothing else in
// the pipeline distinguishes markup the user wrote from markup they pasted.
//
// This only runs in the browser, where DOMPurify has a real `window` to
// operate against. There's no safe general-purpose HTML sanitizer for
// Node.js without a DOM implementation, and every DOM-in-Node option tried
// here (jsdom, jsdom+patched versions, linkedom) either doesn't work in
// Vercel's serverless runtime or doesn't implement enough of the DOM API
// DOMPurify needs — see the phase 7 notes in PLAN.md for what was tried.
// Server-side render of a note's markdown preview is deliberately skipped
// rather than emitting unsanitized HTML: MarkdownPreview.svelte shows a
// loading state until this runs after hydration.
export function renderMarkdown(md: string): string | null {
	if (!browser) return null;

	const html = marked.parse(md, { async: false });

	return DOMPurify.sanitize(html, {
		// target="_blank" on links, added by the hook above. DOMPurify strips
		// target by default since it can be abused for tabnabbing; that risk is
		// answered by the rel attribute set alongside it.
		ADD_ATTR: ['target'],

		// DOMPurify's defaults are tuned for rendering arbitrary rich text, so
		// they permit a few things that are harmless there but pointless here.
		// A note never needs them, and each one is a foothold:
		//
		//   form/input/button/select/textarea — a note that renders a working
		//     form can post wherever it likes. Pasting a convincing-looking
		//     login box that submits to someone else's server is a phishing
		//     primitive, and no note has a legitimate reason to contain one.
		//
		//   style — kept by default because browsers ignore javascript: in CSS
		//     now, so it isn't script execution. It is still enough to build a
		//     clickjacking overlay (position/opacity/z-index) on top of the
		//     app's own controls, which is worth more than inline styling in
		//     notes is worth keeping.
		FORBID_TAGS: ['form', 'input', 'button', 'select', 'option', 'textarea'],
		FORBID_ATTR: ['style']
	});
}
