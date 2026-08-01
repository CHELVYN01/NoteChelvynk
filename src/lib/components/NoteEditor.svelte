<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import { debounce } from '$lib/utils/debounce';
	import PinGate from '$lib/components/PinGate.svelte';
	import PinPrompt from '$lib/components/PinPrompt.svelte';
	import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
	import MarkdownPreview from '$lib/components/MarkdownPreview.svelte';
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
	let showLockPrompt = $state(false);
	let showRemoveLockPrompt = $state(false);

	// On wide screens 'split' shows both panes; on narrow screens the same
	// three values act as tabs, with 'split' falling back to editor-only.
	type ViewMode = 'edit' | 'split' | 'preview';
	const viewModeKey = 'notechelvyn:viewMode';
	let viewMode: ViewMode = $state('split');

	// localStorage is browser-only, and this component renders on the server
	// first — read the stored preference after hydration instead.
	$effect(() => {
		const stored = localStorage.getItem(viewModeKey);
		if (stored === 'edit' || stored === 'split' || stored === 'preview') {
			viewMode = stored;
		}
	});

	function setViewMode(mode: ViewMode) {
		viewMode = mode;
		localStorage.setItem(viewModeKey, mode);
	}

	const viewModes: { value: ViewMode; label: string; title: string }[] = [
		{ value: 'edit', label: 'Edit', title: 'Editor only' },
		{ value: 'split', label: 'Split', title: 'Editor and preview side by side' },
		{ value: 'preview', label: 'Preview', title: 'Preview only' }
	];

	// Side-by-side needs room. Below Tailwind's `sm` breakpoint the two panes
	// become tabs, so 'split' has to resolve to one of them — CSS alone can't
	// do it because both panes would still be mounted and CodeMirror would be
	// measuring a hidden element.
	let isWide = $state(true);

	$effect(() => {
		const query = window.matchMedia('(min-width: 640px)');
		isWide = query.matches;

		const onChange = (e: MediaQueryListEvent) => (isWide = e.matches);
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	});

	let effectiveMode = $derived<ViewMode>(viewMode === 'split' && !isWide ? 'edit' : viewMode);
	let showEditor = $derived(effectiveMode !== 'preview');
	let showPreview = $derived(effectiveMode !== 'edit');

	const unlockKey = `notechelvyn:unlocked:${note.id}`;
	// sessionStorage only exists in the browser — this component renders on
	// the server first (SSR), where `sessionStorage` is undefined and would
	// throw. Locked notes always start gated there; the client re-evaluates
	// after hydration if a real session flag says otherwise.
	let isUnlocked = $state(
		!note.is_locked ||
			(typeof window !== 'undefined' && sessionStorage.getItem(unlockKey) === 'true')
	);

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

	async function lockWithPin(pin: string): Promise<string | null> {
		const res = await fetch('?/lock', {
			method: 'POST',
			body: new URLSearchParams({ pin })
		});
		const result: ActionResult = deserialize(await res.text());

		if (result.type === 'failure') {
			return (result.data?.error as string | undefined) ?? 'Could not lock note.';
		}

		// Locking is immediate and strict: even the person who just set the
		// PIN has to re-enter it, same as reopening from the sidebar cold.
		note = { ...note, is_locked: true };
		sessionStorage.removeItem(unlockKey);
		isUnlocked = false;
		showLockPrompt = false;
		await invalidate('app:notes');
		return null;
	}

	async function removeLockWithPin(pin: string): Promise<string | null> {
		const res = await fetch('?/unlock', {
			method: 'POST',
			body: new URLSearchParams({ pin, remove: 'true' })
		});
		const result: ActionResult = deserialize(await res.text());

		if (result.type !== 'success') {
			return 'Incorrect PIN.';
		}

		note = { ...note, is_locked: false };
		sessionStorage.removeItem(unlockKey);
		showRemoveLockPrompt = false;
		await invalidate('app:notes');
		return null;
	}
</script>

{#if note.is_locked && !isUnlocked}
	<!-- Locked content is never sent to the client, so there's nothing real
	     to show behind the gate — just the header chrome, blurred by the
	     modal's own backdrop. -->
	<main class="flex min-h-screen flex-col">
		<header class="border-b border-gray-200 px-6 py-3">
			<span class="text-lg font-semibold tracking-tight text-gray-300">{note.title}</span>
		</header>
	</main>
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
						onclick={() => (showRemoveLockPrompt = true)}
						class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
						title="Remove lock"
					>
						<LockIcon />
					</button>
				{:else}
					<button
						type="button"
						onclick={() => (showLockPrompt = true)}
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

			<div class="flex justify-end">
				<div class="inline-flex rounded-md border border-gray-200 p-0.5 text-sm">
					{#each viewModes as mode (mode.value)}
						<button
							type="button"
							onclick={() => setViewMode(mode.value)}
							class="rounded px-2.5 py-1 {mode.value === 'split'
								? 'hidden sm:block'
								: ''} {viewMode === mode.value
								? 'bg-gray-100 font-medium text-gray-900'
								: 'text-gray-500 hover:text-gray-800'}"
							title={mode.title}
						>
							{mode.label}
						</button>
					{/each}
				</div>
			</div>
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

			<div class="flex min-h-[60vh] flex-1 gap-6">
				{#if showEditor}
					<div class="min-w-0 flex-1">
						<MarkdownEditor bind:value={content} {onInput} />
					</div>
				{/if}

				{#if showPreview}
					<!-- The divider only makes sense when both panes are visible. -->
					<div
						class="min-w-0 flex-1 overflow-y-auto {showEditor
							? 'border-l border-gray-200 pl-6'
							: ''}"
					>
						<MarkdownPreview {content} />
					</div>
				{/if}
			</div>
		</div>
	</main>

	{#if showLockPrompt}
		<PinPrompt
			heading="Lock this note"
			description="Choose a 4–12 character PIN to lock this note."
			submitLabel="Lock"
			onSubmit={lockWithPin}
			onClose={() => (showLockPrompt = false)}
		/>
	{/if}

	{#if showRemoveLockPrompt}
		<PinPrompt
			heading="Remove lock"
			description="Enter the current PIN to remove the lock."
			submitLabel="Remove"
			onSubmit={removeLockWithPin}
			onClose={() => (showRemoveLockPrompt = false)}
		/>
	{/if}
{/if}
