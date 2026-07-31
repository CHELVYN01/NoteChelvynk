<script lang="ts">
	import type { PageData } from './$types';

	// Placeholder shell. Replaced by the note list in phase 3.
	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>NoteChelvyn</title></svelte:head>

<main class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-3 px-6">
	<h1 class="text-3xl font-semibold tracking-tight">NoteChelvyn</h1>
	<p class="text-gray-600">A private notebook that stays in sync across machines.</p>
	<p class="text-sm text-gray-400">Signed in as {data.user?.email}. Notes land in phase 3.</p>

	<form method="POST" action="/logout">
		<button type="submit" class="text-sm font-medium text-gray-700 underline hover:text-gray-900">
			Log out
		</button>
	</form>
</main>
