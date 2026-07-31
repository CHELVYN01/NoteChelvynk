<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import { debounce } from '$lib/utils/debounce';
	import PinGate from '$lib/components/PinGate.svelte';
	import LockIcon from '$lib/components/icons/LockIcon.svelte';
	import UnlockIcon from '$lib/components/icons/UnlockIcon.svelte';
	import TrashIcon from '$lib/components/icons/TrashIcon.svelte';
	import PinIcon from '$lib/components/icons/PinIcon.svelte';
	import type { Note } from '$lib/types';
	import type { ActionResult } from '@sveltejs/kit';

	let {
		note: initialNote
	}: {
		note: Pick<Note, 'id' | 'title' | 'content' | 'is_pinned' | 'is_locked'>;
	} = $props();

	// Parent wraps this component in {#key data.note.id}, so a note switch
	// remounts it instead of updating props in place — this only needs to
	// capture the initial value once per note.
	let note = $state(initialNote);
	let title = $state(initialNote.title);
	let content = $state(initialNote.content);
	let status: 'idle' | 'saving' | 'saved' | 'error' = $state('idle');
	let confirmingDelete = $state(false);
	let showLockForm = $state(false);
	let lockPin = $state('');
	let lockError = $state<string | null>(null);

	const unlockKey = `notechelvyn:unlocked:${note.id}`;
	// sessionStorage clears when the tab closes — an unlocked note doesn't
	// stay open across browser restarts, only within the current session.
	let isUnlocked = $state(!note.is_locked || sessionStorage.getItem(unlockKey) === 'true');

	async function save() {
		status = 'saving';

		// Snapshot title/content at call time — the debounce delay means the
		// user may have kept typing since this was scheduled, and reading
		// $state here (not from closed-over args) always gets the latest value.
		const res = await fetch(`?/update`, {
			method: 'POST',
			body: new URLSearchParams({ title, content })
		});

		status = res.ok ? 'saved' : 'error';
		if (res.ok) await invalidate('app:notes');
	}

	const scheduleSave = debounce(save, 800);

	function onInput() {
		status = 'idle';
		scheduleSave();
	}

	// A pending timer must not survive a note switch: {#key data.note.id}
	// remounts this component, but a setTimeout already in flight keeps
	// running regardless and would otherwise save stray edits into whatever
	// note happens to be open when the timer fires.
	$effect(() => {
		return () => scheduleSave.cancel();
	});

	async function togglePin() {
		await fetch('?/togglePin', {
			method: 'POST',
			body: new URLSearchParams({ is_pinned: String(note.is_pinned) })
		});
		note = { ...note, is_pinned: !note.is_pinned };
		await invalidate('app:notes');
	}

	async function deleteNote() {
		// SvelteKit form actions require a form-encoded body to route the
		// request correctly; a bodyless POST defaults to application/json
		// and gets rejected with 415 before it reaches the action.
		const res = await fetch('?/delete', { method: 'POST', body: new URLSearchParams() });
		if (res.ok) {
			window.location.href = '/';
		}
	}

	async function unlockWithPin(pin: string): Promise<string | null> {
		const res = await fetch('?/unlock', {
			method: 'POST',
			body: new URLSearchParams({ pin })
		});
		const result: ActionResult = deserialize(await res.text());

		if (result.type === 'failure') {
			return (result.data?.error as string | undefined) ?? 'Incorrect PIN.';
		}
		if (result.type !== 'success') {
			return 'Something went wrong.';
		}

		sessionStorage.setItem(unlockKey, 'true');
		isUnlocked = true;

		// load() withholds content for locked notes; the unlock action is the
		// only place the real content is ever sent to the client, so pull it
		// from here instead of re-fetching the page.
		const unlockedNote = result.data?.note as Pick<Note, 'title' | 'content'> | undefined;
		if (unlockedNote) {
			title = unlockedNote.title;
			content = unlockedNote.content;
		}

		return null;
	}

	async function submitLock(e: SubmitEvent) {
		e.preventDefault();
		lockError = null;

		const res = await fetch('?/lock', {
			method: 'POST',
			body: new URLSearchParams({ pin: lockPin })
		});
		const result: ActionResult = deserialize(await res.text());

		if (result.type === 'failure') {
			lockError = (result.data?.error as string | undefined) ?? 'Could not lock note.';
			return;
		}

		note = { ...note, is_locked: true };
		sessionStorage.setItem(unlockKey, 'true');
		showLockForm = false;
		lockPin = '';
		await invalidate('app:notes');
	}

	async function removeLock() {
		const pin = prompt('Enter the current PIN to remove the lock:');
		if (!pin) return;

		const res = await fetch('?/unlock', {
			method: 'POST',
			body: new URLSearchParams({ pin, remove: 'true' })
		});
		const result: ActionResult = deserialize(await res.text());

		if (result.type !== 'success') {
			alert('Incorrect PIN.');
			return;
		}

		note = { ...note, is_locked: false };
		sessionStorage.removeItem(unlockKey);
		await invalidate('app:notes');
	}
</script>

{#if !isUnlocked}
	<PinGate title={note.title} onSubmit={unlockWithPin} />
{:else}
	<main class="flex min-h-screen flex-col">
		<header class="grid grid-cols-3 items-center gap-4 border-b border-gray-200 px-6 py-3">
			<div class="text-sm text-gray-400">
				{#if status === 'error'}
					<span class="text-red-600">Could not save.</span>
				{:else if status === 'saving'}
					<span>Saving…</span>
				{:else if status === 'saved'}
					<span>Saved</span>
				{/if}
			</div>

			<div class="flex items-center justify-center gap-1">
				<button
					type="button"
					onclick={togglePin}
					class="rounded-md p-1.5 {note.is_pinned
						? 'text-amber-600'
						: 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}"
					title={note.is_pinned ? 'Unpin' : 'Pin'}
				>
					<PinIcon filled={note.is_pinned} />
				</button>

				{#if note.is_locked}
					<button
						type="button"
						onclick={removeLock}
						class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
						title="Remove lock"
					>
						<LockIcon />
					</button>
				{:else if showLockForm}
					<form onsubmit={submitLock} class="flex items-center gap-2">
						<input
							type="password"
							inputmode="numeric"
							bind:value={lockPin}
							placeholder="Set PIN"
							autofocus
							class="w-28 rounded-md border-gray-300 text-sm shadow-sm focus:border-gray-500 focus:ring-gray-500"
						/>
						<button type="submit" class="text-sm font-medium text-gray-900 hover:text-gray-700">
							Save
						</button>
						<button
							type="button"
							onclick={() => (showLockForm = false)}
							class="text-sm text-gray-500 hover:text-gray-900"
						>
							Cancel
						</button>
					</form>
					{#if lockError}
						<span class="text-sm text-red-600">{lockError}</span>
					{/if}
				{:else}
					<button
						type="button"
						onclick={() => (showLockForm = true)}
						class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
						title="Lock this note"
					>
						<UnlockIcon />
					</button>
				{/if}

				{#if confirmingDelete}
					<span class="ml-2 text-sm text-gray-600">Delete?</span>
					<button
						type="button"
						onclick={deleteNote}
						class="rounded-md px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
					>
						Confirm
					</button>
					<button
						type="button"
						class="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
						onclick={() => (confirmingDelete = false)}
					>
						Cancel
					</button>
				{:else}
					<button
						type="button"
						class="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
						title="Delete"
						onclick={() => (confirmingDelete = true)}
					>
						<TrashIcon />
					</button>
				{/if}
			</div>

			<div></div>
		</header>

		<div class="flex flex-1 flex-col gap-4 px-6 py-4">
			<input
				type="text"
				bind:value={title}
				oninput={onInput}
				onkeydown={(e) => e.key === 'Enter' && e.preventDefault()}
				placeholder="Untitled"
				class="border-none p-0 text-2xl font-semibold tracking-tight focus:ring-0"
			/>
			<textarea
				bind:value={content}
				oninput={onInput}
				placeholder="Start writing…"
				class="min-h-[60vh] flex-1 resize-none border-none p-0 text-base leading-relaxed focus:ring-0"
			></textarea>
		</div>
	</main>
{/if}
