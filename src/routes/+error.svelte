<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let title = $derived(page.status === 404 ? 'Note not found' : 'Something went wrong');
	let message = $derived(
		page.status === 404
			? "This note doesn't exist, or it's not yours."
			: (page.error?.message ?? 'An unexpected error occurred.')
	);
</script>

<svelte:head><title>{page.status} — NoteChelvyn</title></svelte:head>

<main class="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
	<p class="text-sm font-medium tracking-widest text-gray-400 uppercase">{page.status}</p>
	<h1 class="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
	<p class="max-w-sm text-sm text-gray-500">{message}</p>
	<a
		href={resolve('/')}
		class="mt-3 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
	>
		Back to notes
	</a>
</main>
