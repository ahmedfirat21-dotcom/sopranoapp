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

// SopranoChat Services
import { RoomService, RealtimeService, getRoomLimits, type Room, type RoomParticipant } from '../../services/database';
import { RoomHistoryService } from '../../services/roomHistory';
import { supabase } from '../../constants/supabase';
import { RoomChatService, type RoomMessage } from '../../services/roomChat';
import { checkPermission } from '../../services/permissions';
import { ROLE_LEVEL, type ParticipantRole, type SubscriptionTier } from '../../types';
import { isTierAtLeast } from '../../constants/tiers';

import { ModerationService } from '../../services/moderation';

import { getAvatarSource } from '../../constants/avatars';
import { showToast } from '../../components/Toast';
import { useAuth } from '../_layout';
import useLiveKit from '../../hooks/useLiveKit';
import { useMicMeter } from '../../hooks/useMicMeter';

import { liveKitService } from '../../services/livekit';
import { SYSTEM_ROOMS, isSystemRoom, getSystemRooms } from '../../services/showcaseRooms';
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
import SoundboardPanel from '../../components/room/SoundboardPanel';
import InviteFriendsModal from '../../components/room/InviteFriendsModal';
import RoomInfoHeader from '../../components/room/RoomInfoHeader';
import SpeakerSection from '../../components/room/SpeakerSection';
import ListenerGrid from '../../components/room/ListenerGrid';
import RoomControlBar from '../../components/room/RoomControlBar';
import RoomChatDrawer from '../../components/room/RoomChatDrawer';
import InlineChat from '../../components/room/InlineChat';
import { RoomFollowService } from '../../services/roomFollow';
import { UpsellService } from '../../services/upsell';
import { GamificationService } from '../../services/gamification';


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
  const [dmTarget, setDmTarget] = useState<{ userId: string; nick: string } | null>(null);
  const [dmText, setDmText] = useState('');
  const [dmSending, setDmSending] = useState(false);
  const [isFollowingRoom, setIsFollowingRoom] = useState(false);
  const [showSoundboard, setShowSoundboard] = useState(false);

  // ★ ODA KAPANMA GERİ SAYIMI — Host+Mod yoksa 60sn sonra kapanır
  const [closingCountdown, setClosingCountdown] = useState<number | null>(null);
  const closingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRoomClosingRef = useRef(false);

  // ★ Emoji Broadcast — Supabase Realtime ile tüm odaya gönder
  const emojiBroadcastRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`emoji:${id}`);
    ch.on('broadcast', { event: 'emoji' }, (payload: any) => {
      if (payload?.payload?.emoji) {
        floatingRef.current?.spawn(payload.payload.emoji);
      }
    }).subscribe();
    emojiBroadcastRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id]);

  // ★ MİKROFON İSTEĞİ BROADCAST — Supabase Realtime ile host/mod'a bildir
  const micReqChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!id || !firebaseUser) return;
    const ch = supabase.channel(`mic_req:${id}`);
    ch.on('broadcast', { event: 'mic_request' }, (payload: any) => {
      const data = payload?.payload;
      if (!data) return;
      if (data.type === 'request') {
        setMicRequests(prev => {
          if (prev.includes(data.userId)) return prev;
          return [...prev, data.userId];
        });
        const reqMsg = {
          id: `mic_req_${data.userId}_${Date.now()}`,
          room_id: id as string,
          user_id: data.userId,
          content: '🤚 Mikrofon isteği gönderdi',
          created_at: new Date().toISOString(),
          profiles: { display_name: data.displayName || 'Kullanıcı' },
          isSystem: true,
        } as any;
        setChatMessages(prev => [reqMsg, ...prev].slice(0, 100));
      } else if (data.type === 'cancel') {
        setMicRequests(prev => prev.filter(u => u !== data.userId));
      } else if (data.type === 'approved' && data.userId === firebaseUser.uid) {
        // ★ FEAT-1: Söz hakkı onaylandı — otomatik sahneye al + mikrofon aç
        setMyMicRequested(false);
        showToast({ title: '🤚 Onaylandı!', message: 'Sahneye alındınız! Mikrofon otomatik açılıyor...', type: 'success' });
        // ★ BUG FIX: Optimistik state güncelleme — listener → speaker (UI anında sahneye taşır)
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'speaker' as const, is_muted: false } : p));
        // Mikrofonu otomatik aç (bağlantı varsa)
        setTimeout(() => {
          lk.enableMic?.().catch(() => {});
        }, 500);
      } else if (data.type === 'rejected' && data.userId === firebaseUser.uid) {
        setMyMicRequested(false);
        showToast({ title: 'Reddedildi', message: 'Mikrofon isteğiniz reddedildi.', type: 'warning' });
      }
    }).subscribe();
    micReqChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [id, firebaseUser]);

  // ★ BUG-8 FIX: Emoji rate-limit (throttle — max 3/sn)
  const lastEmojiTimeRef = useRef(0);
  const sendEmojiReaction = useCallback((emoji: string) => {
    const now = Date.now();
    if (now - lastEmojiTimeRef.current < 333) return; // 3/sn limit
    lastEmojiTimeRef.current = now;
    floatingRef.current?.spawn(emoji);
    emojiBroadcastRef.current?.send({
      type: 'broadcast',
      event: 'emoji',
      payload: { emoji },
    });
  }, []);

  // ★ MODERASYON BROADCAST — Kick/Mute/Demote anlık bildirim
  const modChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!id || !firebaseUser) return;
    const ch = supabase.channel(`mod_action:${id}`);
    ch.on('broadcast', { event: 'mod_action' }, (payload: any) => {
      const data = payload?.payload;
      if (!data) return;

      // ★ Oda geneli eventlar — targetUserId filtresi UYGULANMAZ
      if (data.action === 'room_closing_countdown') {
        const seconds = data.seconds || 60;
        setClosingCountdown(seconds);
        showToast({ title: '⏳ Oda Kapanıyor', message: `Oda sahibi ve moderatör ayrıldı. Oda ${seconds} saniye içinde kapanacak.`, type: 'warning' });
        return;
      } else if (data.action === 'original_host_returned') {
        setClosingCountdown(null);
        showToast({ title: '👑 Oda Sahibi Döndü!', message: `${data.hostName || 'Oda sahibi'} geri döndü. Oda yönetimi devredildi.`, type: 'success' });
        RoomService.get(id as string).then(setRoom).catch(() => {});
        return;
      } else if (data.action === 'host_claimed') {
        setClosingCountdown(null);
        showToast({ title: '👑 Yeni Host!', message: `${data.hostName || 'Birisi'} odanın host'u oldu. Geri sayım iptal edildi.`, type: 'success' });
        RoomService.get(id as string).then(setRoom).catch(() => {});
        return;
      }

      // ★ Kullanıcı hedefli eventlar — sadece hedef kullanıcıya iletilir
      if (data.targetUserId !== firebaseUser.uid) return;

      if (data.action === 'kick') {
        showToast({ title: '⛔ Odadan Çıkarıldın', message: data.reason || 'Moderatör seni odadan çıkardı.', type: 'error' });
        setTimeout(() => {
          liveKitService.disconnect().catch(() => {});
          router.back();
        }, 1500);
      } else if (data.action === 'mute') {
        showToast({ title: '🔇 Susturuldun', message: data.reason || 'Moderatör seni susturdu.', type: 'warning' });
        if (lk.isMicrophoneEnabled) {
          lk.toggleMic().catch(() => {});
        }
      } else if (data.action === 'demote') {
        showToast({ title: '⬇️ Sahneden İndirildin', message: 'Moderatör seni dinleyiciye düşürdü.', type: 'info' });
        // ★ BUG FIX: Optimistik state güncelleme — speaker → listener (UI anında dinleyici grid'ine taşır)
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'listener' as const } : p));
        if (lk.isMicrophoneEnabled) {
          lk.toggleMic().catch(() => {});
        }
      } else if (data.action === 'promote') {
        showToast({ title: '🎤 Sahneye Alındın!', message: 'Artık konuşabilirsin! Mikrofon otomatik açılıyor...', type: 'success' });
        // ★ BUG FIX: Optimistik state güncelleme — listener → speaker (UI anında sahneye taşır)
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'speaker' as const, is_muted: false } : p));
        setTimeout(() => {
          lk.enableMic?.().catch(() => {});
        }, 500);
      } else if (data.action === 'make_moderator') {
        showToast({ title: '🛡️ Moderatör Yapıldın!', message: 'Artık odayı yönetebilirsin.', type: 'success' });
      } else if (data.action === 'remove_moderator') {
        showToast({ title: '🛡️ Moderatörlük Kaldırıldı', message: 'Moderatörlük yetkin kaldırıldı.', type: 'info' });
      } else if (data.action === 'chat_mute') {
        showToast({ title: '💬 Metin Susturuldu', message: 'Moderatör metin sohbetini kapattı.', type: 'warning' });
      } else if (data.action === 'chat_unmute') {
        showToast({ title: '💬 Metin Açıldı', message: 'Artık mesaj yazabilirsin.', type: 'success' });
      } else if (data.action === 'host_transferred') {
        showToast({ title: '👑 Vekil Host Oldun!', message: `${data.oldHostName || 'Oda sahibi'} odayı sana devretti. Oda sahibi geri dönene kadar odayı yönetiyorsun!`, type: 'success' });
      }
    }).subscribe();
    modChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [id, firebaseUser]);
  // Mikrofon modu değiştiğinde LiveKit'i de güncelle
  const handleMicModeChange = (mode: MicMode) => {
    setMicMode(mode);
    if (mode === 'music') setNoiseCancellation(false);
    lk.setMicMode?.(mode);
    showToast({ 
      title: mode === 'music' ? 'Müzik Modu' : 'Konuşma Modu', 
      message: mode === 'music' ? 'Stereo ses, gürültü engelleme kapalı' : 'Mono ses, gürültü engelleme açık',
      type: 'success' 
    });
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
  





  const scrollViewRef = useRef<ScrollView>(null);
  const chatInputRef = useRef<TextInput>(null);
  const participantsRef = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
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
    Promise.all([roomPromise, partPromise]).then(([roomData, p]) => {
      if (!roomData) { setLoading(false); return; }
      setRoom(roomData); setParticipants(p); participantsRef.current = new Set(p.map(x => x.user_id)); setLoading(false);
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
          showToast({ title: '🎵 Sistem Odasına Hoş Geldin!', message: 'Kendi odanı açmak için + butonunu kullan.', type: 'success' });
          return;
        }
        // \u2605 ODA G\u0130R\u0130\u015e KONTROL\u00dc
        if (!isHost && !isAdmin) {
          // ★ Ban kontrolü — kick edilen kullanıcı tekrar giremez
          supabase.from('room_bans').select('id').eq('room_id', id).eq('user_id', firebaseUser.uid).maybeSingle().then(({ data: banData }) => {
            if (banData) {
              setAlertConfig({
                visible: true, title: '⛔ Erişim Engellendi', message: 'Bu odadan çıkarıldın. Tekrar katılamazsın.',
                type: 'error', icon: 'ban',
                buttons: [{ text: 'Geri Dön', onPress: () => router.back() }],
              });
            }
          }, () => {}); // Tablo yoksa sessiz geç

          // Kapasite kontrolü — listener grid doluysa spectator olarak gir
          const hostTier = roomData.owner_tier || roomData.host?.subscription_tier || 'Free';
          const tierLimits = getRoomLimits(hostTier);
          const maxListeners = tierLimits.maxListeners;
          const currentListeners = p.filter(x => x.role === 'listener').length;
          const maxSpectators = (tierLimits as any).maxSpectators || 999;
          const currentSpectators = p.filter(x => x.role === 'spectator').length;
          // Listener grid dolu VE spectator kapasitesi de doluysa giriş engelle
          if (currentListeners >= maxListeners && currentSpectators >= maxSpectators) {
            setAlertConfig({
              visible: true, title: '🚫 Oda Dolu', message: `Bu odanın tüm kapasitesi dolu (${maxListeners} dinleyici + ${maxSpectators} seyirci).`,
              type: 'warning', icon: 'people',
              buttons: [{ text: 'Geri Dön', onPress: () => router.back() }],
            });
            return;
          }

          if (roomData.type === 'invite') {
            setAlertConfig({
              visible: true,
              title: '🔑 Davetli Oda',
              message: 'Bu odaya yalnızca davet edilenler katılabilir.',
              type: 'warning',
              icon: 'mail',
              buttons: [{ text: 'Geri Dön', onPress: () => router.back() }],
            });
            return;
          }
          if (roomData.type === 'closed') {
            setAlertConfig({
              visible: true,
              title: '🔒 Kapalı Oda',
              message: 'Bu oda kapalı. Oda sahibinin onayı gerekiyor. Giriş isteği gönderilsin mi?',
              type: 'info',
              icon: 'lock-closed',
              buttons: [
                { text: 'Vazgeç', style: 'cancel', onPress: () => router.back() },
                {
                  text: 'İstek Gönder',
                  onPress: async () => {
                    await supabase.channel(`room_join_req:${id}`).send({
                      type: 'broadcast',
                      event: 'join_request',
                      payload: {
                        userId: firebaseUser.uid,
                        displayName: profile.display_name,
                        avatarUrl: profile.avatar_url,
                      },
                    });
                    showToast({ title: 'İstek Gönderildi', message: 'Oda sahibinin onayı bekleniyor...', type: 'success' });
                  },
                },
              ],
            });
            return;
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
            const ch = supabase.channel(`room_mod:${id}`);
            ch.send({
              type: 'broadcast', event: 'mod_action',
              payload: { action: 'original_host_returned', hostName: profile.display_name || 'Oda sahibi' },
            });
            showToast({ title: '👑 Hoş Geldin!', message: 'Oda sahibi olarak geri döndün. Host yetkilerin aktif.', type: 'success' });
          } else if (joinRole === 'spectator') {
            showToast({ title: '👁️ Seyirci Olarak Katıldın', message: 'Dinleyici alanı dolu. Seyirci olarak izliyorsun.', type: 'info' });
          } else if (joinRole === 'listener') {
            showToast({ title: '🎧 Odaya Katıldın!', message: '+10 SP kazandın', type: 'success' });
            // Sahne boşsa toast göster
            const stageUsers = p.filter(x => x.role === 'owner' || x.role === 'speaker');
            if (stageUsers.length === 0) {
              setTimeout(() => {
                showToast({ title: '🎤 Sahne Boş!', message: 'Sahne seni bekliyor — el kaldırarak sahneye çıkabilirsin!', type: 'info' });
              }, 2000);
            }
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
          if (settings.rules) {
            const rulesMsg: RoomMessage = {
              id: `rules_${Date.now()}`,
              room_id: id as string,
              user_id: 'system',
              content: `📋 Kurallar: ${settings.rules}`,
              created_at: new Date().toISOString(),
              profiles: { display_name: '📢 Oda' },
              isSystem: true,
            } as any;
            setChatMessages(prev => [rulesMsg, ...prev]);
          }
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
      const prevCount = participants.length;
      setParticipants(newParticipants);

      // ★ CCU Milestone SP — Oda sahibi milestone'a ulaştığında SP kazanır
      if (room?.host_id === firebaseUser?.uid && newParticipants.length !== prevCount) {
        GamificationService.onCCUMilestone(firebaseUser!.uid, newParticipants.length, prevCount)
          .then(sp => {
            if (sp > 0) showToast({ title: '🏆 Milestone!', message: `Odanda ${newParticipants.length} kişi! +${sp} SP kazandın.`, type: 'success' });
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
        // is_live true → false geçişi: Oda gerçekten kapatıldı
        setAlertConfig({
          visible: true, title: 'Oda Kapatıldı', message: 'Bu oda oda sahibi tarafından kapatıldı.', type: 'info', icon: 'close-circle',
          buttons: [{ text: 'Tamam', onPress: () => router.back() }]
        });
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
      // BUG-7 FIX: roomHostRef kullan (stale closure önleme)
      const isHost = roomHostRef.current === firebaseUser?.uid;
      if (isHost) {
        RoomService.close(id as string).catch(e => e);
      } else {
        RoomService.leave(id as string, firebaseUser!.uid).catch(e => e);
      }
      // BUG-17 FIX: LiveKit bağlantısını da kes
      liveKitService.disconnect().catch(() => {});
    };
  }, [id, firebaseUser]); // BUG-7: room?.host_id kaldırıldı — ref ile takip

  // ★ ZOMBİ ÖNLEME — AppState ile arka plan tespiti
  useEffect(() => {
    if (!id || !firebaseUser) return;
    const bgTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // 60 saniye arka planda kalırsa odadan çıkar
        bgTimerRef.current = setTimeout(() => {
          RoomService.leave(id as string, firebaseUser.uid).catch(() => {});
        }, 60000);
      } else if (nextState === 'active') {
        // Ön plana döndüyse timeout'u iptal et
        if (bgTimerRef.current) {
          clearTimeout(bgTimerRef.current);
          bgTimerRef.current = null;
        }
      }
    });
    return () => {
      subscription.remove();
      if (bgTimerRef.current) clearTimeout(bgTimerRef.current);
    };
  }, [id, firebaseUser]);

  // ★ HEARTBEAT + ZOMBİ TEMİZLİĞİ — 60sn'de bir heartbeat + 90sn'de bir zombie temizle
  useEffect(() => {
    if (!id || !firebaseUser) return;
    // Hemen ilk heartbeat + temizlik
    RoomService.heartbeat(id as string, firebaseUser.uid).catch(() => {});
    RoomService.cleanupZombies(id as string).catch(() => {});

    const heartbeatInterval = setInterval(() => {
      RoomService.heartbeat(id as string, firebaseUser.uid).catch(() => {});
    }, 60000);

    const cleanupInterval = setInterval(() => {
      RoomService.cleanupZombies(id as string).catch(() => {});
    }, 90000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(cleanupInterval);
    };
  }, [id, firebaseUser]);

  // ★ Host tier'ına göre ses/video kalite ayarları
  const hostTierForQuality = (room?.host?.subscription_tier as any) || 'Free';
  const qualityLimits = getRoomLimits(hostTierForQuality);

  // 2 LiveKit Engine
  const lk = useLiveKit({
    roomId: id,
    enabled: !loading && !!room,
    userId: firebaseUser?.uid,
    displayName: profile?.display_name,
    qualityPreset: {
      audioSampleRate: qualityLimits.audioSampleRate,
      audioChannels: qualityLimits.audioChannels,
      videoMaxRes: qualityLimits.videoMaxRes,
    },
  });


  // BUG-3 FIX: Bağlantı hatası kullanıcıya bildir
  useEffect(() => {
    if (lk.connectFailed && !loading) {
      showToast({ title: 'Ses Bağlantısı Başarısız', message: 'Ses sunucusuna bağlanılamadı. Mikrofon kullanılamaz.', type: 'warning' });
    }
  }, [lk.connectFailed, loading]);

  // BUG-7 FIX: room.host_id için ref (stale closure önleme)
  const roomHostRef = useRef<string | null>(null);
  useEffect(() => {
    roomHostRef.current = room?.host_id || null;
  }, [room?.host_id]);

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
    // ★ Chat mute kontrolü — susturulan kullanıcı mesaj gönderemez
    const myParticipant = participants.find(p => p.user_id === firebaseUser.uid);
    if (myParticipant?.is_chat_muted) {
      showToast({ title: '💬 Susturuldun', message: 'Metin sohbetiniz moderatör tarafından kapatıldı.', type: 'warning' });
      return;
    }
    try {
      await RoomChatService.send(id as string, firebaseUser.uid, chatInput.trim());
      setChatInput('');
      setTimeout(() => chatInputRef.current?.focus(), 100);
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
      showToast({ title: '🤚 Sahne Talebi Gönderildi', message: 'Sahneye çıkma isteğiniz oda sahibine iletildi', type: 'success' });
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

  // ========== HOST/GODMASTER: ODAYI KAPAT ==========
  const handleCloseRoom = () => {
    if (!amIHost && !profile?.is_admin) return;
    // ★ Vekil host odayı kapatamaz — sadece asıl sahip veya admin kapatabilir
    if (amIActingHost && !profile?.is_admin) {
      showToast({ title: 'Yetki Yok', message: 'Vekil host olarak odayı kapatamazsın. Sadece oda sahibi kapatabilir.', type: 'warning' });
      return;
    }
    setAlertConfig({
      visible: true, title: 'Odayı Kapat', message: 'Bu oda tamamen kapatılacak ve tüm kullanıcılar çıkarılacak. Devam etmek istiyor musun?', type: 'error', icon: 'power',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Odayı Kapat', style: 'destructive', onPress: async () => {
          try {
            await RoomService.close(id as string);
            showToast({ title: 'Oda Kapatıldı', message: 'Oda başarıyla kapatıldı', type: 'success' });
            setMinimizedRoom(null);
            router.back();
          } catch (e) {
            showToast({ title: 'Hata', message: 'Oda kapatılamadı', type: 'error' });
          }
        }}
      ]
    });
  };

  // ========== HOST ÇIKIŞ → YETKİ ZİNCİRİ (Mod → Speaker → Uyku/Kapanış) ==========
  const handleHostLeave = async () => {
    if (!firebaseUser || !id) return;
    // Sistem odasında DB ayrılma yok
    if (isSystemRoom(id as string)) {
      liveKitService.disconnect().catch(() => {});
      setMinimizedRoom(null);
      router.back();
      return;
    }
    try {
      // Yetki zinciri ile devret
      const result = await RoomService.transferHost(id as string, firebaseUser.uid);
      if (result.newHostId) {
        // ★ Yeni host'a broadcast bildir
        modChannelRef.current?.send({
          type: 'broadcast', event: 'mod_action',
          payload: { action: 'host_transferred', targetUserId: result.newHostId, oldHostName: profile?.display_name || 'Oda sahibi' },
        });
        showToast({ title: 'Oda Devredildi', message: 'Oda yetki zincirine göre devredildi', type: 'success' });
      } else if (result.sleepMode) {
        // Persistent oda (Gold/VIP): Uyku moduna geçti
        showToast({ title: '💤 Oda Uykuda', message: 'Odan uyku moduna alındı. Odalarım\'dan tekrar açabilirsin.', type: 'info' });
      } else {
        // ★ Free veya Bronze — devralacak kimse yok, oda kapanıyor
        const _leavePolicy = getRoomLimits(ownerTier as any).ownerLeavePolicy;
        if (_leavePolicy === 'close') {
          // Free: Oda anında kapanır — geri sayım yok
          await RoomService.close(id as string);
          showToast({ title: '🔑 Oda Kapandı', message: 'Oda sahibi çıktığı için oda kapatıldı.', type: 'info' });
        } else {
          // Bronze (countdown_60s): 60sn geri sayım başlat
          modChannelRef.current?.send({
            type: 'broadcast', event: 'mod_action',
            payload: { action: 'room_closing_countdown', seconds: 60 },
          });
        }
      }
      liveKitService.disconnect().catch(() => {});
      setMinimizedRoom(null);
      router.back();
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
      router.back();
      return;
    }
    try {
      const myRole = participants.find(p => p.user_id === firebaseUser.uid)?.role;
      const isMod = myRole === 'moderator';
      
      // Moderatör çıkıyorsa: başka moderatör veya host var mı kontrol et
      if (isMod) {
        const hasHost = participants.some(p => p.role === 'owner' && p.user_id !== firebaseUser.uid);
        const otherMods = participants.filter(p => p.role === 'moderator' && p.user_id !== firebaseUser.uid);
        
        if (!hasHost && otherMods.length === 0) {
          // Son yetki sahibi çıkıyor — geri sayım başlat
          modChannelRef.current?.send({
            type: 'broadcast', event: 'mod_action',
            payload: { action: 'room_closing_countdown', seconds: 60 },
          });
        }
      }
      
      await RoomService.leave(id as string, firebaseUser.uid);
      liveKitService.disconnect().catch(() => {});
      setMinimizedRoom(null);
      router.back();
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
      isRoomClosingRef.current = true;
      RoomService.close(id as string).catch(() => {});
      liveKitService.disconnect().catch(() => {});
      showToast({ title: '🔑 Oda Kapandı', message: 'Oda sahibi ve moderatör olmadığı için oda kapatıldı.', type: 'error' });
      setMinimizedRoom(null);
      router.back();
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
      // Room verisini yenile
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

  // ========== HOST/MOD: KULLANICIYI ODADAN ÇIKAR (Ban yok — tekrar katılabilir) ==========
  const handleKickUser = (userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: 'Kullanıcıyı Çıkar', message: `${displayName} odadan çıkarılacak. Tekrar katılabilir. Devam?`, type: 'warning', icon: 'exit-outline',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Çıkar', style: 'destructive', onPress: async () => {
          try {
            // ★ Broadcast ile hedef kullanıcıya anlık bildirim
            modChannelRef.current?.send({
              type: 'broadcast', event: 'mod_action',
              payload: { action: 'kick', targetUserId: userId, reason: `${displayName} odadan çıkarıldı.` },
            });
            await RoomService.leave(id as string, userId);
            // ★ BUG-4 FIX: Kick artık ban kaydı OLUŞTURMUYOR — kullanıcı tekrar katılabilir
            setSelectedUser(null);
            showToast({ title: 'Çıkarıldı', message: `${displayName} odadan çıkarıldı`, type: 'success' });
            // Sistem mesajı
            const sysMsg = {
              id: `sys_kick_${userId}_${Date.now()}`,
              room_id: id as string,
              user_id: userId,
              content: '⛔ odadan çıkarıldı',
              created_at: new Date().toISOString(),
              profiles: { display_name: displayName },
              isSystem: true,
            } as any;
            setChatMessages(prev => [sysMsg, ...prev].slice(0, 100));
          } catch (e) {
            showToast({ title: 'Hata', message: 'Kullanıcı çıkarılamadı', type: 'error' });
          }
        }}
      ]
    });
  };

  // ========== OWNER SÜPER GÜÇLERİ ==========

  // 👻 Ghost Mode — Kendi görünmezliğini aç/kapat
  const handleGhostToggle = async () => {
    if (!firebaseUser?.uid) return;
    const myPart = participants.find(p => p.user_id === firebaseUser.uid);
    const isCurrentlyGhost = (myPart as any)?.is_ghost || false;
    try {
      await RoomService.setGhostMode(id as string, firebaseUser.uid, !isCurrentlyGhost);
      setSelectedUser(null);
      showToast({
        title: !isCurrentlyGhost ? '👻 Görünmez Oldun' : '👁️ Görünür Oldun',
        message: !isCurrentlyGhost ? 'Diğer kullanıcılar seni göremez' : 'Artık herkes seni görebilir',
        type: 'info',
      });
    } catch { showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' }); }
  };

  // 🎭 Kılık Değiştirme
  const handleDisguiseUser = (userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: '🎭 Kılık Değiştir', message: `${displayName} adlı kullanıcının görünümü geçici olarak değiştirilecek.`, type: 'info', icon: 'mask-outline' as any,
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Anonim Yap', onPress: async () => {
          try {
            await RoomService.setDisguise(id as string, userId, {
              display_name: 'Anonim Kullanıcı',
              avatar_url: 'https://ui-avatars.com/api/?name=Anonim&background=1E293B&color=64748B',
              applied_by: firebaseUser!.uid,
            });
            modChannelRef.current?.send({
              type: 'broadcast', event: 'mod_action',
              payload: { action: 'disguise', targetUserId: userId },
            });
            setSelectedUser(null);
            showToast({ title: '🎭 Kılık Değiştirildi', message: `${displayName} artık "Anonim Kullanıcı" olarak görünüyor`, type: 'success' });
          } catch { showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' }); }
        }},
        { text: 'Kılığı Kaldır', onPress: async () => {
          try {
            await RoomService.setDisguise(id as string, userId, null);
            modChannelRef.current?.send({
              type: 'broadcast', event: 'mod_action',
              payload: { action: 'undisguise', targetUserId: userId },
            });
            setSelectedUser(null);
            showToast({ title: 'Kılık Kaldırıldı', message: `${displayName} normal görünümüne döndü`, type: 'info' });
          } catch { showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' }); }
        }},
      ]
    });
  };

  // ⛔ Geçici Ban
  const handleTempBan = (userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: '⛔ Geçici Ban', message: `${displayName} geçici olarak yasaklanacak. Süre seçin:`, type: 'warning', icon: 'timer',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: '15 Dakika', onPress: () => executeTempBan(userId, displayName, 15) },
        { text: '1 Saat', onPress: () => executeTempBan(userId, displayName, 60) },
        { text: '24 Saat', style: 'destructive', onPress: () => executeTempBan(userId, displayName, 1440) },
      ]
    });
  };

  const executeTempBan = async (userId: string, displayName: string, mins: number) => {
    try {
      await RoomService.banTemporary(id as string, userId, mins);
      modChannelRef.current?.send({
        type: 'broadcast', event: 'mod_action',
        payload: { action: 'ban', targetUserId: userId, reason: `${mins >= 60 ? Math.floor(mins/60) + ' saat' : mins + ' dakika'} yasaklandın.` },
      });
      setSelectedUser(null);
      showToast({ title: '⛔ Yasaklandı', message: `${displayName} ${mins >= 60 ? Math.floor(mins/60) + ' saat' : mins + ' dakika'} yasaklandı`, type: 'success' });
    } catch { showToast({ title: 'Hata', message: 'Ban uygulanamadı', type: 'error' }); }
  };

  // ⛔ Kalıcı Ban (sadece owner)
  const handlePermBan = (userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: '⛔ Kalıcı Ban', message: `${displayName} bu odaya KALICI olarak yasaklanacak. Bu işlem geri alınamaz!`, type: 'error', icon: 'ban',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Kalıcı Yasakla', style: 'destructive', onPress: async () => {
          try {
            await RoomService.banPermanent(id as string, userId);
            modChannelRef.current?.send({
              type: 'broadcast', event: 'mod_action',
              payload: { action: 'permban', targetUserId: userId, reason: 'Kalıcı olarak yasaklandın.' },
            });
            setSelectedUser(null);
            showToast({ title: '⛔ Kalıcı Yasaklandı', message: `${displayName} bu odaya bir daha giremez`, type: 'success' });
          } catch { showToast({ title: 'Hata', message: 'Ban uygulanamadı', type: 'error' }); }
        }},
      ]
    });
  };

  // ========== HOST/MOD: SAHNEYE AL (Listener → Speaker) ==========
  const handlePromoteToStage = async (userId: string, displayName: string) => {
    // Sahne slot limiti kontrolü
    const ownerTierForLimits = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as any;
      const tierLimits = getRoomLimits(ownerTierForLimits);
      const maxSlots = tierLimits.maxSpeakers;
    const currentStageCount = participants.filter(p => ['owner', 'host', 'speaker', 'moderator'].includes(p.role)).length;
    if (currentStageCount >= maxSlots) {
      showToast({ title: 'Sahne Dolu', message: `Sahnede maksimum ${maxSlots} kişi olabilir`, type: 'warning' });
      UpsellService.onStageCapacityFull(ownerTierForLimits);
      return;
    }
    try {
      await RoomService.promoteSpeaker(id as string, userId);
      // ★ BUG FIX: Optimistik state güncelleme — listener → speaker (UI anında sahneye taşır)
      setParticipants(prev => prev.map(p => p.user_id === userId ? { ...p, role: 'speaker' as const, is_muted: false } : p));
      // ★ Broadcast ile hedef kullanıcıya anlık bildirim
      modChannelRef.current?.send({
        type: 'broadcast', event: 'mod_action',
        payload: { action: 'promote', targetUserId: userId },
      });
      setSelectedUser(null);
      showToast({ title: 'Sahneye Alındı', message: `${displayName} artık konuşabilir`, type: 'success' });
    } catch (e) {
      showToast({ title: 'Hata', message: 'Sahneye alınamadı', type: 'error' });
    }
  };

  // ========== HOST/MOD: METİN SUSTURMA (Chat Mute) ==========
  const handleToggleChatMute = async (userId: string, displayName: string, currentMuted: boolean) => {
    try {
      await RoomService.setChatMute(id as string, userId, !currentMuted);
      // ★ Broadcast ile hedef kullanıcıya anlık bildirim
      modChannelRef.current?.send({
        type: 'broadcast', event: 'mod_action',
        payload: { action: !currentMuted ? 'chat_mute' : 'chat_unmute', targetUserId: userId },
      });
      setSelectedUser(null);
      showToast({
        title: !currentMuted ? 'Metin Susturuldu' : 'Metin Açıldı',
        message: !currentMuted ? `${displayName} artık mesaj yazamaz` : `${displayName} artık mesaj yazabilir`,
        type: 'success'
      });
    } catch (e) {
      showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' });
    }
  };

  // ========== HOST: MODERATÖR YAP/KALDIR ==========
  const handleToggleModerator = async (userId: string, displayName: string, currentRole: string) => {
    const isMod = currentRole === 'moderator';
    
    // ★ BUG-8 FIX: Moderatör limiti odanın owner_tier'ından okunuyor (profile yerine)
    if (!isMod) {
      const currentModCount = participants.filter(p => p.role === 'moderator').length;
      const _ownerTierForMod = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as SubscriptionTier;
      const limits = getRoomLimits(_ownerTierForMod);
      if (currentModCount >= limits.maxModerators) {
        showToast({ 
          title: 'Moderatör Limiti', 
          message: `${_ownerTierForMod} planında en fazla ${limits.maxModerators} moderatör atayabilirsin.`, 
          type: 'warning' 
        });
        return;
      }
    }
    
    setAlertConfig({
      visible: true,
      title: isMod ? 'Moderatörlüğü Kaldır' : 'Moderatör Yap',
      message: isMod ? `${displayName} adlı kullanıcının moderatörlüğünü kaldırmak istiyor musun?` : `${displayName} adlı kullanıcıyı moderatör yapmak istiyor musun?\n\nModeratörler: Sahneye alma, sessize alma, metin susturma, çıkarma yapabilir.`,
      type: 'info', icon: isMod ? 'shield-outline' : 'shield-checkmark',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: isMod ? 'Kaldır' : 'Moderatör Yap', onPress: async () => {
          try {
            if (isMod) {
              await RoomService.removeModerator(id as string, userId);
              modChannelRef.current?.send({
                type: 'broadcast', event: 'mod_action',
                payload: { action: 'remove_moderator', targetUserId: userId },
              });
            } else {
              await RoomService.setModerator(id as string, userId);
              modChannelRef.current?.send({
                type: 'broadcast', event: 'mod_action',
                payload: { action: 'make_moderator', targetUserId: userId },
              });
            }
            setSelectedUser(null);
            showToast({ title: isMod ? 'Moderatörlük Kaldırıldı' : 'Moderatör Yapıldı', message: displayName, type: 'success' });
          } catch (e) {
            showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' });
          }
        }},
      ]
    });
  };

  // ========== ODA SÜRESİ ZAMANLAYICISI ==========
  // ========== KULLANICIYI ŞİKAYET ET ==========
  const handleReportUser = (userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: `${displayName} Şikayet Et`, message: 'Şikayet sebebini seçin:', type: 'warning', icon: 'flag',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Spam', onPress: () => submitReport(userId, 'spam') },
        { text: 'Taciz', onPress: () => submitReport(userId, 'harassment') },
        { text: 'Nefret Söylemi', onPress: () => submitReport(userId, 'hate_speech') },
      ]
    });
  };

  const submitReport = async (userId: string, reason: string) => {
    try {
      await ModerationService.reportUser(firebaseUser!.uid, userId, reason as any);
      setSelectedUser(null);
      showToast({ title: 'Şikayet Gönderildi', message: 'Şikayetiniz incelenecek. Teşekkürler.', type: 'success' });
    } catch (e) {
      showToast({ title: 'Hata', message: 'Şikayet gönderilemedi', type: 'error' });
    }
  };

  // ========== KULLANICIYI ENGELLE ==========
  const handleBlockUser = (userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: 'Kullanıcıyı Engelle', message: `${displayName} adlı kullanıcıyı engellemek istiyor musun? Mesajlarını göremeyeceksin.`, type: 'error', icon: 'ban',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Engelle', style: 'destructive', onPress: async () => {
          try {
            await ModerationService.blockUser(firebaseUser!.uid, userId);
            setSelectedUser(null);
            showToast({ title: 'Engellendi', message: `${displayName} engellendi`, type: 'success' });
          } catch (e) {
            showToast({ title: 'Hata', message: 'Engellenemedi', type: 'error' });
          }
        }}
      ]
    });
  };

  // ========== SÜRELİ SUSTURMA (ModerationService) ==========
  const handleTimedMuteUser = (userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: `${displayName} Sustur`, message: 'Susturma süresini seçin:', type: 'warning', icon: 'volume-mute',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: '5 Dakika', onPress: () => executeMute(userId, displayName, 5) },
        { text: '15 Dakika', onPress: () => executeMute(userId, displayName, 15) },
        { text: 'Süresiz', style: 'destructive', onPress: () => executeMute(userId, displayName, undefined) },
      ]
    });
  };

  const executeMute = async (userId: string, displayName: string, durationMinutes?: number) => {
    try {
      await ModerationService.muteInRoom(id as string, userId, firebaseUser!.uid, undefined, durationMinutes);
      await RoomService.demoteSpeaker(id as string, userId);
      // ★ Broadcast ile hedef kullanıcıya anlık bildirim
      modChannelRef.current?.send({
        type: 'broadcast', event: 'mod_action',
        payload: { action: 'mute', targetUserId: userId, reason: `${durationMinutes ? durationMinutes + ' dakika' : 'Süresiz'} susturuldun.` },
      });
      setSelectedUser(null);
      const durationText = durationMinutes ? `${durationMinutes} dakika` : 'süresiz';
      showToast({ title: 'Susturuldu', message: `${displayName} ${durationText} susturuldu`, type: 'success' });
      // Sistem mesajı
      const sysMsg = {
        id: `sys_mute_${userId}_${Date.now()}`,
        room_id: id as string,
        user_id: userId,
        content: `🔇 ${durationText} susturuldu`,
        created_at: new Date().toISOString(),
        profiles: { display_name: displayName },
        isSystem: true,
      } as any;
      setChatMessages(prev => [sysMsg, ...prev].slice(0, 100));
    } catch (e) {
      showToast({ title: 'Hata', message: 'Susturulamadı', type: 'error' });
    }
  };

  const executeUnmute = async (userId: string, displayName: string) => {
    try {
      await ModerationService.unmuteInRoom(id as string, userId);
      setSelectedUser(null);
      showToast({ title: 'Susturma Kaldırıldı', message: `${displayName} artık konuşabilir`, type: 'success' });
    } catch {
      showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' });
    }
  };

  // ========== ODA SÜRESİ ZAMANLAYICISI ==========
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

      // Kalan süre göstergesi (free odalar için)
      if (room.expires_at) {
        const remaining = new Date(room.expires_at).getTime() - Date.now();
        if (remaining <= 0) {
            // Süre dolunca oda otomatik kapat + upsell
            const _t = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as any;
            UpsellService.onRoomDurationExpired(_t);
          setRoomExpiry('⏰ Süre doldu!');
          // ★ BUG-K FIX: Free/Bronze odalar süre dolunca otomatik kapanmalı
          const isHost = room.host_id === firebaseUser?.uid;
          if (isHost) {
            showToast({ title: '⏰ Süre Doldu', message: 'Oda süresi doldu. Oda kapatılıyor...', type: 'warning' });
            setTimeout(async () => {
              try {
                await RoomService.close(id as string);
                liveKitService.disconnect().catch(() => {});
                setMinimizedRoom(null);
                router.back();
              } catch {}
            }, 3000); // 3sn sonra oto-kapat (kullanıcı mesajı görsün)
          } else {
            showToast({ title: '⏰ Süre Doldu', message: 'Oda süresi doldu. Oda kapanıyor...', type: 'warning' });
            setTimeout(() => {
              liveKitService.disconnect().catch(() => {});
              setMinimizedRoom(null);
              router.back();
            }, 5000);
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
    const timer = setInterval(updateDuration, 30000); // 30 saniyede bir kontrol
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
    return (room as any)?.owner_tier || room?.host?.subscription_tier || 'Free';
  }, [room]);


  // ★ SP Tetikleyiciler: Sahnede olma (10dk interval) + Kamera açık (10dk interval)
  useEffect(() => {
    const isOnStage = myCurrentRole === 'owner' || myCurrentRole === 'moderator' || myCurrentRole === 'speaker';
    if (!isOnStage || !firebaseUser?.uid) return;

    // 10 dakikada bir sahne SP'si
    const stageTimer = setInterval(() => {
      GamificationService.onStageTime(firebaseUser.uid).catch(() => {});
    }, 10 * 60 * 1000);

    // 10 dakikada bir kamera SP'si (kamera açıksa)
    const cameraTimer = setInterval(() => {
      if (lk.isCameraEnabled) {
        GamificationService.onCameraTime(firebaseUser.uid).catch(() => {});
      }
    }, 10 * 60 * 1000);

    return () => {
      clearInterval(stageTimer);
      clearInterval(cameraTimer);
    };
  }, [myCurrentRole, firebaseUser?.uid, lk.isCameraEnabled]);
  // Sistem odası 5dk prompt — "Kendi odanı aç ister misin?"
  useEffect(() => {
    if (!room || !isSystemRoom(id as string)) return;
    const timer = setTimeout(() => {
      const _tier = (profile?.subscription_tier || 'Free') as any;
      UpsellService.onSystemRoomPrompt(_tier);
      showToast({
        title: '🏠 Kendi Odanı Aç!',
        message: 'SopranoChat\'ta kendi kişisel odanı oluştur ve topluluğun lideri ol!',
        type: 'info',
      });
    }, 5 * 60 * 1000); // 5 dakika
    return () => clearTimeout(timer);
  }, [room, id]);

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
    try {
      await RoomService.promoteSpeaker(room.id, firebaseUser.uid);
      // ★ BUG FIX: Optimistik state güncelleme — listener → speaker (UI anında sahneye taşır)
      setParticipants(prev => prev.map(p => p.user_id === firebaseUser!.uid ? { ...p, role: 'speaker' as const, is_muted: false } : p));
      showToast({ title: 'Sahneye Hoş Geldin!', message: 'Mikrofon ve kameranı açabilirsin', type: 'success' });
      setShowSeatTooltip(false);
    } catch {
      showToast({ title: 'Hata', message: 'Sahneye çıkılamadı', type: 'error' });
    }
  }, [room, firebaseUser?.uid]);


  const hostAvatarUri = hostUser?.user?.avatar_url
    ? { uri: hostUser.user.avatar_url }
    : getAvatarSource(room?.host_id?.includes('female') ? 'avatar_f_1.png' : 'avatar_m_2.png');

  // ========== DM GÖNDER ==========
  const handleSendDm = useCallback(async () => {
    if (!dmTarget || !dmText.trim() || dmSending || !firebaseUser) return;
    setDmSending(true);
    try {
      const { MessageService } = require('../../services/database');
      await MessageService.send(firebaseUser.uid, dmTarget.userId, dmText.trim());
      showToast({ title: 'Mesaj Gönderildi', message: `${dmTarget.nick}'e mesaj gönderildi`, type: 'success' });
      setDmTarget(null);
      setDmText('');
    } catch {
      showToast({ title: 'Hata', message: 'Mesaj gönderilemedi', type: 'error' });
    } finally {
      setDmSending(false);
    }
  }, [dmTarget, dmText, dmSending, firebaseUser]);


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

  if (loading) return <View style={sty.root} />;

  return (
    <Animated.View style={[sty.root, { opacity: fadeIn }]}>
      <StatusBar hidden />
      <ImageBackground source={require('../../assets/images/room_in_bg.jpg')} style={StyleSheet.absoluteFillObject} resizeMode="cover">
        <LinearGradient colors={['rgba(12,24,41,0.3)', 'rgba(10,21,32,0.5)', 'rgba(7,16,24,0.7)']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      </ImageBackground>

      <View style={{ paddingTop: Math.max(insets.top, 12) + 4 }}>
        <RoomInfoHeader
          roomName={room?.name || 'Oda'} roomDescription={room?.description} isPremium={(room as any)?.isPremium}
          viewerCount={viewerCount} connectionState={lk.connectionState} roomDuration={roomDuration} roomExpiry={roomExpiry}
          isFollowing={isFollowingRoom} onToggleFollow={!amIHost ? handleToggleFollow : undefined}
          onBack={() => { if (amIHost) { setAlertConfig({ visible: true, title: 'Odadan Ayrıl', message: 'Ayrılmak istiyor musun?', type: 'warning', icon: 'exit-outline', buttons: [{ text: 'İptal', style: 'cancel' }, { text: 'Ayrıl', style: 'destructive', onPress: handleHostLeave }] }); } else { handleUserLeave(); } }}
          onMinimize={() => { isMinimizingRef.current = true; setMinimizedRoom({ id: id as string, name: room?.name || 'Oda', hostName: hostUser?.user?.display_name || 'Host', viewerCount, isMicOn: lk.isMicrophoneEnabled || false }); router.back(); }}
          onMenu={() => setShowHeaderMenu(true)}
        />
      </View>

      {showHeaderMenu && (
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 900 }} onPress={() => setShowHeaderMenu(false)}>
          <View style={{ position: 'absolute', top: Math.max(insets.top, 12) + 48, right: 14, backgroundColor: 'rgba(15,12,30,0.97)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 6, minWidth: 180, elevation: 20 }}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 }} onPress={() => { setShowHeaderMenu(false); handleShareRoom(); }}>
              <Ionicons name="share-outline" size={18} color="rgba(255,255,255,0.7)" /><Text style={{ color: '#E2E8F0', fontSize: 14, fontWeight: '500' }}>Odayı Paylaş</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 }} onPress={() => { setShowHeaderMenu(false); setShowSettings(true); }}>
              <Ionicons name="settings-outline" size={18} color="rgba(255,255,255,0.7)" /><Text style={{ color: '#E2E8F0', fontSize: 14, fontWeight: '500' }}>Oda Ayarları</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      )}

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

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        <SpeakerSection stageUsers={stageUsers} getMicStatus={getMicStatus}
          onSelectUser={(u) => { if (u.user_id === firebaseUser?.uid) handleSelfDemote(); else setSelectedUser(u); }}
          currentUserId={firebaseUser?.uid} VideoView={LKVideoView}
          onGhostSeatPress={handleGhostSeatPress} showSeatTooltip={showSeatTooltip} />
        <ListenerGrid listeners={listenerUsers} onSelectUser={(u) => setSelectedUser(u)} selectedUserId={selectedUser?.user_id} onShowAllUsers={() => setShowAudienceDrawer(true)} maxListeners={getRoomLimits(ownerTier as any).maxListeners} spectatorCount={spectatorUsers.length} roomOwnerId={room?.owner_id} />
        <InlineChat messages={chatMessages as any[]} maxLines={5} />
      </ScrollView>

      {!!entryEffectName && <PremiumEntryBanner name={entryEffectName} onDone={() => setEntryEffectName(null)} />}
      <FloatingReactionsView ref={floatingRef} />
      {showEmojiBar && (<View style={{ position: 'absolute', bottom: Math.max(insets.bottom, 14) + 70, left: 0, right: 0, alignItems: 'center', zIndex: 50 }}><EmojiReactionBar onReaction={(emoji) => sendEmojiReaction(emoji)} /></View>)}

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: Math.max(insets.bottom, 14) + 2 }}>
        <LinearGradient colors={['transparent', 'rgba(5,10,20,0.95)']} locations={[0, 0.4]} style={[StyleSheet.absoluteFill, { top: -20 }]} pointerEvents="none" />
        <RoomControlBar isMicOn={lk.isMicrophoneEnabled || false} isCameraOn={lk.isCameraEnabled || false}
          showCamera={(amIHost || amIModerator || stageUsers.some(u => u.user_id === firebaseUser?.uid)) && getRoomLimits(((room as any)?.owner_tier || 'Free') as any).maxCameras > 0}
          isHandRaised={myMicRequested} handBadgeCount={micRequests.length} canModerate={canModerate}
          isListener={!amIHost && !amIModerator && !stageUsers.some(u => u.user_id === firebaseUser?.uid)}
          isRoomMuted={roomMuted}
          chatBadgeCount={0} isChatOpen={showChatDrawer}
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
            // ★ BUG-A FIX: LiveKit'ten gerçek kamera açık sayısını al (sahnedeki kişi sayısı değil)
            const activeCams = lk.participants.filter((p: any) => p.isCameraEnabled).length + (lk.isCameraEnabled ? 1 : 0);
            if (!lk.isCameraEnabled && activeCams >= _tLimits.maxCameras) {
              UpsellService.onCameraLimit(_ownerTier);
              showToast({ title: 'Kamera Limiti', message: 'Maksimum ' + _tLimits.maxCameras + ' kamera açılabilir.', type: 'warning' });
              return;
            }
            try { lk.toggleCamera?.(); } catch {}
          }} onEmojiPress={() => setShowEmojiBar(!showEmojiBar)}
          onHandPress={handleMicRequest} onChatPress={() => setShowChatDrawer(!showChatDrawer)} onPlusPress={() => setShowPlusMenu(true)} />
      </View>

      <RoomChatDrawer visible={showChatDrawer} messages={chatMessages as any[]} chatInput={chatInput}
        onChangeInput={setChatInput} onSend={handleSendChat} onClose={() => setShowChatDrawer(false)} bottomInset={insets.bottom} />

      <AudienceDrawer visible={showAudienceDrawer} users={[...stageUsers, ...listenerUsers, ...spectatorUsers]}
        onClose={() => setShowAudienceDrawer(false)} onSelectUser={(u) => setSelectedUser(u as any)} />

      {!!selectedUser && (() => {
        // ★ BUG-1/2/3 FIX: Merkezi yetki motoru entegrasyonu
        const _myRole = myCurrentRole as ParticipantRole;
        const _targetRole = selectedUser.role as ParticipantRole;
        const _ownerTierPerm = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as SubscriptionTier;
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
          onFollow={async () => { if (!firebaseUser) return; try { const r = await FriendshipService.follow(firebaseUser.uid, selectedUser.user_id); if (r.success) showToast({ title: 'Takip isteği gönderildi', type: 'success' }); } catch { showToast({ title: 'Hata', type: 'error' }); } }}
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
          onBanTemp={_perm('ban_temporary') && _notSelf ? () => handleTempBan(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onBanPerm={_perm('ban_permanent') && _notSelf ? () => handlePermBan(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
        />
        );
      })()}



      <RoomSettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} micMode={micMode} onMicModeChange={handleMicModeChange}
        noiseCancellation={noiseCancellation} onNoiseCancellationChange={handleNoiseCancellation} cameraFacing={cameraFacing}
        onCameraFacingChange={setCameraFacing} useSpeaker={useSpeaker} onSpeakerChange={handleSpeakerToggle}
        isMicEnabled={lk.isMicrophoneEnabled || false} isCameraEnabled={lk.isCameraEnabled || false}
        canCloseRoom={amIHost || amIGodMaster} onCloseRoom={handleCloseRoom} isHost={amIHost} currentThemeId={room?.theme_id}
        onChangeTheme={amIHost && isTierAtLeast(ownerTier as any, 'Silver') ? async (themeId) => { if (!room || !firebaseUser) return; try { await RoomService.setRoomTheme(room.id, firebaseUser.uid, themeId); setRoom(prev => prev ? { ...prev, theme_id: themeId } : prev); showToast({ title: '🎨 Tema!', type: 'success' }); } catch (err: any) { showToast({ title: 'Hata', message: err.message, type: 'error' }); } } : undefined}
        roomName={room?.name}
        onRenameRoom={amIHost ? async (newName: string) => { if (!room) return; try { await ModerationService.editRoomName(room.id, newName); setRoom(prev => prev ? { ...prev, name: newName } : prev); showToast({ title: 'Isim Guncellendi', type: 'success' }); } catch { showToast({ title: 'Hata', type: 'error' }); } } : undefined}
        isLocked={(room?.room_settings as any)?.is_locked || false}
        onToggleLock={amIHost && isTierAtLeast(ownerTier as any, 'Silver') ? async (locked: boolean) => { if (!room) return; try { await RoomService.setRoomLock(room.id, locked); setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), is_locked: locked } } : prev); showToast({ title: locked ? 'Oda Kilitlendi' : 'Kilit Acildi', type: 'success' }); } catch { showToast({ title: 'Hata', type: 'error' }); } } : undefined}
        followersOnly={(room?.room_settings as any)?.followers_only || false}
        onToggleFollowersOnly={amIHost && isTierAtLeast(ownerTier as any, 'Gold') ? async (enabled: boolean) => { if (!room) return; try { await ModerationService.setFollowersOnly(room.id, enabled); setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), followers_only: enabled } } : prev); showToast({ title: enabled ? 'Takipcilere Ozel' : 'Herkese Acik', type: 'success' }); } catch { showToast({ title: 'Hata', type: 'error' }); } } : undefined}
        slowModeSeconds={(room?.room_settings as any)?.slow_mode_seconds || 0}
        onSlowModeChange={canModerate ? async (seconds: number) => { if (!room) return; try { await ModerationService.setSlowMode(room.id, seconds); setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), slow_mode_seconds: seconds } } : prev); showToast({ title: seconds ? 'Slow Mode Acik' : 'Slow Mode Kapali', type: 'success' }); } catch { showToast({ title: 'Hata', type: 'error' }); } } : undefined}
        ownerTier={ownerTier}
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
        onSoundboard={() => { setShowPlusMenu(false); setShowSoundboard(true); }}
        onModeration={() => { setShowPlusMenu(false); setShowAccessPanel(true); }}
        onRoomLock={() => { setShowPlusMenu(false);
          const locked = (room as any)?.room_settings?.is_locked;
          setAlertConfig({
            visible: true, title: locked ? 'Kilit Aç' : 'Odayı Kilitle',
            message: locked ? 'Oda kilidi açılacak, yeni katılımcılar girebilir.' : 'Yeni katılımcı girişi engellenecek.',
            type: locked ? 'info' : 'warning', icon: locked ? 'lock-open-outline' : 'lock-closed',
            buttons: [{ text: 'İptal', style: 'cancel' }, { text: locked ? 'Kilidi Aç' : 'Kilitle', onPress: async () => {
              try {
                await RoomService.setRoomLock(id as string, !locked);
                showToast({ title: locked ? '🔓 Kilit Açıldı' : '🔒 Kilitlendi', message: locked ? 'Oda tekrar herkese açık' : 'Yeni katılım engellendi', type: 'success' });
              } catch { showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' }); }
            }}],
          });
        }}
        onReportRoom={() => { setShowPlusMenu(false);
          showToast({ title: '🚩 Bildirildi', message: 'Bu oda incelenmek üzere bildirildi', type: 'info' });
        }}
        isRoomLocked={(room as any)?.room_settings?.is_locked}
        micRequestCount={micRequests.length}
        userRole={myCurrentRole} />

      {/* 🎵 Soundboard — Ses Efektleri Paneli */}
      <SoundboardPanel
        visible={showSoundboard}
        onClose={() => setShowSoundboard(false)}
        onPlaySound={(soundId) => {
          // Broadcast ses efekti tüm odaya
          supabase.channel(`soundboard:${id}`).send({
            type: 'broadcast',
            event: 'sound_effect',
            payload: { soundId, playedBy: profile?.display_name || 'Birisi' },
          });
          showToast({ title: '🎵 Ses Efekti', message: `Ses efekti çalındı`, type: 'success' });
        }}
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
            // Seçilen arkadaşlara davet bildirimi gönder
            for (const user of selectedUsers) {
              try {
                await supabase.channel(`invite:${user.id}`).send({
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
            showToast({ title: '💬¨ Davet Gönderildi', message: `${selectedUsers.length} kişiye davet gönderildi`, type: 'success' });
          }}
        />
      )}
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
