<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import { page } from '$app/state';
	import { debounce } from '$lib/utils/debounce';
	import { saveDraft, loadDraft, clearDraft } from '$lib/utils/draft';
	import Modal from '$lib/components/Modal.svelte';
	import PinGate from '$lib/components/PinGate.svelte';
	import PinPrompt from '$lib/components/PinPrompt.svelte';
	import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
	import MarkdownPreview from '$lib/components/MarkdownPreview.svelte';
	import TagPicker from '$lib/components/TagPicker.svelte';
	import LockIcon from '$lib/components/icons/LockIcon.svelte';
	import UnlockIcon from '$lib/components/icons/UnlockIcon.svelte';
	import TrashIcon from '$lib/components/icons/TrashIcon.svelte';
	import PinIcon from '$lib/components/icons/PinIcon.svelte';
	import type { Note, Tag } from '$lib/types';
	import type { ActionResult } from '@sveltejs/kit';

	type EditableNote = Pick<
		Note,
		'id' | 'title' | 'content' | 'is_pinned' | 'is_locked' | 'updated_at'
	> & {
		tags: Pick<Tag, 'id' | 'name' | 'color'>[];
	};

	// note.tags is read where it's passed into TagPicker's noteTags prop below;
	// the rule below doesn't trace usage that flows into a child component's
	// prop expression, so it misreports the field as unused.
	// eslint-disable-next-line svelte/no-unused-props -- false positive, see above
	let { note: initialNote }: { note: EditableNote } = $props();

	// Parent wraps this component in {#key data.note.id}, so a note switch
	// remounts it instead of updating props in place — this only needs to
	// capture the initial value once per note.
	let note = $state(initialNote);
	let title = $state(initialNote.title);
	let content = $state(initialNote.content);
	// The updated_at this client last confirmed with the server — sent back on
	// the next save so the server can tell if another device wrote in between.
	let knownUpdatedAt = $state(initialNote.updated_at);
	let status: 'idle' | 'saving' | 'saved' | 'error' | 'offline' = $state('idle');
	let confirmingDelete = $state(false);
	let showLockPrompt = $state(false);
	let showRemoveLockPrompt = $state(false);
	let conflict = $state<{ serverUpdatedAt: string } | null>(null);
	let restorableDraft = $state<{ title: string; content: string; savedAt: string } | null>(null);

	const unlockKey = `notechelvyn:unlocked:${note.id}`;
	// sessionStorage only exists in the browser — this component renders on
	// the server first (SSR), where `sessionStorage` is undefined and would
	// throw. Locked notes always start gated there; the client re-evaluates
	// after hydration if a real session flag says otherwise.
	let isUnlocked = $state(
		!note.is_locked ||
			(typeof window !== 'undefined' && sessionStorage.getItem(unlockKey) === 'true')
	);

	// Locked-and-still-gated notes never write their content to localStorage,
	// plaintext — same rule as everywhere else content for these notes is
	// handled: it only ever leaves the server via the PIN-verified unlock
	// action. Once unlocked, the content is already plaintext in the editor
	// itself, so drafting it locally adds no new exposure.
	let draftEligible = $derived(isUnlocked);

	$effect(() => {
		if (!draftEligible) return;

		const isOnline = () => (status = navigator.onLine ? 'idle' : 'offline');
		isOnline();
		window.addEventListener('online', isOnline);
		window.addEventListener('offline', isOnline);
		return () => {
			window.removeEventListener('online', isOnline);
			window.removeEventListener('offline', isOnline);
		};
	});

	// Offer a restore instead of silently applying the draft — the server
	// copy might be the one the user actually wants if the draft is stale
	// junk from an abandoned edit.
	$effect(() => {
		if (!draftEligible) return;
		const draft = loadDraft(note.id);
		if (draft && new Date(draft.savedAt) > new Date(note.updated_at)) {
			restorableDraft = draft;
		}
	});

	function restoreDraft() {
		if (!restorableDraft) return;
		title = restorableDraft.title;
		content = restorableDraft.content;
		restorableDraft = null;
		scheduleSave();
	}

	function discardDraft() {
		clearDraft(note.id);
		restorableDraft = null;
	}

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

	async function save() {
		if (!navigator.onLine) {
			status = 'offline';
			return;
		}

		status = 'saving';

		// Snapshot title/content at call time — the debounce delay means the
		// user may have kept typing since this was scheduled, and reading
		// $state here (not from closed-over args) always gets the latest value.
		let res: Response;
		try {
			res = await fetch(`?/update`, {
				method: 'POST',
				body: new URLSearchParams({ title, content, known_updated_at: knownUpdatedAt })
			});
		} catch {
			// fetch throws on a dropped connection rather than resolving —
			// treat that the same as the navigator.onLine check above.
			status = 'offline';
			return;
		}

		if (res.status === 409) {
			const result: ActionResult = deserialize(await res.text());
			const serverUpdatedAt =
				result.type === 'failure' ? (result.data?.updated_at as string | undefined) : undefined;
			conflict = { serverUpdatedAt: serverUpdatedAt ?? knownUpdatedAt };
			status = 'error';
			return;
		}

		if (!res.ok) {
			status = 'error';
			return;
		}

		const result: ActionResult = deserialize(await res.text());
		if (result.type === 'success') {
			knownUpdatedAt = (result.data?.updated_at as string | undefined) ?? knownUpdatedAt;
		}
		status = 'saved';
		clearDraft(note.id);
		await invalidate('app:notes');
	}

	const scheduleSave = debounce(save, 800);

	function onInput() {
		if (draftEligible) saveDraft(note.id, title, content);
		conflict = null;
		status = navigator.onLine ? 'idle' : 'offline';
		scheduleSave();
	}

	// Keep saving after the reconnect instead of leaving the last edits
	// stranded until the user happens to type again.
	$effect(() => {
		if (!draftEligible) return;
		const onReconnect = () => scheduleSave();
		window.addEventListener('online', onReconnect);
		return () => window.removeEventListener('online', onReconnect);
	});

	function forceOverwrite() {
		if (!conflict) return;
		knownUpdatedAt = conflict.serverUpdatedAt;
		conflict = null;
		scheduleSave();
	}

	function discardLocalAndReload() {
		clearDraft(note.id);
		window.location.reload();
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
				{#if conflict}
					<span class="text-amber-600">Conflict — not saved.</span>
				{:else if status === 'error'}
					<span class="text-red-600">Could not save.</span>
				{:else if status === 'offline'}
					<span class="text-amber-600">Offline — draft saved locally</span>
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

			<TagPicker noteTags={note.tags} allTags={page.data.tags} />

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

	{#if restorableDraft}
		<Modal onClose={discardDraft}>
			<div class="flex flex-col items-center gap-4 text-center">
				<h1 class="text-lg font-semibold tracking-tight">Restore local draft?</h1>
				<p class="text-sm text-gray-500">
					A draft saved locally on {new Date(restorableDraft.savedAt).toLocaleString()} is newer than
					what's on the server. Restore it, or keep the saved version.
				</p>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={discardDraft}
						class="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
					>
						Keep server version
					</button>
					<button
						type="button"
						onclick={restoreDraft}
						class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
					>
						Restore draft
					</button>
				</div>
			</div>
		</Modal>
	{/if}

	{#if conflict}
		<Modal>
			<div class="flex flex-col items-center gap-4 text-center">
				<h1 class="text-lg font-semibold tracking-tight">This note changed elsewhere</h1>
				<p class="text-sm text-gray-500">
					It looks like this note was edited from another device since you opened it here. Saving
					now would overwrite that change. Reload to see the latest version, or overwrite it with
					what you have here.
				</p>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={discardLocalAndReload}
						class="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
					>
						Reload
					</button>
					<button
						type="button"
						onclick={forceOverwrite}
						class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
					>
						Overwrite anyway
					</button>
				</div>
			</div>
		</Modal>
	{/if}
{/if}
