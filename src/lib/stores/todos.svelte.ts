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
	serverTimestamp,
	writeBatch,
	getDocs,
	where,
	getDoc
} from 'firebase/firestore';

export type Priority = 'high' | 'medium' | 'low';

export interface Todo {
	id: string;
	project: string;
	task: string;
	done: boolean;
	priority: Priority;
	createdAt: Date;
	blockedBy?: string; // id of blocking todo
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

export async function updateTodoTask(id: string, task: string) {
	await updateDoc(doc(db, 'todos', id), { task });
}

export async function setBlocker(id: string, blockedBy: string | null) {
	if (blockedBy === null) {
		const { deleteField } = await import('firebase/firestore');
		await updateDoc(doc(db, 'todos', id), { blockedBy: deleteField() });
	} else {
		await updateDoc(doc(db, 'todos', id), { blockedBy });
	}
}

export async function deleteTodo(id: string) {
	await deleteDoc(doc(db, 'todos', id));
}

export async function deleteProject(project: string) {
	const ids = todosStore.todos.filter((t) => t.project === project).map((t) => t.id);
	await Promise.all(ids.map((id) => deleteDoc(doc(db, 'todos', id))));
}

export async function renameProject(oldName: string, newName: string) {
	const trimmed = newName.trim();
	if (!trimmed || trimmed === oldName) return;

	const batch = writeBatch(db);

	// Update todos
	const todosSnap = await getDocs(query(collection(db, 'todos'), where('project', '==', oldName)));
	for (const d of todosSnap.docs) {
		batch.update(d.ref, { project: trimmed });
	}

	// Update stocks
	const stocksSnap = await getDocs(
		query(collection(db, 'stocks'), where('project', '==', oldName))
	);
	for (const d of stocksSnap.docs) {
		batch.update(d.ref, { project: trimmed });
	}

	// Rename in projectPriorities
	const ppDoc = await getDoc(doc(db, 'projectPriorities', oldName));
	if (ppDoc.exists()) {
		batch.set(doc(db, 'projectPriorities', trimmed), ppDoc.data());
		batch.delete(doc(db, 'projectPriorities', oldName));
	}

	// Rename in archivedProjects
	const apDoc = await getDoc(doc(db, 'archivedProjects', oldName));
	if (apDoc.exists()) {
		batch.set(doc(db, 'archivedProjects', trimmed), {});
		batch.delete(doc(db, 'archivedProjects', oldName));
	}

	await batch.commit();
}
