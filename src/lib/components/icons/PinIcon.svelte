<script lang="ts">
	let { filled = false }: { filled?: boolean } = $props();
</script>

<svg
	viewBox="0 0 20 20"
	fill={filled ? 'currentColor' : 'none'}
	stroke="currentColor"
	stroke-width="1.5"
	class="size-4"
>
	<path
		stroke-linecap="round"
		stroke-linejoin="round"
		d="M9.5 2.5 8 4l1 1-4.5 4.5L3 9l-.5.5L6 13l.5-.5-.5-1.5 4.5-4.5 1 1 1.5-1.5-3.5-3.5ZM6.5 12.5 3 16"
	/>
</svg>
