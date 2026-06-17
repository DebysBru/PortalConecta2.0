import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'placeholder-firebase-api-key',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'placeholder-firebase-auth-domain',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'placeholder-firebase-project-id',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'placeholder-firebase-storage-bucket',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'placeholder-firebase-messaging-sender-id',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'placeholder-firebase-app-id',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
