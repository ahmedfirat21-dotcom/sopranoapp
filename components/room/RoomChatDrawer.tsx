/**
 * SopranoChat — Room Chat Drawer
 * ★ 2026-04-23 REDESIGN: Control bar'ın parçası gibi yükselen bottom-sheet sohbet paneli.
 *   - 3 snap point: CLOSED (bar altında) → HALF (ekranın %50'si) → FULL (ekranın ~%90'ı)
 *   - Control bar hep sabit altta kalır — chat sheet onun ÜSTÜNDEN yükselir.
 *   - Input bar sheet'in alt kenarında, control bar'ın hemen üstünde.
 *   - Sürükle-bırak ile istenen pozisyona sabitlenir.
 *   - Apple Maps / Google Maps sheet pattern'ı.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, Pressable, TextInput,
  FlatList, Image, Platform, PanResponder, useWindowDimensions, Keyboard, Dimensions, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAvatarSource } from '../../constants/avatars';
import { EmojiReactionBar } from '../EmojiReactions';
import { RoomChatService } from '../../services/roomChat';

// Snap points — CONTROL_BAR_AREA: bar + padding alanı (insets.bottom hariç).
// RoomControlBar: BAR_H=50 + üstündeki wrapper paddingBottom(8) = 58.
// insets.bottom ayrıca eklenir → sheet tam kontrol barın üstüne oturur.
// ════════════════════════════════════════════════════════════
const CONTROL_BAR_AREA = 58;
const HANDLE_H = 28;         // drag handle alanı

interface ChatMsg {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles?: { display_name: string; avatar_url?: string; subscription_tier?: string };
  isSystem?: boolean;
  role?: string;
}

const ROLE_NAME_COLORS: Record<string, string> = {
  owner: '#D4AF37', host: '#D4AF37',
  moderator: '#A78BFA', admin: '#EF4444',
};
const TIER_NAME_COLORS: Record<string, string> = {
  Pro: '#FBBF24', Plus: '#14B8A6',
};
const HASH_COLORS = ['#38BDF8', '#FB923C', '#A78BFA', '#34D399', '#F472B6', '#FBBF24', '#818CF8', '#22D3EE', '#F87171', '#4ADE80'];
function getUserColor(userId: string, role?: string, tier?: string): string {
  if (role && ROLE_NAME_COLORS[role]) return ROLE_NAME_COLORS[role];
  if (tier && TIER_NAME_COLORS[tier]) return TIER_NAME_COLORS[tier];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = ((hash << 5) - hash) + userId.charCodeAt(i);
  return HASH_COLORS[Math.abs(hash) % HASH_COLORS.length];
}

// ★ v92.14 (1 May 2026): Mesaj Parlat power-up — Android-uyumlu gradient glow.
//   - LinearGradient bg (parlaktan koyuya, top-down).
//   - 3 katmanlı border (outer dark amber → mid gold → inner bright ivory) = sahte gradient outline.
//   - Breath pulse opacity → "canlı parlama" hissi. Shadow YOK (Android'de glow render etmiyor).
function GlowMessageOverlay() {
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(breath, { toValue: 0, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breath]);
  return (
    <>
      {/* Bg gradient — parlak ivory üst → koyu amber alt; ışıkla yıkanmış balon */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, {
          borderRadius: 14,
          overflow: 'hidden',
          opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.92] }),
        }]}
      >
        <LinearGradient
          colors={['rgba(255,241,168,0.42)', 'rgba(255,215,0,0.22)', 'rgba(180,83,9,0.06)']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      {/* Outer ring — koyu amber (gradient'in koyu kenarı) */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, {
        borderRadius: 14, borderWidth: 1.8, borderColor: '#B45309',
      }]} />
      {/* Mid ring — gold */}
      <View pointerEvents="none" style={{
        position: 'absolute', top: 1.4, left: 1.4, right: 1.4, bottom: 1.4,
        borderRadius: 12.6, borderWidth: 1.1, borderColor: '#FFD700',
      }} />
      {/* Inner bright ring — breath ile parlaklık nefes alır */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', top: 2.6, left: 2.6, right: 2.6, bottom: 2.6,
        borderRadius: 11.4, borderWidth: 0.8, borderColor: '#FFF1A8',
        opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
      }} />
    </>
  );
}

interface Props {
  visible: boolean;
  messages: ChatMsg[];
  chatInput: string;
  onChangeInput: (t: string) => void;
  onSend: () => void;
  onClose: () => void;
  bottomInset: number;
  onSendRaw?: (content: string) => void;
  /** ★ v56: reaksiyon için çağıran kullanıcının Firebase UID'si */
  currentUserId?: string;
  /** Oda id — reaction realtime kanalı için */
  roomId?: string;
  /** ★ 2026-04-26: Mesaj balonundaki avatar/isim tıklanınca profil sheet aç (parent yönlendirir). */
  onAvatarPress?: (userId: string) => void;
}

export default function RoomChatDrawer({
  visible, messages, chatInput, onChangeInput, onSend, onClose, onSendRaw, currentUserId, roomId, onAvatarPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ════════════════════════════════════════════════════════════
  // Dynamic snap points — useWindowDimensions window boyutu değişince
  // (adjustResize ile klavye açılınca küçülür) snap'ler otomatik güncellenir.
  // ════════════════════════════════════════════════════════════
  const { height: windowH } = useWindowDimensions();
  // ★ 2026-04-24: Sheet bottom = control barın üst kenarıyla birebir hizalı.
  //   Eski formül +26px gap bırakıyordu (S9 vs. küçük-ekran modellerde belirgin).
  const bottomOffset = CONTROL_BAR_AREA + Math.max(insets.bottom, 14);
  const availableH = windowH - bottomOffset - Math.max(insets.top, 20);
  const SNAP_CLOSED = 0;
  const SNAP_HALF = Math.min(availableH * 0.55, windowH * 0.45);
  const SNAP_FULL = availableH;

  // ════════════════════════════════════════════════════════════
  // Input bar — bağımsız Keyboard-aware bottom konumlandırma
  // ════════════════════════════════════════════════════════════
  const INPUT_BAR_H = 54;
  const inputBottomAnim = useRef(new Animated.Value(bottomOffset)).current;
  const sheetBottomAnim = useRef(new Animated.Value(bottomOffset)).current;

  useEffect(() => {
    if (!visible) return;
    inputBottomAnim.setValue(bottomOffset);
    sheetBottomAnim.setValue(bottomOffset);
  }, [visible, bottomOffset]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      if (!visible) return;
      const screenH = Dimensions.get('screen').height;
      // ★ v86 FIX: Samsung Android'de e.endCoordinates.screenY yanlış değer döndürebilir
      //   (status bar / nav bar dahil/hariç tutarsızlığı). e.endCoordinates.height direkt
      //   klavye yüksekliğini verir — keyboard-controller pattern'iyle aynı.
      const kbHeight = e.endCoordinates.height || (screenH - e.endCoordinates.screenY);
      const kbTop = screenH - kbHeight;
      // Klavye üstü ile status bar arasındaki kullanılabilir alan
      const visibleArea = kbTop - Math.max(insets.top, 20) - INPUT_BAR_H;
      // Sheet yüksekliğini görünür alana sınırla (header kaybolmasın)
      if (currentSnap.current > visibleArea && visibleArea > 0) {
        currentSnap.current = visibleArea;
        Animated.timing(sheetHeight, {
          toValue: visibleArea,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
      // Input bar + Sheet birlikte yukarı kay
      Animated.parallel([
        Animated.timing(inputBottomAnim, {
          toValue: kbHeight,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(sheetBottomAnim, {
          toValue: kbHeight,
          duration: 250,
          useNativeDriver: false,
        }),
      ]).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.parallel([
        Animated.timing(inputBottomAnim, {
          toValue: bottomOffset,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(sheetBottomAnim, {
          toValue: bottomOffset,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    });

    return () => { showSub.remove(); hideSub.remove(); };
  }, [visible, bottomOffset]);

  // ════════════════════════════════════════════════════════════
  // Animated sheet height — 0 (closed) → SNAP_HALF → SNAP_FULL
  // ════════════════════════════════════════════════════════════
  const sheetHeight = useRef(new Animated.Value(0)).current;
  const currentSnap = useRef(0);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  // ★ Ref'ler — PanResponder stale closure bug'ını önler
  const snapPointsRef = useRef([SNAP_CLOSED, SNAP_HALF, SNAP_FULL]);
  const availableHRef = useRef(availableH);
  useEffect(() => {
    snapPointsRef.current = [SNAP_CLOSED, SNAP_HALF, SNAP_FULL];
    availableHRef.current = availableH;
  }, [SNAP_CLOSED, SNAP_HALF, SNAP_FULL, availableH]);

  const snapPoints = snapPointsRef.current;

  const animateTo = useCallback((targetHeight: number, velocity?: number) => {
    const capped = Math.min(targetHeight, availableHRef.current);
    currentSnap.current = capped;

    if (capped === 0) {
      // ★ KAPAMA — timing ile akıcı slide-down (spring overshoot yapmaz)
      isClosingRef.current = true;
      Animated.timing(sheetHeight, {
        toValue: 0,
        duration: 280,
        useNativeDriver: false,
      }).start(() => {
        isClosingRef.current = false;
      });
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
      onClose();
    } else {
      // ★ AÇMA / GENİŞLEME — spring ile bounce efekti
      const speed = velocity ? Math.min(Math.abs(velocity) * 0.5, 2) : 1;
      Animated.spring(sheetHeight, {
        toValue: capped,
        useNativeDriver: false,
        damping: 22,
        stiffness: 250 * speed,
        mass: 0.8,
      }).start();
      Animated.timing(backdropOpacity, {
        toValue: 0.4,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [onClose]);

  const animateToRef = useRef(animateTo);
  useEffect(() => { animateToRef.current = animateTo; }, [animateTo]);

  // ★ availableH değiştiğinde mevcut snap'i yeniden sınırla
  useEffect(() => {
    if (currentSnap.current > 0) {
      const capped = Math.min(currentSnap.current, availableH);
      currentSnap.current = capped;
      Animated.timing(sheetHeight, {
        toValue: capped,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [availableH]);

  // En yakın snap noktasını bul (★ ref-based, stale closure yok)
  const findNearestSnap = useCallback((height: number, velocity: number): number => {
    const pts = snapPointsRef.current;
    if (Math.abs(velocity) > 0.5) {
      if (velocity > 0) {
        const upper = pts.filter(s => s > currentSnap.current);
        return upper.length > 0 ? upper[0] : pts[pts.length - 1];
      } else {
        const lower = pts.filter(s => s < currentSnap.current).reverse();
        return lower.length > 0 ? lower[0] : 0;
      }
    }
    let closest = pts[0];
    let minDist = Math.abs(height - closest);
    for (const snap of pts) {
      const dist = Math.abs(height - snap);
      if (dist < minDist) {
        minDist = dist;
        closest = snap;
      }
    }
    return closest;
  }, []);

  // ════════════════════════════════════════════════════════════
  // PanResponder — sürükle
  // ════════════════════════════════════════════════════════════
  const dragStartHeight = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 8,
      onPanResponderGrant: () => {
        dragStartHeight.current = currentSnap.current;
      },
      onPanResponderMove: (_, gs) => {
        const maxH = availableHRef.current;
        const newHeight = Math.max(0, Math.min(maxH, dragStartHeight.current - gs.dy));
        sheetHeight.setValue(newHeight);
        backdropOpacity.setValue(newHeight > 0 ? 0.4 : 0);
      },
      onPanResponderRelease: (_, gs) => {
        const currentHeight = dragStartHeight.current - gs.dy;
        const nearest = findNearestSnap(currentHeight, -gs.vy);
        animateToRef.current(nearest, gs.vy);
      },
    })
  ).current;

  // ════════════════════════════════════════════════════════════
  // visible değiştiğinde animasyon
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      animateTo(SNAP_HALF);
    } else {
      // ★ Zaten kapanıyorsa (çevron/backdrop ile) ikinci animasyon başlatma
      if (isClosingRef.current) return;
      // Parent tarafından kapatıldı (control bar ikonu)
      currentSnap.current = 0;
      Animated.timing(sheetHeight, {
        toValue: 0,
        duration: 280,
        useNativeDriver: false,
      }).start();
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => { if (!visible) setShowEmojiPicker(false); }, [visible]);

  // ════════════════════════════════════════════════════════════
  // ★ v56: Mesaj reaksiyonları (❤️) — state, fetch, realtime sync
  // ════════════════════════════════════════════════════════════
  const [reactions, setReactions] = useState<Record<string, { count: number; liked: boolean }>>({});
  const reactionsRef = useRef(reactions);
  useEffect(() => { reactionsRef.current = reactions; }, [reactions]);

  // Açılışta / yeni mesaj geldiğinde toplu reaksiyon özeti çek
  const fetchedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!visible || !currentUserId) return;
    const newIds = messages.map(m => m.id).filter(id => id && !fetchedIdsRef.current.has(id));
    if (newIds.length === 0) return;
    newIds.forEach(id => fetchedIdsRef.current.add(id));
    let cancelled = false;
    RoomChatService.getReactions(newIds, currentUserId).then(map => {
      if (cancelled || !map) return;
      setReactions(prev => ({ ...prev, ...map }));
    });
    return () => { cancelled = true; };
  }, [visible, messages.length, currentUserId]);

  // Realtime sync — başkası beğenince refetch bu mesaj için
  useEffect(() => {
    if (!visible || !currentUserId || !roomId) return;
    const unsub = RoomChatService.subscribeReactions(roomId, async (messageId) => {
      const map = await RoomChatService.getReactions([messageId], currentUserId);
      if (map[messageId]) {
        setReactions(prev => ({ ...prev, [messageId]: map[messageId] }));
      } else {
        // count düştü 0 — kaldır
        setReactions(prev => { const n = { ...prev }; delete n[messageId]; return n; });
      }
    });
    return unsub;
  }, [visible, currentUserId, roomId]);

  // Tap-to-like (optimistic)
  const handleToggleReaction = useCallback(async (messageId: string) => {
    if (!currentUserId || !messageId) return;
    const prev = reactionsRef.current[messageId] || { count: 0, liked: false };
    const optimistic = { liked: !prev.liked, count: prev.count + (prev.liked ? -1 : 1) };
    setReactions(r => ({ ...r, [messageId]: optimistic }));
    const result = await RoomChatService.toggleReaction(messageId, currentUserId);
    if (result) {
      setReactions(r => ({ ...r, [messageId]: { count: result.count, liked: result.liked } }));
    } else {
      // rollback
      setReactions(r => ({ ...r, [messageId]: prev }));
    }
  }, [currentUserId]);

  // ════════════════════════════════════════════════════════════
  // Message render
  // ════════════════════════════════════════════════════════════
  const renderMessage = useCallback(({ item }: { item: ChatMsg }) => {
    if (!item) return null;
    // ★ v92.10 (1 May 2026): DB type='system' mesajları (bağış vs.) — '✨' prefix ile
    //   gelen donation mesajları altın çerçeveli, diğer sistem mesajları sade gri.
    const isSystemMsg = item.isSystem || (item as any).type === 'system';
    if (isSystemMsg) {
      const isDonation = (item.content || '').trimStart().startsWith('✨');
      if (isDonation) {
        return (
          <View style={st.donationSysMsg}>
            <Text style={st.donationSysMsgText}>{item.content}</Text>
          </View>
        );
      }
      return (
        <View style={st.sysMsg}>
          <Text style={st.sysMsgText}>{item.content}</Text>
        </View>
      );
    }
    const content = item.content || '';
    const gifMatch = content.match(/^\[gif:(.*)\]$/);
    // ★ v86 FIX: Tenor v2 URL'leri media1.tenor.com / media-cdn.tenor.com gibi
    //   subdomain'ler kullanıyor — eski regex sadece "media.tenor.com" matchliyor,
    //   diğerlerini text olarak gösteriyordu (GIF kayıp). Tüm tenor/giphy subdomain'leri kabul.
    const isGifSafe = !!gifMatch?.[1] && /^https:\/\/(?:[\w-]+\.)?(?:tenor|giphy)\.com\//i.test(gifMatch[1]);
    const emojiOnly = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}‍️⃣]{1,6}$/u.test(content) && content.length <= 14;
    const nameColor = getUserColor(item.user_id || '', item.role, item.profiles?.subscription_tier);
    const reaction = reactions[item.id];
    const isOwn = item.user_id === currentUserId;

    // ★ 2026-04-26 FIX: Mesaj objesinde gönderen alanı `sender_id` (DB) — ChatMsg type'ında `user_id` adıyla
    //   aliaslanıyordu ama bazı kayıtlarda yalnız `sender_id` geliyor. İkisini de OR ile al.
    const senderUid = (item as any).user_id || (item as any).sender_id;
    // ★ v92.11 (1 May 2026): Mesaj Parlat power-up — metadata.glow=true ise altın bubble.
    const isGlowMsg = !!(item as any).metadata?.glow;

    return (
      <View style={st.msgRow}>
        {/* ★ 2026-04-26: Avatar tıklanınca profil sheet — diğer platformlardaki gibi standart davranış. */}
        <Pressable
          onPress={() => { if (senderUid && onAvatarPress) onAvatarPress(senderUid); }}
          hitSlop={6}
        >
          <Image source={getAvatarSource(item.profiles?.avatar_url)} style={[st.msgAvatar, { borderColor: nameColor + '40' }]} />
        </Pressable>
        <Pressable
          onLongPress={() => handleToggleReaction(item.id)}
          onPress={() => { if (reaction?.liked || (reaction?.count || 0) > 0) handleToggleReaction(item.id); }}
          delayLongPress={220}
          style={({ pressed }) => [
            st.msgBubble,
            isGifSafe && { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 4, paddingVertical: 2 },
            isGlowMsg && st.glowMsgBubble,
            pressed && { opacity: 0.9 },
          ]}
        >
          {/* ★ v92.14: Mesaj Parlat overlay — gradient bg + multi-layer border + breath pulse.
              Arkada kalır, içerik üstüne biner (z-index doğal). */}
          {isGlowMsg && <GlowMessageOverlay />}
          {/* İsim de tıklanır — avatar gibi profil sheet'i açar */}
          <Pressable
            onPress={() => { if (senderUid && onAvatarPress) onAvatarPress(senderUid); }}
            hitSlop={4}
          >
            <Text style={[st.msgName, { color: nameColor }]}>{item.profiles?.display_name || 'Kullanıcı'}</Text>
          </Pressable>
          {isGifSafe ? (
            <Image source={{ uri: gifMatch![1] }} style={{ width: 220, height: 165, borderRadius: 12 }} resizeMode="cover" />
          ) : emojiOnly ? (
            <Text style={{ fontSize: 36, lineHeight: 44 }}>{content}</Text>
          ) : (
            <Text style={st.msgText}>{content}</Text>
          )}
          {reaction && reaction.count > 0 ? (
            <View style={[st.reactionBadge, reaction.liked && st.reactionBadgeLiked]}>
              <Text style={st.reactionEmoji}>{reaction.liked ? '❤️' : '🤍'}</Text>
              <Text style={[st.reactionCount, reaction.liked && { color: '#FFE4E6' }]}>{reaction.count}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    );
  }, [reactions, currentUserId, handleToggleReaction, onAvatarPress]);

  // Sheet kapalıysa render etme
  const isOpen = visible || currentSnap.current > 0;
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — hafif karartma, tıklayınca kapat */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { zIndex: 55, elevation: 55, opacity: backdropOpacity, backgroundColor: 'rgba(0,0,0,0.6)' }]}
        pointerEvents={currentSnap.current > 0 ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); animateTo(SNAP_CLOSED); }} />
      </Animated.View>

      {/* ════════════════════════════════════════════════════════════
          SHEET — control bar'ın hemen üstünde, aşağıdan yukarı yükselir
          position: absolute, bottom: CONTROL_BAR_AREA
          height: animated (0 → SNAP_FULL)
          ════════════════════════════════════════════════════════════ */}
      <Animated.View
        style={[
          st.sheet,
          {
            bottom: sheetBottomAnim,
            height: sheetHeight,
          },
        ]}
      >
        {/* Gradient background — DM panel paleti */}
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          locations={[0, 0.35, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* ── Handle bar — sürükle ── */}
        <View {...panResponder.panHandlers} collapsable={false}>
          <View style={st.handle}>
            <View style={st.handleBar} />
          </View>
          <View style={st.header}>
            <View style={st.headerTitleWrap}>
              <Ionicons name="chatbubble-ellipses" size={18} color="#14B8A6" style={st.headerIcon} />
              <Text style={st.headerTitle}>Oda Sohbeti</Text>
              <Text style={st.msgCount}>{messages.length}</Text>
            </View>
            <Pressable onPress={() => { Keyboard.dismiss(); animateTo(SNAP_CLOSED); }} style={st.closeBtn} hitSlop={12}>
              <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>
        </View>

        {/* ── Messages ── */}
        <FlatList
          data={messages}
          keyExtractor={(m, i) => m?.id || `msg_${i}`}
          renderItem={renderMessage}
          style={st.list}
          inverted
          contentContainerStyle={[st.listContent, { paddingTop: INPUT_BAR_H + 12 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        />

        {/* Emoji picker (conditional) */}
        {showEmojiPicker && (
          <View style={st.pickerWrap}>
            <EmojiReactionBar
              onReaction={(content: string) => {
                if (content.startsWith('[gif:')) {
                  onSendRaw?.(content);
                  setShowEmojiPicker(false);
                } else {
                  onChangeInput((chatInput || '') + content);
                }
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          </View>
        )}
      </Animated.View>

      {/* ════════════════════════════════════════════════════════════
          INPUT BAR — sheet'ten BAĞIMSIZ, Keyboard API ile konumlanır.
          Klavye kapalı → control bar'ın hemen üstünde (sheet ile birleşik görünür)
          Klavye açık → klavyenin hemen üstünde (screenY kullanarak)
          ════════════════════════════════════════════════════════════ */}
      <Animated.View
        style={[
          st.inputBarFloat,
          {
            bottom: inputBottomAnim,
            opacity: sheetHeight.interpolate({
              inputRange: [0, 50],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <Pressable
          onPress={() => {
            if (!showEmojiPicker) {
              inputRef.current?.blur();
            }
            setShowEmojiPicker(v => !v);
          }}
          style={st.iconBtn}
          hitSlop={6}
        >
          <Ionicons
            name={showEmojiPicker ? 'close-outline' : 'happy-outline'}
            size={22}
            color={showEmojiPicker ? '#5CE1E6' : 'rgba(255,255,255,0.55)'}
          />
        </Pressable>
        <TextInput
          ref={inputRef}
          style={st.input}
          placeholder="Bir mesaj yaz..."
          placeholderTextColor="rgba(255,255,255,0.35)"
          value={chatInput}
          onChangeText={onChangeInput}
          onFocus={() => {
            setShowEmojiPicker(false);
            // Klavye açılınca tam ekrana geç
            if (currentSnap.current < SNAP_FULL) {
              animateToRef.current(SNAP_FULL);
            }
          }}
          maxLength={300}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={() => { onSend(); inputRef.current?.focus(); }}
        />
        <Pressable
          style={[st.sendBtn, !chatInput.trim() && { opacity: 0.35 }]}
          onPress={() => { onSend(); inputRef.current?.focus(); }}
          disabled={!chatInput.trim()}
          hitSlop={6}
        >
          <Ionicons name="send" size={16} color="#FFF" />
        </Pressable>
      </Animated.View>
    </>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════
const st = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 6, right: 6,
    zIndex: 58,
    elevation: 58,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
    // ★ v92.23 (1 May 2026): Android elevation eklendi (sheet drop shadow için)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },

  handle: { alignItems: 'center', paddingTop: 8, paddingBottom: 2 },
  handleBar: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIcon: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  headerTitle: {
    fontSize: 14, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  msgCount: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.3)', marginLeft: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  list: { flex: 1 },
  listContent: { paddingVertical: 8, paddingHorizontal: 10, gap: 8 },

  pickerWrap: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },

  inputBarFloat: {
    position: 'absolute',
    left: 4, right: 4,
    zIndex: 59,
    elevation: 59,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(55,65,79,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(149,161,174,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 90,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#F1F5F9',
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#14B8A6',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Messages ──
  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5 },
  msgBubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  msgName: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  msgText: { fontSize: 13, color: '#E2E8F0', lineHeight: 18 },
  sysMsg: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 12,
  },
  sysMsgText: { fontSize: 11, color: '#94A3B8', textAlign: 'center' },

  // ★ v92.10 (1 May 2026): Bağış sistem mesajı — altın çerçeve + glow.
  donationSysMsg: {
    alignSelf: 'center',
    backgroundColor: 'rgba(251,191,36,0.10)',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    marginVertical: 4,
    ...Platform.select({
      ios: { shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  donationSysMsgText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFE082',
    textAlign: 'center',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // ★ v92.14 (1 May 2026): Mesaj Parlat — gerçek görsel <GlowMessageOverlay /> içinde.
  //   Buradaki sadece BASE: bubble border/bg transparent — overlay tüm görseli yapıyor.
  //   Eski versiyon flat altın border + iOS-only shadow idi (Android'de glow yok, kullanıcı şikâyet etti).
  glowMsgBubble: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },

  // ★ v56: Reaction badge — balonun sağ-altında küçük ❤️+sayı pill
  reactionBadge: {
    position: 'absolute',
    right: -6, bottom: -8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2.5,
    borderRadius: 11,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35, shadowRadius: 3,
    elevation: 3,
  },
  reactionBadgeLiked: {
    backgroundColor: 'rgba(239,68,68,0.92)',
    borderColor: 'rgba(254,205,211,0.35)',
  },
  reactionEmoji: { fontSize: 10 },
  reactionCount: { fontSize: 10, fontWeight: '800', color: '#E2E8F0', letterSpacing: 0.2 },
});
