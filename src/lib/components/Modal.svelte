<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		onClose,
		children
	}: {
		onClose?: () => void;
		children: Snippet;
	} = $props();

	function onBackdropKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose?.();
	}
</script>

<svelte:window onkeydown={onBackdropKeydown} />

<!-- left-72 on sm+ keeps the modal centered over the note pane rather than the
     whole viewport, since the sidebar sits to its left there; below sm the
     sidebar and note view aren't shown side by side, so it spans full width. -->
<div
	class="fixed inset-y-0 right-0 left-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm sm:left-72"
>
	<div
		role="dialog"
		aria-modal="true"
		class="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
	>
		{@render children()}
	</div>
</div>
