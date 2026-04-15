<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { eventsStore } from '$lib/stores/events.svelte';
	import {
		cashStore,
		addCashTransaction,
		deleteCashTransaction,
		updateCashTransaction,
		type CashTransaction
	} from '$lib/stores/cashTransactions.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';

	const eventId = $derived(page.params.eventId ?? '');
	const event = $derived(eventsStore.events.find((e) => e.id === eventId) ?? null);
	const txns = $derived(
		cashStore.transactions
			.filter((t) => t.eventId === eventId)
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
	);

	const totalIncome = $derived(
		txns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
	);
	const totalExpense = $derived(
		txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
	);
	const net = $derived(totalIncome - totalExpense);

	// ── Numpad state ──
	let display = $state('0');
	let type = $state<'income' | 'expense'>('income');
	let description = $state('');
	let saving = $state(false);
	let editingId = $state<string | null>(null);
	let showHistory = $state(false);

	function numpadPress(key: string) {
		if (key === '⌫') {
			display = display.length <= 1 ? '0' : display.slice(0, -1);
			return;
		}
		if (key === '.') {
			if (display.includes('.')) return;
			display = display + '.';
			return;
		}
		if (display === '0') {
			display = key;
		} else {
			// max 2 decimal places
			const parts = display.split('.');
			if (parts[1] !== undefined && parts[1].length >= 2) return;
			display = display + key;
		}
	}

	function clearEntry() {
		display = '0';
		description = '';
		editingId = null;
	}

	function startEdit(t: CashTransaction) {
		editingId = t.id;
		display = String(t.amount);
		description = t.description;
		type = t.type;
	}

	async function handleConfirm() {
		const amt = parseFloat(display);
		if (isNaN(amt) || amt <= 0 || !description.trim()) return;
		saving = true;
		try {
			if (editingId) {
				await updateCashTransaction(editingId, {
					amount: amt,
					description: description.trim(),
					type
				});
			} else {
				await addCashTransaction(eventId, description.trim(), amt, type);
			}
			clearEntry();
		} finally {
			saving = false;
		}
	}

	function formatTime(d: Date): string {
		return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}

	function formatDate(d: Date): string {
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	const NUMPAD_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'];

</script>

<div class="min-h-screen flex flex-col">
	<!-- Header -->
	<div
		class="px-5 pb-5 pt-12 text-white shadow-md {!settingsStore.settings.cashBg ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : ''}"
		style={settingsStore.settings.cashBg ? `background: linear-gradient(to bottom right, rgba(52,211,153,0.85), rgba(20,184,166,0.85)), url('${settingsStore.settings.cashBg}') center/cover no-repeat` : ''}
	>
		<div class="flex items-center gap-3">
			<button
				onclick={() => goto('/events')}
				class="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg font-black active:bg-white/30"
				aria-label="Back"
			>‹</button>
			<div class="flex-1 min-w-0">
				<h1 class="text-2xl font-black truncate">💵 Cash Log</h1>
				{#if event}
					<p class="text-sm font-semibold text-emerald-100 truncate">{event.name}</p>
				{/if}
			</div>
		</div>

		<!-- Totals -->
		<div class="mt-4 grid grid-cols-3 gap-3">
			<div class="rounded-2xl bg-white/20 px-3 py-2.5 text-center">
				<p class="text-xs font-bold text-emerald-100">Income</p>
				<p class="text-lg font-black">${totalIncome.toFixed(2)}</p>
			</div>
			<div class="rounded-2xl bg-white/20 px-3 py-2.5 text-center">
				<p class="text-xs font-bold text-emerald-100">Expense</p>
				<p class="text-lg font-black">${totalExpense.toFixed(2)}</p>
			</div>
			<div class="rounded-2xl bg-white/20 px-3 py-2.5 text-center">
				<p class="text-xs font-bold text-emerald-100">Net</p>
				<p class="text-lg font-black {net < 0 ? 'text-red-200' : ''}">{net >= 0 ? '+' : ''}${net.toFixed(2)}</p>
			</div>
		</div>
	</div>

	<div class="flex flex-col flex-1 px-4 py-4 gap-4">

		<!-- Type toggle -->
		<div class="flex gap-2">
			<button
				onclick={() => (type = 'income')}
				class="flex-1 rounded-2xl border-2 py-3 text-sm font-extrabold transition-all {type === 'income' ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-gray-100 bg-white text-gray-400'}"
			>💚 Income</button>
			<button
				onclick={() => (type = 'expense')}
				class="flex-1 rounded-2xl border-2 py-3 text-sm font-extrabold transition-all {type === 'expense' ? 'border-red-300 bg-red-100 text-red-600' : 'border-gray-100 bg-white text-gray-400'}"
			>❤️ Expense</button>
		</div>

		<!-- Description -->
		<input
			type="text"
			bind:value={description}
			placeholder="Description (e.g. Sticker pack)"
			class="w-full rounded-2xl border-2 border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-emerald-400"
		/>

		<!-- Display -->
		<div class="rounded-2xl bg-white px-5 py-4 text-right shadow-sm">
			{#if editingId}
				<p class="text-xs font-bold text-amber-500 mb-1">Editing entry</p>
			{/if}
			<span class="text-4xl font-black text-gray-800 tabular-nums">${display}</span>
		</div>

		<!-- Numpad -->
		<div class="grid grid-cols-3 gap-2">
			{#each NUMPAD_KEYS as key (key)}
				<button
					onclick={() => numpadPress(key)}
					class="rounded-2xl py-5 text-xl font-extrabold transition-all active:scale-95 {key === '⌫'
						? 'bg-red-50 text-red-400'
						: 'bg-white text-gray-700 shadow-sm'}"
				>{key}</button>
			{/each}
		</div>

		<!-- Confirm / Cancel -->
		<div class="flex gap-2">
			{#if editingId}
				<button
					onclick={clearEntry}
					class="rounded-2xl border-2 border-gray-100 bg-white px-5 py-4 text-sm font-bold text-gray-400 active:scale-95"
				>Cancel</button>
			{/if}
			<button
				onclick={handleConfirm}
				disabled={saving || parseFloat(display) <= 0 || !description.trim()}
				class="flex-1 rounded-2xl py-4 text-base font-extrabold text-white shadow-md transition-all active:scale-95 disabled:opacity-50 {type === 'income' ? 'bg-emerald-500' : 'bg-red-400'}"
			>
				{saving ? 'Saving...' : editingId ? 'Update Entry ✓' : type === 'income' ? '+ Log Income' : '− Log Expense'}
			</button>
		</div>

		<!-- Transactions toggle button -->
		{#if txns.length > 0}
			<button
				onclick={() => (showHistory = !showHistory)}
				class="flex w-full items-center justify-between rounded-2xl border-2 bg-white px-4 py-3.5 text-sm font-extrabold transition-all active:scale-95 {showHistory ? 'border-emerald-200 text-emerald-700' : 'border-gray-100 text-gray-500'}"
			>
				<span>View Transactions ({txns.length})</span>
				<span class="text-base">{showHistory ? '▲' : '▼'}</span>
			</button>
		{/if}

		<!-- Transaction history -->
		{#if showHistory && txns.length > 0}
			<div class="flex flex-col gap-2">
				{#each txns as t (t.id)}
					<div
						class="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm {editingId === t.id ? 'ring-2 ring-amber-300' : ''}"
					>
						<span class="text-base font-extrabold {t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}">
							{t.type === 'income' ? '+' : '−'}${t.amount.toFixed(2)}
						</span>
						<div class="flex-1 min-w-0">
							<p class="truncate text-sm font-semibold text-gray-700">{t.description}</p>
							<p class="text-xs text-gray-400">{formatDate(t.createdAt)} · {formatTime(t.createdAt)}</p>
						</div>
						<div class="flex gap-1 shrink-0">
							<button
								onclick={() => { startEdit(t); showHistory = false; }}
								class="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-500 active:scale-95"
							>Edit</button>
							<button
								onclick={() => deleteCashTransaction(t.id)}
								class="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-400 active:scale-95"
							>✕</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

	</div>
</div>
