<script lang="ts">
	import { page } from '$app/state';
</script>

<nav
	class="fixed bottom-0 left-0 right-0 z-50 flex bg-white border-t border-pink-100"
	style="padding-bottom: env(safe-area-inset-bottom)"
>
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
		<span class="text-xs font-bold">Stock To-Do</span>
	</a>
	<a
		href="/events"
		class="flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors {page.url.pathname.startsWith('/events') ? 'text-pink-500' : 'text-gray-400'}"
	>
		<span class="text-2xl leading-none">🗓️</span>
		<span class="text-xs font-bold">Events</span>
	</a>
</nav>
