import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, browserSessionPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSy...", 
  authDomain: "alhussam-app.firebaseapp.com", 
  projectId: "alhussam-app",
  storageBucket: "alhussam-app.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth;

// فحص البيئة: إذا كنا داخل المتصفح أو بيئة بناء الويب (Vite)
if (typeof window !== 'undefined' && !navigator.product?.includes('ReactNative')) {
  auth = initializeAuth(app, {
    persistence: browserSessionPersistence
  });
} else {
  // هنا الحل السحري للهاتف: استدعاء الحزم داخلياً فقط عند التشغيل الفعلي على الجوال
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const { getReactNativePersistence } = require('firebase/auth');
  
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

export { app, auth };

