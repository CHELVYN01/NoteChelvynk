<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import LockIcon from '$lib/components/icons/LockIcon.svelte';
	import type { Note } from '$lib/types';

	let {
		notes
	}: {
		notes: Pick<Note, 'id' | 'title' | 'content' | 'is_pinned' | 'is_locked' | 'updated_at'>[];
	} = $props();

	function snippet(content: string): string {
		const trimmed = content.trim().replace(/\s+/g, ' ');
		return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<aside class="flex w-72 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
	<div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
		<a href={resolve('/')} class="font-semibold tracking-tight">NoteChelvyn</a>
		<form method="POST" action="/?/create">
			<button
				type="submit"
				class="rounded-md bg-gray-900 px-2.5 py-1 text-sm font-medium text-white hover:bg-gray-700"
			>
				+ New
			</button>
		</form>
	</div>

	<nav class="flex-1 overflow-y-auto">
		{#if notes.length === 0}
			<p class="px-4 py-6 text-sm text-gray-400">No notes yet.</p>
		{:else}
			{#each notes as note (note.id)}
				{@const isActive = page.url.pathname === `/note/${note.id}`}
				<a
					href={resolve('/note/[id]', { id: note.id })}
					class="block border-b border-gray-100 px-4 py-3 hover:bg-gray-100 {isActive
						? 'bg-gray-100'
						: ''}"
				>
					<div class="flex items-center gap-1.5">
						{#if note.is_pinned}
							<span class="text-xs" title="Pinned">📌</span>
						{/if}
						{#if note.is_locked}
							<span class="text-gray-400" title="Locked"><LockIcon /></span>
						{/if}
						<span class="truncate font-medium text-gray-900">{note.title}</span>
					</div>
					<p class="truncate text-sm text-gray-500">
						{note.is_locked ? 'Locked' : snippet(note.content) || 'Empty note'}
					</p>
					<p class="mt-0.5 text-xs text-gray-400">{formatDate(note.updated_at)}</p>
				</a>
			{/each}
		{/if}
	</nav>
</aside>
