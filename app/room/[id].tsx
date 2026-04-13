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
  FlatList,
  Easing,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  AppState,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import { safeGoBack } from '../../constants/navigation';

// SopranoChat Services
import { RoomService, RealtimeService, getRoomLimits, MessageService, type Room, type RoomParticipant } from '../../services/database';
import { RoomHistoryService } from '../../services/roomHistory';
import { supabase } from '../../constants/supabase';
import { RoomChatService, type RoomMessage } from '../../services/roomChat';
import { checkPermission } from '../../services/permissions';
import { ROLE_LEVEL, type ParticipantRole, type SubscriptionTier } from '../../types';
import { isTierAtLeast } from '../../constants/tiers';

import { ModerationService } from '../../services/moderation';
import { RoomAccessService, type AccessCheckResult } from '../../services/roomAccess';

import { getAvatarSource } from '../../constants/avatars';
import { showToast } from '../../components/Toast';
import { useAuth } from '../_layout';
import useLiveKit from '../../hooks/useLiveKit';
import { useMicMeter } from '../../hooks/useMicMeter';

import { liveKitService } from '../../services/livekit';
import { isSystemRoom, getSystemRooms } from '../../services/showcaseRooms';
import RoomSettingsSheet, { type MicMode, type CameraFacing } from '../../components/RoomSettingsSheet';
import PremiumAlert, { type AlertButton, type AlertType } from '../../components/PremiumAlert';
import { EmojiReactionBar, FloatingReactionsView, type FloatingReactionsRef } from '../../components/EmojiReactions';

// Extracted Room Sub-Components
import { COLORS } from '../../components/room/constants';
import PremiumEntryBanner from '../../components/room/PremiumEntryBanner';
import ProfileCard from '../../components/room/ProfileCard';
import AudienceDrawer from '../../components/room/AudienceDrawer';
import { FriendshipService } from '../../services/friendship';
import { PlusMenu, AdvancedSettingsPanel } from '../../components/room/RoomOverlays';
import HostAccessPanel from '../../components/room/HostAccessPanel';
import HandRaiseQueuePanel from '../../components/room/HandRaiseQueuePanel';
import InviteFriendsModal from '../../components/room/InviteFriendsModal';
import RoomInfoHeader from '../../components/room/RoomInfoHeader';
import SpeakerSection from '../../components/room/SpeakerSection';
import ListenerGrid from '../../components/room/ListenerGrid';
import RoomControlBar from '../../components/room/RoomControlBar';
import RoomChatDrawer from '../../components/room/RoomChatDrawer';
import InlineChat from '../../components/room/InlineChat';
import RoomStatsPanel from '../../components/room/RoomStatsPanel';
import { RoomFollowService } from '../../services/roomFollow';
import { UpsellService } from '../../services/upsell';
import SPToast, { type SPToastRef } from '../../components/SPToast';
import { GamificationService } from '../../services/gamification';
import { useRoomModeration } from '../../hooks/useRoomModeration';
import { useRoomBroadcast } from '../../hooks/useRoomBroadcast';
import { useRoomDM } from '../../hooks/useRoomDM';
import { useRoomLifecycle } from '../../hooks/useRoomLifecycle';
import { useRoomGamification } from '../../hooks/useRoomGamification';


// ★ LiveKit VideoView — native modül yoksa null (prod build gerektirmez)
let LKVideoView: any = null;
try { LKVideoView = require('@livekit/react-native').VideoView; } catch {}


const { width: W, height: H } = Dimensions.get('window');

/* 
   ANA EKRAN
    */
export default function RoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { firebaseUser, profile, setMinimizedRoom } = useAuth();
  
  // Real DB States
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UX States
  const [chatMessages, setChatMessages] = useState<RoomMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const [selectedUser, setSelectedUser] = useState<RoomParticipant | null>(null);
  const [entryEffectName, setEntryEffectName] = useState<string | null>(null);
  // Mic permission system (local)
  const [micRequests, setMicRequests] = useState<string[]>([]); // user_id'ler
  const [showMicRequests, setShowMicRequests] = useState(false);
  const [myMicRequested, setMyMicRequested] = useState(false);
  const [approvedSpeakers, setApprovedSpeakers] = useState<string[]>([]);
  const [roomMuted, setRoomMuted] = useState(false);


  const [showAudienceDrawer, setShowAudienceDrawer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [micMode, setMicMode] = useState<MicMode>('normal');
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('front');
  const [noiseCancellation, setNoiseCancellation] = useState(true);
  const [useSpeaker, setUseSpeaker] = useState(true);
  const [alertConfig, setAlertConfig] = useState<{ visible: boolean; title: string; message: string; type?: AlertType; buttons?: AlertButton[]; icon?: string }>({ visible: false, title: '', message: '' });
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const floatingRef = useRef<FloatingReactionsRef>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showAccessPanel, setShowAccessPanel] = useState(false);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  const [isFollowingRoom, setIsFollowingRoom] = useState(false);

  // ★ Şifre Modal — closed (şifreli) odalar için
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingRoomData, setPendingRoomData] = useState<{ room: Room; participants: RoomParticipant[] } | null>(null);
  const [accessPending, setAccessPending] = useState(false);
  // ★ Kullanıcıların takip durumu (oda içi ProfileCard için)
  const [userFollowStatus, setUserFollowStatus] = useState<Record<string, 'pending' | 'accepted' | 'blocked' | null>>({});

  // ★ ARCH-1: DM hook — inline DM state/logic kaldırıldı
  const {
    dmUnreadCount, dmInboxMessages,
    dmTarget, setDmTarget, dmText, setDmText, dmSending,
    showDmPanel, setShowDmPanel,
    handleSendDm, toggleDmPanel,
  } = useRoomDM({ firebaseUser });

  // ★ ODA KAPANMA GERİ SAYIMI — Host+Mod yoksa 60sn sonra kapanır
  const [closingCountdown, setClosingCountdown] = useState<number | null>(null);
  const closingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ★ Kişisel susturma (lokal) — sadece bu kullanıcı için geçerli
  const [personallyMutedUsers, setPersonallyMutedUsers] = useState<Set<string>>(new Set());

  // ★ Konuşma modu state
  const [speakingMode, setSpeakingMode] = useState<'free_for_all' | 'permission_only' | 'selected_only'>('permission_only');
  const [showRoomStats, setShowRoomStats] = useState(false);
  const [roomStats, setRoomStats] = useState({ peakCCU: 0, totalUniqueListeners: 0, totalReactions: 0 });
  const isRoomClosingRef = useRef(false);

  // ★ SP Toast ref — animasyonlu SP kazanım bildirimi
  const spToastRef = useRef<SPToastRef>(null);

  // ★ ARCH-1 FIX: Broadcast kanalları hook'a taşındı (~200 satır kaldırıldı)
  const roomHostRef = useRef<string | null>(null);
  const { emojiBroadcastRef, micReqChannelRef, modChannelRef, sendEmojiReaction } = useRoomBroadcast({
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
    roomHostRef,
    lk: { isMicrophoneEnabled: false, toggleMic: async () => {}, enableMic: async () => {} },
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
      console.warn('[Audio] Hoparlör değiştirme hatası:', e);
    }
  };
  





  // ★ Oda Arka Plan Müziği — ambient ses döngüsü (expo-av)
  const musicSoundRef = useRef<Audio.Sound | null>(null);
  const MUSIC_URLS: Record<string, string> = {
    lofi: 'https://cdn.pixabay.com/audio/2024/11/01/audio_6c783ea43a.mp3',
    ambient: 'https://cdn.pixabay.com/audio/2022/10/25/audio_84e24d5bf7.mp3',
    jazz: 'https://cdn.pixabay.com/audio/2024/09/18/audio_62e6648deb.mp3',
  };

  useEffect(() => {
    const musicTrack = (room?.room_settings as any)?.music_track;
    const playMusic = async () => {
      if (musicSoundRef.current) {
        try { await musicSoundRef.current.unloadAsync(); } catch {}
        musicSoundRef.current = null;
      }
      if (!musicTrack || !MUSIC_URLS[musicTrack]) return;
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: MUSIC_URLS[musicTrack] },
          { shouldPlay: true, isLooping: true, volume: 0.15 }
        );
        musicSoundRef.current = sound;
      } catch (e) {
        console.warn('[Music] Yükleme hatası:', e);
      }
    };
    playMusic();
    return () => {
      if (musicSoundRef.current) {
        musicSoundRef.current.unloadAsync().catch(() => {});
        musicSoundRef.current = null;
      }
    };
  }, [(room?.room_settings as any)?.music_track]);

  const scrollViewRef = useRef<ScrollView>(null);
  const chatInputRef = useRef<TextInput>(null);
  const participantsRef = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
  const prevParticipantCountRef = useRef(0); // BUG-R7 FIX: stale closure önleme
  const isMinimizingRef = useRef(false); // Küçültme sırasında leave yapma
  
  // Oda sesi a/kapat

  // 1 Backend Balantlar
  useEffect(() => {
    if (!id || !firebaseUser) return;
    // Tam ekran odaya girildi — mini kartı kaldır
    setMinimizedRoom(null);

    // System Room fallback — veritabanında yok, local data kullan
    const roomPromise = isSystemRoom(id) 
      ? Promise.resolve(getSystemRooms().find(r => r.id === id) as unknown as Room) 
      : RoomService.get(id);
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
            display_name: profile?.display_name || 'Kullanıcı',
            avatar_url: profile?.avatar_url || null,
          },
        }] as RoomParticipant[])
      : RoomService.getParticipants(id as string);
    Promise.all([roomPromise, partPromise]).then(async ([roomData, p]) => {
      if (!roomData) { setLoading(false); return; }
      setRoom(roomData); setParticipants(p); participantsRef.current = new Set(p.map(x => x.user_id)); setLoading(false);
      // ★ Speaking mode — room_settings'ten oku (oda oluşturma ayarı yansısın)
      const savedMode = (roomData.room_settings as any)?.speaking_mode;
      if (savedMode && ['free_for_all', 'permission_only', 'selected_only'].includes(savedMode)) {
        setSpeakingMode(savedMode);
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

      if (!existing && profile) {
        // Sistem odalarında DB join yapma — lokal katılımcı zaten eklendi
        if (isSystemRoom(id as string)) {
          // Sistem odasında sadece hoş geldin mesajı göster
          // Hoş geldin bilgisi gereksiz — kullanıcı zaten odada
          return;
        }
        // ★ ODA GİRİŞ KONTROLÜ — RoomAccessService.checkAccess() ile merkezi kontrol
        if (!isHost && !isAdmin) {
          // Kullanıcı yaşını hesapla (profilde doğum tarihi varsa)
          let userAge: number | null = null;
          if (profile?.birth_date) {
            userAge = Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          }
          // ★ age_restricted → age_filter_min uyumluluğu: boolean ise 18'e çevir
          const roomForCheck = { ...roomData };
          const rs = (roomForCheck.room_settings || {}) as any;
          if (rs.age_restricted === true && !rs.age_filter_min) {
            rs.age_filter_min = 18;
            roomForCheck.room_settings = rs;
          }

          const accessResult: AccessCheckResult = await RoomAccessService.checkAccess(
            roomForCheck,
            firebaseUser.uid,
            (profile?.subscription_tier || 'Free') as any,
            userAge,
            (profile as any)?.language || null,
          );

          if (!accessResult.allowed) {
            // ★ password_required → Şifre modal göster (kapatmadıkça giremesin)
            if (accessResult.action === 'password_required') {
              setPendingRoomData({ room: roomData, participants: p });
              setPasswordInput('');
              setPasswordError('');
              setShowPasswordModal(true);
              return;
            }
            // ★ request_sent → Erişim isteği gönderildi (davetli oda)
            if (accessResult.action === 'request_sent') {
              setAlertConfig({
                visible: true,
                title: '📨 İstek Gönderildi',
                message: 'Katılma isteğiniz oda yöneticisine iletildi. Onay bekleniyor...',
                type: 'info',
                icon: 'mail',
                buttons: [{ text: 'Tamam', onPress: () => safeGoBack(router) }],
              });
              return;
            }

            // Diğer tüm engeller → uygun alert göster
            const ACTION_ALERTS: Record<string, { title: string; icon: string; type: 'error' | 'warning' }> = {
              banned: { title: '⛔ Erişim Engellendi', icon: 'ban', type: 'error' },
              room_locked: { title: '🔒 Oda Kilitli', icon: 'lock-closed', type: 'warning' },
              followers_only: { title: '👥 Takipçilere Özel', icon: 'people', type: 'warning' },
              age_restricted: { title: '🔞 Yaş Sınırı', icon: 'warning-outline', type: 'warning' },
              language_restricted: { title: '🌐 Dil Filtresi', icon: 'globe-outline', type: 'warning' },
              room_full: { title: '🚫 Oda Dolu', icon: 'people', type: 'warning' },
            };
            const alertMeta = ACTION_ALERTS[accessResult.action || ''] || { title: '⚠️ Erişim Engellendi', icon: 'alert-circle', type: 'warning' as const };
            setAlertConfig({
              visible: true,
              title: alertMeta.title,
              message: accessResult.reason || 'Bu odaya giriş izniniz yok.',
              type: alertMeta.type,
              icon: alertMeta.icon,
              buttons: [{ text: 'Geri Dön', onPress: () => safeGoBack(router) }],
            });
            return;
          }

          // ★ Erişim onaylandı — Giriş Ücreti (SP) kontrolü (checkAccess sonrası)
          const entryFee = (roomData.room_settings as any)?.entry_fee_sp || 0;
          if (entryFee > 0) {
            try {
              const result = await GamificationService.spend(firebaseUser.uid, entryFee, 'room_entry_fee');
              if (!result.success) {
                setAlertConfig({
                  visible: true,
                  title: '💰 Yetersiz SP',
                  message: `Bu odaya girmek için ${entryFee} SP gerekiyor. ${result.error || 'Yeterli SP\'niz yok.'}`,
                  type: 'warning',
                  icon: 'wallet-outline',
                  buttons: [{ text: 'Geri Dön', onPress: () => safeGoBack(router) }],
                });
                return;
              }
              // SP bilgisi SPToast ile gösterilir — çift toast önleme
              spToastRef.current?.show(-entryFee, 'Giriş Ücreti');
            } catch {
              // SP servisi hata verirse girişe izin ver (graceful degradation)
            }
          }
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
        RoomService.join(id, firebaseUser.uid, joinRole).then(() => {
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
              if (sp > 0) spToastRef.current?.show(sp, 'Günlük');
            }).catch(() => {});
            GamificationService.onPrimeTimeReturn(firebaseUser.uid).then(sp => {
              if (sp > 0) spToastRef.current?.show(sp, 'Prime Time');
            }).catch(() => {});
          }
          // ★ Hoş geldin mesajı (room_settings'ten)
          const settings = roomData.room_settings || {};
          if (settings.welcome_message) {
            const welcomeMsg: RoomMessage = {
              id: `welcome_${Date.now()}`,
              room_id: id as string,
              user_id: 'system',
              content: `👋 ${settings.welcome_message}`,
              created_at: new Date().toISOString(),
              profiles: { display_name: '📢 Oda' },
              isSystem: true,
            } as any;
            setChatMessages(prev => [welcomeMsg, ...prev]);
          }
          // ★ Kurallar artık header'da gösteriliyor — chat'e enjekte edilmez
        }).catch(console.warn);
        if (profile.active_entry_effect) setEntryEffectName(profile.display_name);
      } else if (existing && isHost && existing.role !== 'owner') {
        // Host zaten var ama rolü yanlış — düzelt
        RoomService.join(id, firebaseUser.uid, 'owner').catch(console.warn);
      }
    });

    const pSub = RealtimeService.onRoomChange(id as string, (newParticipants) => {
      // Sadece ilk yükleme sonrası yeni katılanları bildir
      if (initialLoadDone.current) {
        newParticipants.forEach(np => {
          if (!participantsRef.current.has(np.user_id) && np.user_id !== firebaseUser?.uid) {
            const joinMsg: RoomMessage = {
              id: `join_${np.user_id}_${Date.now()}`,
              room_id: id as string,
              user_id: np.user_id,
              content: 'odaya katıldı',
              created_at: new Date().toISOString(),
              profiles: { display_name: np.user?.display_name || 'Misafir' },
              isJoin: true,
            } as any;
            setChatMessages(prev => [joinMsg, ...prev].slice(0, 100));
          }
        });
      } else {
        initialLoadDone.current = true;
      }
      // Ref'i gncelle
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
    });
    // Mesaj geçmişi: Sadece oda sahibi geçmişi görebilir, yeni girenler sıfırdan başlar
    const isHost = room?.host_id === firebaseUser?.uid;
    if (isHost) {
      RoomChatService.getMessages(id as string, 50).then(setChatMessages);
    }
    // BUG-11 FIX: Mesaj birikimi limitleme (max 100)
    const unsubscribeMsg = RoomChatService.subscribe(id as string, (msg) => setChatMessages(prev => [msg, ...prev].slice(0, 100)));

    // ★ GERÇEK ZAMANLI ODA DURUM TAKİBİ — Supabase Realtime
    // Sadece is_live true→false geçişinde tetiklenir (ilk yüklemede veya kendi kapatma aksiyonumuzda değil)
    const prevIsLive = { current: room?.is_live ?? true };
    const roomStatusSub = RealtimeService.onRoomStatusChange(id as string, (updatedRoom) => {
      if (prevIsLive.current && !updatedRoom.is_live) {
        // BUG-RD6 FIX: Alert yerine otomatik çıkış — kullanıcı kapanmış odada takılmasın
        if (!isRoomClosingRef.current) {
          showToast({ title: 'Oda Kapatıldı', message: 'Bu oda oda sahibi tarafından kapatıldı.', type: 'info' });
          setTimeout(() => {
            liveKitService.disconnect().catch(() => {});
            setMinimizedRoom(null);
            safeGoBack(router);
          }, 2000);
        }
      }
      prevIsLive.current = updatedRoom.is_live;
      setRoom(updatedRoom);
    });

    // Periyodik kontrol — listener_count sync (yedek mekanizma)
    const syncInterval = setInterval(async () => {
      try {
        RoomService.syncListenerCount(id as string).catch(() => {});
      } catch {}
    }, 60000);

    return () => {
      RealtimeService.unsubscribe(pSub);
      RealtimeService.unsubscribe(roomStatusSub);
      unsubscribeMsg();
      clearInterval(syncInterval);

      // ★ FEAT-3/4: Küçültme (minimize) sırasında odadan ÇIKMA, ses devam etsin
      if (isMinimizingRef.current) {
        isMinimizingRef.current = false;
        return; // LiveKit bağlantısı + sahne korunur
      }

      // Gerçek çıkış — zombie önleme
      // ★ handleHostLeave veya handleCloseRoom zaten işlediyse tekrar close çağırma
      if (isRoomClosingRef.current) {
        liveKitService.disconnect().catch(() => {});
        return;
      }

      // BUG-7 FIX: roomHostRef kullan (stale closure önleme)
      const isHost = roomHostRef.current === firebaseUser?.uid;
      if (isHost) {
        // BUG-RD2 FIX: Host çıkışında transferHost çağır — oda sahipsiz kalmasın
        RoomService.transferHost(id as string, firebaseUser!.uid).catch(() => {
          // transferHost başarısız olursa en azından leave yap
          RoomService.leave(id as string, firebaseUser!.uid).catch(() => {});
        });
      } else {
        RoomService.leave(id as string, firebaseUser!.uid).catch(() => {});
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
  });


  // BUG-3 FIX: Bağlantı hatası kullanıcıya bildir
  useEffect(() => {
    if (lk.connectFailed && !loading) {
      showToast({ title: 'Ses Bağlantısı Başarısız', message: 'Ses sunucusuna bağlanılamadı. Mikrofon kullanılamaz.', type: 'warning' });
    }
  }, [lk.connectFailed, loading]);

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
    // BUG-RD9 FIX: participants state stale olabilir — DB'den anlık kontrol
    try {
      const { data: myPartDB } = await supabase
        .from('room_participants')
        .select('is_chat_muted')
        .eq('room_id', id as string)
        .eq('user_id', firebaseUser.uid)
        .maybeSingle();
      if (myPartDB?.is_chat_muted) {
        showToast({ title: '💬 Susturuldun', message: 'Metin sohbetiniz moderatör tarafından kapatıldı.', type: 'warning' });
        return;
      }
    } catch {} // DB hatasında lokal kontrole düş
    const myParticipant = participants.find(p => p.user_id === firebaseUser.uid);
    if (myParticipant?.is_chat_muted) {
      showToast({ title: '💬 Susturuldun', message: 'Metin sohbetiniz moderatör tarafından kapatıldı.', type: 'warning' });
      return;
    }
    try {
      await RoomChatService.send(id as string, firebaseUser.uid, chatInput.trim());
      setChatInput('');
      setTimeout(() => chatInputRef.current?.focus(), 100);
      // ★ SP: Mesaj gönderme (30sn cooldown ile)
      GamificationService.onMessageSent(firebaseUser.uid).then(sp => {
        if (sp > 0) spToastRef.current?.show(sp, 'Mesaj');
      }).catch(() => {});
    } catch { /* silent fail */ }
  };



  // Mikrofon İSTEK handler — sadece el kaldırma/indirme
  const handleMicRequest = () => {
    const myRole = participants.find(p => p.user_id === firebaseUser?.uid)?.role;
    const isHostOrMod = room?.host_id === firebaseUser?.uid || myRole === 'moderator' || profile?.is_admin;
    // Host/Mod/Admin: istek listesini göster
    if (isHostOrMod) {
      setShowMicRequests(!showMicRequests);
      return;
    }
    // Sadece listener'lar istek gönderebilir
    if (myRole !== 'listener') return;
    // Dinleyici: istek gönder/iptal — BROADCAST ile
    if (myMicRequested) {
      setMyMicRequested(false);
      micReqChannelRef.current?.send({
        type: 'broadcast', event: 'mic_request',
        payload: { type: 'cancel', userId: firebaseUser?.uid },
      });
    } else {
      setMyMicRequested(true);
      micReqChannelRef.current?.send({
        type: 'broadcast', event: 'mic_request',
        payload: {
          type: 'request',
          userId: firebaseUser?.uid,
          displayName: profile?.display_name || 'Kullanıcı',
        },
      });
      // Buton state'i (myMicRequested) zaten UI'da gösterilir
    }
  };

  // ★ Mikrofon AÇ/KAPAT — sadece sahnedeki kişiler (host, mod, speaker) için çağrılır
  // Dinleyiciler artık kontrol çubuğunda ses kısma + el kaldırma butonlarını kullanır
  const handleMicPress = async () => {
    // LiveKit bağlı değilse dokunma — donmayı önle
    if (lk.connectionState !== 'connected') {
      showToast({ title: 'Bağlantı Yok', message: 'Ses sunucusuna bağlanılamadı. Mikrofon kullanılamaz.', type: 'warning' });
      return;
    }
    // Süreli susturma kontrolü — susturulan kullanıcı mikrofon açamaz
    if (firebaseUser?.uid && !lk.isMicrophoneEnabled) {
      try {
        const isMuted = await ModerationService.isRoomMuted(id as string, firebaseUser.uid);
        if (isMuted) {
          showToast({ title: '🔇 Susturuldun', message: 'Moderatör tarafından susturuldunuz. Süre dolana kadar mikrofon açamazsınız.', type: 'warning' });
          return;
        }
      } catch {}
    }
    try {
      await lk.toggleMic();
    } catch (e) {
      console.warn('[Mic] Toggle hatası:', e);
      showToast({ title: 'Mikrofon Hatası', message: 'Mikrofon değiştirilemedi', type: 'error' });
    }
  };

  // İstek onaylama — kullanıcıyı DB'de speaker'a yükselt (sahnede görünsün)
  const approveMicRequest = async (uid: string) => {
    // ★ Sahne slot limiti kontrolü
    const ownerTierForLimits = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as any;
      const tierLimits = getRoomLimits(ownerTierForLimits);
      const maxSlots = tierLimits.maxSpeakers;
    const currentStageCount = participants.filter(p => ['owner', 'speaker', 'moderator'].includes(p.role)).length;
    if (currentStageCount >= maxSlots) {
      showToast({ title: 'Sahne Dolu', message: `Sahnede maksimum ${maxSlots} kişi olabilir`, type: 'warning' });
      UpsellService.onStageCapacityFull(ownerTierForLimits);
      return;
    }
    setApprovedSpeakers(prev => [...prev, uid]);
    setMicRequests(prev => prev.filter(u => u !== uid));
    try {
      await RoomService.promoteSpeaker(id as string, uid);
      // ★ BUG FIX: Optimistik state güncelleme — listener → speaker (UI anında sahneye taşır)
      setParticipants(prev => prev.map(p => p.user_id === uid ? { ...p, role: 'speaker' as const, is_muted: false } : p));
    } catch (e) {
      console.warn('Speaker yükseltme hatası:', e);
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
      content: '🤚 sahneye çıktı',
      created_at: new Date().toISOString(),
      profiles: { display_name: p?.user?.display_name || 'Kullanıcı' },
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
        visible: true, title: 'Odadan Ayrıl', message: 'Oda sahibi olarak ayrılmak istediğine emin misin? Yetki uygun birine devredilecek.', type: 'warning', icon: 'exit-outline',
        buttons: [
          { text: 'İptal', style: 'cancel' },
          { text: 'Ayrıl', style: 'destructive', onPress: () => { isRoomClosingRef.current = true; handleHostLeave(); } },
        ],
      });
    } else {
      setAlertConfig({
        visible: true, title: 'Odadan Ayrıl', message: 'Odadan ayrılmak istediğine emin misin?', type: 'warning', icon: 'exit-outline',
        buttons: [
          { text: 'İptal', style: 'cancel' },
          { text: 'Ayrıl', style: 'destructive', onPress: () => { isRoomClosingRef.current = true; handleUserLeave(); } },
        ],
      });
    }
  };

  // ========== HOST: ODAYI KALICI SİL ==========
  const handleDeleteRoom = () => {
    if (!amIHost && !profile?.is_admin) return;
    // Vekil host odayı silemez — sadece asıl sahip veya admin silebilir
    if (amIActingHost && !profile?.is_admin) {
      showToast({ title: 'Yetki Yok', message: 'Vekil host olarak odayı silemezsin. Sadece oda sahibi silebilir.', type: 'warning' });
      return;
    }
    setAlertConfig({
      visible: true, title: '🗑️ Odayı Kalıcı Sil', message: 'Bu oda tamamen silinecek ve geri alınamaz! Tüm katılımcılar çıkarılacak. Devam etmek istiyor musun?', type: 'error', icon: 'trash',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Kalıcı Sil', style: 'destructive', onPress: async () => {
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
            showToast({ title: 'Hata', message: e.message || 'Oda silinemedi', type: 'error' });
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
        // ★ Bronze+: Oda açık kalır — sahibi dilediğinde geri dönebilir veya manuel dondurabilir
        // Başarı toast gereksiz — sayfadan çıkılıyor
      } else {
        // ★ Free: Devralacak kimse yok — oda kapanır
        await RoomService.close(id as string);
        // Başarı toast gereksiz — sayfadan çıkılıyor
      }
      liveKitService.disconnect().catch(() => {});
      setMinimizedRoom(null);
      safeGoBack(router);
    } catch (e) {
      showToast({ title: 'Hata', message: 'Odadan çıkılamadı', type: 'error' });
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
          // Bronze+: Geri sayım yok — oda açık kalır
        }
      }
      
      // BUG-RD2 ek: Cleanup effect'in tekrar leave çağırmasını engelle
      isRoomClosingRef.current = true;
      await RoomService.leave(id as string, firebaseUser.uid);
      liveKitService.disconnect().catch(() => {});
      setMinimizedRoom(null);
      safeGoBack(router);
    } catch (e) {
      showToast({ title: 'Hata', message: 'Odadan çıkılamadı', type: 'error' });
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
      // ★ BUG-R1 FIX: Sadece en yetkili katılımcı close çağırır (race condition önleme)
      const myRole = participants.find(p => p.user_id === firebaseUser?.uid)?.role;
      const amHighestAuth = myRole === 'moderator' || myRole === 'owner' ||
        (myRole === 'speaker' && !participants.some(p => p.role === 'moderator' || p.role === 'owner')) ||
        (myRole === 'listener' && !participants.some(p => p.role === 'moderator' || p.role === 'owner' || p.role === 'speaker'));
      isRoomClosingRef.current = true;
      if (amHighestAuth) {
        RoomService.close(id as string).catch(() => {});
      }
      liveKitService.disconnect().catch(() => {});
      showToast({ title: '🔑 Oda Kapandı', message: 'Oda sahibi ve moderatör olmadığı için oda kapatıldı.', type: 'error' });
      setMinimizedRoom(null);
      safeGoBack(router);
      return;
    }

    if (closingCountdown === 5) {
      // Son 5 saniye uyarısı
      showToast({ title: '⚠️ Oda Kapanıyor!', message: 'Oda 5 saniye içinde kapanacak!', type: 'error' });
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
      showToast({ title: 'Hata', message: 'Bu oda aktif. Host değiştirme yapılamaz.', type: 'warning' });
      return;
    }
    // ★ BUG-R2 FIX: Yetki kontrolü — banned/spectator/guest host olamaz
    const myPart = participants.find(p => p.user_id === firebaseUser.uid);
    if (!myPart || ['banned', 'spectator', 'guest'].includes(myPart.role)) {
      showToast({ title: 'Yetki Yok', message: 'Bu rolde host olamazsınız.', type: 'warning' });
      return;
    }
    try {
      // Kullanıcıyı host yap
      await supabase
        .from('room_participants')
        .update({ role: 'owner' })
        .eq('room_id', id as string)
        .eq('user_id', firebaseUser.uid);
      // rooms tablosunda host_id güncelle
      await supabase
        .from('rooms')
        .update({ host_id: firebaseUser.uid })
        .eq('id', id as string);
      // Geri sayımı iptal et
      setClosingCountdown(null);
      // Tüm odaya bildir
      modChannelRef.current?.send({
        type: 'broadcast', event: 'mod_action',
        payload: { action: 'host_claimed', hostName: profile?.display_name || 'Birisi' },
      });
      showToast({ title: '👑 Host Oldun!', message: 'Oda yönetimi sende. Geri sayım iptal edildi.', type: 'success' });
      // BUG-RM5 FIX: Optimistik state güncelleme — DB çağrısını beklemeden host_id set et
      setRoom(prev => prev ? { ...prev, host_id: firebaseUser.uid } : prev);
      setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'owner' as const } : p));
      // Ek olarak tam veriyi de çek (arka planda)
      RoomService.get(id as string).then(setRoom).catch(() => {});
    } catch (e) {
      showToast({ title: 'Hata', message: 'Host olunamadı', type: 'error' });
    }
  };



  // ========== SAHNEDEN İNME (Self-Demote) ==========
  const handleSelfDemote = () => {
    setAlertConfig({
      visible: true, title: 'Sahneden İn', message: 'Sahneden inip dinleyici olarak devam etmek istiyor musun?', type: 'info', icon: 'arrow-down-circle',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Sahneden İn', onPress: async () => {
          try {
            if (firebaseUser?.uid) {
              if (lk.isMicrophoneEnabled) await lk.toggleMic();
              await RoomService.demoteSpeaker(id as string, firebaseUser.uid);
              // ★ BUG FIX: Optimistik state güncelleme — speaker → listener (UI anında dinleyici grid'ine taşır)
              setParticipants(prev => prev.map(p => p.user_id === firebaseUser!.uid ? { ...p, role: 'listener' as const } : p));
              showToast({ title: 'Sahneden İndin', message: 'Artık dinleyicisin', type: 'info' });
            }
          } catch (e) {
            showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' });
          }
        }}
      ]
    });
  };


  // ★ Moderasyon fonksiyonları useRoomModeration hook'una taşındı


  // ★ ARCH-1: Room timer → useRoomLifecycle hook'undan geliyor (yukarıda çağrıldı)
  // Not: useRoomLifecycle zaten render'ın üstünde çağrılıyor — roomDuration/roomExpiry oradan gelecek
  // Geçici: inline kalıyor çünkü lifecycle hook return'unu burada kullanamıyoruz (hook çağrı sırası)
  const [roomDuration, setRoomDuration] = useState('0 dk');
  const [roomExpiry, setRoomExpiry] = useState('');
  useEffect(() => {
    if (!room?.created_at) return;
    const updateDuration = () => {
      const diff = Date.now() - new Date(room.created_at).getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      if (hrs > 0) setRoomDuration(`${hrs} sa ${mins % 60} dk`);
      else setRoomDuration(`${mins} dk`);
      if (room.expires_at) {
        const remaining = new Date(room.expires_at).getTime() - Date.now();
        if (remaining <= 0) {
          const _t = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as any;
          UpsellService.onRoomDurationExpired(_t);
          setRoomExpiry('⏰ Süre doldu!');
          const isHost = room.host_id === firebaseUser?.uid;
          if (isHost) {
            showToast({ title: '⏰ Süre Doldu', message: 'Oda süresi doldu. Oda kapatılıyor...', type: 'warning' });
            setTimeout(async () => { try { await RoomService.close(id as string); liveKitService.disconnect().catch(() => {}); setMinimizedRoom(null); safeGoBack(router); } catch {} }, 3000);
          } else {
            showToast({ title: '⏰ Süre Doldu', message: 'Oda süresi doldu. Oda kapanıyor...', type: 'warning' });
            setTimeout(() => { liveKitService.disconnect().catch(() => {}); setMinimizedRoom(null); safeGoBack(router); }, 5000);
          }
          return;
        }
        const remMins = Math.floor(remaining / 60000);
        const remHrs = Math.floor(remMins / 60);
        if (remHrs > 0) setRoomExpiry(`${remHrs} sa ${remMins % 60} dk kaldı`);
        else setRoomExpiry(`${remMins} dk kaldı`);
      }
    };
    updateDuration();
    const remaining = room.expires_at ? new Date(room.expires_at).getTime() - Date.now() : Infinity;
    const interval = remaining < 120000 ? 5000 : 30000;
    const timer = setInterval(updateDuration, interval);
    return () => clearInterval(timer);
  }, [room?.created_at, room?.expires_at]);
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  // Rol Dağılımları — useMemo ile cache'le (performans)
  const { stageUsers, listenerUsers, spectatorUsers, viewerCount, amIHost, amIModerator, amIGodMaster, canModerate, isGodOrHost, hostUser, amIActingHost, isOriginalHost } = useMemo(() => {
    // Banned kullanıcıları filtrele
    const active = participants.filter(p => p.role !== 'banned');

    const stage = active.filter(p => p.role === 'owner' || p.role === 'speaker' || p.role === 'moderator');
    // ★ BUG-C FIX: Listener ve Spectator ayrı — spectator'lar grid'de görünmez
    const listeners = active.filter(p => p.role === 'listener');
    const spectators = active.filter(p => p.role === 'spectator' || p.role === 'guest');
    const _amIHost = room?.host_id === firebaseUser?.uid;
    const _amIMod = active.some(p => p.user_id === firebaseUser?.uid && p.role === 'moderator');
    const _amIGod = profile?.is_admin === true;
    // ★ Vekil owner kontrolü: participant role='owner' ama rooms.host_id farklı
    const _amIActingHost = !_amIHost && active.some(p => p.user_id === firebaseUser?.uid && p.role === 'owner');
    const _isOriginalHost = _amIHost && !room?.room_settings?.original_host_id;
    const _canMod = _amIHost || _amIActingHost || _amIMod || _amIGod;
    const _isGodOrHost = _amIHost || _amIActingHost || _amIGod;
    const _hostUser = active.find(p => p.role === 'owner' || p.user_id === room?.host_id);

    // Ghost filtreleme — owner/mod tüm ghost'ları görür, diğerleri görmez
    const canSeeGhosts = _canMod;
    const visibleStage = canSeeGhosts ? stage : stage.filter(p => !(p as any).is_ghost || p.user_id === firebaseUser?.uid);
    const visibleListeners = canSeeGhosts ? listeners : listeners.filter(p => !(p as any).is_ghost || p.user_id === firebaseUser?.uid);
    const visibleSpectators = canSeeGhosts ? spectators : spectators.filter(p => !(p as any).is_ghost || p.user_id === firebaseUser?.uid);

    return { stageUsers: visibleStage, listenerUsers: visibleListeners, spectatorUsers: visibleSpectators, viewerCount: active.length, amIHost: _amIHost || _amIActingHost, amIModerator: _amIMod, amIGodMaster: _amIGod, canModerate: _canMod, isGodOrHost: _isGodOrHost, hostUser: _hostUser, amIActingHost: _amIActingHost, isOriginalHost: _isOriginalHost };
  }, [participants, room?.host_id, room?.room_settings?.original_host_id, firebaseUser?.uid, profile?.is_admin]);

  // ★ Mevcut rolümü belirle (özellik erisiÌ‡mi için)
  const myCurrentRole: 'owner' | 'moderator' | 'speaker' | 'listener' = useMemo(() => {
    if (amIHost) return 'owner';
    if (amIModerator) return 'moderator';
    const myPart = participants.find(p => p.user_id === firebaseUser?.uid);
    if (myPart?.role === 'speaker') return 'speaker';
    return 'listener';
  }, [amIHost, amIModerator, participants, firebaseUser?.uid]);

  // ★ Owner tier'ı — oda yönetim özelliklerinin tier kilidini belirler
  const ownerTier = useMemo(() => {
    // ★ Admin (GodMaster) her zaman VIP gibi davranır
    if (profile?.is_admin) return 'VIP';
    return (room as any)?.owner_tier || room?.host?.subscription_tier || 'Free';
  }, [room, profile?.is_admin]);

  // ★ Moderasyon aksiyonları — çıkarılmış hook
  const {
    handlePromoteToStage,
    handleKickUser,
    handleToggleChatMute,
    handleToggleModerator,
    handleTimedMuteUser,
    executeUnmute,
    handleGhostToggle,
    handleDisguiseUser,
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

  // ★ VIP: Tümünü Sustur
  const handleMuteAll = useCallback(async () => {
    if (!room || !firebaseUser) return;
    setAlertConfig({
      visible: true, title: '🔇 Tümünü Sustur', message: 'Sahnedeki tüm konuşmacıların mikrofonları kapatılacak.',
      type: 'warning', icon: 'volume-mute',
      buttons: [
        { text: 'İptal', style: 'cancel' },
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
          showToast({ title: '🔇 Tümü Susturuldu', message: `${stagePeople.length} konuşmacı susturuldu`, type: 'success' });
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

    // ★ K5 FIX: Speaking mode kontrolü — konuşma moduna göre sahneye çıkışı filtrele
    if (speakingMode === 'selected_only') {
      showToast({ title: '🔒 Seçilmişler Modu', message: 'Bu odada sadece oda sahibinin seçtiği kişiler sahneye çıkabilir.', type: 'warning' });
      return;
    }
    if (speakingMode === 'permission_only') {
      // El kaldırma akışına yönlendir
      if (!myMicRequested) {
        setMyMicRequested(true);
        micReqChannelRef.current?.send({
          type: 'broadcast', event: 'mic_request',
          payload: { type: 'request', userId: firebaseUser.uid, displayName: profile?.display_name || 'Kullanıcı' },
        });
        showToast({ title: '🤚 Sahne Talebi Gönderildi', message: 'Oda sahibinin onayı bekleniyor...', type: 'success' });
      } else {
        showToast({ title: 'Zaten Bekliyor', message: 'Sahne talebiniz zaten gönderildi.', type: 'info' });
      }
      setShowSeatTooltip(false);
      return;
    }

    // free_for_all — direkt sahneye çık
    // ★ UX-1 FIX: Sahne slot limiti kontrolü (frontend guard)
    const ownerTierForSlots = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as any;
    const slotLimits = getRoomLimits(ownerTierForSlots);
    const currentStage = participants.filter(p => ['owner', 'speaker', 'moderator'].includes(p.role));
    if (currentStage.length >= slotLimits.maxSpeakers) {
      showToast({ title: 'Sahne Dolu', message: `Sahnede max ${slotLimits.maxSpeakers} kişi olabilir.`, type: 'warning' });
      return;
    }
    try {
      await RoomService.promoteSpeaker(room.id, firebaseUser.uid);
      setParticipants(prev => prev.map(p => p.user_id === firebaseUser!.uid ? { ...p, role: 'speaker' as const, is_muted: false } : p));
      showToast({ title: 'Sahneye Hoş Geldin!', message: 'Mikrofon ve kameranı açabilirsin', type: 'success' });
      setShowSeatTooltip(false);
    } catch (e: any) {
      showToast({ title: 'Sahne Dolu', message: e?.message || 'Sahneye çıkılamadı', type: 'warning' });
    }
  }, [room, firebaseUser?.uid, speakingMode, myMicRequested, profile?.display_name]);

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
    const ownerTierForLimits = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as any;
    const tierLimits = getRoomLimits(ownerTierForLimits);
    const maxSlots = tierLimits.maxSpeakers;
    const currentStage = participants.filter(p => ['owner', 'speaker', 'moderator'].includes(p.role));
    const currentStageCount = currentStage.length;

    // ★ Sahne dolu değilse doğrudan çık
    if (currentStageCount < maxSlots) {
      try {
        if (isOwnerUser) {
          // Owner: role'ü tekrar 'owner' olarak ayarla (zaten host_id eşleşiyor)
          await RoomService.promoteSpeaker(room.id, firebaseUser.uid);
          setParticipants(prev => prev.map(p => p.user_id === firebaseUser!.uid ? { ...p, role: 'owner' as const, is_muted: false } : p));
        } else {
          await RoomService.promoteSpeaker(room.id, firebaseUser.uid);
          // Moderatör tekrar sahneye çıktığında rol moderatör olarak kalmalı
          await supabase.from('room_participants').update({ role: 'moderator' }).eq('room_id', room.id).eq('user_id', firebaseUser.uid);
          setParticipants(prev => prev.map(p => p.user_id === firebaseUser!.uid ? { ...p, role: 'moderator' as const, is_muted: false } : p));
        }
        showToast({ title: '🎤 Sahneye Çıktın!', message: 'Mikrofon otomatik açılıyor...', type: 'success' });
        setTimeout(() => { lk.enableMic?.().catch(() => {}); }, 500);
      } catch {
        showToast({ title: 'Hata', message: 'Sahneye çıkılamadı', type: 'error' });
      }
      return;
    }

    // ★ Sahne dolu — Owner her zaman çıkabilir (slot eklenir veya yer açılır)
    if (isOwnerUser) {
      try {
        await RoomService.promoteSpeaker(room.id, firebaseUser.uid);
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser!.uid ? { ...p, role: 'owner' as const, is_muted: false } : p));
        showToast({ title: '👑 Sahneye Çıktın!', message: 'Oda sahibi olarak sahneye döndün', type: 'success' });
        setTimeout(() => { lk.enableMic?.().catch(() => {}); }, 500);
      } catch {
        showToast({ title: 'Hata', message: 'Sahneye çıkılamadı', type: 'error' });
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
      showToast({ title: 'Sahne Dolu', message: 'Sahnede sadece oda sahibi ve moderatörler var. Yer açılamıyor.', type: 'warning' });
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
      showToast({ title: '🛡️ Sahneye Çıktın!', message: `${victim.user?.display_name || 'Konuşmacı'} dinleyiciye alındı, sen sahneye geçtin.`, type: 'success' });
      setTimeout(() => { lk.enableMic?.().catch(() => {}); }, 500);
    } catch {
      showToast({ title: 'Hata', message: 'Sahneye çıkılamadı', type: 'error' });
    }
  }, [room, firebaseUser?.uid, participants, lk]);


  const hostAvatarUri = hostUser?.user?.avatar_url
    ? { uri: hostUser.user.avatar_url }
    : getAvatarSource(room?.host_id?.includes('female') ? 'avatar_f_1.png' : 'avatar_m_2.png');


  // ★ ARCH-1: handleSendDm artık useRoomDM hook'undan geliyor



  // showChatDrawer state
  const [showChatDrawer, setShowChatDrawer] = React.useState(false);

  // ★ Oda bağlantısını paylaş
  const handleShareRoom = useCallback(async () => {
    try {
      await Share.share({
        message: `🎤 "${room?.name || 'Oda'}" odasına gel! SopranoChat'te konuşalım:\nhttps://sopranochat.app/room/${id}`,
        title: room?.name || 'SopranoChat Odası',
      });
    } catch (e) {
      showToast({ title: 'Paylaşılamadı', message: 'Link kopyalanamadı', type: 'error' });
    }
  }, [room?.name, id]);

  // ★ Boost Satın Alma — Host için keşfette öne çıkarma
  const handleBoostRoom = useCallback(() => {
    if (!room || !firebaseUser?.uid) return;
    setAlertConfig({
      visible: true, title: '🚀 Keşfette Öne Çıkar', message: 'Odanı keşfet sayfasında üst sıralara çıkar!\n\n⭐ 1 Saat = 100 SP\n⭐ 6 Saat = 400 SP', type: 'info', icon: 'rocket',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        { text: '1 Saat (100 SP)', onPress: async () => {
          try {
            const result = await GamificationService.purchaseRoomBoost(firebaseUser.uid, 1);
            if (!result.success) { showToast({ title: 'Yetersiz SP', message: result.error || 'SP bakiyeniz yeterli değil.', type: 'warning' }); return; }
            await RoomService.activateBoost(room.id, firebaseUser.uid, 1);
            showToast({ title: '🚀 Boost Aktif!', message: '1 saat boyunca keşfette öne çıkacaksın!', type: 'success' });
          } catch (e: any) { showToast({ title: 'Hata', message: e.message || 'Boost aktifleştirilemedi', type: 'error' }); }
        }},
        { text: '6 Saat (400 SP)', onPress: async () => {
          try {
            const result = await GamificationService.purchaseRoomBoost(firebaseUser.uid, 6);
            if (!result.success) { showToast({ title: 'Yetersiz SP', message: result.error || 'SP bakiyeniz yeterli değil.', type: 'warning' }); return; }
            await RoomService.activateBoost(room.id, firebaseUser.uid, 6);
            showToast({ title: '🚀 Boost Aktif!', message: '6 saat boyunca keşfette öne çıkacaksın!', type: 'success' });
          } catch (e: any) { showToast({ title: 'Hata', message: e.message || 'Boost aktifleştirilemedi', type: 'error' }); }
        }},
      ],
    });
  }, [room, firebaseUser?.uid]);

  // ★ Oda takip durumu yükle
  useEffect(() => {
    if (room?.id && firebaseUser?.uid) {
      RoomFollowService.isFollowing(room.id, firebaseUser.uid).then(setIsFollowingRoom).catch(() => {});
    }
  }, [room?.id, firebaseUser?.uid]);

  const handleToggleFollow = useCallback(async () => {
    if (!room?.id || !firebaseUser?.uid) return;
    const newState = !isFollowingRoom;
    setIsFollowingRoom(newState);
    try {
      if (newState) {
        await RoomFollowService.follow(room.id, firebaseUser.uid);
      } else {
        await RoomFollowService.unfollow(room.id, firebaseUser.uid);
      }
    } catch {
      setIsFollowingRoom(!newState); // rollback
    }
  }, [room?.id, firebaseUser?.uid, isFollowingRoom]);

  // ★ Seçilen kullanıcının takip durumunu çek (ProfileCard Takip Et butonu için)
  // ★ BUG-1/7 FIX: getDetailedStatus kullanarak çift yönlü kontrol + her seçimde taze veri
  useEffect(() => {
    if (!selectedUser || !firebaseUser || selectedUser.user_id === firebaseUser.uid) return;
    FriendshipService.getDetailedStatus(firebaseUser.uid, selectedUser.user_id)
      .then(({ outgoing }) => {
        setUserFollowStatus(prev => ({ ...prev, [selectedUser.user_id]: outgoing ?? null }));
      })
      .catch(() => {});
  }, [selectedUser?.user_id, firebaseUser?.uid]);

  if (loading) return <View style={sty.root} />;

  return (
    <Animated.View style={[sty.root, { opacity: fadeIn }]}>
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
        return (
          <ImageBackground source={require('../../assets/images/room_in_bg.jpg')} style={StyleSheet.absoluteFillObject} resizeMode="cover">
            <LinearGradient colors={['rgba(12,24,41,0.3)', 'rgba(10,21,32,0.5)', 'rgba(7,16,24,0.7)']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
          </ImageBackground>
        );
      })()}

      <View style={{ paddingTop: Math.max(insets.top, 12) + 4 }}>
        <RoomInfoHeader
          roomName={room?.name || 'Oda'} roomDescription={room?.description} isPremium={(room as any)?.isPremium}
          viewerCount={viewerCount} connectionState={lk.connectionState} roomDuration={roomDuration} roomExpiry={roomExpiry}
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
          roomRules={typeof (room?.room_settings as any)?.rules === 'string' ? (room?.room_settings as any).rules : Array.isArray((room?.room_settings as any)?.rules) ? (room?.room_settings as any).rules.join(' · ') : undefined}
          onBack={() => { if (amIHost) { setAlertConfig({ visible: true, title: 'Odadan Ayrıl', message: 'Ayrılmak istiyor musun?', type: 'warning', icon: 'exit-outline', buttons: [{ text: 'İptal', style: 'cancel' }, { text: 'Ayrıl', style: 'destructive', onPress: handleHostLeave }] }); } else { handleUserLeave(); } }}
          onMinimize={() => { isMinimizingRef.current = true; setMinimizedRoom({ id: id as string, name: room?.name || 'Oda', hostName: hostUser?.user?.display_name || 'Host', viewerCount, isMicOn: lk.isMicrophoneEnabled || false }); safeGoBack(router); }}
        />
      </View>

      {/* Header menüsü kaldırıldı — Oda Paylaş ve Ayarlar PlusMenu'dan erişilebilir */}

      {/* ★ GERİ SAYIM BANNER — Host + mod ayrıldığında görünür */}
      {closingCountdown !== null && closingCountdown > 0 && (
        <View style={{ marginHorizontal: 14, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '700' }}>⏳ Oda {closingCountdown}sn içinde kapanacak</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 }}>Oda sahibi ve moderatör ayrıldı.</Text>
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

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        <SpeakerSection stageUsers={stageUsers} getMicStatus={getMicStatus}
          onSelectUser={(u) => { if (u.user_id === firebaseUser?.uid) handleSelfDemote(); else setSelectedUser(u); }}
          currentUserId={firebaseUser?.uid} VideoView={LKVideoView}
          onGhostSeatPress={handleGhostSeatPress} showSeatTooltip={showSeatTooltip} />
        <ListenerGrid listeners={listenerUsers} onSelectUser={(u) => setSelectedUser(u)} selectedUserId={selectedUser?.user_id} onShowAllUsers={() => setShowAudienceDrawer(true)} maxListeners={getRoomLimits(ownerTier as any).maxListeners} spectatorCount={spectatorUsers.length} roomOwnerId={room?.host_id} />
      </ScrollView>

      {/* ★ Inline Chat — alt barın üstünde, şeffaf metin (tıklayınca drawer açılır, drawer açıkken gizle) */}
      {!showChatDrawer && (
        <Pressable onPress={() => setShowChatDrawer(true)} style={{ position: 'absolute', bottom: Math.max(insets.bottom, 14) + 120, left: 0, right: 0, zIndex: 5 }}>
          <InlineChat messages={chatMessages as any[]} maxLines={4} />
        </Pressable>
      )}

      {!!entryEffectName && <PremiumEntryBanner name={entryEffectName} onDone={() => setEntryEffectName(null)} />}
      <FloatingReactionsView ref={floatingRef} />
      <SPToast ref={spToastRef} />
      {showEmojiBar && (<View style={{ position: 'absolute', bottom: Math.max(insets.bottom, 14) + 100, left: 0, right: 0, alignItems: 'center', zIndex: 50 }}><EmojiReactionBar onReaction={(emoji) => sendEmojiReaction(emoji)} /></View>)}

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: Math.max(insets.bottom, 14) + 2 }}>
        <LinearGradient colors={['transparent', 'rgba(5,10,20,0.95)']} locations={[0, 0.4]} style={[StyleSheet.absoluteFill, { top: -20 }]} pointerEvents="none" />
        <RoomControlBar isMicOn={lk.isMicrophoneEnabled || false} isCameraOn={lk.isCameraEnabled || false}
          chatInput={chatInput} onChatInputChange={setChatInput} onChatSend={handleSendChat} chatInputRef={chatInputRef}
          showCamera={(amIHost || amIModerator || stageUsers.some(u => u.user_id === firebaseUser?.uid)) && getRoomLimits(((room as any)?.owner_tier || 'Free') as any).maxCameras > 0}
          isHandRaised={myMicRequested} handBadgeCount={micRequests.length} canModerate={canModerate}
          isListener={!stageUsers.some(u => u.user_id === firebaseUser?.uid)}
          isOwnerInListenerMode={!stageUsers.some(u => u.user_id === firebaseUser?.uid) && amIHost}
          isModInListenerMode={!stageUsers.some(u => u.user_id === firebaseUser?.uid) && amIModerator}
          onJoinStagePress={handleOwnerModJoinStage}
          isRoomMuted={roomMuted}
          chatBadgeCount={0} isChatOpen={showChatDrawer}
          dmBadgeCount={dmUnreadCount} onDmPress={toggleDmPanel}
          onMicPress={handleMicPress}
          onMuteRoomPress={() => setRoomMuted(!roomMuted)}
          onCameraPress={() => {
            const _ownerTier = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as any;
            const _tLimits = getRoomLimits(_ownerTier);
            if (_tLimits.maxCameras === 0) {
              UpsellService.onCameraLimit(_ownerTier);
              showToast({ title: 'Kamera Kapalı', message: 'Bu tier\'da kamera kullanılamıyor. Üyeliği yükselt!', type: 'warning' });
              return;
            }
            // BUG-RM21 FIX: lk.participants zaten local'i içeriyor, çift sayma
            const activeCams = lk.participants.filter((p: any) => p.isCameraEnabled).length;
            if (!lk.isCameraEnabled && activeCams >= _tLimits.maxCameras) {
              UpsellService.onCameraLimit(_ownerTier);
              showToast({ title: 'Kamera Limiti', message: 'Maksimum ' + _tLimits.maxCameras + ' kamera açılabilir.', type: 'warning' });
              return;
            }
            try { lk.toggleCamera?.(); } catch {}
          }} onEmojiPress={() => setShowEmojiBar(!showEmojiBar)}
          onHandPress={handleMicRequest} onChatPress={() => setShowChatDrawer(!showChatDrawer)} onPlusPress={() => setShowPlusMenu(true)}
          onLeavePress={() => {
            setAlertConfig({
              visible: true, title: 'Odadan Ayrıl', message: 'Odadan ayrılmak istediğinize emin misiniz?', type: 'warning', icon: 'exit-outline',
              buttons: [{ text: 'İptal', style: 'cancel' }, { text: 'Ayrıl', onPress: () => { isRoomClosingRef.current = true; if (amIHost) { handleHostLeave(); } else { handleUserLeave(); } }, style: 'destructive' }],
            });
          }} />
      </View>

      <RoomChatDrawer visible={showChatDrawer} messages={chatMessages as any[]} chatInput={chatInput}
        onChangeInput={setChatInput} onSend={handleSendChat} onClose={() => setShowChatDrawer(false)} bottomInset={insets.bottom} />

      {/* ★ DM MİNİ PANELİ — Oda içi mesaj bildirimleri (odadan çıkarmaz) */}
      {showDmPanel && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} onPress={() => setShowDmPanel(false)} />
          <Animated.View style={{
            position: 'absolute', bottom: Math.max(insets.bottom, 14) + 110, right: 10, left: 10,
            maxHeight: 320, borderRadius: 16, backgroundColor: '#1E293B',
            borderWidth: 1, borderColor: 'rgba(20,184,166,0.12)',
            shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 16,
            overflow: 'hidden',
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(20,184,166,0.04)' }}>
              <Ionicons name="mail" size={16} color="#14B8A6" />
              <Text style={{ color: '#F1F5F9', fontSize: 14, fontWeight: '700', marginLeft: 8, flex: 1 }}>Mesajlar</Text>
              <Pressable onPress={() => setShowDmPanel(false)} hitSlop={8}>
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.3)" />
              </Pressable>
            </View>
            {/* Mesaj listesi */}
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 8, gap: 4 }}>
              {dmInboxMessages.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Ionicons name="chatbubbles-outline" size={32} color="rgba(255,255,255,0.1)" />
                  <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 8 }}>Henüz mesaj yok</Text>
                </View>
              ) : (
                dmInboxMessages.slice(0, 10).map((msg: any, idx: number) => {
                  const senderName = msg.sender_display_name || msg.other_display_name || 'Birisi';
                  const senderAvatar = msg.sender_avatar_url || msg.other_avatar_url;
                  const preview = msg.last_message || msg.content || '';
                  const isUnread = msg.unread_count > 0 || !msg.is_read;
                  const senderId = msg.other_user_id || msg.sender_id;
                  const timeAgo = msg.last_message_at || msg.created_at;
                  const mins = timeAgo ? Math.floor((Date.now() - new Date(timeAgo).getTime()) / 60000) : 0;
                  const timeLabel = mins < 1 ? 'şimdi' : mins < 60 ? `${mins}dk` : mins < 1440 ? `${Math.floor(mins / 60)}sa` : `${Math.floor(mins / 1440)}g`;
                  return (
                    <Pressable
                      key={`dm_${idx}`}
                      onPress={() => {
                        setShowDmPanel(false);
                        setDmTarget({ userId: senderId, nick: senderName });
                        setDmText('');
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10,
                        backgroundColor: pressed ? 'rgba(255,255,255,0.04)' : isUnread ? 'rgba(20,184,166,0.06)' : 'transparent',
                      })}
                    >
                      {/* ★ Gönderici Avatarı */}
                      <Image source={getAvatarSource(senderAvatar)} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: isUnread ? 'rgba(20,184,166,0.3)' : 'rgba(255,255,255,0.06)' }} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ color: isUnread ? '#F1F5F9' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: isUnread ? '700' : '500' }} numberOfLines={1}>{senderName}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>{timeLabel}</Text>
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 }} numberOfLines={1}>{preview}</Text>
                      </View>
                      {isUnread && msg.unread_count > 0 && (
                        <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#14B8A6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                          <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800' }}>{msg.unread_count > 9 ? '9+' : msg.unread_count}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Animated.View>
        </View>
      )}

      <AudienceDrawer visible={showAudienceDrawer} users={[...stageUsers, ...listenerUsers, ...spectatorUsers]}
        onClose={() => setShowAudienceDrawer(false)} onSelectUser={(u) => setSelectedUser(u as any)} />

      {!!selectedUser && (() => {
        // ★ BUG-1/2/3 FIX: Merkezi yetki motoru entegrasyonu
        const _myRole = myCurrentRole as ParticipantRole;
        const _targetRole = selectedUser.role as ParticipantRole;
        const _ownerTierPerm = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as SubscriptionTier;
        const _isFreeOwner = amIHost && _ownerTierPerm === 'Free';
        const _isSelf = selectedUser.user_id === firebaseUser?.uid;
        const _notSelf = !_isSelf;
        // ★ Rol hiyerarşi kontrolü: aktör hedeften yüksek mi?
        const _canActOn = (ROLE_LEVEL[_myRole] ?? 0) > (ROLE_LEVEL[_targetRole] ?? 0);
        // ★ Tier kontrolü yardımcı fonksiyonu
        const _hasTier = (minTier: SubscriptionTier) => isTierAtLeast(_ownerTierPerm, minTier);
        // ★ Permission check helper
        const _perm = (p: string) => checkPermission(_myRole, _targetRole, p as any, _ownerTierPerm, _isSelf).allowed;

        return (
        <ProfileCard nick={(selectedUser as any)?.disguise?.display_name || selectedUser.user?.display_name || 'Gizli'} role={selectedUser.role} avatarUrl={(selectedUser as any)?.disguise?.avatar_url || selectedUser.user?.avatar_url}
          isOwnProfile={_isSelf} isChatMuted={selectedUser.is_chat_muted || false}
          isMuted={selectedUser.is_muted || false} mutedUntil={selectedUser.muted_until || null}
          onClose={() => setSelectedUser(null)}
          onViewProfile={() => { setSelectedUser(null); router.push(`/user/${selectedUser.user_id}` as any); }}
          isFollowing={userFollowStatus[selectedUser.user_id] === 'accepted'}
          isPending={userFollowStatus[selectedUser.user_id] === 'pending'}
          onFollow={async () => {
            if (!firebaseUser) return;
            const currentStatus = userFollowStatus[selectedUser.user_id];
            try {
              if (currentStatus === 'accepted' || currentStatus === 'pending') {
                // Takipten çık / İsteği iptal et
                setUserFollowStatus(prev => ({ ...prev, [selectedUser.user_id]: null }));
                const r = await FriendshipService.unfollow(firebaseUser.uid, selectedUser.user_id);
                if (!r.success) setUserFollowStatus(prev => ({ ...prev, [selectedUser.user_id]: currentStatus }));
              } else {
                // Takip isteği gönder
                setUserFollowStatus(prev => ({ ...prev, [selectedUser.user_id]: 'pending' }));
                const r = await FriendshipService.follow(firebaseUser.uid, selectedUser.user_id);
                if (!r.success) {
                  setUserFollowStatus(prev => ({ ...prev, [selectedUser.user_id]: null }));
                  if (r.error) showToast({ title: r.error, type: 'warning' });
                }
              }
            } catch {
              setUserFollowStatus(prev => ({ ...prev, [selectedUser.user_id]: currentStatus ?? null }));
            }
          }}
          onDM={() => { setDmTarget({ userId: selectedUser.user_id, nick: selectedUser.user?.display_name || 'Kullanıcı' }); setDmText(''); setSelectedUser(null); }}
          onPromoteToStage={_perm('promote_speaker') && selectedUser.role === 'listener' && _notSelf ? () => handlePromoteToStage(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onRemoveFromStage={_perm('demote_speaker') && (selectedUser.role === 'speaker') && _notSelf ? async () => { try { await RoomService.demoteSpeaker(id as string, selectedUser.user_id); modChannelRef.current?.send({ type: 'broadcast', event: 'mod_action', payload: { action: 'demote', targetUserId: selectedUser.user_id } }); setParticipants(prev => prev.map(p => p.user_id === selectedUser.user_id ? { ...p, role: 'listener' as const } : p)); setSelectedUser(null); } catch {} } : undefined}
          onMute={_perm('timed_mute') && _notSelf && !selectedUser.is_muted ? () => handleTimedMuteUser(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onUnmute={_canActOn && _notSelf && selectedUser.is_muted ? () => executeUnmute(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onChatMute={_perm('chat_block') && _notSelf ? () => handleToggleChatMute(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı', selectedUser.is_chat_muted || false) : undefined}
          onKick={_perm('kick') && _notSelf ? () => handleKickUser(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onMakeModerator={_perm('set_moderator') && _notSelf && selectedUser.role !== 'owner' ? () => handleToggleModerator(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı', selectedUser.role) : undefined}
          onReport={_notSelf ? () => handleReportUser(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onBlock={_notSelf ? () => handleBlockUser(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onGhostMode={_perm('ghost_mode') && _isSelf ? handleGhostToggle : undefined}
          isGhost={(selectedUser as any)?.is_ghost || false}
          onDisguise={_perm('disguise_user') && _notSelf ? () => handleDisguiseUser(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onBanTemp={!_isFreeOwner && _perm('ban_temporary') && _notSelf ? () => handleTempBan(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onBanPerm={!_isFreeOwner && _perm('ban_permanent') && _notSelf ? () => handlePermBan(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onPersonalMute={_notSelf ? () => {
            setPersonallyMutedUsers(prev => {
              const next = new Set(prev);
              if (next.has(selectedUser.user_id)) next.delete(selectedUser.user_id);
              else next.add(selectedUser.user_id);
              return next;
            });
          } : undefined}
          isPersonallyMuted={personallyMutedUsers.has(selectedUser.user_id)}
          donationsEnabled={!!((room?.room_settings as any)?.donations_enabled) && _notSelf}
          onTip={_notSelf ? () => {
            const amounts = [5, 10, 25, 50, 100];
            setAlertConfig({
              visible: true, title: '❤️ SP Bağış Yap', type: 'info', icon: 'heart',
              message: `${selectedUser.user?.display_name || 'Kullanıcı'} adlı kişiye kaç SP bağış yapmak istersin?`,
              buttons: amounts.map(amt => ({
                text: `${amt} SP`, onPress: async () => {
                  try {
                    const result = await GamificationService.spend(firebaseUser!.uid, amt, 'tip');
                    if (!result.success) { showToast({ title: 'Yetersiz SP', message: result.error || '', type: 'error' }); return; }
                    await GamificationService.earn(selectedUser.user_id, amt, 'tip_received');
                    showToast({ title: `❤️ ${amt} SP Gönderildi!`, message: `${selectedUser.user?.display_name} bağışınız için teşekkürler`, type: 'success' });
                    spToastRef.current?.show(-amt, 'Bağış');
                    setSelectedUser(null);
                  } catch { showToast({ title: 'Hata', type: 'error' }); }
                }
              })),
            });
          } : undefined}
          onSelfDemote={_isSelf ? handleSelfDemote : undefined}
        />
        );
      })()}



      <RoomSettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} micMode={micMode} onMicModeChange={handleMicModeChange}
        noiseCancellation={noiseCancellation} onNoiseCancellationChange={handleNoiseCancellation} cameraFacing={cameraFacing}
        onCameraFacingChange={setCameraFacing} useSpeaker={useSpeaker} onSpeakerChange={handleSpeakerToggle}
        isMicEnabled={lk.isMicrophoneEnabled || false} isCameraEnabled={lk.isCameraEnabled || false}
        onLeaveRoom={handleSettingsLeave}
        canDeleteRoom={(amIHost && !amIActingHost) || amIGodMaster} onDeleteRoom={handleDeleteRoom}
        isHost={amIHost} currentThemeId={room?.theme_id}
        onChangeTheme={amIHost && isTierAtLeast(ownerTier as any, 'Silver') ? async (themeId) => { if (!room || !firebaseUser) return; try { await RoomService.setRoomTheme(room.id, firebaseUser.uid, themeId); setRoom(prev => prev ? { ...prev, theme_id: themeId } : prev); modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { theme_id: themeId } }); showToast({ title: '🎨 Tema!', type: 'success' }); } catch (err: any) { showToast({ title: 'Hata', message: err.message, type: 'error' }); } } : undefined}
        roomName={room?.name}
        onRenameRoom={amIHost ? async (newName: string) => { if (!room) return; try { await ModerationService.editRoomName(room.id, newName); setRoom(prev => prev ? { ...prev, name: newName } : prev); modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { name: newName } }); showToast({ title: 'İsim Güncellendi', type: 'success' }); } catch { showToast({ title: 'Hata', type: 'error' }); } } : undefined}
        welcomeMessage={(room?.room_settings as any)?.welcome_message || ''}
        onChangeWelcomeMessage={amIHost ? async (msg: string) => { if (!room || !firebaseUser) return; try { await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { welcome_message: msg } }); setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), welcome_message: msg } } : prev); modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { welcome_message: msg } } }); showToast({ title: msg ? '✅ Hoş Geldin Mesajı Ayarlandı' : 'Hoş Geldin Mesajı Kaldırıldı', type: 'success' }); } catch { showToast({ title: 'Hata', type: 'error' }); } } : undefined}
        backgroundImage={(room as any)?.room_image_url || (room?.room_settings as any)?.room_image_url || null}
        onChangeBackgroundImage={amIHost && isTierAtLeast(ownerTier as any, 'Silver') ? async (imageUri: string | null) => {
          if (!room || !firebaseUser) return;
          if (imageUri === 'default') {
            // Image picker aç
            try {
              const ImagePicker = require('expo-image-picker');
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) { showToast({ title: 'İzin Gerekli', message: 'Galeriye erişim izni verilmeli.', type: 'warning' }); return; }
              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.7 });
              if (result.canceled) return;
              const pickedUri = result.assets[0].uri;
              // ★ StorageService ile yükle — RN uyumlu, resize + base64 decode
              const { StorageService } = require('../../services/storage');
              const fileName = `room_bg/${room.id}_${Date.now()}.jpg`;
              const url = await StorageService.uploadFile('post-images', fileName, pickedUri);
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { room_image_url: url } });
              setRoom(prev => prev ? { ...prev, room_image_url: url, room_settings: { ...(prev.room_settings || {}), room_image_url: url } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_image_url: url, room_settings: { room_image_url: url } } });
              showToast({ title: '🖼️ Arka Plan Güncellendi', type: 'success' });
            } catch (e: any) { showToast({ title: 'Hata', message: e.message || 'Resim yüklenemedi', type: 'error' }); }
          } else {
            // null = kaldır
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { room_image_url: null } });
              setRoom(prev => prev ? { ...prev, room_image_url: null, room_settings: { ...(prev.room_settings || {}), room_image_url: null } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_image_url: null, room_settings: { room_image_url: null } } });
              showToast({ title: 'Arka Plan Kaldırıldı', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          }
        } : undefined}
        isLocked={(room?.room_settings as any)?.is_locked || false}
        onToggleLock={amIHost && isTierAtLeast(ownerTier as any, 'Silver') ? async (locked: boolean) => { if (!room) return; try { await RoomService.setRoomLock(room.id, locked); setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), is_locked: locked } } : prev); modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { is_locked: locked } } }); showToast({ title: locked ? 'Oda Kilitlendi' : 'Kilit Açıldı', type: 'success' }); } catch { showToast({ title: 'Hata', type: 'error' }); } } : undefined}
        followersOnly={(room?.room_settings as any)?.followers_only || false}
        onToggleFollowersOnly={amIHost && isTierAtLeast(ownerTier as any, 'Gold') ? async (enabled: boolean) => { if (!room) return; try { await RoomService.updateSettings(room.id, firebaseUser!.uid, { room_settings: { followers_only: enabled } }); setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), followers_only: enabled } } : prev); modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { followers_only: enabled } } }); showToast({ title: enabled ? 'Takipçilere Özel' : 'Herkese Açık', type: 'success' }); } catch { showToast({ title: 'Hata', type: 'error' }); } } : undefined}
        slowModeSeconds={(room?.room_settings as any)?.slow_mode_seconds || 0}
        onSlowModeChange={canModerate ? async (seconds: number) => { if (!room) return; try { await RoomService.updateSettings(room.id, firebaseUser!.uid, { room_settings: { slow_mode_seconds: seconds } }); setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), slow_mode_seconds: seconds } } : prev); modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { slow_mode_seconds: seconds } } }); showToast({ title: seconds ? `Slow Mode: ${seconds}sn` : 'Slow Mode Kapalı', type: 'success' }); } catch { showToast({ title: 'Hata', type: 'error' }); } } : undefined}
        ownerTier={ownerTier}
        speakingMode={speakingMode}
        onSpeakingModeChange={amIHost ? async (mode) => {
          setSpeakingMode(mode);
          if (room) {
            try {
              await RoomService.updateSettings(room.id, firebaseUser!.uid, { room_settings: { speaking_mode: mode } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), speaking_mode: mode } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { speaking_mode: mode } } });
              const labels: Record<string, string> = { free_for_all: 'Serbest Mod', permission_only: 'İzinli Mod', selected_only: 'Seçilmişler Modu' };
              showToast({ title: labels[mode] || 'Mod', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          }
        } : undefined}
        roomType={(room?.type || 'open') as any}
        onRoomTypeChange={amIHost && isTierAtLeast(ownerTier as any, 'Bronze') ? async (newType) => {
          if (!room) return;
          try {
            await supabase.from('rooms').update({ type: newType }).eq('id', room.id);
            setRoom(prev => prev ? { ...prev, type: newType } : prev);
            modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { type: newType } });
            showToast({ title: 'Oda Tipi Güncellendi', type: 'success' });
          } catch { showToast({ title: 'Hata', type: 'error' }); }
        } : undefined}
        entryFeeSp={(room?.room_settings as any)?.entry_fee_sp || 0}
        onEntryFeeChange={amIHost && isTierAtLeast(ownerTier as any, 'VIP') ? async (fee) => {
          if (!room) return;
          try {
            await RoomService.updateSettings(room.id, firebaseUser!.uid, { room_settings: { entry_fee_sp: fee } });
            setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), entry_fee_sp: fee } } : prev);
            modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { entry_fee_sp: fee } } });
            showToast({ title: fee > 0 ? `Giriş: ${fee} SP` : 'Giriş Ücretsiz', type: 'success' });
          } catch { showToast({ title: 'Hata', type: 'error' }); }
        } : undefined}
        donationsEnabled={(room?.room_settings as any)?.donations_enabled || false}
        onDonationsToggle={amIHost && isTierAtLeast(ownerTier as any, 'Gold') ? async (enabled) => {
          if (!room) return;
          try {
            await RoomService.updateSettings(room.id, firebaseUser!.uid, { room_settings: { donations_enabled: enabled } });
            setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), donations_enabled: enabled } } : prev);
            modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { donations_enabled: enabled } } });
            showToast({ title: enabled ? 'Bağış Açıldı' : 'Bağış Kapatıldı', type: 'success' });
          } catch { showToast({ title: 'Hata', type: 'error' }); }
        } : undefined}
        roomRules={typeof (room?.room_settings as any)?.rules === 'string' ? (room?.room_settings as any).rules : Array.isArray((room?.room_settings as any)?.rules) ? (room?.room_settings as any).rules.join('\n') : ''}
        onRulesChange={amIHost ? async (rulesText) => {
          if (!room || !firebaseUser) return;
          try {
            await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { rules: rulesText } });
            setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), rules: rulesText } } : prev);
            modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { rules: rulesText } } });
            showToast({ title: 'Kurallar Güncellendi', type: 'success' });
          } catch { showToast({ title: 'Hata', type: 'error' }); }
        } : undefined}
        canFreezeRoom={amIHost && isTierAtLeast(ownerTier as any, 'Bronze')}
        onFreezeRoom={amIHost && isTierAtLeast(ownerTier as any, 'Bronze') ? () => {
          setAlertConfig({
            visible: true,
            title: '❄️ Odayı Dondur',
            message: 'Oda dondurulacak. Tüm katılımcılar çıkarılacak. Daha sonra "Odalarım" sekmesinden tekrar aktifleştirebilirsin.',
            type: 'warning',
            icon: 'snow-outline',
            buttons: [
              { text: 'İptal', style: 'cancel' },
              {
                text: 'Dondur',
                style: 'destructive',
                onPress: async () => {
                  if (!room || !firebaseUser) return;
                  try {
                    modChannelRef.current?.send({
                      type: 'broadcast',
                      event: 'mod_action',
                      payload: { action: 'room_frozen', hostName: firebaseUser.displayName || 'Oda Sahibi' },
                    });
                    isRoomClosingRef.current = true;
                    await RoomService.freezeRoom(room.id, firebaseUser.uid);
                    liveKitService.disconnect().catch(() => {});
                    setMinimizedRoom(null);
                    showToast({ title: '❄️ Oda Donduruldu', message: 'Odalarım sekmesinden tekrar aktifleştirebilirsin.', type: 'success' });
                    safeGoBack(router);
                  } catch (err: any) {
                    showToast({ title: 'Hata', message: err.message || 'Oda dondurulamadı', type: 'error' });
                  }
                },
              },
            ],
          });
        } : undefined}
        roomLanguage={(room?.room_settings as any)?.room_language || (room as any)?.language || 'tr'}
        onLanguageChange={amIHost && isTierAtLeast(ownerTier as any, 'Silver') ? async (lang) => {
          if (!room || !firebaseUser) return;
          try {
            await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { room_language: lang as any } });
            setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), room_language: lang as any } } : prev);
            modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { room_language: lang } } });
            const names: Record<string,string> = { tr: 'Türkçe', en: 'English', de: 'Deutsch', ar: 'العربية' };
            showToast({ title: `🌐 ${names[lang] || lang}`, type: 'success' });
          } catch { showToast({ title: 'Hata', type: 'error' }); }
        } : undefined}
        ageRestricted={(room?.room_settings as any)?.age_restricted || false}
        onAgeRestrictedChange={amIHost && isTierAtLeast(ownerTier as any, 'Silver') ? async (enabled) => {
          if (!room || !firebaseUser) return;
          try {
            await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { age_restricted: enabled } });
            setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), age_restricted: enabled } } : prev);
            modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { age_restricted: enabled } } });
            showToast({ title: enabled ? '🔞 +18 Aktif' : '👥 Yaş Sınırı Kaldırıldı', type: 'success' });
          } catch { showToast({ title: 'Hata', type: 'error' }); }
        } : undefined}
        coverImage={(room?.room_settings as any)?.cover_image_url || null}
        onChangeCoverImage={amIHost && isTierAtLeast(ownerTier as any, 'Gold') ? async (imageUri) => {
          if (!room || !firebaseUser) return;
          try {
            if (imageUri === 'pick') {
              // Image picker açılacak (arka plan resmi ile aynı akış)
              const ImagePicker = require('expo-image-picker');
              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
              if (result.canceled) return;
              const uri = result.assets[0].uri;
              // ★ StorageService ile yükle — RN uyumlu
              const { StorageService } = require('../../services/storage');
              const fileName = `room_cover/${room.id}_${Date.now()}.jpg`;
              const publicUrl = await StorageService.uploadFile('post-images', fileName, uri);
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { cover_image_url: publicUrl } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), cover_image_url: publicUrl } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { cover_image_url: publicUrl } } });
              showToast({ title: '🖼️ Banner Yüklendi', type: 'success' });
            } else {
              // Kaldır
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { cover_image_url: null } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), cover_image_url: null } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { cover_image_url: null } } });
              showToast({ title: 'Banner Kaldırıldı', type: 'success' });
            }
          } catch { showToast({ title: 'Hata', type: 'error' }); }
        } : undefined}
        musicTrack={(room?.room_settings as any)?.music_track || null}
        onMusicChange={amIHost && isTierAtLeast(ownerTier as any, 'Gold') ? async (track) => {
          if (!room || !firebaseUser) return;
          try {
            await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { music_track: track } });
            setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), music_track: track } } : prev);
            modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { music_track: track } } });
            showToast({ title: track ? `🎵 Müzik: ${track}` : '🔇 Müzik Kapatıldı', type: 'success' });
          } catch { showToast({ title: 'Hata', type: 'error' }); }
        } : undefined}
      />

      <PremiumAlert visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} buttons={alertConfig.buttons} icon={alertConfig.icon} onDismiss={() => setAlertConfig(prev => ({ ...prev, visible: false }))} />

      {dmTarget && (
        <View style={dmSty.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={() => setDmTarget(null)} />
          <View style={dmSty.panel}><View style={dmSty.handle} />
            <View style={dmSty.header}><Ionicons name="chatbubble-ellipses" size={16} color={COLORS.primary} /><Text style={dmSty.headerText} numberOfLines={1}>{dmTarget.nick} — Mesaj Gönder</Text>
              <TouchableOpacity onPress={() => setDmTarget(null)} style={dmSty.closeBtn}><Ionicons name="close" size={14} color="rgba(255,255,255,0.3)" /></TouchableOpacity></View>
            <View style={dmSty.inputRow}><TextInput style={dmSty.input} placeholder="Mesajını yaz..." placeholderTextColor="rgba(255,255,255,0.25)" value={dmText} onChangeText={setDmText} maxLength={500} autoFocus returnKeyType="send" onSubmitEditing={handleSendDm} />
              <TouchableOpacity style={[dmSty.sendBtn, (!dmText.trim() || dmSending) && { opacity: 0.35 }]} disabled={!dmText.trim() || dmSending} onPress={handleSendDm}><Ionicons name="send" size={16} color="#fff" /></TouchableOpacity></View>
          </View>
        </View>
      )}

      <PlusMenu visible={showPlusMenu} onClose={() => setShowPlusMenu(false)}
        onInviteFriends={() => { setShowPlusMenu(false); setShowInviteFriends(true); }}
        onShareLink={() => { setShowPlusMenu(false); handleShareRoom(); }}
        onRoomSettings={() => { setShowPlusMenu(false); setShowSettings(true); }}
        onModeration={() => { setShowPlusMenu(false); setShowAccessPanel(true); }}
        onReportRoom={() => { setShowPlusMenu(false);
          showToast({ title: '🚩 Bildirildi', message: 'Bu oda incelenmek üzere bildirildi', type: 'info' });
        }}
        micRequestCount={micRequests.length}
        userRole={myCurrentRole}
        ownerTier={ownerTier}
        onMuteAll={handleMuteAll}
        onRoomStats={() => { setShowPlusMenu(false); setShowRoomStats(true); }}
        isRoomLocked={(room?.room_settings as any)?.is_locked || false}
        onRoomLock={amIHost && isTierAtLeast(ownerTier as any, 'Silver') ? () => {
          setShowPlusMenu(false);
          const newLocked = !(room?.room_settings as any)?.is_locked;
          (async () => {
            if (!room) return;
            try {
              await RoomService.setRoomLock(room.id, newLocked);
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), is_locked: newLocked } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { is_locked: newLocked } } });
              showToast({ title: newLocked ? '🔒 Oda Kilitlendi' : '🔓 Kilit Açıldı', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          })();
        } : undefined}
      />

      {(amIHost || canModerate) && room && (
        <HostAccessPanel
          visible={showAccessPanel}
          onClose={() => setShowAccessPanel(false)}
          roomId={room.id}
          roomType={room.type || 'open'}
          hostId={firebaseUser?.uid || ''}
        />
      )}

      {/* El Kaldırma Kuyruk Paneli */}
      {(amIHost || canModerate) && room && (
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
        />
      )}

      {/* ★ Arkadaş Davet Modalı — tüm kullanıcılar kullanabilir */}
      {firebaseUser && (
        <InviteFriendsModal
          visible={showInviteFriends}
          userId={firebaseUser.uid}
          onClose={() => setShowInviteFriends(false)}
          onInvite={async (selectedUsers) => {
            // ★ M7 FIX: Kanal sızıntısını önle — her davet sonrası kanalı kapat
            const channels: ReturnType<typeof supabase.channel>[] = [];
            for (const user of selectedUsers) {
              try {
                const ch = supabase.channel(`invite:${user.id}:${Date.now()}`);
                channels.push(ch);
                await ch.subscribe();
                await ch.send({
                  type: 'broadcast', event: 'room_invite',
                  payload: {
                    roomId: id,
                    roomName: room?.name || 'Oda',
                    inviterName: profile?.display_name || 'Birisi',
                    inviterId: firebaseUser.uid,
                  },
                });
              } catch {}
            }
            // Tüm kanalları temizle
            setTimeout(() => {
              channels.forEach(ch => { try { supabase.removeChannel(ch); } catch {} });
            }, 2000);
            showToast({ title: '📨 Davet Gönderildi', message: `${selectedUsers.length} kişiye davet gönderildi`, type: 'success' });
          }}
        />
      )}

      {/* 🔒 Şifre Giriş Modalı — closed (şifreli) odalar için */}
      {showPasswordModal && (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
          <View style={{ width: W * 0.85, backgroundColor: 'rgba(15,23,42,0.98)', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(20,184,166,0.15)' }}>
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(20,184,166,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="lock-closed" size={26} color="#14B8A6" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#F1F5F9', marginBottom: 4 }}>Şifreli Oda</Text>
              <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>Bu odaya girmek için şifre gerekiyor</Text>
            </View>
            {/* Şifre Input */}
            <TextInput
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
                borderColor: passwordError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)',
                borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                fontSize: 16, color: '#F1F5F9', fontWeight: '600', textAlign: 'center',
                letterSpacing: 2,
              }}
              placeholder="Şifreyi girin..."
              placeholderTextColor="#475569"
              value={passwordInput}
              onChangeText={(t) => { setPasswordInput(t); setPasswordError(''); }}
              secureTextEntry
              autoFocus
              maxLength={20}
            />
            {passwordError ? (
              <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 6 }}>{passwordError}</Text>
            ) : null}
            {/* Butonlar */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Pressable
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' }}
                onPress={() => { setShowPasswordModal(false); setPendingRoomData(null); safeGoBack(router); }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#94A3B8' }}>Vazgeç</Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: accessPending ? 'rgba(20,184,166,0.3)' : '#14B8A6', alignItems: 'center' }}
                disabled={accessPending || passwordInput.length < 1}
                onPress={async () => {
                  if (!pendingRoomData || !firebaseUser || !profile) return;
                  setAccessPending(true);
                  try {
                    const result = await RoomAccessService.checkAccess(
                      pendingRoomData.room,
                      firebaseUser.uid,
                      (profile?.subscription_tier || 'Free') as any,
                      null, null,
                      passwordInput.trim(),
                    );
                    if (result.allowed) {
                      setShowPasswordModal(false);
                      // Giriş ücreti kontrolü
                      const fee = (pendingRoomData.room.room_settings as any)?.entry_fee_sp || 0;
                      if (fee > 0) {
                        try {
                          const spResult = await GamificationService.spend(firebaseUser.uid, fee, 'room_entry_fee');
                          if (!spResult.success) {
                            setAlertConfig({ visible: true, title: '💰 Yetersiz SP', message: `${fee} SP gerekiyor.`, type: 'warning', icon: 'wallet-outline', buttons: [{ text: 'Geri Dön', onPress: () => safeGoBack(router) }] });
                            setPendingRoomData(null);
                            return;
                          }
                          showToast({ title: `💰 ${fee} SP Kesildi`, message: `Kalan: ${spResult.remaining ?? '?'} SP`, type: 'info' });
                        } catch {}
                      }
                      // Odaya katıl
                      const isOriginalHost = pendingRoomData.room.room_settings?.original_host_id === firebaseUser.uid;
                      let joinRole: 'owner' | 'listener' | 'spectator' = 'listener';
                      if (isOriginalHost) joinRole = 'owner';
                      RoomService.join(id as string, firebaseUser.uid, joinRole).then(() => {
                        showToast({ title: '🎧 Odaya Katıldın!', message: 'Şifre doğrulandı — hoş geldin!', type: 'success' });
                      }).catch(console.warn);
                      setPendingRoomData(null);
                    } else {
                      setPasswordError(result.reason || 'Yanlış şifre.');
                    }
                  } catch {
                    setPasswordError('Bir hata oluştu.');
                  } finally {
                    setAccessPending(false);
                  }
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFF' }}>{accessPending ? 'Kontrol...' : 'Giriş'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* 📊 VIP: Oda İstatistikleri Paneli */}
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
      />
    </Animated.View>
  );
}
const sty = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1520' },
});



const dmSty = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center', zIndex: 300 },
  panel: { width: W * 0.92, backgroundColor: 'rgba(15,15,28,0.97)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 30 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'center', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  headerText: { color: '#F1F5F9', fontSize: 14, fontWeight: '700', flex: 1 },
  closeBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, fontSize: 13, color: '#F1F5F9' },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(20,184,166,0.2)', alignItems: 'center', justifyContent: 'center' },
});
