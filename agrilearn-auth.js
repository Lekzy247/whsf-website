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

const ROLE_ALIASES = {
  student: 'student',
  learner: 'student',
  farmer: 'student',
  entrepreneur: 'student',
  professional: 'student',
  'community volunteer': 'student',
  instructor: 'instructor',
  teacher: 'instructor',
  'teacher or instructor': 'instructor',
  organization: 'organization',
  organisation: 'organization',
  admin: 'admin',
  'super admin': 'super-admin'
};

export function normalizeAccountType(value = '') {
  return ROLE_ALIASES[String(value).trim().toLowerCase()] || 'student';
}

export function dashboardForRole(role = 'student') {
  const accountType = normalizeAccountType(role);
  if (accountType === 'instructor') return '/agrilearn-ai/instructor';
  if (accountType === 'organization') return '/agrilearn-ai/organization';
  if (accountType === 'admin' || accountType === 'super-admin') return '/agrilearn-ai/admin';
  return '/agrilearn-ai/dashboard';
}

export async function registerLearner({ name, email, password, country, role, interest }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const accountType = normalizeAccountType(role);
  await updateProfile(credential.user, { displayName: name });
  await setDoc(doc(db, 'users', credential.user.uid), {
    name,
    email,
    country,
    role,
    interest,
    accountType,
    status: accountType === 'instructor' || accountType === 'organization' ? 'pending-review' : 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await sendEmailVerification(credential.user);
  return { user: credential.user, accountType };
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

export async function resolveUserDashboard(user) {
  if (!user) return '/agrilearn-ai/login';
  const profile = await getLearnerProfile(user.uid);
  return dashboardForRole(profile?.accountType || profile?.role || 'student');
}

export async function requireRole(user, allowedRoles = []) {
  if (!user) return { allowed: false, redirect: '/agrilearn-ai/login', profile: null };
  const profile = await getLearnerProfile(user.uid);
  const accountType = normalizeAccountType(profile?.accountType || profile?.role || 'student');
  const allowed = allowedRoles.map(normalizeAccountType).includes(accountType);
  return { allowed, redirect: dashboardForRole(accountType), profile: { ...profile, accountType } };
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
