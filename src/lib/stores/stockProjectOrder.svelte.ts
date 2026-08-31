import { db } from '$lib/firebase';
import { collection, setDoc, doc, onSnapshot } from 'firebase/firestore';

export const stockProjectOrderStore = $state({
	order: {} as Record<string, number>,
	loading: true
});

let unsubscribe: (() => void) | null = null;

export function subscribeStockProjectOrder() {
	if (unsubscribe) return;
	unsubscribe = onSnapshot(collection(db, 'stockProjectOrder'), (snapshot) => {
		const map: Record<string, number> = {};
		for (const d of snapshot.docs) {
			map[d.id] = d.data().order as number;
		}
		stockProjectOrderStore.order = map;
		stockProjectOrderStore.loading = false;
	});
}

export function unsubscribeStockProjectOrder() {
	unsubscribe?.();
	unsubscribe = null;
}

export async function setStockProjectOrder(project: string, order: number) {
	await setDoc(doc(db, 'stockProjectOrder', project), { order });
}
