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

export interface AppLink {
	id: string;
	label: string;
	url: string;
	createdAt: Date;
}

export const appLinksStore = $state({
	links: [] as AppLink[],
	loading: true
});

let unsubscribe: (() => void) | null = null;

export function subscribeAppLinks() {
	if (unsubscribe) return;
	const q = query(collection(db, 'appLinks'), orderBy('createdAt', 'asc'));
	unsubscribe = onSnapshot(q, (snapshot) => {
		appLinksStore.links = snapshot.docs.map((d) => ({
			id: d.id,
			...(d.data() as Omit<AppLink, 'id' | 'createdAt'>),
			createdAt: d.data().createdAt?.toDate() ?? new Date()
		}));
		appLinksStore.loading = false;
	});
}

export function unsubscribeAppLinks() {
	unsubscribe?.();
	unsubscribe = null;
}

export async function addAppLink(label: string, url: string) {
	const normalized = url.startsWith('http') ? url : `https://${url}`;
	await addDoc(collection(db, 'appLinks'), {
		label,
		url: normalized,
		createdAt: serverTimestamp()
	});
}

export async function deleteAppLink(id: string) {
	await deleteDoc(doc(db, 'appLinks', id));
}
