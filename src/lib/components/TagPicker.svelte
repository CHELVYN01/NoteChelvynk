<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import { tagChipClass, tagSwatchClass, TAG_COLORS, type TagColor } from '$lib/utils/tagColors';
	import type { Tag } from '$lib/types';
	import type { ActionResult } from '@sveltejs/kit';

	let {
		noteTags,
		allTags
	}: {
		noteTags: Pick<Tag, 'id' | 'name' | 'color'>[];
		allTags: Tag[];
	} = $props();

	let open = $state(false);
	let newTagName = $state('');
	let newTagColor = $state<TagColor>('gray');
	let pending = $state(false);
	let errorMessage = $state<string | null>(null);

	// Parent props update after invalidate('app:tags' / 'app:notes'), so this
	// component tracks its own optimistic copy rather than mutating props.
	let attached = $state(noteTags);

	let availableTags = $derived(allTags.filter((t) => !attached.some((a) => a.id === t.id)));

	function closePopover() {
		open = false;
		newTagName = '';
		newTagColor = 'gray';
		errorMessage = null;
	}

	async function attachExisting(tag: Pick<Tag, 'id' | 'name' | 'color'>) {
		attached = [...attached, tag];
		closePopover();

		const res = await fetch('?/addTag', {
			method: 'POST',
			body: new URLSearchParams({ tag_id: tag.id })
		});
		if (!res.ok) {
			attached = attached.filter((t) => t.id !== tag.id);
			return;
		}
		await invalidate('app:tags');
	}

	async function removeTag(tagId: string) {
		const previous = attached;
		attached = attached.filter((t) => t.id !== tagId);

		const res = await fetch('?/removeTag', {
			method: 'POST',
			body: new URLSearchParams({ tag_id: tagId })
		});
		if (!res.ok) {
			attached = previous;
			return;
		}
		// The server may have just deleted the tag outright if this was its
		// last note (see removeTag action) — refresh the sidebar's tag list
		// so an emptied-out tag disappears from the filter chips immediately.
		await invalidate('app:tags');
	}

	async function createAndAttach(e: SubmitEvent) {
		e.preventDefault();
		const name = newTagName.trim();
		if (!name) return;

		pending = true;
		errorMessage = null;

		// Tag creation is a root-level action (tags belong to the user, not a
		// note), so it's posted to '/' rather than this page's own route.
		const createRes = await fetch('/?/createTag', {
			method: 'POST',
			body: new URLSearchParams({ name, color: newTagColor })
		});
		const createResult: ActionResult = deserialize(await createRes.text());

		if (createResult.type === 'failure') {
			pending = false;
			errorMessage = (createResult.data?.error as string | undefined) ?? 'Could not create tag.';
			return;
		}
		if (createResult.type !== 'success') {
			pending = false;
			errorMessage = 'Could not create tag.';
			return;
		}

		const created = createResult.data?.tag as Tag | undefined;
		if (!created) {
			pending = false;
			errorMessage = 'Could not create tag.';
			return;
		}

		attached = [...attached, created];
		await fetch('?/addTag', { method: 'POST', body: new URLSearchParams({ tag_id: created.id }) });
		await invalidate('app:tags');

		pending = false;
		closePopover();
	}
</script>

<div class="flex flex-wrap items-center gap-1.5">
	{#each attached as tag (tag.id)}
		<span
			class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {tagChipClass(
				tag.color
			)}"
		>
			{tag.name}
			<button
				type="button"
				onclick={() => removeTag(tag.id)}
				class="text-current/60 hover:text-current"
				title="Remove tag"
			>
				×
			</button>
		</span>
	{/each}

	<div class="relative">
		<button
			type="button"
			onclick={() => (open = !open)}
			class="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
		>
			+ Add tag
		</button>

		{#if open}
			<div
				class="absolute top-full left-0 z-10 mt-1 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg"
			>
				{#if availableTags.length > 0}
					<ul class="mb-2 max-h-40 overflow-y-auto">
						{#each availableTags as tag (tag.id)}
							<li>
								<button
									type="button"
									onclick={() => attachExisting(tag)}
									class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-gray-50"
								>
									<span class="size-2 rounded-full {tagSwatchClass(tag.color)}"></span>
									{tag.name}
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				<form onsubmit={createAndAttach} class="flex flex-col gap-2 border-t border-gray-100 pt-2">
					<input
						type="text"
						bind:value={newTagName}
						placeholder="New tag name"
						maxlength="40"
						class="rounded-md border-gray-300 text-sm shadow-sm focus:border-gray-500 focus:ring-gray-500"
					/>
					<div class="flex items-center gap-1">
						{#each TAG_COLORS as color (color)}
							<button
								type="button"
								onclick={() => (newTagColor = color)}
								class="size-5 rounded-full {tagSwatchClass(color)} {newTagColor === color
									? 'ring-2 ring-gray-900 ring-offset-1'
									: ''}"
								title={color}
								aria-label={color}
							></button>
						{/each}
					</div>
					{#if errorMessage}
						<p class="text-xs text-red-600">{errorMessage}</p>
					{/if}
					<div class="flex justify-end gap-2">
						<button
							type="button"
							onclick={closePopover}
							class="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={pending || newTagName.trim().length === 0}
							class="rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
						>
							Create
						</button>
					</div>
				</form>
			</div>
		{/if}
	</div>
</div>
