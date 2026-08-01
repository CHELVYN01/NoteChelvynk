import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

marked.setOptions({
	// Treat a single newline as a line break. Notes are written like notes,
	// not like prose that gets reflowed — pressing Enter should show up.
	breaks: true,
	gfm: true
});

// Markdown permits raw HTML by design, so anything pasted from the web can
// carry a <script>, an onerror handler, or a javascript: URL straight into
// the preview. Sanitizing turns that back into inert markup — it must happen
// *after* marked() produces HTML and *before* the result reaches {@html},
// because at that point everything is already a string and nothing else in
// the pipeline distinguishes markup the user wrote from markup they pasted.
export function renderMarkdown(md: string): string {
	const html = marked.parse(md, { async: false });

	return DOMPurify.sanitize(html, {
		// target="_blank" on links, added by the hook below. DOMPurify strips
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

// Links in a note point outward. Opening them in the same tab loses the
// editor, and opening them without noopener hands the destination page a
// window.opener reference back into this app.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
	if (node.tagName === 'A' && node.hasAttribute('href')) {
		node.setAttribute('target', '_blank');
		node.setAttribute('rel', 'noopener noreferrer');
	}
});

// ts_headline() wraps matches in <b>...</b> (its default StartSel/StopSel)
// around plain-text content it extracted from the note — that text can still
// contain anything the user typed, so it needs the same sanitization as
// markdown, just with a much smaller allowlist since no other tag is expected.
export function sanitizeHeadline(html: string): string {
	return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['b'], ALLOWED_ATTR: [] });
}
