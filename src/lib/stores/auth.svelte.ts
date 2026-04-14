import { auth } from '$lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { PUBLIC_ALLOWED_EMAIL } from '$env/static/public';

const ALLOWED_EMAIL = PUBLIC_ALLOWED_EMAIL;
const provider = new GoogleAuthProvider();

export const authStore = $state({
	user: null as User | null,
	loading: true,
	authorized: false
});

auth.onAuthStateChanged((user) => {
	authStore.user = user;
	authStore.loading = false;
	authStore.authorized = user?.email === ALLOWED_EMAIL;
});

export async function signIn() {
	await signInWithPopup(auth, provider);
}

export async function signOut() {
	await firebaseSignOut(auth);
}
