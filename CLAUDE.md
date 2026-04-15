# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run preview      # preview production build
npm run check        # type-check (svelte-check + tsc)
npm run check:watch  # type-check in watch mode
npm run lint         # check formatting (prettier)
npm run format       # fix formatting (prettier)
```

No test suite exists.

## Environment Variables

Required in `.env` (all prefixed `PUBLIC_` for SvelteKit client exposure):

```
PUBLIC_FIREBASE_API_KEY
PUBLIC_FIREBASE_AUTH_DOMAIN
PUBLIC_FIREBASE_PROJECT_ID
PUBLIC_FIREBASE_STORAGE_BUCKET
PUBLIC_FIREBASE_MESSAGING_SENDER_ID
PUBLIC_FIREBASE_APP_ID
PUBLIC_ALLOWED_EMAIL   # single authorized user's email
PUBLIC_APP_NAME        # display name shown on login screen
```

## Architecture

**Stack:** SvelteKit + Svelte 5 (runes) + Firebase (Auth + Firestore) + Tailwind CSS v4. SSR is disabled globally (`ssr = false` in `+layout.ts`) — this is a purely client-side PWA.

**Single-user auth:** Google OAuth via `src/lib/stores/auth.svelte.ts`. Only the email matching `PUBLIC_ALLOWED_EMAIL` is authorized. The root layout handles loading/unauth/access-denied states before rendering any page content.

**Store pattern:** Every Firestore collection has a dedicated store in `src/lib/stores/*.svelte.ts` following this pattern:
- `$state` object as the store (Svelte 5 runes, not writable stores)
- `subscribe*` / `unsubscribe*` functions manage the `onSnapshot` listener
- CRUD functions exported alongside the store
- All subscriptions are started/stopped in `+layout.svelte` via a single `$effect` that reacts to `authStore.authorized`

When adding a new data type, follow this same store pattern and wire up subscribe/unsubscribe in the root layout.

**Firestore collections:** `todos`, `events`, `stocks`, `links`, `projectPriorities`. The `projectPriorities` collection uses the project name as the document ID.

**Routing:** `/` redirects to `/home`. Pages: `/home` (quick links + next-up carousel), `/todos`, `/stock`, `/events`.

## Component Reuse

**Always use `Modal.svelte` for add/edit forms.** It renders as a bottom sheet with backdrop, Escape-to-close, and scroll support. Bind `open` as a boolean:

```svelte
<Modal bind:open={showModal} title="Add Item">
  <!-- form content as children snippet -->
</Modal>
```

**Shared UI patterns** — extract to `src/lib/components/` rather than duplicating inline:

- **Priority badges:** `bg-red-100 text-red-500` / `bg-amber-100 text-amber-500` / `bg-sky-100 text-sky-500` for high/medium/low. Used in todos and home carousel — if a third page needs them, extract a `PriorityBadge.svelte`.
- **Loading spinner:** `h-8 w-8 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500` appears on multiple pages — candidate for a `Spinner.svelte` component.
- **Empty states:** full-centered column with an emoji + pink muted text, used across all list pages.
- **Section headers:** `text-lg font-black text-pink-600` pattern used for all page section titles.

**Style conventions:** pastel pink/rose/violet palette. Rounded corners (`rounded-2xl`, `rounded-xl`). White cards with `shadow-sm`. `active:scale-95` on interactive elements. Safe-area insets handled on `BottomNav` and root layout wrapper.
