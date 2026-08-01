<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let isAuthPage = $derived(page.url.pathname === '/login');
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if isAuthPage}
	{@render children()}
{:else}
	<div class="flex min-h-screen">
		<Sidebar notes={data.notes} tags={data.tags} activeTagId={data.activeTagId} />
		<div class="flex-1">
			{@render children()}
		</div>
	</div>
{/if}
