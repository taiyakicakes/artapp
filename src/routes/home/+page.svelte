<script lang="ts">
	import { linksStore, addLink, deleteLink } from '$lib/stores/links.svelte';

	let showForm = $state(false);
	let label = $state('');
	let url = $state('');
	let saving = $state(false);
	let editMode = $state(false);

	async function handleAdd() {
		if (!label.trim() || !url.trim()) return;
		saving = true;
		try {
			await addLink(label.trim(), url.trim());
			label = '';
			url = '';
			showForm = false;
		} finally {
			saving = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleAdd();
		if (e.key === 'Escape') {
			showForm = false;
			label = '';
			url = '';
		}
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-violet-50 px-4 pt-8 pb-6">
	<div class="mx-auto max-w-md">
		<!-- Header -->
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-2xl font-black text-pink-600">Quick Links 🔗</h1>
			<div class="flex gap-2">
				{#if linksStore.links.length > 0}
					<button
						onclick={() => (editMode = !editMode)}
						class="rounded-xl px-3 py-1.5 text-sm font-bold transition-colors {editMode
							? 'bg-pink-500 text-white'
							: 'bg-white text-pink-400 shadow-sm'}"
					>
						{editMode ? 'Done' : 'Edit'}
					</button>
				{/if}
				<button
					onclick={() => {
						showForm = !showForm;
						if (!showForm) {
							label = '';
							url = '';
						}
					}}
					class="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500 text-xl font-bold text-white shadow-md transition-transform active:scale-95"
				>
					{showForm ? '✕' : '+'}
				</button>
			</div>
		</div>

		<!-- Add form -->
		{#if showForm}
			<div class="mb-5 rounded-2xl bg-white p-4 shadow-md">
				<div class="flex flex-col gap-3">
					<input
						type="text"
						bind:value={label}
						onkeydown={handleKeydown}
						placeholder="Label (e.g. My Shop)"
						class="rounded-xl border border-pink-200 px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
						autofocus
					/>
					<input
						type="url"
						bind:value={url}
						onkeydown={handleKeydown}
						placeholder="URL (e.g. etsy.com/shop/...)"
						class="rounded-xl border border-pink-200 px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
					/>
					<button
						onclick={handleAdd}
						disabled={saving || !label.trim() || !url.trim()}
						class="rounded-xl bg-pink-500 py-2 text-sm font-bold text-white shadow-sm transition-transform active:scale-95 disabled:opacity-50"
					>
						{saving ? 'Adding...' : 'Add Link'}
					</button>
				</div>
			</div>
		{/if}

		<!-- Links grid -->
		{#if linksStore.loading}
			<div class="flex justify-center py-12">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500"></div>
			</div>
		{:else if linksStore.links.length === 0}
			<div class="flex flex-col items-center gap-3 py-16 text-center">
				<span class="text-5xl">🔗</span>
				<p class="font-bold text-pink-300">No links yet</p>
				<p class="text-sm text-pink-200">Tap + to add your first link</p>
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-3">
				{#each linksStore.links as link (link.id)}
					<div class="relative">
						<a
							href={link.url}
							target="_blank"
							rel="noopener noreferrer"
							class="flex min-h-[80px] w-full items-center justify-center rounded-2xl bg-white px-3 py-4 text-center text-sm font-bold text-gray-700 shadow-sm transition-transform active:scale-95 {editMode ? 'opacity-60 pointer-events-none' : ''}"
						>
							{link.label}
						</a>
						{#if editMode}
							<button
								onclick={() => deleteLink(link.id)}
								class="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-400 text-xs font-black text-white shadow-md"
							>
								✕
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
