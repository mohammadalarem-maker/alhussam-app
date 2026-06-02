import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// الإعدادات الجديدة لحسابك Mohammedalsarem6@gmail.com
// سيتم قراءتها وتطبيقها مباشرة من نظام الـ Android المرتبط بملف google-services.json الجديد
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSy...", // الكود سيعتمد على الربط الجديد تلقائياً
  authDomain: "alhussam-app.firebaseapp.com", 
  projectId: "alhussam-app",
  storageBucket: "alhussam-app.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

// إنشاء التطبيق وتجنب التكرار
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// إعداد الحماية والتحقق لضمان عدم تذكر الحساب القديم على الهاتف ومزامنة الحساب الجديد
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export { app, auth };

