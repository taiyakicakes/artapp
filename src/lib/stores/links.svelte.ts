import { db } from '$lib/firebase';
import {
	collection,
	addDoc,
	deleteDoc,
	doc,
	onSnapshot,
	query,
	orderBy,
	serverTimestamp
} from 'firebase/firestore';

export interface Link {
	id: string;
	label: string;
	url: string;
	createdAt: Date;
}

export const linksStore = $state({
	links: [] as Link[],
	loading: true
});

let unsubscribe: (() => void) | null = null;

export function subscribeLinks() {
	if (unsubscribe) return;
	const q = query(collection(db, 'links'), orderBy('createdAt', 'asc'));
	unsubscribe = onSnapshot(q, (snapshot) => {
		linksStore.links = snapshot.docs.map((d) => ({
			id: d.id,
			...(d.data() as Omit<Link, 'id' | 'createdAt'>),
			createdAt: d.data().createdAt?.toDate() ?? new Date()
		}));
		linksStore.loading = false;
	});
}

export function unsubscribeLinks() {
	unsubscribe?.();
	unsubscribe = null;
}

export async function addLink(label: string, url: string) {
	// Ensure URL has protocol
	const normalized = url.startsWith('http') ? url : `https://${url}`;
	await addDoc(collection(db, 'links'), {
		label,
		url: normalized,
		createdAt: serverTimestamp()
	});
}

export async function deleteLink(id: string) {
	await deleteDoc(doc(db, 'links', id));
}
