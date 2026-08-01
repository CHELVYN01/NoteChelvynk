<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page, navigating } from '$app/state';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let isAuthPage = $derived(page.url.pathname === '/login');
	// Below the sm breakpoint there's only room for one pane at a time: the
	// sidebar acts as the note list screen, and opening a note replaces it
	// rather than sitting alongside it (there's no room for both).
	let isNoteOpen = $derived(page.url.pathname.startsWith('/note/'));
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<!-- Fixed at the top edge rather than inline so it doesn't shift layout while
     the page it's measuring against is still mid-navigation. -->
{#if navigating.to}
	<div class="fixed top-0 right-0 left-0 z-50 h-0.5 animate-pulse bg-gray-900"></div>
{/if}

{#if isAuthPage}
	{@render children()}
{:else}
	<div class="flex min-h-screen">
		<div class="{isNoteOpen ? 'hidden sm:block' : 'w-full'} sm:w-auto">
			<Sidebar notes={data.notes} tags={data.tags} activeTagId={data.activeTagId} />
		</div>
		<div class="flex-1 {isNoteOpen ? '' : 'hidden sm:block'}">
			{@render children()}
		</div>
	</div>
{/if}
