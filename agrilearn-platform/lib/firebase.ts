import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const fallbackConfig = {
  apiKey: "AIzaSyBP2_OhBarPp0RjWhb5QCQxCI2ltSNYEwo",
  authDomain: "agrilearn-c3d57.firebaseapp.com",
  projectId: "agrilearn-c3d57",
  storageBucket: "agrilearn-c3d57.firebasestorage.app",
  messagingSenderId: "802565739001",
  appId: "1:802565739001:web:fd289912ad0ccf63886d28",
};

function validApiKey(value: string | undefined) {
  const normalized = value?.trim().replace(/^['"]|['"]$/g, "");
  return normalized?.startsWith("AIza") ? normalized : fallbackConfig.apiKey;
}

function envValue(value: string | undefined, fallback: string) {
  const normalized = value?.trim().replace(/^['"]|['"]$/g, "");
  return normalized || fallback;
}

const firebaseConfig = {
  apiKey: validApiKey(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: envValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, fallbackConfig.authDomain),
  projectId: envValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, fallbackConfig.projectId),
  storageBucket: envValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, fallbackConfig.storageBucket),
  messagingSenderId: envValue(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    fallbackConfig.messagingSenderId,
  ),
  appId: envValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, fallbackConfig.appId),
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
