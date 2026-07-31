<script lang="ts">
	import NoteEditor from '$lib/components/NoteEditor.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.note.title} — NoteChelvyn</title></svelte:head>

{#key data.note.id}
	<NoteEditor note={data.note} />
{/key}
