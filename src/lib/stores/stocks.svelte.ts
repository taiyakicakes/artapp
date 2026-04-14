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

export interface StockItem {
	id: string;
	project: string;
	name: string;
	quantity: number;
	createdAt: Date;
}

export const stocksStore = $state({
	items: [] as StockItem[],
	loading: true
});

let unsubscribe: (() => void) | null = null;

export function subscribeStocks() {
	if (unsubscribe) return;
	const q = query(collection(db, 'stocks'), orderBy('createdAt', 'asc'));
	unsubscribe = onSnapshot(q, (snapshot) => {
		stocksStore.items = snapshot.docs.map((d) => ({
			id: d.id,
			...(d.data() as Omit<StockItem, 'id' | 'createdAt'>),
			createdAt: d.data().createdAt?.toDate() ?? new Date()
		}));
		stocksStore.loading = false;
	});
}

export function unsubscribeStocks() {
	unsubscribe?.();
	unsubscribe = null;
}

export async function addStockItem(project: string, name: string, quantity = 0) {
	await addDoc(collection(db, 'stocks'), {
		project,
		name,
		quantity,
		createdAt: serverTimestamp()
	});
}

export async function updateStockItem(id: string, data: Partial<Pick<StockItem, 'name' | 'quantity' | 'project'>>) {
	await updateDoc(doc(db, 'stocks', id), data);
}

export async function deleteStockItem(id: string) {
	await deleteDoc(doc(db, 'stocks', id));
}
