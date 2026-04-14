<script lang="ts">
	import {
		eventsStore,
		addEvent,
		updateEvent,
		deleteEvent,
		toggleApplied,
		type ArtEvent
	} from '$lib/stores/events.svelte';
	import Modal from '$lib/components/Modal.svelte';

	// Filter state
	let filterStatus = $state<'all' | 'applied' | 'not-applied'>('all');
	let searchQuery = $state('');

	// Filtered events
	const filtered = $derived(() => {
		return eventsStore.events.filter((e) => {
			const matchStatus =
				filterStatus === 'all' ||
				(filterStatus === 'applied' && e.applied) ||
				(filterStatus === 'not-applied' && !e.applied);
			const q = searchQuery.toLowerCase();
			const matchSearch =
				!q || e.name.toLowerCase().includes(q) || e.location.toLowerCase().includes(q);
			return matchStatus && matchSearch;
		});
	});

	// Expanded cards
	let expanded = $state<Record<string, boolean>>({});
	function toggleExpand(id: string) {
		expanded[id] = !expanded[id];
	}

	// Add/Edit modal
	let modalOpen = $state(false);
	let editingEvent = $state<ArtEvent | null>(null);

	// Form state
	let form = $state({
		name: '',
		date: '',
		location: '',
		applied: false,
		requirements: [] as string[],
		links: [] as string[],
		cost: '',
		travelCost: '',
		notes: ''
	});
	let newRequirement = $state('');
	let newLink = $state('');
	let saving = $state(false);

	function openAdd() {
		editingEvent = null;
		form = {
			name: '',
			date: '',
			location: '',
			applied: false,
			requirements: [],
			links: [],
			cost: '',
			travelCost: '',
			notes: ''
		};
		newRequirement = '';
		newLink = '';
		modalOpen = true;
	}

	function openEdit(event: ArtEvent) {
		editingEvent = event;
		form = {
			name: event.name,
			date: event.date,
			location: event.location,
			applied: event.applied,
			requirements: [...event.requirements],
			links: [...event.links],
			cost: event.cost != null ? String(event.cost) : '',
			travelCost: event.travelCost != null ? String(event.travelCost) : '',
			notes: event.notes
		};
		newRequirement = '';
		newLink = '';
		modalOpen = true;
	}

	function addRequirement() {
		if (newRequirement.trim()) {
			form.requirements = [...form.requirements, newRequirement.trim()];
			newRequirement = '';
		}
	}

	function removeRequirement(i: number) {
		form.requirements = form.requirements.filter((_, idx) => idx !== i);
	}

	function addLink() {
		if (newLink.trim()) {
			form.links = [...form.links, newLink.trim()];
			newLink = '';
		}
	}

	function removeLink(i: number) {
		form.links = form.links.filter((_, idx) => idx !== i);
	}

	async function handleSave() {
		if (!form.name.trim() || !form.date) return;
		saving = true;
		try {
			const data = {
				name: form.name.trim(),
				date: form.date,
				location: form.location.trim(),
				applied: form.applied,
				requirements: form.requirements,
				links: form.links,
				cost: form.cost ? Number(form.cost) : null,
				travelCost: form.travelCost ? Number(form.travelCost) : null,
				notes: form.notes.trim()
			};
			if (editingEvent) {
				await updateEvent(editingEvent.id, data);
			} else {
				await addEvent(data);
			}
			modalOpen = false;
		} finally {
			saving = false;
		}
	}

	async function handleDelete(id: string) {
		await deleteEvent(id);
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return '';
		const [y, m, d] = dateStr.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="min-h-screen">
	<!-- Header -->
	<div
		class="bg-gradient-to-br from-violet-400 to-purple-500 px-5 pb-5 pt-12 text-white shadow-md"
	>
		<div class="flex items-center gap-3">
			<img src="/logo!.png" alt="logo" class="h-10 w-10 object-contain drop-shadow" />
			<h1 class="text-3xl font-black">Events</h1>
		</div>
		<p class="mt-1 text-sm font-semibold text-violet-100">
			{eventsStore.events.filter((e) => e.applied).length} applied of {eventsStore.events.length} total
		</p>

		<!-- Search -->
		<div class="mt-3">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search by name or location..."
				class="w-full rounded-xl bg-white/20 px-4 py-2.5 text-sm font-semibold text-white placeholder-white/60 outline-none focus:bg-white/30"
			/>
		</div>
	</div>

	<!-- Filter chips -->
	<div class="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
		{#each [['all', '✨ All'], ['applied', '✅ Applied'], ['not-applied', '⏳ Not Applied']] as [val, label] (val)}
			<button
				class="shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition-all {filterStatus ===
				val
					? 'bg-violet-500 text-white shadow-md'
					: 'bg-white text-gray-500 shadow-sm'}"
				onclick={() => (filterStatus = val as typeof filterStatus)}
			>
				{label}
			</button>
		{/each}
	</div>

	<!-- Event list -->
	<div class="px-4 pb-4">
		{#if eventsStore.loading}
			<div class="flex justify-center py-12">
				<div
					class="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-500"
				></div>
			</div>
		{:else if filtered().length === 0}
			<div class="flex flex-col items-center gap-4 py-16 text-center">
				<span class="text-6xl">🌷</span>
				<p class="text-lg font-bold text-gray-500">
					{eventsStore.events.length === 0 ? 'No events yet!' : 'No events match your filter'}
				</p>
				{#if eventsStore.events.length === 0}
					<p class="text-sm text-gray-400">Tap + to track your first event</p>
				{/if}
			</div>
		{:else}
			<div class="flex flex-col gap-3">
				{#each filtered() as event (event.id)}
					<div class="overflow-hidden rounded-2xl bg-white shadow-sm">
						<!-- Card header -->
						<div class="px-4 pt-4">
							<div class="flex items-start justify-between gap-2">
								<h3 class="text-base font-extrabold leading-snug text-gray-800">{event.name}</h3>
								<!-- Applied toggle -->
								<button
									onclick={() => toggleApplied(event.id, !event.applied)}
									class="shrink-0 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all active:scale-90 {event.applied
										? 'bg-emerald-100 text-emerald-600'
										: 'border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400'}"
								>
									{event.applied ? '✅ Applied' : 'Apply?'}
								</button>
							</div>

							<!-- Date + Location -->
							<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
								{#if event.date}
									<span class="flex items-center gap-1 text-sm font-semibold text-gray-500">
										📅 {formatDate(event.date)}
									</span>
								{/if}
								{#if event.location}
									<span class="flex items-center gap-1 text-sm font-semibold text-gray-500">
										📍 {event.location}
									</span>
								{/if}
							</div>

							<!-- Costs -->
							{#if event.cost != null || event.travelCost != null}
								<div class="mt-2 flex flex-wrap gap-2">
									{#if event.cost != null}
										<span
											class="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-600"
										>
											💰 ${event.cost}
										</span>
									{/if}
									{#if event.travelCost != null}
										<span
											class="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-600"
										>
											✈️ ~${event.travelCost}
										</span>
									{/if}
								</div>
							{/if}
						</div>

						<!-- Card footer row -->
						<div class="mt-2 flex items-center border-t border-gray-50">
							<button
								class="flex flex-1 items-center gap-1 px-4 py-3 text-xs font-bold text-gray-400 hover:bg-gray-50 active:bg-gray-100"
								onclick={() => toggleExpand(event.id)}
							>
								{expanded[event.id] ? 'Hide details ▲' : 'Show details ▼'}
							</button>
							<div class="flex gap-1 px-2">
								<button
									class="rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-500 transition-colors hover:bg-violet-100"
									onclick={() => openEdit(event)}
								>
									Edit
								</button>
								<button
									class="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-100"
									onclick={() => handleDelete(event.id)}
								>
									Delete
								</button>
							</div>
						</div>

						<!-- Expanded details -->
						{#if expanded[event.id]}
							<div class="border-t border-gray-50 px-4 pb-4 pt-3">
								{#if event.requirements.length > 0}
									<div class="mb-3">
										<p class="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-gray-400">
											Requirements
										</p>
										<ul class="flex flex-col gap-1">
											{#each event.requirements as req (req)}
												<li class="flex items-start gap-2 text-sm font-semibold text-gray-600">
													<span class="mt-0.5 text-violet-400">•</span>
													{req}
												</li>
											{/each}
										</ul>
									</div>
								{/if}

								{#if event.links.length > 0}
									<div class="mb-3">
										<p class="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-gray-400">
											Links
										</p>
										<div class="flex flex-col gap-1">
											{#each event.links as link (link)}
												<a
													href={link}
													target="_blank"
													rel="noopener noreferrer"
													class="truncate text-sm font-semibold text-violet-500 underline"
												>
													{link}
												</a>
											{/each}
										</div>
									</div>
								{/if}

								{#if event.notes}
									<div>
										<p class="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-gray-400">
											Notes
										</p>
										<p class="whitespace-pre-wrap text-sm font-semibold text-gray-600">
											{event.notes}
										</p>
									</div>
								{/if}

								{#if !event.requirements.length && !event.links.length && !event.notes}
									<p class="text-sm text-gray-400">No extra details.</p>
								{/if}
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
	onclick={openAdd}
	class="fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500 text-2xl text-white shadow-lg transition-transform active:scale-90"
	style="bottom: calc(4.5rem + env(safe-area-inset-bottom))"
	aria-label="Add event"
>
	+
</button>

<!-- Add / Edit Event Modal -->
<Modal bind:open={modalOpen} title={editingEvent ? 'Edit Event ✏️' : 'New Event 🎪'}>
	<div class="flex flex-col gap-4">
		<!-- Name -->
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600" for="event-name">
				Event Name *
			</label>
			<input
				id="event-name"
				type="text"
				bind:value={form.name}
				placeholder="e.g. Anime Expo 2025"
				class="w-full rounded-xl border-2 border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-violet-400"
			/>
		</div>

		<!-- Date + Location row -->
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1.5 block text-sm font-bold text-gray-600" for="event-date">
					Date *
				</label>
				<input
					id="event-date"
					type="date"
					bind:value={form.date}
					class="w-full rounded-xl border-2 border-violet-100 bg-violet-50 px-3 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-violet-400"
				/>
			</div>
			<div>
				<label class="mb-1.5 block text-sm font-bold text-gray-600" for="event-location">
					Location
				</label>
				<input
					id="event-location"
					type="text"
					bind:value={form.location}
					placeholder="City, State"
					class="w-full rounded-xl border-2 border-violet-100 bg-violet-50 px-3 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-violet-400"
				/>
			</div>
		</div>

		<!-- Applied toggle -->
		<button
			onclick={() => (form.applied = !form.applied)}
			class="flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-all {form.applied
				? 'border-emerald-200 bg-emerald-50'
				: 'border-gray-100 bg-gray-50'}"
		>
			<span class="text-sm font-bold {form.applied ? 'text-emerald-600' : 'text-gray-500'}">
				{form.applied ? '✅ Applied!' : 'Mark as Applied'}
			</span>
			<div
				class="h-6 w-11 rounded-full transition-colors {form.applied
					? 'bg-emerald-400'
					: 'bg-gray-200'} relative"
			>
				<div
					class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all {form.applied
						? 'left-[1.375rem]'
						: 'left-0.5'}"
				></div>
			</div>
		</button>

		<!-- Costs -->
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1.5 block text-sm font-bold text-gray-600" for="event-cost">
					Event Cost ($)
				</label>
				<input
					id="event-cost"
					type="number"
					bind:value={form.cost}
					placeholder="0"
					min="0"
					class="w-full rounded-xl border-2 border-amber-100 bg-amber-50 px-3 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-amber-400"
				/>
			</div>
			<div>
				<label class="mb-1.5 block text-sm font-bold text-gray-600" for="travel-cost">
					Travel Cost ($)
				</label>
				<input
					id="travel-cost"
					type="number"
					bind:value={form.travelCost}
					placeholder="optional"
					min="0"
					class="w-full rounded-xl border-2 border-sky-100 bg-sky-50 px-3 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-sky-400"
				/>
			</div>
		</div>

		<!-- Requirements -->
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600">Requirements</label>
			{#each form.requirements as req, i (i)}
				<div class="mb-1.5 flex items-center gap-2">
					<span class="flex-1 rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-gray-700"
						>{req}</span
					>
					<button
						class="rounded-lg p-1.5 text-red-300 hover:text-red-500"
						onclick={() => removeRequirement(i)}
						aria-label="Remove"
					>
						✕
					</button>
				</div>
			{/each}
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={newRequirement}
					placeholder="Add a requirement..."
					onkeydown={(e) => e.key === 'Enter' && addRequirement()}
					class="flex-1 rounded-xl border-2 border-violet-100 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-violet-400"
				/>
				<button
					onclick={addRequirement}
					class="rounded-xl bg-violet-100 px-3 py-2.5 text-sm font-bold text-violet-600 hover:bg-violet-200"
				>
					Add
				</button>
			</div>
		</div>

		<!-- Links -->
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600">Links</label>
			{#each form.links as link, i (i)}
				<div class="mb-1.5 flex items-center gap-2">
					<span class="flex-1 truncate rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-600"
						>{link}</span
					>
					<button
						class="rounded-lg p-1.5 text-red-300 hover:text-red-500"
						onclick={() => removeLink(i)}
						aria-label="Remove"
					>
						✕
					</button>
				</div>
			{/each}
			<div class="flex gap-2">
				<input
					type="url"
					bind:value={newLink}
					placeholder="https://..."
					onkeydown={(e) => e.key === 'Enter' && addLink()}
					class="flex-1 rounded-xl border-2 border-violet-100 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-violet-400"
				/>
				<button
					onclick={addLink}
					class="rounded-xl bg-violet-100 px-3 py-2.5 text-sm font-bold text-violet-600 hover:bg-violet-200"
				>
					Add
				</button>
			</div>
		</div>

		<!-- Notes -->
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600" for="event-notes">
				Notes
			</label>
			<textarea
				id="event-notes"
				bind:value={form.notes}
				placeholder="Any extra details..."
				rows="3"
				class="w-full resize-none rounded-xl border-2 border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-violet-400"
			></textarea>
		</div>

		<button
			onclick={handleSave}
			disabled={!form.name.trim() || !form.date || saving}
			class="mt-1 w-full rounded-2xl bg-violet-500 py-4 text-base font-extrabold text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
		>
			{saving ? 'Saving...' : editingEvent ? 'Save Changes ✨' : 'Add Event 🎪'}
		</button>
	</div>
</Modal>
