<script lang="ts">
	import {
		stocksStore,
		addStockItem,
		updateStockItem,
		deleteStockItem,
		deleteStockProject,
		reorderStockItem,
		type StockItem
	} from '$lib/stores/stocks.svelte';
	import { todosStore } from '$lib/stores/todos.svelte';
	import { renameProject } from '$lib/stores/todos.svelte';
	import { renameProjectInEvents } from '$lib/stores/events.svelte';
	import { archivedProjectsStore } from '$lib/stores/archivedProjects.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import Modal from '$lib/components/Modal.svelte';

	// Projects from todos + existing stock projects (excluding archived)
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

	// Only show non-archived stock projects
	const stockProjects = $derived(
		Object.keys(grouped()).filter((p) => !archivedProjectsStore.archived.has(p))
	);

	// ── Collapsible ──
	let collapsed = $state<Record<string, boolean>>({});
	function toggleCollapse(project: string) {
		collapsed[project] = !collapsed[project];
	}

	// ── Reorder mode ──
	let reorderMode = $state<Record<string, boolean>>({});
	function toggleReorder(project: string) {
		reorderMode[project] = !reorderMode[project];
	}

	function getSortedItems(items: StockItem[]): StockItem[] {
		return items.slice().sort((a, b) => {
			const aHas = a.order !== undefined;
			const bHas = b.order !== undefined;
			if (aHas && bHas) return a.order! - b.order!;
			if (aHas) return -1;
			if (bHas) return 1;
			return 0;
		});
	}

	async function moveItemToIndex(project: string, itemId: string, targetIdx: number) {
		const sorted = getSortedItems(grouped()[project]);
		const fromIdx = sorted.findIndex((i) => i.id === itemId);
		if (fromIdx === targetIdx) return;
		const reordered = sorted.slice();
		const [moved] = reordered.splice(fromIdx, 1);
		reordered.splice(targetIdx, 0, moved);
		await Promise.all(reordered.map((it, i) => reorderStockItem(it.id, i)));
	}

	// ── Touch drag ──
	type DragData = {
		id: string;
		project: string;
		fromIdx: number;
		toIdx: number;
		startY: number;
		deltaY: number;
		itemHeight: number;
	};
	let _drag: DragData | null = null;         // non-reactive, for event handlers
	let dragRender = $state<DragData | null>(null); // reactive copy, for rendering

	// Action: attaches touchstart/mousedown with passive:false so preventDefault works
	function dragHandle(node: HTMLElement, params: { item: StockItem; project: string; idx: number }) {
		function initDrag(clientY: number) {
			const row = node.closest('[data-row]') as HTMLElement | null;
			_drag = {
				id: params.item.id,
				project: params.project,
				fromIdx: params.idx,
				toIdx: params.idx,
				startY: clientY,
				deltaY: 0,
				itemHeight: row?.offsetHeight ?? 48
			};
			dragRender = { ..._drag };
		}
		function touchHandler(e: TouchEvent) {
			e.preventDefault();
			initDrag(e.touches[0].clientY);
			document.addEventListener('touchmove', onDragMove, { passive: false });
			document.addEventListener('touchend', onDragEnd);
			document.addEventListener('touchcancel', onDragEnd);
		}
		function mouseHandler(e: MouseEvent) {
			e.preventDefault();
			initDrag(e.clientY);
			document.addEventListener('mousemove', onDragMoveM);
			document.addEventListener('mouseup', onDragEnd);
		}
		node.addEventListener('touchstart', touchHandler, { passive: false });
		node.addEventListener('mousedown', mouseHandler);
		return {
			update(p: { item: StockItem; project: string; idx: number }) { params = p; },
			destroy() {
				node.removeEventListener('touchstart', touchHandler);
				node.removeEventListener('mousedown', mouseHandler);
			}
		};
	}

	function onDragMove(e: TouchEvent) {
		if (!_drag) return;
		e.preventDefault();
		_drag.deltaY = e.touches[0].clientY - _drag.startY;
		const steps = Math.round(_drag.deltaY / _drag.itemHeight);
		const len = getSortedItems(grouped()[_drag.project]).length;
		_drag.toIdx = Math.max(0, Math.min(len - 1, _drag.fromIdx + steps));
		dragRender = { ..._drag };
	}

	function onDragMoveM(e: MouseEvent) {
		if (!_drag) return;
		_drag.deltaY = e.clientY - _drag.startY;
		const steps = Math.round(_drag.deltaY / _drag.itemHeight);
		const len = getSortedItems(grouped()[_drag.project]).length;
		_drag.toIdx = Math.max(0, Math.min(len - 1, _drag.fromIdx + steps));
		dragRender = { ..._drag };
	}

	function onDragEnd() {
		if (!_drag) return;
		const { id, project, fromIdx, toIdx } = _drag;
		_drag = null;
		dragRender = null;
		document.removeEventListener('touchmove', onDragMove);
		document.removeEventListener('touchend', onDragEnd);
		document.removeEventListener('touchcancel', onDragEnd);
		document.removeEventListener('mousemove', onDragMoveM);
		document.removeEventListener('mouseup', onDragEnd);
		if (fromIdx !== toIdx) moveItemToIndex(project, id, toIdx);
	}

	function getDragStyle(item: StockItem, project: string, idx: number): string {
		const dr = dragRender;
		if (!dr || dr.project !== project) return '';
		if (dr.id === item.id) {
			return `transform: translateY(${dr.deltaY}px); position: relative; z-index: 50; box-shadow: 0 8px 24px -4px rgba(0,0,0,0.15); border-radius: 8px; transition: none;`;
		}
		let shift = 0;
		if (dr.fromIdx < dr.toIdx && idx > dr.fromIdx && idx <= dr.toIdx) {
			shift = -dr.itemHeight;
		} else if (dr.fromIdx > dr.toIdx && idx >= dr.toIdx && idx < dr.fromIdx) {
			shift = dr.itemHeight;
		}
		if (shift === 0) return '';
		return `transform: translateY(${shift}px); transition: transform 150ms ease;`;
	}

	// ── Project details modal ──
	let detailsOpen = $state(false);
	let detailsProject = $state('');
	let confirmDelete = $state(false);
	let deleting = $state(false);
	let renameInput = $state('');
	let renaming = $state(false);

	// CSV import
	let importing = $state(false);
	let importResult = $state('');
	let csvInput: HTMLInputElement;

	const totalStocked = $derived(
		stocksStore.items.filter((s) => (s.quantity ?? 0) >= (s.requested ?? 0)).length
	);
	const totalPct = $derived(
		stocksStore.items.length > 0 ? Math.round((totalStocked / stocksStore.items.length) * 100) : 0
	);

	function barColor(pct: number): string {
		if (pct === 0) return 'bg-rose-300';
		if (pct < 50) return 'bg-amber-300';
		if (pct < 100) return 'bg-teal-400';
		return 'bg-emerald-400';
	}

	function openDetails(project: string) {
		detailsProject = project;
		confirmDelete = false;
		importResult = '';
		renameInput = project;
		detailsOpen = true;
	}

	async function handleRename() {
		const trimmed = renameInput.trim();
		if (!trimmed || trimmed === detailsProject || renaming) return;
		renaming = true;
		try {
			await renameProject(detailsProject, trimmed);
			await renameProjectInEvents(detailsProject, trimmed);
			detailsProject = trimmed;
			renameInput = trimmed;
		} finally {
			renaming = false;
		}
	}

	function parseCSV(text: string): { name: string; quantity: number }[] {
		const lines = text.trim().split(/\r?\n/);
		if (lines.length < 2) return [];
		const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
		const itemIdx = headers.findIndex((h) => h === 'items' || h === 'item' || h === 'name');
		const qtyIdx = headers.findIndex((h) => h === 'quantity' || h === 'qty');
		if (itemIdx === -1 || qtyIdx === -1) return [];
		const rows: { name: string; quantity: number }[] = [];
		for (let i = 1; i < lines.length; i++) {
			const cols = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''));
			const name = cols[itemIdx];
			const qty = parseInt(cols[qtyIdx], 10);
			if (name) rows.push({ name, quantity: isNaN(qty) ? 0 : qty });
		}
		return rows;
	}

	async function handleCSVImport(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		importing = true;
		importResult = '';
		try {
			const text = await file.text();
			const rows = parseCSV(text);
			if (rows.length === 0) {
				importResult = '❌ No valid rows found. Make sure columns are "Items" and "Quantity".';
				return;
			}
			const existing = grouped()[detailsProject] ?? [];
			const existingByName = new Map(existing.map((s) => [s.name.toLowerCase(), s]));
			let created = 0;
			let updated = 0;
			await Promise.all(
				rows.map(async ({ name, quantity }) => {
					const match = existingByName.get(name.toLowerCase());
					if (match) {
						await updateStockItem(match.id, { requested: quantity });
						updated++;
					} else {
						await addStockItem(detailsProject, name, 0, quantity);
						created++;
					}
				})
			);
			importResult = `✅ Done! ${created} added, ${updated} updated.`;
		} catch {
			importResult = '❌ Failed to read file.';
		} finally {
			importing = false;
			if (csvInput) csvInput.value = '';
		}
	}

	async function handleDeleteProject() {
		if (!confirmDelete) { confirmDelete = true; return; }
		deleting = true;
		try {
			await deleteStockProject(detailsProject);
			detailsOpen = false;
		} finally {
			deleting = false;
			confirmDelete = false;
		}
	}

	// ── Project colors ──
	const projectColors = [
		'bg-pink-100 text-pink-700 border-pink-200',
		'bg-violet-100 text-violet-700 border-violet-200',
		'bg-sky-100 text-sky-700 border-sky-200',
		'bg-emerald-100 text-emerald-700 border-emerald-200',
		'bg-amber-100 text-amber-700 border-amber-200',
		'bg-rose-100 text-rose-700 border-rose-200'
	];

	function getProjectColor(project: string): string {
		const all = projects();
		const idx = all.indexOf(project) % projectColors.length;
		return projectColors[idx < 0 ? 0 : idx];
	}

	// ── Debounced Firestore writes ──
	let pendingQty = $state<Record<string, number>>({});
	let pendingReq = $state<Record<string, number>>({});
	let timers: Record<string, ReturnType<typeof setTimeout>> = {};

	function getQty(item: StockItem): number {
		return pendingQty[item.id] ?? item.quantity;
	}

	function getReq(item: StockItem): number {
		return pendingReq[item.id] ?? item.requested ?? 0;
	}

	function setQty(item: StockItem, val: number) {
		const v = Math.max(0, val);
		pendingQty[item.id] = v;
		clearTimeout(timers[`q${item.id}`]);
		timers[`q${item.id}`] = setTimeout(() => {
			updateStockItem(item.id, { quantity: v });
			delete pendingQty[item.id];
		}, 600);
	}

	function setReq(item: StockItem, val: number) {
		const v = Math.max(0, val);
		pendingReq[item.id] = v;
		clearTimeout(timers[`r${item.id}`]);
		timers[`r${item.id}`] = setTimeout(() => {
			updateStockItem(item.id, { requested: v });
			delete pendingReq[item.id];
		}, 600);
	}

	function handleReqInput(item: StockItem, e: Event) {
		const n = parseInt((e.target as HTMLInputElement).value, 10);
		if (!isNaN(n)) setReq(item, n);
	}

	// ── Add modal ──
	let addOpen = $state(false);
	let newProject = $state('');
	let newName = $state('');
	let newQty = $state('0');
	let newReq = $state('0');
	let showProjectDropdown = $state(false);
	let saving = $state(false);

	function openAdd(prefilledProject = '') {
		newProject = prefilledProject;
		newName = '';
		newQty = '0';
		newReq = '0';
		addOpen = true;
	}

	async function handleAdd() {
		if (!newProject.trim() || !newName.trim()) return;
		saving = true;
		try {
			await addStockItem(newProject.trim(), newName.trim(), parseInt(newQty) || 0, parseInt(newReq) || 0);
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
	<div
		class="px-5 pb-5 pt-12 text-white shadow-md {!settingsStore.settings.stockBg ? 'bg-gradient-to-br from-teal-400 to-emerald-500' : ''}"
		style={settingsStore.settings.stockBg ? `background: linear-gradient(to bottom right, rgba(45,212,191,0.85), rgba(52,211,153,0.85)), url('${settingsStore.settings.stockBg}') center/cover no-repeat` : ''}
	>
		<div class="flex items-center gap-3">
			<img src="/logo!.png" alt="logo" class="h-10 w-10 object-contain drop-shadow" />
			<h1 class="text-3xl font-black">Stock</h1>
		</div>
		<p class="mt-1 text-sm font-semibold text-teal-100">
			{totalStocked} / {stocksStore.items.length} stocked · {totalPct}%
		</p>
	</div>

	<div class="px-4 py-5">
		<button
			onclick={() => openAdd()}
			class="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 py-3.5 text-base font-extrabold text-white shadow-sm transition-all active:scale-95"
		>
			<span class="text-xl leading-none">+</span> New Stock Item
		</button>

		{#if stocksStore.loading}
			<div class="flex justify-center py-12">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500"></div>
			</div>
		{:else if stocksStore.items.length === 0}
			<div class="flex flex-col items-center gap-4 py-16 text-center">
				<span class="text-6xl">🌿</span>
				<p class="text-lg font-bold text-gray-500">No stock items yet!</p>
				<p class="text-sm text-gray-400">Tap the button above to add your first item</p>
			</div>
		{:else}
			<div class="flex flex-col gap-4">
				{#each stockProjects as project (project)}
					{@const items = grouped()[project]}
					{@const stockedCnt = items.filter((s) => (s.quantity ?? 0) >= (s.requested ?? 0)).length}
					{@const pct = items.length > 0 ? Math.round((stockedCnt / items.length) * 100) : 0}
					<div class="overflow-hidden rounded-2xl bg-white shadow-sm">
						<div class="flex items-center {getProjectColor(project)}">
							<button
								class="flex flex-1 items-center gap-2 px-4 py-3 text-base font-bold transition-opacity active:opacity-70"
								onclick={() => toggleCollapse(project)}
							>
								<span>{collapsed[project] ? '▶' : '▼'}</span>
								{project}
							</button>
							<span class="rounded-full bg-white/60 px-2.5 py-0.5 text-xs font-extrabold">
								{stockedCnt}/{items.length} · {pct}%
							</span>
							<button
								class="ml-1 rounded-lg px-2 py-1 text-xs font-bold transition-opacity active:opacity-60 {reorderMode[project] ? 'bg-teal-500 text-white' : 'bg-white/60'}"
								onclick={() => toggleReorder(project)}
								aria-label="Reorder items"
							>⇅</button>
							<button
								class="ml-1 rounded-lg bg-white/60 px-2 py-1 text-xs font-bold transition-opacity active:opacity-60"
								onclick={() => openDetails(project)}
							>•••</button>
							<button
								class="ml-1 mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-2xl font-black leading-none shadow-sm transition-transform active:scale-90"
								onclick={() => openAdd(project)}
								aria-label="Add item to {project}"
							>+</button>
						</div>
						<div class="h-1.5 w-full bg-gray-100">
							<div class="h-full transition-all {barColor(pct)}" style="width: {pct}%"></div>
						</div>

						{#if !collapsed[project]}
							<div class="flex items-center border-b border-gray-50 bg-gray-50/60 px-4 py-1.5">
								<span class="flex-1 text-xs font-extrabold uppercase tracking-wide text-gray-400">Item</span>
								<div class="flex gap-2">
									<span class="w-28 text-center text-xs font-extrabold uppercase tracking-wide text-rose-400">In Stock</span>
									<span class="w-16 text-center text-xs font-extrabold uppercase tracking-wide text-sky-400">Needed</span>
								</div>
							</div>
							<div class="divide-y divide-gray-50">
								{#each (reorderMode[project] ? getSortedItems(items) : items.slice().sort((a, b) => {
									const aOk = getQty(a) >= getReq(a);
									const bOk = getQty(b) >= getReq(b);
									if (aOk === bOk) {
										const aOrder = a.order ?? items.indexOf(a);
										const bOrder = b.order ?? items.indexOf(b);
										return aOrder - bOrder;
									}
									return aOk ? 1 : -1;
								})) as item, idx (item.id)}
									<div
										data-row
										class="flex items-center gap-3 px-4 py-2.5 {getQty(item) >= getReq(item) && !reorderMode[project] ? 'bg-emerald-50' : ''} {dragRender?.id === item.id ? 'bg-white opacity-90' : ''}"
										style={getDragStyle(item, project, idx)}
									>
										{#if reorderMode[project]}
											<div
												role="button"
												tabindex="-1"
												class="touch-none flex cursor-grab items-center justify-center px-1 text-gray-300 active:cursor-grabbing"
												use:dragHandle={{ item, project, idx }}
												aria-label="Drag to reorder"
											>
												<svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor">
													<circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/>
													<circle cx="5" cy="10" r="1.5"/><circle cx="11" cy="10" r="1.5"/>
													<circle cx="5" cy="16" r="1.5"/><circle cx="11" cy="16" r="1.5"/>
												</svg>
											</div>
										{/if}
										<button
											class="flex-1 text-left text-sm font-semibold text-gray-700 active:opacity-60"
											onclick={() => openEdit(item)}
										>
											{item.name}
										</button>
										<div class="flex items-center gap-2">
											<div class="flex w-28 items-center gap-1">
												<button
													class="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-lg font-black text-rose-400 transition-transform active:scale-90"
													onclick={() => setQty(item, getQty(item) - 1)}
													aria-label="Decrease"
												>−</button>
												<input
													type="text"
													inputmode="numeric"
													pattern="[0-9]*"
													value={getQty(item)}
													oninput={(e) => {
														const n = parseInt((e.target as HTMLInputElement).value, 10);
														if (!isNaN(n)) setQty(item, n);
													}}
													class="h-8 w-10 rounded-lg border-2 border-teal-100 bg-teal-50 text-center text-sm font-extrabold text-teal-700 outline-none focus:border-teal-400"
												/>
												<button
													class="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-lg font-black text-teal-500 transition-transform active:scale-90"
													onclick={() => setQty(item, getQty(item) + 1)}
													aria-label="Increase"
												>+</button>
											</div>
											<input
												type="text"
												inputmode="numeric"
												pattern="[0-9]*"
												value={getReq(item)}
												oninput={(e) => handleReqInput(item, e)}
												class="h-8 w-16 rounded-lg border-2 border-sky-100 bg-sky-50 text-center text-sm font-extrabold text-sky-600 outline-none focus:border-sky-400"
											/>
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

<!-- Add Item Modal -->
<Modal bind:open={addOpen} title="New Stock Item 📦">
	<div class="flex flex-col gap-4">
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
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600" for="stock-name">Item Name</label>
			<input id="stock-name" type="text" bind:value={newName} placeholder="e.g. Holographic stickers"
				class="w-full rounded-xl border-2 border-teal-100 bg-teal-50 px-4 py-3 font-semibold text-gray-700 outline-none focus:border-teal-400" />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1.5 block text-sm font-bold text-rose-500" for="stock-qty">In Stock</label>
				<input id="stock-qty" type="text" inputmode="numeric" pattern="[0-9]*" bind:value={newQty}
					class="w-full rounded-xl border-2 border-teal-100 bg-teal-50 px-4 py-3 font-semibold text-gray-700 outline-none focus:border-teal-400" />
			</div>
			<div>
				<label class="mb-1.5 block text-sm font-bold text-sky-500" for="stock-req">Needed</label>
				<input id="stock-req" type="text" inputmode="numeric" pattern="[0-9]*" bind:value={newReq}
					class="w-full rounded-xl border-2 border-sky-100 bg-sky-50 px-4 py-3 font-semibold text-gray-700 outline-none focus:border-sky-400" />
			</div>
		</div>
		<button
			onclick={handleAdd}
			disabled={!newProject.trim() || !newName.trim() || saving}
			class="mt-1 w-full rounded-2xl bg-teal-500 py-4 text-base font-extrabold text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
		>{saving ? 'Adding...' : 'Add Item ✨'}</button>
	</div>
</Modal>

<!-- Edit Item Modal -->
<Modal bind:open={editOpen} title="Edit Item ✏️">
	{#if editItem}
		<div class="flex flex-col gap-4">
			<div>
				<label class="mb-1.5 block text-sm font-bold text-gray-600" for="edit-name">Item Name</label>
				<input id="edit-name" type="text" bind:value={editName}
					class="w-full rounded-xl border-2 border-teal-100 bg-teal-50 px-4 py-3 font-semibold text-gray-700 outline-none focus:border-teal-400" />
			</div>
			<div>
				<label class="mb-1.5 block text-sm font-bold text-gray-600" for="edit-project">Project</label>
				<input id="edit-project" type="text" bind:value={editProject}
					class="w-full rounded-xl border-2 border-teal-100 bg-teal-50 px-4 py-3 font-semibold text-gray-700 outline-none focus:border-teal-400" />
			</div>
			<button onclick={handleEdit} disabled={!editName.trim() || editSaving}
				class="w-full rounded-2xl bg-teal-500 py-4 text-base font-extrabold text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
			>{editSaving ? 'Saving...' : 'Save Changes ✨'}</button>
			<button onclick={handleDelete}
				class="w-full rounded-2xl border-2 border-red-100 bg-red-50 py-3.5 text-base font-bold text-red-400 transition-all active:scale-95"
			>Delete Item</button>
		</div>
	{/if}
</Modal>

<!-- Project Details Modal -->
<Modal bind:open={detailsOpen} title="Project Details">
	{@const items = grouped()[detailsProject] ?? []}
	<div class="flex flex-col gap-4">
		<div class="rounded-2xl bg-gray-50 px-4 py-4 flex flex-col gap-2">
			<p class="text-lg font-black text-gray-800">{detailsProject}</p>
			<p class="text-sm font-semibold text-gray-500">{items.length} item{items.length === 1 ? '' : 's'}</p>
		</div>

		<!-- Rename -->
		<div>
			<p class="mb-2 text-xs font-black uppercase tracking-wide text-gray-400">Rename Project</p>
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={renameInput}
					placeholder={detailsProject}
					class="flex-1 rounded-xl border-2 border-teal-100 bg-teal-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-teal-400"
					onkeydown={(e) => e.key === 'Enter' && handleRename()}
				/>
				<button
					onclick={handleRename}
					disabled={renaming || !renameInput.trim() || renameInput.trim() === detailsProject}
					class="rounded-xl bg-teal-500 px-3 py-2.5 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-40"
				>{renaming ? '…' : 'Save'}</button>
			</div>
			<p class="mt-1 text-xs text-gray-400">Renames across tasks, stock, and events</p>
		</div>

		<!-- CSV Import -->
		<div class="rounded-2xl border-2 border-teal-100 bg-teal-50 px-4 py-4 flex flex-col gap-3">
			<div>
				<p class="text-sm font-extrabold text-teal-700">Import from CSV</p>
				<p class="mt-0.5 text-xs font-semibold text-teal-500">Columns: <span class="font-black">Items</span>, <span class="font-black">Quantity</span> — existing items get their required qty updated</p>
			</div>
			<input bind:this={csvInput} type="file" accept=".csv,text/csv" onchange={handleCSVImport} class="hidden" />
			<button onclick={() => csvInput.click()} disabled={importing}
				class="w-full rounded-xl bg-teal-500 py-3 text-sm font-extrabold text-white transition-all active:scale-95 disabled:opacity-50"
			>{importing ? 'Importing...' : '📂 Choose CSV File'}</button>
			{#if importResult}
				<p class="text-sm font-bold {importResult.startsWith('✅') ? 'text-emerald-600' : 'text-red-500'}">{importResult}</p>
			{/if}
		</div>

		<button onclick={handleDeleteProject} disabled={deleting}
			class="w-full rounded-2xl border-2 py-4 text-base font-extrabold transition-all active:scale-95 disabled:opacity-50
				{confirmDelete ? 'border-red-400 bg-red-500 text-white' : 'border-red-100 bg-red-50 text-red-400'}"
		>{deleting ? 'Deleting...' : confirmDelete ? '⚠️ Confirm — delete all items?' : 'Delete Project'}</button>
		{#if confirmDelete}
			<button onclick={() => (confirmDelete = false)}
				class="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 py-3 text-sm font-bold text-gray-400"
			>Cancel</button>
		{/if}
	</div>
</Modal>
