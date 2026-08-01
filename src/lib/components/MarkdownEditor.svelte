<script lang="ts">
	import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { markdown } from '@codemirror/lang-markdown';
	import { languages } from '@codemirror/language-data';
	import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
	import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
	import { untrack } from 'svelte';

	let {
		value = $bindable(),
		placeholder = 'Start writing…',
		onInput
	}: {
		value: string;
		placeholder?: string;
		onInput?: () => void;
	} = $props();

	let host: HTMLDivElement;

	// Deliberately NOT $state: nothing in the template renders `view`, and
	// making it reactive would drag it into the sync effect's dependencies,
	// which is half of how the typing loop below came about.
	let view: EditorView | undefined;

	// CodeMirror owns the DOM inside `host`, so it can only be constructed in
	// the browser — $effect never runs during SSR, which is exactly the window
	// we need.
	//
	// The initial document is read through untrack() so this effect depends on
	// nothing reactive and runs exactly once per mount. Without it, `doc: value`
	// makes every keystroke tear down and rebuild the whole editor.
	$effect(() => {
		const editor = new EditorView({
			parent: host,
			state: EditorState.create({
				doc: untrack(() => value),
				extensions: [
					history(),
					keymap.of([...defaultKeymap, ...historyKeymap]),
					// `languages` lets fenced code blocks load their own grammar
					// lazily, so ```ts inside a note gets highlighted too.
					markdown({ codeLanguages: languages }),
					syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
					cmPlaceholder(placeholder),
					EditorView.lineWrapping,
					EditorView.updateListener.of((update) => {
						if (!update.docChanged) return;
						value = update.state.doc.toString();
						onInput?.();
					}),
					theme
				]
			})
		});

		view = editor;
		return () => {
			editor.destroy();
			view = undefined;
		};
	});

	// The parent may replace `value` wholesale — unlocking a note swaps in the
	// content the server withheld until the PIN was verified — and that has to
	// reach the document. But typing *also* writes to `value`, via the update
	// listener above, so this effect must push edits in without treating the
	// user's own keystrokes as an external change.
	//
	// Two things keep those apart:
	//   - the equality check: after a keystroke `value` already matches the
	//     document, so there is nothing to do and we bail before dispatching.
	//   - untrack(): reading view.state would otherwise subscribe this effect
	//     to CodeMirror's own state. It would then re-run on the very dispatch
	//     it just made, overwrite the document mid-keystroke, and reset the
	//     cursor — which is exactly the "only one character survives" bug.
	$effect(() => {
		const next = value;

		untrack(() => {
			if (!view) return;

			const current = view.state.doc.toString();
			if (current === next) return;

			// A wholesale replacement can leave the old cursor beyond the end of
			// the new text, which CodeMirror rejects — pin the selection to a
			// position that is always valid.
			view.dispatch({
				changes: { from: 0, to: current.length, insert: next },
				selection: { anchor: Math.min(view.state.selection.main.anchor, next.length) }
			});
		});
	});

	const theme = EditorView.theme({
		'&': { fontSize: '1rem' },
		'&.cm-focused': { outline: 'none' },
		'.cm-content': {
			padding: '0',
			fontFamily: 'inherit',
			lineHeight: '1.7',
			caretColor: '#111827'
		},
		'.cm-line': { padding: '0' },
		'.cm-gutters': { display: 'none' },
		'.cm-placeholder': { color: '#9ca3af' }
	});
</script>

<div bind:this={host} class="cm-host h-full"></div>

<style>
	.cm-host :global(.cm-editor) {
		height: 100%;
	}

	.cm-host :global(.cm-scroller) {
		font-family: inherit;
		overflow: auto;
	}
</style>
