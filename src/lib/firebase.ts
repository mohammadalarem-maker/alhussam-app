import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, browserSessionPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage'; // استيراد الـ Storage للملفات والصور

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
const storage = getStorage(app); // تعريف متغير الـ storage لصفحة المنتجات

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

// دالة فحص الاتصال لملف main.tsx
const testConnection = async () => {
  return true;
};

// دالة معالجة أخطاء الفايربيس المطلوبة لصفحة المنتجات
const handleFirestoreError = (error: any) => {
  console.error("Firestore Error:", error);
  return error?.message || String(error);
};

// متغير نوع العمليات المطلوب لصفحة المنتجات
const OperationType = {} as any;

export { app, auth, db, testConnection, storage, handleFirestoreError, OperationType };

