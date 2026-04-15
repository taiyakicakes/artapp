import { db } from '$lib/firebase';
import {
	collection,
	addDoc,
	deleteDoc,
	updateDoc,
	doc,
	onSnapshot,
	query,
	orderBy,
	serverTimestamp
} from 'firebase/firestore';

export interface CashTransaction {
	id: string;
	eventId: string;
	description: string;
	amount: number;
	type: 'income' | 'expense';
	createdAt: Date;
}

export const cashStore = $state({
	transactions: [] as CashTransaction[],
	loading: true
});

let unsubscribe: (() => void) | null = null;

export function subscribeCash() {
	if (unsubscribe) return;
	const q = query(collection(db, 'cashTransactions'), orderBy('createdAt', 'asc'));
	unsubscribe = onSnapshot(q, (snapshot) => {
		cashStore.transactions = snapshot.docs.map((d) => ({
			id: d.id,
			...(d.data() as Omit<CashTransaction, 'id' | 'createdAt'>),
			createdAt: d.data().createdAt?.toDate() ?? new Date()
		}));
		cashStore.loading = false;
	});
}

export function unsubscribeCash() {
	unsubscribe?.();
	unsubscribe = null;
}

export async function addCashTransaction(
	eventId: string,
	description: string,
	amount: number,
	type: 'income' | 'expense'
) {
	await addDoc(collection(db, 'cashTransactions'), {
		eventId,
		description,
		amount,
		type,
		createdAt: serverTimestamp()
	});
}

export async function deleteCashTransaction(id: string) {
	await deleteDoc(doc(db, 'cashTransactions', id));
}

export async function updateCashTransaction(
	id: string,
	data: Partial<Pick<CashTransaction, 'description' | 'amount' | 'type'>>
) {
	await updateDoc(doc(db, 'cashTransactions', id), data);
}
