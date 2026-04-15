<script lang="ts">
	import { page } from '$app/state';

	let menuOpen = $state(false);
</script>

{#if menuOpen}
	<div
		class="fixed inset-0 z-[90] bg-black/30"
		role="button"
		tabindex="-1"
		aria-label="Close menu"
		onclick={() => (menuOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)}
	></div>
	<div
		class="fixed bottom-0 left-0 right-0 z-[91] rounded-t-3xl bg-white px-6 pt-5 shadow-2xl"
		style="padding-bottom: calc(2rem + env(safe-area-inset-bottom))"
	>
		<div class="mx-auto mb-5 h-1.5 w-12 rounded-full bg-gray-200"></div>
		<h2 class="mb-4 text-xl font-extrabold text-gray-800">More ✨</h2>
		<div class="flex flex-col gap-2">
			<a
				href="/calendar"
				onclick={() => (menuOpen = false)}
				class="flex items-center gap-3 rounded-2xl bg-teal-50 px-4 py-3 text-base font-bold text-teal-700 transition-colors active:bg-teal-100"
			>
				<span class="text-2xl">📅</span>
				Calendar
			</a>
			<a
				href="/settings"
				onclick={() => (menuOpen = false)}
				class="flex items-center gap-3 rounded-2xl bg-pink-50 px-4 py-3 text-base font-bold text-pink-700 transition-colors active:bg-pink-100"
			>
				<span class="text-2xl">⚙️</span>
				Settings
			</a>
		</div>
	</div>
{/if}

<nav
	class="fixed bottom-0 left-0 right-0 z-50 flex border-t border-pink-100 bg-white"
	style="padding-bottom: env(safe-area-inset-bottom)"
>
	<a
		href="/home"
		class="flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors {page.url.pathname.startsWith('/home') ? 'text-pink-500' : 'text-gray-400'}"
	>
		<span class="text-2xl leading-none">🏠</span>
		<span class="text-xs font-bold">Home</span>
	</a>
	<a
		href="/todos"
		class="flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors {page.url.pathname.startsWith('/todos') ? 'text-pink-500' : 'text-gray-400'}"
	>
		<span class="text-2xl leading-none">📝</span>
		<span class="text-xs font-bold">To-Do</span>
	</a>
	<a
		href="/stock"
		class="flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors {page.url.pathname.startsWith('/stock') ? 'text-pink-500' : 'text-gray-400'}"
	>
		<span class="text-2xl leading-none">📦</span>
		<span class="text-xs font-bold">Stock</span>
	</a>
	<a
		href="/events"
		class="flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors {page.url.pathname.startsWith('/events') ? 'text-pink-500' : 'text-gray-400'}"
	>
		<span class="text-2xl leading-none">🗓️</span>
		<span class="text-xs font-bold">Events</span>
	</a>
	<button
		onclick={() => (menuOpen = !menuOpen)}
		class="flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors {page.url.pathname.startsWith('/calendar') || page.url.pathname.startsWith('/settings') || menuOpen ? 'text-pink-500' : 'text-gray-400'}"
	>
		<span class="text-2xl leading-none">☰</span>
		<span class="text-xs font-bold">More</span>
	</button>
</nav>
