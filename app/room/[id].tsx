import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// SopranoChat Services
import { RoomService, RealtimeService, getRoomLimits, type Room, type RoomParticipant } from '../../services/database';
import { supabase } from '../../constants/supabase';
import { RoomChatService, type RoomMessage } from '../../services/roomChat';
import { GiftService } from '../../services/gift';
import { ModerationService } from '../../services/moderation';
import { GiftPanel } from '../../components/GiftPanel';
import { getAvatarSource } from '../../constants/avatars';
import { showToast } from '../../components/Toast';
import { useAuth } from '../_layout';
import useLiveKit from '../../hooks/useLiveKit';
import { useMicMeter } from '../../hooks/useMicMeter';
import MoonBackground3D from '../../components/MoonBackground3D';
import GiftAnimationQueue, { QueuedGift } from '../../components/GiftAnimationQueue';
import { liveKitService } from '../../services/livekit';
import RoomSettingsSheet, { type MicMode, type CameraFacing } from '../../components/RoomSettingsSheet';
import PremiumAlert, { type AlertButton, type AlertType } from '../../components/PremiumAlert';
import { EmojiReactionBar, FloatingReactionsView, type FloatingReactionsRef } from '../../components/EmojiReactions';

// Extracted Room Sub-Components
import { COLORS } from '../../components/room/constants';
import FloatingDust from '../../components/room/FloatingDust';
import TwinklingStars from '../../components/room/TwinklingStars';
import SeatCard from '../../components/room/SeatCard';
import ChatBubble from '../../components/room/ChatBubble';
import VIPEntryBanner from '../../components/room/VIPEntryBanner';
import ProfileCard from '../../components/room/ProfileCard';
import CameraExpandModal from '../../components/room/CameraExpandModal';
import AudienceDrawer from '../../components/room/AudienceDrawer';

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
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [giftQueue, setGiftQueue] = useState<QueuedGift[]>([]);
  const [selectedUser, setSelectedUser] = useState<RoomParticipant | null>(null);
  const [entryEffectName, setEntryEffectName] = useState<string | null>(null);
  // Mic permission system (local)
  const [micRequests, setMicRequests] = useState<string[]>([]); // user_id'ler
  const [showMicRequests, setShowMicRequests] = useState(false);
  const [myMicRequested, setMyMicRequested] = useState(false);
  const [approvedSpeakers, setApprovedSpeakers] = useState<string[]>([]);
  const [roomMuted, setRoomMuted] = useState(false);
  const [localCoins, setLocalCoins] = useState(profile?.coins ?? 0);
  const [cameraExpandUser, setCameraExpandUser] = useState<{nick: string, track: any} | null>(null);
  const [showAudienceDrawer, setShowAudienceDrawer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [micMode, setMicMode] = useState<MicMode>('normal');
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('front');
  const [noiseCancellation, setNoiseCancellation] = useState(true);
  const [useSpeaker, setUseSpeaker] = useState(true);
  const [alertConfig, setAlertConfig] = useState<{ visible: boolean; title: string; message: string; type?: AlertType; buttons?: AlertButton[]; icon?: string }>({ visible: false, title: '', message: '' });
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const floatingRef = useRef<FloatingReactionsRef>(null);

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
          content: '🎤 Mikrofon isteği gönderdi',
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
        showToast({ title: '🎤 Onaylandı!', message: 'Sahneye alındınız! Mikrofon otomatik açılıyor...', type: 'success' });
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
      if (!data || data.targetUserId !== firebaseUser.uid) return;

      if (data.action === 'kick') {
        // Atıldım — odadan çık
        showToast({ title: '⛔ Odadan Çıkarıldın', message: data.reason || 'Moderatör seni odadan çıkardı.', type: 'error' });
        setTimeout(() => {
          liveKitService.disconnect().catch(() => {});
          router.back();
        }, 1500);
      } else if (data.action === 'mute') {
        // Susturuldum — mikrofonu kapat + sahneden indir
        showToast({ title: '🔇 Susturuldun', message: data.reason || 'Moderatör seni susturdu.', type: 'warning' });
        if (lk.isMicrophoneEnabled) {
          lk.toggleMic().catch(() => {});
        }
      } else if (data.action === 'demote') {
        // Sahneden indirildim
        showToast({ title: '⬇️ Sahneden İndirildin', message: 'Moderatör seni dinleyiciye düşürdü.', type: 'info' });
        if (lk.isMicrophoneEnabled) {
          lk.toggleMic().catch(() => {});
        }
      } else if (data.action === 'promote') {
        // Sahneye çıkarıldım — mikrofonu aç
        showToast({ title: '🎤 Sahneye Alındın!', message: 'Artık konuşabilirsin! Mikrofon otomatik açılıyor...', type: 'success' });
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
      } else if (data.action === 'host_transferred' && data.targetUserId === firebaseUser.uid) {
        // Ben yeni host oldum!
        showToast({ title: '👑 Oda Sahibi Oldun!', message: `${data.oldHostName || 'Eski host'} odayı sana devretti. Artık oda sahibisin!`, type: 'success' });
      } else if (data.action === 'room_closing_countdown') {
        // Oda kapanma geri sayımı başladı — tüm kullanıcılara bildirilir
        const seconds = data.seconds || 60;
        setClosingCountdown(seconds);
        showToast({ title: '⏳ Oda Kapanıyor', message: `Oda sahibi ve moderatör ayrıldı. Oda ${seconds} saniye içinde kapanacak.`, type: 'warning' });
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
  
  const displayParticipants = participants;
  const displayMessages = chatMessages;


  // Fog animation
  const fogAnim1 = useRef(new Animated.Value(0)).current;
  const fogAnim2 = useRef(new Animated.Value(0)).current;
  const giftBounce = useRef(new Animated.Value(0)).current;

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

    Promise.all([RoomService.get(id), RoomService.getParticipants(id)]).then(([roomData, p]) => {
      setRoom(roomData); setParticipants(p); participantsRef.current = new Set(p.map(x => x.user_id)); setLoading(false);
      const existing = p.find(x => x.user_id === firebaseUser.uid);
      const isHost = roomData.host_id === firebaseUser.uid;
      const isAdmin = profile?.is_admin;

      if (!existing && profile) {
        // ★ ODA GİRİŞ KONTROLÜ
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

          // ★ Kapasite kontrolü — host tier'ına göre limit
          const hostTier = (roomData.host?.tier as any) || 'Silver';
          const tierLimits = getRoomLimits(hostTier);
          const maxListeners = tierLimits.maxListeners;
          const currentListeners = p.filter(x => x.role === 'listener').length;
          if (currentListeners >= maxListeners) {
            setAlertConfig({
              visible: true, title: '🚫 Oda Dolu', message: `Bu odada maksimum ${maxListeners} dinleyici kapasitesine ulaşıldı.`,
              type: 'warning', icon: 'people',
              buttons: [{ text: 'Geri Dön', onPress: () => router.back() }],
            });
            return;
          }

          if (roomData.type === 'invite') {
            setAlertConfig({
              visible: true,
              title: '🔒 Davetli Oda',
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
              title: '🔐 Kapalı Oda',
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
        const joinRole = isHost ? 'host' : 'listener';
        RoomService.join(id, firebaseUser.uid, joinRole).catch(console.warn);
        if (profile.active_entry_effect) setEntryEffectName(profile.display_name);
      } else if (existing && isHost && existing.role !== 'host') {
        // Host zaten var ama rolü yanlış — düzelt
        RoomService.join(id, firebaseUser.uid, 'host').catch(console.warn);
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
      setParticipants(newParticipants);
    });
    // Mesaj geçmişi: Sadece oda sahibi geçmişi görebilir, yeni girenler sıfırdan başlar
    const isHost = room?.host_id === firebaseUser?.uid;
    if (isHost) {
      RoomChatService.getMessages(id as string, 50).then(setChatMessages);
    }
    // BUG-11 FIX: Mesaj birikimi limitleme (max 100)
    const unsubscribeMsg = RoomChatService.subscribe(id as string, (msg) => setChatMessages(prev => [msg, ...prev].slice(0, 100)));

    // ★ GERÇEK ZAMANLI ODA DURUM TAKİBİ — Supabase Realtime
    const roomStatusSub = RealtimeService.onRoomStatusChange(id as string, (updatedRoom) => {
      if (!updatedRoom.is_live) {
        setAlertConfig({
          visible: true, title: 'Oda Kapatıldı', message: 'Bu oda oda sahibi tarafından kapatıldı.', type: 'info', icon: 'close-circle',
          buttons: [{ text: 'Tamam', onPress: () => router.back() }]
        });
      }
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
  const hostTierForQuality = (room?.host?.tier as any) || 'Silver';
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

  const isMock = lk.connectionState === 'disconnected' && loading === false;

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

  const setGiftAnim = (giftId: string, giftName: string, price: number, targetName?: string) => {
    const tier = price >= 1000 ? 'legendary' : price > 50 ? 'premium' : 'basic';
    setGiftQueue(prev => [...prev, { 
      id: Math.random().toString(), 
      giftId,
      giftName,
      senderName: profile?.display_name || 'Biri',
      targetName: targetName || undefined,
      tier
    } as any]);
  };

  // ★ BUG-9 FIX: Hediye gönderiminde GiftService.sendGift() çağrısı eklendi
  const handleSendGift = async (giftId: string, price: number, quantity: number, targetId: string) => {
    if (!firebaseUser || !targetId) return false;
    
    const totalCost = price * quantity;
    if (localCoins < totalCost) return false;
    
    const GIFT_NAMES: Record<string, string> = {
      rose:'Gül',tea:'Çay',ring:'Yüzük',icecream:'Dondurma',chocolate:'Çikolata',cookie:'Kurabiye',
      lollipop:'Lolipop',balloon:'Balon',kiss:'Öpücük',sunglasses:'Gözlük',soda:'Kola',note:'Nota',
      wand:'Sihir',hourglass:'Kum Saati',letter:'Aşk Mektubu',rainbow:'Gökkuşağı',matcha:'Matcha',
      cocktail:'Kokteyl',daisy:'Papatya',cactus:'Kaktüs',coffee:'Kahve',sword:'Savaş',ghost:'Hayalet',
      pizza:'Pizza',burger:'Burger',heart:'Kalp',cat:'Kedicik',moneybag:'Para Çantası',guitar:'Gitar',
      teddy:'Ayıcık',watch:'Saat',giftbox:'Hediye Kutusu',star:'Yıldız',cake:'Pasta',mic:'Mikrofon',
      popcorn:'Mısır',headphones:'Kulaklık',champagne:'Şampanya',medal:'Madalya',crown:'Taç',
      crystalball:'Kahin',bouquet:'Buket',alien:'Uzaylı',sun:'Güneş',diamond:'Elmas',dart:'Tam İsabet',
      fire:'Ateş',unicorn:'Unicorn',rocket:'Roket',sportscar:'Spor Araba',plane:'Uçak',ship:'Yat',
      castle:'Şato',dragon:'Ejderha',cybercity:'Cyberpunk Şehir',soprano:'Soprano King',lion:'Aslan',
      panther:'Panter',throne:'Taht',planet:'Gezegen'
    };
    const name = GIFT_NAMES[giftId] || 'Hediye';
    const targetUser = participants.find(p => p.user_id === targetId);
    const targetDisplayName = targetUser?.user?.display_name || 'Birine';
    
    try {
      // Her hediye için DB'ye yaz (BUG-9 FIX)
      for (let i = 0; i < Math.min(quantity, 50); i++) {
        const result = await GiftService.sendGift(id as string, firebaseUser.uid, targetId, giftId);
        if (result.success) {
          if (result.remainingCoins !== undefined) setLocalCoins(result.remainingCoins);
          setTimeout(() => setGiftAnim(giftId, name, price, targetDisplayName), i * 350);
        } else {
          showToast({ title: 'Hediye Hatası', message: result.error || 'Gönderilemedi', type: 'error' });
          return false;
        }
      }
      // Push bildirim gönder
      GiftService.notifyGiftReceived(firebaseUser.uid, targetId, giftId, id as string).catch(() => {});
      return true;
    } catch (err: any) {
      showToast({ title: 'Hediye Hatası', message: err.message || 'Bir hata oluştu', type: 'error' });
      return false;
    }
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
      showToast({ title: '🎤 İstek Gönderildi', message: 'Mikrofon isteğiniz oda sahibine iletildi', type: 'success' });
    }
  };

  // Mikrofon AÇ/KAPAT handler — sadece yetkili kişiler (host, mod, admin, speaker)
  const handleMicPress = async () => {
    // ★ LiveKit bağlı değilse dokunma — donmayı önle
    if (lk.connectionState !== 'connected') {
      showToast({ title: 'Bağlantı Yok', message: 'Ses sunucusuna bağlanılamadı. Mikrofon kullanılamaz.', type: 'warning' });
      return;
    }
    // ★ Süreli susturma kontrolü — susturulan kullanıcı mikrofon açamaz
    if (firebaseUser?.uid && !lk.isMicrophoneEnabled) {
      try {
        const isMuted = await ModerationService.isRoomMuted(id as string, firebaseUser.uid);
        if (isMuted) {
          showToast({ title: '🔇 Susturuldun', message: 'Moderatör tarafından susturuldunuz. Süre dolana kadar mikrofon açamazsınız.', type: 'warning' });
          return;
        }
      } catch {}
    }
    const myRole = participants.find(p => p.user_id === firebaseUser?.uid)?.role;
    const isHost = room?.host_id === firebaseUser?.uid;
    if (isHost || myRole === 'moderator' || profile?.is_admin || myRole === 'speaker') {
      const wasMicOff = !lk.isMicrophoneEnabled;
      try {
        await lk.toggleMic();
      } catch (e) {
        console.warn('[Mic] Toggle hatası:', e);
        showToast({ title: 'Mikrofon Hatası', message: 'Mikrofon değiştirilemedi', type: 'error' });
        return;
      }
      if (myRole === 'listener' && wasMicOff && firebaseUser?.uid) {
        try {
          await RoomService.promoteSpeaker(id as string, firebaseUser.uid);
        } catch (e) {
          console.warn('Auto-promote hatası:', e);
        }
      }
    }
  };

  // İstek onaylama — kullanıcıyı DB'de speaker'a yükselt (sahnede görünsün)
  const approveMicRequest = async (uid: string) => {
    // ★ Sahne slot limiti kontrolü
    const maxSlots = room?.max_speakers || 8;
    const currentStageCount = participants.filter(p => ['host', 'speaker', 'moderator'].includes(p.role)).length;
    if (currentStageCount >= maxSlots) {
      showToast({ title: 'Sahne Dolu', message: `Sahnede maksimum ${maxSlots} kişi olabilir`, type: 'warning' });
      return;
    }
    setApprovedSpeakers(prev => [...prev, uid]);
    setMicRequests(prev => prev.filter(u => u !== uid));
    try {
      await RoomService.promoteSpeaker(id as string, uid);
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
      content: '🎤 sahneye çıktı',
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

  // ========== HOST ÇIKIŞ → MODERATÖRE DEVİR ==========
  const handleHostLeave = async () => {
    if (!firebaseUser || !id) return;
    try {
      // Moderatöre devret
      const result = await RoomService.transferHost(id as string, firebaseUser.uid);
      if (result.newHostId) {
        // Yeni host'a broadcast bildir
        modChannelRef.current?.send({
          type: 'broadcast', event: 'mod_action',
          payload: { action: 'host_transferred', targetUserId: result.newHostId, oldHostName: profile?.display_name || 'Oda sahibi' },
        });
        showToast({ title: 'Oda Devredildi', message: 'Oda moderatöre devredildi', type: 'success' });
      } else {
        // Moderatör yok — geri sayım başlat (broadcast ile tüm odaya bildir)
        modChannelRef.current?.send({
          type: 'broadcast', event: 'mod_action',
          payload: { action: 'room_closing_countdown', seconds: 60 },
        });
        // Kendi participant kaydını sil
        await RoomService.leave(id as string, firebaseUser.uid);
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
    try {
      const myRole = participants.find(p => p.user_id === firebaseUser.uid)?.role;
      const isMod = myRole === 'moderator';
      
      // Moderatör çıkıyorsa: başka moderatör veya host var mı kontrol et
      if (isMod) {
        const hasHost = participants.some(p => p.role === 'host' && p.user_id !== firebaseUser.uid);
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
      showToast({ title: '🔒 Oda Kapandı', message: 'Oda sahibi ve moderatör olmadığı için oda kapatıldı.', type: 'error' });
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
              showToast({ title: 'Sahneden İndin', message: 'Artık dinleyicisin', type: 'info' });
            }
          } catch (e) {
            showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' });
          }
        }}
      ]
    });
  };

  // ========== HOST: KULLANICIYI ODADAN ÇIKAR (+ BAN) ==========
  const handleKickUser = (userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: 'Kullanıcıyı Çıkar', message: `${displayName} odadan çıkarılacak ve tekrar giremeyecek. Devam?`, type: 'warning', icon: 'exit-outline',
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
            // ★ Oda kick listesine ekle — tekrar giriş engeli
            try {
              await supabase.from('room_bans').upsert({
                room_id: id as string,
                user_id: userId,
                banned_by: firebaseUser!.uid,
                reason: 'kicked',
              }, { onConflict: 'room_id,user_id' });
            } catch {} // Tablo yoksa sessiz geç
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

  // ========== ODA PAYLAŞMA ==========
  const handleShareRoom = async () => {
    try {
      const { Share } = require('react-native');
      await Share.share({
        title: room?.name || 'SopranoChat Odası',
        message: `🎙️ ${room?.name || 'Oda'} - SopranoChat'te canlı!\n\nhttps://sopranochat.app/room/${id}`,
      });
    } catch (e) { /* kullanıcı iptal etti */ }
  };

  // ========== HOST/MOD: SAHNEYE AL (Listener → Speaker) ==========
  const handlePromoteToStage = async (userId: string, displayName: string) => {
    // Sahne slot limiti kontrolü
    const maxSlots = room?.max_speakers || 8;
    const currentStageCount = participants.filter(p => ['host', 'speaker', 'moderator'].includes(p.role)).length;
    if (currentStageCount >= maxSlots) {
      showToast({ title: 'Sahne Dolu', message: `Sahnede maksimum ${maxSlots} kişi olabilir`, type: 'warning' });
      return;
    }
    try {
      await RoomService.promoteSpeaker(id as string, userId);
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
    
    // Moderatör yapma limiti kontrolü
    if (!isMod) {
      const currentModCount = participants.filter(p => p.role === 'moderator').length;
      const userTier = profile?.tier || 'Silver';
      const limits = getRoomLimits(userTier);
      if (currentModCount >= limits.maxModerators) {
        showToast({ 
          title: 'Moderatör Limiti', 
          message: `${userTier} planında en fazla ${limits.maxModerators} moderatör atayabilirsin.`, 
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
          // ⏰ Süre doldu — otomatik kapatma YAPMA, sadece uyar
          setRoomExpiry('⏰ Süre doldu!');
          showToast({ title: '⏰ Süre Doldu', message: 'Oda süresi doldu. Odayı ayarlardan kapatabilirsiniz.', type: 'warning' });
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
    // Fog + gift bounce animasyonları KALDIRILDI — performans için
    // fogAnim1, fogAnim2, giftBounce statik değerlerde kalacak
  }, []);

  // Rol Dağılımları — useMemo ile cache'le (performans)
  const { stageUsers, audienceUsers, viewerCount, amIHost, amIModerator, amIGodMaster, canModerate, isGodOrHost, hostUser } = useMemo(() => {
    const stage = displayParticipants.filter(p => p.role === 'host' || p.role === 'speaker' || p.role === 'moderator');
    const audience = displayParticipants.filter(p => p.role !== 'host' && p.role !== 'speaker' && p.role !== 'moderator');
    const _amIHost = room?.host_id === firebaseUser?.uid;
    const _amIMod = displayParticipants.some(p => p.user_id === firebaseUser?.uid && p.role === 'moderator');
    const _amIGod = profile?.is_admin === true;
    const _canMod = _amIHost || _amIMod || _amIGod;
    const _isGodOrHost = _amIHost || _amIGod;
    const _hostUser = displayParticipants.find(p => p.role === 'host' || p.user_id === room?.host_id);
    return { stageUsers: stage, audienceUsers: audience, viewerCount: displayParticipants.length, amIHost: _amIHost, amIModerator: _amIMod, amIGodMaster: _amIGod, canModerate: _canMod, isGodOrHost: _isGodOrHost, hostUser: _hostUser };
  }, [displayParticipants, room?.host_id, firebaseUser?.uid, profile?.is_admin]);
  const hostAvatarUri = hostUser?.user?.avatar_url
    ? { uri: hostUser.user.avatar_url }
    : getAvatarSource(room?.host_id?.includes('female') ? 'avatar_f_1.png' : 'avatar_m_2.png');

  if (loading) return <View style={sty.root} />;

  return (
    <Animated.View style={[sty.root, { opacity: fadeIn }]}>
      <StatusBar hidden />
      {/*  GÖKYÜZÜ ZEMİNİ (Akıcı Geçiş - Banding Önleyici)  */}
      <LinearGradient
        colors={['#081222', '#010306']}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Sahnede (Koltuğa oturan) birden fazla kişi varsa Ay şık bir animasyonla eriyip yok olur, RAM tasarrufu sağlar */}
      <MoonBackground3D showMoon={stageUsers.length <= 1} />
      <TwinklingStars />

      {/*  ST BLG UBUU (Header)   */}
      <View style={[sty.header, { paddingTop: Math.max(insets.top, 12) + 2 }]}>
        <View style={sty.headerL}>
          <View style={sty.headerHostAvatar}>
            <Text style={sty.headerHostInitials}>
              {(room?.name || 'L').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={sty.headerRoom} numberOfLines={1}>{room?.name}</Text>
            <Text style={sty.headerStatus}>
              {lk.connectionState === 'connected' ? ' Canlı' : lk.connectionState === 'connecting' ? ' Bağlanıyor' : lk.connectionState === 'reconnecting' ? '🔄 Yeniden Bağlanıyor...' : ' Çevrimdışı'}
              {'  ·  🕐 '}{roomDuration}
              {roomExpiry ? <Text style={{ color: '#F59E0B' }}>{'  ⏳ '}{roomExpiry}</Text> : null}
            </Text>
          </View>
        </View>

        <View style={sty.headerR}>
          {/* Mic request badge - sadece host görür */}
          {amIHost && micRequests.length > 0 && (
            <TouchableOpacity style={[sty.headerIcon, { position: 'relative' }]} onPress={() => setShowMicRequests(!showMicRequests)}>
              <Ionicons name="hand-left" size={18} color="#FFC107" />
              <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#FF1744', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{micRequests.length}</Text>
              </View>
            </TouchableOpacity>
          )}
          <View style={sty.viewerPill}>
            <Ionicons name="people" size={12} color={COLORS.primary} />
            <Text style={sty.viewerCount}>{viewerCount}</Text>
          </View>
          <TouchableOpacity style={sty.headerIcon} onPress={handleShareRoom}>
            <Ionicons name="share-outline" size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
          <TouchableOpacity style={sty.headerIcon} onPress={() => {
            // Odayı küçült — canlı kalır
            isMinimizingRef.current = true;
            setMinimizedRoom({
              id: id as string,
              name: room?.name || 'Oda',
              hostName: hostUser?.user?.display_name || 'Host',
              viewerCount: viewerCount,
              isMicOn: lk.isMicrophoneEnabled || false,
            });
            router.back();
          }}>
            <Ionicons name="remove-outline" size={20} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      </View>

      {/*  SAHNE (Speakers)  */}
      <View style={sty.stage}>
        {stageUsers.length === 0 ? <Text style={{color: 'rgba(255,255,255,0.3)', marginTop: 20}}>Sahnede kimse yok</Text> : null}
        
        {(() => {
          const speakerOnly = stageUsers.filter(u => u.role !== 'host');
          const hostsAndCohost = [
            ...stageUsers.filter(u => u.role === 'host'),
            ...(speakerOnly.length > 0 ? [speakerOnly[0]] : [])
          ];
          const restSpeakers = speakerOnly.slice(1);
          const sc = restSpeakers.length;
          const locaCount = hostsAndCohost.length;

          // Kamera durumunu kontrol et
          const locaCameras = hostsAndCohost.filter(u => {
            const st = getMicStatus(u.user_id);
            return st.cameraOn;
          });
          const anyCameraOn = locaCameras.length > 0;
          const stageW = W - 32;

          // ========== SENARYO BAZLI BOYUTLANDIRMA ==========
          let hostSize: number;
          let camW: number | undefined;
          let camH: number | undefined;
          let locaJustify: 'center' | 'flex-start' | 'space-evenly' = 'center';
          let locaGap = 12;

          if (locaCount === 1 && sc === 0) {
            // SENARYO 1: Odada yalnız host var
            if (anyCameraOn) {
              hostSize = 120;
              camW = stageW * 0.55;
              camH = stageW * 0.75;
            } else {
              hostSize = 110;
            }
          } else if (locaCount === 2 && sc === 0) {
            // SENARYO 2: Locada 2 kişi, altta başka kimse yok
            if (anyCameraOn) {
              hostSize = 100;
              camW = (stageW - locaGap) / 2;
              camH = stageW * 0.55;
            } else {
              hostSize = 90;
            }
          } else {
            // SENARYO 3: Locada kişiler + altta konuşmacılar
            if (anyCameraOn) {
              hostSize = 84;
              camW = locaCount === 1 ? stageW * 0.45 : (stageW - 16) / locaCount;
              camH = stageW * 0.40;
            } else {
              hostSize = 84;
            }
          }

          const speakerSize = sc <= 2 ? 62 : sc <= 5 ? 52 : sc <= 8 ? 44 : 38;
          const stageGap = sc <= 2 ? 20 : sc <= 5 ? 14 : sc <= 8 ? 8 : 4;
          const hostMb = sc > 0 ? (sc <= 2 ? 20 : sc <= 5 ? 14 : 8) : 8;

          return (
            <>
              {/* Ana Loca — Senaryo bazlı ortalı, kamera boyutlarına duyarlı */}
              <View style={{ flexDirection: 'row', justifyContent: locaJustify, alignItems: 'center', marginBottom: hostMb, width: '100%', gap: locaGap, paddingHorizontal: 8 }}>
                {hostsAndCohost.map(u => {
                   const st = getMicStatus(u.user_id);
                   const thisHasCam = st.cameraOn;
                   return (
                    <SeatCard key={u.id} nick={u.user?.display_name || 'Misafir'} role={u.role} speaking={st.speaking} mic={st.mic} size={hostSize} customWidth={thisHasCam ? camW : undefined} customHeight={thisHasCam ? camH : undefined} onPress={() => { if (u.user_id === firebaseUser?.uid && u.role !== 'host') { handleSelfDemote(); return; } const _st = getMicStatus(u.user_id); if (_st.cameraOn && u.role !== 'listener') { setCameraExpandUser({nick: u.user?.display_name || 'Misafir', track: _st.videoTrack}); } else { setSelectedUser(u); } }} avatarUrl={u.user?.avatar_url} micRequesting={micRequests.includes(u.user_id)} audioLevel={st.audioLevel} cameraOn={st.cameraOn} videoTrack={st.videoTrack} isLargeVideo={true} onFlipCamera={u.user_id === firebaseUser?.uid && st.cameraOn ? lk.flipCamera : undefined} isAdmin={u.user?.is_admin || false} />
                  );
                })}
              </View>

              {/* Diğer Konuşmacılar */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: stageGap, width: '100%', paddingHorizontal: 4 }}>
                {restSpeakers.map(u => {
                   const st = getMicStatus(u.user_id);
                   return (
                    <SeatCard key={u.id} nick={u.user?.display_name || 'Misafir'} role={u.role} speaking={st.speaking} mic={st.mic} size={speakerSize} onPress={() => { if (u.user_id === firebaseUser?.uid && u.role !== 'host') { handleSelfDemote(); return; } const _st = getMicStatus(u.user_id); if (_st.cameraOn && u.role !== 'listener') { setCameraExpandUser({nick: u.user?.display_name || 'Misafir', track: _st.videoTrack}); } else { setSelectedUser(u); } }} avatarUrl={u.user?.avatar_url} micRequesting={micRequests.includes(u.user_id)} audioLevel={st.audioLevel} cameraOn={st.cameraOn} videoTrack={st.videoTrack} isLargeVideo={false} onFlipCamera={u.user_id === firebaseUser?.uid && st.cameraOn ? lk.flipCamera : undefined} isAdmin={u.user?.is_admin || false} />
                  );
                })}
              </View>
            </>
          );
        })()}
      </View>

      {/*  DİNLEYİCİLER  */}
      {audienceUsers.length > 0 && (
        <View style={sty.audience}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={sty.audienceLabel}>Dinleyiciler  {audienceUsers.length}</Text>
            {audienceUsers.length > 12 && (
              <TouchableOpacity onPress={() => setShowAudienceDrawer(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(92,225,230,0.08)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: 'rgba(92,225,230,0.2)' }}>
                <Text style={{ color: COLORS.primary, fontSize: 10, fontWeight: '600' }}>+{audienceUsers.length - 12} kişi</Text>
                <Ionicons name="chevron-forward" size={10} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>
          <View style={sty.audienceGrid}>
            {audienceUsers.slice(0, 12).map(u => {
              return (
                <SeatCard
                  key={u.id}
                  nick={u.user?.display_name || 'Misafir'}
                  role={u.role}
                  speaking={false}
                  mic={false}
                  size={36}
                  onPress={() => setSelectedUser(u)}
                  avatarUrl={u.user?.avatar_url}
                  micRequesting={micRequests.includes(u.user_id)}
                  isAdmin={u.user?.is_admin || false}
                />
              );
            })}
          </View>
        </View>
      )}

      <View style={sty.chatArea} pointerEvents="box-none">
        {/*  Ufuk Çizgisi (gradient fade)  */}
        <LinearGradient
          colors={['transparent', 'rgba(92,225,230,0.06)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 1, marginBottom: 6, marginHorizontal: -14 }}
        />
        <FlatList
          ref={scrollViewRef as any}
          data={displayMessages.slice(0, Math.min(8, displayMessages.length))}
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => <ChatBubble key={item.id} message={item} index={index} total={displayMessages.length} />}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 8 }}
          removeClippedSubviews={true}
          initialNumToRender={5}
          maxToRenderPerBatch={3}
          windowSize={3}
        />
      </View>

      {/*  VIP GİRİŞ BANTI  */}
      {!!entryEffectName && (
        <VIPEntryBanner name={entryEffectName} onDone={() => setEntryEffectName(null)} />
      )}

      {/*  MİKROFON İSTEK POPUP (HOST İÇİN)  */}
      {showMicRequests && micRequests.length > 0 && (
        <View style={{
          position: 'absolute', top: 100, right: 12, width: 220,
          backgroundColor: 'rgba(20,15,40,0.95)', borderRadius: 16,
          borderWidth: 1, borderColor: 'rgba(92,225,230,0.3)',
          padding: 12, zIndex: 999,
        }}>
          <Text style={{ color: '#FFC107', fontWeight: 'bold', fontSize: 14, marginBottom: 8 }}>
             Mikrofon İstekleri
          </Text>
          {micRequests.map(uid => {
            const p = participants.find(x => x.user_id === uid);
            return (
              <View key={uid} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(92,225,230,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12 }}></Text>
                </View>
                <Text style={{ color: '#fff', flex: 1, fontSize: 13 }} numberOfLines={1}>
                  {p?.user?.display_name || 'Kullanıcı'}
                </Text>
                <TouchableOpacity onPress={() => approveMicRequest(uid)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(76,175,80,0.3)', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="checkmark" size={16} color="#4CAF50" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => rejectMicRequest(uid)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(244,67,54,0.3)', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="close" size={16} color="#F44336" />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}


      {/* Floating Emoji Reactions */}
      <FloatingReactionsView ref={floatingRef} />

      {/*  PREMIUM DOCK  */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[sty.dock, { paddingBottom: Math.max(insets.bottom, 6) }]}>
            <LinearGradient
              colors={['transparent', '#050a14']}
              locations={[0, 1]}
              style={[StyleSheet.absoluteFill, { top: -10 }]}
            />

            {/* Emoji Reaction Bar */}
            {showEmojiBar && (
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <EmojiReactionBar onReaction={(emoji) => { sendEmojiReaction(emoji); }} />
              </View>
            )}

            {/*  Input strip  */}
            <View style={sty.inputStrip}>
              <TouchableOpacity activeOpacity={0.7} style={sty.dockEmoji}>
                <Text style={{ fontSize: 13 }}></Text>
              </TouchableOpacity>
              <TextInput
                ref={chatInputRef}
                style={sty.dockInput}
                placeholder="Mesaj yaz..."
                placeholderTextColor="rgba(255,255,255,0.15)"
                selectionColor={COLORS.primary}
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={handleSendChat}
                returnKeyType="send"
                blurOnSubmit={false}
              />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={chatInput.trim() ? handleSendChat : undefined}
                style={[sty.dockSend, chatInput.trim() && sty.dockSendActive]}
              >
                <Ionicons
                  name="paper-plane"
                  size={12}
                  color={chatInput.trim() ? '#fff' : 'rgba(255,255,255,0.12)'}
                />
              </TouchableOpacity>
            </View>

            {/*  Control strip — Mic tam ortada  */}
            <View style={sty.controlStrip}>

              {/* SOL GRUP */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TouchableOpacity activeOpacity={0.7} style={sty.ghostBtn} onPress={() => { const ns = !roomMuted; setRoomMuted(ns); lk.muteRoomAudio && lk.muteRoomAudio(ns); }}>
                  <Ionicons name={roomMuted ? 'volume-mute' : 'volume-medium'} size={18} color={roomMuted ? '#F44336' : 'rgba(255,255,255,0.6)'} />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} style={sty.ghostBtn} onPress={handleMicRequest}>
                  <Ionicons name="hand-left" size={16} color={micRequests.length > 0 && canModerate ? '#FF9800' : myMicRequested ? '#5CE1E6' : 'rgba(255,255,255,0.6)'} />
                  {canModerate && micRequests.length > 0 && (
                    <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#F44336', borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{micRequests.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {/* Kamera düğmesi — sadece sahnedekiler için (FEAT: listener disabled) */}
                {(amIHost || amIModerator || stageUsers.some(u => u.user_id === firebaseUser?.uid)) ? (
                  <TouchableOpacity activeOpacity={0.7} style={sty.ghostBtn} onPress={lk.toggleCamera}>
                    <Ionicons name="videocam" size={18} color={lk.isCameraEnabled ? COLORS.primary : "rgba(255,255,255,0.6)"} />
                  </TouchableOpacity>
                ) : (
                  <View style={[sty.ghostBtn, { opacity: 0.25 }]}>
                    <Ionicons name="videocam-off" size={18} color="rgba(255,255,255,0.3)" />
                  </View>
                )}
                <TouchableOpacity activeOpacity={0.7} style={sty.ghostBtn} onPress={() => setShowSettings(true)}>
                  <Ionicons name="settings-outline" size={16} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} style={[sty.ghostBtn, showEmojiBar && { backgroundColor: 'rgba(92,225,230,0.12)' }]} onPress={() => setShowEmojiBar(!showEmojiBar)}>
                  <Ionicons name="heart" size={16} color={showEmojiBar ? COLORS.primary : 'rgba(255,255,255,0.6)'} />
                </TouchableOpacity>
              </View>

              {/* ORTADA MİKROFON */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleMicPress}
                style={{
                  width: 52, height: 52, borderRadius: 26,
                  overflow: 'hidden',
                  borderWidth: 2,
                  borderColor: lk.isMicrophoneEnabled ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.5)',
                }}
              >
                <LinearGradient
                  colors={lk.isMicrophoneEnabled
                    ? ['rgba(34,197,94,0.35)', 'rgba(22,163,74,0.2)']
                    : ['rgba(239,68,68,0.3)', 'rgba(185,28,28,0.2)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons
                    name={lk.isMicrophoneEnabled ? 'mic' : 'mic-off'}
                    size={24}
                    color={lk.isMicrophoneEnabled ? '#22C55E' : '#EF4444'}
                  />
                </LinearGradient>
              </TouchableOpacity>

              {/* SAĞ GRUP */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TouchableOpacity activeOpacity={0.7} style={sty.giftBtn} onPress={() => setShowGiftPanel(true)}>
                  <Animated.View style={{ transform: [{ translateY: giftBounce }] }}>
                    <Ionicons name="gift" size={24} color="#FFB432" style={{ textShadowColor: 'rgba(255,180,50,0.9)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 15 }} />
                  </Animated.View>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[sty.ghostBtn, { backgroundColor: 'rgba(239,68,68,0.15)' }]}
                  onPress={() => {
                    if (amIHost) {
                      setAlertConfig({
                        visible: true, title: 'Odadan Ayrıl', message: amIModerator || participants.filter(p => p.role === 'moderator').length > 0
                          ? 'Oda moderatöre devredilecek. Ayrılmak istiyor musun?'
                          : 'Odada moderatör yok. Ayrılırsan oda 1 dakika sonra kapanacak.',
                        type: 'warning', icon: 'exit-outline',
                        buttons: [
                          { text: 'İptal', style: 'cancel' },
                          { text: 'Ayrıl', style: 'destructive', onPress: handleHostLeave },
                        ]
                      });
                    } else {
                      setAlertConfig({
                        visible: true, title: 'Odadan Ayrıl', message: 'Odadan ayrılmak istiyor musun?',
                        type: 'info', icon: 'exit-outline',
                        buttons: [
                          { text: 'İptal', style: 'cancel' },
                          { text: 'Ayrıl', onPress: handleUserLeave },
                        ]
                      });
                    }
                  }}
                >
                  <Ionicons name="exit-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>

            </View>

            {/* GERİ SAYIM BANNER */}
            {closingCountdown !== null && closingCountdown > 0 && (
              <View style={{
                backgroundColor: closingCountdown <= 5 ? 'rgba(239,68,68,0.9)' : 'rgba(245,158,11,0.85)',
                paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, marginTop: 6, alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                  {closingCountdown <= 5
                    ? `⚠️ Oda ${closingCountdown} saniye içinde kapanacak!`
                    : `⏳ Oda sahibi/moderatör yok — ${closingCountdown}sn sonra kapanıyor`}
                </Text>
              </View>
            )}
          </View>
      </KeyboardAvoidingView>

      {/*  KAMERA BÜYÜTME  */}
      {!!cameraExpandUser && (
        <CameraExpandModal nick={cameraExpandUser.nick} videoTrack={cameraExpandUser.track} onClose={() => setCameraExpandUser(null)} />
      )}

      {/*  DİNLEYİCİ ÇEKMECESİ  */}
      {!!showAudienceDrawer && (
        <AudienceDrawer
          users={audienceUsers}
          onClose={() => setShowAudienceDrawer(false)}
          onSelectUser={(u) => { setShowAudienceDrawer(false); setSelectedUser(u); }}
        />
      )}

      {/*  PROFİL EKRANI  */}
      {!!selectedUser && (
        <ProfileCard
          nick={selectedUser.user?.display_name || 'Gizli'}
          role={selectedUser.role}
          avatarUrl={selectedUser.user?.avatar_url}
          isOwnProfile={selectedUser.user_id === firebaseUser?.uid}
          isChatMuted={selectedUser.is_chat_muted || false}
          onClose={() => setSelectedUser(null)}
          onViewProfile={() => {
            setSelectedUser(null);
            router.push(`/user/${selectedUser.user_id}`);
          }}
          onFollow={() => {
            setSelectedUser(null);
            router.push(`/user/${selectedUser.user_id}`);
          }}
          onDM={() => {
            setSelectedUser(null);
            router.push(`/chat/${selectedUser.user_id}`);
          }}
          // Sahneye Al: dinleyicileri sahneye çağır (host, mod veya GodMaster)
          onPromoteToStage={canModerate && selectedUser.role === 'listener' && selectedUser.user_id !== firebaseUser?.uid ? () => handlePromoteToStage(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          // Sahneden İndir (GodMaster host'u bile indirebilir)
          onRemoveFromStage={canModerate && (selectedUser.role === 'speaker' || selectedUser.role === 'moderator' || (amIGodMaster && selectedUser.role === 'host')) && selectedUser.user_id !== firebaseUser?.uid ? async () => {
            try {
              await RoomService.demoteSpeaker(id as string, selectedUser.user_id);
              modChannelRef.current?.send({
                type: 'broadcast', event: 'mod_action',
                payload: { action: 'demote', targetUserId: selectedUser.user_id },
              });
              setSelectedUser(null);
              showToast({ title: 'Dinleyiciye Düşürüldü', message: 'Kullanıcı dinleyiciye düşürüldü', type: 'success' });
            } catch (e) {
              showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' });
            }
          } : undefined}
          // Ses Sustur (GodMaster host dahil herkesi susturabilir)
          onMute={canModerate && selectedUser.user_id !== firebaseUser?.uid && (amIGodMaster || selectedUser.role !== 'host') ? () => handleTimedMuteUser(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          // Metin Sustur (GodMaster host dahil herkesi susturabilir)
          onChatMute={canModerate && selectedUser.user_id !== firebaseUser?.uid && (amIGodMaster || selectedUser.role !== 'host') ? () => handleToggleChatMute(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı', selectedUser.is_chat_muted || false) : undefined}
          // Odadan Çıkar (GodMaster host'u bile çıkarabilir)
          onKick={canModerate && selectedUser.user_id !== firebaseUser?.uid && (amIGodMaster || selectedUser.role !== 'host') ? () => handleKickUser(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          // Moderatör Yap/Kaldır (host veya GodMaster)
          onMakeModerator={isGodOrHost && selectedUser.user_id !== firebaseUser?.uid && selectedUser.role !== 'host' ? () => handleToggleModerator(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı', selectedUser.role) : undefined}
          onReport={selectedUser.user_id !== firebaseUser?.uid ? () => handleReportUser(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onBlock={selectedUser.user_id !== firebaseUser?.uid ? () => handleBlockUser(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
        />
      )}
      {/*  HEDYE KAPLAMALARI  */}
      <GiftPanel
        visible={showGiftPanel}
        onClose={() => setShowGiftPanel(false)}
        userCoins={localCoins}
        onSend={handleSendGift}
        roomUsers={participants.map(p => ({
          id: p.user_id,
          name: p.user?.display_name || 'Misafir',
          avatarUrl: p.user?.avatar_url,
          role: p.role
        }))}
        defaultTargetId={selectedUser?.user_id || room?.host_id}
      />
      
      {/* BUG-10 FIX: Tüm hediyeleri GiftAnimationQueue'ya gönder (PremiumGiftScene3D boş Lottie sorunlu) */}
      <GiftAnimationQueue gifts={giftQueue} onGiftComplete={(gid: string) => setGiftQueue(prev => prev.filter(g => g.id !== gid))} />

      {/* ODA AYARLARI BOTTOM SHEET */}
      <RoomSettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        micMode={micMode}
        onMicModeChange={handleMicModeChange}
        noiseCancellation={noiseCancellation}
        onNoiseCancellationChange={handleNoiseCancellation}
        cameraFacing={cameraFacing}
        onCameraFacingChange={setCameraFacing}
        useSpeaker={useSpeaker}
        onSpeakerChange={handleSpeakerToggle}
        isMicEnabled={lk.isMicrophoneEnabled || false}
        isCameraEnabled={lk.isCameraEnabled || false}
        canCloseRoom={amIHost || amIGodMaster}
        onCloseRoom={handleCloseRoom}
      />

      {/* PREMIUM ALERT MODAL */}
      <PremiumAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        icon={alertConfig.icon}
        onDismiss={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
    </Animated.View>
  );
}

/* 
   STLLER (mobil2 birebir ayns)
    */
const sty = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050a14' },

  /* Header */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 4, zIndex: 20,
  },
  headerL: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  headerHostAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  headerHostInitials: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  headerRoom: { color: COLORS.white, fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  headerStatus: { color: COLORS.silverDark, fontSize: 9, marginTop: 1 },
  headerR: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  viewerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(92,225,230,0.06)', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 0.5, borderColor: 'rgba(92,225,230,0.15)',
  },
  viewerCount: { color: COLORS.primary, fontSize: 10, fontWeight: '600' },
  headerIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Stage */
  stage: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  stageGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 2,
  },

  /* Seat */
  seatGlass: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  innerShadow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2.5,
    borderColor: 'rgba(0,0,0,0.2)',
    opacity: 0.4,
  },
  seatInitials: { color: COLORS.silver, fontWeight: '700', letterSpacing: 0.5 },
  seatNick: { color: COLORS.silverDark, fontSize: 10, fontWeight: '500', marginTop: 3, maxWidth: 60, textAlign: 'center' },
  hostBadge: {
    position: 'absolute', top: -1, right: -1,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 0.5, borderColor: COLORS.vipGold,
    alignItems: 'center', justifyContent: 'center',
  },
  micIndicator: {
    position: 'absolute',
    width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5,
  },
  micOn: { backgroundColor: 'rgba(92,225,230,0.18)', borderColor: 'rgba(92,225,230,0.5)' },
  micOff: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },

  /* Audience */
  audience: { maxHeight: H * 0.18, paddingHorizontal: 12, marginBottom: 0, marginTop: 45 },
  audienceLabel: {
    color: COLORS.silverDark, fontSize: 10, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, marginLeft: 4,
  },
  audienceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },

  /* Chat */
  chatArea: {
    flex: 1,
    marginHorizontal: 14,
    marginBottom: 2,
    justifyContent: 'flex-end',
  },
  chatFadeTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 36, zIndex: 2,
  },
  chatFadeBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, zIndex: 2,
  },
  chatBubble: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5,
    marginBottom: 4, alignSelf: 'flex-start',
  },
  chatSender: { color: COLORS.primary, fontSize: 11, fontWeight: '600' },
  chatBody: { color: COLORS.silver, fontSize: 11, flexShrink: 1 },
  entryText: { color: COLORS.silverDark, fontSize: 10, fontStyle: 'italic' },

  /* VIP Banner */
  vipBanner: {
    position: 'absolute', top: 180, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    zIndex: 100,
    shadowColor: '#D4AF37', shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  vipBannerText: { color: COLORS.vipGold, fontSize: 11, fontWeight: '600' },

  /* Premium Dock */
  dock: {
    width: '100%',
    paddingHorizontal: 12, paddingTop: 10,
    overflow: 'visible',
  },
  inputStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingLeft: 6, paddingRight: 2,
    marginBottom: 6,
  },
  dockEmoji: {
    marginRight: 4,
  },
  dockInput: {
    flex: 1, color: '#fff', fontSize: 12,
    paddingVertical: 0, paddingHorizontal: 2,
  },
  dockSend: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dockSendActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 }, elevation: 3,
  },
  controlStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  ghostBtn: {
    width: 40, height: 36,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 12,
  },
  giftBtn: {
    marginHorizontal: 4,
    width: 48, height: 44,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'visible',
  },
  giftBtnCircle: {
    width: 44, height: 38,
    borderRadius: 14,
    overflow: 'hidden',
  },
  micPill: {
    position: 'relative',
    marginHorizontal: 6,
  },
  micPillGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38, borderRadius: 19,
    paddingHorizontal: 14, gap: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(92,225,230,0.08)',
  },
  micPillLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11, fontWeight: '600',
    letterSpacing: 0.3,
  },
  micPillGlow: {
    position: 'absolute',
    top: -2, left: -2, right: -2, bottom: -2,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(92,225,230,0.12)',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },

  /* Profile Card */
  profileOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', zIndex: 200,
  },
  profileCard: {
    width: W * 0.82, backgroundColor: 'rgba(16,24,42,0.95)',
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  profileAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  profileInitials: { color: '#fff', fontSize: 16, fontWeight: '700' },
  profileNick: { color: '#fff', fontSize: 15, fontWeight: '700' },
  profileRole: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  profileActions: { flexDirection: 'row', gap: 8 },
  profileBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  profileBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
});
