<script lang="ts">
	import { goto } from '$app/navigation';
	import { eventsStore, getEventStatus, type EventStatus } from '$lib/stores/events.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';

	const now = new Date();
	let year = $state(now.getFullYear());
	let month = $state(now.getMonth()); // 0-indexed

	const MONTH_NAMES = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];
	const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	const daysInMonth = $derived(new Date(year, month + 1, 0).getDate());
	const firstDayOfWeek = $derived(new Date(year, month, 1).getDay());

	const gridCells = $derived(() => {
		const cells: (number | null)[] = [];
		for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
		for (let d = 1; d <= daysInMonth; d++) cells.push(d);
		// pad to complete last row
		while (cells.length % 7 !== 0) cells.push(null);
		return cells;
	});

	const eventsByDate = $derived(() => {
		const map: Record<string, typeof eventsStore.events> = {};
		for (const e of eventsStore.events) {
			const [ey, em, ed] = e.date.split('-').map(Number);
			if (ey === year && em - 1 === month) {
				if (!map[e.date]) map[e.date] = [];
				map[e.date].push(e);
			}
		}
		return map;
	});

	function toDateKey(day: number): string {
		return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	function prevMonth() {
		if (month === 0) { month = 11; year--; }
		else month--;
	}
	function nextMonth() {
		if (month === 11) { month = 0; year++; }
		else month++;
	}

	const statusChipCls: Record<EventStatus, string> = {
		none: 'bg-gray-100 text-gray-500',
		applied: 'bg-blue-100 text-blue-600',
		accepted: 'bg-emerald-100 text-emerald-600',
		waitlisted: 'bg-amber-100 text-amber-600',
		rejected: 'bg-red-100 text-red-500'
	};

	const today = new Date();
	const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
</script>

<div class="min-h-screen">
	<!-- Header -->
	<div
		class="px-5 pb-5 pt-12 text-white shadow-md {!settingsStore.settings.calendarBg ? 'bg-gradient-to-br from-teal-400 to-cyan-500' : ''}"
		style={settingsStore.settings.calendarBg ? `background: linear-gradient(to bottom right, rgba(45,212,191,0.85), rgba(6,182,212,0.85)), url('${settingsStore.settings.calendarBg}') center/cover no-repeat` : ''}
	>
		<div class="flex items-center gap-3">
			<img src="/logo!.png" alt="logo" class="h-10 w-10 object-contain drop-shadow" />
			<h1 class="text-3xl font-black">Calendar</h1>
		</div>
		<div class="mt-4 flex items-center justify-between">
			<button
				onclick={prevMonth}
				class="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xl font-black transition-colors active:bg-white/30"
			>‹</button>
			<span class="text-lg font-extrabold">{MONTH_NAMES[month]} {year}</span>
			<button
				onclick={nextMonth}
				class="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xl font-black transition-colors active:bg-white/30"
			>›</button>
		</div>
	</div>

	<!-- Calendar grid -->
	<div class="px-3 py-4">
		<!-- Day headers -->
		<div class="mb-1 grid grid-cols-7">
			{#each DAY_HEADERS as day (day)}
				<div class="text-center text-xs font-extrabold uppercase tracking-wide text-gray-400">{day}</div>
			{/each}
		</div>

		<!-- Cells -->
		<div class="grid grid-cols-7 gap-y-1">
			{#each gridCells() as cell, i (i)}
				{@const dateKey = cell ? toDateKey(cell) : ''}
				{@const dayEvents = cell ? (eventsByDate()[dateKey] ?? []) : []}
				{@const isToday = dateKey === todayKey}
				<div class="min-h-[72px] rounded-xl p-1 {isToday ? 'bg-pink-50 ring-2 ring-pink-300' : ''}">
					{#if cell}
						<span class="mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold {isToday ? 'bg-pink-500 text-white' : 'text-gray-600'}">
							{cell}
						</span>
						<div class="flex flex-col gap-0.5">
							{#each dayEvents.slice(0, 2) as event (event.id)}
								{@const status = getEventStatus(event)}
								<button
									onclick={() => goto('/events')}
									class="w-full truncate rounded-md px-1 py-0.5 text-left text-[10px] font-bold leading-tight {statusChipCls[status]}"
									title={event.name}
								>
									{event.name}
								</button>
							{/each}
							{#if dayEvents.length > 2}
								<button
									onclick={() => goto('/events')}
									class="rounded-md px-1 py-0.5 text-left text-[10px] font-bold text-gray-400"
								>
									+{dayEvents.length - 2} more
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Legend -->
	<div class="px-4 pb-4">
		<p class="mb-2 text-xs font-extrabold uppercase tracking-wide text-gray-400">Status</p>
		<div class="flex flex-wrap gap-2">
			{#each ([['none', '—', 'None'], ['applied', '📨', 'Applied'], ['accepted', '🎉', 'Accepted'], ['waitlisted', '⏳', 'Waitlisted'], ['rejected', '❌', 'Rejected']] as [EventStatus, string, string][]) as [s, emoji, label]}
				<span class="rounded-full px-2.5 py-1 text-xs font-bold {statusChipCls[s]}">{emoji} {label}</span>
			{/each}
		</div>
	</div>
</div>
