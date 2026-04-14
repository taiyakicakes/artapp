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

export type Priority = 'high' | 'medium' | 'low';

export interface Todo {
	id: string;
	project: string;
	task: string;
	done: boolean;
	priority: Priority;
	createdAt: Date;
}

export const todosStore = $state({
	todos: [] as Todo[],
	loading: true
});

let unsubscribe: (() => void) | null = null;

export function subscribeTodos() {
	if (unsubscribe) return;
	const q = query(collection(db, 'todos'), orderBy('createdAt', 'asc'));
	unsubscribe = onSnapshot(q, (snapshot) => {
		todosStore.todos = snapshot.docs.map((d) => ({
			id: d.id,
			...(d.data() as Omit<Todo, 'id' | 'createdAt'>),
			createdAt: d.data().createdAt?.toDate() ?? new Date()
		}));
		todosStore.loading = false;
	});
}

export function unsubscribeTodos() {
	unsubscribe?.();
	unsubscribe = null;
}

export async function addTodo(project: string, task: string, priority: Priority = 'medium') {
	await addDoc(collection(db, 'todos'), {
		project,
		task,
		done: false,
		priority,
		createdAt: serverTimestamp()
	});
}

export async function toggleTodo(id: string, done: boolean) {
	await updateDoc(doc(db, 'todos', id), { done });
}

export async function updateTodoPriority(id: string, priority: Priority) {
	await updateDoc(doc(db, 'todos', id), { priority });
}

export async function deleteTodo(id: string) {
	await deleteDoc(doc(db, 'todos', id));
}

export async function deleteProject(project: string) {
	const ids = todosStore.todos.filter((t) => t.project === project).map((t) => t.id);
	await Promise.all(ids.map((id) => deleteDoc(doc(db, 'todos', id))));
}
