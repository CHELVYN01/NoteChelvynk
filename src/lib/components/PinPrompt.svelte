<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import LockIcon from '$lib/components/icons/LockIcon.svelte';

	let {
		heading,
		description,
		submitLabel,
		onSubmit,
		onClose
	}: {
		heading: string;
		description: string;
		submitLabel: string;
		onSubmit: (pin: string) => Promise<string | null>;
		onClose: () => void;
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

<Modal {onClose}>
	<div class="flex flex-col items-center gap-4 text-center">
		<div class="text-gray-400 [&_svg]:size-8">
			<LockIcon />
		</div>
		<h1 class="text-lg font-semibold tracking-tight">{heading}</h1>
		<p class="text-sm text-gray-500">{description}</p>

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
			<div class="flex gap-2">
				<button
					type="button"
					onclick={onClose}
					class="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={checking || pin.length === 0}
					class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
				>
					{checking ? 'Checking…' : submitLabel}
				</button>
			</div>
		</form>
	</div>
</Modal>
