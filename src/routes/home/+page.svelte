<script lang="ts">
	import { linksStore, addLink, deleteLink } from '$lib/stores/links.svelte';
	import { todosStore, toggleTodo } from '$lib/stores/todos.svelte';
	import { projectPrioritiesStore } from '$lib/stores/projectPriorities.svelte';

	// ── Links ──
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

	// ── Next Up carousel ──
	const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
	const PROJECT_PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

	function isBlocked(todoId: string): boolean {
		const todo = todosStore.todos.find((t) => t.id === todoId);
		if (!todo?.blockedBy) return false;
		const blocker = todosStore.todos.find((t) => t.id === todo.blockedBy);
		return !!blocker && !blocker.done;
	}

	// Sorted projects (by project priority, then alpha)
	const sortedProjects = $derived(() => {
		const projectNames = [...new Set(todosStore.todos.map((t) => t.project))];
		return projectNames.sort((a, b) => {
			const pa = PROJECT_PRIORITY_ORDER[projectPrioritiesStore.priorities[a] ?? ''] ?? 3;
			const pb = PROJECT_PRIORITY_ORDER[projectPrioritiesStore.priorities[b] ?? ''] ?? 3;
			if (pa !== pb) return pa - pb;
			return a.localeCompare(b);
		});
	});

	// For each project, find the highest priority non-blocked non-done task
	function topTask(project: string) {
		const tasks = todosStore.todos
			.filter((t) => t.project === project && !t.done && !isBlocked(t.id))
			.sort((a, b) => {
				const pa = PRIORITY_ORDER[a.priority ?? 'medium'];
				const pb = PRIORITY_ORDER[b.priority ?? 'medium'];
				return pa - pb;
			});
		return tasks[0] ?? null;
	}

	let carouselIndex = $state(0);

	// Clamp index when projects list changes
	$effect(() => {
		const len = sortedProjects().length;
		if (carouselIndex >= len && len > 0) carouselIndex = len - 1;
	});

	function prev() {
		const len = sortedProjects().length;
		carouselIndex = (carouselIndex - 1 + len) % len;
	}
	function next() {
		const len = sortedProjects().length;
		carouselIndex = (carouselIndex + 1) % len;
	}

	const priorityBadge: Record<string, string> = {
		high: 'bg-red-100 text-red-500',
		medium: 'bg-amber-100 text-amber-500',
		low: 'bg-sky-100 text-sky-500'
	};
	const priorityLabel: Record<string, string> = {
		high: '🔴 High', medium: '🟡 Medium', low: '🔵 Low'
	};
	const projPriorityBorder: Record<string, string> = {
		high: 'border-red-200',
		medium: 'border-amber-200',
		low: 'border-sky-200'
	};
</script>

<div class="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-violet-50 px-4 pt-8 pb-6">
	<div class="mx-auto max-w-md flex flex-col gap-8">

		<!-- ── Next Up ── -->
		{#if !todosStore.loading && sortedProjects().length > 0}
			{@const projects = sortedProjects()}
			{@const project = projects[carouselIndex]}
			{@const task = topTask(project)}
			{@const pp = projectPrioritiesStore.priorities[project]}
			<div>
				<h2 class="mb-3 text-lg font-black text-pink-600">Next Up 🎯</h2>
				<div class="rounded-2xl border-2 bg-white p-5 shadow-sm {pp ? projPriorityBorder[pp] : 'border-transparent'}">
					<!-- Project name + priority -->
					<div class="mb-3 flex items-center gap-2">
						<span class="text-base font-black text-gray-800">{project}</span>
						{#if pp}
							<span class="rounded-full px-2 py-0.5 text-xs font-bold {priorityBadge[pp]}">
								{pp === 'high' ? '🔴' : pp === 'medium' ? '🟡' : '🔵'} {pp.charAt(0).toUpperCase() + pp.slice(1)}
							</span>
						{/if}
						<span class="ml-auto text-xs text-gray-400">{carouselIndex + 1} / {projects.length}</span>
					</div>

					<!-- Top task -->
					{#if task}
						<div class="rounded-xl bg-gray-50 px-4 py-3">
							<div class="flex items-start gap-3">
								<button
									onclick={() => toggleTodo(task.id, true)}
									class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 transition-all hover:border-pink-400 active:scale-90"
									aria-label="Mark done"
								></button>
								<div class="flex-1">
									<p class="text-sm font-semibold text-gray-700">{task.task}</p>
									<span class="mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-xs font-bold {priorityBadge[task.priority ?? 'medium']}">
										{priorityLabel[task.priority ?? 'medium']}
									</span>
								</div>
							</div>
						</div>
					{:else}
						<div class="rounded-xl bg-gray-50 px-4 py-3 text-center">
							<p class="text-sm font-semibold text-gray-400">All done! 🎉</p>
						</div>
					{/if}

					<!-- Arrows -->
					{#if projects.length > 1}
						<div class="mt-4 flex items-center justify-center gap-6">
							<button
								onclick={prev}
								class="flex h-9 w-9 items-center justify-center rounded-full bg-pink-100 text-pink-500 font-bold transition-transform active:scale-90"
							>‹</button>
							<div class="flex gap-1.5">
								{#each projects as _, i (i)}
									<span class="h-1.5 rounded-full transition-all {i === carouselIndex ? 'w-4 bg-pink-400' : 'w-1.5 bg-pink-200'}"></span>
								{/each}
							</div>
							<button
								onclick={next}
								class="flex h-9 w-9 items-center justify-center rounded-full bg-pink-100 text-pink-500 font-bold transition-transform active:scale-90"
							>›</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- ── Quick Links ── -->
		<div>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-lg font-black text-pink-600">Quick Links 🔗</h2>
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
							if (!showForm) { label = ''; url = ''; }
						}}
						class="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500 text-xl font-bold text-white shadow-md transition-transform active:scale-95"
					>
						{showForm ? '✕' : '+'}
					</button>
				</div>
			</div>

			<!-- Add form -->
			{#if showForm}
				<div class="mb-4 rounded-2xl bg-white p-4 shadow-md">
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
				<div class="flex justify-center py-8">
					<div class="h-8 w-8 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500"></div>
				</div>
			{:else if linksStore.links.length === 0}
				<div class="flex flex-col items-center gap-3 py-10 text-center">
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
								>✕</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

	</div>
</div>
