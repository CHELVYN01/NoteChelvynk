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

<div
	class="fixed inset-y-0 right-0 left-72 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
>
	<div
		role="dialog"
		aria-modal="true"
		class="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
	>
		{@render children()}
	</div>
</div>
