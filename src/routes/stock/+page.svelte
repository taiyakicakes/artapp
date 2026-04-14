<script lang="ts">
	import { stocksStore, addStockItem, updateStockItem, deleteStockItem, type StockItem } from '$lib/stores/stocks.svelte';
	import { todosStore } from '$lib/stores/todos.svelte';
	import Modal from '$lib/components/Modal.svelte';

	// Projects from todos (same list)
	const projects = $derived(() => {
		const set = new Set<string>();
		for (const t of todosStore.todos) set.add(t.project);
		for (const s of stocksStore.items) set.add(s.project);
		return Array.from(set);
	});

	// Group stock by project
	const grouped = $derived(() => {
		const map: Record<string, StockItem[]> = {};
		for (const item of stocksStore.items) {
			if (!map[item.project]) map[item.project] = [];
			map[item.project].push(item);
		}
		return map;
	});

	const stockProjects = $derived(Object.keys(grouped()));

	// ── Collapsible ──
	let collapsed = $state<Record<string, boolean>>({});
	function toggleCollapse(project: string) {
		collapsed[project] = !collapsed[project];
	}

	// ── Project colors (same palette as todos) ──
	const projectColors = [
		'bg-pink-100 text-pink-700 border-pink-200',
		'bg-violet-100 text-violet-700 border-violet-200',
		'bg-sky-100 text-sky-700 border-sky-200',
		'bg-emerald-100 text-emerald-700 border-emerald-200',
		'bg-amber-100 text-amber-700 border-amber-200',
		'bg-rose-100 text-rose-700 border-rose-200'
	];

	function getProjectColor(project: string): string {
		const allProjects = projects();
		const idx = allProjects.indexOf(project) % projectColors.length;
		return projectColors[idx < 0 ? 0 : idx];
	}

	// ── Quantity: optimistic local updates, debounced Firestore write ──
	let pendingQty = $state<Record<string, number>>({});
	let debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	function getQty(item: StockItem): number {
		return pendingQty[item.id] ?? item.quantity;
	}

	function setQty(item: StockItem, val: number) {
		const clamped = Math.max(0, val);
		pendingQty[item.id] = clamped;
		clearTimeout(debounceTimers[item.id]);
		debounceTimers[item.id] = setTimeout(() => {
			updateStockItem(item.id, { quantity: clamped });
			delete pendingQty[item.id];
		}, 600);
	}

	function handleQtyInput(item: StockItem, e: Event) {
		const raw = (e.target as HTMLInputElement).value;
		const n = parseInt(raw, 10);
		if (!isNaN(n)) setQty(item, n);
	}

	// ── Add modal ──
	let addOpen = $state(false);
	let newProject = $state('');
	let newName = $state('');
	let newQty = $state('0');
	let showProjectDropdown = $state(false);
	let saving = $state(false);

	function openAdd(prefilledProject = '') {
		newProject = prefilledProject;
		newName = '';
		newQty = '0';
		addOpen = true;
	}

	async function handleAdd() {
		if (!newProject.trim() || !newName.trim()) return;
		saving = true;
		try {
			await addStockItem(newProject.trim(), newName.trim(), parseInt(newQty) || 0);
			addOpen = false;
		} finally {
			saving = false;
		}
	}

	// ── Edit modal ──
	let editOpen = $state(false);
	let editItem = $state<StockItem | null>(null);
	let editName = $state('');
	let editProject = $state('');
	let editSaving = $state(false);

	function openEdit(item: StockItem) {
		editItem = item;
		editName = item.name;
		editProject = item.project;
		editOpen = true;
	}

	async function handleEdit() {
		if (!editItem || !editName.trim()) return;
		editSaving = true;
		try {
			await updateStockItem(editItem.id, { name: editName.trim(), project: editProject.trim() });
			editOpen = false;
		} finally {
			editSaving = false;
		}
	}

	async function handleDelete() {
		if (!editItem) return;
		await deleteStockItem(editItem.id);
		editOpen = false;
	}
</script>

<div class="min-h-screen">
	<!-- Header -->
	<div class="bg-gradient-to-br from-teal-400 to-emerald-500 px-5 pb-6 pt-12 text-white shadow-md">
		<h1 class="text-3xl font-black">📦 Stock</h1>
		<p class="mt-1 text-sm font-semibold text-teal-100">
			{stocksStore.items.length} item{stocksStore.items.length === 1 ? '' : 's'} tracked
		</p>
	</div>

	<!-- Content -->
	<div class="px-4 py-5">
		{#if stocksStore.loading}
			<div class="flex justify-center py-12">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500"></div>
			</div>
		{:else if stocksStore.items.length === 0}
			<div class="flex flex-col items-center gap-4 py-16 text-center">
				<span class="text-6xl">🌿</span>
				<p class="text-lg font-bold text-gray-500">No stock items yet!</p>
				<p class="text-sm text-gray-400">Tap + to add your first item</p>
			</div>
		{:else}
			<div class="flex flex-col gap-4">
				{#each stockProjects as project (project)}
					{@const items = grouped()[project]}
					<div class="overflow-hidden rounded-2xl bg-white shadow-sm">
						<!-- Project header -->
						<div class="flex items-center {getProjectColor(project)} border-b">
							<button
								class="flex flex-1 items-center gap-2 px-4 py-3 text-base font-bold transition-opacity active:opacity-70"
								onclick={() => toggleCollapse(project)}
							>
								<span>{collapsed[project] ? '▶' : '▼'}</span>
								{project}
							</button>
							<span class="rounded-full bg-white/60 px-2.5 py-0.5 text-xs font-extrabold">
								{items.length}
							</span>
							<button
								class="ml-2 mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-2xl font-black leading-none shadow-sm transition-transform active:scale-90"
								onclick={() => openAdd(project)}
								aria-label="Add item to {project}"
							>+</button>
						</div>

						<!-- Items -->
						{#if !collapsed[project]}
							<div class="divide-y divide-gray-50">
								{#each items as item (item.id)}
									<div class="flex items-center gap-3 px-4 py-3">
										<!-- Name — tap to edit -->
										<button
											class="flex-1 text-left text-sm font-semibold text-gray-700 active:opacity-60"
											onclick={() => openEdit(item)}
										>
											{item.name}
										</button>

										<!-- Quantity controls -->
										<div class="flex items-center gap-1">
											<button
												class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-xl font-black text-rose-400 transition-transform active:scale-90"
												onclick={() => setQty(item, getQty(item) - 1)}
												aria-label="Decrease"
											>−</button>

											<input
												type="text"
												inputmode="numeric"
												pattern="[0-9]*"
												value={getQty(item)}
												oninput={(e) => handleQtyInput(item, e)}
												class="h-9 w-14 rounded-xl border-2 border-teal-100 bg-teal-50 text-center font-extrabold text-teal-700 outline-none focus:border-teal-400"
											/>

											<button
												class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-xl font-black text-teal-500 transition-transform active:scale-90"
												onclick={() => setQty(item, getQty(item) + 1)}
												aria-label="Increase"
											>+</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- FAB -->
<button
	onclick={() => openAdd()}
	class="fixed right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500 text-3xl font-black text-white shadow-lg transition-transform active:scale-90"
	style="bottom: calc(4.5rem + env(safe-area-inset-bottom))"
	aria-label="Add stock item"
>+</button>

<!-- Add Item Modal -->
<Modal bind:open={addOpen} title="New Stock Item 📦">
	<div class="flex flex-col gap-4">
		<!-- Project -->
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600" for="stock-project">Project</label>
			<div class="relative">
				<input
					id="stock-project"
					type="text"
					bind:value={newProject}
					onfocus={() => (showProjectDropdown = true)}
					onblur={() => setTimeout(() => (showProjectDropdown = false), 150)}
					placeholder="e.g. Sticker Sheet"
					class="w-full rounded-xl border-2 border-teal-100 bg-teal-50 px-4 py-3 font-semibold text-gray-700 outline-none focus:border-teal-400"
				/>
				{#if showProjectDropdown && projects().length > 0}
					<div class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-teal-100 bg-white shadow-lg">
						{#each projects() as p (p)}
							<button
								class="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-teal-50"
								onmousedown={() => { newProject = p; showProjectDropdown = false; }}
							>{p}</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Name -->
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600" for="stock-name">Item Name</label>
			<input
				id="stock-name"
				type="text"
				bind:value={newName}
				placeholder="e.g. Holographic stickers"
				class="w-full rounded-xl border-2 border-teal-100 bg-teal-50 px-4 py-3 font-semibold text-gray-700 outline-none focus:border-teal-400"
			/>
		</div>

		<!-- Starting quantity -->
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600" for="stock-qty">Starting Quantity</label>
			<input
				id="stock-qty"
				type="text"
				inputmode="numeric"
				pattern="[0-9]*"
				bind:value={newQty}
				class="w-full rounded-xl border-2 border-teal-100 bg-teal-50 px-4 py-3 font-semibold text-gray-700 outline-none focus:border-teal-400"
			/>
		</div>

		<button
			onclick={handleAdd}
			disabled={!newProject.trim() || !newName.trim() || saving}
			class="mt-1 w-full rounded-2xl bg-teal-500 py-4 text-base font-extrabold text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
		>
			{saving ? 'Adding...' : 'Add Item ✨'}
		</button>
	</div>
</Modal>

<!-- Edit Item Modal -->
<Modal bind:open={editOpen} title="Edit Item ✏️">
	{#if editItem}
		<div class="flex flex-col gap-4">
			<div>
				<label class="mb-1.5 block text-sm font-bold text-gray-600" for="edit-name">Item Name</label>
				<input
					id="edit-name"
					type="text"
					bind:value={editName}
					class="w-full rounded-xl border-2 border-teal-100 bg-teal-50 px-4 py-3 font-semibold text-gray-700 outline-none focus:border-teal-400"
				/>
			</div>

			<div>
				<label class="mb-1.5 block text-sm font-bold text-gray-600" for="edit-project">Project</label>
				<input
					id="edit-project"
					type="text"
					bind:value={editProject}
					class="w-full rounded-xl border-2 border-teal-100 bg-teal-50 px-4 py-3 font-semibold text-gray-700 outline-none focus:border-teal-400"
				/>
			</div>

			<button
				onclick={handleEdit}
				disabled={!editName.trim() || editSaving}
				class="w-full rounded-2xl bg-teal-500 py-4 text-base font-extrabold text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
			>
				{editSaving ? 'Saving...' : 'Save Changes ✨'}
			</button>

			<button
				onclick={handleDelete}
				class="w-full rounded-2xl border-2 border-red-100 bg-red-50 py-3.5 text-base font-bold text-red-400 transition-all active:scale-95"
			>
				Delete Item
			</button>
		</div>
	{/if}
</Modal>
