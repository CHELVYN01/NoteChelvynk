<!--
	The only component in the app permitted to use {@html}. The exemption is
	declared for this exact path in eslint.config.js — every other file that
	reaches for {@html} still fails lint, which is the point.

	It is safe here only because the string comes from renderMarkdown(), which
	pipes its input through DOMPurify before returning. Bypass that pipeline
	and pasting a snippet from the web becomes stored XSS on yourself.
-->
<script lang="ts">
	import { renderMarkdown } from '$lib/utils/markdown';

	let { content }: { content: string } = $props();

	// renderMarkdown() sanitizes before returning, so the string reaching
	// {@html} below has already had scripts and event handlers stripped.
	// Never bypass this and interpolate `content` directly.
	let html = $derived(renderMarkdown(content));
</script>

<div class="prose max-w-none prose-gray prose-pre:bg-gray-50 prose-pre:text-gray-800">
	{#if content.trim()}
		{@html html}
	{:else}
		<p class="text-gray-400">Nothing to preview yet.</p>
	{/if}
</div>
