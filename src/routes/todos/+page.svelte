<script lang="ts">
	import { todosStore, addTodo, toggleTodo, deleteTodo, updateTodoPriority, deleteProject, type Priority, type Todo } from '$lib/stores/todos.svelte';
	import Modal from '$lib/components/Modal.svelte';

	const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

	// Derived: group todos by project, sorted high→low within each
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

	const projects = $derived(Object.keys(grouped()));

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

	// ── Priority modal (tap existing task) ──
	let priorityOpen = $state(false);
	let selectedTodo = $state<Todo | null>(null);

	function openPriorityModal(todo: Todo) {
		selectedTodo = todo;
		priorityOpen = true;
	}

	async function setPriority(p: Priority) {
		if (!selectedTodo) return;
		await updateTodoPriority(selectedTodo.id, p);
		priorityOpen = false;
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
		const idx = projects.indexOf(project) % projectColors.length;
		return projectColors[idx < 0 ? 0 : idx];
	}

	// ── Priority display ──
	const priorityBadge: Record<Priority, string> = {
		high:   'bg-red-100 text-red-500',
		medium: 'bg-amber-100 text-amber-500',
		low:    'bg-sky-100 text-sky-500'
	};
	const priorityLabel: Record<Priority, string> = {
		high: '🔴 High', medium: '🟡 Medium', low: '🔵 Low'
	};

	// ── Project details modal ──
	let detailsOpen = $state(false);
	let detailsProject = $state('');
	let confirmDelete = $state(false);
	let deleting = $state(false);

	function openDetails(project: string) {
		detailsProject = project;
		confirmDelete = false;
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

	// ── Collapsible ──
	let collapsed = $state<Record<string, boolean>>({});
	function toggleCollapse(project: string) {
		collapsed[project] = !collapsed[project];
	}
</script>

<div class="min-h-screen">
	<!-- Header -->
	<div class="bg-gradient-to-br from-pink-400 to-rose-400 px-5 pb-6 pt-12 text-white shadow-md">
		<h1 class="text-3xl font-black">✨ My Projects</h1>
		<p class="mt-1 text-sm font-semibold text-pink-100">
			{todosStore.todos.filter((t) => t.done).length} / {todosStore.todos.length} done
		</p>
	</div>

	<!-- Content -->
	<div class="px-4 py-5">
		{#if todosStore.loading}
			<div class="flex justify-center py-12">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500"></div>
			</div>
		{:else if projects.length === 0}
			<div class="flex flex-col items-center gap-4 py-16 text-center">
				<span class="text-6xl">🌸</span>
				<p class="text-lg font-bold text-gray-500">No projects yet!</p>
				<p class="text-sm text-gray-400">Tap + to add your first task</p>
			</div>
		{:else}
			<div class="flex flex-col gap-4">
				{#each projects as project (project)}
					{@const todos = grouped()[project]}
					{@const doneCnt = todos.filter((t) => t.done).length}
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
								{doneCnt}/{todos.length}
							</span>
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

						<!-- Todo items -->
						{#if !collapsed[project]}
							<div class="divide-y divide-gray-50">
								{#each todos as todo (todo.id)}
									{@const p = todo.priority ?? 'medium'}
									<div class="flex items-center gap-3 px-4 py-3 {todo.done ? 'bg-gray-50' : 'bg-white'}">
										<!-- Checkbox -->
										<button
											class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all {todo.done
												? 'border-pink-400 bg-pink-400 text-white'
												: 'border-gray-300 hover:border-pink-300'}"
											onclick={() => toggleTodo(todo.id, !todo.done)}
											aria-label="Toggle todo"
										>
											{#if todo.done}
												<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
													<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
												</svg>
											{/if}
										</button>

										<!-- Task text — tap to set priority -->
										<button
											class="flex flex-1 flex-col items-start gap-1 text-left"
											onclick={() => openPriorityModal(todo)}
										>
											<span class="text-sm font-semibold {todo.done ? 'text-gray-400 line-through' : 'text-gray-700'}">
												{todo.task}
											</span>
											<span class="rounded-md px-1.5 py-0.5 text-xs font-bold {priorityBadge[p]}">
												{priorityLabel[p]}
											</span>
										</button>

										<!-- Delete -->
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
		{/if}
	</div>
</div>

<!-- FAB -->
<button
	onclick={() => openAddModal()}
	class="fixed right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-pink-500 text-3xl font-black text-white shadow-lg transition-transform active:scale-90"
	style="bottom: calc(4.5rem + env(safe-area-inset-bottom))"
	aria-label="Add todo"
>+</button>

<!-- Add Task Modal -->
<Modal bind:open={addOpen} title="New Task ✏️">
	<div class="flex flex-col gap-4">
		<!-- Project -->
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

		<!-- Task -->
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600" for="task-input">Task</label>
			<textarea
				id="task-input"
				bind:value={newTask}
				placeholder="What needs to be done?"
				rows="3"
				class="w-full resize-none rounded-xl border-2 border-pink-100 bg-pink-50 px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-pink-400"
			></textarea>
		</div>

		<!-- Priority -->
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
	<div class="flex flex-col gap-4">
		<div class="rounded-2xl bg-gray-50 px-4 py-4 flex flex-col gap-2">
			<p class="text-lg font-black text-gray-800">{detailsProject}</p>
			<p class="text-sm font-semibold text-gray-500">{todos.length} task{todos.length === 1 ? '' : 's'} · {doneCnt} done</p>
		</div>
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

<!-- Priority Modal (tap existing task) -->
<Modal bind:open={priorityOpen} title="Set Priority">
	{#if selectedTodo}
		<div class="flex flex-col gap-3">
			<p class="rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
				{selectedTodo.task}
			</p>
			{#each (['high', 'medium', 'low'] as Priority[]) as p (p)}
				{@const active = (selectedTodo.priority ?? 'medium') === p}
				<button
					class="flex items-center gap-3 rounded-2xl border-2 px-5 py-4 text-left text-base font-bold transition-all active:scale-95 {active
						? p === 'high' ? 'border-red-300 bg-red-50 text-red-600'
						: p === 'medium' ? 'border-amber-300 bg-amber-50 text-amber-600'
						: 'border-sky-300 bg-sky-50 text-sky-600'
						: 'border-gray-100 bg-white text-gray-500'}"
					onclick={() => setPriority(p)}
				>
					<span class="text-xl">{p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🔵'}</span>
					<div>
						<div>{p.charAt(0).toUpperCase() + p.slice(1)}</div>
						<div class="text-xs font-semibold opacity-60">
							{p === 'high' ? 'Do this first' : p === 'medium' ? 'Get to it soon' : 'Whenever you can'}
						</div>
					</div>
					{#if active}<span class="ml-auto text-lg">✓</span>{/if}
				</button>
			{/each}
		</div>
	{/if}
</Modal>
