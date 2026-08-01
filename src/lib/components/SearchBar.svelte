<script lang="ts">
	import { debounce } from '$lib/utils/debounce';
	import type { SearchResult } from '$lib/types';

	let {
		onResults
	}: {
		onResults: (results: SearchResult[] | null) => void;
	} = $props();

	let query = $state('');
	let searching = $state(false);

	async function runSearch(q: string) {
		if (q.trim().length === 0) {
			onResults(null);
			return;
		}

		searching = true;
		const res = await fetch(`/search?q=${encodeURIComponent(q)}`);
		searching = false;

		if (!res.ok) {
			onResults([]);
			return;
		}
		const results: SearchResult[] = await res.json();
		onResults(results);
	}

	const scheduleSearch = debounce(runSearch, 300);

	function onInput() {
		scheduleSearch(query);
	}

	// A pending search must not fire after this component is gone — same
	// reasoning as the auto-save timer cleanup in NoteEditor.
	$effect(() => {
		return () => scheduleSearch.cancel();
	});
</script>

<div class="px-4 py-3">
	<input
		type="search"
		bind:value={query}
		oninput={onInput}
		placeholder="Search notes…"
		class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-gray-500 focus:ring-gray-500"
	/>
	{#if searching}
		<p class="mt-1 text-xs text-gray-400">Searching…</p>
	{/if}
</div>
