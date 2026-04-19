// LiveKit polyfill kaldırıldı — native modül yoksa Hermes'te 'Requiring unknown module' crash'ine sebep oluyordu
import { useEffect, useState, useRef, useCallback, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, StyleSheet, Dimensions, AppState, Platform, PermissionsAndroid, LogBox } from 'react-native';

// ★ Geliştirme sırasında beklenen yapılandırma hatalarını LogBox'tan gizle.
// IAP ürünleri RevenueCat Dashboard'a eklenene kadar normal davranış.
LogBox.ignoreLogs([
  /\[RevenueCat\].*fetching offerings/,
  /PurchasesError.*ConfigurationError/,
  /You have configured the SDK with a Play Store API key, but there are no Play Store products/,
]);
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
import { supabase, setSupabaseAuthToken } from '../constants/supabase';
import { PushNotificationService } from '../services/pushNotifications';
import { SettingsService } from '../services/settings';
import { CallService, type CallSignal } from '../services/call';
import { RevenueCatService } from '../services/revenuecat';
import { i18n } from '../services/i18n';
import { Toast, showToast } from '../components/Toast';
import { IncomingCallOverlay } from '../components/IncomingCallOverlay';
import MiniRoomCard, { type MinimizedRoom } from '../components/MiniRoomCard';
import ErrorBoundary from '../components/ErrorBoundary';
// SplashOverlay import kaldırıldı — ARCH-4 FIX (ölü kod temizliği)
// PremiumIntro kaldırıldı — intro video ile değiştirildi
// IntroVideo kaldırıldı — kullanıcı talebi ile splash intro devre dışı
import NotificationDrawer from '../components/NotificationDrawer';
import SPReceivedModal from '../components/profile/SPReceivedModal';

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
            .in('type', ['room_live', 'room_invite', 'room_invite_accepted', 'room_invite_rejected', 'missed_call', 'incoming_call', 'gift', 'event_reminder']);
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

    // 3. Notifications realtime — yeni bildirim gelince sayıyı artır + anlık toast
    // ★ Zil badge'ine dahil olan bildirim tipleri (oda + arama + hediye)
    const BELL_NOTIF_TYPES = ['room_live', 'room_invite', 'room_invite_accepted', 'room_invite_rejected', 'missed_call', 'incoming_call', 'gift', 'event_reminder'];
    const notifSub = supabase
      .channel(`badge_notif:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const n = payload.new as { type?: string; body?: string; id?: string };
        const notifType = n?.type;
        if (!notifType || !BELL_NOTIF_TYPES.includes(notifType)) return;
        setUnreadNotifs(prev => prev + 1);

        // ★ 2026-04-19: Anlık toast — kullanıcı hangi ekranda olursa olsun bildirim görsün.
        // Örn. başka bir odadayken arkadaşı davet ederse, zil'i açmadan haberdar olur.
        // Aynı bildirim id'si için tekrar göstermeme: id pass edilerek Toast cache'i kullanılır.
        const body = n?.body || '';
        const id = `notif_${n?.id}`;
        if (notifType === 'room_invite') {
          showToast({ title: '📨 Oda Daveti', message: body, type: 'info', id });
        } else if (notifType === 'room_invite_accepted') {
          showToast({ title: '🎉 Davet Kabul Edildi', message: body, type: 'success', id });
        } else if (notifType === 'room_invite_rejected') {
          showToast({ title: 'Davet Reddedildi', message: body, type: 'warning', id });
        } else if (notifType === 'room_live') {
          showToast({ title: '🔴 Canlı Yayın', message: body, type: 'info', id });
        } else if (notifType === 'gift') {
          showToast({ title: '🎁 Hediye Aldın', message: body, type: 'success', id });
        } else if (notifType === 'missed_call') {
          showToast({ title: '📞 Cevapsız Arama', message: body, type: 'warning', id });
        } else if (notifType === 'event_reminder') {
          showToast({ title: '⏰ Etkinlik Hatırlatıcı', message: body, type: 'info', id });
        }
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
  const { isAuthReady, isLoggedIn, profile, firebaseUser } = useAuth();
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
      // ★ SEC-EV: E-posta doğrulama kontrolü — Google Sign-In kullanıcıları otomatik doğrulanmış sayılır
      const isEmailProvider = firebaseUser?.providerData?.some(p => p.providerId === 'password');
      const needsVerification = isEmailProvider && firebaseUser && !firebaseUser.emailVerified;

      if (needsVerification) {
        // Doğrulanmamış e-posta kullanıcısı — login'de kal veya login'e yönlendir
        if (!inAuthGroup) {
          router.replace('/(auth)/login');
        }
        return;
      }

      // Giriş yapmış, ama profil tam mı?
      // ★ FIX: display_name + id kontrolü yeterli — preferences kolonu DB'de yok,
      // interests çoğu kullanıcıda null. display_name doluysa kullanıcı kayıtlı demektir.
      const hasCompleteProfile = profile && profile.display_name && profile.id;

      if (!profile) {
        // ★ 2026-04-18 FIX: Profil null — giriş yapılmış ama profile henüz yüklenmemiş
        // olabilir (retry inflight). Hemen onboarding'e atmak yerine 2 saniye bekle;
        // bu sürede profile gelirse effect yeniden çalışır ve bu branch'e düşmez.
        // Gelmediyse gerçekten yeni kullanıcı — onboarding'e yolla.
        if (!isOnboarding) {
          const timer = setTimeout(() => {
            // Timer tetiklendiğinde profile hâlâ yoksa ve auth halen geçerliyse yolla
            router.replace('/(auth)/onboarding');
          }, 2000);
          return () => clearTimeout(timer);
        }
      } else if (hasCompleteProfile) {
        // ★ FIX: Tam profili olan mevcut kullanıcı — auth group'taysa ana sayfaya yönlendir
        if (inAuthGroup) {
          router.replace('/(tabs)/home');
        }
      } else {
        // display_name veya onboarding_completed eksik — onboarding'e git
        if (!isOnboarding) {
          router.replace('/(auth)/onboarding');
        }
      }
    }
  }, [isAuthReady, isLoggedIn, profile, firebaseUser?.emailVerified, segments]);

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
  // Splash kaldırıldı — doğrudan login/home'a geçiş

  // ★ Font yükleme durumunu takip et
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [appIsReady, setAppIsReady] = useState(false);
  // ★ Intro video kaldırıldı — doğrudan uygulama açılır

  // Uygulama hazırlık süreci
  useEffect(() => {
    async function prepare() {
      console.log('[RootLayout] Hazırlık süreci başlatıldı...');
      try {
        // ★ Intro kaldırıldı — doğrudan yükleme

        // Ayarları ve i18n'i yükle
        console.log('[RootLayout] Ayarlar yükleniyor...');
        const s = await SettingsService.get();
        console.log('[RootLayout] Ayarlar yüklendi, tema ayarlanıyor:', s.theme);
        setActiveTheme(s.theme as ThemeKey);

        console.log('[RootLayout] i18n başlatılıyor...');
        await i18n.init();
        console.log('[RootLayout] i18n hazır.');

        setThemeVersion(v => v + 1);
      } catch (e) {
        console.error('[RootLayout] Hazırlık hatası:', e);
      } finally {
        console.log('[RootLayout] Hazırlık tamamlandı (appIsReady = true)');
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  // ★ CRITICAL: Her şey hazır olduğunda splash screen'i gizle
  // Intro video ayrı overlay olarak üstde görünür — splash ile bağımsız
  useEffect(() => {
    console.log('[RootLayout] State kontrolü:', { appIsReady, fontsLoaded, fontError: !!fontError });
    if (appIsReady && (fontsLoaded || fontError)) {
      console.log('[RootLayout] Splash gizleniyor...');
      const timer = setTimeout(async () => {
        try {
          await SplashScreen.hideAsync();
          console.log('[RootLayout] Splash gizlendi.');
        } catch (e) {
          console.warn('[RootLayout] Splash gizleme hatası (muhtemelen zaten gizli):', e);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [appIsReady, fontsLoaded, fontError]);

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ name: string; avatar: string } | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [minimizedRoom, setMinimizedRoom] = useState<MinimizedRoom | null>(null);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  // ★ Gelen SP bağışı için global popup state
  const [incomingGift, setIncomingGift] = useState<{
    amount: number; senderId: string; senderName: string; senderAvatar?: string;
  } | null>(null);
  const router = useRouter(); // routerRef yerine doğrudan kullan

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

  // ★ 2026-04-18 FIX: Minimize bar stale — oda host tarafından kapatıldığında
  // (is_live=false) veya silindiğinde minimizedRoom otomatik temizlensin.
  // Aksi halde kullanıcı bar'a tıklayıp ölü odaya girmeye çalışır → hata.
  useEffect(() => {
    if (!minimizedRoom?.id) return;
    const ch = supabase
      .channel(`minimized_room:${minimizedRoom.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${minimizedRoom.id}` },
        (payload: any) => {
          // DELETE → row silindi, minimized bar'ı kaldır
          if (payload.eventType === 'DELETE') {
            setMinimizedRoom(null);
            return;
          }
          // UPDATE → is_live false olduysa (oda kapatıldı / donduruldu)
          if (payload.new && payload.new.is_live === false) {
            setMinimizedRoom(null);
          }
        }
      )
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [minimizedRoom?.id]);

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



  // ★ Tüm izinleri uygulama başlangıcında BİR KEZ iste (kamera, mikrofon, bildirim)
  // AsyncStorage flag ile korunur — bir kez onaylandıktan sonra bir daha sorulmaz
  useEffect(() => {
    if (!isAuthReady || !isLoggedIn) return;
    (async () => {
      try {
        const alreadyAsked = await AsyncStorage.getItem('soprano_permissions_asked');
        if (alreadyAsked === 'true') return;

        if (Platform.OS === 'android') {
          // ★ Android: Tüm izinleri tek seferde iste (POST_NOTIFICATIONS Android 13+ gerekli)
          const permsToRequest: string[] = [
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ];
          // Android 13+ (API 33) için bildirim izni
          if (Number(Platform.Version) >= 33) {
            permsToRequest.push('android.permission.POST_NOTIFICATIONS');
          }
          await PermissionsAndroid.requestMultiple(permsToRequest as any);
        } else {
          // iOS: Hem mikrofon hem kamera izni iste
          await Audio.requestPermissionsAsync();
          // Kamera izni — expo-image-picker üzerinden
          try {
            const ImagePicker = require('expo-image-picker');
            await ImagePicker.requestCameraPermissionsAsync();
          } catch { /* expo-image-picker yoksa atla */ }
        }

        // ★ Bildirim izni — platform bağımsız (expo-notifications üzerinden)
        try {
          await PushNotificationService.registerForPushNotifications();
        } catch { /* bildirim izni başarısız olursa sessiz geç */ }

        await AsyncStorage.setItem('soprano_permissions_asked', 'true');
        if (__DEV__) console.log('[Permissions] Tüm izinler (kamera, mikrofon, bildirim) istendi');
      } catch (e) {
        if (__DEV__) console.warn('[Permissions] İzin isteme hatası:', e);
      }
    })();
  }, [isAuthReady, isLoggedIn]);

  // Profili Supabase'den yükle (Eskisi gibi yoksa hemen OLUŞTURMA! Onboarding ekranında oluşturulacak)
  // ★ 2026-04-18 FIX: Retry mekanizması — reload/token refresh sırasında network
  // kesintisinde ProfileService.get throw ediyor; 3 deneme ile 400ms aralıklarla retry.
  const syncProfile = async (fbUser: User) => {
    let existingProfile: Profile | null = null;
    let fetchErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        existingProfile = await ProfileService.get(fbUser.uid);
        fetchErr = null;
        break; // başarılı (null veya değerli)
      } catch (err) {
        fetchErr = err;
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }

    try {
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
      } else if (fetchErr) {
        // 3 denemede de başarısız — network sorunu muhtemelen. Mevcut profili koru.
        // AuthGuard için profile null ise onboarding'e gitmesin.
        if (__DEV__) console.warn('[syncProfile] 3 denemede profile yüklenemedi, mevcut state korunuyor:', fetchErr);
      } else {
        // Gerçekten yok — yeni kullanıcı, onboarding akışına gidecek
        setProfile(null);
      }
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

    // ★ 2026-04-18 FIX: Oturum geçişinde oda/LiveKit temizliği
    // Logout veya hesap değişiminde eski session'ın LiveKit bağlantısı kapatılmalı,
    // minimized room state sıfırlanmalı. Aksi halde yeni kullanıcı login olduğunda
    // "Received leave request while trying to (re)connect" hatası alınıyordu —
    // eski participant hâlâ odada aktif görünüyor ve yeni sessionla çakışıyordu.
    const prevUidRef = { current: null as string | null };

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      authResolved = true;
      if (__DEV__) console.log('[RootLayout] Firebase auth state:', fbUser ? 'LOGGED_IN' : 'LOGGED_OUT');

      // Hesap değişti mi? (logout → login veya user A → user B)
      const newUid = fbUser?.uid || null;
      const uidChanged = prevUidRef.current !== newUid;
      if (uidChanged && prevUidRef.current !== null) {
        // Eski oturum LiveKit bağlantısını kapat ve minimized room'u sıfırla
        try { await liveKitService.disconnect(); } catch {}
        setMinimizedRoom(null);
      }
      prevUidRef.current = newUid;

      if (fbUser) {
        setFirebaseUser(fbUser);
        setUser({
          name: fbUser.displayName || 'Kullanıcı',
          avatar: fbUser.photoURL || '',
        });
        setIsLoggedIn(true);

        // ★ Firebase JWT → Supabase: Token'ı al ve Supabase'e enjekte et
        try {
          const idToken = await fbUser.getIdToken(false);
          setSupabaseAuthToken(idToken);
          if (__DEV__) console.log('[RootLayout] Firebase token Supabase\'e enjekte edildi');
        } catch (e) {
          if (__DEV__) console.warn('[RootLayout] Firebase token alınamadı:', e);
        }

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
        // ★ Logout: Supabase token'ı temizle + minimized room sıfırla + LiveKit kapat
        setSupabaseAuthToken(null);
        setMinimizedRoom(null);
        try { await liveKitService.disconnect(); } catch {}
      }
    });

    // ★ Güvenlik ağı: Firebase auth 8 saniyede yanıt vermezse hazır say
    // ★ BUG FIX: unsubscribe() kaldırıldı — timeout sonrası auth gelirse yine işlensin
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

  // ★ BUG FIX: Firebase JWT Token Sessiz Yenileme — 50dk interval
  // Firebase token'ları 1 saat sonra expire olur. Mevcut auth akışına dokunmadan
  // sadece Supabase REST header'ını güncelleriz. Crash-safe: hiç state değiştirmez.
  // ★ Y1: Ardışık refresh başarısızlıklarında kullanıcıyı zorla çıkış yap (401 döngüsü engeli).
  const tokenRefreshFailuresRef = useRef(0);
  useEffect(() => {
    const TOKEN_REFRESH_MS = 50 * 60 * 1000; // 50 dakika
    const MAX_CONSECUTIVE_FAILURES = 3;
    const refreshInterval = setInterval(async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          tokenRefreshFailuresRef.current = 0;
          return;
        }
        const freshToken = await currentUser.getIdToken(true);
        setSupabaseAuthToken(freshToken);
        tokenRefreshFailuresRef.current = 0;
        if (__DEV__) console.log('[TokenRefresh] Supabase token yenilendi');
      } catch (e: any) {
        tokenRefreshFailuresRef.current++;
        if (__DEV__) console.warn(`[TokenRefresh] Hata (${tokenRefreshFailuresRef.current}/${MAX_CONSECUTIVE_FAILURES}):`, e?.message);
        // Firebase Auth token revoke / user deleted / ardışık network hatası → zorla logout
        const isAuthError = /token|auth|unauthorized|credential/i.test(String(e?.message || '') + String(e?.code || ''));
        if (isAuthError || tokenRefreshFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
          try { await auth.signOut(); } catch {}
          setSupabaseAuthToken(null);
          tokenRefreshFailuresRef.current = 0;
        }
      }
    }, TOKEN_REFRESH_MS);
    return () => clearInterval(refreshInterval);
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
          callType: 'audio' as const,
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
          callType: 'audio' as const,
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
      }, (payload) => {
        const newSP = (payload.new as { system_points?: number })?.system_points;
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

  // ═══ SP Bağış Alındı — realtime popup tetikleyici ═══
  useEffect(() => {
    if (!firebaseUser) return;
    const giftSub = supabase
      .channel(`gift_recv:${firebaseUser.uid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${firebaseUser.uid}`,
      }, async (payload) => {
        const notif = payload.new as any;
        if (__DEV__) console.log('[GiftRT] notif received:', notif?.type, notif?.body);
        if (notif?.type !== 'gift') return;
        // Miktarı body'den parse et ("XX SP gönderdi" pattern'i)
        const amountMatch = /(\d+)\s*SP/.exec(notif.body || '');
        const amount = amountMatch ? parseInt(amountMatch[1], 10) : 0;
        if (amount <= 0 || !notif.sender_id) {
          if (__DEV__) console.warn('[GiftRT] Amount parse failed or no sender:', notif.body);
          return;
        }
        // Sender profile bilgisini çek
        try {
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', notif.sender_id)
            .single();
          setIncomingGift({
            amount,
            senderId: notif.sender_id,
            senderName: senderProfile?.display_name || 'Birisi',
            senderAvatar: senderProfile?.avatar_url,
          });
        } catch (e) {
          if (__DEV__) console.warn('[GiftRT] Sender profile fetch failed:', e);
        }
      })
      .subscribe((status) => {
        if (__DEV__) console.log(`[GiftRT] channel status: ${status} for user ${firebaseUser.uid}`);
      });
    return () => { supabase.removeChannel(giftSub); };
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

  // ★ ARCH-8 FIX: routerRef her render'da güncellenir — stale router önlenir
  const router2 = useRouter();
  const routerRef = useRef(router2);
  routerRef.current = router2;
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

  // ★ Hazırlık bitene kadar minimal loading göster
  if (!appIsReady || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          borderWidth: 3, borderColor: 'rgba(20,184,166,0.15)',
          borderTopColor: '#14B8A6',
        }} />
      </View>
    );
  }

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

        {/* ★ SP Bağış Alındı global popup — realtime tetiklenir */}
        {incomingGift && firebaseUser && (
          <SPReceivedModal
            visible={!!incomingGift}
            amount={incomingGift.amount}
            senderId={incomingGift.senderId}
            senderName={incomingGift.senderName}
            senderAvatar={incomingGift.senderAvatar}
            recipientId={firebaseUser.uid}
            onClose={() => setIncomingGift(null)}
          />
        )}

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

        {/* ★ Intro Video kaldırıldı */}
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
