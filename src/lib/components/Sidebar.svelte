<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import LockIcon from '$lib/components/icons/LockIcon.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { tagChipClass } from '$lib/utils/tagColors';
	import { sanitizeHeadline } from '$lib/utils/headline';
	import type { Note, SearchResult, Tag } from '$lib/types';

	let {
		notes,
		tags,
		activeTagId
	}: {
		notes: Pick<Note, 'id' | 'title' | 'content' | 'is_pinned' | 'is_locked' | 'updated_at'>[];
		tags: Tag[];
		activeTagId: string | null;
	} = $props();

	let searchResults = $state<SearchResult[] | null>(null);

	function snippet(content: string): string {
		const trimmed = content.trim().replace(/\s+/g, ' ');
		return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function toggleTagFilter(tagId: string) {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (activeTagId === tagId) {
			params.delete('tag');
		} else {
			params.set('tag', tagId);
		}
		const query = params.toString();
		// The tag filter chips only ever apply to the note list on '/', so the
		// destination route is always this one — only the query string varies.
		goto(resolve(query ? `/?${query}` : '/'), { invalidateAll: true });
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

	<SearchBar onResults={(results) => (searchResults = results)} />

	{#if tags.length > 0}
		<div class="flex flex-wrap gap-1.5 border-b border-gray-200 px-4 pb-3">
			{#each tags as tag (tag.id)}
				<button
					type="button"
					onclick={() => toggleTagFilter(tag.id)}
					class="rounded-full px-2 py-0.5 text-xs font-medium {tagChipClass(
						tag.color
					)} {activeTagId === tag.id ? 'ring-2 ring-gray-900 ring-offset-1' : ''}"
				>
					{tag.name}
				</button>
			{/each}
		</div>
	{/if}

	<nav class="flex-1 overflow-y-auto">
		{#if searchResults !== null}
			{#if searchResults.length === 0}
				<p class="px-4 py-6 text-sm text-gray-400">No matches.</p>
			{:else}
				{#each searchResults as result (result.id)}
					{@const isActive = page.url.pathname === `/note/${result.id}`}
					<a
						href={resolve('/note/[id]', { id: result.id })}
						class="block border-b border-gray-100 px-4 py-3 hover:bg-gray-100 {isActive
							? 'bg-gray-100'
							: ''}"
					>
						<div class="flex items-center gap-1.5">
							{#if result.is_pinned}
								<span class="text-xs" title="Pinned">📌</span>
							{/if}
							{#if result.is_locked}
								<span class="text-gray-400" title="Locked"><LockIcon /></span>
							{/if}
							<span class="truncate font-medium text-gray-900">{result.title}</span>
						</div>
						<p class="truncate text-sm text-gray-500">
							{#if result.is_locked}
								Locked
							{:else if result.snippet}
								{@html sanitizeHeadline(result.snippet)}
							{:else}
								Empty note
							{/if}
						</p>
						<p class="mt-0.5 text-xs text-gray-400">{formatDate(result.updated_at)}</p>
					</a>
				{/each}
			{/if}
		{:else if notes.length === 0}
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
