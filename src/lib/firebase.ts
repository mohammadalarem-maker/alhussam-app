import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, browserSessionPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// الإعدادات الحقيقية والمطابقة تماماً لملف الـ JSON الخاص بك
const firebaseConfig = {
  apiKey: "AIzaSyDd8NpBy-Ft269o4c5R5J10mZDnFVmmJVE",
  authDomain: "alhussam-store-2ae68.firebaseapp.com",
  projectId: "alhussam-store-2ae68",
  storageBucket: "alhussam-store-2ae68.firebasestorage.app",
  messagingSenderId: "450062176386",
  appId: "1:450062176386:android:ed88d0b88d9cf2155f249b"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);

let auth;

if (typeof window !== 'undefined' && !navigator.product?.includes('ReactNative')) {
  auth = initializeAuth(app, {
    persistence: browserSessionPersistence
  });
} else {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const { getReactNativePersistence } = require('firebase/auth');
  
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

const testConnection = async () => {
  return true;
};

const handleFirestoreError = (error: any) => {
  console.error("Firestore Error:", error);
  return error?.message || String(error);
};

const OperationType = {} as any;

export { app, auth, db, testConnection, storage, handleFirestoreError, OperationType };

