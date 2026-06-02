import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, browserSessionPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSy...", 
  authDomain: "alhussam-app.firebaseapp.com", 
  projectId: "alhussam-app",
  storageBucket: "alhussam-app.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// حل مشكلة تعارض الويب مع الهاتف لتجنب فشل البناء في GitHub
let auth;
if (typeof window !== 'undefined' && !navigator.product?.includes('ReactNative')) {
  // إذا كانت البيئة ويب (Vite Build)
  auth = initializeAuth(app, {
    persistence: browserSessionPersistence
  });
} else {
  // إذا كانت البيئة هاتف (React Native)
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

export { app, auth };

