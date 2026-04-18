import { initializeApp, getApps } from 'firebase/app';
// @ts-ignore — getReactNativePersistence is available in Metro RN bundle but not in TS types
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase config — google-services.json'dan türetildi
const firebaseConfig = {
  apiKey: 'AIzaSyDOwS7wZV3B-MAT87JERtVSVKftpr-Wy-c',
  authDomain: 'sopranochat-5738e.firebaseapp.com',
  projectId: 'sopranochat-5738e',
  storageBucket: 'sopranochat-5738e.firebasestorage.app',
  messagingSenderId: '236660998634',
  appId: '1:236660998634:android:3254282bc9cedbfb49f293',
};

// Firebase'i sadece bir kez başlat
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// React Native için Auth — AsyncStorage ile oturum kalıcılığı
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  }) as any;
} catch (e) {
  // Auth zaten initialize edilmişse getAuth kullan
  auth = getAuth(app);
}

// Google OAuth web client ID
export const GOOGLE_WEB_CLIENT_ID =
  '236660998634-rk3hae9hu4a75sem79ep4l773ekd9rt2.apps.googleusercontent.com';

export { app, auth };


