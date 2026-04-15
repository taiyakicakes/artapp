<script lang="ts">
	import { settingsStore, updateSettings, type AppSettings } from '$lib/stores/settings.svelte';

	type PageKey = keyof AppSettings;

	const pages: { key: PageKey; label: string; gradient: string; gradientStyle: string }[] = [
		{ key: 'homeBg', label: 'Home', gradient: 'from-pink-400 to-rose-400', gradientStyle: 'rgba(244,114,182,0.85), rgba(251,113,133,0.85)' },
		{ key: 'todosBg', label: 'Projects', gradient: 'from-pink-400 to-rose-400', gradientStyle: 'rgba(244,114,182,0.85), rgba(251,113,133,0.85)' },
		{ key: 'stockBg', label: 'Stock', gradient: 'from-teal-400 to-emerald-500', gradientStyle: 'rgba(45,212,191,0.85), rgba(52,211,153,0.85)' },
		{ key: 'eventsBg', label: 'Events', gradient: 'from-violet-400 to-purple-500', gradientStyle: 'rgba(167,139,250,0.85), rgba(168,85,247,0.85)' },
		{ key: 'calendarBg', label: 'Calendar', gradient: 'from-teal-400 to-cyan-500', gradientStyle: 'rgba(45,212,191,0.85), rgba(6,182,212,0.85)' },
		{ key: 'cashBg', label: 'Cash Log', gradient: 'from-emerald-400 to-teal-500', gradientStyle: 'rgba(52,211,153,0.85), rgba(20,184,166,0.85)' },
		{ key: 'settingsBg', label: 'Settings', gradient: 'from-rose-400 to-pink-500', gradientStyle: 'rgba(251,113,133,0.85), rgba(236,72,153,0.85)' }
	];

	// Per-page input state
	let inputs = $state<Record<PageKey, string>>({
		homeBg: '',
		todosBg: '',
		stockBg: '',
		eventsBg: '',
		calendarBg: '',
		cashBg: '',
		settingsBg: ''
	});

	let saving = $state<Record<PageKey, boolean>>({
		homeBg: false,
		todosBg: false,
		stockBg: false,
		eventsBg: false,
		calendarBg: false,
		cashBg: false,
		settingsBg: false
	});

	let saved = $state<Record<PageKey, boolean>>({
		homeBg: false,
		todosBg: false,
		stockBg: false,
		eventsBg: false,
		calendarBg: false,
		cashBg: false,
		settingsBg: false
	});

	let errors = $state<Record<PageKey, boolean>>({
		homeBg: false,
		todosBg: false,
		stockBg: false,
		eventsBg: false,
		calendarBg: false,
		cashBg: false,
		settingsBg: false
	});

	// Sync inputs from store once loaded
	$effect(() => {
		if (!settingsStore.loading) {
			for (const p of pages) {
				if (inputs[p.key] === '') {
					inputs[p.key] = settingsStore.settings[p.key] ?? '';
				}
			}
		}
	});

	async function handleSave(key: PageKey) {
		saving[key] = true;
		try {
			await updateSettings({ [key]: inputs[key].trim() || undefined });
			saved[key] = true;
			setTimeout(() => (saved[key] = false), 2000);
		} finally {
			saving[key] = false;
		}
	}

	async function handleClear(key: PageKey) {
		inputs[key] = '';
		await updateSettings({ [key]: undefined });
	}

</script>

<div class="min-h-screen">
	<!-- Header -->
	<div
		class="px-5 pb-6 pt-12 text-white shadow-md {!settingsStore.settings.settingsBg ? 'bg-gradient-to-br from-rose-400 to-pink-500' : ''}"
		style={settingsStore.settings.settingsBg ? `background: linear-gradient(to bottom right, rgba(251,113,133,0.85), rgba(236,72,153,0.85)), url('${settingsStore.settings.settingsBg}') center/cover no-repeat` : ''}
	>
		<div class="flex items-center gap-3">
			<img src="/logo!.png" alt="logo" class="h-10 w-10 object-contain drop-shadow" />
			<h1 class="text-3xl font-black">Settings</h1>
		</div>
	</div>

	<div class="px-4 py-5">
		<div class="mx-auto max-w-md flex flex-col gap-4">

			<p class="text-sm font-bold text-gray-500">
				Set a background image for each page header. Paste a direct image URL — the gradient overlays on top to keep text readable.
			</p>

			{#each pages as p (p.key)}
				{@const current = settingsStore.settings[p.key]}
				{@const val = inputs[p.key]}
				<div class="overflow-hidden rounded-2xl bg-white shadow-sm">
					<!-- Mini preview header -->
					<div
						class="flex h-14 items-center gap-2 px-4 {!val.trim() && !current ? `bg-gradient-to-r ${p.gradient}` : ''}"
						style={(val.trim() || current) ? `background: linear-gradient(to right, ${p.gradientStyle}), url('${val.trim() || current}') center/cover no-repeat` : ''}
					>
						<img src="/logo!.png" alt="" class="h-6 w-6 object-contain drop-shadow opacity-90" />
						<span class="text-sm font-extrabold text-white drop-shadow">{p.label}</span>
					</div>

					<!-- Input row -->
					<div class="flex flex-col gap-3 p-4">
						<input
							type="url"
							bind:value={inputs[p.key]}
							placeholder="https://example.com/image.jpg"
							onerror={() => (errors[p.key] = true)}
							onload={() => (errors[p.key] = false)}
							class="w-full rounded-xl border-2 border-pink-100 bg-pink-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-pink-400"
						/>
						<div class="flex gap-2">
							<button
								onclick={() => handleSave(p.key)}
								disabled={saving[p.key]}
								class="flex-1 rounded-xl bg-pink-500 py-2.5 text-sm font-extrabold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
							>
								{saving[p.key] ? 'Saving...' : saved[p.key] ? '✓ Saved!' : 'Save'}
							</button>
							{#if current}
								<button
									onclick={() => handleClear(p.key)}
									class="rounded-xl border-2 border-gray-100 px-4 py-2.5 text-sm font-bold text-gray-400 active:scale-95"
								>Clear</button>
							{/if}
						</div>
					</div>
				</div>
			{/each}

		</div>
	</div>
</div>
