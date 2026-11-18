import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBDeSzFQ8nVHQg29TDDLnefVwOavHKe_m4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "servicefinder-f2a7d.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "servicefinder-f2a7d",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "servicefinder-f2a7d.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "460527741411",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:460527741411:web:ebc1dc682a9e53cd8958d6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
