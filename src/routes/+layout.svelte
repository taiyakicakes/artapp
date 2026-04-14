<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { authStore, signIn, signOut } from '$lib/stores/auth.svelte';
	import { subscribeTodos, unsubscribeTodos } from '$lib/stores/todos.svelte';
	import { subscribeEvents, unsubscribeEvents } from '$lib/stores/events.svelte';
	import { subscribeStocks, unsubscribeStocks } from '$lib/stores/stocks.svelte';
	import { subscribeLinks, unsubscribeLinks } from '$lib/stores/links.svelte';
	import { subscribeProjectPriorities, unsubscribeProjectPriorities } from '$lib/stores/projectPriorities.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { PUBLIC_APP_NAME } from '$env/static/public';

	let { children } = $props();

	$effect(() => {
		if (authStore.authorized) {
			subscribeTodos();
			subscribeEvents();
			subscribeStocks();
			subscribeLinks();
			subscribeProjectPriorities();
		} else {
			unsubscribeTodos();
			unsubscribeEvents();
			unsubscribeStocks();
			unsubscribeLinks();
			unsubscribeProjectPriorities();
		}
	});

	let signingIn = $state(false);

	async function handleSignIn() {
		signingIn = true;
		try {
			await signIn();
		} finally {
			signingIn = false;
		}
	}
</script>

<svelte:head>
	<link rel="icon" href="/logo!.png" type="image/png" />
</svelte:head>

{#if authStore.loading}
	<div class="flex min-h-screen items-center justify-center bg-pink-50">
		<div class="flex flex-col items-center gap-4">
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500"
			></div>
			<p class="font-bold text-pink-400">Loading...</p>
		</div>
	</div>
{:else if !authStore.user}
	<!-- Login screen -->
	<div
		class="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-pink-100 via-rose-50 to-violet-100 px-6"
	>
		<div class="flex flex-col items-center gap-3 text-center">
			<img src="/logo!.png" alt="logo" class="h-36 w-36 object-contain drop-shadow-md" />
			<h1 class="text-4xl font-black text-pink-600">{PUBLIC_APP_NAME}</h1>
			<p class="text-lg font-semibold text-pink-400">your cute little workspace ✨</p>
		</div>

		<button
			onclick={handleSignIn}
			disabled={signingIn}
			class="flex items-center gap-3 rounded-2xl bg-white px-8 py-4 text-base font-bold text-gray-700 shadow-lg transition-transform active:scale-95 disabled:opacity-60"
		>
			<svg class="h-6 w-6" viewBox="0 0 24 24">
				<path
					fill="#4285F4"
					d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
				/>
				<path
					fill="#34A853"
					d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				/>
				<path
					fill="#FBBC05"
					d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
				/>
				<path
					fill="#EA4335"
					d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				/>
			</svg>
			{signingIn ? 'Signing in...' : 'Sign in with Google'}
		</button>
	</div>
{:else if !authStore.authorized}
	<!-- Access denied -->
	<div
		class="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-pink-100 via-rose-50 to-violet-100 px-6 text-center"
	>
		<div class="text-6xl">🚫</div>
		<div>
			<h2 class="text-2xl font-black text-gray-800">Access Denied</h2>
			<p class="mt-2 text-gray-500">
				<span class="font-semibold text-gray-700">{authStore.user.email}</span> isn't allowed here.
			</p>
		</div>
		<button
			onclick={signOut}
			class="rounded-2xl bg-pink-500 px-8 py-3 font-bold text-white shadow-md transition-transform active:scale-95"
		>
			Sign Out
		</button>
	</div>
{:else}
	<!-- Authorized app -->
	<div class="flex min-h-screen flex-col" style="padding-bottom: calc(4rem + env(safe-area-inset-bottom))">
		{@render children()}
	</div>
	<BottomNav />
{/if}
