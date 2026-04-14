import { db } from '$lib/firebase';
import {
	collection,
	addDoc,
	updateDoc,
	deleteDoc,
	doc,
	onSnapshot,
	query,
	orderBy,
	serverTimestamp
} from 'firebase/firestore';

export interface ArtEvent {
	id: string;
	name: string;
	date: string; // YYYY-MM-DD
	location: string;
	applied: boolean;
	requirements: string[];
	links: string[];
	cost: number | null;
	travelCost: number | null;
	notes: string;
	createdAt: Date;
}

export const eventsStore = $state({
	events: [] as ArtEvent[],
	loading: true
});

let unsubscribe: (() => void) | null = null;

export function subscribeEvents() {
	if (unsubscribe) return;
	const q = query(collection(db, 'events'), orderBy('date', 'asc'));
	unsubscribe = onSnapshot(q, (snapshot) => {
		eventsStore.events = snapshot.docs.map((d) => ({
			id: d.id,
			...(d.data() as Omit<ArtEvent, 'id' | 'createdAt'>),
			createdAt: d.data().createdAt?.toDate() ?? new Date()
		}));
		eventsStore.loading = false;
	});
}

export function unsubscribeEvents() {
	unsubscribe?.();
	unsubscribe = null;
}

export async function addEvent(event: Omit<ArtEvent, 'id' | 'createdAt'>) {
	await addDoc(collection(db, 'events'), {
		...event,
		createdAt: serverTimestamp()
	});
}

export async function updateEvent(id: string, data: Partial<Omit<ArtEvent, 'id' | 'createdAt'>>) {
	await updateDoc(doc(db, 'events', id), data);
}

export async function deleteEvent(id: string) {
	await deleteDoc(doc(db, 'events', id));
}

export async function toggleApplied(id: string, applied: boolean) {
	await updateDoc(doc(db, 'events', id), { applied });
}
