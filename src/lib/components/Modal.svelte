<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		children
	}: {
		open: boolean;
		title: string;
		children: Snippet;
	} = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="fixed inset-0 z-[100] flex items-end">
		<button
			class="absolute inset-0 cursor-default bg-black/30"
			onclick={() => (open = false)}
			aria-label="Close modal"
		></button>
		<div
			class="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white px-6 pb-8 pt-5 shadow-2xl"
		>
			<div class="mx-auto mb-5 h-1.5 w-12 rounded-full bg-gray-200"></div>
			<h2 class="mb-5 text-xl font-extrabold text-gray-800">{title}</h2>
			{@render children()}
		</div>
	</div>
{/if}
