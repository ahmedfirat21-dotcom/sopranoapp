import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  Easing,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Share,
  FlatList,
  PanResponder,
  Linking,
  BackHandler,
  AppState,
  Keyboard,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import AppLoader from '../../components/AppLoader';
import BoostSuccessOverlay from '../../components/BoostSuccessOverlay';
import LinkifiedText from '../../components/LinkifiedText';
import LinkPreviewCard from '../../components/LinkPreviewCard';
import MessageActionMenu from '../../components/MessageActionMenu';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import { safeGoBack } from '../../constants/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';

// SopranoChat Services
import { RoomService, MessageService, RealtimeService, type Room, type RoomParticipant } from '../../services/database';
import { isTempHostUser } from '../../services/room';
import { getRoomLimits } from '../../constants/tiers';
import { purgeChannelByName } from '../../services/realtime';
import { RoomHistoryService } from '../../services/roomHistory';
import { supabase } from '../../constants/supabase';
import { RoomChatService, type RoomMessage } from '../../services/roomChat';
import { checkPermission } from '../../services/permissions';
import { ROLE_LEVEL, migrateLegacyTier, type ParticipantRole, type SubscriptionTier } from '../../types';
import { isTierAtLeast, getEffectiveTier } from '../../constants/tiers';

import { ModerationService } from '../../services/moderation';
import { RoomAccessService, type AccessCheckResult } from '../../services/roomAccess';

import { getAvatarSource } from '../../constants/avatars';
import { showToast as _globalToast, type ToastMessage } from '../../components/Toast';
// ★ Akıllı Toast: Hata/uyarı/upsell → her zaman göster (kritik feedback)
//   Başarı → ayar değişiklikleri gibi spam'ı bastır, sadece önemli olanları göster
const showToast = (opts: Partial<ToastMessage> & { title: string }) => {
  // Hata, uyarı ve upsell her zaman gösterilmeli — kullanıcı feedback'i kritik
  if (opts.type === 'error' || opts.type === 'warning' || opts.type === 'upsell') {
    _globalToast({ ...opts, title: opts.title || '', duration: opts.duration || 2500 });
    return;
  }
  // Başarı/info: sadece önemli aksiyonları göster, ayar spam'ını bastır
  const important = /silindi|donduruldu|sahne|ayrıl|host|boost|ban|sustur|takip|bağış|SP|kick|dakika|süre|kapan/i;
  if (opts.title && important.test(opts.title)) {
    _globalToast({ ...opts, title: opts.title, type: opts.type || 'success', duration: opts.duration || 2000 });
  }
  // Diğer başarı toastları (ayar güncelleme) sessizce ignore — spam önleme
};

import { useAuth, useBadges, useDMNotifOptional, useUserProfileSheet, useUserSearchSheet } from '../_layout';
import { i18n, useTranslation } from '../../services/i18n';
import { useRoomLayout } from '../../services/roomLayoutConfig';
import useLiveKit from '../../hooks/useLiveKit';
import { useMicMeter } from '../../hooks/useMicMeter';

import { liveKitService } from '../../services/livekit';
import { isSystemRoom, getSystemRooms } from '../../services/showcaseRooms';
import type { MicMode, CameraFacing } from '../../types';
import { PasswordPromptSheet, AccessRequestSheet, AccessGate, InviteRequestPromptSheet, RoomEntryPreviewSheet, type EntryPreviewFilter } from '../../components/room/RoomAccessPrompts';
import PremiumAlert, { type AlertButton, type AlertType } from '../../components/PremiumAlert';
import { ReportModal } from '../../components/ReportModal';
import AppBackground from '../../components/AppBackground';
import { EmojiReactionBar, FloatingReactionsView, type FloatingReactionsRef } from '../../components/EmojiReactions';

// Extracted Room Sub-Components
import { COLORS } from '../../components/room/constants';
import RoomEntryEffectOverlay from '../../components/room/RoomEntryEffectOverlay';
import InRoomUserProfile from '../../components/room/InRoomUserProfile';
import AudienceDrawer from '../../components/room/AudienceDrawer';
import { FriendshipService } from '../../services/friendship';
import { PlusMenu, AdvancedSettingsPanel } from '../../components/room/RoomOverlays';
import PowerUpsSheet from '../../components/room/PowerUpsSheet';
import RoomFollowersSheet from '../../components/room/RoomFollowersSheet';
import HostAccessPanel from '../../components/room/HostAccessPanel';
import HandRaiseQueuePanel from '../../components/room/HandRaiseQueuePanel';
import RoomBoostSheet, { type RoomBoostTier } from '../../components/RoomBoostSheet';
import InviteFriendsModal from '../../components/room/InviteFriendsModal';
import RoomInfoHeader from '../../components/room/RoomInfoHeader';
import SpeakerSection from '../../components/room/SpeakerSection';
import { CosmeticParticleEffect } from '../../components/skia';
import CameraFullscreenModal from '../../components/room/CameraFullscreenModal';
import ListenerGrid from '../../components/room/ListenerGrid';
import RoomControlBar from '../../components/room/RoomControlBar';
import StageActionPill from '../../components/room/StageActionPill';
import VoiceReactionOverlay, { type VoiceReactionOverlayHandle } from '../../components/room/VoiceReactionOverlay';
import RoomDisconnectOverlay from '../../components/room/RoomDisconnectOverlay';
import RoomClosedScreen, { type RoomClosedReason } from '../../components/room/RoomClosedScreen';
import { VoiceReactionService } from '../../services/voiceReactions';
import RoomChatDrawer from '../../components/room/RoomChatDrawer';
import RoomGiftAnimationOverlay from '../../components/room/RoomGiftAnimationOverlay';
import RoomGiftPanel from '../../components/room/RoomGiftPanel';
import { StoreService } from '../../services/store';
import { PREMIUM_GLOW_IDS } from '../../components/room/glowStyles';
// ★ v107.3: Host bağışı StageSupportSheet'e taşındı (DonationAlert tüm odaya gösterilen bildirim)
import DonationAlert, { type DonationAlertRef } from '../../components/room/DonationAlert';
// ★ v107.3: Host bağışı SPDonateSheet → StageSupportSheet (sahne ışığı + host glow + "Sahneyi Destekle")
//   Oda içinde artık SPDonateSheet kullanılmıyor.
import GiftSheet from '../../components/profile/GiftSheet';
import StageSupportSheet from '../../components/room/StageSupportSheet';
// ★ v107.7: Giriş ücreti onay kartı — bakiye yeterse "X SP Öde + Gir" / "Vazgeç" ile kullanıcı onayı alınır
import EntryFeeCard from '../../components/room/EntryFeeCard';
import RoomStatsPanel from '../../components/room/RoomStatsPanel';
import { RoomFollowService } from '../../services/roomFollow';
import { PushService } from '../../services/push';
import { UpsellService } from '../../services/upsell';
import SPToast, { type SPToastRef } from '../../components/SPToast';
import { GamificationService } from '../../services/gamification';
import { useRoomModeration } from '../../hooks/useRoomModeration';
import { useRoomBroadcast } from '../../hooks/useRoomBroadcast';
import { useRoomDM } from '../../hooks/useRoomDM';
import { useRoomLifecycle } from '../../hooks/useRoomLifecycle';
import { useRoomGamification } from '../../hooks/useRoomGamification';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';
import { useRoomPresence } from '../../hooks/useRoomPresence';
import ModerationOverlay, { type ModerationOverlayRef } from '../../components/room/ModerationOverlay';
import type { FlashType } from '../../components/room/AvatarPenaltyFlash';


// ★ LiveKit VideoView — native modül yoksa null (prod build gerektirmez)
let LKVideoView: any = null;
try { LKVideoView = require('@livekit/react-native').VideoView; } catch {}


const { width: W, height: H } = Dimensions.get('window');
const IS_SMALL_DM = W <= 375;
// ★ 2026-05-05: NotificationDrawer/FriendsDrawer ile birebir aynı boyut — bildirim modalı ailesi
const DM_PANEL_W = Math.min(W * 0.72, 300);
const DM_SWIPE_ACTION_W = 180; // 3 buton × 60px

// ★ 2026-04-20: Bundled MP3 oynatma kaldırıldı — YouTube/Spotify/SoundCloud linki
//   paylaşımına geçildi. Oda sahibi link koyar, kullanıcılar kendi platformlarında
//   (arka planda) dinler. TOS temiz, sunucu yükü yok, senkron yok.

// ════════════════════════════════════════════════════════════
// MUSIC BANNER — Kompakt ticker + inline iframe player
// ★ 2026-04-21: İlk render minimal (26px yüksek chip). Tıklayınca yerinde
//   expand olur — inline WebView YouTube/Spotify/SoundCloud embed player'ı
//   yükler, kullanıcı app'ten çıkmaz. Tekrar tıkla → geri chip'e döner.
// ════════════════════════════════════════════════════════════
// ★ 2026-04-28 v2: Vinyl plak çalar + draggable + içeride çalan WebView modal.
//   Tap → fullscreen sheet açar, YouTube/Spotify/SoundCloud embed WebView içinde gösterilir.
//   Kullanıcı play butonuna basarak müziği UYGULAMA İÇİNDE çalar (autoplay engeli manuel play ile aşılır).
//   Sheet kapatılınca müzik durur (WebView unmount).
function MusicBanner({ link }: { link: string }) {
  const [title, setTitle] = React.useState<string | null>(null);
  const [playerOpen, setPlayerOpen] = React.useState(false);
  const rotation = useRef(new Animated.Value(0)).current;
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const positionRef = useRef({ x: 0, y: 0 });

  // Vinyl sürekli dönsün
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  // Başlık çek (oembed)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let oembedUrl: string | null = null;
        if (/youtu\.?be/i.test(link)) oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(link)}&format=json`;
        else if (/spotify/i.test(link)) oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(link)}`;
        else if (/soundcloud/i.test(link)) oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(link)}`;
        if (!oembedUrl) return;
        const resp = await fetch(oembedUrl);
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled && data?.title) setTitle(data.title);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [link]);

  // Embed URL — WebView içinde oynatmak için
  const embedUrl = React.useMemo(() => {
    const m = link.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/i);
    if (m) return `https://www.youtube.com/embed/${m[1]}?playsinline=1&rel=0&modestbranding=1`;
    if (/open\.spotify\.com/i.test(link)) return link.replace('open.spotify.com/', 'open.spotify.com/embed/');
    if (/soundcloud\.com/i.test(link)) return `https://w.soundcloud.com/player/?url=${encodeURIComponent(link)}&color=%23FFD700&hide_related=true&show_comments=false&show_user=false&visual=true`;
    return null;
  }, [link]);

  // Drag pan
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        position.setOffset(positionRef.current);
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: position.x, dy: position.y }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: (_, g) => {
        position.flattenOffset();
        positionRef.current = {
          x: positionRef.current.x + g.dx,
          y: positionRef.current.y + g.dy,
        };
      },
    })
  ).current;

  const handleTap = () => {
    if (!embedUrl) {
      // Embed desteklenmeyen link → external browser fallback
      try {
        const WB = require('expo-web-browser');
        WB.openBrowserAsync(link, { presentationStyle: 'pageSheet', controlsColor: '#FFD700', toolbarColor: '#0F1929' });
      } catch { try { Linking.openURL(link); } catch {} }
      return;
    }
    setPlayerOpen(true);
  };

  const displayTitle = title || i18n.t('auto.room.id.123');
  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <>
      <Animated.View
        style={{
          marginHorizontal: 14,
          marginBottom: 6,
          transform: [{ translateX: position.x }, { translateY: position.y }],
        }}
        {...panResponder.panHandlers}
      >
        <Pressable onPress={handleTap} style={{ borderRadius: 30, overflow: 'hidden', borderWidth: 0.8, borderColor: 'rgba(255,215,0,0.35)' }}>
          <LinearGradient
            colors={['rgba(40,28,8,0.92)', 'rgba(15,10,4,0.97)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 8, gap: 9 }}
          >
            <Animated.View style={{ width: 32, height: 32, borderRadius: 16, transform: [{ rotate: spin }], alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0a0604', borderWidth: 1, borderColor: '#FFD700', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ position: 'absolute', width: 26, height: 26, borderRadius: 13, borderWidth: 0.5, borderColor: 'rgba(255,215,0,0.18)' }} />
                <View style={{ position: 'absolute', width: 20, height: 20, borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(255,215,0,0.12)' }} />
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#0a0604' }} />
                </View>
              </View>
            </Animated.View>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 11, fontWeight: '600', color: '#F5F5DC', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
              {displayTitle}
            </Text>
            <Ionicons name={playerOpen ? 'pause-circle' : 'play-circle'} size={18} color="#FFD700" />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Player modal — WebView içeride, kullanıcı manuel play */}
      {playerOpen && embedUrl && (() => {
        try {
          const WV = require('react-native-webview').WebView;
          return (
            <View style={{
              position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 999, justifyContent: 'center', alignItems: 'center',
            }}>
              <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setPlayerOpen(false)} />
              <View style={{ width: '92%', height: 280, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#FFD700' }}>
                <WV
                  source={{ uri: embedUrl }}
                  style={{ flex: 1, backgroundColor: '#000' }}
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                  domStorageEnabled
                />
              </View>
              <Pressable
                onPress={() => setPlayerOpen(false)}
                style={{ marginTop: 12, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,215,0,0.15)', borderWidth: 1, borderColor: '#FFD700' }}
              >
                <Text style={{ color: '#FFD700', fontWeight: '700', fontSize: 13 }}>{i18n.t('rooms.close')}</Text>
              </Pressable>
            </View>
          );
        } catch {
          // WebView modülü yoksa external'a fallback
          (async () => {
            try {
              const WB = require('expo-web-browser');
              await WB.openBrowserAsync(link);
              setPlayerOpen(false);
            } catch { try { Linking.openURL(link); } catch {} setPlayerOpen(false); }
          })();
          return null;
        }
      })()}
    </>
  );
}

// ════════════════════════════════════════════════════════════
// DM SWIPEABLE ROW — Sola kaydırarak Sil / Sessize Al / Engelle
// ★ Mesajlar sayfasındaki SwipeableRow patterninden genişletilmiş
// ════════════════════════════════════════════════════════════
function DmSwipeableRow({ children, onDelete, onMute, onBlock, isMuted }: {
  children: React.ReactNode;
  onDelete: () => void;
  onMute: () => void;
  onBlock: () => void;
  isMuted: boolean;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const actionOpacity = translateX.interpolate({
    inputRange: [-DM_SWIPE_ACTION_W, -40, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  // ★ 2026-04-21: Haptic feedback — swipe threshold geçişinde tek sefer (messages tab ile senkron)
  const hapticTriggeredRef = useRef(false);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 15 && Math.abs(gs.dy) < 15,
      onPanResponderGrant: () => { hapticTriggeredRef.current = false; },
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) {
          translateX.setValue(Math.max(gs.dx, -(DM_SWIPE_ACTION_W + 10)));
          if (gs.dx < -70 && !hapticTriggeredRef.current) {
            hapticTriggeredRef.current = true;
            try {
              const Haptics = require('expo-haptics');
              Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Medium);
            } catch {}
          } else if (gs.dx > -70) {
            hapticTriggeredRef.current = false;
          }
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -70) {
          Animated.spring(translateX, { toValue: -DM_SWIPE_ACTION_W, useNativeDriver: true, tension: 100, friction: 10 }).start();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
        }
      },
    })
  ).current;

  const closeSwipe = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
  };

  return (
    <View style={{ overflow: 'hidden', borderRadius: 14 }}>
      {/* Arka plan — aksiyonlar (sadece swipe'ta görünür) */}
      <Animated.View style={[dmSwipeS.actionRow, { opacity: actionOpacity }]}>
        {/* Sil */}
        <Pressable
          onPress={() => { closeSwipe(); onDelete(); }}
          style={[dmSwipeS.actionBtn, { backgroundColor: '#DC2626' }]}
        >
          <Ionicons name="trash-outline" size={18} color="#FFF" />
          <Text style={dmSwipeS.actionLabel}>{i18n.t('common.delete')}</Text>
        </Pressable>
        {/* Sessize Al / Aç */}
        <Pressable
          onPress={() => { closeSwipe(); onMute(); }}
          style={[dmSwipeS.actionBtn, { backgroundColor: isMuted ? '#14B8A6' : '#F59E0B' }]}
        >
          <Ionicons name={isMuted ? 'notifications-outline' : 'notifications-off-outline'} size={18} color="#FFF" />
          <Text style={dmSwipeS.actionLabel}>{isMuted ? i18n.t('auto.room.id.122') : 'Sessiz'}</Text>
        </Pressable>
        {/* Engelle */}
        <Pressable
          onPress={() => { closeSwipe(); onBlock(); }}
          style={[dmSwipeS.actionBtn, { backgroundColor: '#7F1D1D' }]}
        >
          <Ionicons name="ban-outline" size={18} color="#FFF" />
          <Text style={dmSwipeS.actionLabel}>{i18n.t('rooms.block')}</Text>
        </Pressable>
      </Animated.View>
      {/* Ön plan — kaydırılabilir satır */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const dmSwipeS = StyleSheet.create({
  actionRow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DM_SWIPE_ACTION_W,
    flexDirection: 'row',
  },
  actionBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  actionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.2,
  },
});

// ════════════════════════════════════════════════════════════
// DM PANEL DRAWER — Sağdan kayan DM paneli (inbox + sohbet görünümü)
// ★ Swipe-to-action aksiyonlar: engelle, sil, sessize al
// ════════════════════════════════════════════════════════════
function DmPanelDrawer({ visible, onClose, dmInboxMessages, setDmInboxMessages, dmUnreadCount, firebaseUser, bottomInset, initialChatTarget }: {
  visible: boolean;
  onClose: () => void;
  dmInboxMessages: any[];
  setDmInboxMessages: React.Dispatch<React.SetStateAction<any[]>>;
  dmUnreadCount: number;
  firebaseUser: any;
  bottomInset: number;
  initialChatTarget?: { userId: string; name: string; avatar?: string } | null;
}) {
  const slideAnim = useRef(new Animated.Value(DM_PANEL_W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ★ İç navigasyon: inbox vs chat
  const [chatTarget, setChatTarget] = useState<{ userId: string; name: string; avatar?: string; online?: boolean } | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  // ★ v109: chat ekranı paritesi — Reply / Edit / Action menu / Saved / Typing
  const [dmActionMenuMsg, setDmActionMenuMsg] = useState<any | null>(null);
  const [dmReplyingTo, setDmReplyingTo] = useState<any | null>(null);
  const [dmEditingMessageId, setDmEditingMessageId] = useState<string | null>(null);
  const [dmSavedIds, setDmSavedIds] = useState<Set<string>>(new Set());
  const [dmIsTyping, setDmIsTyping] = useState(false);
  const dmTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ★ v109: Forward için kullanıcı seçici (global UserSearchSheet)
  const { openSearch: openDmUserSearch } = useUserSearchSheet();
  // ★ 2026-04-22: DM panel request status — main chat ile aynı accept/reject UI
  const [msgReq, setMsgReq] = useState<{ status: 'none' | 'pending_incoming' | 'pending_outgoing' | 'accepted' | 'rejected' }>({ status: 'none' });
  const [reqResponding, setReqResponding] = useState(false);

  // ★ v110.6 (6 May 2026): Klavye açıldığında panel boyutunu adjustResize-aware hesapla.
  //   Android adjustResize: window shrinks → panel bottom=0 yeter (parent altı = klavye üstü).
  //   iOS: keyboard overlay → bottom shift gerekli (screen-based).
  //   ESKİ SORUN: Her iki platformda da screen-based bottom=kbHeight → Android'de çift küçülme.
  //   Input bar klavyenin arkasına kalıyordu.
  const screenH = Dimensions.get('screen').height;
  const REST_BOTTOM = 120; // control bar + safe area
  const REST_TOP = 120;    // status bar + header alanı
  const restHeight = screenH - REST_BOTTOM - REST_TOP;
  const dmPanelBottomAnim = useRef(new Animated.Value(REST_BOTTOM)).current;
  const dmPanelHeightAnim = useRef(new Animated.Value(restHeight)).current;
  // ★ 2026-05-05 FIX: Bir DM kullanıcısı seçilip chat ekranı açılınca, önceki klavye state'i
  //   panel'i yanlış konumda gösteriyordu (input bar üst-orta'da kayma glitch'i). Geçişte
  //   panel pozisyonunu anında reset et — klavye event'i sonra normal animasyonu yapar.
  useEffect(() => {
    if (chatTarget) {
      const fullScreenH = Dimensions.get('screen').height;
      dmPanelBottomAnim.setValue(REST_BOTTOM);
      dmPanelHeightAnim.setValue(fullScreenH - REST_BOTTOM - REST_TOP);
    }
  }, [chatTarget?.userId]);
  // ★ v110.5.12 (6 May 2026): Klavye listener — DOĞRU formül.
  //   Eski yanlış: bottom=0, height=kbScreenY-44 → modal klavye altında kalıyordu.
  //   Yeni doğru: bottom=kbHeight (modal klavye ÜSTÜNE çık), height=screen-kbHeight-REST_TOP.
  //   Hem iOS hem Android için tek formül. Modal toplam alan korunur (üstte status bar boşluk).
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const fullScreenH = Dimensions.get('screen').height;
      // ★ v110.5.13: Klavye yüksekliği — Android'de .height bazen 0 dönüyor,
      //   fullScreenH - screenY daha güvenilir (klavyenin üst kenarı = ekran altından
      //   yukarıdaki mesafe). max ile ikisinden büyüğünü al.
      const reportedH = e.endCoordinates.height || 0;
      const calcH = fullScreenH - (e.endCoordinates.screenY || fullScreenH);
      const kbHeight = Math.max(reportedH, calcH, 0);
      // Modal alt kenarı = klavyenin üst kenarına yapışsın
      const newBottom = kbHeight;
      // Modal yüksekliği = ekran - klavye - üst margin (status bar + mini room header)
      const newHeight = Math.max(fullScreenH - kbHeight - REST_TOP, 240);
      // ★ v110.5.14: Animation INSTANT — keyboardDidShow Android'de klavye TAM açıldıktan
      //   sonra fire ediyor (~300ms+). Üzerine 200ms animation = 1.5sn hissi. Şimdi
      //   keyboardDidShow gelir gelmez modal anında yerine oturur (duration 0).
      dmPanelBottomAnim.setValue(newBottom);
      dmPanelHeightAnim.setValue(newHeight);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      const fullScreenH = Dimensions.get('screen').height;
      const rH = fullScreenH - REST_BOTTOM - REST_TOP;
      // Klavye kapanırken kısa animation (gözden hoş)
      Animated.parallel([
        Animated.timing(dmPanelBottomAnim, {
          toValue: REST_BOTTOM,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(dmPanelHeightAnim, {
          toValue: rH,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // ★ Swipe-to-dismiss — sağa sürükle
  const { translateValue: dmSwipeX, panHandlers: dmPanHandlers } = useSwipeToDismiss({
    direction: 'right',
    threshold: 60,
    onDismiss: onClose,
  });
  // ★ Sessize alınmış DM kullanıcıları (AsyncStorage ile kalıcı)
  const [mutedDmUsers, setMutedDmUsers] = useState<Set<string>>(new Set());

  // ★ Sessize alma verilerini AsyncStorage'dan yükle
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    AsyncStorage.getItem(`muted_dm_users_${firebaseUser.uid}`).then(stored => {
      if (stored) {
        try { setMutedDmUsers(new Set(JSON.parse(stored))); } catch {}
      }
    });
  }, [firebaseUser?.uid]);

  // ★ Sessize al / sesini aç toggle
  const toggleMuteDm = useCallback(async (userId: string) => {
    setMutedDmUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      // AsyncStorage'a kaydet
      if (firebaseUser?.uid) {
        AsyncStorage.setItem(`muted_dm_users_${firebaseUser.uid}`, JSON.stringify([...next])).catch(() => {});
      }
      return next;
    });
  }, [firebaseUser?.uid]);

  // ★ 2026-04-23: Internal mount — kapanış animasyonu bitince unmount (kesik önleme)
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // ★ 2026-04-23 double-drag fix: swipe offset'ini sıfırla ki önceki swipe pozisyonundan
      //   başlamasın (hook artık dismiss'te translateValue'u sıfırlamıyor, parent reset eder)
      dmSwipeX.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      if (firebaseUser?.uid) {
        MessageService.getInbox(firebaseUser.uid).then(msgs => setDmInboxMessages(msgs)).catch(() => {});
      }
    } else if (mounted) {
      Animated.parallel([
        // ★ slideAnim hedefi = DM_PANEL_W; swipe pozisyonu kompoze olarak eklenir
        // (Animated.add(slideAnim, dmSwipeX)) → tek pürüzsüz hareketle off-screen çıkar
        Animated.timing(slideAnim, { toValue: DM_PANEL_W, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
        setChatTarget(null); setChatMessages([]);
      });
    }
  }, [visible]);

  // ★ 2026-04-21: Oda içi DM panel inbox realtime güncellemesi.
  //   Önceden: Panel açıkken yeni mesaj gelirse liste güncellenmiyordu.
  //   ★ v86 FIX: Postgres_changes anon Realtime'da DM tablolarını alamıyor — DMNotifProvider
  //   broadcast event'lerine bağla.
  const dmNotif = useDMNotifOptional();
  useEffect(() => {
    if (!visible || !firebaseUser?.uid || !dmNotif) return;
    const refreshInbox = async () => {
      try {
        const msgs = await MessageService.getInbox(firebaseUser.uid);
        setDmInboxMessages(msgs);
      } catch {}
    };
    const unsub = dmNotif.onSignal((signal) => {
      if (signal.event === 'dm_new' || signal.event === 'dm_accepted' || signal.event === 'dm_rejected') {
        refreshInbox();
      }
    });
    return unsub;
  }, [visible, firebaseUser?.uid, dmNotif]);

  // ★ initialChatTarget ile panel açıldığında otomatik sohbet başlat
  useEffect(() => {
    if (visible && initialChatTarget && !chatTarget) {
      openChat(initialChatTarget.userId, initialChatTarget.name, initialChatTarget.avatar);
    }
  }, [visible, initialChatTarget]);

  // ★ v110.6 (6 May 2026): Sohbet görünümüne geçiş — WhatsApp/Instagram tarzı ANLIK gösterim.
  //   ESKİ: Sıralı await'ler (request → mesajlar → clearedMap) → spinner → flash/atlama.
  //   YENİ: Tüm fetch'ler Promise.all ile paralel, loadingChat spinner GÖSTERİLMEZ.
  //   FlatList her zaman render olur (boş data ile başlar, veri gelince dolur).
  //   3 mesaj bile olsa spinner gösterme — kullanıcı anında mesajları görmeli.
  const openChat = async (userId: string, name: string, avatar?: string) => {
    setChatTarget({ userId, name, avatar });
    setChatInput('');
    setChatMessages([]); // Boş başla — FlatList "Henüz mesaj yok" gösterir anlık, spinner yok
    setLoadingChat(false); // ★ Spinner ASLA gösterilmez — layout sabit kalır
    setMsgReq({ status: 'none' }); // Default safe state

    // ★ Tüm fetch'ler paralel — en yavaş olanın süresi kadar bekler (tipik <200ms)
    try {
      const [reqResult, msgResult, clearedMap] = await Promise.all([
        // 1. Message request durumu
        MessageService.getMessageRequest(firebaseUser.uid, userId).catch(() => null),
        // 2. Mesajlar
        supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${firebaseUser.uid},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${firebaseUser.uid})`)
          .not('is_deleted', 'is', true)
          .order('created_at', { ascending: false })
          .limit(50)
          .then(r => r.data || []),
        // 3. Cleared before map
        MessageService.getClearedBefore(firebaseUser.uid).catch(() => ({} as Record<string, string>)),
      ]);

      // ★ Message request durumu set et
      if (!reqResult) setMsgReq({ status: 'none' });
      else if (reqResult.status === 'accepted') setMsgReq({ status: 'accepted' });
      else if (reqResult.status === 'rejected') setMsgReq({ status: 'rejected' });
      else if (reqResult.status === 'pending') setMsgReq({ status: reqResult.receiver_id === firebaseUser.uid ? 'pending_incoming' : 'pending_outgoing' });

      // ★ Cleared before filter
      const clearedBefore = clearedMap[userId];
      let rows = msgResult;
      if (clearedBefore) {
        rows = rows.filter((m: any) => new Date(m.created_at) > new Date(clearedBefore));
      }

      const msgs = rows.map((m: any) => ({
        ...m,
        sender: {
          display_name: m.sender_id === firebaseUser.uid ? 'Sen' : name,
          avatar_url: m.sender_id === firebaseUser.uid ? '' : (avatar || ''),
        },
      }));
      setChatMessages(msgs);
      // Okundu işaretle (arka plan, UI'ı bloklamaz)
      MessageService.markAsRead(firebaseUser.uid, userId).catch(() => {});
    } catch {}
  };

  // ★ Mesaj gönder — takip kontrolü + engel kontrolü + reply + edit (v109)
  const handleSend = async () => {
    if (!chatInput.trim() || !chatTarget || chatSending) return;
    const text = chatInput.trim();

    // ★ v109: Edit modu — yeni mesaj göndermek yerine RPC ile düzenle
    if (dmEditingMessageId) {
      const r = await MessageService.editMessage(firebaseUser.uid, dmEditingMessageId, text);
      if (r.success) {
        setChatMessages((prev: any[]) => prev.map((m: any) => m.id === dmEditingMessageId
          ? { ...m, content: text, edited_at: r.edited_at || new Date().toISOString() } : m));
        setDmEditingMessageId(null);
        setChatInput('');
      } else {
        showToast({ title: i18n.t('room.id.007'), message: r.error || 'Tekrar dene.', type: 'error' });
      }
      return;
    }

    // ★ v109: Reply modu — sendReply ile reply_to_id yaz
    const replyId = dmReplyingTo?.id || null;
    setDmReplyingTo(null);
    setChatInput('');
    setChatSending(true);
    // Typing'i sustur
    if (firebaseUser && chatTarget) {
      MessageService.sendTypingStatus(firebaseUser.uid, chatTarget.userId, false);
      if (dmPublishTypingRef.current) clearTimeout(dmPublishTypingRef.current);
    }

    try {
      // ★ Engel kontrolü
      const isBlocked = await ModerationService.isBlocked(firebaseUser.uid, chatTarget.userId);
      if (isBlocked) {
        setChatSending(false);
        return;
      }
      const blockedByTarget = await ModerationService.isBlocked(chatTarget.userId, firebaseUser.uid);
      if (blockedByTarget) {
        setChatSending(false);
        return;
      }

      // ★ Takipleşme kontrolü — arkadaş değilse mesaj isteği olarak gönder
      // ★ 2026-04-27 FIX: friendships tablosu tek yönlü accepted satır = arkadaş (OR mantığı)
      let isMessageRequest = false;
      try {
        const { outgoing, incoming } = await FriendshipService.getDetailedStatus(firebaseUser.uid, chatTarget.userId);
        const isFriend = outgoing === 'accepted' || incoming === 'accepted';
        if (!isFriend) isMessageRequest = true;
      } catch {}

      // Optimistic: hemen ekle
      const optMsg = {
        id: `opt_${Date.now()}`,
        sender_id: firebaseUser.uid,
        receiver_id: chatTarget.userId,
        content: text,
        created_at: new Date().toISOString(),
        sender: { display_name: 'Sen', avatar_url: '' },
        reply_to_id: replyId,
        _isMessageRequest: isMessageRequest,
      };
      setChatMessages(prev => [optMsg, ...prev]);

      // ★ v109: replyId varsa sendReply
      if (replyId) {
        await MessageService.sendReply(firebaseUser.uid, chatTarget.userId, text, replyId);
      } else {
        await MessageService.send(firebaseUser.uid, chatTarget.userId, text, isMessageRequest);
      }
      // ★ 2026-04-22: Kullanıcı mesaj gönderdi → hidden entry temizle (inbox'a sohbet geri
      //   dönsün). cleared_before korunduğu için eski mesajlar yine gizli kalır.
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const key = `hidden_conversations_${firebaseUser.uid}`;
        const raw = await AsyncStorage.getItem(key);
        const map: Record<string, string> = raw ? JSON.parse(raw) : {};
        if (map[chatTarget.userId]) {
          delete map[chatTarget.userId];
          await AsyncStorage.setItem(key, JSON.stringify(map));
        }
      } catch {}
      // ★ FIX: İlk mesaj sonrası inbox'ı güncelle — yoksa panel kapatılıp açılınca mesaj kaybolur
      MessageService.getInbox(firebaseUser.uid).then(msgs => setDmInboxMessages(msgs)).catch(() => {});
      // ★ 2026-04-22: Mesaj request status güncelle (arkadaş değilse → pending_outgoing)
      if (isMessageRequest && msgReq.status === 'none') {
        setMsgReq({ status: 'pending_outgoing' });
      }
    } catch (err: any) {
      showToast({ title: i18n.t('room.id.008'), message: err?.message || i18n.t('auto.room.id.121'), type: 'warning' });
    }
    setChatSending(false);
  };

  // ★ v86 FIX: Postgres_changes anon Realtime'da çalışmıyor — DMNotifProvider broadcast'ı.
  //   Chat açıkken target user'dan dm_new gelince mesajları yeniden fetch et + okundu işaretle.
  useEffect(() => {
    if (!chatTarget || !firebaseUser || !dmNotif) return;
    const targetId = chatTarget.userId;
    const refreshChat = async () => {
      try {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${firebaseUser.uid},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${firebaseUser.uid})`)
          .not('is_deleted', 'is', true)
          .order('created_at', { ascending: false })
          .limit(50);
        const msgs = (data || []).map((m: any) => ({
          ...m,
          sender: {
            display_name: m.sender_id === firebaseUser.uid ? 'Sen' : chatTarget.name,
            avatar_url: m.sender_id === firebaseUser.uid ? '' : (chatTarget.avatar || ''),
          },
        }));
        setChatMessages(msgs);
        MessageService.markAsRead(firebaseUser.uid, targetId).catch(() => {});
        dmNotif.markRead(targetId);
      } catch {}
    };
    const unsub = dmNotif.onSignal((signal) => {
      if (signal.event === 'dm_new' && signal.sender_id === targetId) {
        refreshChat();
      } else if (signal.event === 'dm_accepted' && (signal.sender_id === targetId || signal.receiver_id === targetId)) {
        setMsgReq({ status: 'accepted' });
      } else if (signal.event === 'dm_rejected' && (signal.sender_id === targetId || signal.receiver_id === targetId)) {
        setMsgReq({ status: 'rejected' });
      }
    });
    // Chat açıldığında bu user için unread sıfırla
    dmNotif.markRead(targetId);
    return unsub;
  }, [chatTarget?.userId, firebaseUser?.uid, dmNotif]);

  // ★ v109: Typing indicator — karşı taraf yazıyor mu (chat target değişince listener)
  useEffect(() => {
    if (!chatTarget || !firebaseUser) return;
    const targetId = chatTarget.userId;
    const sub = MessageService.onTypingStatus(firebaseUser.uid, (payload) => {
      if (payload.user_id !== targetId) return;
      if (payload.is_typing) {
        setDmIsTyping(true);
        if (dmTypingTimerRef.current) clearTimeout(dmTypingTimerRef.current);
        dmTypingTimerRef.current = setTimeout(() => setDmIsTyping(false), 3000);
      } else {
        setDmIsTyping(false);
        if (dmTypingTimerRef.current) clearTimeout(dmTypingTimerRef.current);
      }
    });
    return () => {
      sub.unsubscribe();
      supabase.removeChannel(sub);
      if (dmTypingTimerRef.current) clearTimeout(dmTypingTimerRef.current);
    };
  }, [chatTarget?.userId, firebaseUser?.uid]);

  // ★ v109: Saved messages — chat açıldığında yüklenir
  useEffect(() => {
    if (!chatTarget || !firebaseUser?.uid) return;
    MessageService.getSavedMessageIds(firebaseUser.uid).then(setDmSavedIds).catch(() => {});
  }, [chatTarget?.userId, firebaseUser?.uid]);

  // ★ v109: Chat input typing publish — kullanıcı yazıyor mu broadcast
  const dmPublishTypingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDmInputChange = (text: string) => {
    setChatInput(text);
    if (!firebaseUser || !chatTarget) return;
    MessageService.sendTypingStatus(firebaseUser.uid, chatTarget.userId, text.length > 0);
    if (dmPublishTypingRef.current) clearTimeout(dmPublishTypingRef.current);
    if (text.length > 0) {
      dmPublishTypingRef.current = setTimeout(() => {
        MessageService.sendTypingStatus(firebaseUser.uid, chatTarget.userId, false);
      }, 2000);
    }
  };

  // ★ v109: Chat ekranı paritesi — action handlers
  const handleDmReply = useCallback((msg: any) => {
    setDmReplyingTo(msg);
    setDmEditingMessageId(null);
  }, []);

  const handleDmEdit = useCallback((msg: any) => {
    setDmEditingMessageId(msg.id);
    setDmReplyingTo(null);
    setChatInput(msg.content || '');
  }, []);

  const handleDmCancelCompose = useCallback(() => {
    setDmReplyingTo(null);
    if (dmEditingMessageId) {
      setDmEditingMessageId(null);
      setChatInput('');
    }
  }, [dmEditingMessageId]);

  const handleDmDeleteForEveryone = useCallback(async (msg: any) => {
    if (!firebaseUser) return;
    const r = await MessageService.deleteForEveryone(firebaseUser.uid, msg.id);
    if (r.success) {
      setChatMessages((prev: any[]) => prev.map((m: any) => m.id === msg.id
        ? { ...m, deleted_for_everyone: true, content: '', voice_url: null, image_url: null } : m));
    } else {
      showToast({ title: 'Silinemedi', message: r.error || 'Tekrar dene.', type: 'error' });
    }
  }, [firebaseUser]);

  const handleDmDeleteFromChat = useCallback(async (msg: any) => {
    if (!firebaseUser) return;
    try {
      await MessageService.deleteMessage(msg.id, firebaseUser.uid);
      setChatMessages((prev: any[]) => prev.map((m: any) => m.id === msg.id ? { ...m, is_deleted: true } : m));
    } catch {
      showToast({ title: 'Silinemedi', type: 'error' });
    }
  }, [firebaseUser]);

  const handleDmCopy = useCallback(async (msg: any) => {
    if (!msg.content) return;
    await Clipboard.setStringAsync(msg.content);
    showToast({ title: i18n.t('room.id.009'), type: 'success' });
  }, []);

  const handleDmSave = useCallback(async (msg: any) => {
    if (!firebaseUser) return;
    const wasSaved = dmSavedIds.has(msg.id);
    setDmSavedIds(prev => {
      const next = new Set(prev);
      if (wasSaved) next.delete(msg.id); else next.add(msg.id);
      return next;
    });
    await MessageService.toggleSavedMessage(firebaseUser.uid, msg.id);
    showToast({ title: wasSaved ? i18n.t('auto.room.id.120') : '🔖 Kaydedildi', type: 'success' });
  }, [firebaseUser, dmSavedIds]);

  // ★ v109: Forward — global user search sheet aç → seçilen kişiye forward RPC
  const handleDmForward = useCallback((msg: any) => {
    if (!firebaseUser) return;
    openDmUserSearch({
      mode: 'compose',
      onSelectUser: async (targetUserId: string) => {
        if (targetUserId === firebaseUser.uid) {
          showToast({ title: i18n.t('room.id.010'), message: i18n.t('room.id.011'), type: 'warning' });
          return;
        }
        const r = await MessageService.forwardMessage(firebaseUser.uid, msg.id, targetUserId);
        if (r.success) {
          showToast({ title: i18n.t('room.id.012'), type: 'success' });
        } else {
          showToast({ title: i18n.t('room.id.013'), message: r.error || 'Tekrar dene.', type: 'error' });
        }
      },
    });
  }, [firebaseUser, openDmUserSearch]);

  const handleDmReact = useCallback(async (msg: any, emoji: string) => {
    if (!firebaseUser) return;
    const existing: Record<string, string[]> = msg.reactions ? JSON.parse(msg.reactions) : {};
    const myId = firebaseUser.uid;
    if (existing[emoji]?.includes(myId)) {
      existing[emoji] = existing[emoji].filter((id: string) => id !== myId);
      if (existing[emoji].length === 0) delete existing[emoji];
    } else {
      if (!existing[emoji]) existing[emoji] = [];
      existing[emoji].push(myId);
    }
    const reactionsJson = JSON.stringify(existing);
    await MessageService.updateReaction(msg.id, reactionsJson, firebaseUser.uid);
    setChatMessages((prev: any[]) => prev.map((m: any) => m.id === msg.id ? { ...m, reactions: reactionsJson } : m));
  }, [firebaseUser]);

  // ★ Engelle aksiyonu
  const handleBlock = async (userId: string) => {
    try {
      await ModerationService.blockUser(firebaseUser.uid, userId);
      // ★ FIX: Inbox listesinden kaldır
      setDmInboxMessages(prev => prev.filter(m => {
        const pid = m.partner_id || m.other_user_id || m.sender_id;
        return pid !== userId;
      }));
      setChatTarget(null);
    } catch {}
  };

  // ★ Sohbeti sil aksiyonu
  const handleDeleteConversation = async (userId: string) => {
    try {
      await MessageService.markAsRead(firebaseUser.uid, userId);
      await MessageService.deleteConversation(firebaseUser.uid, userId);
      // ★ FIX: Inbox listesinden kaldır (UI anında güncellenir)
      setDmInboxMessages(prev => prev.filter(m => {
        const pid = m.partner_id || m.other_user_id || m.sender_id;
        return pid !== userId;
      }));
      setChatTarget(null);
    } catch {}
  };

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)', opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel — iki katmanlı yapı: native/JS driver çakışmasını önler.
          ★ Dış katman: bottom+height konumlandırma (JS driver, useNativeDriver:false)
          ★ 2026-04-30 FIX: top+bottom yerine bottom+height — adjustResize parent'ı
          küçültünce top+bottom çift küçülmeye yol açıyordu. height screen-based sabit.
          ★ İç katman: translateX slide animasyonu (native driver, useNativeDriver:true) */}
      <Animated.View style={{
        position: 'absolute', right: 0, bottom: dmPanelBottomAnim,
        height: dmPanelHeightAnim,
        width: DM_PANEL_W,
      }}>
      <Animated.View {...dmPanHandlers} style={{
        flex: 1,
        borderTopLeftRadius: 26, borderBottomLeftRadius: 26,
        overflow: 'hidden',
        backgroundColor: '#1a2030',
        shadowColor: '#000', shadowOffset: { width: -6, height: 0 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
        transform: [{ translateX: Animated.add(slideAnim, dmSwipeX) }],
      }}>
        {/* ★ 2026-05-05: NotificationDrawer dili (bildirim modalı ailesi) — 3 katman gradient.
            Karakter: teal (iletişim/DM). Slate diagonal + üst halo + soft glow. */}
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(20,184,166,0.20)', 'rgba(20,184,166,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(20,184,166,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* ═══ SOHBET GÖRÜNÜMÜ ═══ */}
        {chatTarget ? (
          <View style={{ flex: 1 }}>
            {/* Chat Header — NotificationDrawer dili (bildirim modalı ailesi) */}
            <View collapsable={false} style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12,
            }}>
              <Pressable onPress={() => setChatTarget(null)} hitSlop={12} style={{
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="arrow-back" size={15} color="#F1F5F9" />
              </Pressable>
              <View style={{ position: 'relative' }}>
                <Image source={getAvatarSource(chatTarget.avatar)} style={{
                  width: 32, height: 32, borderRadius: 16,
                  borderWidth: 1, borderColor: 'rgba(20,184,166,0.4)',
                }} />
                {/* ★ v109: Online dot — yeşil göstergeç */}
                {chatTarget.online ? (
                  <View style={{
                    position: 'absolute', bottom: -1, right: -1,
                    width: 10, height: 10, borderRadius: 5,
                    backgroundColor: '#22C55E',
                    borderWidth: 1.5, borderColor: '#1a2030',
                  }} />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: '#F1F5F9', fontSize: 15, fontWeight: '800', letterSpacing: 0.3,
                  textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
                }} numberOfLines={1}>
                  {chatTarget.name}
                </Text>
                {/* ★ v109: Yazıyor / Çevrimiçi durumu */}
                {dmIsTyping ? (
                  <Text style={{ color: '#14B8A6', fontSize: 10, fontWeight: '600', fontStyle: 'italic' }}>{i18n.t('room.id.001')}</Text>
                ) : chatTarget.online ? (
                  <Text style={{ color: 'rgba(34,197,94,0.85)', fontSize: 10, fontWeight: '600' }}>{i18n.t('room.id.002')}</Text>
                ) : null}
              </View>
              {/* ★ Sessize alma badge — chat header'da */}
              {mutedDmUsers.has(chatTarget.userId) && (
                <Ionicons name="notifications-off" size={14} color="rgba(245,158,11,0.5)" style={{ marginRight: 4 }} />
              )}
            </View>
            {/* ★ 2026-05-05: NotificationDrawer dili — header separator */}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 12 }} />

            {/* ★ 2026-04-22: Message request banner — DM panel içinde accept/reject */}
            {msgReq.status === 'pending_incoming' && (
              <View style={{ backgroundColor: 'rgba(59,130,246,0.08)', borderBottomWidth: 1, borderBottomColor: 'rgba(59,130,246,0.2)', padding: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#E2E8F0', marginBottom: 4 }}>
                  {chatTarget.name} sizinle mesajlaşmak istiyor
                </Text>
                <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8, lineHeight: 15 }}>{i18n.t('room.id.003')}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable disabled={reqResponding} onPress={async () => {
                    if (reqResponding) return;
                    setReqResponding(true);
                    try {
                      await MessageService.acceptMessageRequest(firebaseUser.uid, chatTarget.userId);
                      setMsgReq({ status: 'accepted' });
                    } catch {} finally { setReqResponding(false); }
                  }} style={({ pressed }) => [{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#14B8A6' }, (pressed || reqResponding) && { opacity: 0.6 }]}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFF' }}>{i18n.t('common.accept')}</Text>
                  </Pressable>
                  <Pressable disabled={reqResponding} onPress={async () => {
                    if (reqResponding) return;
                    setReqResponding(true);
                    try {
                      await MessageService.rejectMessageRequest(firebaseUser.uid, chatTarget.userId);
                      setMsgReq({ status: 'rejected' });
                      setChatTarget(null);
                    } catch {} finally { setReqResponding(false); }
                  }} style={({ pressed }) => [{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' }, (pressed || reqResponding) && { opacity: 0.6 }]}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#F87171' }}>{i18n.t('common.reject')}</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {msgReq.status === 'pending_outgoing' && (
              <View style={{ backgroundColor: 'rgba(251,191,36,0.08)', borderBottomWidth: 1, borderBottomColor: 'rgba(251,191,36,0.2)', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="time-outline" size={14} color="#FBBF24" />
                <Text style={{ fontSize: 11, color: '#FBBF24', flex: 1 }}>{i18n.t('room.id.004')}</Text>
              </View>
            )}
            {msgReq.status === 'rejected' && (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderBottomWidth: 1, borderBottomColor: 'rgba(239,68,68,0.2)', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="close-circle-outline" size={14} color="#F87171" />
                <Text style={{ fontSize: 11, color: '#FCA5A5', flex: 1 }}>{i18n.t('room.id.005')}</Text>
              </View>
            )}

            {/* Mesaj Listesi — inverted
                ★ v110.6 (6 May 2026): Spinner/AppLoader KALDIRILDI — FlatList HER ZAMAN render olur.
                Mesaj olmayınca "Henüz mesaj yok" boş state gösterir (ListEmptyComponent).
                Bu sayede flex layout SABIT kalır, input bar asla yukarı atlamaz.
                WhatsApp/Instagram gibi: mesajlar anında render olur, loading hissi yok. */}
              <FlatList
                data={chatMessages}
                keyExtractor={(item, i) => item.id || `msg_${i}`}
                inverted
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 10, gap: 4, flexGrow: 1 }}
                initialNumToRender={15}
                windowSize={7}
                maxToRenderPerBatch={10}
                removeClippedSubviews
                renderItem={({ item }) => {
                  const isMine = item.sender_id === firebaseUser?.uid;
                  const isDeletedForEveryone = !!item.deleted_for_everyone;
                  const isDeleted = !!item.is_deleted;
                  // ★ v109: "Sohbetten Sil" — kendi tarafımda gizle (mesajın kendisi DB'de kalır)
                  if (isDeleted && isMine) return null;
                  const isEdited = !!item.edited_at;
                  const isForwarded = !!item.forwarded_from_id;
                  const isTemp = (item.id || '').startsWith('opt_');
                  const replyTo = item.reply_to_id ? chatMessages.find((m: any) => m.id === item.reply_to_id) : null;
                  // ★ v109: Reactions parse
                  const reactions: Record<string, string[]> = item.reactions ? (() => {
                    try { return JSON.parse(item.reactions); } catch { return {}; }
                  })() : {};
                  const reactionEntries = Object.entries(reactions);
                  return (
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: isMine ? 'flex-end' : 'flex-start',
                      gap: 6, marginVertical: 1,
                    }}>
                      {/* ★ Avatar — sadece karşı taraf (kendi mesajlarımda gizli) */}
                      {!isMine ? (
                        <Image
                          source={getAvatarSource(chatTarget?.avatar)}
                          style={{ width: 34, height: 34, borderRadius: 17, marginTop: 4 }}
                        />
                      ) : null}
                      <View style={{ alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                      <Pressable
                        onLongPress={() => {
                          if (isTemp || isDeletedForEveryone || item.is_deleted) return;
                          setDmActionMenuMsg(item);
                        }}
                        delayLongPress={400}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 10,
                          borderRadius: 16,
                          borderBottomRightRadius: isMine ? 4 : 16,
                          borderBottomLeftRadius: isMine ? 16 : 4,
                          // ★ 2026-05-05: Karşı tarafa solid bg — yarı-saydam bg + elevation
                          //   Android'de gölge artefaktı yaratıyordu (siyah karış reaction pill arkası).
                          //   Solid #37414f slate balonun arkasını opaklaştırır, elevation temiz görünür.
                          backgroundColor: isMine ? '#14B8A6' : '#37414f',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.28,
                          shadowRadius: 6,
                          elevation: 4,
                        }}
                      >
                        {/* Forwarded rozeti */}
                        {isForwarded && !isDeletedForEveryone ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                            <Ionicons name="arrow-redo" size={10} color="rgba(255,255,255,0.5)" />
                            <Text style={{ fontSize: 10, fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' }}>{i18n.t('room.id.006')}</Text>
                          </View>
                        ) : null}
                        {/* Reply preview */}
                        {replyTo ? (
                          <View style={{
                            flexDirection: 'row', gap: 6, marginBottom: 4,
                            paddingVertical: 4, paddingRight: 6, paddingLeft: 0,
                            backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 6, overflow: 'hidden',
                          }}>
                            <View style={{ width: 2, backgroundColor: '#14B8A6' }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#5EEAD4', fontSize: 10, fontWeight: '700' }} numberOfLines={1}>
                                {replyTo.sender_id === firebaseUser?.uid ? 'Kendine' : (chatTarget?.name || i18n.t('auto.room.id.119'))}
                              </Text>
                              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }} numberOfLines={1}>
                                {replyTo.deleted_for_everyone ? '🚫 Bu mesaj silindi'
                                  : replyTo.voice_url ? '🎙️ Sesli mesaj'
                                  : replyTo.image_url ? i18n.t('auto.room.id.118')
                                  : (replyTo.content || '...')}
                              </Text>
                            </View>
                          </View>
                        ) : null}
                        {/* İçerik */}
                        {isDeletedForEveryone ? (
                          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontStyle: 'italic' }}>
                            🚫 Bu mesaj silindi
                          </Text>
                        ) : (() => {
                          // ★ v319.5 (18 May 2026): DM mesajında image_url veya content-içi
                          //   image URL (📷 prefix / image uzantılı / supabase storage URL) varsa
                          //   Image render et, link metni gösterme. chat/[id].tsx ile aynı pattern.
                          const c = (item.content || '').trim();
                          let detected: string | null = null;
                          if (!item.voice_url && c) {
                            const cam = c.match(/^📷\s+(https?:\/\/\S+)$/);
                            if (cam) detected = cam[1];
                            else if (/^https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|heic)(?:\?\S*)?$/i.test(c)) detected = c;
                            else if (/^https?:\/\/[\w-]+\.supabase\.co\/storage\/v1\/object\/public\/(?:post-images|avatars)\/\S+$/i.test(c)) detected = c;
                          }
                          const imgUri = item.image_url || detected;
                          if (imgUri) {
                            return (
                              <Image
                                source={{ uri: imgUri }}
                                style={{ width: 220, height: 220, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.25)' }}
                                resizeMode="cover"
                              />
                            );
                          }
                          return (
                            <>
                              <LinkifiedText
                                text={item.content || ''}
                                style={{
                                  color: '#F1F5F9', fontSize: 14, lineHeight: 20,
                                  textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
                                }}
                              />
                              {item.content ? <LinkPreviewCard text={item.content} isMe={isMine} /> : null}
                            </>
                          );
                        })()}
                        {/* Edited */}
                        {isEdited && !isDeletedForEveryone ? (
                          <Text style={{
                            color: 'rgba(255,255,255,0.4)', fontSize: 9, fontStyle: 'italic',
                            alignSelf: 'flex-end', marginTop: 1,
                          }}>{i18n.t('room.id.001')}</Text>
                        ) : null}
                        {/* Time + read receipts — chat/[id].tsx dili */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 3 }}>
                          <Text style={{
                            color: isMine ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)',
                            fontSize: 9,
                            textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
                          }}>
                            {new Date(item.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          {isMine && !isDeletedForEveryone ? (
                            isTemp ? (
                              <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.55)" />
                            ) : item.is_read ? (
                              <View style={{ flexDirection: 'row' }}>
                                <Ionicons name="checkmark" size={12} color="#FFFFFF" style={{ marginRight: -5 }} />
                                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                              </View>
                            ) : (
                              <Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.7)" />
                            )
                          ) : null}
                        </View>
                      </Pressable>
                      {/* ★ Reactions pill — bubble altında, hizalama parent View'a göre */}
                      {reactionEntries.length > 0 ? (
                        <View style={{
                          flexDirection: 'row', gap: 3,
                          backgroundColor: 'rgba(15,23,41,0.95)',
                          borderRadius: 100, paddingHorizontal: 6, paddingVertical: 2,
                          borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
                          marginTop: -6, marginHorizontal: 6,
                        }}>
                          {reactionEntries.slice(0, 3).map(([emoji, users]: any) => (
                            <Text key={emoji} style={{ fontSize: 11, color: '#F1F5F9' }}>
                              {emoji}{users.length > 1 ? ` ${users.length}` : ''}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                      </View>
                    </View>
                  );
                }}
                ListHeaderComponent={
                  // ★ v109: Typing 3 nokta bubble — inverted FlatList'te en altta görünür
                  dmIsTyping ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 4 }}>
                      <Image
                        source={getAvatarSource(chatTarget?.avatar)}
                        style={{ width: 24, height: 24, borderRadius: 12 }}
                      />
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 3,
                        paddingHorizontal: 10, paddingVertical: 7,
                        borderRadius: 14,
                        backgroundColor: 'rgba(20,184,166,0.20)',
                        borderWidth: 0.5, borderColor: 'rgba(20,184,166,0.35)',
                      }}>
                        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFFFFF', opacity: 0.7 }} />
                        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFFFFF', opacity: 0.85 }} />
                        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFFFFF' }} />
                      </View>
                    </View>
                  ) : null
                }
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, paddingVertical: 40 }}>
                    <Ionicons name="chatbubble-outline" size={24} color="rgba(255,255,255,0.1)" />
                    <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 8 }}>{i18n.t('rooms.chat_empty')}</Text>
                  </View>
                }
              />

            {/* Input Bar */}
            <View style={{
              flexDirection: 'column', alignItems: 'stretch', gap: 0,
              paddingHorizontal: 10, paddingVertical: 8,
              borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
              backgroundColor: 'rgba(30,40,50,0.5)',
            }}>
              {/* ★ v109: Compose banner — reply ya da edit modunda göster */}
              {(dmReplyingTo || dmEditingMessageId) ? (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingHorizontal: 10, paddingVertical: 6,
                  marginBottom: 6, borderRadius: 10,
                  backgroundColor: 'rgba(20,184,166,0.10)',
                  borderWidth: 0.5, borderColor: 'rgba(20,184,166,0.25)',
                }}>
                  <View style={{ width: 2, alignSelf: 'stretch', borderRadius: 1, backgroundColor: '#14B8A6' }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#14B8A6', fontSize: 10, fontWeight: '800' }}>
                      {dmEditingMessageId ? i18n.t('auto.room.id.117')
                        : `↩︎ Yanıt: ${dmReplyingTo?.sender_id === firebaseUser?.uid ? 'Kendine' : (chatTarget?.name || i18n.t('auto.room.id.116'))}`}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }} numberOfLines={1}>
                      {dmEditingMessageId
                        ? i18n.t('auto.room.id.115')
                        : (dmReplyingTo?.voice_url ? '🎙️ Sesli mesaj'
                           : dmReplyingTo?.image_url ? i18n.t('auto.room.id.114')
                           : (dmReplyingTo?.content || '...'))}
                    </Text>
                  </View>
                  <Pressable onPress={handleDmCancelCompose} hitSlop={8} style={{
                    width: 24, height: 24, borderRadius: 12,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                  }}>
                    <Ionicons name="close" size={14} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                style={{
                  flex: 1, height: 36, borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                  paddingHorizontal: 14, fontSize: 13, color: '#F1F5F9',
                }}
                placeholder={dmEditingMessageId ? i18n.t('auto.room.id.113') : 'Mesaj yaz...'}
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={chatInput}
                onChangeText={handleDmInputChange}
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
              <Pressable
                onPress={handleSend}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: chatInput.trim() ? 'rgba(20,184,166,0.3)' : 'rgba(255,255,255,0.04)',
                  alignItems: 'center', justifyContent: 'center',
                }}
                disabled={!chatInput.trim() || chatSending}
              >
                <Ionicons
                  name={dmEditingMessageId ? 'checkmark' : 'send'}
                  size={16}
                  color={chatInput.trim() ? '#14B8A6' : 'rgba(255,255,255,0.15)'}
                />
              </Pressable>
              </View>
            </View>
          </View>
        ) : (
          /* ═══ İNBOX GÖRÜNÜMÜ ═══ */
          <>
            {/* Header — NotificationDrawer dili (bildirim modalı ailesi) */}
            <View collapsable={false} style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12,
            }}>
              <Ionicons
                name="chatbubbles"
                size={18}
                color="#14B8A6"
                style={{ textShadowColor: 'rgba(20,184,166,0.7)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 5 }}
              />
              <Text style={{
                color: '#F1F5F9', fontSize: 15, fontWeight: '800', flex: 1, letterSpacing: 0.3,
                textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
              }}>{i18n.t('rooms.chat_title')}</Text>
              {dmUnreadCount > 0 && (
                <View style={{
                  paddingHorizontal: 7, paddingVertical: 2,
                  borderRadius: 100, minWidth: 20, alignItems: 'center',
                  backgroundColor: 'rgba(20,184,166,0.18)',
                  borderWidth: 1, borderColor: 'rgba(20,184,166,0.45)',
                }}>
                  <Text style={{ color: '#5EEAD4', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 }}>{dmUnreadCount > 99 ? '99+' : dmUnreadCount}</Text>
                </View>
              )}
            </View>
            {/* Header separator */}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 12 }} />

            {/* Mesaj listesi — ★ Swipe-to-action ile */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 8, gap: 2 }}>
              {dmInboxMessages.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <View style={{
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: 'rgba(20,184,166,0.08)', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 10,
                  }}>
                    <Ionicons name="chatbubbles-outline" size={24} color="rgba(20,184,166,0.3)" />
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '600' }}>{i18n.t('rooms.chat_empty')}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, marginTop: 4 }}>{i18n.t('rooms.chat_hint')}</Text>
                </View>
              ) : (
                dmInboxMessages.slice(0, 15).map((msg: any, idx: number) => {
                  const senderName = msg.partner_name || msg.sender_display_name || msg.other_display_name || (msg.partner_id || msg.sender_id ? `…${String(msg.partner_id || msg.sender_id).slice(0, 4)}` : i18n.t('auto.room.id.112'));
                  const senderAvatar = msg.partner_avatar || msg.sender_avatar_url || msg.other_avatar_url;
                  const preview = msg.last_message_content || msg.last_message || msg.content || '';
                  const isUnread = (msg.unread_count || 0) > 0 || !msg.is_read;
                  const senderId = msg.partner_id || msg.other_user_id || msg.sender_id;
                  const timeAgo = msg.last_message_time || msg.last_message_at || msg.created_at;
                  const mins = timeAgo ? Math.floor((Date.now() - new Date(timeAgo).getTime()) / 60000) : 0;
                  const timeLabel = mins < 1 ? i18n.t('auto.room.id.111') : mins < 60 ? `${mins}dk` : mins < 1440 ? `${Math.floor(mins / 60)}sa` : `${Math.floor(mins / 1440)}g`;
                  const isMutedUser = mutedDmUsers.has(senderId);
                  return (
                    <DmSwipeableRow
                      key={`dm_${idx}`}
                      isMuted={isMutedUser}
                      onDelete={() => handleDeleteConversation(senderId)}
                      onMute={() => toggleMuteDm(senderId)}
                      onBlock={() => handleBlock(senderId)}
                    >
                      <Pressable
                        onPress={() => openChat(senderId, senderName, senderAvatar)}
                        style={({ pressed }) => ({
                          flexDirection: 'row', alignItems: 'center', gap: 12,
                          paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14,
                          backgroundColor: pressed ? 'rgba(20,184,166,0.08)' : isUnread ? 'rgba(20,184,166,0.04)' : 'rgba(30,40,50,0.95)',
                        })}
                      >
                        <View style={{ position: 'relative' }}>
                          <Image source={getAvatarSource(senderAvatar)} style={{
                            width: 40, height: 40, borderRadius: 20,
                            borderWidth: 1.5, borderColor: isUnread ? 'rgba(20,184,166,0.4)' : 'rgba(255,255,255,0.08)',
                          }} />
                          {msg.partner_is_online && (
                            <View style={{
                              position: 'absolute', bottom: 0, right: 0,
                              width: 11, height: 11, borderRadius: 6,
                              backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#2D3740',
                            }} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '70%' }}>
                              <Text style={{
                                color: isUnread ? '#F1F5F9' : 'rgba(255,255,255,0.6)',
                                fontSize: 13, fontWeight: isUnread ? '700' : '500',
                              }} numberOfLines={1}>{senderName}</Text>
                              {/* ★ Sessize alma ikonu — ismin yanında */}
                              {isMutedUser && (
                                <Ionicons name="notifications-off" size={11} color="rgba(245,158,11,0.5)" />
                              )}
                            </View>
                            <Text style={{ color: isUnread ? 'rgba(20,184,166,0.6)' : 'rgba(255,255,255,0.15)', fontSize: 10, fontWeight: '500' }}>{timeLabel}</Text>
                          </View>
                          <Text style={{
                            color: isUnread ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)',
                            fontSize: 11, marginTop: 2, fontWeight: isUnread ? '500' : '400',
                          }} numberOfLines={1}>{preview}</Text>
                        </View>
                        {isUnread && (msg.unread_count || 0) > 0 && (
                          <View style={{
                            minWidth: 18, height: 18, borderRadius: 9,
                            backgroundColor: '#14B8A6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
                          }}>
                            <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800' }}>{msg.unread_count > 9 ? '9+' : msg.unread_count}</Text>
                          </View>
                        )}
                      </Pressable>
                    </DmSwipeableRow>
                  );
                })
              )}
            </ScrollView>
          </>
        )}
        {/* ★ v109: Mesaj aksiyon menüsü — embedded mod, sadece DmPanel içinde
             (sağ panel scope'unda) açılır. Backdrop oda görünümünü kapatmaz. */}
        <MessageActionMenu
          embedded
          visible={!!dmActionMenuMsg}
          message={dmActionMenuMsg}
          isMe={!!dmActionMenuMsg && dmActionMenuMsg.sender_id === firebaseUser?.uid}
          onClose={() => setDmActionMenuMsg(null)}
          isSaved={dmActionMenuMsg ? dmSavedIds.has(dmActionMenuMsg.id) : false}
          onReply={handleDmReply}
          onForward={handleDmForward}
          onCopy={handleDmCopy}
          onSave={handleDmSave}
          onEdit={handleDmEdit}
          onDeleteForEveryone={handleDmDeleteForEveryone}
          onDeleteFromChat={handleDmDeleteFromChat}
          onReact={handleDmReact}
        />
      </Animated.View>
      </Animated.View>
    </View>
  );
}

/*
   ANA EKRAN
    */
export default function RoomScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  // ★ v284 (16 May 2026): Web admin → DB → realtime → buradaki tüm görsel ayarlar.
  //   roomLayout.global.bg* renk/arkaplan; header.* başlık; controls.* alt bar.
  //   sub-component'ler de aynı hook'u çağırır (singleton cache).
  const roomLayout = useRoomLayout();
  const insets = useSafeAreaInsets();
  const { id, justCreated, caption } = useLocalSearchParams<{ id: string; justCreated?: string; caption?: string }>();
  const { firebaseUser, profile, setMinimizedRoom, minimizedRoom, showNotifDrawer, setShowNotifDrawer, setNotifDrawerAnchorRight, setNotifDrawerRight, setNotifDrawerTop } = useAuth();
  // ★ 2026-05-05: Oda yeni oluşturulduysa içeride success overlay göster (checked.json + caption).
  //   create-room?justCreated=1&caption=... ile yönlendiriliyor; overlay tüketince temizlenir.
  const [showJustCreated, setShowJustCreated] = useState(justCreated === '1');
  const { unreadNotifs } = useBadges();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  // ★ v107.30: Sahne ↔ dinleyici geçişlerinde akıcı LayoutAnimation (kullanıcı talebi)
  //   Eski "flash" davranışı yerine yumuşak spring transition. Android'de UIManager
  //   experimental flag aktif edilir. Role veya speaker count değişiminde tetiklenir.
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      try { UIManager.setLayoutAnimationEnabledExperimental(true); } catch {}
    }
  }, []);
  // Role + count signature — değişince configureNext bir sonraki render için animasyon hazırlar
  const roleSignature = useMemo(
    () => participants.map(p => `${p.user_id}:${p.role}`).sort().join('|'),
    [participants]
  );
  // ★ v107.38: LayoutAnimation KALDIRILDI — RN translate property'i desteklemiyor,
  //   "kayma" efekti için Reanimated `Layout.springify()` lazım (büyük refactor).
  //   ScaleXY veya opacity kullanıcının istemediği fade/patlama. Şimdilik instant geçiş.
  //   Kayma için Reanimated migration post-launch.
  // useEffect(() => { ... LayoutAnimation.configureNext ... }, [roleSignature]);
  // ★ 2026-04-24: Minimize'dan dönüşte loading false ile başlar — oda zaten açık,
  //   yükleniyor ekranı gösterilmez. Data arka planda güncellenir.
  const [loading, setLoading] = useState(() => !(minimizedRoom?.id === id));
  
  // UX States
  const [chatMessages, setChatMessages] = useState<RoomMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const [selectedUser, setSelectedUser] = useState<RoomParticipant | null>(null);
  // ★ 2026-04-21: Clubhouse-tarzı in-room profile overlay — odadan çıkmadan profil görüntüle
  const [inRoomProfileId, setInRoomProfileId] = useState<string | null>(null);
  // ★ 2026-04-20: Kamera fullscreen için seçili kullanıcı (rozete tap ile set edilir)
  const [cameraExpandUser, setCameraExpandUser] = useState<RoomParticipant | null>(null);
  const [entryEffectData, setEntryEffectData] = useState<{ effectId: string; userName: string } | null>(null);
  // Mic permission system (local)
  const [micRequests, setMicRequests] = useState<string[]>([]); // user_id'ler
  const [showMicRequests, setShowMicRequests] = useState(false);
  const [myMicRequested, setMyMicRequested] = useState(false);
  // ★ 2026-04-21: Oda boost sheet (premium görünüm — basit Alert yerine)
  const [showRoomBoostSheet, setShowRoomBoostSheet] = useState(false);
  const [approvedSpeakers, setApprovedSpeakers] = useState<string[]>([]);
  const [roomMuted, setRoomMuted] = useState(false);


  const [showAudienceDrawer, setShowAudienceDrawer] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  // ★ v107: Hediye paneli — kontrol barındaki 🎁 butonu açar
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  // ★ v107: Premium mesaj parlat stilleri — kullanıcının envanteri (cosmetic_items.message_art ürünleri)
  const [ownedPremiumGlowIds, setOwnedPremiumGlowIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    let cancelled = false;
    StoreService.getUserInventory(firebaseUser.uid).then((inv) => {
      if (cancelled) return;
      const owned = new Set<string>();
      for (const id of PREMIUM_GLOW_IDS) {
        if (inv.has(id)) owned.add(id);
      }
      setOwnedPremiumGlowIds(owned);
    });
    return () => { cancelled = true; };
  }, [firebaseUser?.uid]);
  // ★ 2026-04-26: Oda kapalı/erişim engelli durumda full-screen ekran. Reason + opsiyonel
  //   dinamik mesaj birlikte tek state'te tutulur — iki ayrı setter race condition açıyordu.
  //   additionalReasons: birden fazla hard-block varsa (örn yaş + arkadaş) bullet liste için.
  const [roomBlock, setRoomBlock] = useState<{
    reason: RoomClosedReason;
    message?: string;
    additionalReasons?: { reason: RoomClosedReason; message?: string }[];
  } | null>(null);
  // ★ 2026-04-26: Davetli oda onay sheet'i
  const [showInviteConfirm, setShowInviteConfirm] = useState(false);
  const [invitePending, setInvitePending] = useState(false);
  // ★ 2026-04-27: Pre-check özet sheet — filtreli odaya girmeden önce şartları topu göster.
  //   Promise resolve callback'leri ile mevcut Promise.all access flow'a entegre.
  const [entryPreview, setEntryPreview] = useState<{
    filters: EntryPreviewFilter[];
    onContinue: () => void;
    onCancel: () => void;
  } | null>(null);
  // ★ 2026-04-26: Chat drawer kapalıyken yeni mesajlarda alt bar mesaj butonuna kırmızı badge.
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const showChatDrawerRef = useRef(showChatDrawer);
  useEffect(() => { showChatDrawerRef.current = showChatDrawer; }, [showChatDrawer]);
  const [showSettings, setShowSettings] = useState(false);
  const [micMode, setMicMode] = useState<MicMode>('normal');
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('front');
  const [noiseCancellation, setNoiseCancellation] = useState(true);
  const [useSpeaker, setUseSpeaker] = useState(true);
  const [alertConfig, setAlertConfig] = useState<{ visible: boolean; title: string; message: string; type?: AlertType; buttons?: AlertButton[]; icon?: string }>({ visible: false, title: '', message: '' });
  const floatingRef = useRef<FloatingReactionsRef>(null);
  const voiceReactionOverlayRef = useRef<VoiceReactionOverlayHandle>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  // ★ v92 (1 May 2026): Power-Ups sheet — sarf güçlendiriciler (Süre Uzat, Altın Davet)
  const [showPowerUps, setShowPowerUps] = useState(false);
  // ★ v92.11: Oda takipçileri liste sheet'i — host görür
  const [showFollowersSheet, setShowFollowersSheet] = useState(false);
  // ★ v92.12 (1 May 2026): Bekleyen oda erişim talebi sayısı — host/mod görür.
  //   Tab bar + butonunda badge olarak gösterilir; toast/zil yerine PlusMenu accordion.
  const [pendingAccessCount, setPendingAccessCount] = useState(0);
  // ★ v92.10: Top contributor pill tap → universal profile sheet
  const { openUserProfile } = useUserProfileSheet();
  // ★ v92.10 (1 May 2026): Bu odadaki "En Cömert" top contributor — header altı pill.
  //   topContributorTrigger artırılınca refetch (bağış sonrası canlı güncelleme).
  const [topContributor, setTopContributor] = useState<{ user_id: string; display_name: string; avatar_url: string; total_sp: number } | null>(null);
  const [topContributorTrigger, setTopContributorTrigger] = useState(0);
  const [showAccessPanel, setShowAccessPanel] = useState(false);
  const [showDonationDrawer, setShowDonationDrawer] = useState(false);
  // ★ v107.7: Giriş ücreti onay kartı — Promise-based, processEntryFee imzası dokunulmadı
  //   Bakiye yeterse açılır; kullanıcı "Öde + Gir" → resolver(true), "Vazgeç" → resolver(false) + safeGoBack
  const [entryFeeRequest, setEntryFeeRequest] = useState<{
    visible: boolean;
    fee: number;
    balance: number;
    roomName: string;
    hostName?: string;
    hostAvatar?: string | null;
    resolver: (ok: boolean) => void;
  } | null>(null);
  // ★ v107: GiftSheet'e taşınan room-içi tip sheet — username/tier opsiyonel ek alanlar
  const [tipSheetTarget, setTipSheetTarget] = useState<{ userId: string; displayName: string; avatarUrl?: string; username?: string; tier?: string | null } | null>(null);
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isFollowingRoom, setIsFollowingRoom] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followers, setFollowers] = useState<{ id: string; display_name: string; avatar_url: string }[]>([]);


  // ★ Şifre Modal — closed (şifreli) odalar için
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [pendingRoomData, setPendingRoomData] = useState<{ room: Room; participants: RoomParticipant[] } | null>(null);
  const [accessPending, setAccessPending] = useState(false);
  // ★ Davetli oda erişim isteği bottom-sheet (realtime onay/red)
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  // ★ 2026-04-18: Access gate — onaylanmadan oda içi render edilmez
  // null: henüz bilinmiyor (loading), true: erişim tam, false: engellendi (sheet/alert aktif)
  // ★ 2026-04-20: Minimize'dan dönüş → access check skip (kullanıcı zaten odada)
  const isRestoringFromMinimize = minimizedRoom?.id === id;
  const [accessGranted, setAccessGranted] = useState<boolean | null>(
    () => (isRestoringFromMinimize ? true : null),
  );

  // ★ Minimize'dan döndüysek MiniRoomCard'ı temizle (tam oda açıldı)
  useEffect(() => {
    if (isRestoringFromMinimize) setMinimizedRoom(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ★ Kullanıcıların takip durumu (oda içi ProfileCard için)
  const [userFollowStatus, setUserFollowStatus] = useState<Record<string, 'pending' | 'accepted' | 'blocked' | null>>({});

  // ★ ARCH-1: DM hook — inline DM state/logic kaldırıldı
  const {
    dmUnreadCount, dmInboxMessages, setDmInboxMessages,
    dmTarget, setDmTarget, dmText, setDmText, dmSending,
    showDmPanel, setShowDmPanel,
    handleSendDm, toggleDmPanel,
  } = useRoomDM({ firebaseUser });

  // ★ DM panel için başlangıç hedefi (ProfileCard → DM butonu)
  const [dmInitialTarget, setDmInitialTarget] = useState<{ userId: string; name: string; avatar?: string } | null>(null);

  // ★ ODA KAPANMA GERİ SAYIMI — Host+Mod yoksa 60sn sonra kapanır
  const [closingCountdown, setClosingCountdown] = useState<number | null>(null);
  const closingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ★ Kişisel susturma (lokal) — sadece bu kullanıcı için geçerli
  const [personallyMutedUsers, setPersonallyMutedUsers] = useState<Set<string>>(new Set());

  // ★ Konuşma modu state
  const [speakingMode, setSpeakingMode] = useState<'free_for_all' | 'permission_only' | 'selected_only'>('permission_only');
  // ★ 2026-04-22: Hoş geldin banner — odaya ilk girişte tek seferlik kibar selam
  const [welcomeBanner, setWelcomeBanner] = useState<string | null>(null);
  const [showRoomStats, setShowRoomStats] = useState(false);
  const [roomStats, setRoomStats] = useState({ peakCCU: 0, totalUniqueListeners: 0, totalReactions: 0 });
  const isRoomClosingRef = useRef(false);

  // ★ SEC-FLOOD: Emoji → chat DB yazma throttle ref
  const _lastEmojiChatWriteRef = useRef(0);

  // ★ MODAL MUTEX — Aynı anda sadece 1 overlay açık olabilir
  const closeAllOverlays = useCallback(() => {
    setShowSettings(false);
    setShowPlusMenu(false);
    setShowAccessPanel(false);
    setShowMicRequests(false);
    setShowInviteFriends(false);
    setShowRoomStats(false);
    setShowAudienceDrawer(false);
    setShowDmPanel(false);
    setShowDonationDrawer(false);
    setShowChatDrawer(false);
    setShowPowerUps(false);
    setShowFollowersSheet(false);
    setSelectedUser(null);
  }, [setShowDmPanel]);

  // ★ O11 FIX: Hızlı tıklamada sadece SON opener çalışsın — araya giren rAF'lar
  // aynı frame'de iki modal'ı birden açıyordu.
  const pendingOpenerRef = useRef<(() => void) | null>(null);
  const openOverlay = useCallback((opener: () => void) => {
    closeAllOverlays();
    pendingOpenerRef.current = opener;
    requestAnimationFrame(() => {
      const current = pendingOpenerRef.current;
      if (current === opener) {
        opener();
        pendingOpenerRef.current = null;
      }
      // İki opener aynı frame'de gelirse yalnızca sonuncu ref'te kalır → ilkine ait
      // bu callback no-op düşer; sonraki rAF gerçek opener'ı çalıştırır.
    });
  }, [closeAllOverlays]);

  // ★ Y17: Android donanım geri tuşu — önce overlay kapat, sonra terk et.
  // Overlay yoksa: host ise konfirm alert, listener ise doğrudan ayrıl (mevcut
  // header back davranışının aynısı).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = () => {
      if (alertConfig.visible) {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        return true;
      }
      if (
        selectedUser || showChatDrawer || showAudienceDrawer || showDmPanel ||
        showSettings || showPlusMenu || showAccessPanel || showMicRequests ||
        showInviteFriends || showRoomStats || showDonationDrawer
      ) {
        closeAllOverlays();
        return true;
      }
      // ★ v92.9 (1 May 2026): Back tuşu = otomatik minimize.
      //   Tam ayrılma sadece Plus menü > "Odadan Ayrıl" veya mini-X ile yapılır.
      //   Bu kural host/listener/speaker farkı gözetmez — herkes minimize'a alınır.
      handleAutoMinimize();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [
    alertConfig.visible, selectedUser, showChatDrawer, showAudienceDrawer, showDmPanel,
    showSettings, showPlusMenu, showAccessPanel, showMicRequests, showInviteFriends,
    showRoomStats, showDonationDrawer,
    room?.host_id, firebaseUser?.uid, closeAllOverlays, handleAutoMinimize,
  ]);

  // ★ SP Toast ref — animasyonlu SP kazanım bildirimi
  const spToastRef = useRef<SPToastRef>(null);

  // ★ Moderasyon Overlay — ceza alan kişi ekranı
  const penaltyRef = useRef<ModerationOverlayRef>(null);
  // ★ Avatar flash state — herkesin gördüğü geçici moderasyon animasyonu
  const [avatarFlashes, setAvatarFlashes] = useState<Record<string, FlashType | null>>({});
  const setAvatarFlash = useCallback((userId: string, flashType: FlashType) => {
    setAvatarFlashes(prev => ({ ...prev, [userId]: flashType }));
    // 3sn sonra otomatik temizle
    setTimeout(() => {
      setAvatarFlashes(prev => {
        const next = { ...prev };
        if (next[userId] === flashType) delete next[userId];
        return next;
      });
    }, 3000);
  }, []);
  const clearAvatarFlash = useCallback((userId: string) => {
    setAvatarFlashes(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  // ★ SEC-DOUBLE-CHARGE FIX: Giriş ücreti SADECE bakiye kontrolü yapar — SP harcama backend'de (RoomService.join)
  // ÖNCEKİ BUG: Bu fonksiyon GamificationService.spend() çağırıyordu VE backend de ayrıca SP düşüyordu → 2x tahsilat
  // ★ v107.7: Bakiye yeterse onay kartı açılır (Promise-based). İmza aynı (Promise<boolean>) — 6 çağıran yer dokunulmadı.
  const processEntryFee = useCallback(async (roomData: Room, userId: string): Promise<boolean> => {
    const fee = roomData.room_settings?.entry_fee_sp || 0;
    const isOwner = roomData.host_id === userId;
    if (fee <= 0 || isOwner) return true; // Ücret yok veya owner — devam
    try {
      // Sadece bakiye kontrolü — SP düşme YOK (backend yapacak)
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('system_points')
        .eq('id', userId)
        .single();
      const currentSP = userProfile?.system_points || 0;
      if (currentSP < fee) {
        // ★ 2026-05-05: Toast değil bilgilendirici modal + SP satın al yönlendirmesi.
        //   Eksik fark vurgulanır, kullanıcıya net seçim sunulur (Vazgeç / SP Al).
        const missing = fee - currentSP;
        setAlertConfig({
          visible: true,
          title: 'SP Yetersiz',
          message: i18n.t('auto.room.id.110', { 0: fee, 1: currentSP, 2: missing }),
          type: 'info',
          icon: 'wallet-outline',
          buttons: [
            { text: i18n.t('auto.room.id.109'), style: 'cancel', onPress: () => safeGoBack(router) },
            { text: i18n.t('auto.room.id.108'), style: 'primary', onPress: () => { safeGoBack(router); setTimeout(() => router.push('/sp-store' as any), 250); } },
          ],
        });
        return false;
      }

      // ★ v107.7: Bakiye yeter — kullanıcıya onay kartı göster, kararını bekle.
      //   "Öde + Gir" → resolver(true), join akışı devam eder.
      //   "Vazgeç" → resolver(false) + safeGoBack, join akışı durur.
      return await new Promise<boolean>((resolve) => {
        setEntryFeeRequest({
          visible: true,
          fee,
          balance: currentSP,
          roomName: roomData.name || 'Oda',
          hostName: (roomData.host as any)?.display_name,
          hostAvatar: (roomData.host as any)?.avatar_url || null,
          resolver: resolve,
        });
      });
      // ★ SEC-DOUBLE-CHARGE FIX: Host payı ve SP düşme sadece backend'de (RoomService.join)
    } catch {
      return true; // SP servisi hata verirse girişe izin ver (graceful degradation)
    }
  }, [router]);

  // ★ ARCH-1 FIX: Broadcast kanalları hook'a taşındı (~200 satır kaldırıldı)
  const roomHostRef = useRef<string | null>(null);
  // ★ B6 FIX: firebaseUser ref — uzun ömürlü subscription callback'lerinde stale closure önleme
  const firebaseUserRef = useRef(firebaseUser);
  useEffect(() => { firebaseUserRef.current = firebaseUser; }, [firebaseUser]);

  // ★ 2026-04-20: Oda içindeyken global SPReceivedModal bastırma flag'i.
  //   _layout realtime gift handler bu flag'i görürse büyük gold modal açmaz;
  //   onun yerine oda içi DonationAlert zaten tüm katılımcılara aynı animasyonu gösterir.
  useEffect(() => {
    (global as any).__sopranoInRoom = id;
    return () => { (global as any).__sopranoInRoom = undefined; };
  }, [id]);
  // ★ BUG-1 FIX: LiveKit ref — useRoomBroadcast callback'leri güncel lk kullanır (stale closure önleme)
  const lkRef = useRef<any>({ isMicrophoneEnabled: false, toggleMic: async () => {}, enableMic: async () => {}, disableMic: async () => {} });
  // ★ Bağış bildirimi ref
  const donationAlertRef = useRef<DonationAlertRef>(null);
  // ★ O4: Kendi is_chat_muted durumunu takip eden ref — emoji/reaction bypass engeli
  const isChatMutedRef = useRef<boolean>(false);
  const { emojiBroadcastRef, micReqChannelRef, modChannelRef, sendEmojiReaction, sendDonationAlert } = useRoomBroadcast({
    roomId: id as string,
    firebaseUser,
    profile,
    room,
    router,
    floatingRef,
    setRoom,
    setParticipants,
    setChatMessages,
    setMicRequests,
    setMyMicRequested,
    setClosingCountdown,
    setSpeakingMode,
    setMinimizedRoom,
    setAlertConfig,
    roomHostRef,
    penaltyRef,
    setAvatarFlash,
    lkRef,
    donationAlertRef,
    isChatMutedRef,
  });
  // Mikrofon modu değiştiğinde LiveKit'i de güncelle
  const handleMicModeChange = (mode: MicMode) => {
    setMicMode(mode);
    if (mode === 'music') setNoiseCancellation(false);
    lk.setMicMode?.(mode);
    // Bilgi ayarlar panelinde zaten görünür — toast spam önleme
  };

  // Gürültü engelleme: Müzik moduna dolaylı etki — mod tekrar uygulanır
  const handleNoiseCancellation = (enabled: boolean) => {
    setNoiseCancellation(enabled);
    // Müzik modunda değilse, modayı "normal" olarak tekrar uygula (NC açık/kapalı)
    if (micMode === 'normal') {
      lk.setMicMode?.('normal'); // Normal modda NC her zaman açık
    }
  };

  // Hoparlör / Kulaklık: expo-av ile ses çıkış yönlendirmesi
  const handleSpeakerToggle = async (speaker: boolean) => {
    setUseSpeaker(speaker);
    try {
      const { Audio } = require('expo-av');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: !speaker, // true = kulaklık, false = hoparlör
      });
    } catch (e) {
      if (__DEV__) console.warn('[Audio] Hoparlör değiştirme hatası:', e);
    }
  };
  





  // ★ Oda müziği artık link paylaşımı — oynatma kodu yok, banner UI aşağıda

  const scrollViewRef = useRef<ScrollView>(null);
  const chatInputRef = useRef<TextInput>(null);
  const participantsRef = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
  const prevParticipantCountRef = useRef(0); // BUG-R7 FIX: stale closure önleme
  const isMinimizingRef = useRef(false); // Küçültme sırasında leave yapma
  // ★ 2026-04-21: Upsell ve diğer akışlarda odayı minimize + navigate pattern'i için
  // güncel payload referansı. hostUser/viewerCount/lk render'ın altında hesaplandığı için
  // ref her render'da taze tutulur (aşağıdaki useEffect).
  const minimizePayloadRef = useRef<{ id: string; name: string; hostName: string; viewerCount: number; isMicOn: boolean } | null>(null);
  const minimizeAndPush = useCallback((path: string) => {
    if (minimizePayloadRef.current) {
      isMinimizingRef.current = true;
      setMinimizedRoom(minimizePayloadRef.current);
    }
    router.push(path as any);
  }, [setMinimizedRoom, router]);

  // ★ v92.9 (1 May 2026): Otomatik minimize — kullanıcı manuel "Odadan Ayrıl" veya
  //   mini X dışında her şekilde çıkarsa (back tuşu, header geri, navigate) oda
  //   minimize'a düşer. Tam çıkış sadece Plus menü > Odadan Ayrıl veya mini X ile.
  // ★ v92.20 (1 May 2026): Bekleyen oda erişim talebi count — SECURITY DEFINER RPC
  //   üzerinden POLLING. Önceden REST + RLS ile select count yapılıyordu ama RLS
  //   app_uid() Firebase JWT host_id eşleşmesi fail ediyordu → host "0 istek"
  //   görüyordu, DB'de pending kayıt olsa bile. RPC server-side host/mod kontrolü
  //   yapıp güvenli şekilde dönüyor.
  useEffect(() => {
    if (!id || !firebaseUser?.uid || !(amIHost || amIModerator)) {
      setPendingAccessCount(0);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const { data } = await supabase.rpc('get_pending_access_requests', {
          p_room_id: id,
          p_caller_id: firebaseUser.uid,
        });
        if (!cancelled) setPendingAccessCount(Array.isArray(data) ? data.length : 0);
      } catch {}
    };
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [id, firebaseUser?.uid, amIHost, amIModerator]);

  // ★ v92.10 (1 May 2026): Top Contributor pill — bu odadaki en cömert kullanıcıyı çek
  useEffect(() => {
    if (!id || isSystemRoom(id as string)) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc('room_top_contributor', { p_room_id: id });
        if (cancelled) return;
        const row = (data as any[])?.[0];
        if (row && row.user_id) {
          setTopContributor({
            user_id: row.user_id,
            display_name: row.display_name || i18n.t('auto.room.id.107'),
            avatar_url: row.avatar_url || '',
            total_sp: Number(row.total_sp) || 0,
          });
        } else {
          setTopContributor(null);
        }
      } catch { /* sessiz */ }
    })();
    return () => { cancelled = true; };
  }, [id, topContributorTrigger]);

  const handleAutoMinimize = useCallback(() => {
    if (minimizePayloadRef.current) {
      isMinimizingRef.current = true;
      setMinimizedRoom(minimizePayloadRef.current);
    }
    router.back();
  }, [setMinimizedRoom, router]);

  // Oda sesi a/kapat

  // 1 Backend Balantlar
  useEffect(() => {
    if (!id || !firebaseUser) return;
    // Tam ekran odaya girildi — mini kartı kaldır
    setMinimizedRoom(null);

    // System Room fallback — veritabanında yok, local data kullan
    // ★ 2026-04-26: RoomService.get hata fırlatıyorsa (oda silinmiş) catch ile null'a çevir, sonra not_found tetiklensin.
    const roomPromise: Promise<Room | null> = isSystemRoom(id)
      ? Promise.resolve(getSystemRooms().find(r => r.id === id) as unknown as Room)
      : RoomService.get(id).catch(() => null);
    const partPromise = isSystemRoom(id) 
      ? Promise.resolve([{
          id: `local_${firebaseUser.uid}`,
          room_id: id as string,
          user_id: firebaseUser.uid,
          role: 'listener' as const,
          joined_at: new Date().toISOString(),
          is_muted: false,
          is_chat_muted: false,
          user: {
            display_name: profile?.display_name || i18n.t('auto.room.id.106'),
            avatar_url: profile?.avatar_url || null,
          },
        }] as RoomParticipant[])
      : RoomService.getParticipants(id as string);
    Promise.all([roomPromise, partPromise]).then(async ([roomData, p]) => {
      // ★ 2026-04-26: roomData null/undefined → oda silinmiş veya hiç yok → RoomClosedScreen
      if (!roomData) {
        setRoomBlock({ reason: 'not_found' });
        setLoading(false);
        return;
      }
      // ★ 2026-04-22: Kapalı/dondurulmuş odaya girişi ENGELLE (owner değilse).
      //   Owner ise 'wake' akışı UI'da mevcut; diğer kullanıcılar için toast + geri dön.
      const isRoomClosed = roomData.is_live === false;
      const isRoomOwner = firebaseUser && roomData.host_id === firebaseUser.uid;
      if (isRoomClosed && !isRoomOwner && !isSystemRoom(id)) {
        // ★ 2026-04-26: Toast+geri-dön yerine full-screen RoomClosedScreen gösterilir.
        //   Oda asla render edilmez — kullanıcı net olarak "kapalı" feedback alır.
        setRoomBlock({ reason: 'closed' });
        setLoading(false);
        return;
      }
      // ★ 2026-04-26: Süresi dolmuş oda kontrolü
      if (roomData.expires_at && new Date(roomData.expires_at).getTime() < Date.now() && !isRoomOwner) {
        setRoomBlock({ reason: 'expired' });
        setLoading(false);
        return;
      }
      // ★ 2026-04-29 FIX: Host kendi uyuyan odasına direkt girerse (push, link, Keşfet'ten)
      //   wakeUp otomatik tetiklensin — yoksa livekit-token "Oda aktif değil" 403 dönüyor.
      //   Daha önce sadece Odalarım'daki "Başlat" tetikliyordu; bu seamless akış sağlar.
      if (isRoomClosed && isRoomOwner && !isSystemRoom(id)) {
        try {
          const tier = profile ? getEffectiveTier(profile) : 'Free';
          const wokeRoom = await RoomService.wakeUpRoom(roomData.id, firebaseUser.uid, tier as any);
          setRoom(wokeRoom); setParticipants(p); participantsRef.current = new Set(p.map(x => x.user_id)); setLoading(false);
          // Aşağıdaki settings/follower fetch'leri için wokeRoom kullanılsın
          roomData = wokeRoom;
        } catch (wakeErr: any) {
          if (__DEV__) console.warn('[Room] Auto-wakeUp fail:', wakeErr?.message);
          showToast({ title: i18n.t('room.id.014'), message: wakeErr?.message || 'Tekrar dene.', type: 'error' });
          setRoomBlock({ reason: 'connection_failed' });
          setLoading(false);
          return;
        }
      } else {
        setRoom(roomData); setParticipants(p); participantsRef.current = new Set(p.map(x => x.user_id)); setLoading(false);
      }
      // ★ Speaking mode — room_settings'ten oku (oda oluşturma ayarı yansısın)
      const savedMode = roomData.room_settings?.speaking_mode;
      if (savedMode && ['free_for_all', 'permission_only', 'selected_only'].includes(savedMode)) {
        setSpeakingMode(savedMode);
      }
      // ★ Takipçi sayısını çek
      RoomFollowService.getFollowerCount(roomData.id).then(c => setFollowerCount(c)).catch(() => {});
      // ★ Takip durumunu çek
      if (firebaseUser) {
        RoomFollowService.isFollowing(roomData.id, firebaseUser.uid).then(f => setIsFollowingRoom(f)).catch(() => {});
      }
      // Oda ziyaret geçmişine kaydet (Ana sayfa "Son Girdiğin Odalar" kısayolları)
      RoomHistoryService.addEntry({
        id: roomData.id,
        name: roomData.name,
        hostName: roomData.host?.display_name || 'Anonim',
        hostAvatar: roomData.host?.avatar_url,
        category: roomData.category,
      }).catch(() => {});
      const existing = p.find(x => x.user_id === firebaseUser.uid);
      const isHost = roomData.host_id === firebaseUser.uid;
      const isAdmin = profile?.is_admin;

      // ★ 2026-04-18 FIX: Zombie participant bypass — existing row varsa bile
      // şifreli/davetli/ban/kilitli odalarda re-verify gerekiyor. Owner/admin/
      // sahneye yükseltilmiş roller (owner/moderator/speaker) tekrar kontrol edilmez.
      const trustedExistingRole = existing && ['owner', 'moderator', 'speaker'].includes(existing.role);

      // ★ 2026-04-18: Host/admin/trusted-role → access direkt granted (UI render edilir)
      if (isHost || isAdmin || trustedExistingRole) {
        setAccessGranted(true);
      }

      // ★ 2026-04-30: Minimize'dan dönüş — existing varsa mevcut rolü koru, join tekrar çağırma.
      //   Host sahneden indikten sonra minimize edip geri dönünce zorla owner'a yükselmesini engeller.
      if (isRestoringFromMinimize && existing) {
        setAccessGranted(true);
        // last_seen heartbeat güncelle — stale cleanup'a yakalanmasın
        RoomService.updateLastSeen(id as string, firebaseUser.uid).catch(() => {});
        return;
      }

      if ((!existing || !trustedExistingRole) && profile) {
        // Sistem odalarında DB join yapma — lokal katılımcı zaten eklendi
        if (isSystemRoom(id as string)) {
          // Sistem odasında sadece hoş geldin mesajı göster
          setAccessGranted(true);
          return;
        }
        // ★ 2026-04-21: OPEN + filtresiz odalarda access gate'i komple atla — gereksiz friction.
        //   Filtre varsa (şifre / davet / followers_only / age / language) checkAccess çalışır.
        const openFilters = (roomData.room_settings || {}) as any;
        // ★ 2026-04-27: Şifre tutarlılık — settings.room_password explicit null/'' ise
        //   eski rooms.room_password column'unu yoksay (legacy hash bug). roomAccess.ts ile aynı mantık.
        const _settingsPwd = openFilters.room_password;
        const _hasExplicitPwdNull = _settingsPwd === null || _settingsPwd === '';
        const _effectivePwd = _hasExplicitPwdNull ? null : (_settingsPwd || roomData.room_password);
        const isOpenNoFilter =
          roomData.type === 'open' &&
          !_effectivePwd &&
          !openFilters.followers_only &&
          !openFilters.age_restricted &&
          !openFilters.age_filter_min &&
          !openFilters.room_language;
        // ★ ODA GİRİŞ KONTROLÜ — RoomAccessService.checkAccess() ile merkezi kontrol
        if (!isHost && !isAdmin && !isOpenNoFilter) {
          // Kullanıcı yaşını hesapla (profilde doğum yılı varsa)
          let userAge: number | null = null;
          if (profile?.birth_date) {
            // birth_date = 'YYYY-01-01' formatında — sadece yıl bazlı hesapla
            const birthYear = new Date(profile.birth_date).getFullYear();
            if (birthYear > 1900) {
              userAge = new Date().getFullYear() - birthYear;
            }
          }
          // ★ age_restricted → age_filter_min uyumluluğu: boolean ise 18'e çevir
          const roomForCheck = { ...roomData };
          const rs = (roomForCheck.room_settings || {}) as any;
          if (rs.age_restricted === true && !rs.age_filter_min) {
            rs.age_filter_min = 18;
            roomForCheck.room_settings = rs;
          }

          // ★ 2026-04-20: Device locale kullan (profile.language yok) — soft dil uyarısı için
          const { getDeviceLanguage } = require('../../utils/locale');
          const userLocale = getDeviceLanguage();

          // ★ 2026-04-27: PRE-CHECK ÖZET — sadece SOFT engeller (kullanıcı geçebilir):
          //   - Şifre: doğru gir → geç
          //   - Davet: istek gönder → onay bekle → geç
          //   HARD engeller (followers_only, age_filter_min) ve dil bilgisi PRE-CHECK'TE GÖSTERİLMEZ:
          //   - followers_only: arkadaş değilse zaten giremez → checkAccess fail → RoomClosedScreen
          //   - age: yaş yetmiyorsa zaten giremez → RoomClosedScreen
          //   - dil: soft info, oda içinde toast olarak gösterilir
          //   Önceki UX bug: kullanıcı "Devam Et" diyordu, sonra "Arkadaşlara Özel" engeli görüyordu — çift onay.
          const filters: EntryPreviewFilter[] = [];
          // ★ Şifre tutarlılık — roomAccess.ts ile aynı mantık.
          //   settings.room_password === null/'' explicit ise legacy column'u yoksay.
          const _rsPwd = rs.room_password;
          const _rsPwdExplicitNull = _rsPwd === null || _rsPwd === '';
          const hasPwd = !_rsPwdExplicitNull && !!(_rsPwd || roomForCheck.room_password);
          // ★ 2026-05-05: Şifre filtresi pre-check preview'a EKLENMEZ — kullanıcı talebi.
          //   "Devam Et" → "Şifre Gir" iki adımlı modal yerine direkt şifre sheet'i gösterilir.
          //   Doğru şifre girer → girer; geri/vazgeç tuşu ile çıkar.
          if (roomForCheck.type === 'invite') filters.push({ icon: 'mail-open', color: '#3B82F6', title: 'Davetli Oda', desc: i18n.t('room.id.015') });

          if (filters.length > 0) {
            const previewOk = await new Promise<boolean>((resolve) => {
              setEntryPreview({
                filters,
                onContinue: () => { setEntryPreview(null); resolve(true); },
                onCancel: () => { setEntryPreview(null); resolve(false); },
              });
            });
            if (!previewOk) {
              setLoading(false);
              safeGoBack(router);
              return;
            }
          }

          const accessResult: AccessCheckResult = await RoomAccessService.checkAccess(
            roomForCheck,
            firebaseUser.uid,
            (profile?.subscription_tier || 'Free') as any,
            userAge,
            userLocale,
            undefined,
            true, // skipLanguageCheck — dil filter artık soft info, bloke etmiyor
          );

          if (!accessResult.allowed) {
            // ★ Access denied — oda içi gizlenir (AccessGate overlay render edilir)
            setAccessGranted(false);
            // ★ password_required → Şifre bottom-sheet göster (kapatmadıkça giremesin)
            if (accessResult.action === 'password_required') {
              setPendingRoomData({ room: roomData, participants: p });
              setPasswordError('');
              setShowPasswordModal(true);
              return;
            }
            // ★ request_sent → Davetli oda erişim isteği bottom-sheet (realtime onay/red)
            if (accessResult.action === 'request_sent') {
              setPendingRoomData({ room: roomData, participants: p });
              setShowAccessRequest(true);
              return;
            }
            // ★ 2026-04-27: language_mismatch handler kaldırıldı — dil filter artık soft info,
            //   skipLanguageCheck=true her zaman → checkAccess'ten language_mismatch dönmez.
            //   Oda yüklendikten sonra useEffect ile bayrak + "Bu odada X konuşuluyor" toast'u.

            // ★ 2026-04-26: invite_required → bottom-sheet (şifre sheet'iyle aynı dil)
            //   Pop alert kaldırıldı; aşağıdan yukarı kayan onay sheet'i gösterilir.
            if (accessResult.action === 'invite_required') {
              setPendingRoomData({ room: roomData, participants: p });
              setShowInviteConfirm(true);
              return;
            }

            // ★ 2026-04-26: Oda dolu → tam ekran abartı, toast yeterli (geçici durum, retry değer)
            if (accessResult.action === 'room_full') {
              showToast({
                title: '🚫 Oda Dolu',
                message: accessResult.reason || i18n.t('auto.room.id.105'),
                type: 'warning',
              });
              safeGoBack(router);
              return;
            }

            // ★ 2026-04-26: Kalıcı engeller → tam ekran animasyonlu uyarı (pop modal yerine).
            //   Birden fazla hard-block varsa hepsi aynı ekranda bullet liste şeklinde gösterilir.
            const FULLSCREEN_REASONS: Record<string, RoomClosedReason> = {
              banned: 'banned',
              room_locked: 'room_locked',
              followers_only: 'followers_only',
              age_restricted: 'age_restricted',
            };
            const fullscreenReason = FULLSCREEN_REASONS[accessResult.action || ''];
            if (fullscreenReason) {
              // Tüm hard-block'ları topla (multi-reason desteği)
              const allBlockers = await RoomAccessService.getHardBlockers(
                roomForCheck,
                firebaseUser.uid,
                (profile?.subscription_tier || 'Free') as any,
                userAge,
              );
              const additional = allBlockers
                .filter(b => FULLSCREEN_REASONS[b.action] && b.action !== accessResult.action)
                .map(b => ({ reason: FULLSCREEN_REASONS[b.action] as RoomClosedReason, message: b.reason }));
              setRoomBlock({
                reason: fullscreenReason,
                message: accessResult.reason || undefined,
                additionalReasons: additional.length > 0 ? additional : undefined,
              });
              return;
            }
            // Bilinmeyen aksiyon — fallback: not_found
            setRoomBlock({ reason: 'not_found', message: accessResult.reason || undefined });
            return;
          }

          // ★ DRY: Merkezi giriş ücreti kontrolü
          const feeOk = await processEntryFee(roomData, firebaseUser.uid);
          if (!feeOk) { setAccessGranted(false); return; }
        }
        // Açık oda veya host/admin — direkt giriş
        const isOriginalHost = roomData.room_settings?.original_host_id === firebaseUser.uid;
        // Listener grid doluysa spectator olarak gir
        let joinRole: 'owner' | 'listener' | 'spectator' = 'listener';
        if (isHost || isOriginalHost) {
          joinRole = 'owner';
        } else {
          const hostTierForJoin = roomData.owner_tier || roomData.host?.subscription_tier || 'Free';
          const tierLimitsForJoin = getRoomLimits(hostTierForJoin);
          const currentListenersForJoin = p.filter(x => x.role === 'listener').length;
          if (currentListenersForJoin >= tierLimitsForJoin.maxListeners) {
            joinRole = 'spectator';
          }
        }
        // ★ 2026-04-18 FIX: setAccessGranted(true) SADECE join DB insert başarılı
        // olduktan sonra. LiveKit token edge function participant row'u kontrol
        // ediyor (v31); accessGranted→useLiveKit tetiklenirse ve row yoksa 403
        // "Ses sunucusuna bağlanılamadı" hatası çıkıyordu.
        RoomService.join(id, firebaseUser.uid, joinRole).then(async () => {
          setAccessGranted(true); // ★ DB'de participant row var artık — LiveKit token alınabilir
          // ★ 2026-04-29 FIX: Join sonrası participant listesini fresh olarak çek.
          //   Kullanıcı kendi odasına geri girdiğinde stage boş + katılımcı 0 görünüyordu —
          //   realtime onRoomChange race ile mount'tan önce tetiklenmiş olabiliyor.
          try {
            const freshP = await RoomService.getParticipants(id as string);
            setParticipants(freshP);
            participantsRef.current = new Set(freshP.map(x => x.user_id));
          } catch {}
          // ★ K3 FIX: SP Toast timing — backend'de SP tahsilatı (eğer varsa) başarılı olduktan SONRA toast gösterilir
          const fee = roomData.room_settings?.entry_fee_sp || 0;
          if (fee > 0 && joinRole !== 'owner') {
             spToastRef.current?.show(-fee, i18n.t('auto.room.id.104'));
          }

          // ★ Asıl sahip geri döndüyse broadcast ile bildir
          if (isOriginalHost) {
            // BUG-R3 FIX: modChannelRef kullan — aynı kanaldan gönder, yoksa dinleyiciler alamaz
            modChannelRef.current?.send({
              type: 'broadcast', event: 'mod_action',
              payload: { action: 'original_host_returned', hostName: profile.display_name || 'Oda sahibi' },
            });
            // Host zaten biliyor — toast gereksiz
          } else if (joinRole === 'spectator') {
            // Seyirci durumu UI'da inline gösteriliyor
          } else if (joinRole === 'listener') {
            // ★ UX-3 FIX: Toast spam azaltma — SP bildirimleri SPToast ile gösterilir, ayrı showToast gereksiz
            // SP: Günlük giriş + Prime-time SP (sessiz — sadece SPToast badge)
            GamificationService.onDailyLogin(firebaseUser.uid).then(sp => {
              if (sp > 0) spToastRef.current?.show(sp, i18n.t('auto.room.id.103'));
            }).catch(() => {});
            GamificationService.onPrimeTimeReturn(firebaseUser.uid).then(sp => {
              if (sp > 0) spToastRef.current?.show(sp, 'Prime Time');
            }).catch(() => {});
          }
          // ★ Welcome mesajı artık ayrı useEffect'te gösteriliyor (room state değişince tetiklenir)
          // ★ Kurallar artık header'da gösteriliyor — chat'e enjekte edilmez
        }).catch((err: any) => {
          // ★ Join DB insert fail olursa access'i geri al — LiveKit bağlantı denemesin
          setAccessGranted(false);
          // ★ BUG FIX: Ban/kilit/erişim hatalarını kullanıcıya göster
          const msg = err?.message || i18n.t('auto.room.id.102');
          setAlertConfig({
            visible: true,
            title: msg.includes('yasaklan') ? i18n.t('auto.room.id.101') : msg.includes('kilitli') ? '🔒 Oda Kilitli' : i18n.t('auto.room.id.100'),
            message: msg,
            type: msg.includes('yasaklan') ? 'error' : 'warning',
            icon: msg.includes('yasaklan') ? 'ban' : msg.includes('kilitli') ? 'lock-closed' : 'alert-circle',
            buttons: [{ text: i18n.t('auto.room.id.099'), onPress: () => safeGoBack(router) }],
          });
        });
        // ★ REMOVED: Sarı giriş banner'ı kaldırıldı — chat'te zaten "odaya katıldı" mesajı var
      }
      // ★ 2026-04-30: Eski "host rolü yanlış → düzelt" bloğu KALDIRILDI.
      //   Host bilinçli olarak sahneden inebilir (listener rolü). Bu durumda rolünü
      //   zorla owner'a çekmek kullanıcının kararını geçersiz kılıyordu.
      //   Host sahneye geri çıkmak isterse "Sahneye Dön" butonunu kullanır.
    });

    // ★ 2026-04-30 v5: Çift kanal yapısına geri dönüldü (stabilite).
    //   Birleşik kanal event delivery sorunlarına neden oluyordu.
    //   room_participants → room:{id} kanalı
    //   rooms → room_status:{id} kanalı
    const prevIsLive = { current: room?.is_live ?? true };
    const pSub = RealtimeService.onRoomChange(
      id as string,
      (newParticipants) => {
        // Sadece ilk yükleme sonrası yeni katılanları bildir
        if (initialLoadDone.current) {
          newParticipants.forEach(np => {
            if (!participantsRef.current.has(np.user_id) && np.user_id !== firebaseUser?.uid) {
              const joinMsg: RoomMessage = {
                id: `join_${np.user_id}_${Date.now()}`,
                room_id: id as string,
                user_id: np.user_id,
                content: i18n.t('auto.room.id.098'),
                created_at: new Date().toISOString(),
                profiles: { display_name: np.user?.display_name || 'Misafir' },
                isJoin: true,
              } as any;
              setChatMessages(prev => [joinMsg, ...prev].slice(0, 100));
              // ★ v108: Giriş efekti overlay tetikle
              const npEntryEffect = (np as any).entry_effect;
              if (npEntryEffect) {
                setEntryEffectData({
                  effectId: npEntryEffect,
                  userName: np.user?.display_name || 'Misafir',
                });
              }
            }
          });
        } else {
          initialLoadDone.current = true;
        }
        // Ref'i güncelle
        participantsRef.current = new Set(newParticipants.map(p => p.user_id));
        // BUG-R7 FIX: prevCount'u ref'ten al — stale closure önleme
        const prevCount = prevParticipantCountRef.current;
        prevParticipantCountRef.current = newParticipants.length;
        setParticipants(newParticipants);

        // ★ CCU Milestone SP — Oda sahibi milestone'a ulaştığında SP kazanır
        if (roomHostRef.current === firebaseUser?.uid && newParticipants.length !== prevCount) {
          GamificationService.onCCUMilestone(firebaseUser!.uid, newParticipants.length, prevCount)
            .then(sp => {
              if (sp > 0) {
                spToastRef.current?.show(sp, 'Milestone');
              }
            })
            .catch(() => {});
        }
      },
    );

    // ★ v5: Oda durumu ayrı kanal — rooms UPDATE dinler
    const statusSub = RealtimeService.onRoomStatusChange(
      id as string,
      (updatedRoom) => {
        if (prevIsLive.current && !updatedRoom.is_live) {
          if (!isRoomClosingRef.current) {
            liveKitService.disconnect().catch(() => {});
            setMinimizedRoom(null);
            setRoomBlock({ reason: 'closed' });
          }
        }
        prevIsLive.current = updatedRoom.is_live;
        setRoom(updatedRoom);
      },
    );
    // ★ v87 (1 May 2026): Spaces/anlık modeli — kullanıcı odaya katıldığı andan sonraki
    //   mesajları görsün. Oda canlı bile olsa eski backlog gizlenir; refresh/yeniden giriş
    //   = yeni başlangıç. Eski mesajlar DB'de kalır, oda kapanınca trigger siler (v87).
    const joinedAtIso = new Date().toISOString();
    RoomChatService.getMessages(id as string, 50, joinedAtIso).then(history => {
      if (history.length > 0) setChatMessages(history);
    }).catch(() => { /* sessiz — initial yük başarısız olursa real-time devam eder */ });

    // BUG-11 FIX: Mesaj birikimi limitleme (max 100)
    const unsubscribeMsg = RoomChatService.subscribe(
      id as string,
      (msg) => {
        setChatMessages(prev => {
          // Initial load ile gelen mesajla aynısı tekrar eklenmesin
          if (prev.find(m => m.id === msg.id)) return prev;
          // ★ v110.5.9: Optimistic match — kendi gönderdiğim mesaj realtime'dan
          //   geldiğinde, optimistic temp mesajı server mesajıyla DEĞİŞTİR
          //   (yoksa duplicate görünür: temp + real).
          if (msg.sender_id === firebaseUser?.uid) {
            const optIdx = prev.findIndex((m: any) =>
              m._optimistic && m.sender_id === msg.sender_id && m.content === msg.content
            );
            if (optIdx >= 0) {
              const next = [...prev];
              next[optIdx] = msg;
              return next;
            }
          }
          return [msg, ...prev].slice(0, 100);
        });
        // ★ 2026-04-26: Drawer kapalıysa + mesaj başkasından geldiyse → badge artır.
        if (!showChatDrawerRef.current && msg.sender_id !== firebaseUser?.uid) {
          setChatUnreadCount(c => Math.min(c + 1, 99));
        }
      },
      // ★ O11: Mesaj soft-delete veya hard-delete olunca chat listesinden kaldır
      (messageId) => setChatMessages(prev => prev.filter(m => m.id !== messageId)),
    );

    // Periyodik kontrol — listener_count sync (yedek mekanizma)
    const syncInterval = setInterval(async () => {
      try {
        RoomService.syncListenerCount(id as string).catch(() => {});
      } catch {}
    }, 60000);

    return () => {
      RealtimeService.unsubscribe(pSub);
      RealtimeService.unsubscribe(statusSub);
      unsubscribeMsg();
      clearInterval(syncInterval);

      // ★ FEAT-3/4: Küçültme (minimize) sırasında odadan ÇIKMA, ses devam etsin
      if (__DEV__) console.log(`[Room] CLEANUP — isMinimizing=${isMinimizingRef.current}`);
      if (isMinimizingRef.current) {
        // ★ 2026-04-24 FIX: Flag'i SIFIRLAMA — useLiveKit unmount cleanup'ı kontrol edecek.
        // Reset edersek useLiveKit shouldDisconnectOnUnmount() false okur ve disconnect eder.
        if (__DEV__) console.log('[Room] CLEANUP — minimize mode, LiveKit korunuyor');
        return; // LiveKit bağlantısı + sahne korunur
      }

      // Gerçek çıkış — zombie önleme
      // ★ handleHostLeave veya handleCloseRoom zaten işlediyse tekrar close çağırma
      if (isRoomClosingRef.current) {
        liveKitService.disconnect().catch(() => {});
        return;
      }

      // ★ B6/BUG-7 FIX: firebaseUserRef + roomHostRef — stale closure önleme
      const currentUid = firebaseUserRef.current?.uid;
      if (!currentUid) {
        liveKitService.disconnect().catch(() => {});
        return;
      }
      const isHost = roomHostRef.current === currentUid;
      if (isHost) {
        // BUG-RD2 FIX: Host çıkışında transferHost çağır — oda sahipsiz kalmasın
        RoomService.transferHost(id as string, currentUid).catch(() => {
          RoomService.leave(id as string, currentUid).catch(() => {});
        });
      } else {
        RoomService.leave(id as string, currentUid).catch(() => {});
      }
      // BUG-17 FIX: LiveKit bağlantısını da kes
      liveKitService.disconnect().catch(() => {});
      // ★ BUG-R9 FIX: Audio mode sıfırla — oda → chat geçişinde 'Only one Recording' hatasını önle
      try {
        const { Audio } = require('expo-av');
        Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
      } catch {}
    };
  }, [id, firebaseUser]); // BUG-7: room?.host_id kaldırıldı — ref ile takip

  // ★ ARCH-1: Heartbeat, zombie, AppState → useRoomLifecycle hook
  useRoomLifecycle({
    roomId: id as string,
    firebaseUser,
    room,
    router,
    isMinimizingRef,
    setMinimizedRoom,
  });

  // ★ v319.6 (18 May 2026): Hayalet kullanıcı fix — Supabase Realtime Presence.
  //   WebSocket bağlantısı kopunca (telefon kapanma, crash, network drop)
  //   sub-second presence_state diğer client'lara yayılır. DB heartbeat
  //   sistemi paralel kalır (history + cleanup), UI filter presence'a güvenir.
  const { isOnline: isUserOnline, onlineUserIds } = useRoomPresence(
    id as string,
    firebaseUser?.uid || null,
  );

  // ★ 2026-04-23: Arka planda kaçırılan eylemleri yakala — uygulama foreground'a
  //   dönünce room + participants + mic requests full refetch. Aksi halde stage
  //   talepleri, rol değişiklikleri, ban vb. "geçmişte kalıyor" gibi görünür.
  useEffect(() => {
    if (!id || !firebaseUser) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // Minimize'dan dönüşte zaten active olur — race olmaması için next tick
      setTimeout(async () => {
        if (isMinimizingRef.current || !id || isSystemRoom(id as string)) return;
        try {
          const [roomData, freshParticipants] = await Promise.all([
            RoomService.get(id as string).catch(() => null),
            RoomService.getParticipants(id as string).catch(() => []),
          ]);
          if (roomData) setRoom(roomData);
          // ★ v309 (18 May 2026) KRİTİK BUG FIX: length>0 koşulu KALDIRILDI.
          //   Eskiden: kimse kalmadığında boş array gelir → koşul false → state stale
          //   → odadan ÇIKAN KULLANICI EKRANDA KALMAYA DEVAM EDİYORDU. Şimdi:
          //   freshParticipants array'i (boş bile olsa) doğrudan state'e yazılır.
          if (Array.isArray(freshParticipants)) {
            setParticipants(freshParticipants);
            participantsRef.current = new Set(freshParticipants.map((x: any) => x.user_id));
          }
          // Heartbeat tetikle — participants.last_seen_at güncellensin
          RoomService.heartbeat(id as string, firebaseUser.uid).catch(() => {});
        } catch { /* sessiz */ }
      }, 300);
    });
    return () => sub.remove();
  }, [id, firebaseUser]);

  // ★ 2026-04-30 v2: Duplike room_parts_rt kanalı KALDIRILDI.
  //   RealtimeService.onRoomChange (yukarıdaki pSub) zaten room_participants
  //   INSERT/DELETE/UPDATE event'lerini dinliyor ve setParticipants güncelliyor.
  //   İki kanal aynı state'i güncelleyince race condition oluşuyordu +
  //   gereksiz bir Supabase channel slotu tüketiliyordu.

  // ★ v309 (18 May 2026): Periyodik participant polling — Firebase JWT'siz
  //   realtime postgres_changes DELETE event'leri fail olabiliyor (memory:
  //   project_dm_broadcast_system_v86). Realtime sync kaçırırsa, 15 saniyelik
  //   polling güvenlik ağı UI'yı temiz tutar — çıkan kullanıcı en geç 15sn
  //   içinde ekrandan kaybolur.
  useEffect(() => {
    if (!id || isSystemRoom(id as string)) return;
    const interval = setInterval(() => {
      if (isMinimizingRef.current) return;
      RoomService.getParticipants(id as string)
        .then((fresh) => {
          if (Array.isArray(fresh)) {
            setParticipants(fresh);
            participantsRef.current = new Set(fresh.map((x: any) => x.user_id));
          }
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [id]);

  // ★ Host tier'ına göre ses/video kalite ayarları
  const hostTierForQuality = (room?.host?.subscription_tier as any) || 'Free';
  const qualityLimits = getRoomLimits(hostTierForQuality);

  const qualityPreset = useMemo(() => ({
    audioSampleRate: qualityLimits.audioSampleRate,
    audioChannels: qualityLimits.audioChannels,
    videoMaxRes: qualityLimits.videoMaxRes,
  }), [qualityLimits]);

  // 2 LiveKit Engine
  const lk = useLiveKit({
    roomId: id as string,
    enabled: !loading && !!room,
    userId: firebaseUser?.uid,
    displayName: profile?.display_name,
    qualityPreset,
    shouldDisconnectOnUnmount: useCallback(() => !isMinimizingRef.current, []),
    // ★ K7: Mic/cam permission reddedilince kullanıcıya açık feedback + ayarlara git kısayolu
    onPermissionDenied: useCallback((device: 'microphone' | 'camera') => {
      const label = device === 'microphone' ? 'Mikrofon' : 'Kamera';
      setAlertConfig({
        visible: true,
        title: i18n.t('auto.room.id.097', { 0: label }),
        message: `Sahnede konuşmak için ${label.toLocaleLowerCase('tr-TR')} iznine ihtiyacımız var. İzni reddettiğiniz için ${device === 'microphone' ? i18n.t('auto.room.id.096') : i18n.t('auto.room.id.095')}. Ayarlardan izni açtıktan sonra tekrar deneyin.`,
        type: 'warning',
        icon: device === 'microphone' ? 'mic-off' : 'videocam-off',
        buttons: [
          { text: i18n.t('auto.room.id.094'), style: 'cancel' },
          { text: i18n.t('auto.room.id.093'), onPress: () => { Linking.openSettings().catch(() => {}); } },
        ],
      });
    }, []),
  });

  // ★ BUG-1 FIX: lkRef'i her render'da güncel tut — useRoomBroadcast callback'leri hep güncel lk kullanır
  lkRef.current = lk;

  // ★ Faz 3.2 — Voice reaction listener (LiveKit data channel; connection'a dokunmaz)
  useEffect(() => {
    liveKitService.setOnDataReceived((payload, fromIdentity) => {
      if (VoiceReactionService.isVoiceReaction(payload)) {
        // Kendi gönderdiğini de overlay'da göster (sender feedback için)
        voiceReactionOverlayRef.current?.show(payload.reactionId);
        // TODO(faz-3.2): VoiceReactionService.playSound(payload.reactionId) — assets hazır olunca
      }
    });
    return () => liveKitService.setOnDataReceived(undefined);
  }, []);

  // ★ O4: is_chat_muted ref'i her render'da güncelle — emoji/reaction gönderimi bu ref'e bakar
  isChatMutedRef.current = !!participants.find(p => p.user_id === firebaseUser?.uid)?.is_chat_muted;


  // ★ 2026-04-26: LiveKit kalıcı fail → bağlantı kurulamadı (oda var olabilir, sunucu down/network kopuk).
  //   "not_found" yanıltıcıydı; ayrı 'connection_failed' reason — retry butonu sunar.
  // ★ 2026-05-10 GRACE: Auto-reconnect 1-2sn'de başarılı olursa flash önle. 3sn delay,
  //   bu süre içinde connectFailed=false olursa setRoomBlock atlanır.
  useEffect(() => {
    if (!lk.connectFailed || loading || roomBlock) return;
    const t = setTimeout(() => {
      setRoomBlock({ reason: 'connection_failed' });
    }, 3000);
    return () => clearTimeout(t);
  }, [lk.connectFailed, loading, roomBlock]);

  // ★ 2026-04-29 v2: Manuel timeout tamamen kaldırıldı — LiveKit'in kendi
  //   `connectFailed` event'i (3 retry exhausted = ~21sn sonra) gerçek failure
  //   sinyalidir. Manuel 10sn timeout cold-start'ta false-positive yaratıyordu.
  //   Ayrı useEffect (yukarıda lk.connectFailed → connection_failed) zaten block eder.

  // ★ 2026-04-27: Dil farkı bilgilendirme toast'u — odaya girince bayrak + dil bilgisi.
  //   Engel/onay yok, sadece bilgi (Clubhouse/Spaces tarzı). Tek seferlik, oda başına.
  const langToastShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room || accessGranted !== true) return;
    const roomLang = (room.room_settings as any)?.room_language;
    if (!roomLang) return;
    const { getDeviceLanguage, getLanguageLabel, getLanguageFlag } = require('../../utils/locale');
    const userLocale = getDeviceLanguage();
    if (roomLang === userLocale) return; // Aynı dil — bilgi gerekmiyor
    if (langToastShownRef.current === room.id) return; // Bu oda için zaten gösterildi
    langToastShownRef.current = room.id;
    const flag = getLanguageFlag(roomLang);
    const label = getLanguageLabel(roomLang);
    showToast({
      title: `${flag} ${label}`,
      message: i18n.t('auto.room.id.092', { 0: label }),
      type: 'info',
      duration: 3500,
    });
  }, [room?.id, accessGranted]);

  // ★ 2026-04-26: REALTIME OBSTRUCTION WATCHER — kullanıcı engelliyken (block/sheet açık)
  //   oda ayarları değişirse anlık tepki ver:
  //     - Şifre kaldırıldı   → şifre sheet'i kapat + otomatik giriş
  //     - Kilit/yaş/followers düştü → block ekranı kapat + otomatik giriş + "🎉" toast
  //     - Davet açıldı (open) → invite sheet'i kapat + otomatik giriş
  //     - Engel TÜRÜ değişti (örn şifreliden davetliye) → block ekranı yeni türe güncelle
  useEffect(() => {
    const isBlockedSomewhere = !!roomBlock || showPasswordModal || showInviteConfirm || showAccessRequest;
    if (!isBlockedSomewhere || !id || !firebaseUser || !profile) return;

    const channelName = `room_unblock:${id}:${firebaseUser.uid}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${id}` },
        async () => {
          try {
            const updatedRoom = await RoomService.get(id as string);
            if (!updatedRoom) return;

            // Yaş hesabı (kullanıcı doğum yılından)
            let userAge: number | null = null;
            if (profile?.birth_date) {
              const birthYear = new Date(profile.birth_date).getFullYear();
              if (birthYear > 1900) userAge = new Date().getFullYear() - birthYear;
            }
            const { getDeviceLanguage } = require('../../utils/locale');
            const userLocale = getDeviceLanguage();

            // Eski/yeni karşılaştırma için age_restricted normalize
            const roomForCheck = { ...updatedRoom };
            const rs = (roomForCheck.room_settings || {}) as any;
            if (rs.age_restricted === true && !rs.age_filter_min) {
              rs.age_filter_min = 18;
              roomForCheck.room_settings = rs;
            }

            const result: AccessCheckResult = await RoomAccessService.checkAccess(
              roomForCheck,
              firebaseUser.uid,
              (profile.subscription_tier || 'Free') as any,
              userAge,
              userLocale,
            );

            if (result.allowed) {
              // 🎉 Engel kalktı — tüm sheet/block ekranlarını kapat + otomatik giriş
              setRoomBlock(null);
              setShowPasswordModal(false);
              setShowInviteConfirm(false);
              setShowAccessRequest(false);
              setPendingRoomData(null);

              const feeOk = await processEntryFee(updatedRoom, firebaseUser.uid);
              if (!feeOk) return;

              const isOriginalHost = updatedRoom.room_settings?.original_host_id === firebaseUser.uid;
              const joinRole: 'owner' | 'listener' | 'spectator' = isOriginalHost ? 'owner' : 'listener';
              try {
                await RoomService.join(id as string, firebaseUser.uid, joinRole);
                setRoom(updatedRoom);
                setAccessGranted(true);
                showToast({
                  title: i18n.t('room.id.016'),
                  message: i18n.t('room.id.017'),
                  type: 'success',
                });
              } catch (e: any) {
                showToast({ title: i18n.t('room.id.018'), message: e?.message || 'Tekrar dene', type: 'error' });
              }
              return;
            }

            // Hâlâ engelli — engel TÜRÜ değişmiş olabilir (örn: şifreli → davetli)
            // Block ekranını yeni türe güncelle, sheet'leri uyumlu duruma getir.
            const action = result.action || '';

            // Şifre sheet açıkken oda davetliye dönmüş → şifre sheet'i kapat, davet sheet'i aç
            if (showPasswordModal && action === 'invite_required') {
              setShowPasswordModal(false);
              setPendingRoomData({ room: updatedRoom, participants: [] });
              setShowInviteConfirm(true);
              return;
            }
            // Davet sheet'i açıkken oda şifreliye dönmüş → davet sheet'lerini kapat, şifre sheet'i aç
            if ((showInviteConfirm || showAccessRequest) && action === 'password_required') {
              setShowInviteConfirm(false);
              setShowAccessRequest(false);
              setPasswordError('');
              setShowPasswordModal(true);
              return;
            }

            // Block ekranı görünüyorsa — yeni reason'a güncelle
            if (roomBlock) {
              const FULLSCREEN_MAP: Record<string, RoomClosedReason> = {
                banned: 'banned',
                room_locked: 'room_locked',
                followers_only: 'followers_only',
                age_restricted: 'age_restricted',
              };
              const newReason = FULLSCREEN_MAP[action];
              if (newReason && newReason !== roomBlock.reason) {
                setRoomBlock({ reason: newReason, message: result.reason || undefined });
              }
            }
          } catch { /* realtime check best-effort — sessizce devam */ }
        },
      )
      .subscribe();

    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [roomBlock, showPasswordModal, showInviteConfirm, showAccessRequest, id, firebaseUser?.uid, profile?.subscription_tier, profile?.birth_date, processEntryFee]);

  // BUG-7 FIX: room.host_id için ref sync (stale closure önleme)
  // roomHostRef useRoomBroadcast hook'undan geliyor — burada sadece sync
  useEffect(() => {
    roomHostRef.current = room?.host_id || null;
  }, [room?.host_id]);

  // ★ DM okunmamış sayacı artık useRoomDM hook'unda

  // Gerçek zamanlı mikrofon ses seviyesi (expo-av metering)
  const localAudioLevel = useMicMeter(lk.isMicrophoneEnabled || false);

  // BUG-13 FIX: getMicStatus optimizasyonu — localAudioLevel dependency kaldırıldı
  // Ses dalga efekti için audioLevel participant update'lerden gelir 
  const localAudioLevelRef = useRef(localAudioLevel);
  localAudioLevelRef.current = localAudioLevel;

  const getMicStatus = useCallback((uid: string) => {
    const p = lk.participants.find(x => x.identity === uid);
    if (p) {
      return { speaking: p.isSpeaking || false, mic: !p.isMuted, audioLevel: p.audioLevel ?? 0, cameraOn: !!p.isCameraEnabled, videoTrack: p.videoTrack };
    }
    if (uid === firebaseUser?.uid) {
      return { speaking: localAudioLevelRef.current > 0.15, mic: lk.isMicrophoneEnabled || false, audioLevel: localAudioLevelRef.current, cameraOn: lk.isCameraEnabled || false, videoTrack: undefined };
    }
    return { speaking: false, mic: false, audioLevel: 0, cameraOn: false, videoTrack: undefined };
  }, [lk.participants, lk.isMicrophoneEnabled, lk.isCameraEnabled, firebaseUser?.uid]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !firebaseUser) return;
    // ★ SEC-PERF: DB sorgusu kaldırıldı — broadcast ile senkronize local state yeterli
    const myParticipant = participants.find(p => p.user_id === firebaseUser.uid);
    if (myParticipant?.is_chat_muted) {
      showToast({ title: '💬 Susturuldun', message: i18n.t('room.id.019'), type: 'warning' });
      return;
    }
    // ★ v110.5.9 (6 May 2026): OPTIMISTIC UPDATE — WhatsApp pattern.
    //   Eski: send → DB → realtime → UI. Realtime gecikiyorsa veya kanal kopuksa
    //   mesaj UI'da görünmüyor → kullanıcı "send tıkladım, bir şey olmadı" sanıyor.
    //   Yeni: send öncesi optimistic local mesaj eklenir → kullanıcı kendi mesajını
    //   anında görür. Server timestamp gelince real ID ile replace.
    const content = chatInput.trim();
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const myParticipantProfile = participants.find(p => p.user_id === firebaseUser.uid)?.profile;
    // ★ v110.14: Participant listesinde yoksa (dinleyici/spectator) useAuth profile fallback —
    //   önceden myProfile undefined kalıyordu, optimistic mesajda profiles boş geliyor,
    //   render fallback "...id4" tag gösteriyordu (flash bug).
    const myProfile = myParticipantProfile || profile;
    const optimisticMsg: any = {
      id: tempId,
      room_id: id,
      sender_id: firebaseUser.uid,
      user_id: firebaseUser.uid, // RoomChatDrawer'ın user_id alanı için
      content,
      created_at: new Date().toISOString(),
      profiles: myProfile ? {
        display_name: (myProfile as any).display_name || firebaseUser.displayName || 'Sen',
        avatar_url: (myProfile as any).avatar_url,
        subscription_tier: (myProfile as any).subscription_tier,
      } : { display_name: firebaseUser.displayName || 'Sen', avatar_url: undefined, subscription_tier: undefined },
      _optimistic: true,
    };
    // ★ v110.14 (8 May 2026): FlatList inverted — başa eklenen alta gelir.
    //   Önceden [...prev, optimisticMsg] sona eklendiği için inverted yüzünden
    //   en üstte görünüyordu (kendi mesajım üstte, başkasının mesajı altta).
    //   Diğer akışlar (join, system, incoming) zaten başa ekliyor; tutarlı olalım.
    setChatMessages(prev => [optimisticMsg, ...prev]);
    setChatInput(''); // Input hemen temizlenir, kullanıcı yeni mesaj yazabilir
    setTimeout(() => chatInputRef.current?.focus(), 100);

    try {
      const sentMsg = await RoomChatService.send(id as string, firebaseUser.uid, content);
      if (sentMsg) {
        // Optimistic'i gerçek server mesajıyla değiştir (id ve timestamp güncellenir)
        setChatMessages(prev => prev.map(m => m.id === tempId ? { ...sentMsg, user_id: sentMsg.sender_id } as any : m));
      } else {
        // Insert null döndü (RLS reject vs.) — optimistic kaldır + uyarı
        setChatMessages(prev => prev.filter(m => m.id !== tempId));
        showToast({ title: i18n.t('room.id.020'), message: i18n.t('room.id.021'), type: 'error' });
        return;
      }
      // ★ SP: Mesaj gönderme (30sn cooldown ile)
      GamificationService.onMessageSent(firebaseUser.uid).then(sp => {
        if (sp > 0) spToastRef.current?.show(sp, 'Mesaj');
      }).catch(() => {});
    } catch (err: any) {
      // Network/exception — optimistic kaldır + uyarı
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
      showToast({ title: i18n.t('room.id.022'), message: err?.message || i18n.t('auto.room.id.091'), type: 'error' });
    }
  };



  // ★ 2026-04-21: Dinleyici toggle logic — sheet'ten de çağrılabilsin diye ayrı fonksiyon
  const toggleListenerMicRequest = () => {
    if (myMicRequested) {
      setMyMicRequested(false);
      setMicRequests(prev => prev.filter(u => u !== firebaseUser?.uid));
      micReqChannelRef.current?.send({
        type: 'broadcast', event: 'mic_request',
        payload: { type: 'cancel', userId: firebaseUser?.uid },
      });
    } else {
      setMyMicRequested(true);
      setMicRequests(prev => {
        if (prev.includes(firebaseUser?.uid || '')) return prev;
        return [...prev, firebaseUser?.uid || ''];
      });
      micReqChannelRef.current?.send({
        type: 'broadcast', event: 'mic_request',
        payload: {
          type: 'request',
          userId: firebaseUser?.uid,
          displayName: profile?.display_name || i18n.t('auto.room.id.090'),
        },
      });
    }
  };

  // Mikrofon İSTEK handler — host/mod kuyruğu yönetir; listener mod'a göre davranır.
  // Listener için sheet AÇMAZ (gereksiz ekstra adım): tek tık ile sıraya gir/iptal et.
  const handleMicRequest = () => {
    const myRole = participants.find(p => p.user_id === firebaseUser?.uid)?.role;
    const isOnStage = room?.host_id === firebaseUser?.uid || myRole === 'moderator' || myRole === 'speaker' || myRole === 'owner';
    // ★ 2026-04-22: Host/mod LISTENER'da bile olsa queue'ya erişmeli — el kaldıranı
    //   onaylamak için sahneye çıkma zorunluluğu kaldırıldı.
    if (amIHost || amIModerator) {
      setShowMicRequests(!showMicRequests);
      return;
    }
    if (isOnStage) {
      setShowMicRequests(!showMicRequests);
      return;
    }

    // Listener akışı — mod'a göre davran
    if (speakingMode === 'selected_only') {
      showToast({
        title: '🔒 Sahne Kilitli',
        message: i18n.t('room.id.023'),
        type: 'info',
      });
      return;
    }

    // ★ 2026-04-22: Serbest mod gerçekten serbest — owner/mod sahnede olsa bile kısıt YOK.
    //   Sahne müsaitse direkt çıkar; doluysa FIFO kuyruk + auto-promote devreye girer.
    const stageFull = stageLimits.current >= stageLimits.max;
    if (speakingMode === 'free_for_all' && !stageFull && !myMicRequested) {
      handleGhostSeatPress();
      return;
    }

    // permission_only / serbest-dolu → sıraya gir veya iptal et
    toggleListenerMicRequest();
    if (!myMicRequested) {
      if (speakingMode === 'free_for_all' && stageFull) {
        showToast({ title: i18n.t('room.id.024'), message: i18n.t('room.id.025'), type: 'info' });
      } else if (stageFull) {
        showToast({ title: '⚠️ Sahne Dolu', message: `${stageLimits.current}/${stageLimits.max}. Biri inince yerini alabilirsin.`, type: 'warning' });
      } else {
        showToast({ title: i18n.t('room.id.026'), message: i18n.t('room.id.027'), type: 'success' });
      }
    }
  };

  // stageAction / stageQueuePosition memo'ları stageLimits tanımlamasından SONRA
  // (2295 civarı) yeniden ekleniyor — TDZ önlemek için.

  // ★ Mikrofon AÇ/KAPAT — sadece sahnedeki kişiler (host, mod, speaker) için çağrılır
  // ★ v319.11 (18 May 2026): Sahne dışı mic ENFORCE.
  //   Kullanıcı feedback: "sahnede değil ama ses iletiyor". Senaryo:
  //   - Sahnede iken mic açık
  //   - Host demote etti / role 'listener' oldu
  //   - LiveKit publish kapatılmadı → ses hâlâ yayınlanıyor
  //   Fix: rol değişimini izle, sahne dışında mic AUTO-OFF (güvenlik kapısı).
  useEffect(() => {
    if (!firebaseUser?.uid || !lk?.isMicrophoneEnabled) return;
    const myRole = participants.find(p => p.user_id === firebaseUser.uid)?.role;
    const onStage = myRole === 'owner' || myRole === 'speaker' || myRole === 'moderator';
    if (!onStage) {
      (async () => {
        try {
          if (lk.disableMic) await lk.disableMic();
          else if (lk.toggleMic) await lk.toggleMic();
          if (__DEV__) console.log('[MicEnforce] Sahne dışı - mic kapatıldı');
        } catch {}
      })();
    }
  }, [participants, firebaseUser?.uid, lk?.isMicrophoneEnabled]);

  // Dinleyiciler artık kontrol çubuğunda ses kısma + el kaldırma butonlarını kullanır
  const handleMicPress = async () => {
    // LiveKit bağlı değilse dokunma — donmayı önle
    if (lk.connectionState !== 'connected') {
      showToast({ title: i18n.t('room.id.028'), message: i18n.t('room.id.029'), type: 'warning' });
      return;
    }
    // Süreli susturma kontrolü — susturulan kullanıcı mikrofon açamaz
    if (firebaseUser?.uid && !lk.isMicrophoneEnabled) {
      try {
        const isMuted = await ModerationService.isRoomMuted(id as string, firebaseUser.uid);
        if (isMuted) {
          showToast({ title: '🔇 Susturuldun', message: i18n.t('room.id.030'), type: 'warning' });
          return;
        }
      } catch {}
    }
    try {
      await lk.toggleMic();
    } catch (e) {
      if (__DEV__) console.warn('[Mic] Toggle hatası:', e);
      showToast({ title: i18n.t('room.id.031'), message: i18n.t('room.id.032'), type: 'error' });
    }
  };

  // İstek onaylama — kullanıcıyı DB'de speaker'a yükselt (sahnede görünsün)
  const approveMicRequest = async (uid: string) => {
    // ★ Sahne slot limiti kontrolü
    // ★ T-2 FIX: Merkezi ownerTier kullan (inline tekrar kaldırıldı)
      const tierLimits = getRoomLimits(ownerTier as any);
      const maxSlots = tierLimits.maxSpeakers;
    const currentStageCount = participants.filter(p => ['owner', 'speaker', 'moderator'].includes(p.role)).length;
    if (currentStageCount >= maxSlots) {
      showToast({ title: 'Sahne Dolu', message: i18n.t('auto.room.id.089', { 0: maxSlots }), type: 'warning' });
      UpsellService.onStageCapacityFull(ownerTier as any);
      return;
    }
    setApprovedSpeakers(prev => [...prev, uid]);
    setMicRequests(prev => prev.filter(u => u !== uid));
    let dbWriteOk = false;
    try {
      await RoomService.promoteSpeaker(id as string, uid);
      dbWriteOk = true;
      // ★ BUG FIX: Optimistik state güncelleme — listener → speaker (UI anında sahneye taşır)
      setParticipants(prev => prev.map(p => p.user_id === uid ? { ...p, role: 'speaker' as const, is_muted: false } : p));
    } catch (e: any) {
      // ★ v85c: RPC hatası release build'de de görünsün — debug için kritik
      const msg = e?.message || e?.error_description || String(e);
      showToast({ title: i18n.t('room.id.033'), message: msg.slice(0, 200), type: 'error' });
      if (__DEV__) console.warn('[approveMic] Speaker yükseltme hatası:', e);
    }
    // ★ DB yazımı başarısızsa broadcast gönderme — diğer cihazlarda hayalet sahne yaratmasın
    if (!dbWriteOk) {
      setApprovedSpeakers(prev => prev.filter(u => u !== uid));
      return;
    }
    // ★ Broadcast: promote bildir + sistem mesajı
    modChannelRef.current?.send({
      type: 'broadcast', event: 'mod_action',
      payload: { action: 'promote', targetUserId: uid },
    });
    micReqChannelRef.current?.send({
      type: 'broadcast', event: 'mic_request',
      payload: { type: 'approved', userId: uid },
    });
    // Sistem mesajı
    const p = participants.find(x => x.user_id === uid);
    const sysMsg = {
      id: `sys_promote_${uid}_${Date.now()}`,
      room_id: id as string,
      user_id: uid,
      content: i18n.t('auto.room.id.088'),
      created_at: new Date().toISOString(),
      profiles: { display_name: p?.user?.display_name || i18n.t('auto.room.id.087') },
      isSystem: true,
    } as any;
    setChatMessages(prev => [sysMsg, ...prev].slice(0, 100));
  };

  const rejectMicRequest = (uid: string) => {
    setMicRequests(prev => prev.filter(u => u !== uid));
    // ★ İsteyen kişiye ret bildirimi gönder
    micReqChannelRef.current?.send({
      type: 'broadcast', event: 'mic_request',
      payload: { type: 'rejected', userId: uid },
    });
  };

  // ========== AYARLAR PANELİNDEN ODADAN ÇIKIŞ ==========
  const handleSettingsLeave = () => {
    if (amIHost) {
      setAlertConfig({
        visible: true, title: i18n.t('room.id.034'), message: i18n.t('room.id.035'), type: 'warning', icon: 'exit-outline',
        buttons: [
          { text: i18n.t('auto.room.id.086'), style: 'cancel' },
          { text: i18n.t('auto.room.id.085'), style: 'destructive', onPress: () => { isRoomClosingRef.current = true; handleHostLeave(); } },
        ],
      });
    } else {
      setAlertConfig({
        visible: true, title: i18n.t('room.id.036'), message: i18n.t('room.id.037'), type: 'warning', icon: 'exit-outline',
        buttons: [
          { text: i18n.t('auto.room.id.084'), style: 'cancel' },
          { text: i18n.t('auto.room.id.083'), style: 'destructive', onPress: () => { isRoomClosingRef.current = true; handleUserLeave(); } },
        ],
      });
    }
  };

  // ========== HOST: ODAYI KALICI SİL ==========
  const handleDeleteRoom = () => {
    if (!amIHost && !profile?.is_admin) return;
    // Vekil host odayı silemez — sadece asıl sahip veya admin silebilir
    if (amIActingHost && !profile?.is_admin) {
      showToast({ title: 'Yetki Yok', message: i18n.t('room.id.038'), type: 'warning' });
      return;
    }
    setAlertConfig({
      visible: true, title: i18n.t('room.id.039'), message: i18n.t('room.id.040'), type: 'error', icon: 'trash',
      buttons: [
        { text: i18n.t('auto.room.id.082'), style: 'cancel' },
        { text: i18n.t('auto.room.id.081'), style: 'destructive', onPress: async () => {
          try {
            // Broadcast: odadaki herkese bildir
            modChannelRef.current?.send({
              type: 'broadcast', event: 'mod_action',
              payload: { action: 'room_deleted', hostName: firebaseUser?.displayName || 'Oda Sahibi' },
            });
            isRoomClosingRef.current = true;
            await RoomService.deleteRoom(id as string, firebaseUser!.uid);
            liveKitService.disconnect().catch(() => {});
            setMinimizedRoom(null);
            // Başarı toast gereksiz — sayfadan çıkılıyor
            safeGoBack(router);
          } catch (e: any) {
            showToast({ title: 'Oda Silinemedi', message: e.message || i18n.t('auto.room.id.080'), type: 'error' });
          }
        }}
      ]
    });
  };

  // ========== HOST ÇIKIŞ → YETKİ ZİNCİRİ (Mod → Speaker → Tier-bazlı politika) ==========
  const handleHostLeave = async () => {
    if (!firebaseUser || !id) return;
    // Sistem odasında DB ayrılma yok
    if (isSystemRoom(id as string)) {
      liveKitService.disconnect().catch(() => {});
      setMinimizedRoom(null);
      safeGoBack(router);
      return;
    }
    try {
      // ★ Flag: cleanup effect'in tekrar close çağırmasını engelle
      isRoomClosingRef.current = true;

      // Yetki zinciri ile devret
      const result = await RoomService.transferHost(id as string, firebaseUser.uid);
      if (result.newHostId) {
        // ★ Yeni host'a broadcast bildir
        modChannelRef.current?.send({
          type: 'broadcast', event: 'mod_action',
          payload: { action: 'host_transferred', targetUserId: result.newHostId, oldHostName: profile?.display_name || 'Oda sahibi' },
        });
        // Başarı toast gereksiz — sayfadan çıkılıyor
      } else if (result.keepAlive) {
        // ★ Plus+: Oda açık kalır — sahibi dilediğinde geri dönebilir veya manuel dondurabilir
        // Başarı toast gereksiz — sayfadan çıkılıyor
      } else {
        // ★ 2026-04-22 FIX: Free + devralacak kimse yok → anında close yerine
        //   60sn COUNTDOWN başlat. Odadakilere broadcast ile uyarı gider, kimse
        //   aniden kopmaz. 60sn sonunda en yetkili client close() çağırır.
        modChannelRef.current?.send({
          type: 'broadcast', event: 'mod_action',
          payload: { action: 'room_closing_countdown', seconds: 60 },
        });
        // close'u artık burada çağırma — countdown useEffect'i 0'a ulaşınca
        // amHighestAuth olan kullanıcı close() tetikleyecek.
      }
      liveKitService.disconnect().catch(() => {});
      setMinimizedRoom(null);
      safeGoBack(router);
    } catch (e) {
      // ★ BUG FIX: Hata durumunda flag'ı sıfırla — cleanup effect leave() çağırabilsin, hayalet oluşmasın
      isRoomClosingRef.current = false;
      showToast({ title: i18n.t('room.id.041'), message: i18n.t('room.id.042'), type: 'error' });
    }
  };

  // ========== MODERATÖR/DİNLEYİCİ ÇIKIŞ ==========
  const handleUserLeave = async () => {
    if (!firebaseUser || !id) return;
    // Sistem odasında DB ayrılma yok
    if (isSystemRoom(id as string)) {
      liveKitService.disconnect().catch(() => {});
      setMinimizedRoom(null);
      safeGoBack(router);
      return;
    }
    try {
      const myRole = participants.find(p => p.user_id === firebaseUser.uid)?.role;
      const isMod = myRole === 'moderator';
      
      // Moderatör çıkıyorsa: sadece Free odalarda geri sayım başlat
      if (isMod) {
        const hasHost = participants.some(p => p.role === 'owner' && p.user_id !== firebaseUser.uid);
        const otherMods = participants.filter(p => p.role === 'moderator' && p.user_id !== firebaseUser.uid);
        
        if (!hasHost && otherMods.length === 0) {
          // Son yetki sahibi çıkıyor — sadece Free odalarda geri sayım
          const _leavePolicy = getRoomLimits(ownerTier as any).ownerLeavePolicy;
          if (_leavePolicy === 'close') {
            modChannelRef.current?.send({
              type: 'broadcast', event: 'mod_action',
              payload: { action: 'room_closing_countdown', seconds: 60 },
            });
          }
          // Plus+: Geri sayım yok — oda açık kalır
        }
      }
      
      // BUG-RD2 ek: Cleanup effect'in tekrar leave çağırmasını engelle
      isRoomClosingRef.current = true;
      await RoomService.leave(id as string, firebaseUser.uid);
      liveKitService.disconnect().catch(() => {});
      setMinimizedRoom(null);
      safeGoBack(router);
    } catch (e) {
      // ★ BUG FIX: Hata durumunda flag'ı sıfırla — cleanup effect leave() çağırabilsin, hayalet oluşmasın
      isRoomClosingRef.current = false;
      showToast({ title: i18n.t('room.id.043'), message: i18n.t('room.id.044'), type: 'error' });
    }
  };

  // ========== GERİ SAYIM ZAMANLAYICISI ==========
  useEffect(() => {
    if (closingCountdown === null) {
      if (closingTimerRef.current) {
        clearInterval(closingTimerRef.current);
        closingTimerRef.current = null;
      }
      return;
    }

    if (closingCountdown <= 0) {
      // Süre doldu — odayı kapat
      // ★ Y4 FIX: Sadece en yetkili ve en ESKİ (joined_at) katılımcı close çağırır (race condition önleme)
      const myPart = participants.find(p => p.user_id === firebaseUser?.uid);
      let amHighestAuth = false;
      if (myPart) {
        if (myPart.role === 'owner') {
          amHighestAuth = true;
        } else if (!participants.some(p => p.role === 'owner')) {
          const mods = participants.filter(p => p.role === 'moderator').sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
          if (mods.length > 0) {
            amHighestAuth = mods[0].user_id === myPart.user_id;
          } else {
            const speakers = participants.filter(p => p.role === 'speaker').sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
            if (speakers.length > 0 && speakers[0].user_id === myPart.user_id) amHighestAuth = true;
          }
        }
      }
      isRoomClosingRef.current = true;
      if (amHighestAuth) {
        RoomService.close(id as string).catch(() => {});
      }
      liveKitService.disconnect().catch(() => {});
      showToast({ title: i18n.t('room.id.045'), message: i18n.t('room.id.046'), type: 'error' });
      setMinimizedRoom(null);
      safeGoBack(router);
      return;
    }

    if (closingCountdown === 5) {
      // Son 5 saniye uyarısı
      showToast({ title: i18n.t('room.id.047'), message: i18n.t('room.id.048'), type: 'error' });
    }

    closingTimerRef.current = setTimeout(() => {
      setClosingCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => {
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
    };
  }, [closingCountdown]);

  // HOST OL — SADECE geri sayım sırasında çalışır (geri sayım yoksa devre dışı)
  const handleClaimHost = async () => {
    if (!firebaseUser || !id) return;
    // Geri sayım yoksa claim yapma (oda sahipsiz olma durumu yoksa engelle)
    if (closingCountdown === null || closingCountdown <= 0) {
      showToast({ title: i18n.t('room.id.049'), message: i18n.t('room.id.050'), type: 'warning' });
      return;
    }
    // ★ BUG-R2 FIX: Yetki kontrolü — banned/spectator/guest host olamaz (frontend quick-check)
    const myPart = participants.find(p => p.user_id === firebaseUser.uid);
    if (!myPart || ['banned', 'spectator', 'guest'].includes(myPart.role)) {
      showToast({ title: 'Yetki Yok', message: i18n.t('room.id.051'), type: 'warning' });
      return;
    }
    try {
      // ★ K1 FIX: Backend guard — raw Supabase query yerine RoomService kullan
      await RoomService.claimHost(id as string, firebaseUser.uid);
      // Geri sayımı iptal et
      setClosingCountdown(null);
      // Tüm odaya bildir
      modChannelRef.current?.send({
        type: 'broadcast', event: 'mod_action',
        payload: { action: 'host_claimed', hostName: profile?.display_name || 'Birisi' },
      });
      showToast({ title: '👑 Host Oldun!', message: i18n.t('room.id.052'), type: 'success' });
      // BUG-RM5 FIX: Optimistik state güncelleme
      setRoom(prev => prev ? { ...prev, host_id: firebaseUser.uid } : prev);
      setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'owner' as const } : p));
      // Ek olarak tam veriyi de çek (arka planda)
      RoomService.get(id as string).then(setRoom).catch(() => {});
    } catch (e: any) {
      showToast({ title: i18n.t('room.id.053'), message: e?.message || i18n.t('auto.room.id.079'), type: 'error' });
    }
  };



  // ========== SAHNEDEN İNME (Self-Demote) ==========
  // ★ 2026-04-21 FIX: Rol bazlı akış — owner/moderator/speaker her biri farklı DB işlemi gerektirir.
  //   Önceki: Hepsi demoteSpeaker() çağırıyordu → demote_speaker_atomic RPC owner'ı reddediyordu
  //   ("owner demote edilemez" hatası) → düğme sessizce başarısız oluyordu.
  //   Şimdi: owner → doğrudan listener'a güncelle, mod → removeModerator, speaker → demoteSpeaker.
  const handleSelfDemote = async () => {
    try {
      if (firebaseUser?.uid) {
        // ★ 2026-04-24 FIX: Sahneden inince hem mic HEM kamera kapatılmalı.
        //   Eskiden sadece mic kapatılıyordu → kamera arka planda açık kalıyordu
        //   → sahneye geri çıkınca otomatik açılıyor, kamera limiti sorunları yaratıyordu.
        if (lk.isCameraEnabled) await lk.disableCamera();
        if (lk.isMicrophoneEnabled) await lk.toggleMic();

        const myPart = participants.find(p => p.user_id === firebaseUser.uid);
        const myRole = myPart?.role;

        if (myRole === 'owner') {
          // ★ Owner sahneden iniyor — rol listener'a düş, ama host_id hâlâ o.
          //   rejoinAsOwner ile geri çıkabilir. demoteSpeaker RPC owner'ı reddeder,
          //   bu yüzden doğrudan update yapıyoruz.
          await supabase
            .from('room_participants')
            .update({ role: 'listener', is_muted: false })
            .eq('room_id', id as string)
            .eq('user_id', firebaseUser.uid);
          // listener_count artır
          try { await supabase.rpc('increment_listener_count', { room_id_input: id as string }); } catch {}
        } else if (myRole === 'moderator') {
          // ★ Moderatör sahneden iniyor — removeModerator speaker yapar, ama biz listener istiyoruz.
          //   İki adımlı: önce speaker'a düşür sonra listener'a. Tek adımda yapılabilir:
          await supabase
            .from('room_participants')
            .update({ role: 'listener', is_muted: false })
            .eq('room_id', id as string)
            .eq('user_id', firebaseUser.uid);
          try { await supabase.rpc('increment_listener_count', { room_id_input: id as string }); } catch {}
        } else {
          // ★ Normal speaker — standart demote akışı
          await RoomService.demoteSpeaker(id as string, firebaseUser.uid);
        }

        // ★ BUG FIX: 'self_demote' broadcast — kendi ModerationOverlay'ını tetiklemesin
        modChannelRef.current?.send({ type: 'broadcast', event: 'mod_action', payload: { action: 'self_demote', targetUserId: firebaseUser.uid } });
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser!.uid ? { ...p, role: 'listener' as const } : p));
        // ★ BUG FIX: Sahneden inince el kaldırma durumunu sıfırla — aksi halde sırada kalır
        setMyMicRequested(false);
        setMicRequests(prev => prev.filter(u => u !== firebaseUser!.uid));
        // Diğer cihazlara da bildir — kuyruktan çıksın
        micReqChannelRef.current?.send({
          type: 'broadcast', event: 'mic_request',
          payload: { type: 'cancel', userId: firebaseUser.uid },
        });
        // ★ v107.39: "Sahneden İndin" toast KALDIRILDI (kullanıcı talebi)
      }
    } catch (e: any) {
      if (__DEV__) console.warn('[SelfDemote] Hata:', e?.message);
      showToast({ title: i18n.t('room.id.054'), message: i18n.t('room.id.055'), type: 'error' });
    }
  };


  // ★ Moderasyon fonksiyonları useRoomModeration hook'una taşındı


  // ★ ARCH-1: Room timer → useRoomLifecycle hook'undan geliyor (yukarıda çağrıldı)
  // Not: useRoomLifecycle zaten render'ın üstünde çağrılıyor — roomDuration/roomExpiry oradan gelecek
  // Geçici: inline kalıyor çünkü lifecycle hook return'unu burada kullanamıyoruz (hook çağrı sırası)
  const [roomDuration, setRoomDuration] = useState('0 dk');
  const [roomExpiry, setRoomExpiry] = useState('');
  const expiryWarningsRef = useRef<Set<string>>(new Set()); // ★ Tekrar uyarı önleme
  useEffect(() => {
    if (!room?.created_at) return;
    expiryWarningsRef.current.clear();
    const isHost = room.host_id === firebaseUser?.uid;
    const updateDuration = () => {
      const diff = Date.now() - new Date(room.created_at).getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      if (hrs > 0) setRoomDuration(i18n.t('rooms.hours_minutes_short', { hours: hrs, minutes: mins % 60 }));
      else setRoomDuration(i18n.t('rooms.minutes_short', { count: mins }));
      if (room.expires_at) {
        const remaining = new Date(room.expires_at).getTime() - Date.now();
        if (remaining <= 0) {
          const _t = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as any;
          UpsellService.onRoomDurationExpired(_t);
          setRoomExpiry(i18n.t('auto.room.id.078'));
          if (isHost) {
            showToast({ title: i18n.t('room.id.056'), message: i18n.t('room.id.057'), type: 'warning', id: 'room_expired' });
            setTimeout(async () => { try { await RoomService.close(id as string); liveKitService.disconnect().catch(() => {}); setMinimizedRoom(null); safeGoBack(router); } catch {} }, 3000);
          } else {
            showToast({ title: i18n.t('room.id.058'), message: i18n.t('room.id.059'), type: 'warning', id: 'room_expired' });
            setTimeout(() => { liveKitService.disconnect().catch(() => {}); setMinimizedRoom(null); safeGoBack(router); }, 5000);
          }
          return;
        }
        const remMins = Math.floor(remaining / 60000);
        const remHrs = Math.floor(remMins / 60);
        if (remHrs > 0) setRoomExpiry(i18n.t('rooms.hours_minutes_remaining', { hours: remHrs, minutes: remMins % 60 }));
        else setRoomExpiry(i18n.t('rooms.minutes_remaining', { count: remMins }));

        // ★ Süre azalma uyarıları — 15dk ve 5dk kala
        if (remMins <= 15 && remMins > 5 && !expiryWarningsRef.current.has('15min')) {
          expiryWarningsRef.current.add('15min');
          if (isHost) {
            showToast({
              title: i18n.t('room.id.060'),
              message: i18n.t('room.id.061'),
              type: 'upsell',
              duration: 5000,
              id: 'room_15min_warn',
              action: { label: i18n.t('room.id.062'), onPress: () => minimizeAndPush('/plus') },
            });
          } else {
            showToast({ title: i18n.t('room.id.063'), message: 'Bu oda 15 dakika sonra kapanacak.', type: 'info', id: 'room_15min_warn' });
          }
        }
        if (remMins <= 5 && !expiryWarningsRef.current.has('5min')) {
          expiryWarningsRef.current.add('5min');
          if (isHost) {
            showToast({
              title: '🚨 Son 5 dakika!',
              message: i18n.t('room.id.064'),
              type: 'warning',
              duration: 6000,
              id: 'room_5min_warn',
              action: { label: i18n.t('room.id.065'), onPress: () => minimizeAndPush('/plus') },
            });
          } else {
            showToast({ title: '🚨 Son 5 dakika!', message: i18n.t('room.id.066'), type: 'warning', id: 'room_5min_warn' });
          }
        }
      }
    };
    updateDuration();
    const remaining = room.expires_at ? new Date(room.expires_at).getTime() - Date.now() : Infinity;
    // ★ Akıllı interval: son 2dk'da her 5sn, son 20dk'da her 15sn, yoksa 30sn
    const interval = remaining < 120000 ? 5000 : remaining < 1200000 ? 15000 : 30000;
    const timer = setInterval(updateDuration, interval);
    return () => clearInterval(timer);
  }, [room?.created_at, room?.expires_at]);
  // ★ 2026-04-24: Minimize restore'da expand animasyonu zaten geçişi yaptı →
  //   fadeIn 1 ile başlar (tekrar fade yok). İlk girişte 0 ile başlar.
  //   wasRestoringFromMinimize: mount anındaki isRestoringFromMinimize değerini saklar
  const wasRestoringRef = useRef(isRestoringFromMinimize);
  const fadeIn = useRef(new Animated.Value(wasRestoringRef.current ? 1 : 0)).current;
  useEffect(() => {
    // Sadece ilk girişte (minimize dışı) fade-in uygula
    if (room && !wasRestoringRef.current) {
      Animated.timing(fadeIn, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [!!room]);
  // Rol Dağılımları — useMemo ile cache'le (performans)
  const { stageUsers, listenerUsers, spectatorUsers, viewerCount, amIHost, amIModerator, amIGodMaster, canModerate, isGodOrHost, hostUser, amIActingHost, isOriginalHost, isStageDelegate } = useMemo(() => {
    // ★ 2026-05-10 SAHNE FIX: Mount/giriş sırasında DB'de host'un katılım kaydı henüz yoksa
    //   (RoomService.join async, 9sn sürebiliyor) sahne "boş" gözüküyordu. Render seviyesinde
    //   room.host_id varsa host'u synthesize et — owner rolüyle stage'de hep görünsün.
    //   DB'den gerçek kayıt geldiğinde realtime callback override eder.
    // ★ v309 (18 May 2026) KRİTİK FIX: synthesize SADECE asıl sahip durumda.
    //   Eskiden tüm kullanıcılar için synthesize yapılıyordu → host odadan çıkınca dahi
    //   diğer kullanıcılar UI'da sahnede görüyor (ZOMBI HOST). Şimdi:
    //   - Ben asıl sahip'im: synthesize uygula (kendi loading'imi gizle)
    //   - Ben asıl sahip değilim: DB'den gerçek katılımları al
    // ★ v319.2 (18 May 2026) EK FIX: original_host_id varsa, host_id geçici host'tur.
    //   Geçici host (FIRAT) host_id olsa da synthesize ETMEMELI — kendini sahnede
    //   "owner" olarak sahte göstermesin. Memory: "başkasının odasında host olunmaz".
    let _participants = participants;
    const _origHostIdSynth = (room?.room_settings as any)?.original_host_id as string | undefined;
    const iAmActualOwner = _origHostIdSynth
      ? _origHostIdSynth === firebaseUser?.uid
      : room?.host_id === firebaseUser?.uid;
    if (iAmActualOwner && room?.host_id && !participants.some(p => p.user_id === room.host_id)) {
      const hj: any = (room as any).host;
      _participants = [...participants, {
        id: `_synth_host_${room.host_id}`,
        room_id: room.id,
        user_id: room.host_id,
        role: 'owner' as const,
        is_muted: false,
        joined_at: new Date().toISOString(),
        user: hj ? {
          id: room.host_id,
          display_name: hj.display_name,
          avatar_url: hj.avatar_url,
          subscription_tier: hj.subscription_tier,
          active_frame: hj.active_frame,
          active_chat_color: hj.active_chat_color,
        } : undefined,
        _synthetic: true,
      } as any];
    }
    // Banned kullanıcıları filtrele
    // ★ v319.6 (18 May 2026): Hayalet kullanıcı fix — presence-based filter.
    //   Realtime channel'a track edilmiş user_id'ler online sayılır.
    //   onlineUserIds boşsa (henüz subscribe edilmedi) filter atlanır (graceful start).
    //   Kendi user_id'm hep dahil edilir (presence sync henüz değilse de UI'da gözükeyim).
    //   Synthetic host (_synth_orig_host) presence-bypass — asıl sahip her zaman görünebilir.
    const _presenceReady = onlineUserIds.size > 0;
    const active = _participants.filter(p => {
      if (p.role === 'banned') return false;
      if (!_presenceReady) return true;
      if (p.user_id === firebaseUser?.uid) return true;
      if ((p as any)._synthetic) return true;
      return isUserOnline(p.user_id);
    });

    const stage = active.filter(p => p.role === 'owner' || p.role === 'speaker' || p.role === 'moderator');
    // ★ BUG-C FIX: Listener ve Spectator ayrı — spectator'lar grid'de görünmez
    const listeners = active.filter(p => p.role === 'listener');
    const spectators = active.filter(p => p.role === 'spectator' || p.role === 'guest');
    // ★ v319.6 (18 May 2026): amIHost semantic fix — eskiden sadece host_id == me
    //   kontrolü vardı. Geçici host (host_id transfer almış FIRAT) için TRUE dönüp
    //   UI'da "host" yetkileri/işaretleri gösteriyordu — kullanıcı feedback:
    //   "başkasının odasında oda sahibi olarak kalmış". Yeni mantık:
    //     - orig_host_id varsa: amIHost = (orig_host == me) — sadece asıl sahip
    //     - orig_host_id yoksa: amIHost = (host_id == me) — legacy oda
    //   Geçici host artık ayrı _amIActingHost olarak işlenir.
    const _origHostIdRoom = (room?.room_settings as any)?.original_host_id as string | undefined;
    const _amIHost = _origHostIdRoom
      ? _origHostIdRoom === firebaseUser?.uid
      : room?.host_id === firebaseUser?.uid;
    const _amIMod = active.some(p => p.user_id === firebaseUser?.uid && p.role === 'moderator');
    const _amIGod = profile?.is_admin === true;
    // ★ Vekil owner / geçici host: host_id == me ama asıl sahip değilim.
    //   v319.6: temp host (orig_host varsa) veya participant role='owner' ama host_id farklı.
    const _amITempHost = !!_origHostIdRoom && room?.host_id === firebaseUser?.uid && _origHostIdRoom !== firebaseUser?.uid;
    const _amIActingHost = _amITempHost || (!_amIHost && active.some(p => p.user_id === firebaseUser?.uid && p.role === 'owner'));
    const _isOriginalHost = _amIHost && !_origHostIdRoom;
    const _canMod = _amIHost || _amIActingHost || _amIMod || _amIGod;
    // ★ v92 (1 May 2026): Sahne delegasyonu — odada owner/moderator yoksa sahnedeki
    //   speaker'lar mic istek onayı verebilir (RPC promote_speaker_atomic'te de bu mantık var).
    const _myRole = active.find(p => p.user_id === firebaseUser?.uid)?.role;
    const _hasAuthorityInRoom = active.some(p => p.role === 'owner' || p.role === 'moderator');
    const _isStageDelegate = _myRole === 'speaker' && !_hasAuthorityInRoom;
    const _isGodOrHost = _amIHost || _amIActingHost || _amIGod;
    // ★ v319.5 (18 May 2026): hostUser hesabı orig_host_id'ye öncelik verir — geçici host
    //   transfer edilmiş odalarda UI "oda sahibi" olarak asıl sahibi göstermeli (Burak DENIZ),
    //   participant listesinde aktif olmasa bile (room.host applyOriginalHostOverride'den
    //   asıl sahibin profile'ını içerir).
    const _targetHostIdUI = _origHostIdRoom || room?.host_id;
    let _hostUser: any = active.find(p => p.user_id === _targetHostIdUI)
      || active.find(p => p.role === 'owner');
    if (!_hostUser && _targetHostIdUI && (room as any)?.host) {
      _hostUser = {
        id: `_synth_orig_host_${_targetHostIdUI}`,
        room_id: room?.id,
        user_id: _targetHostIdUI,
        role: 'owner' as const,
        is_muted: false,
        joined_at: new Date().toISOString(),
        user: (room as any).host,
        _synthetic: true,
      };
    }

    // Ghost filtreleme — owner/mod tüm ghost'ları görür, diğerleri görmez
    const canSeeGhosts = _canMod;
    const visibleStage = canSeeGhosts ? stage : stage.filter(p => !(p as any).is_ghost || p.user_id === firebaseUser?.uid);
    const visibleListeners = canSeeGhosts ? listeners : listeners.filter(p => !(p as any).is_ghost || p.user_id === firebaseUser?.uid);
    const visibleSpectators = canSeeGhosts ? spectators : spectators.filter(p => !(p as any).is_ghost || p.user_id === firebaseUser?.uid);

    // ★ O3 FIX: viewerCount ghost kullanıcıları sayma (non-mod görüntüleyenler için).
    // Mod/host ghost'ları görür, sayaçta da görünsün.
    const visibleTotal = visibleStage.length + visibleListeners.length + visibleSpectators.length;
    const _viewerCount = canSeeGhosts ? active.length : visibleTotal;

    return { stageUsers: visibleStage, listenerUsers: visibleListeners, spectatorUsers: visibleSpectators, viewerCount: _viewerCount, amIHost: _amIHost || _amIActingHost, amIModerator: _amIMod, amIGodMaster: _amIGod, canModerate: _canMod, isGodOrHost: _isGodOrHost, hostUser: _hostUser, amIActingHost: _amIActingHost, isOriginalHost: _isOriginalHost, isStageDelegate: _isStageDelegate };
  }, [participants, room, firebaseUser?.uid, profile?.is_admin, onlineUserIds, isUserOnline]);

  // ★ 2026-04-21: Minimize payload ref her render taze tutulur — toast/upsell closure'larında
  // stale olmaması için gerekli. Toast action'ları 15/5 dk sonra tetikleniyor.
  useEffect(() => {
    minimizePayloadRef.current = {
      id: id as string,
      name: room?.name || 'Oda',
      hostName: hostUser?.user?.display_name || 'Host',
      viewerCount,
      isMicOn: lk.isMicrophoneEnabled || false,
    };
  });

  // ★ Mevcut rolümü belirle (özellik erisiÌ‡mi için)
  const myCurrentRole: 'owner' | 'moderator' | 'speaker' | 'listener' = useMemo(() => {
    if (amIHost) return 'owner';
    if (amIModerator) return 'moderator';
    const myPart = participants.find(p => p.user_id === firebaseUser?.uid);
    if (myPart?.role === 'speaker') return 'speaker';
    return 'listener';
  }, [amIHost, amIModerator, participants, firebaseUser?.uid]);

  // ★ v32 Caretaker modu — owner/mod yokken listener sahneye kendi çıkabilir (süreli)
  const isCaretakerMode = useMemo(() => {
    const hasAuthority = participants.some(p =>
      (p.role === 'owner' || p.role === 'moderator') && !(p as any).is_ghost
    );
    return !hasAuthority;
  }, [participants]);

  // Sahnedeki slot sayısı (caretaker buton disable kararı için)
  const stageLimits = useMemo(() => {
    const tier = migrateLegacyTier((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free');
    const limits = getRoomLimits(tier);
    const current = participants.filter(p => ['owner', 'moderator', 'speaker'].includes(p.role)).length;
    return { current, max: limits.maxSpeakers };
  }, [participants, room]);

  // ★ Listener stage button davranışı — RoomControlBar'a prop olarak geçilir.
  // 'direct_join' | 'raise_hand' | 'waiting' | 'locked'
  // ★ 2026-04-22: authorityOnStage kontrolü kaldırıldı — "Serbest" gerçekten serbest.
  const stageAction = useMemo<'direct_join' | 'raise_hand' | 'waiting' | 'locked'>(() => {
    const myRole = participants.find(p => p.user_id === firebaseUser?.uid)?.role;
    const isOnStage = room?.host_id === firebaseUser?.uid
      || myRole === 'moderator' || myRole === 'speaker' || myRole === 'owner';
    if (isOnStage) return 'raise_hand'; // listener değil; prop ignore edilecek
    if (myMicRequested) return 'waiting';
    if (speakingMode === 'selected_only') return 'locked';
    const stageFull = stageLimits.current >= stageLimits.max;
    if (speakingMode === 'free_for_all' && !stageFull) {
      return 'direct_join';
    }
    return 'raise_hand';
  }, [participants, firebaseUser?.uid, room?.host_id, speakingMode, myMicRequested, stageLimits.current, stageLimits.max]);

  const stageQueuePosition = useMemo(() => {
    if (!myMicRequested || !firebaseUser?.uid) return 0;
    const idx = micRequests.indexOf(firebaseUser.uid);
    return idx >= 0 ? idx + 1 : 0;
  }, [myMicRequested, micRequests, firebaseUser?.uid]);

  // ★ 2026-04-22: SERBEST MOD AUTO-PROMOTE
  //   free_for_all + kuyruktayım + kuyruğun ilki benim + sahne müsait → otomatik promote.
  //   Her client kendi adına çağırır; RPC atomic (slot doluysa fail eder, race-free).
  const autoPromoteThrottleRef = useRef(0);
  useEffect(() => {
    if (speakingMode !== 'free_for_all') return;
    if (!myMicRequested || !firebaseUser?.uid || !room?.id) return;
    if (stageQueuePosition !== 1) return; // sadece kuyruktaki ilk kişi tetikler
    const myRole = participants.find(p => p.user_id === firebaseUser.uid)?.role;
    if (myRole === 'speaker' || myRole === 'owner' || myRole === 'moderator') return; // zaten sahnede
    if (stageLimits.current >= stageLimits.max) return; // hâlâ dolu

    const now = Date.now();
    if (now - autoPromoteThrottleRef.current < 1500) return; // 1.5sn throttle
    autoPromoteThrottleRef.current = now;

    (async () => {
      try {
        await RoomService.promoteSpeaker(room.id, firebaseUser!.uid);
        // ★ v67 FIX: Sahneye çıktıktan hemen sonra heartbeat gönder —
        //   stale last_seen_at ile cleanup'a yakalanmayı önle.
        RoomService.updateLastSeen(room.id, firebaseUser!.uid).catch(() => {});
        // Optimistic: micRequest'i temizle, rol güncelle
        setParticipants(prev => prev.map(p =>
          p.user_id === firebaseUser!.uid ? { ...p, role: 'speaker' as const, is_muted: false } : p
        ));
        setMyMicRequested(false);
        setMicRequests(prev => prev.filter(u => u !== firebaseUser!.uid));
        micReqChannelRef.current?.send({
          type: 'broadcast', event: 'mic_request',
          payload: { type: 'cancel', userId: firebaseUser!.uid },
        });
        showToast({ title: i18n.t('room.id.067'), message: i18n.t('room.id.068'), type: 'success' });
        setTimeout(() => { lk.enableMic?.().catch(() => {}); }, 500);
      } catch (e: any) {
        // Slot dolu hata gelirse sessiz kal — sonraki tick'te tekrar dener
        if (__DEV__) console.warn('[AutoPromote] fail:', e?.message);
      }
    })();
  }, [speakingMode, myMicRequested, stageQueuePosition, participants, stageLimits.current, stageLimits.max, firebaseUser?.uid, room?.id, lk]);

  // Kendi participant kaydım — cooldown kontrol için stage_expires_at kullanılır
  const myParticipant = useMemo(
    () => participants.find(p => p.user_id === firebaseUser?.uid),
    [participants, firebaseUser?.uid]
  );

  // ★ 2026-04-22 v9: Welcome overlay — SP toast stili fade-in/out (daha küçük, farklı)
  const [welcomeOverlay, setWelcomeOverlay] = useState<{ name: string; msg: string } | null>(null);
  const welcomeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!room?.id || !firebaseUser?.uid) return;
    // ★ 2026-04-27 FIX: Access onaylanmadan welcome tetiklenmesin — şifre/davet sheet
    //   arkasında "Hoşgeldin" mesajı belirip kafa karışıklığı yaratıyordu.
    if (accessGranted !== true) return;
    const welcomeMsg = ((room.room_settings as any)?.welcome_message || '').toString().trim();
    if (welcomeMsg.length === 0) return;

    (async () => {
      try {
        const AS = require('@react-native-async-storage/async-storage').default;
        const hash = welcomeMsg.length + '_' + welcomeMsg.slice(0, 10);
        const key = `welcomed_v9_${room.id}_${firebaseUser.uid}_${hash}`;
        const alreadyShown = await AS.getItem(key);
        if (alreadyShown) return;

        const myName = (profile as any)?.display_name || firebaseUser.displayName || i18n.t('auto.room.id.077');
        setWelcomeOverlay({ name: myName, msg: welcomeMsg });
        await AS.setItem(key, new Date().toISOString());

        // Fade in → sabit → fade out (SP toast tarzı)
        welcomeAnim.setValue(0);
        Animated.sequence([
          Animated.timing(welcomeAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
          Animated.delay(4200),
          Animated.timing(welcomeAnim, { toValue: 2, duration: 500, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ]).start(() => {
          setWelcomeOverlay(null);
        });
      } catch {}
    })();
  }, [room?.id, firebaseUser?.uid, accessGranted]);

  // ★ 2026-04-22: Heartbeat — her 20sn last_seen_at güncelle (zombie participant önleme)
  useEffect(() => {
    if (!firebaseUser?.uid || !id) return;
    // İlk hemen
    RoomService.updateLastSeen(id as string, firebaseUser.uid).catch(() => {});
    const hb = setInterval(() => {
      RoomService.updateLastSeen(id as string, firebaseUser!.uid).catch(() => {});
    }, 20000);
    return () => clearInterval(hb);
  }, [id, firebaseUser?.uid]);

  // ★ 2026-04-22: Stale cleanup — app force-close edilmiş zombie'leri sil.
  //   ★ 2026-04-26 v67 FIX: Interval 30sn → 60sn, eşik 45sn → 120sn.
  //   Önceki 30sn interval + 45sn eşik kombinasyonu çok agresifti — sahneye çıkan
  //   kullanıcı JS thread yoğunluğunda (LiveKit audio) tek heartbeat kaçırdığında
  //   cleanup tarafından siliniyordu.
  useEffect(() => {
    if (!id) return;
    // ★ 2026-04-23: Gün sonu donmuş oda temizliği — oda açılışında 1 kez çalışır
    RoomService.cleanupFrozenRooms().catch(() => {});
    const cu = setInterval(() => {
      RoomService.cleanupStaleParticipants(id as string).catch(() => {});
    }, 60000);
    return () => clearInterval(cu);
  }, [id]);

  // ★ v32 Caretaker timer — kendi sahnemden otomatik in'erim
  // Owner/mod gelince trigger zaten stage_expires_at'i NULL yapar, o zaman bu effect
  // unmount olur (myStageExpiresAt değişir).
  const myStageExpiresAt = (myParticipant as any)?.stage_expires_at as string | undefined;
  useEffect(() => {
    if (!myStageExpiresAt || myParticipant?.role !== 'speaker') return;
    const msUntilExpire = new Date(myStageExpiresAt).getTime() - Date.now();
    if (msUntilExpire <= 0) return;

    // Son 30 saniye uyarısı
    const warnMs = msUntilExpire - 30_000;
    const warnTimer = warnMs > 0 ? setTimeout(() => {
      showToast({ title: i18n.t('room.id.069'), message: i18n.t('room.id.070'), type: 'warning' });
    }, warnMs) : null;

    // Süre bittiğinde server cleanup çağır; realtime row update ile rol 'listener'a geçer
    const expireTimer = setTimeout(() => {
      RoomService.releaseExpiredCaretakers().catch(() => {});
      // ★ v107.39: Sahne süresi dolma toast KALDIRILDI (kullanıcı talebi)
      // Local optimistic
      setParticipants(prev => prev.map(p =>
        p.user_id === firebaseUser?.uid
          ? { ...p, role: 'listener' as const, is_muted: false }
          : p
      ));
    }, msUntilExpire);

    return () => {
      if (warnTimer) clearTimeout(warnTimer);
      clearTimeout(expireTimer);
    };
  }, [myStageExpiresAt, myParticipant?.role, firebaseUser?.uid]);

  // Caretaker claim handler — 5 dk sahne, 60sn cooldown
  const handleClaimStage = useCallback(async () => {
    if (!firebaseUser?.uid || !id) return;
    try {
      const result = await RoomService.claimStageSeat(id as string, firebaseUser.uid);
      // ★ v107.39: "Sahnedesiniz" toast KALDIRILDI
      // Local optimistic — realtime row update zaten gelecek ama hızlı olsun
      setParticipants(prev => prev.map(p =>
        p.user_id === firebaseUser.uid
          ? { ...p, role: 'speaker' as const, stage_expires_at: result.expires_at, is_muted: false }
          : p
      ));
      // ★ 2026-04-20 FIX: Sahneye çıkınca mikrofonu otomatik aç
      setTimeout(() => { lk.enableMic?.().catch(() => {}); }, 500);
    } catch (err: any) {
      const msg = err?.message || i18n.t('auto.room.id.076');
      const isCooldown = /bekleme|cooldown|biraz bekle|\d+\s*saniye/i.test(msg);
      const isFull = /dolu/i.test(msg);
      // ★ v107.27: "Önce odaya katılmalısın" hatası → DB row eksik (bağlantı düşmüş ama UI'da odada).
      //   Otomatik RoomService.join çağır + tekrar claim dene (sessiz auto-rejoin).
      const isNotJoined = /odaya katılmalısın|Önce odaya/i.test(msg);
      if (isNotJoined && firebaseUser?.uid && id) {
        try {
          if (__DEV__) console.log('[ClaimStage] auto-rejoin: re-join + retry claim');
          await RoomService.join(id as string, firebaseUser.uid, 'listener');
          // Tek retry — yine başarısız olursa normal hata mesajına düşer
          const retry = await RoomService.claimStageSeat(id as string, firebaseUser.uid);
          // ★ v107.39: Auto-rejoin "Sahnedesiniz" toast KALDIRILDI
          setParticipants(prev => prev.map(p =>
            p.user_id === firebaseUser.uid
              ? { ...p, role: 'speaker' as const, stage_expires_at: retry.expires_at, is_muted: false }
              : p
          ));
          setTimeout(() => { lk.enableMic?.().catch(() => {}); }, 500);
          return;
        } catch (retryErr: any) {
          if (__DEV__) console.warn('[ClaimStage] auto-rejoin failed:', retryErr?.message);
          // Retry de başarısız → normal hata mesajına düşer (aşağıda)
        }
      }

      // ★ 2026-04-22: Cooldown hatasında kullanıcının stage_expires_at'inden kalan süreyi
      //   hesapla — SQL v51 "Henüz cooldown süresinde" döndürüyor ama saniye vermiyor.
      //   Eski davranış: "Bekleme süresi: X saniye" — toast'ı yeniden inşa et.
      let finalMsg = msg;
      if (isCooldown) {
        const myPart = participants.find(p => p.user_id === firebaseUser?.uid);
        const expiresAt = (myPart as any)?.stage_expires_at;
        if (expiresAt) {
          const remainSec = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
          if (remainSec > 0) finalMsg = i18n.t('auto.room.id.075', { 0: remainSec });
        }
      }

      showToast({
        title: isFull ? '🚫 Sahne Dolu' : isCooldown ? '⏳ Bekle' : 'Hata',
        message: finalMsg,
        type: 'warning',
      });
    }
  }, [firebaseUser?.uid, id, setParticipants, lk, participants]);

  // ★ Owner tier'ı — oda yönetim özelliklerinin tier kilidini belirler
  const ownerTier = useMemo(() => {
    // ★ GodMaster FIX: GodMaster tier'ı koruyarak kullan — Pro'ya düşürme
    if (profile?.subscription_tier === 'GodMaster') return 'GodMaster';
    // Admin (non-GodMaster) her zaman Pro gibi davranır
    if (profile?.is_admin) return 'Pro';
    // ★ 2026-04-20 FIX: Oda sahibi kendi odasındaysa CURRENT tier kullan.
    //   Stale rooms.owner_tier column'u (oda kurulurken kaydediliyor, güncellenmiyor)
    //   Pro→Free cancel sonrası hâlâ Pro gibi davranıyordu → free kullanıcı in-room
    //   Pro ayarlarını değiştirebiliyordu. Host match ise profile.subscription_tier önce.
    const isHostSelf = room?.host_id === firebaseUser?.uid;
    const raw = isHostSelf
      ? (profile?.subscription_tier || 'Free')
      : ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free');
    return migrateLegacyTier(raw);
  }, [room, profile?.subscription_tier, profile?.is_admin, firebaseUser?.uid]);

  // ★ Moderasyon aksiyonları — çıkarılmış hook
  const {
    handlePromoteToStage,
    handleKickUser,
    handleToggleChatMute,
    handleToggleModerator,
    handleTimedMuteUser,
    executeUnmute,
    handleGhostToggle,
    handleSelfDisguiseToggle,
    handleTempBan,
    handlePermBan,
    handleReportUser,
    handleBlockUser,
  } = useRoomModeration({
    roomId: id as string,
    room,
    firebaseUser,
    profile,
    participants,
    ownerTier,
    modChannelRef,
    setSelectedUser,
    setParticipants,
    setChatMessages,
    setAlertConfig,
    lk,
    setAvatarFlash,
  });

  // ★ ARCH-1: Gamification (CCU, SP triggers, system prompt) → useRoomGamification hook
  const { roomStats: gamificationStats } = useRoomGamification({
    roomId: id as string,
    firebaseUser,
    profile,
    room,
    myCurrentRole,
    participantCount: participants.length,
    isCameraEnabled: lk.isCameraEnabled || false,
    spToastRef,
  });
  // roomStats state'ini gamification hook'tan sync et
  useEffect(() => {
    setRoomStats(prev => ({
      ...prev,
      peakCCU: Math.max(prev.peakCCU, gamificationStats.peakCCU),
      totalUniqueListeners: Math.max(prev.totalUniqueListeners, gamificationStats.totalUniqueListeners),
    }));
  }, [gamificationStats.peakCCU, gamificationStats.totalUniqueListeners]);

  // ★ Pro: Tümünü Sustur
  const handleMuteAll = useCallback(async () => {
    if (!room || !firebaseUser) return;
    setAlertConfig({
      visible: true, title: i18n.t('room.id.071'), message: i18n.t('room.id.072'),
      type: 'warning', icon: 'volume-mute',
      buttons: [
        { text: i18n.t('auto.room.id.074'), style: 'cancel' },
        { text: 'Sustur', onPress: async () => {
          const stagePeople = participants.filter(p => (p.role === 'speaker' || p.role === 'moderator') && p.user_id !== firebaseUser.uid);
          await Promise.all(stagePeople.map(async (p) => {
            try {
              await supabase.from('room_participants').update({ is_muted: true }).eq('room_id', room.id).eq('user_id', p.user_id);
            } catch {}
          }));
          setParticipants(prev => prev.map(p =>
            (p.role === 'speaker' || p.role === 'moderator') && p.user_id !== firebaseUser.uid
              ? { ...p, is_muted: true } : p
          ));
          modChannelRef.current?.send({ type: 'broadcast', event: 'mod_action', payload: { action: 'mute_all' } });
          showToast({ title: i18n.t('room.id.073'), message: i18n.t('auto.room.id.073', { 0: stagePeople.length }), type: 'success' });
        }},
      ],
    });
  }, [room, firebaseUser, participants]);

  // ★ 2026-04-19 Pro: Tümünü Aç — mute_all'un tersi
  const handleUnmuteAll = useCallback(async () => {
    if (!room || !firebaseUser) return;
    setAlertConfig({
      visible: true, title: i18n.t('room.id.074'), message: i18n.t('room.id.075'),
      type: 'info', icon: 'volume-high',
      buttons: [
        { text: i18n.t('auto.room.id.072'), style: 'cancel' },
        { text: i18n.t('auto.room.id.071'), onPress: async () => {
          const stagePeople = participants.filter(p => (p.role === 'speaker' || p.role === 'moderator') && p.user_id !== firebaseUser.uid);
          await Promise.all(stagePeople.map(async (p) => {
            try {
              await supabase.from('room_participants').update({ is_muted: false }).eq('room_id', room.id).eq('user_id', p.user_id);
              // ★ 2026-04-19: room_mutes temizle — moderatörün önceden mute ettiği
              // kullanıcılar için pending mute kayıtları kalmasın (tutarsızlık önleme)
              await ModerationService.unmuteInRoom(room.id, p.user_id).catch(() => {});
            } catch {}
          }));
          setParticipants(prev => prev.map(p =>
            (p.role === 'speaker' || p.role === 'moderator') && p.user_id !== firebaseUser.uid
              ? { ...p, is_muted: false } : p
          ));
          modChannelRef.current?.send({ type: 'broadcast', event: 'mod_action', payload: { action: 'unmute_all' } });
          showToast({ title: i18n.t('room.id.076'), message: i18n.t('auto.room.id.070', { 0: stagePeople.length }), type: 'success' });
        }},
      ],
    });
  }, [room, firebaseUser, participants]);

  // ★ Boş sahne teklifi — inline tooltip + ghost koltuk yaklaşımı (modal yerine)
  const [showSeatTooltip, setShowSeatTooltip] = React.useState(false);
  useEffect(() => {
    if (!room || !firebaseUser?.uid) return;
    if (amIHost || amIModerator) return; // yetkili zaten sahnede
    if (stageUsers.length > 0) { setShowSeatTooltip(false); return; }
    const myPart = participants.find(p => p.user_id === firebaseUser.uid);
    if (!myPart || myPart.role === 'speaker' || myPart.role === 'owner') return;

    const timer = setTimeout(() => setShowSeatTooltip(true), 3000);
    return () => clearTimeout(timer);
  }, [stageUsers.length, participants, firebaseUser?.uid, room, amIHost, amIModerator]);

  const handleGhostSeatPress = useCallback(async () => {
    if (!room || !firebaseUser?.uid) return;

    // ★ Host/Mod her zaman sahneye çıkabilir — konuşma modu kısıtlaması uygulanmaz
    const isHost = room.host_id === firebaseUser.uid;
    const myPart = participants.find(p => p.user_id === firebaseUser.uid);
    const isMod = myPart?.role === 'moderator';

    // ★ v32 Caretaker modu — owner+mod yoksa direkt sahneye (5 dk süreli)
    if (isCaretakerMode && !isHost && !isMod) {
      if (stageLimits.current >= stageLimits.max) {
        showToast({ title: '🚫 Sahne Dolu', message: `${stageLimits.current}/${stageLimits.max} dolu`, type: 'warning' });
        return;
      }
      await handleClaimStage();
      return;
    }

    // ★ 2026-04-22: Owner/mod dinleyiciye inmişse sahneye geri çıkması için
    //   özel akış (hiyerarşik displacement).
    if (isHost || isMod) {
      await handleOwnerModJoinStage();
      return;
    }

    // ★ 2026-04-22 REVERT: Hiyerarşi override kaldırıldı — "Serbest" gerçekten serbest.
    //   Owner/mod sahnede olsa bile free_for_all listener'lar doğrudan çıkar; kesme
    //   riskini owner manuel moderasyonla (mute/kick) yönetir.
    if (!isHost && !isMod) {
      if (speakingMode === 'selected_only') {
        showToast({ title: i18n.t('room.id.077'), message: i18n.t('room.id.078'), type: 'warning' });
        return;
      }
      if (speakingMode === 'permission_only') {
        if (!myMicRequested) {
          setMyMicRequested(true);
          micReqChannelRef.current?.send({
            type: 'broadcast', event: 'mic_request',
            payload: { type: 'request', userId: firebaseUser.uid, displayName: profile?.display_name || i18n.t('auto.room.id.069') },
          });
          showToast({ title: i18n.t('room.id.079'), message: i18n.t('room.id.080'), type: 'success' });
        } else {
          showToast({ title: 'Zaten Bekliyor', message: i18n.t('room.id.081'), type: 'info' });
        }
        setShowSeatTooltip(false);
        return;
      }
      // ★ 2026-04-22: free_for_all + sahne dolu → FIFO kuyruğa yazıl, otomatik promote bekle.
      if (speakingMode === 'free_for_all') {
        const slotLimits = getRoomLimits(ownerTier as any);
        const currentStageCount = participants.filter(p => ['owner', 'speaker', 'moderator'].includes(p.role)).length;
        const stageFull = currentStageCount >= slotLimits.maxSpeakers;
        if (stageFull) {
          if (!myMicRequested) {
            setMyMicRequested(true);
            micReqChannelRef.current?.send({
              type: 'broadcast', event: 'mic_request',
              payload: { type: 'request', userId: firebaseUser.uid, displayName: profile?.display_name || i18n.t('auto.room.id.068') },
            });
            showToast({ title: i18n.t('room.id.082'), message: i18n.t('room.id.083'), type: 'info' });
          } else {
            showToast({ title: i18n.t('room.id.084'), message: i18n.t('room.id.085'), type: 'info' });
          }
          setShowSeatTooltip(false);
          return;
        }
        // sahne müsait → aşağıdaki direct promote'a devam et
      }
    }
    try {
      if (isHost) {
        // ★ BUG FIX: Host 'owner' olarak sahneye döner
        await RoomService.rejoinAsOwner(room.id, firebaseUser.uid);
        modChannelRef.current?.send({ type: 'broadcast', event: 'mod_action', payload: { action: 'owner_rejoin', targetUserId: firebaseUser.uid } });
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser!.uid ? { ...p, role: 'owner' as const, is_muted: false } : p));
      } else {
        await RoomService.promoteSpeaker(room.id, firebaseUser.uid);
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser!.uid ? { ...p, role: 'speaker' as const, is_muted: false } : p));
      }
      // ★ v67 FIX: Sahneye çıktıktan hemen sonra heartbeat — stale cleanup koruması
      RoomService.updateLastSeen(room.id, firebaseUser.uid).catch(() => {});
      showToast({ title: isHost ? i18n.t('auto.room.id.067') : i18n.t('auto.room.id.066'), message: i18n.t('room.id.086'), type: 'success' });
      setShowSeatTooltip(false);
      // ★ 2026-04-20 FIX: Sahneye çıkınca mikrofonu otomatik aç — önceden eksikti,
      // bu yüzden başkasının odasında sahneye çıkan kullanıcı mic açamıyordu.
      setTimeout(() => { lk.enableMic?.().catch(() => {}); }, 500);
    } catch (e: any) {
      showToast({ title: 'Sahne Dolu', message: e?.message || i18n.t('auto.room.id.065'), type: 'warning' });
    }
  }, [room, firebaseUser?.uid, speakingMode, myMicRequested, profile?.display_name, participants, ownerTier, lk]);

  // ★ OWNER/MOD DİNLEYİCİ MODUNDAN SAHNEYE ÇIKMA
  // Owner: izin almadan doğrudan sahneye çıkar
  // Moderatör: izin almadan çıkar, sahne doluysa en düşük yetkili speaker'ın yerine geçer
  const handleOwnerModJoinStage = useCallback(async () => {
    if (!room || !firebaseUser?.uid) return;
    const myPart = participants.find(p => p.user_id === firebaseUser.uid);
    if (!myPart) return;
    const isOwnerUser = room.host_id === firebaseUser.uid || myPart.role === 'owner';
    const isModUser = myPart.role === 'moderator';
    if (!isOwnerUser && !isModUser) return;

    // Sahne slot kontrolü
    // ★ T-2 FIX: Merkezi ownerTier kullan
    const tierLimits = getRoomLimits(ownerTier as any);
    const maxSlots = tierLimits.maxSpeakers;
    const currentStage = participants.filter(p => ['owner', 'speaker', 'moderator'].includes(p.role));
    const currentStageCount = currentStage.length;

    // ★ Sahne dolu değilse doğrudan çık
    if (currentStageCount < maxSlots) {
      try {
        if (isOwnerUser) {
          // ★ BUG FIX: rejoinAsOwner — sahneye doğrudan 'owner' olarak dön
          await RoomService.rejoinAsOwner(room.id, firebaseUser.uid);
          modChannelRef.current?.send({ type: 'broadcast', event: 'mod_action', payload: { action: 'owner_rejoin', targetUserId: firebaseUser.uid } });
          setParticipants(prev => prev.map(p => p.user_id === firebaseUser!.uid ? { ...p, role: 'owner' as const, is_muted: false } : p));
        } else {
          await RoomService.promoteSpeaker(room.id, firebaseUser.uid);
          // Moderatör tekrar sahneye çıktığında rol moderatör olarak kalmalı
          await supabase.from('room_participants').update({ role: 'moderator' }).eq('room_id', room.id).eq('user_id', firebaseUser.uid);
          modChannelRef.current?.send({ type: 'broadcast', event: 'mod_action', payload: { action: 'promote', targetUserId: firebaseUser.uid } });
          setParticipants(prev => prev.map(p => p.user_id === firebaseUser!.uid ? { ...p, role: 'moderator' as const, is_muted: false } : p));
        }
        // ★ v67 FIX: Sahneye çıktıktan hemen sonra heartbeat — stale cleanup koruması
        RoomService.updateLastSeen(room.id, firebaseUser.uid).catch(() => {});
        // ★ v107.39: "Sahneye Çıktın" toast KALDIRILDI
        setTimeout(() => { lk.enableMic?.().catch(() => {}); }, 500);
      } catch {
        showToast({ title: i18n.t('room.id.087'), message: i18n.t('room.id.088'), type: 'error' });
      }
      return;
    }

    // ★ Sahne dolu — Owner her zaman çıkabilir (slot eklenir veya yer açılır)
    if (isOwnerUser) {
      try {
        // ★ BUG FIX: rejoinAsOwner — sahne dolu olsa bile owner her zaman çıkabilir
        await RoomService.rejoinAsOwner(room.id, firebaseUser.uid);
        modChannelRef.current?.send({ type: 'broadcast', event: 'mod_action', payload: { action: 'owner_rejoin', targetUserId: firebaseUser.uid } });
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser!.uid ? { ...p, role: 'owner' as const, is_muted: false } : p));
        // ★ v67 FIX: Heartbeat — stale cleanup koruması
        RoomService.updateLastSeen(room.id, firebaseUser.uid).catch(() => {});
        // ★ v107.39: Owner "Sahneye Çıktın" toast KALDIRILDI
        setTimeout(() => { lk.enableMic?.().catch(() => {}); }, 500);
      } catch {
        showToast({ title: i18n.t('room.id.089'), message: i18n.t('room.id.090'), type: 'error' });
      }
      return;
    }

    // ★ Sahne dolu — Moderatör: kendisinden düşük yetkili birinin yerini al
    // Owner'lara DOKUNMA, sadece speaker'ları hedefle
    const replaceable = currentStage
      .filter(p => p.role === 'speaker' && p.user_id !== room.host_id)
      .sort((a, b) => {
        // En son katılanı (joined_at en yeni) indir
        return new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime();
      });

    if (replaceable.length === 0) {
      showToast({ title: 'Sahne Dolu', message: i18n.t('room.id.091'), type: 'warning' });
      return;
    }

    const victim = replaceable[0];
    try {
      // 1. Hedefi dinleyiciye indir
      await RoomService.demoteSpeaker(room.id, victim.user_id);
      modChannelRef.current?.send({
        type: 'broadcast', event: 'mod_action',
        payload: { action: 'demote', targetUserId: victim.user_id },
      });
      // 2. Kendini sahneye al (moderatör olarak)
      await RoomService.promoteSpeaker(room.id, firebaseUser.uid);
      await supabase.from('room_participants').update({ role: 'moderator' }).eq('room_id', room.id).eq('user_id', firebaseUser.uid);
      // 3. Optimistik güncelleme
      setParticipants(prev => prev.map(p => {
        if (p.user_id === victim.user_id) return { ...p, role: 'listener' as const };
        if (p.user_id === firebaseUser!.uid) return { ...p, role: 'moderator' as const, is_muted: false };
        return p;
      }));
      // ★ v107.39: Mod "Sahneye Çıktın" toast KALDIRILDI
      // ★ v67 FIX: Heartbeat — stale cleanup koruması
      RoomService.updateLastSeen(room.id, firebaseUser.uid).catch(() => {});
      setTimeout(() => { lk.enableMic?.().catch(() => {}); }, 500);
    } catch {
      showToast({ title: i18n.t('room.id.092'), message: i18n.t('room.id.093'), type: 'error' });
    }
  }, [room, firebaseUser?.uid, participants, lk, ownerTier]);


  const hostAvatarUri = hostUser?.user?.avatar_url
    ? { uri: hostUser.user.avatar_url }
    : getAvatarSource(room?.host_id?.includes('female') ? 'avatar_f_1.png' : 'avatar_m_2.png');


  // ★ ARCH-1: handleSendDm artık useRoomDM hook'undan geliyor

  // ★ Oda bağlantısını paylaş
  const handleShareRoom = useCallback(async () => {
    try {
      await Share.share({
        message: i18n.t('auto.room.id.064', { 0: room?.name || 'Oda', 1: id }),
        title: room?.name || i18n.t('auto.room.id.063'),
      });
    } catch (e) {
      showToast({ title: i18n.t('room.id.094'), message: i18n.t('room.id.095'), type: 'error' });
    }
  }, [room?.name, id]);

  // ★ BUG-2 FIX: Oda sesini gerçekten kapat/aç — çok katmanlı ses kontrolü
  const handleRoomMuteToggle = useCallback(async () => {
    const newMuted = !roomMuted;
    setRoomMuted(newMuted);
    try {
      // 1. LiveKit yerleşik API — mediaStreamTrack.enabled toggle
      liveKitService.muteRoomAudio(newMuted);
      // 2. Ek: Per-track volume kontrol (setVolume destekleyen SDK'larda)
      const activeRoom = liveKitService.currentRoom;
      if (activeRoom?.remoteParticipants) {
        for (const [, participant] of activeRoom.remoteParticipants) {
          for (const [, pub] of participant.audioTrackPublications) {
            if (pub.track && typeof (pub.track as any).setVolume === 'function') {
              (pub.track as any).setVolume(newMuted ? 0 : 1);
            }
          }
        }
      }
      // 3. Fallback: expo-av AudioMode — Android ses ducking
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: newMuted,
      });
    } catch (e) {
      if (__DEV__) console.warn('[Room] Ses kısma hatası:', e);
    }
  }, [roomMuted]);

  // ★ 2026-04-21: Oda Boost — eski basit Alert yerine premium bottom sheet (RoomBoostSheet)
  const handleBoostRoom = useCallback(() => {
    if (!room || !firebaseUser?.uid) return;
    setShowRoomBoostSheet(true);
  }, [room, firebaseUser?.uid]);

  // ★ Oda takip durumu + takipçi sayısı/listesi yükle
  const loadFollowerData = useCallback(async (roomId: string) => {
    try {
      const [count, list] = await Promise.all([
        RoomFollowService.getFollowerCount(roomId),
        RoomFollowService.getRoomFollowers(roomId, 20),
      ]);
      setFollowerCount(count);
      setFollowers(list);
    } catch {}
  }, []);

  useEffect(() => {
    if (room?.id && firebaseUser?.uid) {
      RoomFollowService.isFollowing(room.id, firebaseUser.uid).then(setIsFollowingRoom).catch(() => {});
      loadFollowerData(room.id);
    }
  }, [room?.id, firebaseUser?.uid]);

  // ★ Realtime subscription — room_follows tablosundaki değişiklikleri dinle
  useEffect(() => {
    if (!room?.id) return;
    const name = `room_follows_${room.id}`;
    purgeChannelByName(name);
    const channel = supabase
      .channel(name)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_follows',
        filter: `room_id=eq.${room.id}`,
      }, () => {
        // Her değişiklikte güncel veriyi çek
        loadFollowerData(room.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room?.id, loadFollowerData]);

  const handleToggleFollow = useCallback(async () => {
    if (!room?.id || !firebaseUser?.uid) return;
    const newState = !isFollowingRoom;
    setIsFollowingRoom(newState);
    // ★ Optimistik count güncelleme
    setFollowerCount(prev => Math.max(0, prev + (newState ? 1 : -1)));
    try {
      if (newState) {
        await RoomFollowService.follow(room.id, firebaseUser.uid);
      } else {
        await RoomFollowService.unfollow(room.id, firebaseUser.uid);
      }
      // Gerçek veriyi yenile (profil listesi için)
      loadFollowerData(room.id);
      // ★ 2026-04-20: Kullanıcıya gerçek zamanlı feedback
      showToast({
        title: newState ? '❤️ Takip ediliyor' : i18n.t('auto.room.id.062'),
        message: newState ? i18n.t('auto.room.id.061') : i18n.t('auto.room.id.060'),
        type: newState ? 'success' : 'info',
      });
    } catch {
      setIsFollowingRoom(!newState); // rollback
      setFollowerCount(prev => Math.max(0, prev + (newState ? -1 : 1)));
      showToast({ title: i18n.t('room.id.096'), message: i18n.t('room.id.097'), type: 'error' });
    }
  }, [room?.id, firebaseUser?.uid, isFollowingRoom, loadFollowerData]);

  // ★ Seçilen kullanıcının takip durumunu çek (ProfileCard Takip Et butonu için)
  // ★ BUG-1/7 FIX: getDetailedStatus kullanarak çift yönlü kontrol + her seçimde taze veri
  // ★ 2026-04-20 FIX: Bidirectional — incoming 'accepted' ise de arkadaş say.
  //   Aksi halde karşı taraf kabul ettikten sonra kendi tarafında hâlâ "Arkadaş Ekle"
  //   görünüyordu (kafa karıştırıcı, kullanıcı raporu).
  useEffect(() => {
    if (!selectedUser || !firebaseUser || selectedUser.user_id === firebaseUser.uid) return;
    FriendshipService.getDetailedStatus(firebaseUser.uid, selectedUser.user_id)
      .then(({ outgoing, incoming }) => {
        const effective =
          outgoing === 'accepted' || incoming === 'accepted' ? 'accepted' :
          outgoing === 'pending' || incoming === 'pending' ? 'pending' :
          outgoing ?? null;
        setUserFollowStatus(prev => ({ ...prev, [selectedUser.user_id]: effective }));
      })
      .catch(() => {});
  }, [selectedUser?.user_id, firebaseUser?.uid]);
  // ★ 2026-04-26: Oda kapalı/erişim engelli → asla oda render etme, full-screen ekran göster.
  //   FIX: lk.connectFailed da render-time kontrol ediliyor — useEffect tick gecikmesi flash yaratıyordu.
  //   connection_failed için "Tekrar Dene" butonu (router.replace ile sayfayı reset eder).
  // ★ 2026-04-30 FIX: firebaseUser null ise (reinstall, session expired) hata ekranı gösterme —
  //   AuthGuard login sayfasına yönlendirecek. Aksi halde "Bağlantı kurulamadı" stuck kalıyor.
  if (!firebaseUser) {
    return (
      <AppBackground radialGlow>
        <View style={[sty.root, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }]}>
          <StatusBar hidden />
          <AppLoader size={56} />
        </View>
      </AppBackground>
    );
  }
  // ★ 2026-05-10: Sadece roomBlock kontrol — lk.connectFailed grace period'lı
  //   useEffect üzerinden roomBlock'a yansır (3sn). Direkt lk.connectFailed flash atıyordu.
  if (roomBlock) {
    const effectiveReason: RoomClosedReason = roomBlock?.reason || 'connection_failed';
    const isRecoverable = effectiveReason === 'connection_failed';
    return (
      <RoomClosedScreen
        reason={effectiveReason}
        customMessage={roomBlock?.message}
        additionalReasons={roomBlock?.additionalReasons}
        onGoHome={() => router.replace('/(tabs)/home' as any)}
        onRetry={isRecoverable ? () => router.replace({ pathname: '/room/[id]', params: { id: id as string } } as any) : undefined}
      />
    );
  }

  // ★ 2026-04-26: SADECE access henüz onaylanmadıysa LiveKit'i beklet.
  //   Access onaylandı (accessGranted=true) ise oda UI'sını ANINDA render et — LiveKit
  //   arka planda bağlanır, kullanıcı 5+ saniye spinner ile bekleme yerine direkt odayı görür.
  //   roomBlock dolu ise zaten en üstteki render-time check yakalıyor; flash olmaz.
  const isLkPending = accessGranted !== true && !isSystemRoom(id as string) && lk.connectionState !== 'connected' && !lk.connectFailed;

  // ★ 2026-04-27: AccessGate kaldırıldı — access onaylanmadan oda UI'sının görünmemesi
  //   garantisi artık burada. accessGranted !== true ise skeleton (Pre-check sheet üstünde).
  const isAccessPending = accessGranted !== true && !isSystemRoom(id as string);

  // Loading VEYA room null VEYA (access henüz onaylanmadı + LiveKit hazır değil) → premium skeleton
  // ★ 2026-04-27 FIX: Sheet'ler de render edilir — Pre-check / Şifre / Davet sheet'leri access
  //   loading sırasında gerekli (sheet kapalıyken erken return → sheet hiç görünmez → akış saplanırdı).
  if (loading || !room || isLkPending || isAccessPending) return (
    <AppBackground radialGlow>
      <View style={[sty.root, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }]}>
        <StatusBar hidden />
        <View style={{ alignItems: 'center', gap: 14 }}>
          <AppLoader size={52} />
          <Text style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)', fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
            {loading ? i18n.t('auto.room.id.059') : i18n.t('auto.room.id.058')}
          </Text>
        </View>
        {/* ★ Access loading sırasında render edilmesi gereken sheet'ler — burada da mount edilmeli */}
        <RoomEntryPreviewSheet
          visible={!!entryPreview}
          roomName={room?.name || pendingRoomData?.room?.name}
          hostName={(room as any)?.host?.display_name || (pendingRoomData?.room as any)?.host?.display_name}
          filters={entryPreview?.filters || []}
          onContinue={entryPreview?.onContinue || (() => {})}
          onCancel={entryPreview?.onCancel || (() => {})}
        />
        <PasswordPromptSheet
          visible={showPasswordModal}
          roomName={pendingRoomData?.room?.name || room?.name}
          hostName={(pendingRoomData?.room as any)?.host?.display_name || (room as any)?.host?.display_name}
          submitting={accessPending}
          error={passwordError}
          onDismiss={() => { setShowPasswordModal(false); setPendingRoomData(null); safeGoBack(router); }}
          onSubmit={async (pw) => {
            if (!pendingRoomData || !firebaseUser || !profile) return;
            setAccessPending(true);
            setPasswordError('');
            try {
              const result = await RoomAccessService.checkAccess(
                pendingRoomData.room,
                firebaseUser.uid,
                (profile?.subscription_tier || 'Free') as any,
                null, null,
                pw,
              );
              if (result.allowed) {
                setShowPasswordModal(false);
                const feeOk = await processEntryFee(pendingRoomData.room, firebaseUser.uid);
                if (!feeOk) { setPendingRoomData(null); return; }
                const isOriginalHost = pendingRoomData.room.room_settings?.original_host_id === firebaseUser.uid;
                const joinRole: 'owner' | 'listener' | 'spectator' = isOriginalHost ? 'owner' : 'listener';
                RoomService.join(id as string, firebaseUser.uid, joinRole).then(() => {
                  setAccessGranted(true);
                  showToast({ title: i18n.t('room.id.098'), message: i18n.t('room.id.099'), type: 'success' });
                }).catch(() => {
                  showToast({ title: i18n.t('room.id.100'), type: 'error' });
                  safeGoBack(router);
                });
                setPendingRoomData(null);
              } else {
                setPasswordError(result.reason || i18n.t('auto.room.id.057'));
              }
            } catch {
              setPasswordError(i18n.t('auto.room.id.056'));
            } finally {
              setAccessPending(false);
            }
          }}
        />
        <InviteRequestPromptSheet
          visible={showInviteConfirm}
          roomName={pendingRoomData?.room?.name || room?.name}
          hostName={(pendingRoomData?.room as any)?.host?.display_name || (room as any)?.host?.display_name}
          submitting={invitePending}
          onDismiss={() => {
            if (invitePending) return;
            setShowInviteConfirm(false);
            setPendingRoomData(null);
            safeGoBack(router);
          }}
          onConfirm={async () => {
            if (!firebaseUser) return;
            setInvitePending(true);
            try {
              await RoomAccessService.sendAccessRequest(id as string, firebaseUser.uid);
              setShowInviteConfirm(false);
              setShowAccessRequest(true);
            } catch (e: any) {
              showToast({ title: i18n.t('room.id.101'), message: e?.message || 'Tekrar dene.', type: 'error' });
              setShowInviteConfirm(false);
              setPendingRoomData(null);
              safeGoBack(router);
            } finally {
              setInvitePending(false);
            }
          }}
        />
        <AccessRequestSheet
          visible={showAccessRequest}
          roomId={pendingRoomData?.room?.id || (id as string) || null}
          userId={firebaseUser?.uid || null}
          roomName={pendingRoomData?.room?.name || room?.name}
          hostName={(pendingRoomData?.room as any)?.host?.display_name || (room as any)?.host?.display_name}
          onApproved={() => {
            if (!pendingRoomData || !firebaseUser) { safeGoBack(router); return; }
            (async () => {
              const feeOk = await processEntryFee(pendingRoomData.room, firebaseUser.uid);
              if (!feeOk) { setPendingRoomData(null); safeGoBack(router); return; }
              const isOriginalHost = pendingRoomData.room.room_settings?.original_host_id === firebaseUser.uid;
              const joinRole: 'owner' | 'listener' | 'spectator' = isOriginalHost ? 'owner' : 'listener';
              RoomService.join(id as string, firebaseUser.uid, joinRole).then(() => {
                setAccessGranted(true);
                showToast({ title: i18n.t('room.id.102'), message: i18n.t('room.id.103'), type: 'success' });
              }).catch(() => {
                showToast({ title: i18n.t('room.id.104'), type: 'error' });
                safeGoBack(router);
              });
              setPendingRoomData(null);
            })();
          }}
          onRejected={(reason) => {
            setShowAccessRequest(false);
            setPendingRoomData(null);
            showToast({ title: '❌ Reddedildi', message: reason || i18n.t('auto.room.id.055'), type: 'warning' });
            safeGoBack(router);
          }}
          onCancelled={() => {
            setShowAccessRequest(false);
            setPendingRoomData(null);
            safeGoBack(router);
          }}
        />
        {/* ★ 2026-05-05: SP'li oda giriş ücreti onay kartı — early-return blokunda da
             render edilmeli. Eskiden sadece ana render'daydı; SP'li odalarda
             accessGranted=false → isAccessPending=true → early-return → modal hiç
             gösterilmiyor → "Oda hazırlanıyor" sonsuza takılı kalıyordu. */}
        {entryFeeRequest?.visible && (
          <EntryFeeCard
            visible={entryFeeRequest.visible}
            fee={entryFeeRequest.fee}
            balance={entryFeeRequest.balance}
            roomName={entryFeeRequest.roomName}
            hostName={entryFeeRequest.hostName}
            hostAvatar={entryFeeRequest.hostAvatar}
            onConfirm={() => {
              const r = entryFeeRequest.resolver;
              setEntryFeeRequest(null);
              r(true);
            }}
            onCancel={() => {
              const r = entryFeeRequest.resolver;
              setEntryFeeRequest(null);
              r(false);
              safeGoBack(router);
            }}
          />
        )}
      </View>
    </AppBackground>
  );

  return (
    <Animated.View
      style={[
        sty.root,
        { opacity: fadeIn },
        // ★ v283 (16 May 2026): horizontalPadding root'tan kaldırıldı — header tab
        //   family ile aynı full-width olmalı (home/odalarım/profil). Padding artık
        //   sadece avatar grid'leri (SpeakerSection / ListenerGrid) ihtiyacına göre
        //   içeride uygulanır; header ve gradient'lar full bleed.
      ]}
    >
      <StatusBar hidden />
      {/* ★ Dinamik Oda Arka Planı — tema + arkaplan görseli desteği */}
      {(() => {
        const themeId = (room as any)?.theme_id;
        const bgImageUrl = (room as any)?.room_image_url || (room?.room_settings as any)?.room_image_url;
        const THEME_COLORS: Record<string, [string, string]> = {
          ocean: ['#0E4D6F', '#083344'], sunset: ['#7F1D1D', '#4C0519'],
          forest: ['#14532D', '#052E16'], galaxy: ['#312E81', '#1E1B4B'],
          aurora: ['#134E4A', '#042F2E'], cherry: ['#831843', '#500724'],
          cyber: ['#1E3A8A', '#172554'], volcano: ['#7C2D12', '#431407'],
          midnight: ['#0C0A3E', '#1B1464'], rose: ['#9F1239', '#881337'],
          arctic: ['#164E63', '#0E7490'], amber: ['#78350F', '#92400E'],
          slate: ['#1E293B', '#334155'],
        };
        const themeColors = themeId && THEME_COLORS[themeId];

        if (bgImageUrl) {
          return (
            <ImageBackground source={{ uri: bgImageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover">
              <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
            </ImageBackground>
          );
        }
        if (themeColors) {
          return (
            <LinearGradient colors={[themeColors[0], themeColors[1], '#070B14']} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
          );
        }
        // ★ v286 (16 May 2026): Web admin Oda Düzeni'nde "Genel Arka Plan" section
        //   kaldırıldı — admin'in kontrol etmediği bir alanı DB'den okumak default
        //   room_in_bg.jpg'yi etkisizleştiriyordu. Artık doğrudan default arka plan.
        return (
          <ImageBackground source={require('../../assets/images/room_in_bg.jpg')} style={StyleSheet.absoluteFillObject} resizeMode="cover">
            <LinearGradient colors={['rgba(12,24,41,0.3)', 'rgba(10,21,32,0.5)', 'rgba(7,16,24,0.7)']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
          </ImageBackground>
        );
      })()}

      <View>
        <RoomInfoHeader
          roomName={room?.name || 'Oda'} roomDescription={room?.description} isPremium={(room as any)?.isPremium}
          viewerCount={viewerCount} connectionState={lk.connectionState} connectionQuality={lk.connectionQuality} roomDuration={roomDuration} roomExpiry={roomExpiry}
          isFollowing={isFollowingRoom} onToggleFollow={!amIHost ? handleToggleFollow : undefined}
          roomLanguage={(room?.room_settings as any)?.room_language || (room as any)?.language}
          ageRestricted={(room?.room_settings as any)?.age_restricted}
          entryFeeSp={(room?.room_settings as any)?.entry_fee_sp}
          isLocked={(room?.room_settings as any)?.is_locked}
          followersOnly={(room?.room_settings as any)?.followers_only}
          donationsEnabled={(room?.room_settings as any)?.donations_enabled}
          speakingMode={(room?.room_settings as any)?.speaking_mode}
          roomType={room?.type}
          hostAvatarUrl={room?.host?.avatar_url}
          hostTier={room?.host?.subscription_tier || room?.owner_tier}
          hostFrameId={(room?.host as any)?.active_frame || null}
          hostActiveBadgeId={(room?.host as any)?.active_badge_id ?? null}
          followerCount={followerCount}
          onBellPress={() => {
            // ★ Oda header: bir tık aşağı + bir tık sola. RN'de `right: N` = sağ edge'ten N px;
            //   N büyüdükçe element SOLA gider. Default 8 → 20 (12px sola kaydırma).
            setNotifDrawerAnchorRight(86);          // bell altı (drawer sola gelince arrow orantılı)
            setNotifDrawerRight(38);                // 20→38: ~18px daha sola
            // ★ 2026-05-05: 52→66 — RoomInfoHeader total height = insets.top + 58 (paddingTop 2 + topNav 50 + paddingBottom 6).
            //   NotificationDrawer artık Modal kullanmıyor → backdrop drawer top - 8'den başlıyor.
            //   66 = header alt + 8 → backdrop tam header sınırından, header dim/kapalı kalmaz.
            setNotifDrawerTop(insets.top + 66);
            setShowNotifDrawer(true);
          }}
          isBellActive={showNotifDrawer}
          notifBadgeCount={unreadNotifs}
          roomRules={typeof (room?.room_settings as any)?.rules === 'string' ? (room?.room_settings as any).rules : Array.isArray((room?.room_settings as any)?.rules) ? (room?.room_settings as any).rules.join(' · ') : undefined}
          onBack={() => {
            // ★ v92.9: Header geri = otomatik minimize. Tam çıkış sadece Plus menü > Odadan Ayrıl.
            handleAutoMinimize();
          }}
          onMinimize={() => { isMinimizingRef.current = true; setMinimizedRoom({ id: id as string, name: room?.name || 'Oda', hostName: hostUser?.user?.display_name || 'Host', viewerCount, isMicOn: lk.isMicrophoneEnabled || false }); safeGoBack(router); }}
          onViewersPress={() => openOverlay(() => setShowAudienceDrawer(true))}
        />
      </View>

      {/* Header menüsü kaldırıldı — Oda Paylaş ve Ayarlar PlusMenu'dan erişilebilir */}

      {/* ★ GERİ SAYIM BANNER — Host + mod ayrıldığında görünür */}
      {closingCountdown !== null && closingCountdown > 0 && (
        <View style={{ marginHorizontal: 14, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '700' }}>⏳ Oda {closingCountdown}{i18n.t('auto.room.id.054')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 }}>{i18n.t('room.id.002')}</Text>
          </View>
          {!amIHost && (
            <Pressable
              onPress={handleClaimHost}
              style={{ backgroundColor: '#14B8A6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
            >
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>👑 Host Ol</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ★ 2026-04-21: Müzik linki banner — premium mini player görünümü.
          Şarkı başlığı oEmbed ile çekilir; tıklama expo-web-browser ile in-app açılır (Chrome Custom Tab). */}
      {!!((room?.room_settings as any)?.music_link) && (
        <MusicBanner link={(room?.room_settings as any).music_link} />
      )}

      {/* ★ v92.10.1 (1 May 2026): Top Contributor mini chip — kompakt avatar + miktar.
           Yazı yok ("En Cömert" label kaldırıldı), tap'te profil sheet açılır.
           Genişlik ~80-90px. Oda sahibi RPC tarafında filtrelenir. */}
      {topContributor && (
        <Pressable
          onPress={() => openUserProfile(topContributor.user_id)}
          hitSlop={8}
          style={({ pressed }) => [
            {
              marginHorizontal: 16,
              marginTop: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 4,
              paddingRight: 10,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: 'rgba(251,191,36,0.10)',
              borderWidth: 1,
              borderColor: 'rgba(251,191,36,0.32)',
              alignSelf: 'flex-start',
              ...Platform.select({
                ios: { shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 },
                android: { elevation: 3 },
              }),
            },
            pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
          ]}
        >
          <Image
            source={getAvatarSource(topContributor.avatar_url)}
            style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.2, borderColor: 'rgba(255,224,130,0.7)' }}
          />
          <Ionicons name="trophy" size={11} color="#FBBF24" style={{
            textShadowColor: 'rgba(251,191,36,0.7)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 5,
          }} />
          <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFE082', letterSpacing: 0.3 }}>
            {topContributor.total_sp.toLocaleString('tr-TR')}
          </Text>
        </Pressable>
      )}

      {/* ★ v117: Oda partikül/sahne efekti — host'un active_effect_id'sine göre Skia render */}
      <CosmeticParticleEffect
        effectItemId={(room as any)?.active_effect_id || null}
        context="room"
        width={W}
        height={H}
      />

      {/* ★ 2026-04-21: SAHNE max-height DİNAMİK — konuşmacı sayısına göre,
          chat alanına daha fazla yer kalsın. Avatarlar grid zaten shrink (getSpeakerMetrics). */}
      <View style={{
        // ★ 2026-04-22: maxHeight artırıldı — speaker name text + ayırıcı bar çakışmasın.
        maxHeight:
          stageUsers.length <= 2 ? H * 0.28 :
          stageUsers.length <= 6 ? H * 0.38 :
          H * 0.46,
        paddingTop: 8,
        // ★ v283 (16 May 2026): Web admin global.horizontalPadding artık SADECE avatar
        //   grid'lere uygulanır (header full bleed kalsın). v284'te root'tan kaldırılmıştı.
        paddingHorizontal: roomLayout.global.horizontalPadding,
      }}>
        <SpeakerSection stageUsers={stageUsers} getMicStatus={getMicStatus}
          onSelectUser={(u) => { setSelectedUser(u); setInRoomProfileId(u.user_id); }}
          onSelfDemote={handleSelfDemote}
          currentUserId={firebaseUser?.uid} VideoView={LKVideoView}
          onGhostSeatPress={handleGhostSeatPress} showSeatTooltip={showSeatTooltip}
          avatarFlashes={avatarFlashes} onFlashDone={clearAvatarFlash}
          onCameraExpand={(u) => setCameraExpandUser(u)}
          canModerate={(u) => {
            // ★ 2026-04-26: Inline mute butonu görünürlüğü — kendisi değil + mute/unmute izni var
            if (u.user_id === firebaseUser?.uid) return false;
            const myRole = myCurrentRole as ParticipantRole;
            const targetRole = u.role as ParticipantRole;
            const tier = ownerTier as SubscriptionTier;
            const isMuted = (u as any).is_muted === true;
            const perm = isMuted ? 'timed_mute' : 'timed_mute';
            return checkPermission(myRole, targetRole, perm as any, tier, false).allowed
              && ['speaker', 'moderator', 'owner'].includes(u.role);
          }}
          onQuickMute={(u) => {
            const isMuted = (u as any).is_muted === true;
            const name = u.user?.display_name || i18n.t('auto.room.id.053');
            if (isMuted) {
              executeUnmute(u.user_id, name);
            } else {
              handleTimedMuteUser(u.user_id, name);
            }
          }} />
      </View>

      {/* ★ v287 (16 May 2026): Stage divider — admin stage.dividerStyle='line'/'gradient'/'none' */}
      {roomLayout.stage.dividerStyle !== 'none' && (
        <View style={{ paddingHorizontal: roomLayout.global.horizontalPadding, marginVertical: 4 }} pointerEvents="none">
          {roomLayout.stage.dividerStyle === 'gradient' ? (
            <LinearGradient
              colors={['transparent', roomLayout.stage.dividerColor, roomLayout.stage.dividerColor, 'transparent']}
              locations={[0, 0.25, 0.75, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 1 }}
            />
          ) : (
            <View style={{ height: 1, backgroundColor: roomLayout.stage.dividerColor }} />
          )}
        </View>
      )}

      {/* Clubhouse modeli: zemin overlay chat KALDIRILDI. */}
      <View style={{ flex: 1, overflow: 'hidden', paddingHorizontal: roomLayout.global.horizontalPadding }}>
        <ListenerGrid listeners={listenerUsers} onSelectUser={(u) => { setSelectedUser(u); setInRoomProfileId(u.user_id); }} selectedUserId={selectedUser?.user_id} onShowAllUsers={() => openOverlay(() => setShowAudienceDrawer(true))} maxListeners={getRoomLimits(ownerTier as any).maxListeners} spectatorCount={spectatorUsers.length} roomOwnerId={room?.host_id}
          avatarFlashes={avatarFlashes} onFlashDone={clearAvatarFlash} micRequestUserIds={micRequests} />
      </View>

      {/* ★ Hoş geldin artık toast ile (showToast helper) — banner JSX kaldırıldı */}

      {!!entryEffectData && (
        <RoomEntryEffectOverlay
          effectId={entryEffectData.effectId}
          userName={entryEffectData.userName}
          onDone={() => setEntryEffectData(null)}
        />
      )}
      <SPToast ref={spToastRef} />
      <ModerationOverlay ref={penaltyRef} />
      {/* ★ 2026-04-22: Welcome overlay — SP toast tarzı fade-in/out animasyonlu.
          Alt bar üstünde, blur zemin + altın parıltı, kompakt. */}
      {welcomeOverlay && (
        <Animated.View
          style={{
            position: 'absolute',
            left: 24, right: 24,
            bottom: Math.max(insets.bottom, 14) + 92,
            borderRadius: 14,
            overflow: 'hidden',
            zIndex: 99999, elevation: 99999,
            // ★ 2026-04-22: Sarı çerçeve kaldırıldı — belirsiz bulutsu his
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.45,
            shadowRadius: 16,
            opacity: welcomeAnim.interpolate({ inputRange: [0, 0.3, 1, 1.8, 2], outputRange: [0, 1, 1, 0.5, 0] }),
            transform: [
              { scale: welcomeAnim.interpolate({ inputRange: [0, 1, 2], outputRange: [0.85, 1, 0.92] }) },
              { translateY: welcomeAnim.interpolate({ inputRange: [0, 1, 2], outputRange: [16, 0, -8] }) },
            ],
          }}
          pointerEvents="none"
        >
          <BlurView intensity={30} tint="dark" style={{ paddingVertical: 9, paddingHorizontal: 13 }}>
            {/* Altın parıltı gradient */}
            <LinearGradient
              colors={['rgba(212,175,55,0.20)', 'rgba(212,175,55,0.05)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={{ color: '#F5D27A', fontWeight: '800', fontSize: 12, letterSpacing: 0.2 }} numberOfLines={1}>
              {welcomeOverlay.name}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11, marginTop: 1 }} numberOfLines={2}>
              {welcomeOverlay.msg}
            </Text>
          </BlurView>
        </Animated.View>
      )}
      {/* ★ v107.3: Sahne Desteği Sheet — host'a SP bağışı (canlı an, sahne ışığı temalı).
           Eski SPDonateSheet (her bağlam aynı modal) → StageSupportSheet (sahne ışığı huzmesi
           + host avatar tier glow ring + "Sahneyi Destekle" butonu, mesaj kutusu yok). */}
      {firebaseUser && room?.host_id && (
        <StageSupportSheet
          visible={showDonationDrawer}
          onClose={() => setShowDonationDrawer(false)}
          senderId={firebaseUser.uid}
          hostId={room.host_id}
          hostName={hostUser?.user?.display_name || room?.host?.display_name || 'Host'}
          hostAvatar={hostUser?.user?.avatar_url || room?.host?.avatar_url || undefined}
          hostTier={hostUser?.user?.subscription_tier || room?.host?.subscription_tier || room?.owner_tier || null}
          roomName={room?.name}
          onSuccess={(amt: number) => {
            const senderN = profile?.display_name || firebaseUser?.displayName || 'Birisi';
            const recipN = hostUser?.user?.display_name || room?.host?.display_name || 'Host';
            // ★ Tüm odaya animasyonlu bağış bildirimi gönder (4sn banner)
            sendDonationAlert(senderN, amt, recipN);
            // ★ Chat'e kalıcı sistem mesajı — sahne emoji ile (Hediye'den ayrım)
            RoomChatService.sendSystem(
              id as string,
              i18n.t('auto.room.id.052', { 0: senderN, 1: recipN, 2: amt }),
            ).catch(() => {});
            // Top contributor pill'i tetikle
            setTopContributorTrigger(t => t + 1);
          }}
        />
      )}

      {/* ★ v107.7: Giriş ücreti onay kartı — processEntryFee Promise resolver'ı ile bağlı.
           Kullanıcı "Öde + Gir" → resolver(true), join devam eder. "Vazgeç" → resolver(false) + safeGoBack. */}
      {entryFeeRequest?.visible && (
        <EntryFeeCard
          visible={entryFeeRequest.visible}
          fee={entryFeeRequest.fee}
          balance={entryFeeRequest.balance}
          roomName={entryFeeRequest.roomName}
          hostName={entryFeeRequest.hostName}
          hostAvatar={entryFeeRequest.hostAvatar}
          onConfirm={() => {
            const r = entryFeeRequest.resolver;
            setEntryFeeRequest(null);
            r(true);
          }}
          onCancel={() => {
            const r = entryFeeRequest.resolver;
            setEntryFeeRequest(null);
            r(false);
            safeGoBack(router);
          }}
        />
      )}

      {/* ★ Floating Reactions — her zaman en üstte, emoji bar açıkken de görünür */}
      <FloatingReactionsView ref={floatingRef} />

      {/* ★ Faz 3.2 — Voice Reaction Overlay (LiveKit data channel) */}
      <VoiceReactionOverlay ref={voiceReactionOverlayRef} />

      {/* ★ 2026-04-26: LiveKit bağlantısı koptuğunda full-screen overlay.
           Retry: useLiveKit.retry() — sayaç sıfırlanır, fresh connect tetiklenir. Odadan çıkmaz. */}
      <RoomDisconnectOverlay
        state={lk.connectionState as any}
        onRetry={() => lk.retry()}
        onLeave={() => handleSettingsLeave()}
      />

      {/* ★ Bağış Animasyonu — tüm odaya görünür premium bildirim */}
      <DonationAlert ref={donationAlertRef} />

      {/* ★ v107: Sembol Hediye animasyonu — biri hediye yollayınca alttan uçan emoji + üstte banner */}
      {id && <RoomGiftAnimationOverlay roomId={id as string} currentUserId={firebaseUser?.uid} />}

      {/* ★ v107: Hediye Paneli — kontrol barındaki 🎁 butonu açar, hep elinin altında */}
      {firebaseUser?.uid && id && (
        <RoomGiftPanel
          visible={showGiftPanel}
          onClose={() => setShowGiftPanel(false)}
          senderId={firebaseUser.uid}
          roomId={id as string}
          participants={participants}
          defaultRecipientId={room?.host_id}
        />
      )}

      {/* ★ v107: GiftSheet — odadaki bir kişiye SP hediyesi (host bağışı değil, listener-to-listener)
           ★ v107.16: inRoom={true} → success modal sinematik mode'da açılır (oda içi en zengin görünüm) */}
      {firebaseUser?.uid && tipSheetTarget && (
        <GiftSheet
          visible={!!tipSheetTarget}
          onClose={() => setTipSheetTarget(null)}
          senderId={firebaseUser.uid}
          recipientId={tipSheetTarget.userId}
          recipientName={tipSheetTarget.displayName}
          recipientAvatar={tipSheetTarget.avatarUrl}
          recipientUsername={tipSheetTarget.username}
          recipientTier={tipSheetTarget.tier}
          inRoom={true}
          onSuccess={(amt: number) => {
            const senderN = profile?.display_name || firebaseUser?.displayName || 'Birisi';
            const recipN = tipSheetTarget.displayName;
            spToastRef.current?.show(-amt, 'Hediye');
            sendDonationAlert(senderN, amt, recipN);
            // Chat sistem mesajı + top contributor refresh
            RoomChatService.sendSystem(
              id as string,
              i18n.t('auto.room.id.051', { 0: senderN, 1: recipN, 2: amt }),
            ).catch(() => {});
            setTopContributorTrigger(t => t + 1);
            setTipSheetTarget(null);
          }}
        />
      )}

      {/* ★ 2026-04-20: Kamera fullscreen — speaker rozetine tap ile açılır */}
      <CameraFullscreenModal
        visible={!!cameraExpandUser}
        user={cameraExpandUser}
        videoTrack={cameraExpandUser ? getMicStatus(cameraExpandUser.user_id)?.videoTrack : null}
        VideoView={LKVideoView}
        isMe={cameraExpandUser?.user_id === firebaseUser?.uid}
        onClose={() => setCameraExpandUser(null)}
      />


      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: Math.max(insets.bottom, 14) + 8, zIndex: 60, elevation: 60 }}>
        {/* ★ 2026-04-24: Bar altındaki safe area'yı örten fade-out mask — arka modal görünmesin */}
        <LinearGradient
          colors={['rgba(12,22,40,0)', 'rgba(12,22,40,0.7)', 'rgba(12,22,40,0.95)', 'rgba(12,22,40,1)']}
          locations={[0, 0.3, 0.7, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.max(insets.bottom, 14) + 8 + 60 }}
          pointerEvents="none"
        />
        {/* ★ 2026-04-22: Zeminde control bar üstüne düşen fade-out tamamen kaldırıldı —
             mesajların aktığı alan temiz, gölgesiz kalıyor. */}

        {/* ★ 2026-04-26: VoiceReactionStrip kaldırıldı — kullanıcı tetikleyemiyor.
             VoiceReactionOverlay duruyor: gelen reaksiyonları (broadcast) görmeye devam ediyor. */}

        {/* ★ v107.28: StageActionPill — kontrol bar'ın hemen üstünde "Sahneye Çık" / "Sahneden İn" pill.
             ★ v107.33: Chat/DM/audience drawer açıkken GİZLENİR — text input'un üzerine binmesin (kullanıcı raporu).
             Diğer drawer'lar (settings, plus menu) zaten kontrol bar'ı kaplıyor, çakışma yok. */}
        {firebaseUser?.uid && !showChatDrawer && !showDmPanel && !showAudienceDrawer
          && !showPlusMenu && !showSettings && !showAccessPanel && !showMicRequests
          && !showInviteFriends && !selectedUser && (() => {
          const myPart = participants.find(p => p.user_id === firebaseUser.uid);
          const myRole = myPart?.role as any;
          const totalSpeakers = stageUsers.length;
          const speakerLimit = getRoomLimits(((room as any)?.owner_tier || 'Free') as any).maxSpeakers || 8;
          const stageFull = totalSpeakers >= speakerLimit;
          // ★ v107.38: Host/moderator için cooldown YOK — kendi odasında bekleme süresi mantıksız.
          //   Cooldown sadece normal listener'lar için (sahne süresi rate limit).
          const myExpiresAt = (myPart as any)?.stage_expires_at;
          const isOwnerOrMod = amIHost || amIModerator;
          const cooldownSec = !isOwnerOrMod && myExpiresAt && myRole !== 'speaker'
            ? Math.max(0, Math.ceil((new Date(myExpiresAt).getTime() - Date.now()) / 1000))
            : 0;
          // ★ v107.38: Host sahneye çıkarken claimStageSeat (cooldown'lu) DEĞİL,
          //   handleOwnerModJoinStage (anlık atomic) çağırılır.
          const onClaim = isOwnerOrMod ? handleOwnerModJoinStage : handleClaimStage;
          return (
            <StageActionPill
              role={myRole}
              isHost={amIHost}
              onClaimStage={onClaim}
              onSelfDemote={handleSelfDemote}
              stageFull={stageFull}
              cooldownSeconds={cooldownSec}
            />
          );
        })()}

        <RoomControlBar isMicOn={lk.isMicrophoneEnabled || false} isCameraOn={lk.isCameraEnabled || false}
          showCamera={(amIHost || amIModerator || stageUsers.some(u => u.user_id === firebaseUser?.uid)) && getRoomLimits(((room as any)?.owner_tier || 'Free') as any).maxCameras > 0}
          isHandRaised={myMicRequested} handBadgeCount={micRequests.length} canModerate={canModerate || isStageDelegate}
          stageAction={stageAction} stageQueuePosition={stageQueuePosition}
          isForcedMuted={!amIHost && !!participants.find(p => p.user_id === firebaseUser?.uid)?.is_muted}
          isChatInputDisabled={!!participants.find(p => p.user_id === firebaseUser?.uid)?.is_chat_muted}
          isListener={!stageUsers.some(u => u.user_id === firebaseUser?.uid)}
          isOwnerInListenerMode={!stageUsers.some(u => u.user_id === firebaseUser?.uid) && amIHost}
          isModInListenerMode={!stageUsers.some(u => u.user_id === firebaseUser?.uid) && amIModerator}
          onJoinStagePress={handleOwnerModJoinStage}
          isRoomMuted={roomMuted}
          chatBadgeCount={chatUnreadCount} isChatOpen={showChatDrawer}
          dmBadgeCount={dmUnreadCount} plusBadgeCount={pendingAccessCount} isDmOpen={showDmPanel} isPlusOpen={showPlusMenu} onDmPress={() => { if (showDmPanel) setShowDmPanel(false); else openOverlay(() => toggleDmPanel()); }}
          onMicPress={handleMicPress}
          onMuteRoomPress={handleRoomMuteToggle}
          onCameraPress={() => {
            // ★ T-2 FIX: Merkezi ownerTier kullan
            const _tLimits = getRoomLimits(ownerTier as any);
            if (_tLimits.maxCameras === 0) {
              UpsellService.onCameraLimit(ownerTier as any);
              showToast({ title: i18n.t('room.id.105'), message: i18n.t('room.id.106'), type: 'warning' });
              return;
            }
            // BUG-RM21 FIX: lk.participants zaten local'i içeriyor, çift sayma
            const activeCams = lk.participants.filter((p: any) => p.isCameraEnabled).length;
            if (!lk.isCameraEnabled && activeCams >= _tLimits.maxCameras) {
              UpsellService.onCameraLimit(ownerTier as any);
              showToast({ title: 'Kamera Limiti', message: 'Maksimum ' + _tLimits.maxCameras + i18n.t('auto.room.id.050'), type: 'warning' });
              return;
            }
            try { lk.toggleCamera?.(); } catch {}
          }}
          onHandPress={handleMicRequest} onChatPress={() => { if (showChatDrawer) setShowChatDrawer(false); else { openOverlay(() => setShowChatDrawer(true)); setChatUnreadCount(0); } }} onPlusPress={() => { if (showPlusMenu) setShowPlusMenu(false); else openOverlay(() => setShowPlusMenu(true)); }}
          onGiftPress={() => { openOverlay(() => setShowGiftPanel(true)); }}
          onLeavePress={() => {
            setAlertConfig({
              visible: true, title: i18n.t('room.id.107'), message: i18n.t('room.id.108'), type: 'warning', icon: 'exit-outline',
              buttons: [{ text: i18n.t('auto.room.id.049'), style: 'cancel' }, { text: i18n.t('auto.room.id.048'), onPress: () => { isRoomClosingRef.current = true; if (amIHost) { handleHostLeave(); } else { handleUserLeave(); } }, style: 'destructive' }],
            });
          }} />
      </View>

      <RoomChatDrawer visible={showChatDrawer} messages={chatMessages as any[]} chatInput={chatInput}
        onChangeInput={setChatInput} onSend={handleSendChat} onClose={() => setShowChatDrawer(false)} bottomInset={insets.bottom}
        onAvatarPress={(uid) => {
          // ★ 2026-04-26: Mesaj balonu avatar/isim tıklanınca profil sheet — diğer platformlar gibi.
          const target = participants.find(p => p.user_id === uid);
          if (target) setSelectedUser(target);
          setInRoomProfileId(uid);
        }}
        currentUserId={firebaseUser?.uid} roomId={id as string}
        currentSP={(profile as any)?.system_points || 0}
        ownedPremiumGlowIds={ownedPremiumGlowIds}
        onOpenStore={() => router.push('/store' as any)}
        onSendGlow={async (content, glowStyle) => {
          // ★ v107 (3 May 2026): Mesaj Parlat — atomic RPC, SP düş + insert + log
          if (!firebaseUser) return;
          const r = await RoomChatService.sendGlow(id as string, firebaseUser.uid, content, glowStyle);
          if (r.success) {
            setChatInput('');
            const msg = r.cost && r.cost > 0
              ? i18n.t('auto.room.id.047', { 0: r.cost })
              : i18n.t('auto.room.id.046');
            showToast({ title: i18n.t('room.id.109'), message: msg, type: 'success' });
          } else {
            showToast({ title: i18n.t('room.id.110'), message: r.error || i18n.t('auto.room.id.045'), type: 'error' });
          }
        }}
        onSendRaw={(content: string) => {
          // GIF ve emoji reaksiyonlar için: floating emoji animasyonu + DB throttle
          sendEmojiReaction(content);
          const now = Date.now();
          if (firebaseUser && now - _lastEmojiChatWriteRef.current >= 600) {
            _lastEmojiChatWriteRef.current = now;
            RoomChatService.send(id as string, firebaseUser.uid, content).catch(() => {});
          }
        }} />

      {/* ★ DM MİNİ PANELİ — Oda içi mesajlaşma (inbox + sohbet) */}
      <DmPanelDrawer
        visible={showDmPanel}
        onClose={() => { setShowDmPanel(false); setDmInitialTarget(null); }}
        dmInboxMessages={dmInboxMessages}
        setDmInboxMessages={setDmInboxMessages}
        dmUnreadCount={dmUnreadCount}
        firebaseUser={firebaseUser}
        bottomInset={insets.bottom}
        initialChatTarget={dmInitialTarget}
      />

      {/* ★ HOST-FIX: AudienceDrawer'da host her zaman 'owner' olarak gösterilsin */}
      <AudienceDrawer visible={showAudienceDrawer} users={[...stageUsers, ...listenerUsers, ...spectatorUsers].map(u => u.user_id === room?.host_id ? { ...u, role: 'owner' } : u)}
        onClose={() => setShowAudienceDrawer(false)} onSelectUser={(u) => { setSelectedUser(u as any); setInRoomProfileId((u as any).user_id); }} />

      {/* ★ 2026-04-26: ProfileCard kaldırıldı — mod aksiyonları InRoomUserProfile'a taşındı.
           selectedUser odadan ayrılırsa her iki state'i de temizle. */}
      {!!selectedUser && !participants.find(p => p.user_id === selectedUser.user_id) && (() => {
        Promise.resolve().then(() => { setSelectedUser(null); setInRoomProfileId(null); });
        return null;
      })()}



      {/* ★ 2026-04-18: RoomSettingsSheet kaldırıldı. Cihaz ayarları artık PlusMenu
           "Konuşma & Ses" accordion'u içinde inline. Ayrı modal açılmıyor. */}

      <PremiumAlert visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} buttons={alertConfig.buttons} icon={alertConfig.icon} onDismiss={() => setAlertConfig(prev => ({ ...prev, visible: false }))} />
      {firebaseUser?.uid && room?.id && (
        <ReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          reporterId={firebaseUser.uid}
          target={{ type: 'room', id: room.id }}
        />
      )}



      <PlusMenu visible={showPlusMenu} onClose={() => setShowPlusMenu(false)} bottomInset={Math.max(insets.bottom, 14)}
        isTempHost={isTempHostUser(room as any, firebaseUser?.uid || '')}
        onInviteFriends={() => openOverlay(() => setShowInviteFriends(true))}
        onShareLink={() => { closeAllOverlays(); handleShareRoom(); }}
        onLeaveRoom={handleSettingsLeave}
        deviceConfig={{
          micMode,
          onMicModeChange: handleMicModeChange,
          noiseCancellation,
          onNoiseCancellationChange: handleNoiseCancellation,
          useSpeaker,
          onSpeakerChange: handleSpeakerToggle,
        }}
        // ★ 2026-04-20: Inline Banlılar & İstekler — ayrı modal kaldırıldı
        roomId={id as string}
        hostId={firebaseUser?.uid}
        roomType={room?.type || 'open'}
        onReportRoom={() => {
          closeAllOverlays();
          if (!firebaseUser?.uid || !room?.id) return;
          setShowReportModal(true);
        }}
        micRequestCount={micRequests.length}
        accessRequestCount={pendingAccessCount}
        userRole={myCurrentRole}
        ownerTier={ownerTier}
        onMuteAll={handleMuteAll}
        onUnmuteAll={handleUnmuteAll}
        onRoomStats={() => openOverlay(() => setShowRoomStats(true))}
        onDeleteRoom={() => { closeAllOverlays(); handleDeleteRoom(); }}
        onBoostRoom={() => { closeAllOverlays(); handleBoostRoom(); }}
        onPowerUps={() => { closeAllOverlays(); openOverlay(() => setShowPowerUps(true)); }}
        onShowFollowers={() => { closeAllOverlays(); openOverlay(() => setShowFollowersSheet(true)); }}
        onToggleFollow={() => { closeAllOverlays(); handleToggleFollow(); }}
        isFollowingRoom={isFollowingRoom}
        followerCount={followerCount}
        isDonationsEnabled={!!((room?.room_settings as any)?.donations_enabled)}
        onDonate={() => openOverlay(() => setShowDonationDrawer(true))}
        isRoomLocked={(room?.room_settings as any)?.is_locked || false}
        onRoomLock={amIHost && isTierAtLeast(ownerTier as any, 'Plus') ? () => {
          const newLocked = !(room?.room_settings as any)?.is_locked;
          (async () => {
            if (!room) return;
            try {
              await RoomService.setRoomLock(room.id, newLocked);
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), is_locked: newLocked } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { is_locked: newLocked } } });
              showToast({ title: newLocked ? '🔒 Oda Kilitlendi' : i18n.t('auto.room.id.044'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.111'), message: i18n.t('room.id.112'), type: 'error' }); }
          })();
        } : undefined}
        settingsConfig={amIHost ? {
          speakingMode,
          onSpeakingModeChange: async (mode) => {
            if (mode === 'selected_only' && !isTierAtLeast(ownerTier as any, 'Pro')) {
              showToast({ title: '👑 Pro Gerekli', message: i18n.t('room.id.113'), type: 'warning' });
              return;
            }
            setSpeakingMode(mode as any);
            if (room) {
              try {
                await RoomService.updateSettings(room.id, firebaseUser!.uid, { room_settings: { speaking_mode: mode as any } });
                setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), speaking_mode: mode as any } } as any : prev);
                modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { speaking_mode: mode } } });
                const labels: Record<string, string> = { free_for_all: 'Serbest Mod', permission_only: i18n.t('auto.room.id.043'), selected_only: i18n.t('auto.room.id.042') };
                showToast({ title: labels[mode] || 'Mod', type: 'success' });
              } catch { showToast({ title: i18n.t('room.id.114'), message: i18n.t('room.id.115'), type: 'error' }); }
            }
          },
          slowModeSeconds: (room?.room_settings as any)?.slow_mode_seconds || 0,
          onSlowModeChange: async (seconds) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { slow_mode_seconds: seconds } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), slow_mode_seconds: seconds } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { slow_mode_seconds: seconds } } });
              showToast({ title: seconds ? `Slow Mode: ${seconds}sn` : i18n.t('auto.room.id.041'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.116'), message: i18n.t('room.id.117'), type: 'error' }); }
          },
          ageRestricted: (room?.room_settings as any)?.age_restricted || false,
          onAgeRestrictedChange: async (enabled) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { age_restricted: enabled } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), age_restricted: enabled } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { age_restricted: enabled } } });
              showToast({ title: enabled ? '🔞 +18 Aktif' : i18n.t('auto.room.id.040'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.118'), message: i18n.t('room.id.119'), type: 'error' }); }
          },
          followersOnly: (room?.room_settings as any)?.followers_only || false,
          onToggleFollowersOnly: async (enabled) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { followers_only: enabled } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), followers_only: enabled } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { followers_only: enabled } } });
              showToast({ title: enabled ? i18n.t('auto.room.id.039') : i18n.t('auto.room.id.038'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.120'), message: i18n.t('room.id.121'), type: 'error' }); }
          },
          donationsEnabled: (room?.room_settings as any)?.donations_enabled || false,
          onDonationsToggle: async (enabled) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { donations_enabled: enabled } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), donations_enabled: enabled } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { donations_enabled: enabled } } });
              showToast({ title: enabled ? i18n.t('auto.room.id.037') : i18n.t('auto.room.id.036'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.122'), message: i18n.t('room.id.123'), type: 'error' }); }
          },
          roomLanguage: (room?.room_settings as any)?.room_language || 'tr',
          onLanguageChange: async (lang) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { room_language: lang as any } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), room_language: lang as any } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { room_language: lang } } });
              const names: Record<string,string> = { tr: i18n.t('auto.room.id.035'), en: 'English', de: 'Deutsch', ar: 'العربية' };
              showToast({ title: `🌐 ${names[lang] || lang}`, type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.124'), message: i18n.t('room.id.125'), type: 'error' }); }
          },
          // ★ Oda Adı
          roomName: room?.name || '',
          onRenameRoom: async (name) => {
            if (!room || !firebaseUser || !name) return;
            try {
              await ModerationService.editRoomName(room.id, name);
              setRoom(prev => prev ? { ...prev, name } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { name } });
              showToast({ title: i18n.t('room.id.126'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.127'), message: i18n.t('room.id.128'), type: 'error' }); }
          },
          // ★ Hoş Geldin Mesajı
          welcomeMessage: (room?.room_settings as any)?.welcome_message || '',
          onWelcomeMessageChange: async (msg) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { welcome_message: msg } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), welcome_message: msg } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { welcome_message: msg } } });
              showToast({ title: i18n.t('room.id.129'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.130'), message: i18n.t('room.id.131'), type: 'error' }); }
          },
          // ★ Kurallar
          roomRules: typeof (room?.room_settings as any)?.rules === 'string' ? (room?.room_settings as any).rules : Array.isArray((room?.room_settings as any)?.rules) ? (room?.room_settings as any).rules.join('\n') : '',
          onRulesChange: async (rulesText) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { rules: rulesText } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), rules: rulesText } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { rules: rulesText } } });
              showToast({ title: i18n.t('room.id.132'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.133'), message: i18n.t('room.id.134'), type: 'error' }); }
          },
          // ★ 2026-04-20: description — create-room'da giriliyor, artık edit edilebilir
          description: room?.description || '',
          onDescriptionChange: async (d: string) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { description: d });
              setRoom(prev => prev ? { ...prev, description: d } as any : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { description: d } });
              showToast({ title: i18n.t('room.id.135'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.136'), message: i18n.t('room.id.137'), type: 'error' }); }
          },
          // ★ Oda Tipi
          roomType: room?.type || 'open',
          onRoomTypeChange: async (type) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { type: type as any });
              setRoom(prev => prev ? { ...prev, type } as any : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { type } });
              const labels: Record<string,string> = { open: i18n.t('auto.room.id.034'), closed: i18n.t('auto.room.id.033'), invite: 'Davetli' };
              showToast({ title: `🔒 ${labels[type] || type}`, type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.138'), message: i18n.t('room.id.139'), type: 'error' }); }
          },
          // ★ Şifre (Oda Tipi = closed olduğunda)
          //   ★ 2026-04-27 FIX: Hem rooms.room_password column hem room_settings güncelleniyor.
          //   Önceki bug: sadece settings güncelleniyordu, column'da eski hash kalıyordu →
          //   kullanıcı şifre kaldırınca Pre-check sheet hâlâ "Şifre Korumalı" gösteriyordu.
          roomPassword: (room?.room_settings as any)?.room_password || '',
          onPasswordChange: async (pw) => {
            if (!room || !firebaseUser) return;
            try {
              // 1) rooms.room_password column — empty string '' ise null yap (audit'i koru)
              await supabase.from('rooms').update({ room_password: pw && pw.trim().length > 0 ? pw.trim() : null }).eq('id', room.id);
              // 2) room_settings.room_password — explicit '' ile temizleyebilmek için empty kabul edilir
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { room_password: pw && pw.trim().length > 0 ? pw.trim() : '' } as any });
              setRoom(prev => prev ? { ...prev, room_password: pw && pw.trim().length > 0 ? pw.trim() : null, room_settings: { ...(prev.room_settings || {}), room_password: pw && pw.trim().length > 0 ? pw.trim() : '' } } as any : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { room_password: pw } } });
              showToast({ title: pw && pw.trim().length > 0 ? i18n.t('auto.room.id.032') : i18n.t('auto.room.id.031'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.140'), message: i18n.t('room.id.141'), type: 'error' }); }
          },
          // ★ Tema
          themeId: (room as any)?.theme_id || null,
          onThemeChange: async (themeId) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { theme_id: themeId });
              setRoom(prev => prev ? { ...prev, theme_id: themeId } as any : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { theme_id: themeId } });
              showToast({ title: i18n.t('room.id.142'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.143'), message: i18n.t('room.id.144'), type: 'error' }); }
          },
          // ★ Odayı Dondur
          onFreezeRoom: isTierAtLeast(ownerTier as any, 'Plus') ? () => {
            setAlertConfig({
              visible: true, title: i18n.t('room.id.145'),
              message: i18n.t('room.id.146'),
              type: 'warning', icon: 'snow-outline',
              buttons: [
                { text: i18n.t('auto.room.id.030'), style: 'cancel' },
                { text: 'Dondur', style: 'destructive', onPress: async () => {
                  if (!room || !firebaseUser) return;
                  try {
                    modChannelRef.current?.send({ type: 'broadcast', event: 'mod_action', payload: { action: 'room_frozen', hostName: firebaseUser.displayName || 'Oda Sahibi' } });
                    isRoomClosingRef.current = true;
                    await RoomService.freezeRoom(room.id, firebaseUser.uid);
                    liveKitService.disconnect().catch(() => {});
                    setMinimizedRoom(null);
                    showToast({ title: '❄️ Oda Donduruldu', message: i18n.t('room.id.147'), type: 'success' });
                    safeGoBack(router);
                  } catch (err: any) { showToast({ title: i18n.t('room.id.148'), message: err.message || i18n.t('auto.room.id.029'), type: 'error' }); }
                }},
              ],
            });
          } : undefined,
          // ★ Giriş Ücreti
          entryFee: room?.room_settings?.entry_fee_sp || 0,
          onEntryFeeChange: async (fee) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { entry_fee_sp: fee } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), entry_fee_sp: fee } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { entry_fee_sp: fee } } });
              showToast({ title: fee ? i18n.t('auto.room.id.028', { 0: fee }) : i18n.t('auto.room.id.027'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.149'), message: i18n.t('room.id.150'), type: 'error' }); }
          },
          // ★ Müzik linki (YouTube/Spotify/SoundCloud) — herkes kendi platformunda dinler
          musicLink: room?.room_settings?.music_link || null,
          onMusicLinkChange: async (link) => {
            if (!room || !firebaseUser) return;
            try {
              const normalized = link && link.trim() ? link.trim() : null;
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { music_link: normalized } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), music_link: normalized } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { music_link: normalized } } });
              showToast({ title: normalized ? i18n.t('auto.room.id.026') : i18n.t('auto.room.id.025'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.151'), message: i18n.t('room.id.152'), type: 'error' }); }
          },
          // ★ Arka Plan Resmi
          backgroundImage: room?.room_image_url || room?.room_settings?.room_image_url || null,
          onPickBackgroundImage: async () => {
            if (!room || !firebaseUser) return;
            try {
              const ImagePicker = require('expo-image-picker');
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) { showToast({ title: i18n.t('room.id.153'), type: 'warning' }); return; }
              // ★ 2026-04-21: Oda içi arka plan DİKEY (9:16) — oda UI dikey; kapak görseli yatay kalır.
              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [9, 16], quality: 0.7 });
              if (result.canceled) return;
              const { StorageService } = require('../../services/storage');
              const fileName = `room_bg/${room.id}_${Date.now()}.jpg`;
              const url = await StorageService.uploadFile('post-images', fileName, result.assets[0].uri);
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { room_image_url: url } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), room_image_url: url } } as any : prev);
              // ★ 2026-04-19: Broadcast — diğer client'lara arka plan değişimini yay
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { room_image_url: url } } });
              showToast({ title: i18n.t('room.id.154'), type: 'success' });
            } catch (e: any) { showToast({ title: i18n.t('room.id.155'), message: e.message || i18n.t('auto.room.id.024'), type: 'error' }); }
          },
          onRemoveBackgroundImage: async () => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { room_image_url: null } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), room_image_url: null } } as any : prev);
              // ★ 2026-04-19: Broadcast — diğer client'lara kaldırıldığını yay
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { room_image_url: null } } });
              showToast({ title: i18n.t('room.id.156'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.157'), message: i18n.t('room.id.158'), type: 'error' }); }
          },
          // ★ 2026-04-21: Kart Görseli — card_image_url (keşfet kartı arka planı).
          //   cover_image_url ölü field olduğu için card_image_url'ye birleştirildi.
          coverImage: room?.room_settings?.card_image_url || (room?.room_settings as any)?.cover_image_url || null,
          onPickCoverImage: async () => {
            if (!room || !firebaseUser) return;
            try {
              const ImagePicker = require('expo-image-picker');
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) { showToast({ title: i18n.t('room.id.159'), type: 'warning' }); return; }
              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.7 });
              if (result.canceled) return;
              const { StorageService } = require('../../services/storage');
              const fileName = `room_card/${room.id}_${Date.now()}.jpg`;
              const url = await StorageService.uploadFile('post-images', fileName, result.assets[0].uri);
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { card_image_url: url } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), card_image_url: url } } as any : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { card_image_url: url } } });
              showToast({ title: i18n.t('room.id.160'), type: 'success' });
            } catch (e: any) { showToast({ title: i18n.t('room.id.161'), message: e.message || i18n.t('auto.room.id.023'), type: 'error' }); }
          },
          onRemoveCoverImage: async () => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { card_image_url: null } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), card_image_url: null } } as any : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { card_image_url: null } } });
              showToast({ title: i18n.t('room.id.162'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.163'), message: i18n.t('room.id.164'), type: 'error' }); }
          },
        } : undefined}
      />

      {/* ★ v92.11 (1 May 2026): Oda takipçileri sheet — host görür */}
      {room && (
        <RoomFollowersSheet
          visible={showFollowersSheet}
          onClose={() => setShowFollowersSheet(false)}
          roomId={room.id}
          totalCount={followerCount}
          onSelectUser={(uid) => { setShowFollowersSheet(false); openUserProfile(uid); }}
        />
      )}

      {/* ★ v92 (1 May 2026): Power-Ups sheet — sarf güçlendiriciler */}
      {firebaseUser && room && (
        <PowerUpsSheet
          visible={showPowerUps}
          onClose={() => setShowPowerUps(false)}
          roomId={room.id}
          userId={firebaseUser.uid}
          isHost={amIHost}
          currentSP={(profile as any)?.system_points || 0}
          onRoomExtended={(newExpiresAt) => {
            setRoom(prev => prev ? { ...prev, expires_at: newExpiresAt } as any : prev);
          }}
          onSelectInviteTarget={() => {
            // Altın davet — audience drawer'da hedef seçim. Hedef seçim flow'u
            // post-launch'ta sheet içine alınır (v93+).
            setShowAudienceDrawer(true);
            showToast({ title: i18n.t('room.id.165'), message: i18n.t('room.id.166'), type: 'info' });
          }}
        />
      )}

      {/* El Kaldırma Kuyruk Paneli — host/mod + sahne delegesi (v92) */}
      {(amIHost || canModerate || isStageDelegate) && room && (
        <HandRaiseQueuePanel
          visible={showMicRequests}
          onClose={() => setShowMicRequests(false)}
          roomId={room.id}
          pendingUserIds={micRequests}
          participants={participants}
          onApprove={(userId, displayName) => {
            approveMicRequest(userId);
          }}
          onReject={(userId) => {
            rejectMicRequest(userId);
          }}
          maxStageSlots={getRoomLimits(ownerTier as any).maxSpeakers}
          currentStageCount={stageUsers.length}
          bottomInset={Math.max(insets.bottom, 14)}
        />
      )}

      {/* ★ 2026-04-21: Oda Boost Premium Sheet — host'un odayı keşfette öne çıkarma */}
      {showRoomBoostSheet && room && firebaseUser && (
        <RoomBoostSheet
          visible={showRoomBoostSheet}
          onClose={() => setShowRoomBoostSheet(false)}
          currentSP={(profile as any)?.system_points || 0}
          roomName={room.name}
          onBoost={async (tier: RoomBoostTier) => {
            try {
              const result = await GamificationService.purchaseRoomBoost(firebaseUser.uid, tier.durationHours);
              if (!result.success) { showToast({ title: 'Yetersiz SP', message: result.error || i18n.t('auto.room.id.022'), type: 'warning' }); throw new Error(result.error); }
              await RoomService.activateBoost(room.id, firebaseUser.uid, tier.durationHours);
              showToast({ title: '🚀 Boost Aktif!', message: i18n.t('auto.room.id.021', { 0: tier.durationHours }), type: 'success' });
            } catch (e: any) {
              showToast({ title: i18n.t('room.id.167'), message: e?.message || i18n.t('auto.room.id.020'), type: 'error' });
              throw e;
            }
          }}
        />
      )}

      {/* ★ Arkadaş Davet Modalı — tüm kullanıcılar kullanabilir */}
      {firebaseUser && (
        <InviteFriendsModal
          visible={showInviteFriends}
          userId={firebaseUser.uid}
          roomId={id as string}
          onClose={() => setShowInviteFriends(false)}
          onInvite={async (selectedUsers) => {
            // ★ INVITE-FIX: Broadcast yerine RoomAccessService.inviteUser() kullan
            // Bu sayede hem room_invites tablosuna kaydedilir hem bildirim ziline düşer
            const hostName = profile?.display_name || firebaseUser.displayName || 'Birisi';
            const roomName = room?.name || 'Oda';
            let successCount = 0;
            for (const user of selectedUsers) {
              try {
                const result = await RoomAccessService.inviteUser(id as string, user.id, firebaseUser.uid);
                if (result.success) {
                  successCount++;
                  // ★ PUSH-FIX: Arka plandaki kullanıcılara push bildirim gönder
                  PushService.sendRoomInvite(user.id, hostName, roomName, id as string).catch(() => {});
                }
              } catch {}
            }
            // ★ Oda içi no-op showToast'u bypass — global Toast kullan
            if (successCount > 0) {
              const { showToast: globalToast } = require('../../components/Toast');
              globalToast({ title: i18n.t('room.id.168'), message: i18n.t('auto.room.id.019', { 0: successCount }), type: 'success' });
            }
            setShowInviteFriends(false);
          }}
        />
      )}

      {/* 🛡️ Access Gate — KALDIRILDI 2026-04-27: PremiumLoader skeleton zaten yükleme/access
            kontrol döneminde görünür; ek bir AccessGate "Erişim kontrol ediliyor" ekranı tek
            akışı iki farklı ekrana bölüp uzatıyordu. Pre-check sheet ve RoomClosedScreen zaten
            tüm engelleri ele alıyor. AccessGate visible={false} ile devre dışı. */}
      <AccessGate
        visible={false}
        roomName={room?.name || pendingRoomData?.room?.name}
        hostName={room?.host?.display_name}
        hostAvatarUrl={room?.host?.avatar_url || pendingRoomData?.room?.host?.avatar_url}
        // ★ 2026-04-20: Oda sahibinin seçtiği BG access gate'te de görünsün
        themeId={(room as any)?.theme_id || (pendingRoomData?.room as any)?.theme_id}
        bgImageUrl={
          (room as any)?.room_image_url ||
          (room?.room_settings as any)?.room_image_url ||
          (pendingRoomData?.room as any)?.room_image_url ||
          (pendingRoomData?.room?.room_settings as any)?.room_image_url
        }
        onCancel={() => safeGoBack(router)}
      />

      {/* 🔒 Şifreli Oda — aşağıdan yukarı bottom sheet */}
      <PasswordPromptSheet
        visible={showPasswordModal}
        roomName={pendingRoomData?.room?.name || room?.name}
        hostName={(pendingRoomData?.room as any)?.host?.display_name || (room as any)?.host?.display_name}
        submitting={accessPending}
        error={passwordError}
        onViewHost={() => {
          const hostId = pendingRoomData?.room?.host_id || room?.host_id;
          if (!hostId) return;
          setShowPasswordModal(false);
          setPendingRoomData(null);
          router.replace({ pathname: '/user/[id]', params: { id: hostId } } as any);
        }}
        onDismiss={() => { setShowPasswordModal(false); setPendingRoomData(null); safeGoBack(router); }}
        onSubmit={async (pw) => {
          if (!pendingRoomData || !firebaseUser || !profile) return;
          setAccessPending(true);
          setPasswordError('');
          try {
            const result = await RoomAccessService.checkAccess(
              pendingRoomData.room,
              firebaseUser.uid,
              (profile?.subscription_tier || 'Free') as any,
              null, null,
              pw,
            );
            if (result.allowed) {
              setShowPasswordModal(false);
              const feeOk = await processEntryFee(pendingRoomData.room, firebaseUser.uid);
              if (!feeOk) { setPendingRoomData(null); return; }
              const isOriginalHost = pendingRoomData.room.room_settings?.original_host_id === firebaseUser.uid;
              const joinRole: 'owner' | 'listener' | 'spectator' = isOriginalHost ? 'owner' : 'listener';
              // ★ Access granted join DB insert başarısından SONRA (LiveKit token için participant row gerek)
              RoomService.join(id as string, firebaseUser.uid, joinRole).then(() => {
                setAccessGranted(true);
                showToast({ title: i18n.t('room.id.169'), message: i18n.t('room.id.170'), type: 'success' });
              }).catch((err: any) => {
                const msg = err?.message || i18n.t('auto.room.id.018');
                setAlertConfig({
                  visible: true,
                  title: msg.includes('yasaklan') ? i18n.t('auto.room.id.017') : i18n.t('auto.room.id.016'),
                  message: msg, type: 'error',
                  icon: msg.includes('yasaklan') ? 'ban' : 'alert-circle',
                  buttons: [{ text: i18n.t('auto.room.id.015'), onPress: () => safeGoBack(router) }],
                });
              });
              setPendingRoomData(null);
            } else {
              setPasswordError(result.reason || i18n.t('auto.room.id.014'));
            }
          } catch {
            setPasswordError(i18n.t('auto.room.id.013'));
          } finally {
            setAccessPending(false);
          }
        }}
      />

      {/* 📨 Davetli Oda Erişim İsteği — aşağıdan yukarı bottom sheet + realtime */}
      <AccessRequestSheet
        visible={showAccessRequest}
        roomId={pendingRoomData?.room?.id || (id as string) || null}
        userId={firebaseUser?.uid || null}
        roomName={pendingRoomData?.room?.name || room?.name}
        hostName={(pendingRoomData?.room as any)?.host?.display_name || (room as any)?.host?.display_name}
        onViewHost={() => {
          const hostId = pendingRoomData?.room?.host_id || room?.host_id;
          if (!hostId) return;
          setShowAccessRequest(false);
          setPendingRoomData(null);
          router.replace({ pathname: '/user/[id]', params: { id: hostId } } as any);
        }}
        onDiscoverRooms={() => {
          setShowAccessRequest(false);
          setPendingRoomData(null);
          router.replace('/(tabs)/home' as any);
        }}
        onApproved={() => {
          setShowAccessRequest(false);
          if (!pendingRoomData || !firebaseUser) { safeGoBack(router); return; }
          // Onaylandı → direkt join
          (async () => {
            const feeOk = await processEntryFee(pendingRoomData.room, firebaseUser.uid);
            if (!feeOk) { setPendingRoomData(null); safeGoBack(router); return; }
            const isOriginalHost = pendingRoomData.room.room_settings?.original_host_id === firebaseUser.uid;
            const joinRole: 'owner' | 'listener' | 'spectator' = isOriginalHost ? 'owner' : 'listener';
            // ★ Access granted join DB insert başarısından SONRA (LiveKit token için participant row gerek)
            RoomService.join(id as string, firebaseUser.uid, joinRole).then(() => {
              setAccessGranted(true);
              showToast({ title: i18n.t('room.id.171'), message: i18n.t('room.id.172'), type: 'success' });
            }).catch(() => {
              showToast({ title: i18n.t('room.id.173'), type: 'error' });
              safeGoBack(router);
            });
            setPendingRoomData(null);
          })();
        }}
        onRejected={(reason) => {
          setShowAccessRequest(false);
          setPendingRoomData(null);
          showToast({ title: '❌ Reddedildi', message: reason || i18n.t('auto.room.id.012'), type: 'warning' });
          safeGoBack(router);
        }}
        onCancelled={() => {
          setShowAccessRequest(false);
          setPendingRoomData(null);
          safeGoBack(router);
        }}
      />

      {/* ℹ️ Pre-check özet sheet — filtreli odaya girmeden önce şartları göster */}
      <RoomEntryPreviewSheet
        visible={!!entryPreview}
        roomName={room?.name || pendingRoomData?.room?.name}
        hostName={(room as any)?.host?.display_name || (pendingRoomData?.room as any)?.host?.display_name}
        filters={entryPreview?.filters || []}
        onContinue={entryPreview?.onContinue || (() => {})}
        onCancel={entryPreview?.onCancel || (() => {})}
      />

      {/* 🔐 Davetli Oda — istek gönderim onayı (şifre sheet'i tarzı) */}
      <InviteRequestPromptSheet
        visible={showInviteConfirm}
        roomName={pendingRoomData?.room?.name || room?.name}
        hostName={(pendingRoomData?.room as any)?.host?.display_name || (room as any)?.host?.display_name}
        submitting={invitePending}
        onDismiss={() => {
          if (invitePending) return;
          setShowInviteConfirm(false);
          setPendingRoomData(null);
          safeGoBack(router);
        }}
        onConfirm={async () => {
          if (!firebaseUser) return;
          setInvitePending(true);
          try {
            await RoomAccessService.sendAccessRequest(id as string, firebaseUser.uid);
            setShowInviteConfirm(false);
            setShowAccessRequest(true);
          } catch (e: any) {
            showToast({ title: i18n.t('room.id.174'), message: e?.message || 'Tekrar dene.', type: 'error' });
            setShowInviteConfirm(false);
            setPendingRoomData(null);
            safeGoBack(router);
          } finally {
            setInvitePending(false);
          }
        }}
      />


      {/* 📊 Pro: Oda İstatistikleri Paneli */}
      <RoomStatsPanel
        visible={showRoomStats}
        onClose={() => setShowRoomStats(false)}
        currentListeners={participants.length}
        totalUniqueListeners={roomStats.totalUniqueListeners}
        peakCCU={roomStats.peakCCU}
        avgStayMinutes={room ? Math.floor((Date.now() - new Date(room.created_at).getTime()) / 60000 / Math.max(1, participants.length)) : 0}
        totalReactions={roomStats.totalReactions}
        topUsers={(() => {
          // ★ M2 FIX: Gerçek veriye dayalı skor — Math.random() kaldırıldı
          const scored = participants.map(p => {
            let score = 0;
            // Sahnedeki kullanıcılar daha yüksek skor alır
            if (p.role === 'owner') score += 50;
            else if (p.role === 'moderator') score += 35;
            else if (p.role === 'speaker') score += 25;
            else score += 5;
            // Odada kalma süresi (dakika) — joined_at'ten hesapla
            if (p.joined_at) {
              const stayMinutes = Math.floor((Date.now() - new Date(p.joined_at).getTime()) / 60000);
              score += Math.min(stayMinutes, 60); // Maks 60 dk katkı
            }
            return { nick: p.user?.display_name || 'Anon', score };
          });
          return scored.sort((a, b) => b.score - a.score).slice(0, 3);
        })()}
        roomDurationMinutes={room ? Math.floor((Date.now() - new Date(room.created_at).getTime()) / 60000) : 0}
        followerCount={followerCount}
        followers={followers}
      />

      {/* ★ 2026-04-26: Clubhouse pattern — mod aksiyonları profil sheet'in İÇİNDE (ayrı sheet değil).
           Primer aksiyon (Sahneye Davet/İndir, Mute) inline buton; az kullanılanlar 3-nokta menüde. */}
      <InRoomUserProfile
        visible={!!inRoomProfileId}
        userId={inRoomProfileId}
        currentUserId={firebaseUser?.uid || null}
        excludeRoomId={id as string}
        closeOnBackdropTap
        onClose={() => { setInRoomProfileId(null); setSelectedUser(null); }}
        onSelectUser={(targetId) => {
          const targetParticipant = participants.find(p => p.user_id === targetId);
          if (targetParticipant) setSelectedUser(targetParticipant);
          setInRoomProfileId(targetId);
        }}
        modActions={(() => {
          if (!selectedUser || !inRoomProfileId) return undefined;
          const _liveUser = participants.find(p => p.user_id === selectedUser.user_id);
          if (!_liveUser) return undefined;
          const _su = { ...selectedUser, ..._liveUser };
          const _myRole = myCurrentRole as ParticipantRole;
          const _targetRole = _su.role as ParticipantRole;
          const _ownerTierPerm = ownerTier as SubscriptionTier;
          const _isSelf = _su.user_id === firebaseUser?.uid;
          const _notSelf = !_isSelf;
          const _canActOn = (ROLE_LEVEL[_myRole] ?? 0) > (ROLE_LEVEL[_targetRole] ?? 0);
          const _perm = (p: string) => checkPermission(_myRole, _targetRole, p as any, _ownerTierPerm, _isSelf).allowed;
          const isOwnerOnStage = _su.user_id === room?.host_id && ['owner', 'speaker', 'moderator'].includes(_su.role);
          const displayRole = isOwnerOnStage ? 'owner' : _su.role;
          return {
            displayRole,
            isMuted: _su.is_muted || false,
            isChatMuted: _su.is_chat_muted || false,
            mutedUntil: _su.muted_until || null,
            onPromoteToStage: _perm('promote_speaker') && _su.role === 'listener' && _notSelf ? () => handlePromoteToStage(_su.user_id, _su.user?.display_name || i18n.t('auto.room.id.011')) : undefined,
            onRemoveFromStage: _perm('demote_speaker') && _su.role === 'speaker' && _notSelf ? async () => { try { await RoomService.demoteSpeaker(id as string, _su.user_id); modChannelRef.current?.send({ type: 'broadcast', event: 'mod_action', payload: { action: 'demote', targetUserId: _su.user_id } }); setParticipants(prev => prev.map(p => p.user_id === _su.user_id ? { ...p, role: 'listener' as const } : p)); setSelectedUser(null); setInRoomProfileId(null); } catch {} } : undefined,
            onMute: _perm('timed_mute') && _notSelf && !_su.is_muted && ['speaker', 'moderator', 'owner'].includes(_su.role) ? () => handleTimedMuteUser(_su.user_id, _su.user?.display_name || i18n.t('auto.room.id.010')) : undefined,
            onUnmute: _canActOn && _notSelf && _su.is_muted && ['speaker', 'moderator', 'owner'].includes(_su.role) ? () => executeUnmute(_su.user_id, _su.user?.display_name || i18n.t('auto.room.id.009')) : undefined,
            onChatMute: _perm('chat_block') && _notSelf ? () => handleToggleChatMute(_su.user_id, _su.user?.display_name || i18n.t('auto.room.id.008'), _su.is_chat_muted || false) : undefined,
            onKick: _perm('kick') && _notSelf ? () => handleKickUser(_su.user_id, _su.user?.display_name || i18n.t('auto.room.id.007')) : undefined,
            onMakeModerator: _perm('set_moderator') && _notSelf && _su.role !== 'owner' ? () => handleToggleModerator(_su.user_id, _su.user?.display_name || i18n.t('auto.room.id.006'), _su.role) : undefined,
            onGhostMode: _perm('ghost_mode') && _isSelf ? handleGhostToggle : undefined,
            isGhost: (_su as any)?.is_ghost || false,
            // ★ 2026-04-28: Kılık artık SADECE host self-toggle (eski "başkasına uygula" kaldırıldı).
            //   Host kendi profil sheet'ini açınca (_isSelf) buton görünür, anlık toggle.
            onDisguise: _perm('disguise_user') && _isSelf ? handleSelfDisguiseToggle : undefined,
            isDisguised: !!(_su as any)?.disguise_data,
            onBanTemp: _perm('ban_temporary') && _notSelf ? () => handleTempBan(_su.user_id, _su.user?.display_name || i18n.t('auto.room.id.005')) : undefined,
            onBanPerm: _perm('ban_permanent') && _notSelf ? () => handlePermBan(_su.user_id, _su.user?.display_name || i18n.t('auto.room.id.004')) : undefined,
            onPersonalMute: _notSelf ? () => {
              const userId = _su.user_id;
              setPersonallyMutedUsers(prev => {
                const next = new Set(prev);
                const willMute = !next.has(userId);
                if (willMute) next.add(userId); else next.delete(userId);
                try {
                  const activeRoom = liveKitService.currentRoom;
                  if (activeRoom?.remoteParticipants) {
                    const participant = activeRoom.remoteParticipants.get(userId);
                    if (participant) {
                      for (const [, pub] of participant.audioTrackPublications) {
                        if (pub.track) {
                          if (typeof (pub.track as any).setVolume === 'function') (pub.track as any).setVolume(willMute ? 0 : 1);
                          if (pub.track.mediaStreamTrack) pub.track.mediaStreamTrack.enabled = !willMute;
                        }
                      }
                    }
                  }
                } catch {}
                return next;
              });
            } : undefined,
            isPersonallyMuted: personallyMutedUsers.has(selectedUser.user_id),
            donationsEnabled: !!((room?.room_settings as any)?.donations_enabled) && _notSelf,
            onTip: _notSelf ? () => {
              setTipSheetTarget({
                userId: _su.user_id,
                displayName: _su.user?.display_name || i18n.t('auto.room.id.003'),
                avatarUrl: _su.user?.avatar_url,
                username: (_su.user as any)?.username,
                tier: (_su.user as any)?.subscription_tier || null,
              });
              setInRoomProfileId(null);
              setSelectedUser(null);
            } : undefined,
            onDM: _notSelf ? () => {
              setDmInitialTarget({ userId: _su.user_id, name: _su.user?.display_name || i18n.t('auto.room.id.002'), avatar: _su.user?.avatar_url });
              setShowDmPanel(true);
              setInRoomProfileId(null);
              setSelectedUser(null);
            } : undefined,
            onSelfDemote: _isSelf ? handleSelfDemote : undefined,
            onSelfPromote: _isSelf && (amIHost || amIModerator) ? handleOwnerModJoinStage : undefined,
          };
        })()}
      />

      {/* ★ 2026-05-05: Oda yeni oluşturulduysa success overlay (checked.json + caption).
          Kullanıcı oda içine girdikten sonra animasyon + "Odan Hazır" yazısı görür. */}
      <BoostSuccessOverlay
        visible={showJustCreated}
        caption={caption ? decodeURIComponent(caption) : i18n.t('auto.room.id.001')}
        onComplete={() => {
          setShowJustCreated(false);
          // URL param'i temizle — geri tuşunda tekrar tetiklenmesin
          try { router.setParams({ justCreated: undefined, caption: undefined } as any); } catch {}
        }}
      />
    </Animated.View>
  );
}
const sty = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1520' },
});
