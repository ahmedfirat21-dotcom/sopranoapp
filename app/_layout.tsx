// LiveKit polyfill kaldırıldı — native modül yoksa Hermes'te 'Requiring unknown module' crash'ine sebep oluyordu
import { useEffect, useState, useRef, useCallback, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, StyleSheet, Dimensions, AppState, Platform, PermissionsAndroid } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { Audio } from 'expo-av';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../constants/firebase';
import { setActiveTheme, type ThemeKey } from '../constants/themeEngine';
import { Colors } from '../constants/theme';
import { ProfileService, MessageService, type Profile } from '../services/database';
import { FriendshipService } from '../services/friendship';
import { GamificationService } from '../services/gamification';
import { supabase } from '../constants/supabase';
import { PushNotificationService } from '../services/pushNotifications';
import { SettingsService } from '../services/settings';
import { CallService, type CallSignal } from '../services/call';
import { RevenueCatService } from '../services/revenuecat';
import { i18n } from '../services/i18n';
import { Toast } from '../components/Toast';
import { IncomingCallOverlay } from '../components/IncomingCallOverlay';
import MiniRoomCard, { type MinimizedRoom } from '../components/MiniRoomCard';
import ErrorBoundary from '../components/ErrorBoundary';
// SplashOverlay import kaldırıldı — ARCH-4 FIX (ölü kod temizliği)
import NotificationDrawer from '../components/NotificationDrawer';

import { OnlineFriendsProvider } from '../providers/OnlineFriendsProvider';
export { useOnlineFriends } from '../providers/OnlineFriendsProvider';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { RoomService } from '../services/database';
import { liveKitService } from '../services/livekit';

SplashScreen.preventAutoHideAsync();

// ═══════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER — Production crash'leri logla
// Crashlytics/Sentry eklenince buraya bağlanır
// ═══════════════════════════════════════════════════════════
if (!__DEV__) {
  try {
    // ErrorUtils is a React Native internal global, not a named export.
    // Access it from the global scope with defensive checks.
    const _ErrorUtils = (global as any).ErrorUtils;
    if (_ErrorUtils && typeof _ErrorUtils.getGlobalHandler === 'function') {
      const defaultHandler = _ErrorUtils.getGlobalHandler();
      _ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        // ★ Crash log'u AsyncStorage'a kaydet — Sentry/Crashlytics eklenince buradan okunabilir
        try {
          const crashEntry = JSON.stringify({
            timestamp: new Date().toISOString(),
            message: error?.message || 'Unknown error',
            stack: error?.stack?.substring(0, 500),
            isFatal,
          });
          // Asenkron ama await etmiyoruz — handler senkron olmalı
          AsyncStorage.getItem('soprano_crash_logs').then(raw => {
            const logs: string[] = raw ? JSON.parse(raw) : [];
            logs.unshift(crashEntry);
            // Son 20 hatayı tut — bellek şişmesini önle
            if (logs.length > 20) logs.length = 20;
            AsyncStorage.setItem('soprano_crash_logs', JSON.stringify(logs)).catch(() => {});
          }).catch(() => {});
        } catch { /* crash handler içinde hata olursa sessiz geç */ }
        console.error(`[SopranoChat] ${isFatal ? 'FATAL' : 'NON-FATAL'} ERROR:`, error?.message);
        if (defaultHandler) defaultHandler(error, isFatal);
      });
    }
  } catch (e) {
    // ErrorUtils erişilemezse sessizce geç — uygulama çalışmaya devam etsin
  }
}

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
  /** ★ Cached call signals — call screen mount olmadan gelen sinyalleri yakalar */
  pendingCallSignals: CallSignal[];
  consumeCallSignal: (callId: string, action: string) => CallSignal | undefined;
  /** ★ Aktif arama takibi — meşgul durumu için */
  activeCallId: string | null;
  setActiveCallId: (id: string | null) => void;
  /** ★ BUG-4: Global bildirim drawer kontrolü */
  showNotifDrawer: boolean;
  setShowNotifDrawer: (v: boolean) => void;
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
  pendingCallSignals: [],
  consumeCallSignal: () => undefined,
  activeCallId: null,
  setActiveCallId: () => {},
  showNotifDrawer: false,
  setShowNotifDrawer: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ========== REALTIME BADGE CONTEXT ==========
type BadgeContextType = {
  unreadDMs: number;
  pendingFollows: number;
  unreadNotifs: number;
  totalBadge: number;
  refreshBadges: () => Promise<void>;
};

export const BadgeContext = createContext<BadgeContextType>({
  unreadDMs: 0,
  pendingFollows: 0,
  unreadNotifs: 0,
  totalBadge: 0,
  refreshBadges: async () => {},
});

export function useBadges() {
  return useContext(BadgeContext);
}

// ========== THEME CONTEXT ==========
// Global tema değişikliği — tüm ekranlar bu context'i dinler ve re-render olur
type ThemeContextType = {
  themeVersion: number;
  applyTheme: (key: import('../constants/themeEngine').ThemeKey) => void;
};

export const ThemeContext = createContext<ThemeContextType>({
  themeVersion: 0,
  applyTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ========== REALTIME BADGE PROVIDER ==========
function RealtimeBadgeProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const [unreadDMs, setUnreadDMs] = useState(0);
  const [pendingFollows, setPendingFollows] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const refreshBadges = async () => {
    if (!userId) return;
    try {
      const [dmCount, followCount, notifCount] = await Promise.all([
        MessageService.getUnreadCount(userId),
        FriendshipService.getPendingCount(userId),
        (async () => {
          // ★ Zil badge'i SADECE oda + arama + hediye bildirimlerini sayar
          // follow_* → arkadaş simgesi, dm → mesajlar tab'ında zaten badge var
          const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false)
            .in('type', ['room_live', 'room_invite', 'missed_call', 'incoming_call', 'gift', 'event_reminder']);
          return count || 0;
        })(),
      ]);
      setUnreadDMs(dmCount);
      setPendingFollows(followCount);
      setUnreadNotifs(notifCount);
    } catch (e) {
      if (__DEV__) console.warn('[BadgeProvider] refresh hata:', e);
    }
  };

  // İlk yükleme + realtime
  useEffect(() => {
    if (!userId) {
      setUnreadDMs(0);
      setPendingFollows(0);
      setUnreadNotifs(0);
      return;
    }

    // İlk sayıları çek
    refreshBadges();

    // 1. DM realtime — yeni mesaj gelince unread artır
    const dmSub = supabase
      .channel(`badge_dm:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      }, () => {
        setUnreadDMs(prev => prev + 1);
      })
      .subscribe();

    // 2. Friendship realtime — pending istek gelince sayıyı güncelle
    const friendSub = FriendshipService.onFriendshipChange(userId, (requests) => {
      setPendingFollows(requests.length);
    });

    // 3. Notifications realtime — yeni bildirim gelince sayıyı artır
    // ★ Zil badge'ine dahil olan bildirim tipleri (oda + arama + hediye)
    const BELL_NOTIF_TYPES = ['room_live', 'room_invite', 'missed_call', 'incoming_call', 'gift', 'event_reminder'];
    const notifSub = supabase
      .channel(`badge_notif:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload: any) => {
        const notifType = payload.new?.type;
        if (!BELL_NOTIF_TYPES.includes(notifType)) return; // Sadece oda/arama/hediye bildirimlerini say
        setUnreadNotifs(prev => prev + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dmSub);
      FriendshipService.unsubscribe(friendSub);
      supabase.removeChannel(notifSub);
    };
  }, [userId]);

  const totalBadge = unreadDMs + pendingFollows + unreadNotifs;

  return (
    <BadgeContext.Provider value={{ unreadDMs, pendingFollows, unreadNotifs, totalBadge, refreshBadges }}>
      {children}
    </BadgeContext.Provider>
  );
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
      // display_name kontrol edilir, yoksa onboarding tamamlanmamistir.
      const hasCompleteProfile = profile && profile.display_name;

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

  // ★ Auth hazır değilken loading göster — siyah ekranı önle
  if (!isAuthReady) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          borderWidth: 3, borderColor: 'rgba(20,184,166,0.15)',
          borderTopColor: '#14B8A6',
        }} />
      </View>
    );
  }

  return <>{children}</>;
}

// ========== ROOT LAYOUT ==========
const { width, height } = Dimensions.get('window');

export default function RootLayout() {
  // ★ ARCH-4 FIX: Splash logic temizlendi — showSplash her zaman false'tı (ölü kod)
  // SplashScreen.hideAsync() artık tek yerde (auth ready sonrası) çağrılır
  useEffect(() => {
    // Native splash screen'i hemen gizle — auth guard kendi loading'ini gösterecek
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ name: string; avatar: string } | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [minimizedRoom, setMinimizedRoom] = useState<MinimizedRoom | null>(null);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);

  // ★ Minimize heartbeat — oda küçültüldüğünde heartbeat global olarak devam eder
  const minimizedHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (minimizedRoom && firebaseUser?.uid) {
      // Heartbeat başlat — zombie temizliğine maruz kalmayı önle
      RoomService.heartbeat(minimizedRoom.id, firebaseUser.uid).catch(() => {});
      minimizedHeartbeatRef.current = setInterval(() => {
        RoomService.heartbeat(minimizedRoom.id, firebaseUser.uid).catch(() => {});
      }, 45000); // 45sn — zombie threshold (90sn) altında
    } else {
      // Heartbeat durdur
      if (minimizedHeartbeatRef.current) {
        clearInterval(minimizedHeartbeatRef.current);
        minimizedHeartbeatRef.current = null;
      }
    }
    return () => {
      if (minimizedHeartbeatRef.current) {
        clearInterval(minimizedHeartbeatRef.current);
        minimizedHeartbeatRef.current = null;
      }
    };
  }, [minimizedRoom?.id, firebaseUser?.uid]);

  // Gelen arama state
  const [incomingCall, setIncomingCall] = useState<CallSignal | null>(null);
  const incomingCallRef = useRef<CallSignal | null>(null);
  // ★ SORUN-6 FIX: Ref ve state senkron tut — closure'da stale değer önle
  const updateIncomingCall = useCallback((call: CallSignal | null) => {
    incomingCallRef.current = call;
    setIncomingCall(call);
  }, []);

  // ★ Aktif arama takibi — meşgul durumu için
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  // Ref ve state senkron tut
  const updateActiveCallId = useCallback((id: string | null) => {
    activeCallIdRef.current = id;
    setActiveCallId(id);
  }, []);

  // ★ Signal cache — call ekranı mount olmadan gelen sinyalleri yakalar
  const pendingCallSignalsRef = useRef<CallSignal[]>([]);
  const [pendingCallSignals, setPendingCallSignals] = useState<CallSignal[]>([]);

  const consumeCallSignal = useCallback((callId: string, action: string): CallSignal | undefined => {
    const idx = pendingCallSignalsRef.current.findIndex(
      s => s.callId === callId && s.action === action
    );
    if (idx >= 0) {
      const [signal] = pendingCallSignalsRef.current.splice(idx, 1);
      setPendingCallSignals([...pendingCallSignalsRef.current]);
      return signal;
    }
    return undefined;
  }, []);

  // Tema + Dil yükleme — uygulama açılışında
  const [themeVersion, setThemeVersion] = useState(0);
  const applyTheme = useCallback((key: import('../constants/themeEngine').ThemeKey) => {
    setActiveTheme(key);
    setThemeVersion(v => v + 1);
  }, []);
  useEffect(() => {
    (async () => {
      const s = await SettingsService.get();
      setActiveTheme(s.theme as ThemeKey);
      await i18n.init();
      setThemeVersion(v => v + 1); // force re-render with loaded theme
    })();
  }, []);



  // ★ İzinleri uygulama başlangıcında bir kez iste (kamera, mikrofon)
  useEffect(() => {
    if (!isAuthReady || !isLoggedIn) return;
    (async () => {
      try {
        const alreadyAsked = await AsyncStorage.getItem('soprano_permissions_asked');
        if (alreadyAsked === 'true') return;

        if (Platform.OS === 'android') {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);
        } else {
          // iOS: Hem mikrofon hem kamera izni iste
          await Audio.requestPermissionsAsync();
          // Kamera izni — expo-image-picker üzerinden
          try {
            const ImagePicker = require('expo-image-picker');
            await ImagePicker.requestCameraPermissionsAsync();
          } catch { /* expo-image-picker yoksa atla */ }
        }

        await AsyncStorage.setItem('soprano_permissions_asked', 'true');
        if (__DEV__) console.log('[Permissions] Kamera ve mikrofon izinleri istendi');
      } catch (e) {
        if (__DEV__) console.warn('[Permissions] İzin isteme hatası:', e);
      }
    })();
  }, [isAuthReady, isLoggedIn]);

  // Profili Supabase'den yükle (Eskisi gibi yoksa hemen OLUŞTURMA! Onboarding ekranında oluşturulacak)
  const syncProfile = async (fbUser: User) => {
    try {
      const existingProfile = await ProfileService.get(fbUser.uid);
      if (existingProfile) {
        // Çevrimiçi durumu ayarlardan kontrol et
        const settings = await SettingsService.get();
        if (settings.show_online_status) {
          await ProfileService.setOnline(fbUser.uid, true);
        }
        setProfile(existingProfile);

        // ★ SP Tetikleyiciler: Günlük giriş + Prime-time
        try {
          await GamificationService.onDailyLogin(fbUser.uid);
          await GamificationService.onPrimeTimeReturn(fbUser.uid);
        } catch { /* SP kazandırma başarısız olursa sessiz geç */ }

        // ★ RevenueCat: SDK başlat + kullanıcı kimliğini bağla
        RevenueCatService.init(fbUser.uid).catch(() => {});
      } else {
        setProfile(null);
      }
    } catch (err) {
      if (__DEV__) console.warn('Profil kontrolü başarısız:', err);
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
    if (__DEV__) console.log('[RootLayout] Firebase auth listener başlatılıyor...');
    let authResolved = false;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      authResolved = true;
      if (__DEV__) console.log('[RootLayout] Firebase auth state:', fbUser ? 'LOGGED_IN' : 'LOGGED_OUT');
      if (fbUser) {
        setFirebaseUser(fbUser);
        setUser({
          name: fbUser.displayName || 'Kullanıcı',
          avatar: fbUser.photoURL || '',
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

    // ★ Güvenlik ağı: Firebase auth 8 saniyede yanıt vermezse login'e yönlendir
    const authTimeout = setTimeout(() => {
      if (!authResolved) {
        if (__DEV__) console.warn('[RootLayout] Firebase auth timeout (8s) — forcing auth ready');
        setIsAuthReady(true);
      }
    }, 8000);

    return () => {
      unsubscribe();
      clearTimeout(authTimeout);
    };
  }, []);

  // ═══ Presence Yönetimi: Uygulama arka plana gidince offline, dönerken online ═══
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (!firebaseUser) return;
      try {
        const settings = await SettingsService.get();
        if (!settings.show_online_status) return;
        if (nextState === 'active') {
          await ProfileService.setOnline(firebaseUser.uid, true);
          // ★ Prime-time SP: Ön plana her dönüşte kontrol et
          try { await GamificationService.onPrimeTimeReturn(firebaseUser.uid); } catch {}
        } else if (nextState === 'background' || nextState === 'inactive') {
          await ProfileService.setOnline(firebaseUser.uid, false);
        }
      } catch { /* silent */ }
    });
    return () => subscription.remove();
  }, [firebaseUser]);

  // Push bildirim: Tıklanınca doğru sayfaya yönlendir (deep link)
  // ★ NOT: Yerel bildirim tetikleme KALDIRILDI — Uygulama içindeyken popup çıkmamalı.
  // Remote push bildirimleri zaten MessageService.send() içinde PushService.sendToUser() ile gönderiliyor.
  // Uygulama ön plandayken sadece badge güncellenecek (RealtimeBadgeProvider ile).
  useEffect(() => {
    if (!firebaseUser) return;

    // ★ Push tıklanınca: incoming_call ise overlay göster, diğerleri route'a yönlendir
    const responseListener = PushNotificationService.addResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'incoming_call' && data?.callId) {
        // Gelen arama push'u tıklandı → IncomingCallOverlay'ı tetikle
        updateIncomingCall({
          action: 'incoming_call',
          callId: data.callId as string,
          callerId: data.callerId as string,
          callerName: data.callerName as string,
          callerAvatar: (data.callerAvatar as string) || undefined,
          callType: (data.callType as 'audio' | 'video') || 'audio',
          tier: (data.tier as any) || 'Free',
        });
      } else if (data?.route) {
        try { routerRef.current?.push(data.route as any); } catch (e) { /* ignore */ }
      }
    });

    // ★ Arka planda gelen push: incoming_call tipini foreground'da da yakala
    const receivedListener = PushNotificationService.addReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.type === 'incoming_call' && data?.callId) {
        // Uygulama açıkken gelen arama push'u → IncomingCallOverlay göster
        updateIncomingCall({
          action: 'incoming_call',
          callId: data.callId as string,
          callerId: data.callerId as string,
          callerName: data.callerName as string,
          callerAvatar: (data.callerAvatar as string) || undefined,
          callType: (data.callType as 'audio' | 'video') || 'audio',
          tier: (data.tier as any) || 'Free',
        });
      }
    });

    return () => {
      if (responseListener) responseListener.remove();
      if (receivedListener) receivedListener.remove();
    };
  }, [firebaseUser]);

  // ═══ P2: SP Bakiye Realtime — SP değiştiğinde profil anında güncellenir ═══
  useEffect(() => {
    if (!firebaseUser) return;
    const spSub = supabase
      .channel(`sp_sync:${firebaseUser.uid}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${firebaseUser.uid}`,
      }, (payload: any) => {
        const newSP = payload.new?.system_points;
        // Sadece SP değiştiyse profili tazele (gereksiz re-render önleme)
        if (newSP !== undefined) {
          if (__DEV__) console.log(`[SPSync] Bakiye güncellendi: ${newSP} SP`);
          refreshProfile();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(spSub);
    };
  }, [firebaseUser]);

  // Gelen arama dinleyicisi (global) — Tüm sinyalleri yakala + AppState reconnect
  const callChannelRef = useRef<{ unsubscribe: () => void; reconnect?: () => void } | null>(null);
  useEffect(() => {
    if (!firebaseUser) return;
    const callChannel = CallService.onCallSignal(firebaseUser.uid, (signal) => {
      if (signal.action === 'incoming_call') {
        // ★ MEŞGUL KONTROLÜ: Aktif arama varsa otomatik busy gönder
        if (activeCallIdRef.current) {
          if (__DEV__) console.log('[Layout] ★ MEŞGUL — aktif arama var, busy gönderiliyor:', signal.callerName);
          CallService.sendBusy(signal.callerId, firebaseUser.uid, signal.callId).catch(() => {});
          return;
        }
        // ★ SORUN-6 FIX: Ref kullan — closure'da stale değer önle
        if (incomingCallRef.current) {
          if (__DEV__) console.log('[Layout] ★ MEŞGUL — zaten gelen arama var, busy gönderiliyor:', signal.callerName);
          CallService.sendBusy(signal.callerId, firebaseUser.uid, signal.callId).catch(() => {});
          return;
        }
        if (__DEV__) console.log('[Layout] ★ GELEN ARAMA SİNYALİ:', signal.callerName, signal.callType);
        updateIncomingCall(signal);
      } else if (signal.action === 'call_ended') {
        updateIncomingCall(null);
      }
      // ★ call_accepted / call_rejected / call_busy sinyallerini cache'le
      if (signal.action === 'call_accepted' || signal.action === 'call_rejected' || signal.action === 'call_busy') {
        pendingCallSignalsRef.current.push(signal);
        setPendingCallSignals([...pendingCallSignalsRef.current]);
        // 30sn sonra otomatik temizle
        setTimeout(() => {
          pendingCallSignalsRef.current = pendingCallSignalsRef.current.filter(
            s => s.callId !== signal.callId || s.action !== signal.action
          );
          setPendingCallSignals([...pendingCallSignalsRef.current]);
        }, 30000);
      }
    });
    callChannelRef.current = callChannel;

    // AppState listener — arka plandan dönerken kanalı yeniden bağla
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && callChannelRef.current?.reconnect) {
        if (__DEV__) console.log('[Layout] App ön plana geldi — call signal kanalı yeniden bağlanıyor');
        callChannelRef.current.reconnect();
      }
    });

    return () => {
      callChannel.unsubscribe();
      callChannelRef.current = null;
      appStateSub.remove();
    };
  }, [firebaseUser]);

  // ★ ARCH-8 FIX: router2 kaldırıldı — tek router ref ile yönetiliyor
  const routerRef = useRef(useRouter());
  useEffect(() => {
    function handleDeepLink(url: string) {
      try {
        const parsed = Linking.parse(url);
        if (parsed.path?.startsWith('room/')) {
          routerRef.current.push(`/room/${parsed.path.replace('room/', '')}`);
        } else if (parsed.path?.startsWith('user/')) {
          routerRef.current.push(`/user/${parsed.path.replace('user/', '')}`);
        }
      } catch (e) { /* ignore */ }
    }

    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });

    return () => sub?.remove();
  }, []);

  // ★ Inter font yükleme (non-blocking — yüklenene kadar sistem fontu kullanılır)
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // ★ ARCH-4 FIX: SplashOverlay render bloğu kaldırıldı (ölü kod — showSplash her zaman false'tı)

  return (
    <AuthContext.Provider value={{ isAuthReady, isLoggedIn, setIsLoggedIn, user, setUser, firebaseUser, profile, setProfile, refreshProfile, minimizedRoom, setMinimizedRoom, pendingCallSignals, consumeCallSignal, activeCallId, setActiveCallId: updateActiveCallId, showNotifDrawer, setShowNotifDrawer }}>
      <ThemeContext.Provider value={{ themeVersion, applyTheme }}>
      <RealtimeBadgeProvider userId={firebaseUser?.uid || null}>
      <OnlineFriendsProvider userId={firebaseUser?.uid || null}>
      <View style={styles.container}>
        {/* Status bar her zaman light (koyu tema) */}
        <StatusBar style="light" />
        <ErrorBoundary fallbackTitle="Ekran Yüklenemedi">
        <AuthGuard>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.bg },
              animation: 'fade',
              animationDuration: 250,
            }}
          >
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="room/[id]" options={{ animation: 'fade_from_bottom', animationDuration: 300 }} />
            {/* broadcast/[id] kaldırıldı — Room'a "Yayın Modu" toggle eklendi */}
            <Stack.Screen name="chat/[id]" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="user/[id]" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="plus" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="edit-profile" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="notifications" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="admin" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="call/[id]" options={{ animation: 'fade_from_bottom', animationDuration: 200, gestureEnabled: false }} />
            <Stack.Screen name="create-room" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="settings" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />
            <Stack.Screen name="leaderboard" options={{ animation: 'fade_from_bottom', animationDuration: 250 }} />

          </Stack>
        </AuthGuard>
        </ErrorBoundary>
        {/* Küçültülmüş Oda Kartı — Tüm sayfalarda görünür */}
        {minimizedRoom && (
          <MiniRoomCard
            room={minimizedRoom}
            onExpand={() => {
              const roomId = minimizedRoom.id;
              setMinimizedRoom(null);
              routerRef.current.push(`/room/${roomId}`);
            }}
            onClose={() => {
              // ★ Temiz çıkış — LiveKit disconnect + odadan ayrıl
              const roomId = minimizedRoom.id;
              const uid = firebaseUser?.uid;
              setMinimizedRoom(null);
              if (uid) {
                RoomService.leave(roomId, uid).catch(() => {});
              }
              liveKitService.disconnect().catch(() => {});
            }}
          />
        )}
        <Toast />


        {/* ★ BUG-4 FIX: NotificationDrawer artık global — tüm sayfalarda tek instance */}
        <NotificationDrawer
          visible={showNotifDrawer}
          onClose={() => setShowNotifDrawer(false)}
          userId={firebaseUser?.uid}
        />

        {/* Gelen Arama Overlay — ★ CALL-6: Tam ekran WhatsApp tarzı */}
        <IncomingCallOverlay
          visible={!!incomingCall}
          callerName={incomingCall?.callerName || ''}
          callerAvatar={incomingCall?.callerAvatar}
          callType={incomingCall?.callType || 'audio'}
          onAccept={() => {
            if (!incomingCall || !firebaseUser) return;
            // ★ CALL-3: Ses artık IncomingCallOverlay içinde durdurulur (handleAccept)
            CallService.acceptCall(incomingCall.callerId, firebaseUser.uid, incomingCall.callId).catch(() => {});
            const callData = incomingCall;
            updateIncomingCall(null);
            routerRef.current.push(`/call/${callData.callerId}?callId=${callData.callId}&callType=${callData.callType}&isIncoming=true` as any);
          }}
          onReject={() => {
            if (!incomingCall || !firebaseUser) return;
            // ★ CALL-3: Ses artık IncomingCallOverlay içinde durdurulur (handleReject)
            CallService.rejectCall(incomingCall.callerId, firebaseUser.uid, incomingCall.callId).catch(() => {});
            updateIncomingCall(null);
          }}
        />
      </View>
    </OnlineFriendsProvider>
    </RealtimeBadgeProvider>
    </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
});
