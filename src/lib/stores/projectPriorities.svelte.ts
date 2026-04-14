import { db } from '$lib/firebase';
import { collection, setDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import type { Priority } from './todos.svelte';

export interface ProjectPriority {
	project: string;
	priority: Priority;
}

export const projectPrioritiesStore = $state({
	priorities: {} as Record<string, Priority>,
	loading: true
});

let unsubscribe: (() => void) | null = null;

export function subscribeProjectPriorities() {
	if (unsubscribe) return;
	unsubscribe = onSnapshot(collection(db, 'projectPriorities'), (snapshot) => {
		const map: Record<string, Priority> = {};
		for (const d of snapshot.docs) {
			map[d.id] = d.data().priority as Priority;
		}
		projectPrioritiesStore.priorities = map;
		projectPrioritiesStore.loading = false;
	});
}

export function unsubscribeProjectPriorities() {
	unsubscribe?.();
	unsubscribe = null;
}

export async function setProjectPriority(project: string, priority: Priority) {
	await setDoc(doc(db, 'projectPriorities', project), { priority });
}

export async function clearProjectPriority(project: string) {
	await deleteDoc(doc(db, 'projectPriorities', project));
}
