import { db } from '$lib/firebase';
import { collection, setDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';

export const archivedProjectsStore = $state({
	archived: new Set<string>(),
	loading: true
});

let unsubscribe: (() => void) | null = null;

export function subscribeArchivedProjects() {
	if (unsubscribe) return;
	unsubscribe = onSnapshot(collection(db, 'archivedProjects'), (snapshot) => {
		archivedProjectsStore.archived = new Set(snapshot.docs.map((d) => d.id));
		archivedProjectsStore.loading = false;
	});
}

export function unsubscribeArchivedProjects() {
	unsubscribe?.();
	unsubscribe = null;
}

export async function archiveProject(project: string) {
	await setDoc(doc(db, 'archivedProjects', project), {});
}

export async function unarchiveProject(project: string) {
	await deleteDoc(doc(db, 'archivedProjects', project));
}
