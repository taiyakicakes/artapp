<script lang="ts">
	import {
		todosStore,
		addTodo,
		toggleTodo,
		deleteTodo,
		updateTodoPriority,
		updateTodoTask,
		deleteProject,
		setBlocker,
		renameProject,
		type Priority,
		type Todo
	} from '$lib/stores/todos.svelte';
	import { projectPrioritiesStore, setProjectPriority, clearProjectPriority } from '$lib/stores/projectPriorities.svelte';
	import { archivedProjectsStore, archiveProject, unarchiveProject } from '$lib/stores/archivedProjects.svelte';
	import { renameProjectInEvents } from '$lib/stores/events.svelte';
	import { stocksStore } from '$lib/stores/stocks.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import Modal from '$lib/components/Modal.svelte';

	function stockStats(project: string) {
		const items = stocksStore.items.filter((s) => s.project === project);
		const stocked = items.filter((s) => (s.quantity ?? 0) >= (s.requested ?? 0)).length;
		const pct = items.length > 0 ? Math.round((stocked / items.length) * 100) : null;
		return { total: items.length, stocked, pct };
	}

	function barColor(pct: number | null): string {
		if (pct === null || pct === 0) return 'bg-rose-300';
		if (pct < 50) return 'bg-amber-300';
		if (pct < 100) return 'bg-teal-400';
		return 'bg-emerald-400';
	}

	const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

	const grouped = $derived(() => {
		const map: Record<string, typeof todosStore.todos> = {};
		for (const todo of todosStore.todos) {
			if (!map[todo.project]) map[todo.project] = [];
			map[todo.project].push(todo);
		}
		for (const key of Object.keys(map)) {
			map[key].sort((a, b) => {
				const pa = PRIORITY_ORDER[a.priority ?? 'medium'];
				const pb = PRIORITY_ORDER[b.priority ?? 'medium'];
				return pa - pb;
			});
		}
		return map;
	});

	const PROJECT_PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

	const projects = $derived(
		Object.keys(grouped())
			.filter((p) => !archivedProjectsStore.archived.has(p))
			.sort((a, b) => {
				const pa = PROJECT_PRIORITY_ORDER[projectPrioritiesStore.priorities[a] ?? ''] ?? 3;
				const pb = PROJECT_PRIORITY_ORDER[projectPrioritiesStore.priorities[b] ?? ''] ?? 3;
				return pa - pb;
			})
	);

	const archivedProjectsList = $derived(
		Object.keys(grouped())
			.filter((p) => archivedProjectsStore.archived.has(p))
			.sort()
	);

	// ── Add task modal ──
	let addOpen = $state(false);
	let newProject = $state('');
	let newTask = $state('');
	let newPriority = $state<Priority>('medium');
	let existingProjects = $derived(projects);
	let showProjectDropdown = $state(false);
	let saving = $state(false);

	function openAddModal(prefilledProject = '') {
		newProject = prefilledProject;
		newTask = '';
		newPriority = 'medium';
		addOpen = true;
	}

	async function handleAdd() {
		if (!newProject.trim() || !newTask.trim()) return;
		saving = true;
		try {
			await addTodo(newProject.trim(), newTask.trim(), newPriority);
			newProject = '';
			newTask = '';
			newPriority = 'medium';
			addOpen = false;
		} finally {
			saving = false;
		}
	}

	// ── Task details modal ──
	let detailTodoOpen = $state(false);
	let selectedTodo = $state<Todo | null>(null);
	let blockerPickerOpen = $state(false);
	let editTaskName = $state('');
	let savingName = $state(false);

	function openDetailModal(todo: Todo) {
		selectedTodo = todo;
		editTaskName = todo.task;
		blockerPickerOpen = false;
		detailTodoOpen = true;
	}

	async function handleSaveTaskName() {
		if (!selectedTodo || !editTaskName.trim() || editTaskName.trim() === selectedTodo.task) return;
		savingName = true;
		try {
			await updateTodoTask(selectedTodo.id, editTaskName.trim());
			selectedTodo = { ...selectedTodo, task: editTaskName.trim() };
		} finally {
			savingName = false;
		}
	}

	async function setPriority(p: Priority) {
		if (!selectedTodo) return;
		await updateTodoPriority(selectedTodo.id, p);
		selectedTodo = todosStore.todos.find((t) => t.id === selectedTodo!.id) ?? selectedTodo;
	}

	async function handleSetBlocker(blockerId: string | null) {
		if (!selectedTodo) return;
		await setBlocker(selectedTodo.id, blockerId);
		selectedTodo = todosStore.todos.find((t) => t.id === selectedTodo!.id) ?? selectedTodo;
		blockerPickerOpen = false;
	}

	const blockerCandidates = $derived(
		selectedTodo
			? todosStore.todos.filter(
					(t) => t.id !== selectedTodo!.id && !t.done && t.blockedBy !== selectedTodo!.id
				)
			: []
	);

	const blockerTodo = $derived(
		selectedTodo?.blockedBy
			? todosStore.todos.find((t) => t.id === selectedTodo!.blockedBy)
			: null
	);

	function isBlocked(todo: Todo): boolean {
		if (!todo.blockedBy) return false;
		const blocker = todosStore.todos.find((t) => t.id === todo.blockedBy);
		return !!blocker && !blocker.done;
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
		const allP = [...projects, ...archivedProjectsList];
		const idx = allP.indexOf(project) % projectColors.length;
		return projectColors[idx < 0 ? 0 : idx];
	}

	// ── Priority display ──
	const priorityBadge: Record<Priority, string> = {
		high: 'bg-red-100 text-red-500',
		medium: 'bg-amber-100 text-amber-500',
		low: 'bg-sky-100 text-sky-500'
	};
	const priorityLabel: Record<Priority, string> = {
		high: '🔴 High', medium: '🟡 Medium', low: '🔵 Low'
	};

	// ── Project details modal ──
	let detailsOpen = $state(false);
	let detailsProject = $state('');
	let confirmDelete = $state(false);
	let deleting = $state(false);
	let renameInput = $state('');
	let renaming = $state(false);
	let showArchived = $state(false);

	function openDetails(project: string) {
		detailsProject = project;
		confirmDelete = false;
		renameInput = project;
		detailsOpen = true;
	}

	async function handleDeleteProject() {
		if (!confirmDelete) { confirmDelete = true; return; }
		deleting = true;
		try {
			await deleteProject(detailsProject);
			detailsOpen = false;
		} finally {
			deleting = false;
			confirmDelete = false;
		}
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

	async function handleArchiveToggle() {
		if (archivedProjectsStore.archived.has(detailsProject)) {
			await unarchiveProject(detailsProject);
		} else {
			await archiveProject(detailsProject);
			detailsOpen = false;
		}
	}

	// ── Collapsible ──
	let collapsed = $state<Record<string, boolean>>({});
	function toggleCollapse(project: string) {
		collapsed[project] = !collapsed[project];
	}
</script>

<div class="min-h-screen">
	<!-- Header -->
	<div
		class="px-5 pb-6 pt-12 text-white shadow-md {!settingsStore.settings.todosBg ? 'bg-gradient-to-br from-pink-400 to-rose-400' : ''}"
		style={settingsStore.settings.todosBg ? `background: linear-gradient(to bottom right, rgba(244,114,182,0.85), rgba(251,113,133,0.85)), url('${settingsStore.settings.todosBg}') center/cover no-repeat` : ''}
	>
		<div class="flex items-center gap-3">
			<img src="/logo!.png" alt="logo" class="h-10 w-10 object-contain drop-shadow" />
			<h1 class="text-3xl font-black">My Projects</h1>
		</div>
		<div class="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm font-semibold text-pink-100">
			<span>{todosStore.todos.filter((t) => t.done).length} / {todosStore.todos.length} tasks done</span>
			{#if stocksStore.items.length > 0}
				{@const allStocked = stocksStore.items.filter((s) => (s.quantity ?? 0) >= (s.requested ?? 0)).length}
				<span>📦 {allStocked} / {stocksStore.items.length} stocked · {Math.round((allStocked / stocksStore.items.length) * 100)}%</span>
			{/if}
		</div>
	</div>

	<div class="px-4 py-5">
		<!-- Add task button -->
		<button
			onclick={() => openAddModal()}
			class="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-500 py-3.5 text-base font-extrabold text-white shadow-sm transition-all active:scale-95"
		>
			<span class="text-xl leading-none">+</span> New Task
		</button>

		{#if todosStore.loading}
			<div class="flex justify-center py-12">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500"></div>
			</div>
		{:else if projects.length === 0 && archivedProjectsList.length === 0}
			<div class="flex flex-col items-center gap-4 py-16 text-center">
				<span class="text-6xl">🌸</span>
				<p class="text-lg font-bold text-gray-500">No projects yet!</p>
				<p class="text-sm text-gray-400">Tap + to add your first task</p>
			</div>
		{:else}
			<!-- Active projects -->
			<div class="flex flex-col gap-4">
				{#each projects as project (project)}
					{@const todos = grouped()[project]}
					{@const doneCnt = todos.filter((t) => t.done).length}
					{@const ss = stockStats(project)}
					{@const projPriority = projectPrioritiesStore.priorities[project]}
					<div class="overflow-hidden rounded-2xl bg-white shadow-sm">
						<div class="flex items-center {getProjectColor(project)}">
							<button
								class="flex flex-1 items-center gap-2 px-4 py-3 text-base font-bold transition-opacity active:opacity-70"
								onclick={() => toggleCollapse(project)}
							>
								<span>{collapsed[project] ? '▶' : '▼'}</span>
								{project}
								{#if projPriority}
									<span class="text-sm">{projPriority === 'high' ? '🔴' : projPriority === 'medium' ? '🟡' : '🔵'}</span>
								{/if}
							</button>
							<div class="flex flex-col items-end gap-0.5 pr-1">
								<span class="rounded-full bg-white/60 px-2 py-0.5 text-xs font-extrabold">{doneCnt}/{todos.length} done</span>
								{#if ss.total > 0}
									<span class="rounded-full bg-white/60 px-2 py-0.5 text-xs font-extrabold">📦 {ss.stocked}/{ss.total} · {ss.pct}%</span>
								{/if}
							</div>
							<button
								class="ml-1 rounded-lg bg-white/60 px-2 py-1 text-xs font-bold transition-opacity active:opacity-60"
								onclick={() => openDetails(project)}
							>•••</button>
							<button
								class="ml-1 mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-2xl font-black leading-none shadow-sm transition-transform active:scale-90"
								onclick={() => openAddModal(project)}
								aria-label="Add task to {project}"
							>+</button>
						</div>
						<div class="h-1.5 w-full bg-gray-100">
							<div class="h-full transition-all {barColor(todos.length > 0 ? Math.round((doneCnt / todos.length) * 100) : 0)}" style="width: {todos.length > 0 ? Math.round((doneCnt / todos.length) * 100) : 0}%"></div>
						</div>

						{#if !collapsed[project]}
							<div class="divide-y divide-gray-50">
								{#each todos as todo (todo.id)}
									{@const p = todo.priority ?? 'medium'}
									{@const blocked = isBlocked(todo)}
									{@const blocker = blocked ? todosStore.todos.find((t) => t.id === todo.blockedBy) : null}
									<div class="flex items-center gap-3 px-4 py-3 {todo.done ? 'bg-emerald-50' : blocked ? 'bg-gray-50/80' : 'bg-white'}">
										<button
											class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all {todo.done
												? 'border-pink-400 bg-pink-400 text-white'
												: blocked
												? 'cursor-not-allowed border-gray-200 bg-gray-100'
												: 'border-gray-300 hover:border-pink-300'}"
											onclick={() => !blocked && toggleTodo(todo.id, !todo.done)}
											disabled={blocked}
											aria-label="Toggle todo"
										>
											{#if todo.done}
												<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
													<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
												</svg>
											{:else if blocked}
												<svg class="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
													<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
												</svg>
											{/if}
										</button>
										<button
											class="flex flex-1 flex-col items-start gap-1 text-left {blocked ? 'opacity-50' : ''}"
											onclick={() => openDetailModal(todo)}
										>
											<span class="text-sm font-semibold {todo.done ? 'text-gray-400 line-through' : blocked ? 'text-gray-400' : 'text-gray-700'}">
												{todo.task}
											</span>
											{#if blocked && blocker}
												<span class="rounded-md bg-gray-200 px-1.5 py-0.5 text-xs font-bold text-gray-500">
													🔒 Blocked by: {blocker.task}
												</span>
											{:else}
												<span class="rounded-md px-1.5 py-0.5 text-xs font-bold {priorityBadge[p]}">
													{priorityLabel[p]}
												</span>
											{/if}
										</button>
										<button
											class="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400 active:scale-90"
											onclick={() => deleteTodo(todo.id)}
											aria-label="Delete todo"
										>
											<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Archived toggle + section -->
			{#if archivedProjectsList.length > 0}
				<button
					onclick={() => (showArchived = !showArchived)}
					class="mt-5 w-full rounded-2xl border-2 border-dashed border-gray-200 py-3 text-sm font-bold text-gray-400 transition-colors hover:border-gray-300"
				>
					{showArchived ? '▲ Hide' : '▼ Show'} Archived ({archivedProjectsList.length})
				</button>

				{#if showArchived}
					<div class="mt-3 flex flex-col gap-4 opacity-60">
						{#each archivedProjectsList as project (project)}
							{@const todos = grouped()[project]}
							{@const doneCnt = todos.filter((t) => t.done).length}
							<div class="overflow-hidden rounded-2xl bg-white shadow-sm">
								<div class="flex items-center {getProjectColor(project)}">
									<button
										class="flex flex-1 items-center gap-2 px-4 py-3 text-base font-bold"
										onclick={() => toggleCollapse(project)}
									>
										<span>{collapsed[project] ? '▶' : '▼'}</span>
										{project}
										<span class="rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold text-gray-500">archived</span>
									</button>
									<span class="rounded-full bg-white/60 px-2 py-0.5 text-xs font-extrabold mr-2">{doneCnt}/{todos.length} done</span>
									<button
										class="ml-1 mr-3 rounded-lg bg-white/60 px-2 py-1 text-xs font-bold"
										onclick={() => openDetails(project)}
									>•••</button>
								</div>
								<div class="h-1.5 w-full bg-gray-100">
									<div class="h-full transition-all {barColor(todos.length > 0 ? Math.round((doneCnt / todos.length) * 100) : 0)}" style="width: {todos.length > 0 ? Math.round((doneCnt / todos.length) * 100) : 0}%"></div>
								</div>
								{#if !collapsed[project]}
									<div class="divide-y divide-gray-50">
										{#each todos as todo (todo.id)}
											{@const p = todo.priority ?? 'medium'}
											<div class="flex items-center gap-3 px-4 py-3">
												<span class="text-sm font-semibold text-gray-400 {todo.done ? 'line-through' : ''} flex-1">{todo.task}</span>
												<span class="rounded-md px-1.5 py-0.5 text-xs font-bold {priorityBadge[p]}">{priorityLabel[p]}</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		{/if}
	</div>
</div>

<!-- Add Task Modal -->
<Modal bind:open={addOpen} title="New Task ✏️">
	<div class="flex flex-col gap-4">
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600" for="project-input">Project</label>
			<div class="relative">
				<input
					id="project-input"
					type="text"
					bind:value={newProject}
					onfocus={() => (showProjectDropdown = true)}
					onblur={() => setTimeout(() => (showProjectDropdown = false), 150)}
					placeholder="e.g. Sticker Sheet"
					class="w-full rounded-xl border-2 border-pink-100 bg-pink-50 px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-pink-400"
				/>
				{#if showProjectDropdown && existingProjects.length > 0}
					<div class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-pink-100 bg-white shadow-lg">
						{#each existingProjects as p (p)}
							<button
								class="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-pink-50"
								onmousedown={() => { newProject = p; showProjectDropdown = false; }}
							>{p}</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600" for="task-input">Task</label>
			<textarea id="task-input" bind:value={newTask} placeholder="What needs to be done?" rows="3"
				class="w-full resize-none rounded-xl border-2 border-pink-100 bg-pink-50 px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-pink-400"></textarea>
		</div>
		<div>
			<p class="mb-2 text-sm font-bold text-gray-600">Priority</p>
			<div class="flex gap-2">
				{#each (['high', 'medium', 'low'] as Priority[]) as p (p)}
					<button
						class="flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition-all {newPriority === p
							? p === 'high' ? 'border-red-300 bg-red-100 text-red-600'
							: p === 'medium' ? 'border-amber-300 bg-amber-100 text-amber-600'
							: 'border-sky-300 bg-sky-100 text-sky-600'
							: 'border-gray-100 bg-gray-50 text-gray-400'}"
						onclick={() => (newPriority = p)}
					>
						{p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🔵'}
						{p.charAt(0).toUpperCase() + p.slice(1)}
					</button>
				{/each}
			</div>
		</div>
		<button
			onclick={handleAdd}
			disabled={!newProject.trim() || !newTask.trim() || saving}
			class="mt-1 w-full rounded-2xl bg-pink-500 py-4 text-base font-extrabold text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
		>
			{saving ? 'Adding...' : 'Add Task ✨'}
		</button>
	</div>
</Modal>

<!-- Project Details Modal -->
<Modal bind:open={detailsOpen} title="Project Details">
	{@const todos = grouped()[detailsProject] ?? []}
	{@const doneCnt = todos.filter((t) => t.done).length}
	{@const curProjPriority = projectPrioritiesStore.priorities[detailsProject]}
	{@const isArchived = archivedProjectsStore.archived.has(detailsProject)}
	<div class="flex flex-col gap-4">
		<div class="rounded-2xl bg-gray-50 px-4 py-4 flex flex-col gap-2">
			<p class="text-lg font-black text-gray-800">{detailsProject}</p>
			<p class="text-sm font-semibold text-gray-500">{todos.length} task{todos.length === 1 ? '' : 's'} · {doneCnt} done</p>
		</div>

		<!-- Rename -->
		<div>
			<p class="mb-2 text-xs font-black uppercase tracking-wide text-gray-400">Rename Project</p>
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={renameInput}
					placeholder={detailsProject}
					class="flex-1 rounded-xl border-2 border-pink-100 bg-pink-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-pink-400"
					onkeydown={(e) => e.key === 'Enter' && handleRename()}
				/>
				<button
					onclick={handleRename}
					disabled={renaming || !renameInput.trim() || renameInput.trim() === detailsProject}
					class="rounded-xl bg-pink-500 px-3 py-2.5 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-40"
				>{renaming ? '…' : 'Save'}</button>
			</div>
			<p class="mt-1 text-xs text-gray-400">Renames across tasks, stock, and events</p>
		</div>

		<!-- Project priority -->
		<div>
			<p class="mb-2 text-xs font-black uppercase tracking-wide text-gray-400">Project Priority</p>
			<div class="flex gap-2">
				{#each (['high', 'medium', 'low'] as Priority[]) as p (p)}
					<button
						class="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border-2 py-3 text-sm font-bold transition-all active:scale-95 {curProjPriority === p
							? p === 'high' ? 'border-red-300 bg-red-100 text-red-600'
							: p === 'medium' ? 'border-amber-300 bg-amber-100 text-amber-600'
							: 'border-sky-300 bg-sky-100 text-sky-600'
							: 'border-gray-100 bg-white text-gray-400'}"
						onclick={() => curProjPriority === p ? clearProjectPriority(detailsProject) : setProjectPriority(detailsProject, p)}
					>
						<span>{p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🔵'}</span>
						<span class="text-xs">{p.charAt(0).toUpperCase() + p.slice(1)}</span>
					</button>
				{/each}
			</div>
			{#if curProjPriority}
				<p class="mt-1.5 text-center text-xs text-gray-400">Tap active to clear</p>
			{/if}
		</div>

		<!-- Archive / Unarchive -->
		<button
			onclick={handleArchiveToggle}
			class="w-full rounded-2xl border-2 py-3.5 text-sm font-extrabold transition-all active:scale-95
				{isArchived ? 'border-teal-200 bg-teal-50 text-teal-600' : 'border-amber-100 bg-amber-50 text-amber-600'}"
		>
			{isArchived ? '📂 Unarchive Project' : '🗄️ Archive Project'}
		</button>

		<!-- Delete -->
		<button
			onclick={handleDeleteProject}
			disabled={deleting}
			class="w-full rounded-2xl border-2 py-4 text-base font-extrabold transition-all active:scale-95 disabled:opacity-50
				{confirmDelete ? 'border-red-400 bg-red-500 text-white' : 'border-red-100 bg-red-50 text-red-400'}"
		>
			{deleting ? 'Deleting...' : confirmDelete ? '⚠️ Confirm — delete all tasks?' : 'Delete Project'}
		</button>
		{#if confirmDelete}
			<button
				onclick={() => (confirmDelete = false)}
				class="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 py-3 text-sm font-bold text-gray-400"
			>Cancel</button>
		{/if}
	</div>
</Modal>

<!-- Task Details Modal -->
<Modal bind:open={detailTodoOpen} title="Task Details">
	{#if selectedTodo}
		<div class="flex flex-col gap-4">
			<div>
				<p class="mb-1.5 text-xs font-black uppercase tracking-wide text-gray-400">Task Name</p>
				<div class="flex gap-2">
					<textarea
						bind:value={editTaskName}
						rows="2"
						class="flex-1 resize-none rounded-xl border-2 border-pink-100 bg-pink-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-pink-400"
						onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveTaskName(); } }}
					></textarea>
					<button
						onclick={handleSaveTaskName}
						disabled={savingName || !editTaskName.trim() || editTaskName.trim() === selectedTodo.task}
						class="self-stretch rounded-xl bg-pink-500 px-3 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-40"
					>{savingName ? '…' : 'Save'}</button>
				</div>
			</div>

			<div>
				<p class="mb-2 text-xs font-black uppercase tracking-wide text-gray-400">Priority</p>
				<div class="flex flex-col gap-2">
					{#each (['high', 'medium', 'low'] as Priority[]) as p (p)}
						{@const active = (selectedTodo.priority ?? 'medium') === p}
						<button
							class="flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition-all active:scale-95 {active
								? p === 'high' ? 'border-red-300 bg-red-50 text-red-600'
								: p === 'medium' ? 'border-amber-300 bg-amber-50 text-amber-600'
								: 'border-sky-300 bg-sky-50 text-sky-600'
								: 'border-gray-100 bg-white text-gray-500'}"
							onclick={() => setPriority(p)}
						>
							<span>{p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🔵'}</span>
							<div>
								<div>{p.charAt(0).toUpperCase() + p.slice(1)}</div>
								<div class="text-xs font-semibold opacity-60">
									{p === 'high' ? 'Do this first' : p === 'medium' ? 'Get to it soon' : 'Whenever you can'}
								</div>
							</div>
							{#if active}<span class="ml-auto text-base">✓</span>{/if}
						</button>
					{/each}
				</div>
			</div>

			<div>
				<p class="mb-2 text-xs font-black uppercase tracking-wide text-gray-400">Blocked By</p>
				{#if blockerTodo}
					<div class="flex items-center gap-2 rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3">
						<span class="text-base">🔒</span>
						<div class="flex flex-1 flex-col">
							<span class="text-sm font-bold text-gray-700">{blockerTodo.task}</span>
							<span class="text-xs text-gray-400">{blockerTodo.project}</span>
						</div>
						<button
							class="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-400 active:scale-95"
							onclick={() => handleSetBlocker(null)}
						>Remove</button>
					</div>
				{:else if !blockerPickerOpen}
					<button
						class="w-full rounded-2xl border-2 border-dashed border-gray-200 py-3 text-sm font-bold text-gray-400 transition-colors hover:border-pink-300 hover:text-pink-400"
						onclick={() => (blockerPickerOpen = true)}
					>+ Set a blocker</button>
				{/if}
				{#if blockerPickerOpen}
					<div class="mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50 p-2">
						{#if blockerCandidates.length === 0}
							<p class="py-2 text-center text-xs text-gray-400">No other open tasks</p>
						{:else}
							{#each blockerCandidates as candidate (candidate.id)}
								<button
									class="flex flex-col items-start rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-700 hover:bg-white active:scale-95"
									onclick={() => handleSetBlocker(candidate.id)}
								>
									<span>{candidate.task}</span>
									<span class="text-xs font-normal text-gray-400">{candidate.project}</span>
								</button>
							{/each}
						{/if}
						<button
							class="mt-1 w-full rounded-xl py-2 text-xs font-bold text-gray-400 hover:bg-white"
							onclick={() => (blockerPickerOpen = false)}
						>Cancel</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</Modal>
