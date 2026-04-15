<script lang="ts">
	import {
		eventsStore,
		addEvent,
		updateEvent,
		deleteEvent,
		updateEventStatus,
		getEventStatus,
		renameProjectInEvents,
		type ArtEvent,
		type EventStatus,
		type EventType
	} from '$lib/stores/events.svelte';
	import { todosStore } from '$lib/stores/todos.svelte';
	import { goto } from '$app/navigation';
	import { cashStore } from '$lib/stores/cashTransactions.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import Modal from '$lib/components/Modal.svelte';

	const today = new Date().toISOString().slice(0, 10);

	const allProjects = $derived([...new Set(todosStore.todos.map((t) => t.project))].sort());

	function eventProgress(event: ArtEvent) {
		if (!event.linkedProjects?.length) return null;
		const tasks = todosStore.todos.filter((t) => event.linkedProjects.includes(t.project));
		if (!tasks.length) return null;
		const done = tasks.filter((t) => t.done).length;
		return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) };
	}

	function progressBarColor(pct: number) {
		if (pct === 0) return 'bg-rose-300';
		if (pct < 50) return 'bg-amber-300';
		if (pct < 100) return 'bg-teal-400';
		return 'bg-emerald-400';
	}

	// ── Filters ──
	type FilterVal = 'all' | 'upcoming' | 'past' | 'applications' | 'applied' | 'accepted' | 'waitlisted' | 'rejected';
	let filterStatus = $state<FilterVal>('all');
	let searchQuery = $state('');

	const filtered = $derived(() => {
		const q = searchQuery.toLowerCase();
		return eventsStore.events.filter((e) => {
			let statusMatch = true;
			if (filterStatus === 'upcoming') statusMatch = !!e.date && e.date >= today;
			else if (filterStatus === 'past') statusMatch = !!e.date && e.date < today;
			else if (filterStatus === 'applications') statusMatch = (e.eventType ?? 'standard') === 'application';
			else if (filterStatus === 'applied') statusMatch = getEventStatus(e) === 'applied';
			else if (filterStatus === 'accepted') statusMatch = getEventStatus(e) === 'accepted';
			else if (filterStatus === 'waitlisted') statusMatch = getEventStatus(e) === 'waitlisted';
			else if (filterStatus === 'rejected') statusMatch = getEventStatus(e) === 'rejected';
			const searchMatch = !q || e.name.toLowerCase().includes(q) || e.location.toLowerCase().includes(q);
			return statusMatch && searchMatch;
		});
	});

	// ── Expanded ──
	let expanded = $state<Record<string, boolean>>({});

	// ── Application outcome confirmations ──
	// 'accepted' | 'rejected' | null per event id
	let confirmOutcome = $state<Record<string, 'accepted' | 'rejected' | null>>({});

	async function handleOutcomeConfirm(eventId: string, outcome: 'accepted' | 'rejected') {
		await updateEventStatus(eventId, outcome);
		delete confirmOutcome[eventId];
	}

	// ── Status picker ──
	let statusPickerOpen = $state(false);
	let statusPickerEventId = $state('');

	function openStatusPicker(eventId: string) {
		statusPickerEventId = eventId;
		statusPickerOpen = true;
	}

	async function handleStatusPick(status: EventStatus) {
		await updateEventStatus(statusPickerEventId, status);
		statusPickerOpen = false;
	}

	const statusCfg: Record<EventStatus, { label: string; cls: string; activeCls: string }> = {
		none: { label: 'None', cls: 'border-2 border-dashed border-gray-200 text-gray-400', activeCls: 'border-gray-300 bg-gray-100 text-gray-600' },
		applied: { label: '📨 Applied', cls: 'bg-blue-100 text-blue-600', activeCls: 'border-blue-300 bg-blue-100 text-blue-600' },
		accepted: { label: '🎉 Accepted', cls: 'bg-emerald-100 text-emerald-600', activeCls: 'border-emerald-300 bg-emerald-100 text-emerald-600' },
		waitlisted: { label: '⏳ Waitlisted', cls: 'bg-amber-100 text-amber-600', activeCls: 'border-amber-300 bg-amber-100 text-amber-600' },
		rejected: { label: '❌ Rejected', cls: 'bg-red-100 text-red-500', activeCls: 'border-red-300 bg-red-100 text-red-500' }
	};

	// ── Add/Edit modal ──
	let modalOpen = $state(false);
	let editingEvent = $state<ArtEvent | null>(null);

	let form = $state({
		name: '',
		date: '',
		location: '',
		eventType: 'standard' as EventType,
		status: 'none' as EventStatus,
		applicationDueDate: '',
		revenue: '',
		requirements: [] as string[],
		links: [] as string[],
		cost: '',
		travelCost: '',
		notes: '',
		linkedProjects: [] as string[]
	});
	let newRequirement = $state('');
	let newLink = $state('');
	let saving = $state(false);

	function openAdd() {
		editingEvent = null;
		form = {
			name: '', date: '', location: '',
			eventType: 'standard', status: 'none', applicationDueDate: '', revenue: '',
			requirements: [], links: [], cost: '', travelCost: '',
			notes: '', linkedProjects: []
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
			eventType: event.eventType ?? 'standard',
			status: getEventStatus(event),
			applicationDueDate: event.applicationDueDate ?? '',
			revenue: event.revenue != null ? String(event.revenue) : '',
			requirements: [...event.requirements],
			links: [...event.links],
			cost: event.cost != null ? String(event.cost) : '',
			travelCost: event.travelCost != null ? String(event.travelCost) : '',
			notes: event.notes,
			linkedProjects: [...(event.linkedProjects ?? [])]
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
		const isApplication = form.eventType === 'application';
		if (!form.name.trim()) return;
		if (!isApplication && !form.date) return;
		saving = true;
		try {
			const data = {
				name: form.name.trim(),
				date: form.date || '',
				location: form.location.trim(),
				eventType: form.eventType,
				status: form.status,
				applied: form.status !== 'none',
				applicationDueDate: form.applicationDueDate || null,
				revenue: form.revenue ? Number(form.revenue) : null,
				requirements: form.requirements,
				links: form.links,
				cost: form.cost ? Number(form.cost) : null,
				travelCost: form.travelCost ? Number(form.travelCost) : null,
				notes: form.notes.trim(),
				linkedProjects: form.linkedProjects
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

	function formatDate(dateStr: string): string {
		if (!dateStr) return '';
		const [y, m, d] = dateStr.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('en-US', {
			month: 'short', day: 'numeric', year: 'numeric'
		});
	}

	const filterChips: [FilterVal, string][] = [
		['all', '✨ All'],
		['applications', '📋 Applications'],
		['upcoming', '📅 Upcoming'],
		['past', '✅ Past'],
		['applied', '📨 Applied'],
		['accepted', '🎉 Accepted'],
		['waitlisted', '⏳ Waitlisted'],
		['rejected', '❌ Rejected']
	];

	const headerBg = $derived(settingsStore.settings.eventsBg);
</script>

<div class="min-h-screen">
	<!-- Header -->
	<div
		class="px-5 pb-5 pt-12 text-white shadow-md {!headerBg ? 'bg-gradient-to-br from-violet-400 to-purple-500' : ''}"
		style={headerBg ? `background: linear-gradient(to bottom right, rgba(167,139,250,0.85), rgba(168,85,247,0.85)), url('${headerBg}') center/cover no-repeat` : ''}
	>
		<div class="flex items-center gap-3">
			<img src="/logo!.png" alt="logo" class="h-10 w-10 object-contain drop-shadow" />
			<h1 class="text-3xl font-black">Events</h1>
		</div>
		<p class="mt-1 text-sm font-semibold text-violet-100">
			{eventsStore.events.filter((e) => getEventStatus(e) !== 'none').length} tracked · {eventsStore.events.length} total
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
	<div class="flex gap-2 overflow-x-auto px-4 py-3">
		{#each filterChips as [val, label] (val)}
			<button
				class="shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition-all {filterStatus === val ? 'bg-violet-500 text-white shadow-md' : 'bg-white text-gray-500 shadow-sm'}"
				onclick={() => (filterStatus = val)}
			>
				{label}
			</button>
		{/each}
	</div>

	<!-- Event list -->
	<div class="px-4 pb-4">
		<button
			onclick={openAdd}
			class="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-500 py-3.5 text-base font-extrabold text-white shadow-sm transition-all active:scale-95"
		>
			<span class="text-xl leading-none">+</span> New Event
		</button>
		{#if eventsStore.loading}
			<div class="flex justify-center py-12">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-500"></div>
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
					{@const prog = eventProgress(event)}
					{@const status = getEventStatus(event)}
					{@const isPast = event.date < today}
					{@const cashTxns = cashStore.transactions.filter((t) => t.eventId === event.id)}
					{@const cashIn = cashTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)}
					{@const cashOut = cashTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)}
					{@const cashNet = cashIn - cashOut}
					{@const hasFinance = event.cost != null || event.revenue != null || event.travelCost != null || cashTxns.length > 0}
					{@const totalProfit = (event.revenue ?? 0) + cashNet - (event.cost ?? 0) - (event.travelCost ?? 0)}
					{@const isApplication = (event.eventType ?? 'standard') === 'application'}
					<div class="overflow-hidden rounded-2xl bg-white shadow-sm {isApplication ? 'ring-1 ring-indigo-200' : ''}">
						<!-- Card header -->
						<div class="px-4 pt-4">
							<div class="flex items-start justify-between gap-2">
								<div class="flex-1 min-w-0">
									{#if isApplication}
										<span class="mb-1 inline-block rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-indigo-600">📋 Application</span>
									{/if}
									<h3 class="text-base font-extrabold leading-snug text-gray-800">{event.name}</h3>
								</div>
								<!-- Status badge -->
								<button
									onclick={() => openStatusPicker(event.id)}
									class="shrink-0 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all active:scale-90 {statusCfg[status].cls}"
								>
									{statusCfg[status].label}
								</button>
							</div>

							<!-- Date + Location + App Due Date -->
							<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
								{#if event.applicationDueDate}
									{@const duePast = event.applicationDueDate < today}
									<span class="flex items-center gap-1 text-sm font-semibold {duePast ? 'text-red-500' : 'text-indigo-500'}">
										📋 {isApplication ? 'Due:' : 'App due:'} {formatDate(event.applicationDueDate)}{duePast ? ' ⚠️' : ''}
									</span>
								{/if}
								{#if event.date}
									<span class="flex items-center gap-1 text-sm font-semibold {isPast ? 'text-gray-400' : 'text-gray-500'}">
										📅 {isApplication ? 'Event:' : ''}{formatDate(event.date)}{isPast ? ' · Past' : ''}
									</span>
								{/if}
								{#if event.location}
									<span class="flex items-center gap-1 text-sm font-semibold text-gray-500">
										📍 {event.location}
									</span>
								{/if}
							</div>

							<!-- Finance mini table -->
							{#if hasFinance}
								<div class="mt-3 overflow-hidden rounded-xl border border-gray-100">
									<div class="grid grid-cols-5 divide-x divide-gray-100 bg-gray-50">
										<div class="px-1.5 py-1.5 text-center">
											<p class="text-[9px] font-extrabold uppercase tracking-wide text-gray-400">Entry</p>
											<p class="mt-0.5 text-xs font-bold text-amber-600">{event.cost != null ? `-$${event.cost}` : '—'}</p>
										</div>
										<div class="px-1.5 py-1.5 text-center">
											<p class="text-[9px] font-extrabold uppercase tracking-wide text-gray-400">Card</p>
											<p class="mt-0.5 text-xs font-bold text-violet-600">{event.revenue != null ? `$${event.revenue}` : '—'}</p>
										</div>
										<div class="px-1.5 py-1.5 text-center">
											<p class="text-[9px] font-extrabold uppercase tracking-wide text-gray-400">Cash</p>
											<p class="mt-0.5 text-xs font-bold {cashNet >= 0 ? 'text-emerald-600' : 'text-red-500'}">{cashTxns.length > 0 ? `${cashNet >= 0 ? '+' : ''}$${cashNet.toFixed(0)}` : '—'}</p>
										</div>
										<div class="px-1.5 py-1.5 text-center">
											<p class="text-[9px] font-extrabold uppercase tracking-wide text-gray-400">Travel</p>
											<p class="mt-0.5 text-xs font-bold text-sky-600">{event.travelCost != null ? `-$${event.travelCost}` : '—'}</p>
										</div>
										<div class="px-1.5 py-1.5 text-center {totalProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}">
											<p class="text-[9px] font-extrabold uppercase tracking-wide {totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}">Profit</p>
											<p class="mt-0.5 text-xs font-extrabold {totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}">{totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(0)}</p>
										</div>
									</div>
								</div>
							{/if}
						</div>

						<!-- Linked project progress -->
						{#if prog}
							<div class="mt-3 px-4">
								<div class="mb-1 flex items-center justify-between">
									<span class="text-xs font-bold text-gray-400">
										Tasks · {event.linkedProjects.join(', ')}
									</span>
									<span class="text-xs font-extrabold {prog.pct === 100 ? 'text-emerald-500' : 'text-gray-500'}">
										{prog.done}/{prog.total} done
									</span>
								</div>
								<div class="h-2 w-full overflow-hidden rounded-full bg-gray-100">
									<div class="h-full rounded-full transition-all {progressBarColor(prog.pct)}" style="width: {prog.pct}%"></div>
								</div>
							</div>
						{/if}

						<!-- Card footer -->
						<div class="mt-2 border-t border-gray-50">
							{#if isApplication && confirmOutcome[event.id]}
								<!-- Confirmation row -->
								{@const outcome = confirmOutcome[event.id]}
								<div class="flex items-center gap-2 px-4 py-3">
									<p class="flex-1 text-xs font-bold {outcome === 'accepted' ? 'text-emerald-600' : 'text-red-500'}">
										{outcome === 'accepted' ? '🎉 Mark as accepted?' : '❌ Mark as rejected?'}
									</p>
									<button
										onclick={() => handleOutcomeConfirm(event.id, outcome!)}
										class="rounded-lg px-3 py-2 text-xs font-extrabold text-white transition-colors active:scale-95 {outcome === 'accepted' ? 'bg-emerald-500' : 'bg-red-400'}"
									>Confirm</button>
									<button
										onclick={() => delete confirmOutcome[event.id]}
										class="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500 active:scale-95"
									>Cancel</button>
								</div>
							{:else}
								<div class="flex items-center">
									<button
										class="flex flex-1 items-center gap-1 px-4 py-3 text-xs font-bold text-gray-400 hover:bg-gray-50 active:bg-gray-100"
										onclick={() => (expanded[event.id] = !expanded[event.id])}
									>
										{expanded[event.id] ? 'Hide details ▲' : 'Show details ▼'}
									</button>
									<div class="flex gap-1 px-2">
										{#if isApplication}
											<button
												class="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-600 transition-colors active:scale-95"
												onclick={() => (confirmOutcome[event.id] = 'accepted')}
											>✓ Accepted</button>
											<button
												class="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-400 transition-colors active:scale-95"
												onclick={() => (confirmOutcome[event.id] = 'rejected')}
											>✕ Rejected</button>
										{:else}
											<button
												class="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-100"
												onclick={() => goto(`/cash/${event.id}`)}
											>💵 Cash</button>
										{/if}
										<button
											class="rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-500 transition-colors hover:bg-violet-100"
											onclick={() => openEdit(event)}
										>Edit</button>
										<button
											class="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-100"
											onclick={() => deleteEvent(event.id)}
										>Delete</button>
									</div>
								</div>
							{/if}
						</div>

						<!-- Expanded details -->
						{#if expanded[event.id]}
							<div class="border-t border-gray-50 px-4 pb-4 pt-3">
								{#if event.requirements.length > 0}
									<div class="mb-3">
										<p class="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-gray-400">Requirements</p>
										<ul class="flex flex-col gap-1">
											{#each event.requirements as req (req)}
												<li class="flex items-start gap-2 text-sm font-semibold text-gray-600">
													<span class="mt-0.5 text-violet-400">•</span>{req}
												</li>
											{/each}
										</ul>
									</div>
								{/if}

								{#if event.links.length > 0}
									<div class="mb-3">
										<p class="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-gray-400">Links</p>
										<div class="flex flex-col gap-1">
											{#each event.links as link (link)}
												<a href={link} target="_blank" rel="noopener noreferrer"
													class="truncate text-sm font-semibold text-violet-500 underline">{link}</a>
											{/each}
										</div>
									</div>
								{/if}

								{#if event.notes}
									<div class="mb-3">
										<p class="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-gray-400">Notes</p>
										<p class="whitespace-pre-wrap text-sm font-semibold text-gray-600">{event.notes}</p>
									</div>
								{/if}

							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>


<!-- Status Picker Modal -->
<Modal bind:open={statusPickerOpen} title="Update Status">
	<div class="flex flex-col gap-2">
		{#each (Object.entries(statusCfg) as [EventStatus, typeof statusCfg[EventStatus]][]) as [s, cfg]}
			<button
				onclick={() => handleStatusPick(s)}
				class="flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition-all active:scale-95 {cfg.activeCls}"
			>
				{cfg.label}
			</button>
		{/each}
	</div>
</Modal>

<!-- Add / Edit Event Modal -->
<Modal bind:open={modalOpen} title={editingEvent ? 'Edit Event ✏️' : 'New Event 🎪'}>
	<div class="flex flex-col gap-4">

		<!-- Event Type toggle -->
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => { form.eventType = 'standard'; }}
				class="flex-1 rounded-xl border-2 py-3 text-sm font-extrabold transition-all {form.eventType === 'standard' ? 'border-violet-300 bg-violet-100 text-violet-700' : 'border-gray-100 bg-white text-gray-400'}"
			>🎪 Standard</button>
			<button
				type="button"
				onclick={() => { form.eventType = 'application'; if (form.status === 'none') form.status = 'applied'; }}
				class="flex-1 rounded-xl border-2 py-3 text-sm font-extrabold transition-all {form.eventType === 'application' ? 'border-indigo-300 bg-indigo-100 text-indigo-700' : 'border-gray-100 bg-white text-gray-400'}"
			>📋 Application</button>
		</div>

		<!-- Name -->
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600" for="event-name">Event Name *</label>
			<input
				id="event-name"
				type="text"
				bind:value={form.name}
				placeholder="e.g. Anime Expo 2025"
				class="w-full rounded-xl border-2 border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-violet-400"
			/>
		</div>

		<!-- Application Due Date (prominent for application type) -->
		{#if form.eventType === 'application'}
			<div>
				<label class="mb-1.5 block text-sm font-bold text-indigo-600" for="event-appdue-top">Application Due Date *</label>
				<input id="event-appdue-top" type="date" bind:value={form.applicationDueDate}
					class="w-full rounded-xl border-2 border-indigo-200 bg-indigo-50 px-3 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-400" />
			</div>
		{/if}

		<!-- Date + Location -->
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1.5 block text-sm font-bold text-gray-600" for="event-date">
					{form.eventType === 'application' ? 'Event Date (if accepted)' : 'Event Date *'}
				</label>
				<input id="event-date" type="date" bind:value={form.date}
					class="w-full rounded-xl border-2 border-violet-100 bg-violet-50 px-3 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-violet-400" />
			</div>
			<div>
				<label class="mb-1.5 block text-sm font-bold text-gray-600" for="event-location">Location</label>
				<input id="event-location" type="text" bind:value={form.location} placeholder="City, State"
					class="w-full rounded-xl border-2 border-violet-100 bg-violet-50 px-3 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-violet-400" />
			</div>
		</div>

		<!-- Application Due Date (standard type, secondary) -->
		{#if form.eventType === 'standard'}
			<div>
				<label class="mb-1.5 block text-sm font-bold text-gray-600" for="event-appdue">Application Due Date</label>
				<input id="event-appdue" type="date" bind:value={form.applicationDueDate}
					class="w-full rounded-xl border-2 border-violet-100 bg-violet-50 px-3 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-violet-400" />
			</div>
		{/if}

		<!-- Status -->
		<div>
			<p class="mb-2 text-sm font-bold text-gray-600">Status</p>
			<div class="grid grid-cols-3 gap-2">
				{#each (Object.entries(statusCfg) as [EventStatus, typeof statusCfg[EventStatus]][]) as [s, cfg]}
					<button
						type="button"
						onclick={() => {
								form.status = s;
								if (s === 'accepted' || s === 'rejected') form.eventType = 'standard';
								else if (s === 'applied' || s === 'waitlisted') form.eventType = 'application';
							}}
						class="rounded-xl border-2 py-2.5 text-xs font-bold transition-all {form.status === s ? cfg.activeCls : 'border-gray-100 bg-white text-gray-400'}"
					>{cfg.label}</button>
				{/each}
			</div>
		</div>

		<!-- Revenue + Costs -->
		<div class="grid grid-cols-3 gap-2">
			<div>
				<label class="mb-1.5 block text-sm font-bold text-emerald-600" for="event-revenue">Revenue ($)</label>
				<input id="event-revenue" type="number" bind:value={form.revenue} placeholder="0" min="0"
					class="w-full rounded-xl border-2 border-emerald-100 bg-emerald-50 px-3 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-emerald-400" />
			</div>
			<div>
				<label class="mb-1.5 block text-sm font-bold text-amber-600" for="event-cost">Entry ($)</label>
				<input id="event-cost" type="number" bind:value={form.cost} placeholder="0" min="0"
					class="w-full rounded-xl border-2 border-amber-100 bg-amber-50 px-3 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-amber-400" />
			</div>
			<div>
				<label class="mb-1.5 block text-sm font-bold text-sky-600" for="travel-cost">Travel ($)</label>
				<input id="travel-cost" type="number" bind:value={form.travelCost} placeholder="0" min="0"
					class="w-full rounded-xl border-2 border-sky-100 bg-sky-50 px-3 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-sky-400" />
			</div>
		</div>

		<!-- Requirements -->
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600">Requirements</label>
			{#each form.requirements as req, i (i)}
				<div class="mb-1.5 flex items-center gap-2">
					<span class="flex-1 rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-gray-700">{req}</span>
					<button class="rounded-lg p-1.5 text-red-300 hover:text-red-500" onclick={() => removeRequirement(i)} aria-label="Remove">✕</button>
				</div>
			{/each}
			<div class="flex gap-2">
				<input type="text" bind:value={newRequirement} placeholder="Add a requirement..."
					onkeydown={(e) => e.key === 'Enter' && addRequirement()}
					class="flex-1 rounded-xl border-2 border-violet-100 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-violet-400" />
				<button onclick={addRequirement} class="rounded-xl bg-violet-100 px-3 py-2.5 text-sm font-bold text-violet-600 hover:bg-violet-200">Add</button>
			</div>
		</div>

		<!-- Links -->
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600">Links</label>
			{#each form.links as link, i (i)}
				<div class="mb-1.5 flex items-center gap-2">
					<span class="flex-1 truncate rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-600">{link}</span>
					<button class="rounded-lg p-1.5 text-red-300 hover:text-red-500" onclick={() => removeLink(i)} aria-label="Remove">✕</button>
				</div>
			{/each}
			<div class="flex gap-2">
				<input type="url" bind:value={newLink} placeholder="https://..."
					onkeydown={(e) => e.key === 'Enter' && addLink()}
					class="flex-1 rounded-xl border-2 border-violet-100 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-violet-400" />
				<button onclick={addLink} class="rounded-xl bg-violet-100 px-3 py-2.5 text-sm font-bold text-violet-600 hover:bg-violet-200">Add</button>
			</div>
		</div>

		<!-- Linked Projects -->
		{#if allProjects.length > 0}
			<div>
				<p class="mb-1.5 text-sm font-bold text-gray-600">Linked Projects</p>
				<div class="flex flex-wrap gap-2">
					{#each allProjects as project (project)}
						{@const linked = form.linkedProjects.includes(project)}
						<button type="button"
							class="rounded-xl border-2 px-3 py-1.5 text-sm font-bold transition-all active:scale-95 {linked ? 'border-violet-300 bg-violet-100 text-violet-700' : 'border-gray-100 bg-gray-50 text-gray-400'}"
							onclick={() => {
								form.linkedProjects = linked
									? form.linkedProjects.filter((p) => p !== project)
									: [...form.linkedProjects, project];
							}}
						>{linked ? '✓ ' : ''}{project}</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Notes -->
		<div>
			<label class="mb-1.5 block text-sm font-bold text-gray-600" for="event-notes">Notes</label>
			<textarea id="event-notes" bind:value={form.notes} placeholder="Any extra details..." rows="3"
				class="w-full resize-none rounded-xl border-2 border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-violet-400"></textarea>
		</div>

		<button
			onclick={handleSave}
			disabled={!form.name.trim() || !form.date || saving}
			class="mt-1 w-full rounded-2xl bg-violet-500 py-4 text-base font-extrabold text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
		>{saving ? 'Saving...' : editingEvent ? 'Save Changes ✨' : 'Add Event 🎪'}</button>
	</div>
</Modal>
