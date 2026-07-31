<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Log in — NoteChelvyn</title></svelte:head>

<main class="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">NoteChelvyn</h1>
		<p class="text-sm text-gray-500">Sign in to your notebook.</p>
	</div>

	<form
		method="POST"
		class="flex flex-col gap-4"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		{#if form?.error}
			<p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
		{/if}

		<div class="flex flex-col gap-1">
			<label for="email" class="text-sm font-medium text-gray-700">Email</label>
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				required
				class="rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
			/>
		</div>

		<div class="flex flex-col gap-1">
			<label for="password" class="text-sm font-medium text-gray-700">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				class="rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
			/>
		</div>

		<button
			type="submit"
			disabled={submitting}
			class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
		>
			{submitting ? 'Signing in…' : 'Sign in'}
		</button>
	</form>
</main>
