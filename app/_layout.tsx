// LiveKit polyfill kaldırıldı — native modül yoksa Hermes'te 'Requiring unknown module' crash'ine sebep oluyordu
import { useEffect, useState, useRef, useCallback, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, StyleSheet, Dimensions, AppState, Platform, PermissionsAndroid, LogBox } from 'react-native';

// ★ Geliştirme sırasında beklenen yapılandırma hatalarını LogBox'tan gizle.
// IAP ürünleri RevenueCat Dashboard'a eklenene kadar normal davranış.
LogBox.ignoreLogs([
  /\[RevenueCat\].*fetching offerings/,
  /PurchasesError.*ConfigurationError/,
  /You have configured the SDK with a Play Store API for Play Store products/,
  /You have configured the SDK with a Play Store API key, but there are no Play Store products/,
  // ★ LiveKit race: katılımcı disconnect olurken track subscribe ediliyor.
  //   SDK internal log, zararsız — fonksiyonel hata yok.
  /Tried to add a track for a participant, that's not present/,
  /Tried to remove a track for a participant, that's not present/,
  // ★ 2026-04-21: LiveKit duplicate identity — kullanıcı hızlı arka arkaya odaya
  //   girip çıktığında server eski oturumu leave ediyor, client otomatik reconnect
  //   yapıyor. LogBox'a düşmesi gereksiz.
  /Received leave request while trying to \(re\)connect/,
  /ConnectionError.*LeaveRequest/,
]);
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
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
  /** ★ BUG-EV 2026-04-21: Firebase User objesi in-place mutate olduğunda (ör. reload() sonrası
   *  emailVerified=true olduğunda) React re-render tetiklenmez. authVersion'ı bump'layarak
   *  AuthGuard effect'ini zorla çalıştırıyoruz. login.tsx'te refreshAuth() çağrılır. */
  authVersion: number;
  refreshAuth: () => void;
  /** ★ 2026-04-22: Onboarding'i yeni tamamlayan kullanıcı için intro'yu garantili
   *  tetiklemek. finalizeOnboarding() true yapar, home.tsx'te intro gösterilir
   *  ve flag false'a çekilir. AsyncStorage'a bağımlı değil → re-install sorunsuz. */
  justCompletedOnboarding: boolean;
  setJustCompletedOnboarding: (v: boolean) => void;
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
  /** ★ 2026-04-20: Zil ikonunun sağdan offseti — her ekran farklı (home: 60, room: 80) */
  setNotifDrawerAnchorRight: (px: number) => void;
  /** ★ Drawer kutusunun sağdan offseti (default 8) */
  setNotifDrawerRight: (px: number) => void;
  /** ★ Drawer kutusunun üstten offseti (anchorTop) */
  setNotifDrawerTop: (px: number | undefined) => void;
};

export const AuthContext = createContext<AuthContextType>({
  isAuthReady: false,
  isLoggedIn: false,
  setIsLoggedIn: () => {},
  user: null,
  setUser: () => {},
  firebaseUser: null,
  authVersion: 0,
  refreshAuth: () => {},
  justCompletedOnboarding: false,
  setJustCompletedOnboarding: () => {},
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
  setNotifDrawerAnchorRight: () => {},
  setNotifDrawerRight: () => {},
  setNotifDrawerTop: () => {},
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
  // ★ 2026-04-21: Route context — oda içindeyken follow_pending zile yansısın, dışında arkadaş simgesinde.
  const pathname = usePathname();
  const inRoomRef = useRef(false);
  useEffect(() => { inRoomRef.current = pathname?.startsWith('/room') ?? false; }, [pathname]);

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
            .in('type', ['room_live', 'room_invite', 'room_invite_accepted', 'room_invite_rejected', 'room_access_request', 'missed_call', 'incoming_call', 'gift', 'thank_you', 'event_reminder', 'follow_accepted', 'follow_rejected']);
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

    // ★ Global refresh hook — NotificationDrawer bildirimi toplu okudunda
    //   çağrılır, realtime UPDATE event'ini beklemeden badge sıfırlanır.
    (global as any).__sopranoBadgeRefresh = () => { refreshBadges(); };

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
    // ★ Zil badge'ine dahil olan bildirim tipleri (oda + arama + hediye + teşekkür + arkadaşlık yanıtları)
    // ★ 2026-04-21: follow_pending context-aware — oda içindeyken bell badge'e eklenir, dışında arkadaş simgesi ile yetinir.
    const BELL_NOTIF_TYPES_BASE = ['room_live', 'room_invite', 'room_invite_accepted', 'room_invite_rejected', 'room_access_request', 'missed_call', 'incoming_call', 'gift', 'thank_you', 'event_reminder', 'follow_accepted', 'follow_rejected'];
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
        // ★ 2026-04-20: follow_request bell'e sayılmaz (Friends drawer'da zaten
        //   pendingFollows var) ama her ekranda toast göster ki oda içindeki
        //   kullanıcı da bilsin.
        if (notifType === 'follow_request') {
          showToast({ title: '👋 Arkadaşlık İsteği', message: n?.body || 'Yeni arkadaşlık isteği', type: 'info', id: `notif_${n?.id}` });
          return;
        }
        // ★ 2026-04-21: follow_pending — oda içindeyken bell badge; dışında sadece friend icon (pendingFollows)
        if (notifType === 'follow_pending') {
          if (inRoomRef.current) {
            setUnreadNotifs(prev => prev + 1);
            showToast({ title: '👋 Arkadaşlık İsteği', message: n?.body || 'Yeni arkadaşlık isteği', type: 'info', id: `notif_${n?.id}` });
          }
          return;
        }
        if (!notifType || !BELL_NOTIF_TYPES_BASE.includes(notifType)) return;
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
        } else if (notifType === 'thank_you') {
          showToast({ title: '💖 Teşekkür Aldın', message: body, type: 'success', id });
        } else if (notifType === 'missed_call') {
          showToast({ title: '📞 Cevapsız Arama', message: body, type: 'warning', id });
        } else if (notifType === 'event_reminder') {
          showToast({ title: '⏰ Etkinlik Hatırlatıcı', message: body, type: 'info', id });
        } else if (notifType === 'follow_accepted') {
          showToast({ title: '🎉 Arkadaşlık Kabul', message: body, type: 'success', id });
        } else if (notifType === 'room_access_request') {
          showToast({ title: '🚪 Odana Katılma İsteği', message: body, type: 'info', id });
        }
      })
      // ★ 2026-04-20 FIX: UPDATE listener — drawer bildirimi is_read=true yapınca
      //   badge sayısı otomatik düşsün. Daha önce INSERT'le artıyordu ama
      //   "okunmuş" bilgisi badge'e yansımıyordu → zil hep dolu görünüyordu.
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const oldN = payload.old as { is_read?: boolean; type?: string };
        const newN = payload.new as { is_read?: boolean; type?: string };
        if (!newN?.type || !BELL_NOTIF_TYPES_BASE.includes(newN.type)) return;
        // unread → read geçişi: decrement
        if (oldN?.is_read === false && newN?.is_read === true) {
          setUnreadNotifs(prev => Math.max(0, prev - 1));
        } else if (oldN?.is_read === true && newN?.is_read === false) {
          setUnreadNotifs(prev => prev + 1);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
      }, (payload) => {
        const del = payload.old as { user_id?: string; is_read?: boolean; type?: string };
        if (del?.user_id !== userId) return;
        if (!del?.type || !BELL_NOTIF_TYPES_BASE.includes(del.type)) return;
        if (del?.is_read === false) {
          setUnreadNotifs(prev => Math.max(0, prev - 1));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dmSub);
      FriendshipService.unsubscribe(friendSub);
      supabase.removeChannel(notifSub);
      (global as any).__sopranoBadgeRefresh = undefined;
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
  const { isAuthReady, isLoggedIn, profile, firebaseUser, authVersion } = useAuth();
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
      // ★ 2026-04-21 FIX: Eski kontrol sadece display_name + id bakıyordu —
      //   Step 1'de display_name kaydedilince AuthGuard profili "tam" sayıp
      //   kullanıcıyı hemen home'a atıyordu → Step 2 (cinsiyet/yaş), Step 3
      //   (ilgi alanları), Step 4 (davet kodu) hiç gösterilmiyordu.
      //   Şimdi: preferences.onboarding_completed flag'i de kontrol ediliyor.
      //   Bu flag yalnızca finalizeOnboarding() içinde (Step 4 tamamlanınca
      //   veya "Atla"ya basılınca) true yapılır.
      const profilePrefs = (profile as any)?.preferences;
      // ★ 2026-04-21 FIX v3: SADECE preferences.onboarding_completed flag'i kontrol edilir.
      //   Eski "birth_date veya interests varsa" fallback'i kaldırıldı — bu Step 2'de
      //   birth_date set edilir edilmez AuthGuard "onboarding done" zannedip kullanıcıyı
      //   home'a yolluyordu, Step 3/4 hiç gösterilmiyordu. Launch öncesi test döneminde
      //   olduğumuz için legacy user endişesi yok; flag Step 4 (veya "Atla") ile yazılır.
      const onboardingDone = profilePrefs?.onboarding_completed === true;
      const hasCompleteProfile = profile && profile.display_name && profile.id && onboardingDone;

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
        // ★ FIX: Tam profili olan + onboarding'i bitirmiş mevcut kullanıcı — ana sayfaya yönlendir
        if (inAuthGroup) {
          router.replace('/(tabs)/home');
        }
      } else if (profile.display_name && profile.id && !onboardingDone) {
        // ★ 2026-04-21 FIX: Profil var ama onboarding tamamlanmamış — onboarding'e yönlendir.
        //   Bu durum: Step 1 tamamlanmış (display_name var) ama Step 2-4 atlanmış.
        //   Mevcut kullanıcı tekrar giriş yapınca bu branch'e düşer.
        if (!isOnboarding) {
          router.replace('/(auth)/onboarding');
        }
      } else {
        // display_name eksik — ilk kayıt, onboarding'e git
        if (!isOnboarding) {
          router.replace('/(auth)/onboarding');
        }
      }
    }
  }, [isAuthReady, isLoggedIn, profile, firebaseUser?.emailVerified, segments, authVersion]);

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
  // ★ BUG-EV 2026-04-21: AuthGuard'ı zorla re-trigger etmek için counter
  const [authVersion, setAuthVersion] = useState(0);
  const refreshAuth = useCallback(() => setAuthVersion(v => v + 1), []);
  // ★ 2026-04-22: Onboarding freshly completed flag — intro'yu garantili göster
  const [justCompletedOnboarding, setJustCompletedOnboarding] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [minimizedRoom, setMinimizedRoom] = useState<MinimizedRoom | null>(null);
  // ★ 2026-04-21: Ref — call signal handler closure'da stale değer kullanmasın
  const minimizedRoomRef = useRef<MinimizedRoom | null>(null);
  useEffect(() => { minimizedRoomRef.current = minimizedRoom; }, [minimizedRoom]);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  // ★ 2026-04-20: Zil ikon offseti (sağdan px). Her ekran farklı; default 60 (home pattern).
  const [notifDrawerAnchorRight, setNotifDrawerAnchorRight] = useState(60);
  const [notifDrawerRight, setNotifDrawerRight] = useState<number>(8);
  const [notifDrawerTop, setNotifDrawerTop] = useState<number | undefined>(undefined);
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

  // ★ 2026-04-19: Boost auto-expire cleanup — app startup'ta günde 1 kez
  // v28'de tanımlı cleanup_expired_boosts() RPC'yi çağır. Expired profile/room
  // boost'larını DB'den temizler. AsyncStorage throttle ile aynı gün içinde
  // tekrar çağrılmaz.
  useEffect(() => {
    if (!isAuthReady || !isLoggedIn) return;
    (async () => {
      try {
        const lastRunRaw = await AsyncStorage.getItem('soprano_boost_cleanup_last');
        const lastRun = lastRunRaw ? parseInt(lastRunRaw, 10) : 0;
        const DAY_MS = 24 * 60 * 60 * 1000;
        if (Date.now() - lastRun < DAY_MS) return;
        const { data, error } = await supabase.rpc('cleanup_expired_boosts');
        if (error) {
          if (__DEV__) console.warn('[BoostCleanup] RPC hatası:', error.message);
          return;
        }
        await AsyncStorage.setItem('soprano_boost_cleanup_last', String(Date.now()));
        if (__DEV__) console.log('[BoostCleanup] ok', data);
      } catch (e) {
        if (__DEV__) console.warn('[BoostCleanup] exception:', e);
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
          // ★ 2026-04-20: Oda içindeyken büyük gold SPReceivedModal'ı bastır —
          //   oda içi DonationAlert zaten tüm katılımcılara aynı animasyonu
          //   gösteriyor. Dışarıdayken (chat/home/profile vs) modal açılır.
          if ((global as any).__sopranoInRoom) {
            if (__DEV__) console.log('[GiftRT] Suppressed — user in room, DonationAlert handles it');
            return;
          }
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
        // ★ 2026-04-21: Oda içinde aktif yayındayken (LiveKit bağlı) arama gelirse busy gönder.
        //   WhatsApp benzeri davranış: kullanıcı canlı yayını kaçırmaz.
        try {
          const { liveKitService } = require('../services/livekit');
          if (liveKitService?.currentRoom) {
            if (__DEV__) console.log('[Layout] ★ MEŞGUL — kullanıcı odada yayında, busy gönderiliyor:', signal.callerName);
            CallService.sendBusy(signal.callerId, firebaseUser.uid, signal.callId).catch(() => {});
            return;
          }
        } catch {}
        // ★ Minimize edilmiş odada da busy
        if (minimizedRoomRef.current) {
          if (__DEV__) console.log('[Layout] ★ MEŞGUL — minimize odada, busy gönderiliyor:', signal.callerName);
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
    <AuthContext.Provider value={{ isAuthReady, isLoggedIn, setIsLoggedIn, user, setUser, firebaseUser, authVersion, refreshAuth, justCompletedOnboarding, setJustCompletedOnboarding, profile, setProfile, refreshProfile, minimizedRoom, setMinimizedRoom, pendingCallSignals, consumeCallSignal, activeCallId, setActiveCallId: updateActiveCallId, showNotifDrawer, setShowNotifDrawer, setNotifDrawerAnchorRight, setNotifDrawerRight, setNotifDrawerTop }}>
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
              // ★ 2026-04-20: setMinimizedRoom(null) burada YAPILMAZ — room/[id]
              // mount edildiğinde isRestoringFromMinimize kontrolü gerek; state'i
              // room/[id] kendisi temizliyor (useEffect ile, mount sonrası).
              const roomId = minimizedRoom.id;
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
          anchorRight={notifDrawerAnchorRight}
          drawerRight={notifDrawerRight}
          anchorTop={notifDrawerTop}
          onShowGiftModal={(p) => setIncomingGift({ amount: p.amount, senderId: p.senderId, senderName: p.senderName, senderAvatar: p.senderAvatar })}
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
