import { db } from '$lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export interface AppSettings {
	homeBg?: string;
	todosBg?: string;
	stockBg?: string;
	eventsBg?: string;
	calendarBg?: string;
	cashBg?: string;
	settingsBg?: string;
}

export const settingsStore = $state({
	settings: {} as AppSettings,
	loading: true
});

let unsubscribe: (() => void) | null = null;

export function subscribeSettings() {
	if (unsubscribe) return;
	unsubscribe = onSnapshot(doc(db, 'settings', 'app'), (d) => {
		settingsStore.settings = d.exists() ? (d.data() as AppSettings) : {};
		settingsStore.loading = false;
	});
}

export function unsubscribeSettings() {
	unsubscribe?.();
	unsubscribe = null;
}

export async function updateSettings(data: Partial<AppSettings>) {
	await setDoc(doc(db, 'settings', 'app'), data, { merge: true });
}
