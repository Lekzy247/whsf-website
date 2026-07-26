import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBP2_OhBarPp0RjWhb5QCQxCI2ltSNYEwo',
  authDomain: 'agrilearn-c3d57.firebaseapp.com',
  projectId: 'agrilearn-c3d57',
  storageBucket: 'agrilearn-c3d57.firebasestorage.app',
  messagingSenderId: '802565739001',
  appId: '1:802565739001:web:fd289912ad0ccf63886d28'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function registerLearner({ name, email, password, country, role, interest }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  await setDoc(doc(db, 'users', credential.user.uid), {
    name, email, country, role, interest,
    accountType: 'student',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await sendEmailVerification(credential.user);
  return credential.user;
}

export async function loginLearner(email, password) {
  return (await signInWithEmailAndPassword(auth, email, password)).user;
}

export async function resetLearnerPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function logoutLearner() {
  await signOut(auth);
}

export async function getLearnerProfile(uid) {
  const snapshot = await getDoc(doc(db, 'users', uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function friendlyAuthError(error) {
  const code = error?.code || '';
  const messages = {
    'auth/email-already-in-use': 'An account already exists with this email address.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/network-request-failed': 'Network error. Check your internet connection and try again.'
  };
  return messages[code] || error?.message || 'Something went wrong. Please try again.';
}
