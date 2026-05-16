// LiveKit polyfill kaldırıldı — native modül yoksa Hermes'te 'Requiring unknown module' crash'ine sebep oluyordu
import { useEffect, useState, useRef, useCallback, useMemo, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, Pressable, StyleSheet, Dimensions, AppState, Platform, PermissionsAndroid, LogBox } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ★ 2026-04-25: Crashlytics — Firebase ile entegre crash izleme.
//   @react-native-firebase/crashlytics native module; sadece dev-client/release build'de çalışır.
//   Lazy load — Hermes'te modül yoksa crash etmesin.
let crashlytics: any = null;
try {
  crashlytics = require('@react-native-firebase/crashlytics').default;
} catch { /* native module yoksa sessiz */ }

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
  // ★ v107.34: Firebase v22 modular SDK migration deprecation uyarıları —
  //   uygulama namespaced API kullanıyor (analytics, getApp, setUserId vs.).
  //   v22'ye geçiş post-launch işi (memory'de kayıtlı). Şimdilik gizle, console kirletmesin.
  /This method is deprecated.*React Native Firebase namespaced API/,
  /Please use `getApp\(\)` instead/,
  /Please use `setUserId\(\)` instead/,
]);

// ★ v107.35: LogBox sadece RN yellow-box'ı etkiler; DevTools console ayrı.
//   console.warn / console.error override ile pattern-eşleşen mesajları sustur.
//   Hedef: Firebase v22 deprecation + RevenueCat ConfigurationError (her ikisi de
//   bilinen, kritik olmayan, post-launch düzeltilecek mesajlar).
const __SUPPRESS_PATTERNS = [
  /React Native Firebase namespaced API/,
  /Please use `getApp\(\)` instead/,
  /Please use `setUserId\(\)` instead/,
  /\[RevenueCat\].*Error fetching offerings/,
  /PurchasesError\(code=ConfigurationError/,
  // ★ v107.36: WebRTC debug log spam — LiveKit iç peer connection trace'leri
  /rn-webrtc:pc:DEBUG/,
  /addIceCandidate/,
  /addTransceiver/,
  /createOffer\b/,
  /setLocalDescription/,
  /setRemoteDescription/,
  // ★ v107.43: LiveKit ping timeout — bağlantı kalitesi info, kritik değil
  /ping timeout triggered/,
  /last pong received/,
  // ★ v107.44: Metro reload artifact — Firebase native module bir an erişilemez,
  //   Metro yeni bundle'ı gönderirken oluşur, prod APK'da çıkmaz. APK içinde modül var.
  /Native module RNFBAppModule not found/,
  /RNFBNativeEventEmitter/,
  // ★ 2026-05-09: Reanimated 3.16+ strict mode — shared value render sırasında okuma uyarısı.
  //   Genelde library iç animasyonlarından, app davranışını etkilemiyor.
  /\[Reanimated\] Reading from `value`/,
];
const __origWarn = console.warn;
const __origError = console.error;
const __origLog = console.log;
console.warn = (...args: any[]) => {
  const msg = args.map(a => (typeof a === 'string' ? a : '')).join(' ');
  if (__SUPPRESS_PATTERNS.some(p => p.test(msg))) return;
  __origWarn(...args);
};
console.error = (...args: any[]) => {
  const msg = args.map(a => (typeof a === 'string' ? a : '')).join(' ');
  if (__SUPPRESS_PATTERNS.some(p => p.test(msg))) return;
  __origError(...args);
};
// ★ v107.36: console.log de intercept — WebRTC debug spam'i için. Normal log'lar etkilenmez.
console.log = (...args: any[]) => {
  const msg = args.map(a => (typeof a === 'string' ? a : '')).join(' ');
  if (__SUPPRESS_PATTERNS.some(p => p.test(msg))) return;
  __origLog(...args);
};
import { Stack, useRouter, useSegments } from 'expo-router';
// ★ v92.16: react-native-keyboard-controller kaldırıldı — native modül linked değildi,
//   dev/build'de "doesn't seem to be linked" crash'e neden oluyordu.
//   RN built-in KeyboardAvoidingView + Keyboard API yeterli.
// ★ 2026-04-30: SafeAreaProvider eksikliği nedeniyle useSafeAreaInsets() tüm
//   ekranlarda 0 dönüyordu → Samsung 3-button nav bar'da bottom CTA'lar eziliyordu.
//   Bu wrapper TÜM uygulamayı sarmalı; aksi halde 53+ ekran broken.
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { Audio } from 'expo-av';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../constants/firebase';
import { setActiveTheme, type ThemeKey } from '../constants/themeEngine';
import { Colors } from '../constants/theme';
import { ProfileService, MessageService, type Profile } from '../services/database';
import { ThemeProvider as DynamicThemeProvider } from '../services/themeContext';
import { FriendshipService } from '../services/friendship';
import { GamificationService } from '../services/gamification';
import { supabase, setSupabaseAuthToken, clearTokenCache, refreshTokenCache } from '../constants/supabase';
import { PushNotificationService } from '../services/pushNotifications';
import { SettingsService } from '../services/settings';
import { CallService, type CallSignal } from '../services/call';
import { RevenueCatService } from '../services/revenuecat';
import { i18n } from '../services/i18n';
import { Toast, showToast } from '../components/Toast';
import AppLoader from '../components/AppLoader';
import SplashSpinner from '../components/SplashSpinner';
import { IncomingCallOverlay } from '../components/IncomingCallOverlay';
import MiniRoomCard, { type MinimizedRoom } from '../components/MiniRoomCard';
import SessionConflictGuard from '../components/SessionConflictGuard';
import ErrorBoundary from '../components/ErrorBoundary';
// ★ react-native-keyboard-controller kaldırıldı — native modül linked değildi, app crash'e neden oluyordu.
// SplashOverlay import kaldırıldı — ARCH-4 FIX (ölü kod temizliği)
// PremiumIntro kaldırıldı — intro video ile değiştirildi
// IntroVideo kaldırıldı — kullanıcı talebi ile splash intro devre dışı
import NotificationDrawer from '../components/NotificationDrawer';
import SPReceivedModal from '../components/profile/SPReceivedModal';
import ThankYouReceivedModal from '../components/profile/ThankYouReceivedModal';
import IncomingFriendRequestCard from '../components/IncomingFriendRequestCard';
import BadgeCelebration from '../components/profile/BadgeCelebration';
import InRoomUserProfile from '../components/room/InRoomUserProfile';
import { UserSearchModal } from '../components/UserSearchModal';
import AppBackground from '../components/AppBackground';
import { OnlineFriendsProvider } from '../providers/OnlineFriendsProvider';
export { useOnlineFriends } from '../providers/OnlineFriendsProvider';
import { DMNotifProvider } from '../providers/DMNotifProvider';
export { useDMNotif, useDMNotifOptional } from '../providers/DMNotifProvider';
// ★ F-1 (16 May 2026): Sistem ayarları (bakım modu/zorunlu güncelleme/banner)
import { startSystemSettingsSync, stopSystemSettingsSync } from '../services/systemSettings';
import SystemSettingsOverlay from '../components/SystemSettingsOverlay';
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
    const _ErrorUtils = (global as any).ErrorUtils;
    if (_ErrorUtils && typeof _ErrorUtils.getGlobalHandler === 'function') {
      const defaultHandler = _ErrorUtils.getGlobalHandler();
      _ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        // ★ 2026-04-25: Crashlytics'e gönder + AsyncStorage fallback (debug için)
        try {
          if (crashlytics) {
            crashlytics().recordError(error, error?.message || 'Unknown error');
            if (isFatal) crashlytics().log('FATAL crash detected');
          }
        } catch { /* crashlytics yoksa sessiz */ }
        try {
          const crashEntry = JSON.stringify({
            timestamp: new Date().toISOString(),
            message: error?.message || 'Unknown error',
            stack: error?.stack?.substring(0, 500),
            isFatal,
          });
          AsyncStorage.getItem('soprano_crash_logs').then(raw => {
            const logs: string[] = raw ? JSON.parse(raw) : [];
            logs.unshift(crashEntry);
            if (logs.length > 20) logs.length = 20;
            AsyncStorage.setItem('soprano_crash_logs', JSON.stringify(logs)).catch(() => {});
          }).catch(() => {});
        } catch { /* sessiz */ }
        if (defaultHandler) defaultHandler(error, isFatal);
      });
    }
  } catch { /* ErrorUtils erişilemezse sessiz */ }

  // ★ Audit fix: Unhandled Promise Rejection — sync error handler async'i yakalamıyor
  try {
    const g: any = global as any;
    g.HermesInternal?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (id: number, reason: any) => {
        try {
          if (crashlytics) {
            const err = reason instanceof Error ? reason : new Error(String(reason?.message || reason));
            crashlytics().recordError(err, `[unhandled-rejection-${id}] ${err.message}`);
          }
        } catch {}
      },
    });
  } catch {}
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
  /** ★ 2026-05-09: Profile fetch network başarısız oldu mu? AuthGuard yanlışlıkla
   *  onboarding'e yollamasın diye true ise "Bağlantı Sorunu" UI gösterilir. */
  profileFetchFailed: boolean;
  retryProfileFetch: () => void;
  /** ★ 2026-05-09: Hoşgeldin/Oda aç ipucu zinciri sırasında tab bar'ı gizlemek için.
   *  home.tsx cover şartı aktifken true → CurvedTabBar null döner, alt menü kaybolur. */
  tabBarCovered: boolean;
  setTabBarCovered: (v: boolean) => void;
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
  profileFetchFailed: false,
  retryProfileFetch: () => {},
  tabBarCovered: false,
  setTabBarCovered: () => {},
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

// ========== KULLANICI PROFİLİ SHEET CONTEXT ==========
// ★ v107.32: Context ve hook ayrı dosyada (providers/UserProfileSheetContext.tsx)
//   Cycle dependency'yi kırmak için. _layout import + re-export yapar (geriye uyumluluk).
import {
  UserProfileSheetContext,
  useUserProfileSheet,
  type UserProfileSheetContextType,
} from '../providers/UserProfileSheetContext';
export { UserProfileSheetContext, useUserProfileSheet };
export type { UserProfileSheetContextType };

// ★ 2026-04-27: Global Search Sheet — UserSearchModal Tab Navigator dışında
// (app/_layout.tsx'te) mount edilir, böylece Tab Bar'ın altında kalmaz.
type UserSearchSheetContextType = {
  openSearch: (opts: {
    mode: 'discover' | 'compose';
    onSelectUser?: (userId: string, displayName: string) => void;
    onSelectRoom?: (roomId: string) => void;
  }) => void;
  closeSearch: () => void;
};
export const UserSearchSheetContext = createContext<UserSearchSheetContextType>({
  openSearch: () => {},
  closeSearch: () => {},
});
export function useUserSearchSheet() {
  return useContext(UserSearchSheetContext);
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
  // ★ 2026-04-26 PERF: usePathname() KALDIRILDI — her navigasyon değişikliğinde
  //   bu provider + tüm children (CurvedTabBar dahil) re-render oluyordu.
  //   Oda içinde olup olmadığını global.__sopranoInRoom flag'inden okuyoruz
  //   (room/[id] mount'ta true, unmount'ta false yapıyor).
  const inRoomRef = useRef(false);
  useEffect(() => {
    // Periyodik sync — global flag room/[id] tarafından yönetilir
    const syncInRoom = () => { inRoomRef.current = !!(global as any).__sopranoInRoom; };
    syncInRoom();
    // AppState change'de de senkronize et
    const sub = require('react-native').AppState.addEventListener('change', syncInRoom);
    return () => sub?.remove();
  }, []);

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
            .in('type', ['room_live', 'room_invite', 'room_invite_accepted', 'room_invite_rejected', 'missed_call', 'incoming_call', 'gift', 'symbol_gift', 'thank_you', 'event_reminder', 'follow_accepted', 'follow_rejected']);
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

    // 1. DM realtime — yeni mesaj gelince badge'i güncelle.
    // ★ 2026-04-29 v85: Optimistic +1 yerine refreshBadges() çağırıyoruz — yabancıdan gelen
    //   pending request mesajları DM badge'inde sayılmamalı (getUnreadCount artık filtreliyor).
    //   Debounce: 250ms — birden fazla INSERT/UPDATE birleşip tek DB sorgusu olur.
    let dmRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    const dmRefreshDebounced = () => {
      if (dmRefreshTimer) clearTimeout(dmRefreshTimer);
      dmRefreshTimer = setTimeout(() => { refreshBadges(); }, 250);
    };
    const dmSub = supabase
      .channel(`badge_dm:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      }, dmRefreshDebounced)
      // mesaj is_read flip olunca badge anında güncellenir
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      }, (payload) => {
        const oldM = payload.old as { is_read?: boolean };
        const newM = payload.new as { is_read?: boolean };
        if ((oldM?.is_read === false && newM?.is_read === true) ||
            (oldM?.is_read === true && newM?.is_read === false)) {
          dmRefreshDebounced();
        }
      })
      // DELETE — okunmamış mesaj silindiğinde decrement (refreshBadges zaten doğru sayar)
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const del = payload.old as { receiver_id?: string; is_read?: boolean };
        if (del?.receiver_id === userId && del?.is_read === false) {
          dmRefreshDebounced();
        }
      })
      // ★ message_requests INSERT/UPDATE → istek statüsü değişince DM badge yeniden hesaplansın
      //   (pending sender'lar DM badge'inden hariç tutuluyor)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'message_requests',
        filter: `receiver_id=eq.${userId}`,
      }, dmRefreshDebounced)
      .subscribe();

    // 2. Friendship realtime — pending istek gelince sayıyı güncelle
    const friendSub = FriendshipService.onFriendshipChange(userId, (requests) => {
      setPendingFollows(requests.length);
    });

    // 3. Notifications realtime — yeni bildirim gelince sayıyı artır + anlık toast
    // ★ Zil badge'ine dahil olan bildirim tipleri (oda + arama + hediye + teşekkür + arkadaşlık yanıtları)
    // ★ 2026-04-21: follow_pending context-aware — oda içindeyken bell badge'e eklenir, dışında arkadaş simgesi ile yetinir.
    const BELL_NOTIF_TYPES_BASE = ['room_live', 'room_invite', 'room_invite_accepted', 'room_invite_rejected', 'missed_call', 'incoming_call', 'gift', 'symbol_gift', 'thank_you', 'event_reminder', 'follow_accepted', 'follow_rejected'];
    const notifSub = supabase
      .channel(`badge_notif:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, async (payload) => {
        const n = payload.new as { type?: string; body?: string; id?: string; sender_id?: string };
        const notifType = n?.type;
        // ★ 2026-04-20: follow_request bell'e sayılmaz (Friends drawer'da zaten
        //   pendingFollows var) ama her ekranda toast göster ki oda içindeki
        //   kullanıcı da bilsin.
        if (notifType === 'follow_request' || notifType === 'follow_pending') {
          // ★ 2026-04-24: Actionable card tetikle — toast yerine onayla/reddet butonlu premium kart.
          //   Oda içindeyken unread bell badge'e de ekle.
          if (inRoomRef.current) setUnreadNotifs(prev => prev + 1);
          try {
            if (n?.sender_id && userId) {
              const { data: sp } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', n.sender_id).single();
              if (__DEV__) console.log('[FriendRequest] Card tetikleniyor:', n.sender_id, sp?.display_name);
              (global as any).__setIncomingFriendRequest?.({
                senderId: n.sender_id,
                senderName: sp?.display_name || 'Kullanıcı',
                senderAvatar: sp?.avatar_url,
                notificationId: n.id,
                currentUserId: userId,
              });
            } else {
              if (__DEV__) console.warn('[FriendRequest] sender_id veya userId eksik:', n);
            }
          } catch (e) {
            if (__DEV__) console.warn('[FriendRequest] Profile fetch hatası:', e);
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
        } else if (notifType === 'symbol_gift') {
          // ★ v107: Sembol hediye — body format "<item_id>|<item_name>|<art_emoji>"
          const parts = body.split('|');
          const emoji = parts[2] || '✨';
          const itemName = parts[1] || 'sembol';
          showToast({
            title: `${emoji} Sembol Hediye`,
            message: `${itemName} hediye aldın`,
            type: 'success',
            id,
          });
        } else if (notifType === 'thank_you') {
          showToast({ title: '💖 Teşekkür Aldın', message: body, type: 'success', id });
        } else if (notifType === 'missed_call') {
          showToast({ title: '📞 Cevapsız Arama', message: body, type: 'warning', id });
        } else if (notifType === 'event_reminder') {
          showToast({ title: '⏰ Etkinlik Hatırlatıcı', message: body, type: 'info', id });
        } else if (notifType === 'follow_accepted') {
          showToast({ title: '🎉 Arkadaşlık Kabul', message: body, type: 'success', id });
        } else if (notifType === 'room_access_request') {
          // ★ v92.12 (1 May 2026): Toast kaldırıldı — talep PlusMenu accordion'a düşer.
          //   Tab bar + butonunda badge sayı gösterir, host orada görüp onay/red verir.
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
  const { isAuthReady, isLoggedIn, profile, firebaseUser, authVersion, profileFetchFailed, retryProfileFetch } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthReady) return; // Firebase & Profil kontrolü bitene kadar bekle

    const inAuthGroup = segments[0] === '(auth)';
    const isOnboarding = segments.length > 1 && segments[1] === 'onboarding';
    // ★ v107.46: Şifre sıfırlama deep link bağlamında AuthGuard hiçbir yönlendirme yapmasın.
    //   Email maili tıklayan kullanıcı zaten oobCode ile reset-password ekranına geliyor;
    //   AuthGuard onu login'e ya da home'a sürüklerse mail linki kırılır.
    //   app/auth/reset-password.tsx (grupsuz) → segments = ['auth', 'reset-password']
    const isResetPassword = segments[0] === 'auth' && segments[1] === 'reset-password';
    if (isResetPassword) return;

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
        // ★ 2026-05-09: profileFetchFailed → AuthGuard'ın render branch'i "Bağlantı Sorunu"
        //   UI'ı gösterir; effect içinde redirect yapmıyoruz. Aksi halde network koparsa
        //   var olan hesap yanlışlıkla onboarding'e yollanır.
        if (profileFetchFailed) return;
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
  }, [isAuthReady, isLoggedIn, profile, firebaseUser?.emailVerified, segments, authVersion, profileFetchFailed]);

  // ★ Auth hazır değilken loading göster — proje bg + animated spinner
  if (!isAuthReady) {
    return (
      <AppBackground radialGlow>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <AppLoader size={56} />
        </View>
      </AppBackground>
    );
  }

  // ★ 2026-05-09: Profile fetch network başarısız → onboarding yerine "Tekrar Dene" UI.
  //   isLoggedIn=true (Firebase auth tamam) ama profile DB'den çekilemedi → kullanıcı
  //   yanlışlıkla onboarding'e atılırsa hesabını "yeni" sanıp yeniden setup'a girer.
  if (isLoggedIn && profileFetchFailed && !profile) {
    return (
      <AppBackground radialGlow>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
            marginBottom: 20,
          }}>
            <Ionicons name="cloud-offline-outline" size={42} color="#EF4444" />
          </View>
          <Text style={{ color: '#F1F5F9', fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
            Bağlantı Sorunu
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 28 }}>
            Profilini sunucudan getiremedik. İnternet bağlantını kontrol edip tekrar dene.
          </Text>
          <Pressable
            onPress={retryProfileFetch}
            style={({ pressed }) => [{
              paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
              backgroundColor: '#14B8A6', flexDirection: 'row', alignItems: 'center', gap: 8,
              opacity: pressed ? 0.8 : 1,
            }]}
          >
            <Ionicons name="refresh" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>Tekrar Dene</Text>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  return <>{children}</>;
}

// ========== ROOT LAYOUT ==========
const { width, height } = Dimensions.get('window');

export default function RootLayout() {
  // Splash kaldırıldı — doğrudan login/home'a geçiş

  // ★ Font yükleme durumunu takip et
  // ★ 2026-04-25: Ionicons font'u da pre-load — tab bar icon race condition fix.
  //   İlk açılışta sol-altta radio icon görünmüyordu çünkü Ionicons font'u
  //   splash gizlendikten sonra yükleniyordu. Artık splash, Ionicons dahil
  //   tüm fontlar yüklenene kadar kalır.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Ionicons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
  });

  const [appIsReady, setAppIsReady] = useState(false);
  // ★ Intro video kaldırıldı — doğrudan uygulama açılır

  // Uygulama hazırlık süreci
  useEffect(() => {
    // ★ Watchdog: prepare() içindeki herhangi bir await 8sn'i geçerse splash'i zorla kapat.
    //   Cold start'ta sonsuz hang yerine boş/erişilebilir UI tercih edilir.
    const watchdog = setTimeout(() => {
      setAppIsReady((current) => {
        if (!current && __DEV__) console.warn('[RootLayout] Splash watchdog tetiklendi (8sn).');
        return true;
      });
    }, 8000);
    async function prepare() {
      if (__DEV__) console.log('[RootLayout] Hazırlık süreci başlatıldı...');
      try {
        // ★ Audit fix: Settings + i18n + LiveKit init paralel.
        //   Önceden 3 await ardışıktı (~150-300ms toplam); artık paralel.
        const [s] = await Promise.all([
          SettingsService.get(),
          i18n.init(),
        ]);
        setActiveTheme(s.theme as ThemeKey);
        setThemeVersion(v => v + 1);
        // ★ Faz 3.4 — Mic processing tercihlerini LiveKit'e geçir (publish öncesi aktif).
        //   Ayrı try/catch — LiveKit yüklemesi fail olursa app yine açılsın.
        try {
          const { liveKitService } = await import('../services/livekit');
          liveKitService.setAudioProcessing({
            echoCancellation: s.echo_cancellation,
            noiseSuppression: s.noise_suppression,
            autoGainControl: s.auto_gain,
          });
        } catch {}
        // ★ 2026-05-10: Web admin'den frame_config / entry_config güncellenince
        //   mobil tarafta cache invalidate edilsin diye realtime sub başlat.
        try {
          const { startCosmeticConfigSync } = require('../services/cosmeticConfigCache');
          startCosmeticConfigSync();
        } catch {}
        // ★ v115 (13 May 2026): Oda layout config realtime sub — web admin'de
        //   yapılan oda düzeni ayarları mobile'a anında yansısın.
        try {
          const { startRoomLayoutSync } = require('../services/roomLayoutConfig');
          startRoomLayoutSync();
        } catch {}
        // ★ v117 (13 May 2026): Yeni 6 kozmetik editör (glow/badge/background/theme/emoji/effect)
        //   için merkezi cache+realtime sub. cosmetic_items UPDATE eventlerini dinler.
        try {
          const { startEditorConfigSync } = require('../services/cosmeticEditorConfigs');
          startEditorConfigSync();
        } catch {}
        // ★ v120 (13 May 2026): Sistem teması (app_theme_config) realtime sub —
        //   web admin tema renklerini değiştirdiğinde mobile anında yansır.
        try {
          const { startAppThemeSync } = require('../services/appThemeConfig');
          startAppThemeSync();
        } catch {}
        // ★ F-1 (16 May 2026): Sistem ayarları (bakım modu/banner/force-update) realtime sub.
        try {
          startSystemSettingsSync();
        } catch {}
      } catch (e) {
        if (__DEV__) console.error('[RootLayout] Hazırlık hatası:', e);
      } finally {
        setAppIsReady(true);
        clearTimeout(watchdog);
      }
    }
    prepare();
    return () => clearTimeout(watchdog);
  }, []);

  // ★ CRITICAL: Her şey hazır olduğunda splash screen'i gizle
  // ★ 2026-05-09: 300ms → 1200ms — splash çok hızlı geçiyordu, logo göze takılmadan
  //   kayboluyor; +900ms ekstra logoyu göstermek için yeterli (toplam ~1.2sn JS hazırsa).
  // ★ 2026-05-10: 1200ms → 600ms — kullanıcı "ufak tefek flash bug'lar" raporladı,
  //   splash → login geçişini yumuşatmak için süre yarıya. Native splash drag-edilemez
  //   (OS özelliği), ama kısa süre + login'in kendi staggered animasyonu yumuşak hisse
  //   yeter. Login screen mount'ta logo zaten 600ms'de süzülerek geliyor.
  useEffect(() => {
    if (appIsReady && (fontsLoaded || fontError)) {
      const timer = setTimeout(async () => {
        try {
          await SplashScreen.hideAsync({ fade: true } as any);
        } catch (e) {
          if (__DEV__) console.warn('[RootLayout] Splash gizleme hatası:', e);
        }
      }, 600);
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
  // ★ 2026-05-09: syncProfile 3 retry sonrası başarısızsa true. AuthGuard
  //   onboarding redirect yerine "tekrar dene" UI gösterir.
  const [profileFetchFailed, setProfileFetchFailed] = useState(false);
  const [tabBarCovered, setTabBarCovered] = useState(false);
  const [minimizedRoom, setMinimizedRoom] = useState<MinimizedRoom | null>(null);
  // ★ 2026-04-21: Ref — call signal handler closure'da stale değer kullanmasın
  const minimizedRoomRef = useRef<MinimizedRoom | null>(null);
  useEffect(() => { minimizedRoomRef.current = minimizedRoom; }, [minimizedRoom]);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  // ★ 2026-04-26: Global kullanıcı profili sheet — her yerden açılır (clubhouse tarzı peek)
  const [profileSheetUserId, setProfileSheetUserId] = useState<string | null>(null);
  const userProfileSheetContextValue = useMemo(() => ({
    openUserProfile: (userId: string) => setProfileSheetUserId(userId),
    closeUserProfile: () => setProfileSheetUserId(null),
  }), []);

  // ★ 2026-04-27: Global search sheet — Tab bar'ın üzerinde render edebilmek için
  //   app/_layout.tsx'te mount; home/messages pages'leri context üzerinden açar.
  type SearchSheetState = {
    visible: boolean;
    mode: 'discover' | 'compose';
    onSelectUser?: (userId: string, displayName: string) => void;
    onSelectRoom?: (roomId: string) => void;
  };
  const [searchSheet, setSearchSheet] = useState<SearchSheetState>({ visible: false, mode: 'discover' });
  const userSearchSheetContextValue = useMemo(() => ({
    openSearch: (opts: Omit<SearchSheetState, 'visible'>) => setSearchSheet({ ...opts, visible: true }),
    closeSearch: () => setSearchSheet(prev => ({ ...prev, visible: false })),
  }), []);
  // ★ 2026-04-20: Zil ikon offseti (sağdan px). Her ekran farklı; default 60 (home pattern).
  const [notifDrawerAnchorRight, setNotifDrawerAnchorRight] = useState(60);
  const [notifDrawerRight, setNotifDrawerRight] = useState<number>(8);
  const [notifDrawerTop, setNotifDrawerTop] = useState<number | undefined>(undefined);
  // ★ Gelen SP bağışı için global popup state
  const [incomingGift, setIncomingGift] = useState<{
    amount: number; senderId: string; senderName: string; senderAvatar?: string; notificationId?: string;
  } | null>(null);
  // ★ Gelen teşekkür bildirimi için global popup state
  const [incomingThankYou, setIncomingThankYou] = useState<{
    senderName: string; senderAvatar?: string; emoji?: string; message?: string;
  } | null>(null);
  // ★ 2026-04-24: Arkadaşlık isteği actionable card state
  const [incomingFriendRequest, setIncomingFriendRequest] = useState<{
    senderId: string; senderName: string; senderAvatar?: string; notificationId?: string; currentUserId: string;
  } | null>(null);
  // Child provider (RealtimeBadgeProvider) bunu çağırsın diye global setter register et
  useEffect(() => {
    (global as any).__setIncomingFriendRequest = setIncomingFriendRequest;
    return () => { delete (global as any).__setIncomingFriendRequest; };
  }, []);
  const router = useRouter();
  // ★ 2026-04-26 PERF: usePathname() ve useSegments() ROOT LAYOUT'TAN KALDIRILDI.
  //   Bu hook'lar her navigasyon değişikliğinde (tab switch, push, back) tüm
  //   1466 satırlık RootLayout bileşenini re-render ettiriyordu — context provider'lar,
  //   overlay'ler, children hepsi yeniden oluşturuluyordu. isTabBarVisible artık
  //   MiniRoomCard'in kendi içinde useSegments() ile hesaplanıyor.

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
  // ★ 2026-04-26 PERF: Duplicate SettingsService.get() + i18n.init() kaldırıldı.
  //   prepare() fonksiyonu (satır ~554) zaten aynı işi yapıyor. İki paralel async
  //   çağrı → double network request + double setThemeVersion re-render.



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
  // ★ 2026-05-09 v208: isAuthReady=false set edilir → AuthGuard "yükleniyor" branch'ine
  //   düşer, profile fetch tamamlanmadan onboarding'e fake redirect olmaz (Google login flash fix).
  const syncProfile = async (fbUser: User) => {
    setIsAuthReady(false);
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
        // ★ 2026-05-09: Önceki başarısızlık varsa temizle
        setProfileFetchFailed(false);

        // ★ SP Tetikleyiciler: Günlük giriş + Prime-time
        try {
          await GamificationService.onDailyLogin(fbUser.uid);
          await GamificationService.onPrimeTimeReturn(fbUser.uid);
        } catch { /* SP kazandırma başarısız olursa sessiz geç */ }

        // ★ RevenueCat: SDK başlat + kullanıcı kimliğini bağla
        RevenueCatService.init(fbUser.uid).catch(() => {});
      } else if (fetchErr) {
        // ★ 2026-05-09: 3 denemede başarısız — AuthGuard onboarding'e atmasın diye
        //   profileFetchFailed=true. Kullanıcı "Tekrar Dene" → retryProfileFetch çağrılır.
        if (__DEV__) console.warn('[syncProfile] 3 denemede profile yüklenemedi:', fetchErr);
        setProfileFetchFailed(true);
      } else {
        // Gerçekten yok — yeni kullanıcı, onboarding akışına gidecek
        setProfile(null);
        setProfileFetchFailed(false);
      }
    } finally {
      setIsAuthReady(true);
    }
  };

  // ★ 2026-05-09: AuthGuard "Bağlantı Sorunu" ekranındaki "Tekrar Dene" butonu için.
  const retryProfileFetch = useCallback(() => {
    if (!firebaseUser) return;
    setProfileFetchFailed(false);
    syncProfile(firebaseUser).catch(() => {});
  }, [firebaseUser]);

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
        // ★ 2026-04-28 v79: accessToken factory (supabase.ts) tüm auth'u yönetiyor.
        //   Firebase JWT → Supabase JWKS doğrulama → REST + Realtime çalışıyor.
        //   KRİTİK: Manual setAuth() ÇAĞIRMA! (InvalidJWTToken hatasına sebep olur)
        if (__DEV__) console.log('[RootLayout] Firebase user ready, accessToken factory aktif.');

        // Şimdi state'i set et — child useEffect'ler artık authed Realtime ile abone olur.
        setFirebaseUser(fbUser);
        setUser({
          name: fbUser.displayName || 'Kullanıcı',
          avatar: fbUser.photoURL || '',
        });
        setIsLoggedIn(true);

        // ★ 2026-04-25: Analytics user identification + Crashlytics binding
        //   Crashlytics setUserId crash report'larını user'a bağlar (KVKK: sadece UID, PII yok).
        try {
          const { Analytics } = require('../services/analytics');
          Analytics.setUserId(fbUser.uid);
          Analytics.track('login_success');
        } catch {}
        try {
          const cl = require('@react-native-firebase/crashlytics').default;
          cl().setUserId(fbUser.uid);
        } catch {}

        // Supabase profilini bekle (isAuthReady'i burada true yapacak)
        await syncProfile(fbUser);

        // ★ v78: Push bildirim token'ı al ve push_tokens tablosuna kaydet (multi-device)
        const pushToken = await PushNotificationService.registerForPushNotifications();
        if (pushToken) {
          await PushNotificationService.savePushToken(fbUser.uid, pushToken);
        }
      } else {
        setFirebaseUser(null);
        setProfile(null);
        setIsLoggedIn(false);
        setIsAuthReady(true);
        // ★ Logout: Crashlytics + Analytics user'ı sıfırla (KVKK: PII bağı kopsun)
        try {
          const { Analytics } = require('../services/analytics');
          Analytics.setUserId(null);
        } catch {}
        try {
          const cl = require('@react-native-firebase/crashlytics').default;
          cl().setUserId('');
        } catch {}
        // ★ Logout: Supabase token cache temizle + minimized room sıfırla + LiveKit kapat
        setSupabaseAuthToken(null);
        clearTokenCache();
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
        // ★ v79: Token cache yenileme (no-op — factory her çağrıda getIdToken yapıyor)
        await refreshTokenCache();
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
  }, [firebaseUser?.uid]); // ★ Audit fix: obj ref yerine uid

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
  }, [firebaseUser?.uid]); // ★ Audit fix: obj ref yerine uid

  // ═══ P2: SP Bakiye Realtime — SP değiştiğinde profil anında güncellenir ═══
  // ★ 2026-04-26 PERF: refreshProfile() tam DB fetch + tüm context tree re-render'ı tetikliyordu.
  //   Şimdi sadece system_points field'ını in-place güncelliyoruz — O(1) + tek setState.
  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) return;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const setupSpChannel = () => {
      if (cancelled) return;
      if (currentChannel) {
        try { supabase.removeChannel(currentChannel); } catch {}
      }
      currentChannel = supabase
        .channel(`sp_sync:${uid}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${uid}`,
        }, (payload) => {
          const newSP = (payload.new as { system_points?: number })?.system_points;
          // Sadece SP değiştiyse profili tazele (gereksiz re-render önleme)
          if (newSP !== undefined) {
            if (__DEV__) console.log(`[SPSync] Bakiye güncellendi: ${newSP} SP`);
            // ★ PERF: Tam refreshProfile() yerine sadece SP field'ını güncelle
            setProfile(prev => prev ? { ...prev, system_points: newSP } : prev);
          }
        })
        .subscribe((status, err) => {
          if (__DEV__) console.log(`[SPSync] channel status: ${status}`, err ? `err=${err?.message || JSON.stringify(err)}` : '');
          // ★ Reconnect on error — Firebase 3PA + Realtime bağlantı düşmesinde otomatik yeniden bağlan
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (__DEV__) console.warn(`[SPSync] Kanal hatası (${status}) — 3sn sonra yeniden bağlanıyor...`, err);
            setTimeout(() => { if (!cancelled) setupSpChannel(); }, 3000);
          }
        });
    };
    setupSpChannel();

    return () => {
      cancelled = true;
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
  }, [firebaseUser?.uid]); // ★ Audit fix: obj ref yerine uid string (her render leak önle)

  // ═══ SP Bağış Alındı — realtime popup tetikleyici ═══
  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) return;
    let giftChannel: ReturnType<typeof supabase.channel> | null = null;
    let giftCancelled = false;

    const giftHandler = async (payload: any) => {
      const notif = payload.new as any;
      if (__DEV__) console.log('[GiftRT] notif received:', notif?.type, notif?.body);
      // ★ 2026-04-24: thank_you tipini de yakala → ThankYouReceivedModal tetikle
      if (notif?.type === 'thank_you' && notif?.sender_id) {
        try {
          const { data: thankSender } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', notif.sender_id)
            .single();
          // Body'den emoji + label parse: "🙏 Teşekkürler" pattern
          const bodyParts = (notif.body || '').split(' ');
          const thankEmoji = bodyParts[0] || '🙏';
          const thankMessage = bodyParts.slice(1).join(' ') || undefined;
          setIncomingThankYou({
            senderName: thankSender?.display_name || 'Birisi',
            senderAvatar: thankSender?.avatar_url,
            emoji: thankEmoji,
            message: thankMessage,
          });
        } catch {}
        return;
      }
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
          notificationId: notif.id,
        });
      } catch (e) {
        if (__DEV__) console.warn('[GiftRT] Sender profile fetch failed:', e);
      }
    };

    const setupGiftChannel = () => {
      if (giftCancelled) return;
      if (giftChannel) {
        try { supabase.removeChannel(giftChannel); } catch {}
      }
      giftChannel = supabase
        .channel(`gift_recv:${uid}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${uid}`,
        }, giftHandler)
        .subscribe((status, err) => {
          if (__DEV__) console.log(`[GiftRT] channel status: ${status} for user ${uid}`, err ? `err=${err?.message || JSON.stringify(err)}` : '');
          // ★ Reconnect on error — bağlantı düşerse 3sn sonra yeniden bağlan
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (__DEV__) console.warn(`[GiftRT] Kanal hatası (${status}) — 3sn sonra yeniden bağlanıyor...`, err);
            setTimeout(() => { if (!giftCancelled) setupGiftChannel(); }, 3000);
          }
        });
    };
    setupGiftChannel();

    return () => {
      giftCancelled = true;
      if (giftChannel) supabase.removeChannel(giftChannel);
    };
  }, [firebaseUser?.uid]); // ★ Audit fix: obj ref yerine uid string

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
      // ★ Audit fix: removeChannel() — unsubscribe Supabase registry'den silmiyor.
      //   call.ts'den gelen wrapper, internal channel'ı kapamak için cast.
      try { supabase.removeChannel(callChannel as any); } catch {}
      callChannelRef.current = null;
      appStateSub.remove();
    };
  }, [firebaseUser?.uid]); // ★ Audit fix: obj ref yerine uid string

  // ★ ARCH-8 FIX: routerRef her render'da güncellenir — stale router önlenir
  const router2 = useRouter();
  const routerRef = useRef(router2);
  routerRef.current = router2;
  useEffect(() => {
    // ★ SEC: Deep link path traversal koruması — sadece geçerli ID formatları kabul edilir.
    //   rooms.id = UUID v4 (36 char), profiles.id = Firebase UID (20–40 alphanumeric).
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const FUID_RE = /^[A-Za-z0-9]{20,40}$/;
    function handleDeepLink(url: string) {
      try {
        const parsed = Linking.parse(url);
        const rawPath = parsed.path || '';
        const path = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
        // ★ v107.46: /auth/reset-password expo-router otomatik route ediyor (app/auth/reset-password.tsx).
        //   Bu handler sadece /room/* ve /user/* için manuel routing yapıyor.
        if (path.startsWith('room/')) {
          const roomId = path.slice('room/'.length).split('/')[0].split('?')[0].trim();
          if (UUID_RE.test(roomId)) routerRef.current.push(`/room/${roomId}`);
        } else if (path.startsWith('user/')) {
          const userId = path.slice('user/'.length).split('/')[0].split('?')[0].trim();
          if (FUID_RE.test(userId)) routerRef.current.push(`/user/${userId}`);
        }
      } catch (e) { /* ignore */ }
    }

    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });

    return () => sub?.remove();
  }, []);

  // ★ 2026-04-26 PERF: Context value'lar memoize — her render'da yeni obje oluşması
  //   tüm useAuth() / useTheme() consumer'larını gereksiz re-render ettiriyordu.
  const authContextValue = useMemo(() => ({
    isAuthReady, isLoggedIn, setIsLoggedIn, user, setUser, firebaseUser,
    authVersion, refreshAuth, justCompletedOnboarding, setJustCompletedOnboarding,
    profile, setProfile, refreshProfile, profileFetchFailed, retryProfileFetch,
    tabBarCovered, setTabBarCovered,
    minimizedRoom, setMinimizedRoom,
    pendingCallSignals, consumeCallSignal, activeCallId,
    setActiveCallId: updateActiveCallId, showNotifDrawer, setShowNotifDrawer,
    setNotifDrawerAnchorRight, setNotifDrawerRight, setNotifDrawerTop,
  }), [
    isAuthReady, isLoggedIn, user, firebaseUser, authVersion,
    justCompletedOnboarding, profile, profileFetchFailed, retryProfileFetch,
    tabBarCovered,
    minimizedRoom,
    pendingCallSignals, activeCallId, showNotifDrawer,
  ]);

  const themeContextValue = useMemo(() => ({
    themeVersion, applyTheme,
  }), [themeVersion, applyTheme]);

  // ★ Hazırlık bitene kadar minimal loading göster
  // ★ 2026-04-26 FIX: Hook kuralları — tüm hook'lardan SONRA early return.
  //   Önceki konumda useMemo'lar koşullu çağrılıyordu → "Rendered more hooks" crash.
  if (!appIsReady || (!fontsLoaded && !fontError)) {
    return <SplashSpinner size={56} color="#14B8A6" />;
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <UserProfileSheetContext.Provider value={userProfileSheetContextValue}>
      <UserSearchSheetContext.Provider value={userSearchSheetContextValue}>
      <ThemeContext.Provider value={themeContextValue}>
      <DynamicThemeProvider themeItemId={(profile as any)?.active_theme_id || null}>
      <RealtimeBadgeProvider userId={firebaseUser?.uid || null}>
      <OnlineFriendsProvider userId={firebaseUser?.uid || null}>
      <DMNotifProvider userId={firebaseUser?.uid || null}>

      <SafeAreaProvider>
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
              animationDuration: 180,
            }}
          >
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            {/* ★ 2026-04-24: slide_from_bottom — home'dan odaya doğal giriş.
                 Minimize restore'da expand-from-card animasyonu görsel geçişi yapar,
                 slide_from_bottom altında kalır ve görünmez. */}
            <Stack.Screen name="room/[id]" options={{
              animation: 'slide_from_bottom',
              animationDuration: 280,
              gestureEnabled: false,
            }} />
            {/* broadcast/[id] kaldırıldı — Room'a "Yayın Modu" toggle eklendi */}
            {/* ★ 2026-04-26 (v2): Mesajlar sayfası ISTISNA — sürükleme yerine yanal animasyon.
                 Diğer modal'lar (user/[id]) alttan kayar; bu sayfa klasik sayfa geçişi pattern'i. */}
            <Stack.Screen
              name="chat/[id]"
              options={{
                animation: 'slide_from_right',
                animationDuration: 280,
              }}
            />
            {/* ★ 2026-04-26: user/[id] modal — başka kullanıcının tam profili sayfası, bağlam-içi açılışlar modal olsun (Clubhouse/Telegram pattern) */}
            <Stack.Screen
              name="user/[id]"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
                animationDuration: 280,
                gestureEnabled: true,
                gestureDirection: 'vertical',
              }}
            />
            <Stack.Screen name="plus" options={{ animation: 'slide_from_right', animationDuration: 280 }} />
            <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right', animationDuration: 280 }} />
            <Stack.Screen name="notifications" options={{ animation: 'slide_from_right', animationDuration: 280 }} />
            <Stack.Screen name="admin" options={{ animation: 'slide_from_right', animationDuration: 280 }} />
            <Stack.Screen name="call/[id]" options={{ animation: 'fade_from_bottom', animationDuration: 200, gestureEnabled: false }} />
            {/* ★ 2026-04-23: create-room artık bottom-sheet modal — arkadaki ekran görünür kalır,
                 kendi animasyonunu içinde yapıyor (translateY + backdrop fade), native transition yok. */}
            <Stack.Screen name="create-room" options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }} />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_right', animationDuration: 280 }} />
            <Stack.Screen name="leaderboard" options={{ animation: 'slide_from_right', animationDuration: 280 }} />

          </Stack>
        </AuthGuard>
        </ErrorBoundary>
        {/* Küçültülmüş Oda Kartı — Tüm sayfalarda görünür; tab bar yoksa tab bar offset'i sıfırla */}
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
            onMuteToggle={() => {
              // ★ 2026-04-24: Minimize'da oda sesini aç/kapat
              //   LiveKit remote audio track'leri toggle et
              const newMuted = !minimizedRoom.isRoomMuted;
              try {
                const room = liveKitService.currentRoom;
                if (room) {
                  room.remoteParticipants.forEach((p: any) => {
                    p.audioTrackPublications?.forEach((pub: any) => {
                      if (pub.track) {
                        if (newMuted) {
                          pub.track.stop();
                        } else {
                          pub.track.start();
                        }
                      }
                    });
                  });
                }
              } catch {}
              setMinimizedRoom({ ...minimizedRoom, isRoomMuted: newMuted });
            }}
            onMicToggle={async () => {
              // ★ 2026-04-24: Minimize'da mic aç/kapat — LiveKit toggle
              try {
                await liveKitService.toggleMicrophone();
                const newMicOn = liveKitService.isMicrophoneEnabled;
                setMinimizedRoom({ ...minimizedRoom, isMicOn: newMicOn });
              } catch {}
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
          onShowGiftModal={(p) => setIncomingGift({ amount: p.amount, senderId: p.senderId, senderName: p.senderName, senderAvatar: p.senderAvatar, notificationId: p.notificationId })}
          onShowThankYou={(p) => setIncomingThankYou({ senderName: p.senderName, senderAvatar: p.senderAvatar, emoji: p.emoji || '🙏', message: p.message })}
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
            giftNotificationId={incomingGift.notificationId}
            onClose={() => setIncomingGift(null)}
          />
        )}

        {/* ★ Teşekkür Alındı global popup — realtime tetiklenir */}
        {/* ★ 2026-04-24: Arkadaşlık isteği actionable card — hem oda içi hem dışarıda */}
        <IncomingFriendRequestCard
          request={incomingFriendRequest}
          onDismiss={() => setIncomingFriendRequest(null)}
          onHandled={() => {
            // Keşfet arkadaş simgesi + oda zil badge'i senkron — DB'den fresh count çek
            try { (global as any).__sopranoBadgeRefresh?.(); } catch {}
          }}
        />

        {incomingThankYou && (
          <ThankYouReceivedModal
            visible={!!incomingThankYou}
            senderName={incomingThankYou.senderName}
            senderAvatar={incomingThankYou.senderAvatar}
            emoji={incomingThankYou.emoji}
            message={incomingThankYou.message}
            onClose={() => setIncomingThankYou(null)}
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

        {/* ★ Rozet kutlama overlay — en üst z-index */}
        <BadgeCelebration />

        {/* ★ 2026-04-26: Global kullanıcı profili sheet — oda dışı tüm bağlamlarda kullanılır.
             onViewFullProfile: oda DIŞI'nda "Tam Profili Aç" linki render ediliyor — kullanıcı arkadaşının odalarına gitmek için tam sayfaya geçebilir.
             Oda İÇİ mount'unda (app/room/[id].tsx) bu prop verilmiyor → sheet'ten escape yasak (Clubhouse no-exit). */}
        <InRoomUserProfile
          visible={!!profileSheetUserId}
          userId={profileSheetUserId}
          currentUserId={firebaseUser?.uid || null}
          onClose={() => setProfileSheetUserId(null)}
          onSelectUser={(uid) => setProfileSheetUserId(uid)}
          closeOnBackdropTap
          onViewFullProfile={() => {
            const targetId = profileSheetUserId;
            if (!targetId) return;
            setProfileSheetUserId(null);
            const isOwn = targetId === firebaseUser?.uid;
            routerRef.current.push((isOwn ? '/(tabs)/profile' : `/user/${targetId}`) as any);
          }}
        />

        {/* ★ 2026-04-27: Global Search/Discover sheet — Tab navigator dışında mount,
              böylece Tab Bar'ın altında kalmaz, full-screen kapsar. */}
        {firebaseUser && searchSheet.visible && (
          <UserSearchModal
            visible={searchSheet.visible}
            onClose={() => setSearchSheet(prev => ({ ...prev, visible: false }))}
            currentUserId={firebaseUser.uid}
            mode={searchSheet.mode}
            onSelectUser={(uid, name) => {
              searchSheet.onSelectUser?.(uid, name);
              setSearchSheet(prev => ({ ...prev, visible: false }));
            }}
            onSelectRoom={searchSheet.onSelectRoom ? (rid) => {
              searchSheet.onSelectRoom?.(rid);
              setSearchSheet(prev => ({ ...prev, visible: false }));
            } : undefined}
          />
        )}

        {/* ★ Intro Video kaldırıldı */}
        {/* ★ v107 (3 May 2026): Çift oturum uyarısı — başka cihaz takeover algılarsa modal */}
        <SessionConflictGuard userId={firebaseUser?.uid || null} />
        {/* ★ F-1 (16 May 2026): Bakım modu / zorunlu güncelleme / banner — en üst overlay */}
        <SystemSettingsOverlay />
      </View>
    </SafeAreaProvider>

    </DMNotifProvider>
    </OnlineFriendsProvider>
    </RealtimeBadgeProvider>
    </DynamicThemeProvider>
    </ThemeContext.Provider>
      </UserSearchSheetContext.Provider>
      </UserProfileSheetContext.Provider>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
});
