<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>NoteChelvyn</title></svelte:head>

<main class="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
	<h1 class="text-2xl font-semibold tracking-tight">NoteChelvyn</h1>
	<p class="text-gray-500">
		{data.notes.length === 0
			? 'Create your first note to get started.'
			: 'Select a note from the sidebar, or create a new one.'}
	</p>
	<p class="text-sm text-gray-400">Signed in as {data.user?.email}</p>

	<form method="POST" action="/logout">
		<button type="submit" class="text-sm font-medium text-gray-700 underline hover:text-gray-900">
			Log out
		</button>
	</form>
</main>
