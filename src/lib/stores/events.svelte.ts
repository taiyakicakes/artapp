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

export type EventStatus = 'none' | 'applied' | 'accepted' | 'waitlisted' | 'rejected';

export type EventType = 'standard' | 'application';

export interface ArtEvent {
	id: string;
	name: string;
	date: string; // YYYY-MM-DD (event date; optional for application type)
	location: string;
	applied: boolean;
	eventType?: EventType;
	status?: EventStatus;
	applicationDueDate?: string | null; // YYYY-MM-DD
	revenue?: number | null;
	requirements: string[];
	links: string[];
	cost: number | null;
	travelCost: number | null;
	notes: string;
	linkedProjects: string[];
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

export async function updateEventStatus(id: string, status: EventStatus) {
	const update: Record<string, unknown> = { status, applied: status !== 'none' };
	// Auto-convert application → standard when outcome is known
	if (status === 'accepted' || status === 'rejected') {
		update.eventType = 'standard';
	}
	await updateDoc(doc(db, 'events', id), update);
}

export function getEventStatus(event: ArtEvent): EventStatus {
	if (event.status) return event.status;
	return event.applied ? 'applied' : 'none';
}

export async function renameProjectInEvents(oldName: string, newName: string) {
	const trimmed = newName.trim();
	const toUpdate = eventsStore.events.filter((e) => e.linkedProjects?.includes(oldName));
	await Promise.all(
		toUpdate.map((e) =>
			updateEvent(e.id, {
				linkedProjects: e.linkedProjects.map((p) => (p === oldName ? trimmed : p))
			})
		)
	);
}
