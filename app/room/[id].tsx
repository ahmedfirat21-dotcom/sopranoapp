Warning: truncated output (original token count: 83219)
Total output lines: 6422

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
  Modal,
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
import { isSystemRoom, getSystemRoomById } from '../../services/showcaseRooms';
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
// ★ v1.7.13.121: KaraokePanel + Mafia* importları kaldırıldı (özellikler askıya alındı).
import PowerUpsSheet from '../../components/room/PowerUpsSheet';
import RoomFollowersSheet from '../../components/room/RoomFollowersSheet';
import HostAccessPanel from '../../components/room/HostAccessPanel';
import HandRaiseQueuePanel from '../../components/room/HandRaiseQueuePanel';
import RoomBoostSheet, { type RoomBoostTier } from '../../components/RoomBoostSheet';
import InviteFriendsModal from '../../components/room/InviteFriendsModal';
import RoomInfoHeader from '../../components/room/RoomInfoHeader';
import ConnectionQualityIndicator from '../../components/room/ConnectionQualityIndicator';
import SopranoRadioPlayer from '../../components/room/SopranoRadioPlayer';
import RadioChannelSheet from '../../components/room/RadioChannelSheet';
import { useRadioPlayer } from '../../hooks/useRadioPlayer';
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
import { FollowService } from '../../services/follows';
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
import { useKeyboardAnchor } from '../../hooks/useKeyboardAnchor';
import ModerationOverlay, { type ModerationOverlayRef } from '../../components/room/ModerationOverlay';
import type { FlashType } from '../../components/room/AvatarPenaltyFlash';
import { PushNotificationService } from '../../services/pushNotifications';


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
function DmPanelDrawer({ visible, onClose, dmInboxMessages, setDmInboxMessages, dmUnreadCount, firebaseUser, bottomInset, bottomClearance, initialChatTarget }: {
  visible: boolean;
  onClose: () => void;
  dmInboxMessages: any[];
  setDmInboxMessages: React.Dispatch<React.SetStateAction<any[]>>;
  dmUnreadCount: number;
  firebaseUser: any;
  bottomInset: number;
  bottomClearance?: number;
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

  const {
    hostRef: dmKeyboardHostRef,
    onHostLayout: onDmKeyboardHostLayout,
    keyboardInset: dmKeyboardInset,
    keyboardVisible: dmKeyboardVisible,
    hostHeight: dmHostHeight,
  } = useKeyboardAnchor();

  // Keyboard closed: clear the actual measured RoomControlBar wrapper.
  // Keyboard open: the control bar is moved behind IME; anchor directly to IME top.
  const FALLBACK_CONTROL_CLEARANCE = 72 + Math.max(bottomInset, 6);
  const REST_BOTTOM = Math.max(bottomClearance || 0, FALLBACK_CONTROL_CLEARANCE);
  const REST_TOP = 70;
  const restHeight = Math.max(dmHostHeight - REST_BOTTOM - REST_TOP, 240);
  const dmPanelBottomAnim = useRef(new Animated.Value(REST_BOTTOM)).current;
  const dmPanelHeightAnim = useRef(new Animated.Value(restHeight)).current;

  useEffect(() => {
    const composerActive = dmKeyboardVisible && !!chatTarget;
    const targetBottom = composerActive ? dmKeyboardInset : REST_BOTTOM;
    const targetHeight = Math.max(dmHostHeight - targetBottom - REST_TOP, 240);

    Animated.parallel([
      Animated.timing(dmPanelBottomAnim, {
        toValue: targetBottom,
        duration: composerActive ? 120 : 170,
        useNativeDriver: false,
      }),
      Animated.timing(dmPanelHeightAnim, {
        toValue: targetHeight,
        duration: composerActive ? 120 : 170,
        useNativeDriver: false,
      }),
    ]).start();
  }, [
    chatTarget?.userId, dmKeyboardVisible, dmKeyboardInset, dmHostHeight,
    REST_BOTTOM, REST_TOP, dmPanelBottomAnim, dmPanelHeightAnim,
  ]);

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
      // ★ Panel boyutlarını her açılışta PlusMenu ile eşitle
      dmPanelBottomAnim.setValue(REST_BOTTOM);
      dmPanelHeightAnim.setValue(restHeight);
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
    // ★ v1.7.13.161: Kopyalama toast'ı kaldırıldı — clipboard UI feedback yeterli.
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
    // ★ v1.7.13.161: Kaydetme toast'ı kaldırıldı — ikon zaten toggle oluyor.
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
          // ★ v1.7.13.161: İletme toast'ı kaldırıldı — modal kapanması yeterli feedback.
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
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onRequestClose={() => {
        if (dmKeyboardVisible) Keyboard.dismiss();
        else if (dmActionMenuMsg) setDmActionMenuMsg(null);
        else if (chatTarget) setChatTarget(null);
        else onClose();
      }}
    >
      <View
        ref={dmKeyboardHostRef}
        collapsable={false}
        onLayout={onDmKeyboardHostLayout}
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
      >
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
        zIndex: 60, elevation: 60,
      }}>
      <Animated.View {...dmPanHandlers} style={{
        flex: 1,
        borderTopLeftRadius: 26, borderBottomLeftRadius: 26,
        overflow: 'hidden',
        backgroundColor: '#1a2030',
        borderWidth: 1, borderRightWidth: 0,
        borderColor: 'rgba(139,92,246,0.12)',
        shadowColor: '#000', shadowOffset: { width: -6, height: 0 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 60,
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
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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
      …53219 tokens truncated…     balance={entryFeeRequest.balance}
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


      <View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - controlBarClearance) > 0.5) setControlBarClearance(h);
        }}
        style={{ position: 'absolute', bottom: ctrlKbOffsetPx, left: 0, right: 0, paddingBottom: Math.max(insets.bottom, 6), zIndex: 200, elevation: 200 }}
      >
        {/* ★ Bar altındaki safe area'yı dolduran gradient — bar'ın devamı gibi görünür */}
        <LinearGradient
          colors={['rgba(48,65,94,0.92)', 'rgba(26,40,64,0.95)', 'rgba(20,35,58,1)']}
          locations={[0, 0.4, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 72 + Math.max(insets.bottom, 6) }}
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
          isHandRaised={myMicRequested} handBadgeCount={validMicRequests.length} canModerate={canModerate || isStageDelegate}
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
          onHandPress={handleStageRequestPress} onChatPress={() => { if (showChatDrawer) setShowChatDrawer(false); else { openOverlay(() => setShowChatDrawer(true)); setChatUnreadCount(0); } }} onPlusPress={() => { if (showPlusMenu) setShowPlusMenu(false); else openOverlay(() => setShowPlusMenu(true)); }}
          isGiftOpen={showGiftPanel} onGiftPress={() => { if (showGiftPanel) setShowGiftPanel(false); else openOverlay(() => setShowGiftPanel(true)); }}
          onLeavePress={() => {
            setAlertConfig({
              visible: true, title: i18n.t('room.id.107'), message: i18n.t('room.id.108'), type: 'warning', icon: 'exit-outline',
              buttons: [{ text: i18n.t('auto.room.id.049'), style: 'cancel' }, { text: i18n.t('auto.room.id.048'), onPress: () => { isRoomClosingRef.current = true; if (amIHost) { handleHostLeave(); } else { handleUserLeave(); } }, style: 'destructive' }],
            });
          }} />
      </View>


      <RoomChatDrawer visible={showChatDrawer} messages={chatMessages as any[]} chatInput={chatInput}
        onChangeInput={setChatInput} onSend={handleSendChat} onClose={() => setShowChatDrawer(false)} bottomInset={insets.bottom}
        bottomClearance={controlBarClearance}
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
        bottomClearance={controlBarClearance}
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
        micRequestCount={validMicRequests.length}
        accessRequestCount={pendingAccessCount}
        userRole={myCurrentRole}
        ownerTier={ownerTier}
        onMuteAll={handleMuteAll}
        onUnmuteAll={handleUnmuteAll}
        onRoomStats={() => openOverlay(() => setShowRoomStats(true))}
        onEndRoom={!isSystemRoom(id as string) ? () => { closeAllOverlays(); handleEndRoom(); } : undefined}
        onDeleteRoom={() => { closeAllOverlays(); handleDeleteRoom(); }}
        onBoostRoom={() => { closeAllOverlays(); handleBoostRoom(); }}
        onPowerUps={() => { closeAllOverlays(); openOverlay(() => setShowPowerUps(true)); }}
        /* ★ v1.7.13.121: onMafiaGame + karaokeMode + onToggleKaraoke prop'ları kaldırıldı (askıya alındı) */
        onShowFollowers={() => { closeAllOverlays(); openOverlay(() => setShowFollowersSheet(true)); }}
        onToggleFollow={() => { closeAllOverlays(); handleToggleFollow(); }}
        isFollowingRoom={isFollowingRoom}
        followerCount={followerCount}
        isDonationsEnabled={!!((room?.room_settings as any)?.donations_enabled)}
        onDonate={() => openOverlay(() => setShowDonationDrawer(true))}
        isRoomLocked={(room?.room_settings as any)?.is_locked || false}
        onRoomLock={amIHost ? () => {
          const newLocked = !(room?.room_settings as any)?.is_locked;
          (async () => {
            if (!room) return;
            try {
              await RoomService.setRoomLock(room.id, newLocked);
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), is_locked: newLocked } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { is_locked: newLocked } } });
              showToast({ title: newLocked ? i18n.t('room.lock.locked') : i18n.t('auto.room.id.044'), type: 'success' });
            } catch { showToast({ title: i18n.t('room.id.111'), message: i18n.t('room.id.112'), type: 'error' }); }
          })();
        } : undefined}
        settingsConfig={amIHost ? {
          speakingMode,
          onSpeakingModeChange: async (mode) => {
            const normalizedMode = mode === 'free_for_all' ? 'permission_only' : mode;
            setSpeakingMode(normalizedMode as any);
            if (room) {
              try {
                await RoomService.updateSettings(room.id, firebaseUser!.uid, { room_settings: { speaking_mode: normalizedMode as any } });
                setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), speaking_mode: normalizedMode as any } } as any : prev);
                modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { speaking_mode: normalizedMode } } });
                const labels: Record<string, string> = { free_for_all: i18n.t('room.mode.free_for_all'), permission_only: i18n.t('auto.room.id.043'), selected_only: i18n.t('auto.room.id.042') };
                showToast({ title: labels[normalizedMode] || 'Mod', type: 'success' });
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

      {/* ★ v1.7.13.140: Soprano Lobi radyo kanal seçici — top-level render. */}
      {isSystemRoom(id as string) && (
        <RadioChannelSheet
          visible={radioSheetOpen}
          currentChannelId={radio.currentChannel.id}
          onSelect={radio.changeChannel}
          onClose={() => setRadioSheetOpen(false)}
        />
      )}

      {/* ★ v1.7.13.121 (21 May 2026): MafiaGameSheet + MafiaRoleRevealModal JSX kaldırıldı (kullanıcı kararı). */}

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
          pendingUserIds={validMicRequests}
          participants={participants}
          onApprove={(userId, displayName) => {
            approveMicRequest(userId);
          }}
          onReject={(userId) => {
            rejectMicRequest(userId);
          }}
          maxStageSlots={stageLimits.max}
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
