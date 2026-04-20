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
  ActivityIndicator,
  PanResponder,
  Linking,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import { safeGoBack } from '../../constants/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';

// SopranoChat Services
import { RoomService, MessageService, RealtimeService, getRoomLimits, type Room, type RoomParticipant } from '../../services/database';
import { purgeChannelByName } from '../../services/realtime';
import { RoomHistoryService } from '../../services/roomHistory';
import { supabase } from '../../constants/supabase';
import { RoomChatService, type RoomMessage } from '../../services/roomChat';
import { checkPermission } from '../../services/permissions';
import { ROLE_LEVEL, migrateLegacyTier, type ParticipantRole, type SubscriptionTier } from '../../types';
import { isTierAtLeast } from '../../constants/tiers';

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

import { useAuth } from '../_layout';
import useLiveKit from '../../hooks/useLiveKit';
import { useMicMeter } from '../../hooks/useMicMeter';

import { liveKitService } from '../../services/livekit';
import { isSystemRoom, getSystemRooms } from '../../services/showcaseRooms';
import RoomSettingsSheet, { type MicMode, type CameraFacing } from '../../components/RoomSettingsSheet';
import { PasswordPromptSheet, AccessRequestSheet, AccessGate } from '../../components/room/RoomAccessPrompts';
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
import CameraFullscreenModal from '../../components/room/CameraFullscreenModal';
import ListenerGrid from '../../components/room/ListenerGrid';
import RoomControlBar from '../../components/room/RoomControlBar';
import RoomChatDrawer from '../../components/room/RoomChatDrawer';
import InlineChat from '../../components/room/InlineChat';
import EmojiDrawer from '../../components/room/EmojiDrawer';
import DonationDrawer from '../../components/room/DonationDrawer';
import DonationAlert, { type DonationAlertRef } from '../../components/room/DonationAlert';
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
import ModerationOverlay, { type ModerationOverlayRef } from '../../components/room/ModerationOverlay';
import type { FlashType } from '../../components/room/AvatarPenaltyFlash';


// ★ LiveKit VideoView — native modül yoksa null (prod build gerektirmez)
let LKVideoView: any = null;
try { LKVideoView = require('@livekit/react-native').VideoView; } catch {}


const { width: W, height: H } = Dimensions.get('window');
const DM_PANEL_W = W * 0.72;
const DM_SWIPE_ACTION_W = 180; // 3 buton × 60px

// ★ PERF-2: Module-level constant — her render'da yeniden oluşturulmaz
const MUSIC_URLS: Record<string, string> = {
  lofi: 'https://cdn.pixabay.com/audio/2024/11/01/audio_6c783ea43a.mp3',
  ambient: 'https://cdn.pixabay.com/audio/2022/10/25/audio_84e24d5bf7.mp3',
  jazz: 'https://cdn.pixabay.com/audio/2024/09/18/audio_62e6648deb.mp3',
};

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

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 15 && Math.abs(gs.dy) < 15,
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) translateX.setValue(Math.max(gs.dx, -(DM_SWIPE_ACTION_W + 10)));
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
          <Text style={dmSwipeS.actionLabel}>Sil</Text>
        </Pressable>
        {/* Sessize Al / Aç */}
        <Pressable
          onPress={() => { closeSwipe(); onMute(); }}
          style={[dmSwipeS.actionBtn, { backgroundColor: isMuted ? '#14B8A6' : '#F59E0B' }]}
        >
          <Ionicons name={isMuted ? 'notifications-outline' : 'notifications-off-outline'} size={18} color="#FFF" />
          <Text style={dmSwipeS.actionLabel}>{isMuted ? 'Sesi Aç' : 'Sessiz'}</Text>
        </Pressable>
        {/* Engelle */}
        <Pressable
          onPress={() => { closeSwipe(); onBlock(); }}
          style={[dmSwipeS.actionBtn, { backgroundColor: '#7F1D1D' }]}
        >
          <Ionicons name="ban-outline" size={18} color="#FFF" />
          <Text style={dmSwipeS.actionLabel}>Engelle</Text>
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
  const [chatTarget, setChatTarget] = useState<{ userId: string; name: string; avatar?: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

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

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      // ★ FIX: Panel açılınca inbox'ı yükle (toggleDmPanel dışından açılsa bile)
      if (firebaseUser?.uid) {
        MessageService.getInbox(firebaseUser.uid).then(msgs => setDmInboxMessages(msgs)).catch(() => {});
      }
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: DM_PANEL_W, useNativeDriver: true, damping: 18, stiffness: 200 }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
      // Panel kapanırken sohbet görünümünü sıfırla
      setTimeout(() => { setChatTarget(null); setChatMessages([]); }, 300);
    }
  }, [visible]);

  // ★ initialChatTarget ile panel açıldığında otomatik sohbet başlat
  useEffect(() => {
    if (visible && initialChatTarget && !chatTarget) {
      openChat(initialChatTarget.userId, initialChatTarget.name, initialChatTarget.avatar);
    }
  }, [visible, initialChatTarget]);

  // ★ Sohbet görünümüne geçiş — mesajları yükle
  const openChat = async (userId: string, name: string, avatar?: string) => {
    setChatTarget({ userId, name, avatar });
    setChatInput('');
    setLoadingChat(true);
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${firebaseUser.uid},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${firebaseUser.uid})`)
        .not('is_deleted', 'is', true)
        .order('created_at', { ascending: false })
        .limit(50);
      // Profil bilgisini ayrı eşle (FK bağımlılığı yok)
      const msgs = (data || []).map((m: any) => ({
        ...m,
        sender: {
          display_name: m.sender_id === firebaseUser.uid ? 'Sen' : name,
          avatar_url: m.sender_id === firebaseUser.uid ? '' : (avatar || ''),
        },
      }));
      setChatMessages(msgs);
      // Okundu işaretle
      MessageService.markAsRead(firebaseUser.uid, userId).catch(() => {});
    } catch {}
    setLoadingChat(false);
  };

  // ★ Mesaj gönder — takip kontrolü + engel kontrolü
  const handleSend = async () => {
    if (!chatInput.trim() || !chatTarget || chatSending) return;
    const text = chatInput.trim();
    setChatInput('');
    setChatSending(true);

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

      // ★ Takipleşme kontrolü — karşılıklı değilse mesaj isteği olarak gönder
      let isMessageRequest = false;
      try {
        const { outgoing, incoming } = await FriendshipService.getDetailedStatus(firebaseUser.uid, chatTarget.userId);
        const isMutual = outgoing === 'accepted' && incoming === 'accepted';
        if (!isMutual) isMessageRequest = true;
      } catch {}

      // Optimistic: hemen ekle
      const optMsg = {
        id: `opt_${Date.now()}`,
        sender_id: firebaseUser.uid,
        receiver_id: chatTarget.userId,
        content: text,
        created_at: new Date().toISOString(),
        sender: { display_name: 'Sen', avatar_url: '' },
        _isMessageRequest: isMessageRequest,
      };
      setChatMessages(prev => [optMsg, ...prev]);

      await MessageService.send(firebaseUser.uid, chatTarget.userId, text, isMessageRequest);
      // ★ FIX: İlk mesaj sonrası inbox'ı güncelle — yoksa panel kapatılıp açılınca mesaj kaybolur
      MessageService.getInbox(firebaseUser.uid).then(msgs => setDmInboxMessages(msgs)).catch(() => {});
    } catch {}
    setChatSending(false);
  };

  // ★ Realtime mesaj dinleme (sohbet açıkken)
  useEffect(() => {
    if (!chatTarget || !firebaseUser) return;
    const channel = supabase
      .channel(`dm-panel-rt-${chatTarget.userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${chatTarget.userId}`,
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.receiver_id === firebaseUser.uid) {
          setChatMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [{ ...msg, sender: { display_name: chatTarget.name, avatar_url: chatTarget.avatar || '' } }, ...prev];
          });
          MessageService.markAsRead(firebaseUser.uid, chatTarget.userId).catch(() => {});
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatTarget?.userId, firebaseUser?.uid]);

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

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)', opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel — sağdan kayar + sürüklenebilir (tüm alandan sürüklenebilir) */}
      <Animated.View {...dmPanHandlers} style={{
        position: 'absolute', right: 0, top: 70, bottom: 80,
        width: DM_PANEL_W,
        backgroundColor: 'rgba(45,55,64,0.95)',
        borderTopLeftRadius: 18, borderBottomLeftRadius: 18,
        borderWidth: 1, borderRightWidth: 0, borderColor: 'rgba(20,184,166,0.12)',
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 20,
        transform: [{ translateX: Animated.add(slideAnim, dmSwipeX) }],
      }}>

        {/* ═══ SOHBET GÖRÜNÜMÜ ═══ */}
        {chatTarget ? (
          <View style={{ flex: 1 }}>
            {/* Chat Header */}
            <View collapsable={false} style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 12, paddingVertical: 10,
              borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
              backgroundColor: 'rgba(20,184,166,0.06)',
            }}>
              <Pressable onPress={() => setChatTarget(null)} hitSlop={12} style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.06)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="arrow-back" size={15} color="#F1F5F9" />
              </Pressable>
              <Image source={getAvatarSource(chatTarget.avatar)} style={{
                width: 30, height: 30, borderRadius: 15,
                borderWidth: 1, borderColor: 'rgba(20,184,166,0.3)',
              }} />
              <Text style={{ color: '#F1F5F9', fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {chatTarget.name}
              </Text>
              {/* ★ Sessize alma badge — chat header'da */}
              {mutedDmUsers.has(chatTarget.userId) && (
                <Ionicons name="notifications-off" size={14} color="rgba(245,158,11,0.5)" style={{ marginRight: 4 }} />
              )}
            </View>

            {/* Mesaj Listesi — inverted */}
            {loadingChat ? (
              <ActivityIndicator color="#14B8A6" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={chatMessages}
                keyExtractor={(item, i) => item.id || `msg_${i}`}
                inverted
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 10, gap: 4 }}
                renderItem={({ item }) => {
                  const isMine = item.sender_id === firebaseUser?.uid;
                  return (
                    <View style={{
                      alignSelf: isMine ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      paddingHorizontal: 12, paddingVertical: 8,
                      borderRadius: 16,
                      borderBottomRightRadius: isMine ? 4 : 16,
                      borderBottomLeftRadius: isMine ? 16 : 4,
                      backgroundColor: isMine ? 'rgba(20,184,166,0.2)' : 'rgba(255,255,255,0.06)',
                      borderWidth: 1,
                      borderColor: isMine ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.04)',
                    }}>
                      <Text style={{ color: '#F1F5F9', fontSize: 13, lineHeight: 18 }}>{item.content}</Text>
                      <Text style={{
                        color: 'rgba(255,255,255,0.2)', fontSize: 9,
                        alignSelf: 'flex-end', marginTop: 2,
                      }}>
                        {new Date(item.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <Ionicons name="chatbubble-outline" size={24} color="rgba(255,255,255,0.1)" />
                    <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 8 }}>Henüz mesaj yok</Text>
                  </View>
                }
              />
            )}

            {/* Input Bar */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingHorizontal: 10, paddingVertical: 8,
              borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
              backgroundColor: 'rgba(30,40,50,0.5)',
            }}>
              <TextInput
                style={{
                  flex: 1, height: 36, borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                  paddingHorizontal: 14, fontSize: 13, color: '#F1F5F9',
                }}
                placeholder="Mesaj yaz..."
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={chatInput}
                onChangeText={setChatInput}
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
                <Ionicons name="send" size={16} color={chatInput.trim() ? '#14B8A6' : 'rgba(255,255,255,0.15)'} />
              </Pressable>
            </View>
          </View>
        ) : (
          /* ═══ İNBOX GÖRÜNÜMÜ ═══ */
          <>
            {/* Header */}
            <View collapsable={false} style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingHorizontal: 14, paddingVertical: 12,
              borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
              backgroundColor: 'rgba(20,184,166,0.06)',
            }}>
              <View style={{
                width: 28, height: 28, borderRadius: 9,
                backgroundColor: 'rgba(20,184,166,0.15)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="chatbubbles" size={13} color="#14B8A6" />
              </View>
              <Text style={{ color: '#F1F5F9', fontSize: 14, fontWeight: '700', flex: 1, letterSpacing: -0.2 }}>Mesajlar</Text>
              {dmUnreadCount > 0 && (
                <View style={{
                  minWidth: 20, height: 20, borderRadius: 10,
                  backgroundColor: '#14B8A6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
                }}>
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>{dmUnreadCount > 99 ? '99+' : dmUnreadCount}</Text>
                </View>
              )}
            </View>

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
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '600' }}>Henüz mesaj yok</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, marginTop: 4 }}>Birine tıklayarak mesaj gönderebilirsin</Text>
                </View>
              ) : (
                dmInboxMessages.slice(0, 15).map((msg: any, idx: number) => {
                  const senderName = msg.partner_name || msg.sender_display_name || msg.other_display_name || 'Kullanıcı';
                  const senderAvatar = msg.partner_avatar || msg.sender_avatar_url || msg.other_avatar_url;
                  const preview = msg.last_message_content || msg.last_message || msg.content || '';
                  const isUnread = (msg.unread_count || 0) > 0 || !msg.is_read;
                  const senderId = msg.partner_id || msg.other_user_id || msg.sender_id;
                  const timeAgo = msg.last_message_time || msg.last_message_at || msg.created_at;
                  const mins = timeAgo ? Math.floor((Date.now() - new Date(timeAgo).getTime()) / 60000) : 0;
                  const timeLabel = mins < 1 ? 'şimdi' : mins < 60 ? `${mins}dk` : mins < 1440 ? `${Math.floor(mins / 60)}sa` : `${Math.floor(mins / 1440)}g`;
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
      </Animated.View>
    </View>
  );
}

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
  // ★ 2026-04-20: Kamera fullscreen için seçili kullanıcı (rozete tap ile set edilir)
  const [cameraExpandUser, setCameraExpandUser] = useState<RoomParticipant | null>(null);
  const [entryEffectName, setEntryEffectName] = useState<string | null>(null);
  // Mic permission system (local)
  const [micRequests, setMicRequests] = useState<string[]>([]); // user_id'ler
  const [showMicRequests, setShowMicRequests] = useState(false);
  const [myMicRequested, setMyMicRequested] = useState(false);
  const [approvedSpeakers, setApprovedSpeakers] = useState<string[]>([]);
  const [roomMuted, setRoomMuted] = useState(false);


  const [showAudienceDrawer, setShowAudienceDrawer] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [micMode, setMicMode] = useState<MicMode>('normal');
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('front');
  const [noiseCancellation, setNoiseCancellation] = useState(true);
  const [useSpeaker, setUseSpeaker] = useState(true);
  const [alertConfig, setAlertConfig] = useState<{ visible: boolean; title: string; message: string; type?: AlertType; buttons?: AlertButton[]; icon?: string }>({ visible: false, title: '', message: '' });
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const floatingRef = useRef<FloatingReactionsRef>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showAccessPanel, setShowAccessPanel] = useState(false);
  const [showDonationDrawer, setShowDonationDrawer] = useState(false);
  const [showInviteFriends, setShowInviteFriends] = useState(false);
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
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);
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
    setShowEmojiBar(false);
    setShowDmPanel(false);
    setShowDonationDrawer(false);
    setShowChatDrawer(false);
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
        showInviteFriends || showRoomStats || showEmojiBar || showDonationDrawer
      ) {
        closeAllOverlays();
        return true;
      }
      const isHost = room?.host_id === firebaseUser?.uid;
      if (isHost) {
        setAlertConfig({
          visible: true,
          title: 'Odadan Ayrıl',
          message: 'Ayrılmak istiyor musun?',
          type: 'warning',
          icon: 'exit-outline',
          buttons: [
            { text: 'İptal', style: 'cancel' },
            { text: 'Ayrıl', style: 'destructive', onPress: handleHostLeave },
          ],
        });
      } else {
        handleUserLeave();
      }
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [
    alertConfig.visible, selectedUser, showChatDrawer, showAudienceDrawer, showDmPanel,
    showSettings, showPlusMenu, showAccessPanel, showMicRequests, showInviteFriends,
    showRoomStats, showEmojiBar, showDonationDrawer,
    room?.host_id, firebaseUser?.uid, closeAllOverlays,
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
        setAlertConfig({
          visible: true, title: '💰 Yetersiz SP',
          message: `Bu odaya girmek için ${fee} SP gerekiyor. Mevcut bakiyeniz: ${currentSP} SP.`,
          type: 'warning', icon: 'wallet-outline',
          buttons: [{ text: 'Geri Dön', onPress: () => safeGoBack(router) }],
        });
        return false;
      }
      // ★ SEC-DOUBLE-CHARGE FIX: Host payı ve SP düşme sadece backend'de (RoomService.join)
      // Frontend'de GamificationService.earn() ÇAĞIRILMAZ — aksi halde host %90'ı 2 kez alır
      // ★ K3 FIX: SP Toast gösterimi backend join başarılı olduktan sonraya (joinRoom) taşındı
      return true;
    } catch {
      return true; // SP servisi hata verirse girişe izin ver (graceful degradation)
    }
  }, [router]);

  // ★ ARCH-1 FIX: Broadcast kanalları hook'a taşındı (~200 satır kaldırıldı)
  const roomHostRef = useRef<string | null>(null);
  // ★ B6 FIX: firebaseUser ref — uzun ömürlü subscription callback'lerinde stale closure önleme
  const firebaseUserRef = useRef(firebaseUser);
  useEffect(() => { firebaseUserRef.current = firebaseUser; }, [firebaseUser]);
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
  





  // ★ Oda Arka Plan Müziği — ambient ses döngüsü (expo-av)
  const musicSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const musicTrack = room?.room_settings?.music_track;
    // ★ TIER-2 FIX: Müzik tier kontrolü — sadece canUseRoomMusic=true olan tier'lar çalabilir
    const roomTier = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as SubscriptionTier;
    const tierLimits = getRoomLimits(roomTier);
    const playMusic = async () => {
      if (musicSoundRef.current) {
        try { await musicSoundRef.current.unloadAsync(); } catch {}
        musicSoundRef.current = null;
      }
      if (!musicTrack || !MUSIC_URLS[musicTrack] || !tierLimits.canUseRoomMusic) return;
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: MUSIC_URLS[musicTrack] },
          { shouldPlay: true, isLooping: true, volume: 0.15 }
        );
        musicSoundRef.current = sound;
      } catch (e) {
        if (__DEV__) console.warn('[Music] Yükleme hatası:', e);
      }
    };
    playMusic();
    return () => {
      if (musicSoundRef.current) {
        musicSoundRef.current.unloadAsync().catch(() => {});
        musicSoundRef.current = null;
      }
    };
  }, [room?.room_settings?.music_track]);

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

      if ((!existing || !trustedExistingRole) && profile) {
        // Sistem odalarında DB join yapma — lokal katılımcı zaten eklendi
        if (isSystemRoom(id as string)) {
          // Sistem odasında sadece hoş geldin mesajı göster
          setAccessGranted(true);
          return;
        }
        // ★ ODA GİRİŞ KONTROLÜ — RoomAccessService.checkAccess() ile merkezi kontrol
        if (!isHost && !isAdmin) {
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

          const accessResult: AccessCheckResult = await RoomAccessService.checkAccess(
            roomForCheck,
            firebaseUser.uid,
            (profile?.subscription_tier || 'Free') as any,
            userAge,
            (profile as any)?.language || null,
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

            // Diğer tüm engeller → uygun alert göster
            const ACTION_ALERTS: Record<string, { title: string; icon: string; type: 'error' | 'warning' }> = {
              banned: { title: '⛔ Erişim Engellendi', icon: 'ban', type: 'error' },
              room_locked: { title: '🔒 Oda Kilitli', icon: 'lock-closed', type: 'warning' },
              followers_only: { title: '👥 Arkadaşlara Özel', icon: 'people', type: 'warning' },
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
        RoomService.join(id, firebaseUser.uid, joinRole).then(() => {
          setAccessGranted(true); // ★ DB'de participant row var artık — LiveKit token alınabilir
          // ★ K3 FIX: SP Toast timing — backend'de SP tahsilatı (eğer varsa) başarılı olduktan SONRA toast gösterilir
          const fee = roomData.room_settings?.entry_fee_sp || 0;
          if (fee > 0 && joinRole !== 'owner') {
             spToastRef.current?.show(-fee, 'Giriş Ücreti');
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
        }).catch((err: any) => {
          // ★ Join DB insert fail olursa access'i geri al — LiveKit bağlantı denemesin
          setAccessGranted(false);
          // ★ BUG FIX: Ban/kilit/erişim hatalarını kullanıcıya göster
          const msg = err?.message || 'Bu odaya katılınamadı.';
          setAlertConfig({
            visible: true,
            title: msg.includes('yasaklan') ? '⛔ Erişim Engellendi' : msg.includes('kilitli') ? '🔒 Oda Kilitli' : '⚠️ Giriş Hatası',
            message: msg,
            type: msg.includes('yasaklan') ? 'error' : 'warning',
            icon: msg.includes('yasaklan') ? 'ban' : msg.includes('kilitli') ? 'lock-closed' : 'alert-circle',
            buttons: [{ text: 'Geri Dön', onPress: () => safeGoBack(router) }],
          });
        });
        // ★ REMOVED: Sarı giriş banner'ı kaldırıldı — chat'te zaten "odaya katıldı" mesajı var
      } else if (existing && isHost && existing.role !== 'owner') {
        // Host zaten var ama rolü yanlış — düzelt
        RoomService.join(id, firebaseUser.uid, 'owner').catch((err: any) => {
          if (__DEV__) console.warn('[Join] Host rol düzeltme hatası:', err?.message);
        });
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
    // Mesajlar: Eski mesajlar yüklenmez — herkes sıfırdan başlar, sadece realtime mesajlar gösterilir
    // BUG-11 FIX: Mesaj birikimi limitleme (max 100)
    const unsubscribeMsg = RoomChatService.subscribe(
      id as string,
      (msg) => setChatMessages(prev => [msg, ...prev].slice(0, 100)),
      // ★ O11: Mesaj soft-delete veya hard-delete olunca chat listesinden kaldır
      (messageId) => setChatMessages(prev => prev.filter(m => m.id !== messageId)),
    );

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
        title: `⚠️ ${label} İzni Gerekli`,
        message: `Sahnede konuşmak için ${label.toLocaleLowerCase('tr-TR')} iznine ihtiyacımız var. İzni reddettiğiniz için ${device === 'microphone' ? 'mikrofonunuzu açamadık' : 'kameranızı açamadık'}. Ayarlardan izni açtıktan sonra tekrar deneyin.`,
        type: 'warning',
        icon: device === 'microphone' ? 'mic-off' : 'videocam-off',
        buttons: [
          { text: 'İptal', style: 'cancel' },
          { text: 'Ayarları Aç', onPress: () => { Linking.openSettings().catch(() => {}); } },
        ],
      });
    }, []),
  });

  // ★ BUG-1 FIX: lkRef'i her render'da güncel tut — useRoomBroadcast callback'leri hep güncel lk kullanır
  lkRef.current = lk;

  // ★ O4: is_chat_muted ref'i her render'da güncelle — emoji/reaction gönderimi bu ref'e bakar
  isChatMutedRef.current = !!participants.find(p => p.user_id === firebaseUser?.uid)?.is_chat_muted;


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
    // ★ SEC-PERF: DB sorgusu kaldırıldı — broadcast ile senkronize local state yeterli
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
      // ★ Kendi cihazımızda da micRequests'ten çıkar — avatar ikonu kaybolur
      setMicRequests(prev => prev.filter(u => u !== firebaseUser?.uid));
      micReqChannelRef.current?.send({
        type: 'broadcast', event: 'mic_request',
        payload: { type: 'cancel', userId: firebaseUser?.uid },
      });
    } else {
      setMyMicRequested(true);
      // ★ Kendi cihazımızda da micRequests'e ekle — avatar ikonu görünsün
      setMicRequests(prev => {
        if (prev.includes(firebaseUser?.uid || '')) return prev;
        return [...prev, firebaseUser?.uid || ''];
      });
      micReqChannelRef.current?.send({
        type: 'broadcast', event: 'mic_request',
        payload: {
          type: 'request',
          userId: firebaseUser?.uid,
          displayName: profile?.display_name || 'Kullanıcı',
        },
      });
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
      if (__DEV__) console.warn('[Mic] Toggle hatası:', e);
      showToast({ title: 'Mikrofon Hatası', message: 'Mikrofon değiştirilemedi', type: 'error' });
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
      showToast({ title: 'Sahne Dolu', message: `Sahnede maksimum ${maxSlots} kişi olabilir`, type: 'warning' });
      UpsellService.onStageCapacityFull(ownerTier as any);
      return;
    }
    setApprovedSpeakers(prev => [...prev, uid]);
    setMicRequests(prev => prev.filter(u => u !== uid));
    try {
      await RoomService.promoteSpeaker(id as string, uid);
      // ★ BUG FIX: Optimistik state güncelleme — listener → speaker (UI anında sahneye taşır)
      setParticipants(prev => prev.map(p => p.user_id === uid ? { ...p, role: 'speaker' as const, is_muted: false } : p));
    } catch (e) {
      if (__DEV__) console.warn('Speaker yükseltme hatası:', e);
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
        // ★ Plus+: Oda açık kalır — sahibi dilediğinde geri dönebilir veya manuel dondurabilir
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
      // ★ BUG FIX: Hata durumunda flag'ı sıfırla — cleanup effect leave() çağırabilsin, hayalet oluşmasın
      isRoomClosingRef.current = false;
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
    // ★ BUG-R2 FIX: Yetki kontrolü — banned/spectator/guest host olamaz (frontend quick-check)
    const myPart = participants.find(p => p.user_id === firebaseUser.uid);
    if (!myPart || ['banned', 'spectator', 'guest'].includes(myPart.role)) {
      showToast({ title: 'Yetki Yok', message: 'Bu rolde host olamazsınız.', type: 'warning' });
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
      showToast({ title: '👑 Host Oldun!', message: 'Oda yönetimi sende. Geri sayım iptal edildi.', type: 'success' });
      // BUG-RM5 FIX: Optimistik state güncelleme
      setRoom(prev => prev ? { ...prev, host_id: firebaseUser.uid } : prev);
      setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'owner' as const } : p));
      // Ek olarak tam veriyi de çek (arka planda)
      RoomService.get(id as string).then(setRoom).catch(() => {});
    } catch (e: any) {
      showToast({ title: 'Hata', message: e?.message || 'Host olunamadı', type: 'error' });
    }
  };



  // ========== SAHNEDEN İNME (Self-Demote) ==========
  const handleSelfDemote = async () => {
    try {
      if (firebaseUser?.uid) {
        if (lk.isMicrophoneEnabled) await lk.toggleMic();
        await RoomService.demoteSpeaker(id as string, firebaseUser.uid);
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
        showToast({ title: 'Sahneden İndin', message: 'Artık dinleyicisin', type: 'info' });
      }
    } catch (e) {
      showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' });
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
      if (hrs > 0) setRoomDuration(`${hrs} sa ${mins % 60} dk`);
      else setRoomDuration(`${mins} dk`);
      if (room.expires_at) {
        const remaining = new Date(room.expires_at).getTime() - Date.now();
        if (remaining <= 0) {
          const _t = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as any;
          UpsellService.onRoomDurationExpired(_t);
          setRoomExpiry('⏰ Süre doldu!');
          if (isHost) {
            showToast({ title: '⏰ Süre Doldu', message: 'Oda süresi doldu. Oda kapatılıyor...', type: 'warning', id: 'room_expired' });
            setTimeout(async () => { try { await RoomService.close(id as string); liveKitService.disconnect().catch(() => {}); setMinimizedRoom(null); safeGoBack(router); } catch {} }, 3000);
          } else {
            showToast({ title: '⏰ Süre Doldu', message: 'Oda süresi doldu. Oda kapanıyor...', type: 'warning', id: 'room_expired' });
            setTimeout(() => { liveKitService.disconnect().catch(() => {}); setMinimizedRoom(null); safeGoBack(router); }, 5000);
          }
          return;
        }
        const remMins = Math.floor(remaining / 60000);
        const remHrs = Math.floor(remMins / 60);
        if (remHrs > 0) setRoomExpiry(`${remHrs} sa ${remMins % 60} dk kaldı`);
        else setRoomExpiry(`${remMins} dk kaldı`);

        // ★ Süre azalma uyarıları — 15dk ve 5dk kala
        if (remMins <= 15 && remMins > 5 && !expiryWarningsRef.current.has('15min')) {
          expiryWarningsRef.current.add('15min');
          if (isHost) {
            showToast({
              title: '⏳ 15 dakika kaldı',
              message: 'Oda süresi azalıyor. Plus\'a geçerek süresini uzatabilirsin.',
              type: 'upsell',
              duration: 5000,
              id: 'room_15min_warn',
              action: { label: 'Yükselt', onPress: () => router.push('/plus' as any) },
            });
          } else {
            showToast({ title: '⏳ 15 dakika kaldı', message: 'Bu oda 15 dakika sonra kapanacak.', type: 'info', id: 'room_15min_warn' });
          }
        }
        if (remMins <= 5 && !expiryWarningsRef.current.has('5min')) {
          expiryWarningsRef.current.add('5min');
          if (isHost) {
            showToast({
              title: '🚨 Son 5 dakika!',
              message: 'Oda kapanmak üzere! Pro ile sınırsız oda süresi.',
              type: 'warning',
              duration: 6000,
              id: 'room_5min_warn',
              action: { label: 'Pro\'ya Geç', onPress: () => router.push('/plus' as any) },
            });
          } else {
            showToast({ title: '🚨 Son 5 dakika!', message: 'Bu oda 5 dakika içinde kapanacak.', type: 'warning', id: 'room_5min_warn' });
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

    // ★ O3 FIX: viewerCount ghost kullanıcıları sayma (non-mod görüntüleyenler için).
    // Mod/host ghost'ları görür, sayaçta da görünsün.
    const visibleTotal = visibleStage.length + visibleListeners.length + visibleSpectators.length;
    const _viewerCount = canSeeGhosts ? active.length : visibleTotal;

    return { stageUsers: visibleStage, listenerUsers: visibleListeners, spectatorUsers: visibleSpectators, viewerCount: _viewerCount, amIHost: _amIHost || _amIActingHost, amIModerator: _amIMod, amIGodMaster: _amIGod, canModerate: _canMod, isGodOrHost: _isGodOrHost, hostUser: _hostUser, amIActingHost: _amIActingHost, isOriginalHost: _isOriginalHost };
  }, [participants, room?.host_id, room?.room_settings?.original_host_id, firebaseUser?.uid, profile?.is_admin]);

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

  // Kendi participant kaydım — cooldown kontrol için stage_expires_at kullanılır
  const myParticipant = useMemo(
    () => participants.find(p => p.user_id === firebaseUser?.uid),
    [participants, firebaseUser?.uid]
  );

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
      showToast({ title: '⏳ 30 saniye kaldı', message: 'Sahne süren bitiyor', type: 'warning' });
    }, warnMs) : null;

    // Süre bittiğinde server cleanup çağır; realtime row update ile rol 'listener'a geçer
    const expireTimer = setTimeout(() => {
      RoomService.releaseExpiredCaretakers().catch(() => {});
      showToast({ title: '🎧 Sahneden İndin', message: 'Sahne süren doldu — 60sn sonra tekrar çıkabilirsin', type: 'info' });
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
      showToast({
        title: '🎙️ Sahnedesiniz',
        message: `${Math.floor(result.duration_sec / 60)} dakika süreyle konuşabilirsin`,
        type: 'success',
      });
      // Local optimistic — realtime row update zaten gelecek ama hızlı olsun
      setParticipants(prev => prev.map(p =>
        p.user_id === firebaseUser.uid
          ? { ...p, role: 'speaker' as const, stage_expires_at: result.expires_at, is_muted: false }
          : p
      ));
    } catch (err: any) {
      const msg = err?.message || 'Sahneye çıkılamadı';
      const isCooldown = /bekleme|cooldown|\d+\s*saniye/i.test(msg);
      const isFull = /dolu/i.test(msg);
      showToast({
        title: isFull ? '🚫 Sahne Dolu' : isCooldown ? '⏳ Bekle' : 'Hata',
        message: msg,
        type: 'warning',
      });
    }
  }, [firebaseUser?.uid, id, setParticipants]);

  // ★ Owner tier'ı — oda yönetim özelliklerinin tier kilidini belirler
  const ownerTier = useMemo(() => {
    // ★ Admin (GodMaster) her zaman Pro gibi davranır
    if (profile?.is_admin) return 'Pro';
    // ★ T-2 FIX: migrateLegacyTier ile eski Gold/VIP/Bronze/Silver tier'ları normalize et
    const raw = (room as any)?.owner_tier || room?.host?.subscription_tier || 'Free';
    return migrateLegacyTier(raw);
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

  // ★ 2026-04-19 Pro: Tümünü Aç — mute_all'un tersi
  const handleUnmuteAll = useCallback(async () => {
    if (!room || !firebaseUser) return;
    setAlertConfig({
      visible: true, title: '🔊 Tümünü Aç', message: 'Sahnedeki tüm konuşmacıların mikrofonları tekrar açılacak.',
      type: 'info', icon: 'volume-high',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Aç', onPress: async () => {
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
          showToast({ title: '🔊 Tümü Açıldı', message: `${stagePeople.length} konuşmacı serbest bırakıldı`, type: 'success' });
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

    if (!isHost && !isMod) {
      // ★ K5 FIX: Speaking mode kontrolü — sadece normal kullanıcılar için
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
    }

    // Sahneye çık — host/mod veya free_for_all modu
    // ★ UX-1 FIX: Sahne slot limiti kontrolü (host muaf)
    // ★ T-2 FIX: Merkezi ownerTier kullan
    if (!isHost) {
      const slotLimits = getRoomLimits(ownerTier as any);
      const currentStage = participants.filter(p => ['owner', 'speaker', 'moderator'].includes(p.role));
      if (currentStage.length >= slotLimits.maxSpeakers) {
        showToast({ title: 'Sahne Dolu', message: `Sahnede max ${slotLimits.maxSpeakers} kişi olabilir.`, type: 'warning' });
        return;
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
      showToast({ title: isHost ? '👑 Sahneye Döndün!' : 'Sahneye Hoş Geldin!', message: 'Mikrofon ve kameranı açabilirsin', type: 'success' });
      setShowSeatTooltip(false);
    } catch (e: any) {
      showToast({ title: 'Sahne Dolu', message: e?.message || 'Sahneye çıkılamadı', type: 'warning' });
    }
  }, [room, firebaseUser?.uid, speakingMode, myMicRequested, profile?.display_name, participants, ownerTier]);

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
        // ★ BUG FIX: rejoinAsOwner — sahne dolu olsa bile owner her zaman çıkabilir
        await RoomService.rejoinAsOwner(room.id, firebaseUser.uid);
        modChannelRef.current?.send({ type: 'broadcast', event: 'mod_action', payload: { action: 'owner_rejoin', targetUserId: firebaseUser.uid } });
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
  }, [room, firebaseUser?.uid, participants, lk, ownerTier]);


  const hostAvatarUri = hostUser?.user?.avatar_url
    ? { uri: hostUser.user.avatar_url }
    : getAvatarSource(room?.host_id?.includes('female') ? 'avatar_f_1.png' : 'avatar_m_2.png');


  // ★ ARCH-1: handleSendDm artık useRoomDM hook'undan geliyor

  // ★ Oda bağlantısını paylaş
  const handleShareRoom = useCallback(async () => {
    try {
      await Share.share({
        message: `🎤 "${room?.name || 'Oda'}" odasına gel! SopranoChat'te konuşalım:\nhttps://sopranochat.com/room/${id}`,
        title: room?.name || 'SopranoChat Odası',
      });
    } catch (e) {
      showToast({ title: 'Paylaşılamadı', message: 'Link kopyalanamadı', type: 'error' });
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

  // ★ Boost Satın Alma — Host için keşfette öne çıkarma
  const handleBoostRoom = useCallback(() => {
    if (!room || !firebaseUser?.uid) return;
    setAlertConfig({
      visible: true, title: '🚀 Keşfette Öne Çıkar', message: 'Odanı keşfet sayfasında üst sıralara çıkar!\n\n⭐ 1 Saat = 50 SP\n⭐ 6 Saat = 200 SP', type: 'info', icon: 'rocket',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        { text: '1 Saat (50 SP)', onPress: async () => {
          try {
            const result = await GamificationService.purchaseRoomBoost(firebaseUser.uid, 1);
            if (!result.success) { showToast({ title: 'Yetersiz SP', message: result.error || 'SP bakiyeniz yeterli değil.', type: 'warning' }); return; }
            await RoomService.activateBoost(room.id, firebaseUser.uid, 1);
            showToast({ title: '🚀 Boost Aktif!', message: '1 saat boyunca keşfette öne çıkacaksın!', type: 'success' });
          } catch (e: any) { showToast({ title: 'Hata', message: e.message || 'Boost aktifleştirilemedi', type: 'error' }); }
        }},
        { text: '6 Saat (200 SP)', onPress: async () => {
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
        title: newState ? '❤️ Takip ediliyor' : '💔 Takipten çıkıldı',
        message: newState ? 'Oda güncellemelerinden haberdar olacaksın.' : 'Artık bu odanın bildirimlerini almayacaksın.',
        type: newState ? 'success' : 'info',
      });
    } catch {
      setIsFollowingRoom(!newState); // rollback
      setFollowerCount(prev => Math.max(0, prev + (newState ? -1 : 1)));
      showToast({ title: 'Hata', message: 'İşlem başarısız. Tekrar dene.', type: 'error' });
    }
  }, [room?.id, firebaseUser?.uid, isFollowingRoom, loadFollowerData]);

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
          followerCount={followerCount}
          roomRules={typeof (room?.room_settings as any)?.rules === 'string' ? (room?.room_settings as any).rules : Array.isArray((room?.room_settings as any)?.rules) ? (room?.room_settings as any).rules.join(' · ') : undefined}
          onBack={() => { if (amIHost) { setAlertConfig({ visible: true, title: 'Odadan Ayrıl', message: 'Ayrılmak istiyor musun?', type: 'warning', icon: 'exit-outline', buttons: [{ text: 'İptal', style: 'cancel' }, { text: 'Ayrıl', style: 'destructive', onPress: handleHostLeave }] }); } else { handleUserLeave(); } }}
          onMinimize={() => { isMinimizingRef.current = true; setMinimizedRoom({ id: id as string, name: room?.name || 'Oda', hostName: hostUser?.user?.display_name || 'Host', viewerCount, isMicOn: lk.isMicrophoneEnabled || false }); safeGoBack(router); }}
          onScenarios={() => router.push('/dev-preview')}
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

      {/* ★ SAHNE — ScrollView dışında sabit, konuşmacılar her zaman görünür (Clubhouse/Spaces pattern) */}
      <View style={{ maxHeight: H * 0.38, paddingTop: 8 }}>
        <SpeakerSection stageUsers={stageUsers} getMicStatus={getMicStatus}
          onSelectUser={(u) => setSelectedUser(u)}
          onSelfDemote={handleSelfDemote}
          currentUserId={firebaseUser?.uid} VideoView={LKVideoView}
          onGhostSeatPress={handleGhostSeatPress} showSeatTooltip={showSeatTooltip}
          avatarFlashes={avatarFlashes} onFlashDone={clearAvatarFlash}
          onCameraExpand={(u) => setCameraExpandUser(u)} />
      </View>

      {/* ★ SAHNE ↔ DİNLEYİCİ AYIRICI — 2026-04-20: Pill artık tıklanabilir,
          tek giriş noktası AudienceDrawer'a. */}
      {(listenerUsers.length > 0 || spectatorUsers.length > 0) && (
        <View style={{ paddingVertical: 6, paddingHorizontal: 16 }}>
          <LinearGradient
            colors={['transparent', 'rgba(20,184,166,0.15)', 'transparent']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={{ height: 1 }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
            <Pressable onPress={() => openOverlay(() => setShowAudienceDrawer(true))} hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(20,184,166,0.08)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(20,184,166,0.2)' }}>
              <Ionicons name="headset-outline" size={11} color="rgba(20,184,166,0.7)" />
              <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(20,184,166,0.7)', letterSpacing: 0.3 }}>
                {listenerUsers.length + spectatorUsers.length} Dinleyici
              </Text>
              <Ionicons name="chevron-forward" size={11} color="rgba(20,184,166,0.6)" />
            </Pressable>
          </View>
        </View>
      )}

      {/* ★ 2026-04-20: Oda içinde SCROLL YOK. Listener flex:1 overflow:hidden.
          InlineChat ABSOLUTE overlay — control bar'ın hemen üstünde, semi-transparent,
          avatarlar arkasında hafifçe görünür (Yalla/IMO pattern). */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <ListenerGrid listeners={listenerUsers} onSelectUser={(u) => setSelectedUser(u)} selectedUserId={selectedUser?.user_id} onShowAllUsers={() => openOverlay(() => setShowAudienceDrawer(true))} maxListeners={getRoomLimits(ownerTier as any).maxListeners} spectatorCount={spectatorUsers.length} roomOwnerId={room?.host_id}
          avatarFlashes={avatarFlashes} onFlashDone={clearAvatarFlash} micRequestUserIds={micRequests} />
      </View>

      {/* ★ InlineChat — absolute overlay, control bar'ın hemen üstünde */}
      {!showChatDrawer && !showDmPanel && !showPlusMenu && !showAccessPanel && !showRoomStats && chatMessages.length > 0 && (
        <Pressable onPress={() => openOverlay(() => setShowChatDrawer(true))}
          style={{ position: 'absolute', left: 4, right: 4, bottom: Math.max(insets.bottom, 14) + 76 }}>
          <View style={{ borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(10,16,28,0.55)', borderWidth: 0.5, borderColor: 'rgba(20,184,166,0.1)', paddingVertical: 6 }}>
            <InlineChat messages={chatMessages as any[]} maxLines={5} />
          </View>
        </Pressable>
      )}

      {!!entryEffectName && <PremiumEntryBanner name={entryEffectName} onDone={() => setEntryEffectName(null)} />}
      <SPToast ref={spToastRef} />
      <ModerationOverlay ref={penaltyRef} />
      {/* ★ Emoji Drawer — alt barın arkasından yukarı kayarak açılır, aşağı sürükleyerek kapanır */}
      <EmojiDrawer
        visible={showEmojiBar}
        onClose={() => setShowEmojiBar(false)}
        onReaction={(emoji: string) => {
          // ★ Broadcast her zaman gönderilir (333ms rate limit zaten var)
          sendEmojiReaction(emoji);
          // ★ SEC-FLOOD FIX: DB yazma throttle — emoji flood oda çökmesini önler
          // Broadcast yeterli feedback sağlar, DB yazma sadece aralıklı yapılır
          const now = Date.now();
          if (firebaseUser && now - _lastEmojiChatWriteRef.current >= 600) {
            _lastEmojiChatWriteRef.current = now;
            RoomChatService.send(id as string, firebaseUser.uid, emoji).catch(() => {});
          }
        }}
        bottomInset={Math.max(insets.bottom, 14)}
      />

      {/* ★ Bağış Drawer — host'a SP bağışı */}
      {firebaseUser && room?.host_id && (
        <DonationDrawer
          visible={showDonationDrawer}
          onClose={() => setShowDonationDrawer(false)}
          senderId={firebaseUser.uid}
          hostId={room.host_id}
          hostName={hostUser?.user?.display_name || room?.host?.display_name || 'Host'}
          bottomInset={Math.max(insets.bottom, 14)}
          onSuccess={(amt: number) => {
            if (amt > 0) {
              // ★ Tüm odaya animasyonlu bağış bildirimi gönder (merkez animasyon yeterli — üst toast kaldırıldı)
              sendDonationAlert(
                profile?.display_name || firebaseUser?.displayName || 'Birisi',
                amt,
              );
            } else {
              showToast({ title: 'Yetersiz SP', message: 'Bağış için yeterli SP puanın yok.', type: 'error' });
            }
          }}
        />
      )}

      {/* ★ Floating Reactions — her zaman en üstte, emoji bar açıkken de görünür */}
      <FloatingReactionsView ref={floatingRef} />

      {/* ★ Bağış Animasyonu — tüm odaya görünür premium bildirim */}
      <DonationAlert ref={donationAlertRef} />

      {/* ★ 2026-04-20: Kamera fullscreen — speaker rozetine tap ile açılır */}
      <CameraFullscreenModal
        visible={!!cameraExpandUser}
        user={cameraExpandUser}
        videoTrack={cameraExpandUser ? getMicStatus(cameraExpandUser.user_id)?.videoTrack : null}
        VideoView={LKVideoView}
        isMe={cameraExpandUser?.user_id === firebaseUser?.uid}
        onClose={() => setCameraExpandUser(null)}
      />


      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: Math.max(insets.bottom, 14) + 2 }}>
        <LinearGradient colors={['transparent', 'rgba(5,10,20,0.85)', 'rgba(5,10,20,0.98)']} locations={[0, 0.35, 1]} style={[StyleSheet.absoluteFill, { top: -140 }]} pointerEvents="none" />
        <RoomControlBar isMicOn={lk.isMicrophoneEnabled || false} isCameraOn={lk.isCameraEnabled || false} isEmojiOpen={showEmojiBar}
          chatInput={chatInput} onChatInputChange={setChatInput} onChatSend={handleSendChat} chatInputRef={chatInputRef}
          showCamera={(amIHost || amIModerator || stageUsers.some(u => u.user_id === firebaseUser?.uid)) && getRoomLimits(((room as any)?.owner_tier || 'Free') as any).maxCameras > 0}
          isHandRaised={myMicRequested} handBadgeCount={micRequests.length} canModerate={canModerate}
          isForcedMuted={!amIHost && !!participants.find(p => p.user_id === firebaseUser?.uid)?.is_muted}
          isChatInputDisabled={!!participants.find(p => p.user_id === firebaseUser?.uid)?.is_chat_muted}
          isListener={!stageUsers.some(u => u.user_id === firebaseUser?.uid)}
          isOwnerInListenerMode={!stageUsers.some(u => u.user_id === firebaseUser?.uid) && amIHost}
          isModInListenerMode={!stageUsers.some(u => u.user_id === firebaseUser?.uid) && amIModerator}
          onJoinStagePress={handleOwnerModJoinStage}
          isRoomMuted={roomMuted}
          chatBadgeCount={0} isChatOpen={showChatDrawer}
          dmBadgeCount={dmUnreadCount} isDmOpen={showDmPanel} isPlusOpen={showPlusMenu} onDmPress={() => { if (showDmPanel) setShowDmPanel(false); else openOverlay(() => toggleDmPanel()); }}
          onMicPress={handleMicPress}
          onMuteRoomPress={handleRoomMuteToggle}
          onCameraPress={() => {
            // ★ T-2 FIX: Merkezi ownerTier kullan
            const _tLimits = getRoomLimits(ownerTier as any);
            if (_tLimits.maxCameras === 0) {
              UpsellService.onCameraLimit(ownerTier as any);
              showToast({ title: 'Kamera Kapalı', message: 'Bu tier\'da kamera kullanılamıyor. Üyeliği yükselt!', type: 'warning' });
              return;
            }
            // BUG-RM21 FIX: lk.participants zaten local'i içeriyor, çift sayma
            const activeCams = lk.participants.filter((p: any) => p.isCameraEnabled).length;
            if (!lk.isCameraEnabled && activeCams >= _tLimits.maxCameras) {
              UpsellService.onCameraLimit(ownerTier as any);
              showToast({ title: 'Kamera Limiti', message: 'Maksimum ' + _tLimits.maxCameras + ' kamera açılabilir.', type: 'warning' });
              return;
            }
            try { lk.toggleCamera?.(); } catch {}
          }} onEmojiPress={() => { if (showEmojiBar) setShowEmojiBar(false); else openOverlay(() => setShowEmojiBar(true)); }}
          onHandPress={handleMicRequest} onChatPress={() => { if (showChatDrawer) setShowChatDrawer(false); else openOverlay(() => setShowChatDrawer(true)); }} onPlusPress={() => openOverlay(() => setShowPlusMenu(true))}
          onLeavePress={() => {
            setAlertConfig({
              visible: true, title: 'Odadan Ayrıl', message: 'Odadan ayrılmak istediğinize emin misiniz?', type: 'warning', icon: 'exit-outline',
              buttons: [{ text: 'İptal', style: 'cancel' }, { text: 'Ayrıl', onPress: () => { isRoomClosingRef.current = true; if (amIHost) { handleHostLeave(); } else { handleUserLeave(); } }, style: 'destructive' }],
            });
          }} />
      </View>

      <RoomChatDrawer visible={showChatDrawer} messages={chatMessages as any[]} chatInput={chatInput}
        onChangeInput={setChatInput} onSend={handleSendChat} onClose={() => setShowChatDrawer(false)} bottomInset={insets.bottom} />

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
        onClose={() => setShowAudienceDrawer(false)} onSelectUser={(u) => setSelectedUser(u as any)} />

      {!!selectedUser && (() => {
        // ★ O5 FIX: ProfileCard açıkken participants listesi güncellendiğinde (ban/mute/role
        // change/çıkış vb.) stale `selectedUser` snapshot'ı yerine taze veriyi kullan.
        // Kullanıcı artık odada değilse kartı otomatik kapat.
        const _liveUser = participants.find(p => p.user_id === selectedUser.user_id);
        if (!_liveUser) {
          // Render sırasında setState çağırma → microtask ile
          Promise.resolve().then(() => setSelectedUser(null));
          return null;
        }
        const _selectedUser = { ...selectedUser, ..._liveUser };
        // ★ BUG-1/2/3 FIX: Merkezi yetki motoru entegrasyonu
        const _myRole = myCurrentRole as ParticipantRole;
        const _targetRole = _selectedUser.role as ParticipantRole;
        // ★ T-2 FIX: Merkezi ownerTier kullan (migrateLegacyTier uygulanmış)
        const _ownerTierPerm = ownerTier as SubscriptionTier;
        const _isSelf = selectedUser.user_id === firebaseUser?.uid;
        const _notSelf = !_isSelf;
        // ★ Rol hiyerarşi kontrolü: aktör hedeften yüksek mi?
        const _canActOn = (ROLE_LEVEL[_myRole] ?? 0) > (ROLE_LEVEL[_targetRole] ?? 0);
        // ★ Tier kontrolü yardımcı fonksiyonu
        const _hasTier = (minTier: SubscriptionTier) => isTierAtLeast(_ownerTierPerm, minTier);
        // ★ Permission check helper — T-1 FIX: _isFreeOwner çift kilit kaldırıldı, _perm() zaten tier kontrolü içeriyor
        const _perm = (p: string) => checkPermission(_myRole, _targetRole, p as any, _ownerTierPerm, _isSelf).allowed;

        // ★ HOST-FIX: Oda sahibi sahneden inse bile rolü her zaman 'owner' görünsün
        const displayRole = _selectedUser.user_id === room?.host_id ? 'owner' : _selectedUser.role;

        return (
        <ProfileCard nick={(_selectedUser as any)?.disguise?.display_name || _selectedUser.user?.display_name || 'Gizli'} role={displayRole} avatarUrl={(_selectedUser as any)?.disguise?.avatar_url || _selectedUser.user?.avatar_url}
          isOwnProfile={_isSelf} isChatMuted={_selectedUser.is_chat_muted || false}
          isMuted={_selectedUser.is_muted || false} mutedUntil={_selectedUser.muted_until || null}
          onClose={() => setSelectedUser(null)}
          onViewProfile={() => { setSelectedUser(null); router.push(`/user/${selectedUser.user_id}` as any); }}
          isFriend={userFollowStatus[selectedUser.user_id] === 'accepted'}
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
          onDM={() => {
            setDmInitialTarget({
              userId: selectedUser.user_id,
              name: selectedUser.user?.display_name || 'Kullanıcı',
              avatar: selectedUser.user?.avatar_url,
            });
            setShowDmPanel(true);
            setSelectedUser(null);
          }}
          onPromoteToStage={_perm('promote_speaker') && _selectedUser.role === 'listener' && _notSelf ? () => handlePromoteToStage(_selectedUser.user_id, _selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onRemoveFromStage={_perm('demote_speaker') && (_selectedUser.role === 'speaker') && _notSelf ? async () => { try { await RoomService.demoteSpeaker(id as string, _selectedUser.user_id); modChannelRef.current?.send({ type: 'broadcast', event: 'mod_action', payload: { action: 'demote', targetUserId: _selectedUser.user_id } }); setParticipants(prev => prev.map(p => p.user_id === _selectedUser.user_id ? { ...p, role: 'listener' as const } : p)); setSelectedUser(null); } catch {} } : undefined}
          onMute={_perm('timed_mute') && _notSelf && !_selectedUser.is_muted && ['speaker', 'moderator', 'owner'].includes(_selectedUser.role) ? () => handleTimedMuteUser(_selectedUser.user_id, _selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onUnmute={_canActOn && _notSelf && _selectedUser.is_muted && ['speaker', 'moderator', 'owner'].includes(_selectedUser.role) ? () => executeUnmute(_selectedUser.user_id, _selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onChatMute={_perm('chat_block') && _notSelf ? () => handleToggleChatMute(_selectedUser.user_id, _selectedUser.user?.display_name || 'Kullanıcı', _selectedUser.is_chat_muted || false) : undefined}
          onKick={_perm('kick') && _notSelf ? () => handleKickUser(_selectedUser.user_id, _selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onMakeModerator={_perm('set_moderator') && _notSelf && _selectedUser.role !== 'owner' ? () => handleToggleModerator(_selectedUser.user_id, _selectedUser.user?.display_name || 'Kullanıcı', _selectedUser.role) : undefined}
          onReport={_notSelf ? () => handleReportUser(_selectedUser.user_id, _selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onBlock={_notSelf ? () => handleBlockUser(_selectedUser.user_id, _selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onGhostMode={_perm('ghost_mode') && _isSelf ? handleGhostToggle : undefined}
          isGhost={(_selectedUser as any)?.is_ghost || false}
          onDisguise={_perm('disguise_user') && _notSelf ? () => handleDisguiseUser(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onBanTemp={_perm('ban_temporary') && _notSelf ? () => handleTempBan(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onBanPerm={_perm('ban_permanent') && _notSelf ? () => handlePermBan(selectedUser.user_id, selectedUser.user?.display_name || 'Kullanıcı') : undefined}
          onPersonalMute={_notSelf ? () => {
            const userId = selectedUser.user_id;
            setPersonallyMutedUsers(prev => {
              const next = new Set(prev);
              const willMute = !next.has(userId);
              if (willMute) next.add(userId); else next.delete(userId);
              // ★ T-4 FIX: LiveKit remote track volume kontrolü — kişisel sessize alma
              try {
                const activeRoom = liveKitService.currentRoom;
                if (activeRoom?.remoteParticipants) {
                  const participant = activeRoom.remoteParticipants.get(userId);
                  if (participant) {
                    for (const [, pub] of participant.audioTrackPublications) {
                      if (pub.track) {
                        if (typeof (pub.track as any).setVolume === 'function') {
                          (pub.track as any).setVolume(willMute ? 0 : 1);
                        }
                        if (pub.track.mediaStreamTrack) {
                          pub.track.mediaStreamTrack.enabled = !willMute;
                        }
                      }
                    }
                  }
                }
              } catch {}
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
                    // ★ K6: Idempotency kök (spend/earn/refund bu kök'ü paylaşır — çift tıklama / retry güvenli)
                    const tipId = `${firebaseUser!.uid}:${selectedUser.user_id}:${amt}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
                    const result = await GamificationService.spend(firebaseUser!.uid, amt, 'tip', `tip_spend:${tipId}`);
                    if (!result.success) { showToast({ title: 'Yetersiz SP', message: result.error || '', type: 'error' }); return; }
                    if (result.duplicate) { setSelectedUser(null); return; }
                    try {
                      await GamificationService.earn(selectedUser.user_id, amt, 'tip_received', `tip_recv:${tipId}`);
                    } catch {
                      await GamificationService.earn(firebaseUser!.uid, amt, 'tip_refund', `tip_refund:${tipId}`);
                      showToast({ title: '⚠️ Bağış İade Edildi', message: 'Alıcıya ulaşılamadı, SP iade edildi.', type: 'error' });
                      return;
                    }
                    showToast({ title: `❤️ ${amt} SP Gönderildi!`, message: `${selectedUser.user?.display_name} bağışınız için teşekkürler`, type: 'success' });
                    spToastRef.current?.show(-amt, 'Bağış');
                    // ★ Tüm odaya animasyonlu bağış bildirimi
                    sendDonationAlert(
                      profile?.display_name || firebaseUser?.displayName || 'Birisi',
                      amt,
                    );
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



      {/* ★ 2026-04-18: RoomSettingsSheet kaldırıldı. Cihaz ayarları artık PlusMenu
           "Konuşma & Ses" accordion'u içinde inline. Ayrı modal açılmıyor. */}

      <PremiumAlert visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} buttons={alertConfig.buttons} icon={alertConfig.icon} onDismiss={() => setAlertConfig(prev => ({ ...prev, visible: false }))} />



      <PlusMenu visible={showPlusMenu} onClose={() => setShowPlusMenu(false)} bottomInset={Math.max(insets.bottom, 14)}
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
        onModeration={() => openOverlay(() => setShowAccessPanel(true))}
        onReportRoom={() => { closeAllOverlays();
          if (!firebaseUser?.uid || !room?.id) return;
          (async () => {
            try {
              // ★ D2 FIX: ModerationService kullan — rate limit + admin bildirimi dahil
              await ModerationService.reportRoom(firebaseUser.uid, room.id, 'inappropriate_content', 'Oda içeriği uygunsuz');
              showToast({ title: '🚩 Bildirildi', message: 'Bu oda incelenmek üzere bildirildi', type: 'info' });
            } catch (e: any) {
              if (e?.message?.includes('fazla')) {
                showToast({ title: '⏳ Limit', message: e.message, type: 'warning' });
              } else {
                showToast({ title: '🚩 Bildirildi', message: 'Bu oda incelenmek üzere bildirildi', type: 'info' });
              }
            }
          })();
        }}
        micRequestCount={micRequests.length}
        userRole={myCurrentRole}
        ownerTier={ownerTier}
        onMuteAll={handleMuteAll}
        onUnmuteAll={handleUnmuteAll}
        onRoomStats={() => openOverlay(() => setShowRoomStats(true))}
        onDeleteRoom={() => { closeAllOverlays(); handleDeleteRoom(); }}
        onBoostRoom={() => { closeAllOverlays(); handleBoostRoom(); }}
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
              showToast({ title: newLocked ? '🔒 Oda Kilitlendi' : '🔓 Kilit Açıldı', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          })();
        } : undefined}
        settingsConfig={amIHost ? {
          speakingMode,
          onSpeakingModeChange: async (mode) => {
            if (mode === 'selected_only' && !isTierAtLeast(ownerTier as any, 'Pro')) {
              showToast({ title: '👑 Pro Gerekli', message: 'Seçilmişler modu Pro abonelik gerektirir.', type: 'warning' });
              return;
            }
            setSpeakingMode(mode as any);
            if (room) {
              try {
                await RoomService.updateSettings(room.id, firebaseUser!.uid, { room_settings: { speaking_mode: mode as any } });
                setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), speaking_mode: mode as any } } as any : prev);
                modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { speaking_mode: mode } } });
                const labels: Record<string, string> = { free_for_all: 'Serbest Mod', permission_only: 'İzinli Mod', selected_only: 'Seçilmişler Modu' };
                showToast({ title: labels[mode] || 'Mod', type: 'success' });
              } catch { showToast({ title: 'Hata', type: 'error' }); }
            }
          },
          slowModeSeconds: (room?.room_settings as any)?.slow_mode_seconds || 0,
          onSlowModeChange: async (seconds) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { slow_mode_seconds: seconds } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), slow_mode_seconds: seconds } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { slow_mode_seconds: seconds } } });
              showToast({ title: seconds ? `Slow Mode: ${seconds}sn` : 'Slow Mode Kapalı', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          ageRestricted: (room?.room_settings as any)?.age_restricted || false,
          onAgeRestrictedChange: async (enabled) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { age_restricted: enabled } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), age_restricted: enabled } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { age_restricted: enabled } } });
              showToast({ title: enabled ? '🔞 +18 Aktif' : '👥 Yaş Sınırı Kaldırıldı', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          followersOnly: (room?.room_settings as any)?.followers_only || false,
          onToggleFollowersOnly: async (enabled) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { followers_only: enabled } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), followers_only: enabled } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { followers_only: enabled } } });
              showToast({ title: enabled ? 'Arkadaşlara Özel' : 'Herkese Açık', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          donationsEnabled: (room?.room_settings as any)?.donations_enabled || false,
          onDonationsToggle: async (enabled) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { donations_enabled: enabled } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), donations_enabled: enabled } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { donations_enabled: enabled } } });
              showToast({ title: enabled ? 'Bağış Açıldı' : 'Bağış Kapatıldı', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          roomLanguage: (room?.room_settings as any)?.room_language || 'tr',
          onLanguageChange: async (lang) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { room_language: lang as any } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), room_language: lang as any } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { room_language: lang } } });
              const names: Record<string,string> = { tr: 'Türkçe', en: 'English', de: 'Deutsch', ar: 'العربية' };
              showToast({ title: `🌐 ${names[lang] || lang}`, type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          // ★ Oda Adı
          roomName: room?.name || '',
          onRenameRoom: async (name) => {
            if (!room || !firebaseUser || !name) return;
            try {
              await ModerationService.editRoomName(room.id, name);
              setRoom(prev => prev ? { ...prev, name } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { name } });
              showToast({ title: '✏️ Oda Adı Güncellendi', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          // ★ Hoş Geldin Mesajı
          welcomeMessage: (room?.room_settings as any)?.welcome_message || '',
          onWelcomeMessageChange: async (msg) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { welcome_message: msg } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), welcome_message: msg } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { welcome_message: msg } } });
              showToast({ title: '💬 Hoş Geldin Mesajı Güncellendi', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          // ★ Kurallar
          roomRules: typeof (room?.room_settings as any)?.rules === 'string' ? (room?.room_settings as any).rules : Array.isArray((room?.room_settings as any)?.rules) ? (room?.room_settings as any).rules.join('\n') : '',
          onRulesChange: async (rulesText) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { rules: rulesText } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), rules: rulesText } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { rules: rulesText } } });
              showToast({ title: '📋 Kurallar Güncellendi', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          // ★ Oda Tipi
          roomType: room?.type || 'open',
          onRoomTypeChange: async (type) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { type: type as any });
              setRoom(prev => prev ? { ...prev, type } as any : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { type } });
              const labels: Record<string,string> = { open: 'Herkese Açık', closed: 'Şifreli', invite: 'Davetli' };
              showToast({ title: `🔒 ${labels[type] || type}`, type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          // ★ Şifre (Oda Tipi = closed olduğunda)
          roomPassword: (room?.room_settings as any)?.room_password || '',
          onPasswordChange: async (pw) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { room_password: pw } as any });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), room_password: pw } } as any : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { room_password: pw } } });
              showToast({ title: pw ? '🔐 Şifre Ayarlandı' : '🔓 Şifre Kaldırıldı', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          // ★ Tema
          themeId: (room as any)?.theme_id || null,
          onThemeChange: async (themeId) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { theme_id: themeId });
              setRoom(prev => prev ? { ...prev, theme_id: themeId } as any : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { theme_id: themeId } });
              showToast({ title: '🎨 Tema Güncellendi', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          // ★ Odayı Dondur
          onFreezeRoom: isTierAtLeast(ownerTier as any, 'Plus') ? () => {
            setAlertConfig({
              visible: true, title: '❄️ Odayı Dondur',
              message: 'Oda dondurulacak. Tüm katılımcılar çıkarılacak. Daha sonra "Odalarım" sekmesinden tekrar aktifleştirebilirsin.',
              type: 'warning', icon: 'snow-outline',
              buttons: [
                { text: 'İptal', style: 'cancel' },
                { text: 'Dondur', style: 'destructive', onPress: async () => {
                  if (!room || !firebaseUser) return;
                  try {
                    modChannelRef.current?.send({ type: 'broadcast', event: 'mod_action', payload: { action: 'room_frozen', hostName: firebaseUser.displayName || 'Oda Sahibi' } });
                    isRoomClosingRef.current = true;
                    await RoomService.freezeRoom(room.id, firebaseUser.uid);
                    liveKitService.disconnect().catch(() => {});
                    setMinimizedRoom(null);
                    showToast({ title: '❄️ Oda Donduruldu', message: 'Odalarım sekmesinden tekrar aktifleştirebilirsin.', type: 'success' });
                    safeGoBack(router);
                  } catch (err: any) { showToast({ title: 'Hata', message: err.message || 'Oda dondurulamadı', type: 'error' }); }
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
              showToast({ title: fee ? `💰 Giriş: ${fee} SP` : '🆓 Giriş Ücretsiz', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          // ★ Müzik
          musicTrack: room?.room_settings?.music_track || null,
          onMusicTrackChange: async (track) => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { music_track: track } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), music_track: track } } : prev);
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { music_track: track } } });
              showToast({ title: track ? `🎵 ${track.charAt(0).toUpperCase() + track.slice(1)}` : '🔇 Müzik Kapalı', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          // ★ Arka Plan Resmi
          backgroundImage: room?.room_image_url || room?.room_settings?.room_image_url || null,
          onPickBackgroundImage: async () => {
            if (!room || !firebaseUser) return;
            try {
              const ImagePicker = require('expo-image-picker');
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) { showToast({ title: 'İzin Gerekli', type: 'warning' }); return; }
              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.7 });
              if (result.canceled) return;
              const { StorageService } = require('../../services/storage');
              const fileName = `room_bg/${room.id}_${Date.now()}.jpg`;
              const url = await StorageService.uploadFile('post-images', fileName, result.assets[0].uri);
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { room_image_url: url } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), room_image_url: url } } as any : prev);
              // ★ 2026-04-19: Broadcast — diğer client'lara arka plan değişimini yay
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { room_image_url: url } } });
              showToast({ title: '🖼 Arka Plan Güncellendi', type: 'success' });
            } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
          },
          onRemoveBackgroundImage: async () => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { room_image_url: null } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), room_image_url: null } } as any : prev);
              // ★ 2026-04-19: Broadcast — diğer client'lara kaldırıldığını yay
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { room_image_url: null } } });
              showToast({ title: 'Arka Plan Kaldırıldı', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
          // ★ Kapak Görseli
          coverImage: room?.room_settings?.cover_image_url || null,
          onPickCoverImage: async () => {
            if (!room || !firebaseUser) return;
            try {
              const ImagePicker = require('expo-image-picker');
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) { showToast({ title: 'İzin Gerekli', type: 'warning' }); return; }
              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.7 });
              if (result.canceled) return;
              const { StorageService } = require('../../services/storage');
              const fileName = `room_cover/${room.id}_${Date.now()}.jpg`;
              const url = await StorageService.uploadFile('post-images', fileName, result.assets[0].uri);
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { cover_image_url: url } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), cover_image_url: url } } as any : prev);
              // ★ 2026-04-19: Broadcast — diğer client'lara kapak görseli güncellemesini yay
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { cover_image_url: url } } });
              showToast({ title: '🖼 Kapak Görseli Güncellendi', type: 'success' });
            } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
          },
          onRemoveCoverImage: async () => {
            if (!room || !firebaseUser) return;
            try {
              await RoomService.updateSettings(room.id, firebaseUser.uid, { room_settings: { cover_image_url: null } });
              setRoom(prev => prev ? { ...prev, room_settings: { ...(prev.room_settings || {}), cover_image_url: null } } as any : prev);
              // ★ 2026-04-19: Broadcast — diğer client'lara kaldırıldığını yay
              modChannelRef.current?.send({ type: 'broadcast', event: 'settings_changed', payload: { room_settings: { cover_image_url: null } } });
              showToast({ title: 'Kapak Görseli Kaldırıldı', type: 'success' });
            } catch { showToast({ title: 'Hata', type: 'error' }); }
          },
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
          bottomInset={Math.max(insets.bottom, 14)}
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
              globalToast({ title: '📨 Davet Gönderildi', message: `${successCount} kişiye davet gönderildi`, type: 'success' });
            }
            setShowInviteFriends(false);
          }}
        />
      )}

      {/* 🛡️ Access Gate — erişim onaylanmadan oda içeriği (speaker grid, chat, katılımcılar) gizli */}
      <AccessGate
        visible={accessGranted !== true}
        roomName={room?.name || pendingRoomData?.room?.name}
        hostName={room?.host?.display_name}
        hostAvatarUrl={room?.host?.avatar_url || pendingRoomData?.room?.host?.avatar_url}
        onCancel={() => safeGoBack(router)}
      />

      {/* 🔒 Şifreli Oda — aşağıdan yukarı bottom sheet */}
      <PasswordPromptSheet
        visible={showPasswordModal}
        roomName={pendingRoomData?.room?.name || room?.name}
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
              // ★ Access granted join DB insert başarısından SONRA (LiveKit token için participant row gerek)
              RoomService.join(id as string, firebaseUser.uid, joinRole).then(() => {
                setAccessGranted(true);
                showToast({ title: '🎧 Odaya Katıldın!', message: 'Şifre doğrulandı — hoş geldin!', type: 'success' });
              }).catch((err: any) => {
                const msg = err?.message || 'Odaya katılınamadı.';
                setAlertConfig({
                  visible: true,
                  title: msg.includes('yasaklan') ? '⛔ Erişim Engellendi' : '⚠️ Giriş Hatası',
                  message: msg, type: 'error',
                  icon: msg.includes('yasaklan') ? 'ban' : 'alert-circle',
                  buttons: [{ text: 'Geri Dön', onPress: () => safeGoBack(router) }],
                });
              });
              setPendingRoomData(null);
            } else {
              setPasswordError(result.reason || 'Yanlış şifre.');
            }
          } catch {
            setPasswordError('Bir hata oluştu. Tekrar deneyin.');
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
              showToast({ title: '🎧 Odaya Katıldın!', message: 'İsteğin onaylandı — hoş geldin!', type: 'success' });
            }).catch(() => {
              showToast({ title: 'Giriş Hatası', type: 'error' });
              safeGoBack(router);
            });
            setPendingRoomData(null);
          })();
        }}
        onRejected={(reason) => {
          setShowAccessRequest(false);
          setPendingRoomData(null);
          showToast({ title: '❌ Reddedildi', message: reason || 'İstek reddedildi', type: 'warning' });
          safeGoBack(router);
        }}
        onCancelled={() => {
          setShowAccessRequest(false);
          setPendingRoomData(null);
          safeGoBack(router);
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
    </Animated.View>
  );
}
const sty = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1520' },
});
