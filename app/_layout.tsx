try { require('@livekit/react-native'); } catch(e) { console.warn('[LiveKit] polyfill yüklenemedi:', e); } // LiveKit RN polyfill
import { useEffect, useState, useRef, createContext, useContext } from 'react';
import { View, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../constants/firebase';
import { setActiveTheme, type ThemeKey } from '../constants/themeEngine';
import { Colors } from '../constants/theme';
import { ProfileService, MessageService, type Profile, type Message } from '../services/database';
import { PushNotificationService } from '../services/pushNotifications';
import { SettingsService } from '../services/settings';
import { CallService, type CallSignal } from '../services/call';
import { Toast } from '../components/Toast';
import { IncomingCallOverlay } from '../components/IncomingCallOverlay';
import MiniRoomCard, { type MinimizedRoom } from '../components/MiniRoomCard';

import SplashOverlay from '../components/SplashOverlay';

SplashScreen.preventAutoHideAsync();

// ========== AUTH CONTEXT ==========
type AuthContextType = {
  isAuthReady: boolean;
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  user: { name: string; avatar: string } | null;
  setUser: (u: { name: string; avatar: string } | null) => void;
  firebaseUser: User | null;
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  refreshProfile: () => Promise<void>;
  minimizedRoom: MinimizedRoom | null;
  setMinimizedRoom: (r: MinimizedRoom | null) => void;
};

export const AuthContext = createContext<AuthContextType>({
  isAuthReady: false,
  isLoggedIn: false,
  setIsLoggedIn: () => {},
  user: null,
  setUser: () => {},
  firebaseUser: null,
  profile: null,
  setProfile: () => {},
  refreshProfile: async () => {},
  minimizedRoom: null,
  setMinimizedRoom: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ========== AUTH GUARD ==========
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthReady, isLoggedIn, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthReady) return; // Firebase & Profil kontrolü bitene kadar bekle

    const inAuthGroup = segments[0] === '(auth)';
    const isOnboarding = segments.length > 1 && segments[1] === 'onboarding';

    if (!isLoggedIn) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // Giris yapmis, ama profil tam mi?
      // birth_date kontrol edilir, eger yoksa kayit yarim kalmistir.
      const hasCompleteProfile = profile && profile.birth_date && profile.gender;

      if (!profile || !hasCompleteProfile) {
        // Eksik profil -> Kesinlikle onboarding e girmeli
        if (!isOnboarding) {
          router.replace('/(auth)/onboarding');
        }
      } else {
        // Tam Profil -> Artik (auth) sayfalarinda durmamali
        if (inAuthGroup) {
          router.replace('/(tabs)/home');
        }
      }
    }
  }, [isAuthReady, isLoggedIn, profile, segments]);

  return <>{children}</>;
}

// ========== ROOT LAYOUT ==========
const { width, height } = Dimensions.get('window');

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ name: string; avatar: string } | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [minimizedRoom, setMinimizedRoom] = useState<MinimizedRoom | null>(null);

  // Gelen arama state
  const [incomingCall, setIncomingCall] = useState<CallSignal | null>(null);

  // Tema yükleme — uygulama açılışında
  useEffect(() => {
    (async () => {
      const s = await SettingsService.get();
      setActiveTheme(s.theme as ThemeKey);
    })();
  }, []);

  // Profili Supabase'den yükle (Eskisi gibi yoksa hemen OLUŞTURMA! Onboarding ekranında oluşturulacak)
  const syncProfile = async (fbUser: User) => {
    try {
      const existingProfile = await ProfileService.get(fbUser.uid);
      if (existingProfile) {
        await ProfileService.setOnline(fbUser.uid, true);
        setProfile(existingProfile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.warn('Profil kontrolü başarısız:', err);
      setProfile(null);
    } finally {
      setIsAuthReady(true);
    }
  };

  const refreshProfile = async () => {
    if (firebaseUser) {
      const p = await ProfileService.get(firebaseUser.uid);
      if (p) setProfile(p);
    }
  };

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        setUser({
          name: fbUser.displayName || 'Kullanıcı',
          avatar: fbUser.photoURL || 'https://i.pravatar.cc/120?img=3',
        });
        setIsLoggedIn(true);
        // Supabase profilini bekle (isAuthReady'i burada true yapacak)
        await syncProfile(fbUser);

        // Push bildirim token'ı al ve kaydet
        const pushToken = await PushNotificationService.registerForPushNotifications();
        if (pushToken) {
          await PushNotificationService.savePushToken(fbUser.uid, pushToken);
        }
      } else {
        setFirebaseUser(null);
        setProfile(null);
        setIsLoggedIn(false);
        setIsAuthReady(true);
      }
    });
    return unsubscribe;
  }, []);

  // Push bildirim: Yeni DM geldiğinde yerel bildirim at + tıklanınca yönlendir
  useEffect(() => {
    if (!firebaseUser) return;

    const messageChannel = MessageService.onNewMessage(firebaseUser.uid, async (newMsg: Message) => {
      const senderName = newMsg.sender?.display_name || 'Birisi';
      await PushNotificationService.notifyNewMessage(
        senderName,
        newMsg.content,
        newMsg.sender_id
      );
    });

    const responseListener = PushNotificationService.addResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.route) {
        try { router2.push(data.route as any); } catch (e) { /* ignore */ }
      }
    });

    return () => {
      messageChannel.unsubscribe();
      if (responseListener) {
        responseListener.remove();
      }
    };
  }, [firebaseUser]);

  // Gelen arama dinleyicisi (global)
  useEffect(() => {
    if (!firebaseUser) return;
    const callChannel = CallService.onCallSignal(firebaseUser.uid, (signal) => {
      if (signal.action === 'incoming_call') {
        setIncomingCall(signal);
      } else if (signal.action === 'call_ended') {
        setIncomingCall(null);
      }
    });
    return () => { callChannel.unsubscribe(); };
  }, [firebaseUser]);

  // Deep Link handler
  const router2 = useRouter();
  useEffect(() => {
    function handleDeepLink(url: string) {
      try {
        const parsed = Linking.parse(url);
        if (parsed.path?.startsWith('room/')) {
          router2.push(`/room/${parsed.path.replace('room/', '')}`);
        } else if (parsed.path?.startsWith('user/')) {
          router2.push(`/user/${parsed.path.replace('user/', '')}`);
        } else if (parsed.path?.startsWith('event/')) {
          router2.push(`/event/${parsed.path.replace('event/', '')}`);
        }
      } catch (e) { /* ignore */ }
    }

    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });

    return () => sub?.remove();
  }, []);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  if (showSplash) {
    return <SplashOverlay onFinish={() => setShowSplash(false)} />;
  }

  return (
    <AuthContext.Provider value={{ isAuthReady, isLoggedIn, setIsLoggedIn, user, setUser, firebaseUser, profile, setProfile, refreshProfile, minimizedRoom, setMinimizedRoom }}>
      <View style={styles.container}>
        <StatusBar style="light" />
        <AuthGuard>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#000000' },
              animation: 'fade',
              animationDuration: 250,
            }}
          >
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="room/[id]" options={{ animation: 'fade_from_bottom', animationDuration: 300 }} />
            <Stack.Screen name="chat/[id]" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="user/[id]" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="post/[id]" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="wallet" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="store" options={{ presentation: 'modal', animation: 'fade_from_bottom' }} />
            <Stack.Screen name="plus" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="settings" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="edit-profile" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="notifications" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="create-event" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="event/[id]" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="admin" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="call/[id]" options={{ animation: 'fade_from_bottom', animationDuration: 200, gestureEnabled: false }} />
          </Stack>
        </AuthGuard>
        {/* Küçültülmüş Oda Kartı — Tüm sayfalarda görünür */}
        {minimizedRoom && (
          <MiniRoomCard
            room={minimizedRoom}
            onExpand={() => {
              const roomId = minimizedRoom.id;
              setMinimizedRoom(null);
              router2.push(`/room/${roomId}`);
            }}
            onClose={() => setMinimizedRoom(null)}
          />
        )}
        <Toast />

        {/* Gelen Arama Overlay */}
        <IncomingCallOverlay
          visible={!!incomingCall}
          callerName={incomingCall?.callerName || ''}
          callerAvatar={incomingCall?.callerAvatar}
          callType={incomingCall?.callType || 'audio'}
          onAccept={() => {
            if (!incomingCall || !firebaseUser) return;
            CallService.acceptCall(incomingCall.callerId, firebaseUser.uid, incomingCall.callId).catch(() => {});
            const callData = incomingCall;
            setIncomingCall(null);
            router2.push(`/call/${callData.callerId}?callId=${callData.callId}&callType=${callData.callType}&isIncoming=true` as any);
          }}
          onReject={() => {
            if (!incomingCall || !firebaseUser) return;
            CallService.rejectCall(incomingCall.callerId, firebaseUser.uid, incomingCall.callId).catch(() => {});
            setIncomingCall(null);
          }}
        />
      </View>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  splashContainer: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  ring: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: 'rgba(20,184,166,0.25)' },
  ring2: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(20,184,166,0.08)' },
  splashLogo: { width: 320, height: 320 },
});
