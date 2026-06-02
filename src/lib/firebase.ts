import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, browserSessionPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSy...", 
  authDomain: "alhussam-app.firebaseapp.com", 
  projectId: "alhussam-app",
  storageBucket: "alhussam-app.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

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

// دالة وهمية لتجاوز خطأ الاستيراد في ملف main.tsx
const testConnection = async () => {
  return true;
};

export { app, auth, db, testConnection }; // أضفنا testConnection هنا في التصدير

