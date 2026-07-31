<script lang="ts">
	import LockIcon from '$lib/components/icons/LockIcon.svelte';

	let {
		title,
		onSubmit
	}: {
		title: string;
		onSubmit: (pin: string) => Promise<string | null>;
	} = $props();

	let pin = $state('');
	let error = $state<string | null>(null);
	let checking = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		checking = true;
		error = await onSubmit(pin);
		checking = false;
		if (error) pin = '';
	}
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
	<div class="text-gray-400 [&_svg]:size-8">
		<LockIcon />
	</div>
	<h1 class="text-xl font-semibold tracking-tight">{title}</h1>
	<p class="text-sm text-gray-500">This note is locked. Enter the PIN to open it.</p>

	<form onsubmit={handleSubmit} class="flex flex-col items-center gap-3">
		<input
			type="password"
			inputmode="numeric"
			bind:value={pin}
			placeholder="PIN"
			autofocus
			class="w-40 rounded-md border-gray-300 text-center tracking-widest shadow-sm focus:border-gray-500 focus:ring-gray-500"
		/>
		{#if error}
			<p class="text-sm text-red-600">{error}</p>
		{/if}
		<button
			type="submit"
			disabled={checking || pin.length === 0}
			class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
		>
			{checking ? 'Checking…' : 'Unlock'}
		</button>
	</form>
</main>
