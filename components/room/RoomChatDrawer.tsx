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
  FlatList, Image, Platform, PanResponder, Keyboard, Dimensions, Easing, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAvatarSource } from '../../constants/avatars';
import StatusAvatar from '../StatusAvatar';
import { EmojiReactionBar } from '../EmojiReactions';
import { GlowMessageBubble } from '../skia';
import { InlineEmoji } from '../skia/CustomEmojiRenderer';
import { RoomChatService, getRoomProfileFromCache } from '../../services/roomChat';
import MessageGlowPickerSheet from './MessageGlowPickerSheet';
import RoomAvatarFrame from './RoomAvatarFrame';
import LinkifiedText from '../LinkifiedText';
import SPIcon from '../SPIcon';
// ★ v280 (15 May 2026): TierBadge import KALDIRILDI — web admin CosmeticBadge sistemi kullanılıyor.
import { migrateLegacyTier } from '../../types';
import { i18n } from '../../services/i18n';
import { useKeyboardAnchor } from '../../hooks/useKeyboardAnchor';

// Snap points — CONTROL_BAR_AREA: bar + padding alanı (insets.bottom hariç).
// RoomControlBar: BAR_H=50 + üstündeki wrapper paddingBottom(8) = 58.
// insets.bottom ayrıca eklenir → sheet tam kontrol barın üstüne oturur.
// ════════════════════════════════════════════════════════════
const CONTROL_BAR_AREA = 72;         // BAR_H(72) — bar tam üstüne otur
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

// ★ v107 (3 May 2026): Mesaj Parlat power-up — 6 stil mockup (HTML tasarımı).
//   Her mesaj kendi stilini bağımsız seçer; mesajın metadata.glow_style alanından okunur.
//   Backwards-compat: metadata.glow=true → 'gold' fallback (eski 5-mesaj birikim sistemi).
//   GLOW_STYLES config ./glowStyles.ts'te (RoomChatDrawer ↔ MessageGlowPickerSheet circular önlemi).

import { GLOW_STYLES, type GlowStyleId } from './glowStyles';
export { GLOW_STYLES, type GlowStyleId };

// ─── Particle component'leri ─────────────────────────────────
// Hafif, NativeDriver-uyumlu animasyonlar. Her overlay sadece kendi particle'ını render eder.

function ShineSweep() {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, {
      toValue: 1, duration: 2400, useNativeDriver: true, easing: Easing.inOut(Easing.cubic),
    }));
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: 0, bottom: 0,
      width: 80,
      transform: [
        { translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-100, 360] }) },
        { skewX: '-20deg' },
      ],
    }}>
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  );
}

function HeartParticles() {
  return (
    <>
      {['💖', '💕', '❤️'].map((emoji, i) => (
        <FloatParticle key={i} emoji={emoji} leftPercent={20 + i * 30} delay={i * 600} />
      ))}
    </>
  );
}

function FloatParticle({ emoji, leftPercent, delay }: { emoji: string; leftPercent: number; delay: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(200),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  return (
    <Animated.Text pointerEvents="none" style={{
      position: 'absolute', bottom: 0,
      left: `${leftPercent}%`,
      fontSize: 14,
      transform: [
        { translateY: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, -12, -42] }) },
        { scale: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0.5] }) },
      ],
      opacity: t.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
    }}>{emoji}</Animated.Text>
  );
}

function NeonBorder() {
  // ★ HTML border-snake — gradient renkleri 3sn'de bir döner. RN'de border-color
  //   animatable değil; 3 katman crossfade ile fake (cyan → magenta → yellow → cyan).
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, {
      toValue: 1, duration: 3000, useNativeDriver: true, easing: Easing.linear,
    }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  const cyan = t.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [1, 0, 0, 1] });
  const magenta = t.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0, 1, 0, 0] });
  const yellow = t.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0, 0, 1, 0] });
  return (
    <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, {
        borderRadius: 14, borderWidth: 1.8, borderColor: '#00FFFF', opacity: cyan,
      }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, {
        borderRadius: 14, borderWidth: 1.8, borderColor: '#FF00FF', opacity: magenta,
      }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, {
        borderRadius: 14, borderWidth: 1.8, borderColor: '#FFFF00', opacity: yellow,
      }]} />
    </>
  );
}

// ★ HTML galaxy: radial-gradient(circle at 20% 20%, #FFE082, transparent 40%) +
//   radial-gradient(circle at 80% 80%, #FBBF24, transparent 40%). RN'de radial-gradient
//   yok; 2 absolute "blob" (border-radius büyük + opacity) ile yakın simülasyon.
function GalaxyBlobs() {
  return (
    <>
      <View pointerEvents="none" style={{
        position: 'absolute', top: -30, left: -30,
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: '#FFE082',
        opacity: 0.45,
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute', bottom: -30, right: -30,
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: '#FBBF24',
        opacity: 0.45,
      }} />
    </>
  );
}

function FireIcon() {
  const flick = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flick, { toValue: 1, duration: 130, useNativeDriver: true }),
      Animated.timing(flick, { toValue: 0.3, duration: 130, useNativeDriver: true }),
      Animated.timing(flick, { toValue: 0.7, duration: 130, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [flick]);
  return (
    <Animated.Text pointerEvents="none" style={{
      fontSize: 13,
      transform: [
        { scaleY: flick.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.1] }) },
        { rotate: flick.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-2deg', '2deg', '-1deg'] }) },
      ],
    }}>🔥</Animated.Text>
  );
}

function ConfettiRain() {
  return (
    <>
      <ConfettiDrop emoji="🎉" leftPercent={10} duration={1800} delay={0} />
      <ConfettiDrop emoji="✨" leftPercent={75} duration={2200} delay={600} />
    </>
  );
}

function ConfettiDrop({ emoji, leftPercent, duration, delay }: { emoji: string; leftPercent: number; duration: number; delay: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t, duration, delay]);
  return (
    <Animated.Text pointerEvents="none" style={{
      position: 'absolute', top: 0,
      left: `${leftPercent}%`,
      fontSize: 14,
      transform: [
        { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-20, 60] }) },
        { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
      ],
      opacity: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
    }}>{emoji}</Animated.Text>
  );
}

function StarTwinkle({ topPercent, leftPercent, delay, emoji = '⭐' }: { topPercent: number; leftPercent: number; delay: number; emoji?: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration: 750, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(t, { toValue: 0, duration: 750, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  return (
    <Animated.Text pointerEvents="none" style={{
      position: 'absolute', top: `${topPercent}%`, left: `${leftPercent}%`,
      fontSize: 12,
      transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.3] }) }],
      opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    }}>{emoji}</Animated.Text>
  );
}

function StarsField() {
  return (
    <>
      <StarTwinkle topPercent={20} leftPercent={8} delay={0} emoji="⭐" />
      <StarTwinkle topPercent={60} leftPercent={80} delay={500} emoji="✨" />
      <StarTwinkle topPercent={40} leftPercent={55} delay={1000} emoji="⭐" />
    </>
  );
}

// ─── Ana overlay ─────────────────────────────────
function GlowMessageOverlay({ style }: { style: GlowStyleId }) {
  const cfg = GLOW_STYLES[style];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: 14, borderBottomLeftRadius: 4, overflow: 'hidden' }]}>
      {/* Bg gradient — stile özel */}
      <LinearGradient
        colors={cfg.bgGradient as any}
        start={cfg.bgStart || { x: 0, y: 0 }} end={cfg.bgEnd || { x: 1, y: 1 }}
        locations={cfg.bgLocations as any}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Body bg overlay — readability için yarı saydam koyuluk */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: cfg.bodyBg, top: 24 }]} />
      {/* Particles — stile göre */}
      {cfg.particles === 'shine' && <ShineSweep />}
      {cfg.particles === 'hearts' && <HeartParticles />}
      {cfg.particles === 'neon-border' && <NeonBorder />}
      {cfg.particles === 'confetti' && <ConfettiRain />}
      {cfg.particles === 'stars' && (<><GalaxyBlobs /><StarsField /></>)}
    </View>
  );
}

// Header strip'i renderMessage içinde inline render edilecek, çünkü header text'i ve cost badge sabit kalmalı + tıklanabilir kalmalı.
function GlowHeader({ style }: { style: GlowStyleId }) {
  const cfg = GLOW_STYLES[style];
  const showFireIcon = cfg.particles === 'fire-icon';
  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 24,
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 10, gap: 6,
      borderTopLeftRadius: 14, borderTopRightRadius: 14,
      overflow: 'hidden',
    }} pointerEvents="none">
      <LinearGradient
        colors={cfg.headerBg as any}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {showFireIcon ? <FireIcon /> : <Text style={{ fontSize: 11 }}>{cfg.icon}</Text>}
      <Text style={{
        fontSize: 9.5, fontWeight: '800', letterSpacing: 1,
        color: cfg.headerColor,
        textShadowColor: cfg.particles === 'neon-border' ? '#00FFFF' : 'transparent',
        textShadowRadius: cfg.particles === 'neon-border' ? 6 : 0,
        textShadowOffset: { width: 0, height: 0 },
      }}>{cfg.label}</Text>
      <View style={{
        marginLeft: 'auto',
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: 6, paddingVertical: 1,
        borderRadius: 8,
      }}>
        <SPIcon size={9} />
        <Text style={{ fontSize: 8.5, fontWeight: '800', color: '#FAC775' }}>{cfg.cost}</Text>
      </View>
    </View>
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
  /** Actual RoomControlBar wrapper height (bar + device safe-area). */
  bottomClearance?: number;
  onSendRaw?: (content: string) => void;
  /** ★ v56: reaksiyon için çağıran kullanıcının Firebase UID'si */
  currentUserId?: string;
  /** Oda id — reaction realtime kanalı için */
  roomId?: string;
  /** ★ 2026-04-26: Mesaj balonundaki avatar/isim tıklanınca profil sheet aç (parent yönlendirir). */
  onAvatarPress?: (userId: string) => void;
  /** ★ v107 (3 May 2026): Mesaj Parlat — kullanıcının SP bakiyesi (picker yeterlilik kontrolü için) */
  currentSP?: number;
  /** ★ v107: Stil seçilmişken send tetiklenince burayı çağır — parent SP düşer + glow_style metadata ile gönderir */
  onSendGlow?: (content: string, glowStyle: GlowStyleId) => void;
  /** ★ v107: Sahip olunan premium glow id'leri (cosmetic_items.message_art) — picker kilit kontrolü */
  ownedPremiumGlowIds?: Set<string>;
  /** ★ v107: Premium kilitli stil tıklandı → parent mağazaya yönlendirir */
  onOpenStore?: () => void;
}

export default function RoomChatDrawer({
  visible, messages, chatInput, onChangeInput, onSend, onClose, bottomInset, bottomClearance = 0, onSendRaw, currentUserId, roomId, onAvatarPress,
  currentSP = 0, onSendGlow, ownedPremiumGlowIds, onOpenStore,
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // ★ v107: Mesaj Parlat — picker visibility + seçilen stil (sonraki mesaja uygulanır)
  const [glowPickerVisible, setGlowPickerVisible] = useState(false);
  const [pendingGlowStyle, setPendingGlowStyle] = useState<GlowStyleId | null>(null);

  // ════════════════════════════════════════════════════════════
  // ★ v108.30 (5 May 2026): TOP-BASED POSITIONING — adjustResize tamamen bypass.
  //
  // SORUN: position:absolute + bottom → parent'ın alt kenarından ölçer.
  //   adjustResize parent (window) yüksekliğini küçültüyor → parent alt kenarı
  //   yukarı kayıyor → bottom:72 artık ekranın ortasında. Her cihazda farklı.
  //
  // ÇÖZÜM: `bottom` yerine `top` kullan. Keyboard event'in screenY değeri
  //   ekranın mutlak koordinat sistemi — adjustResize'dan etkilenmez.
  //   Klavye kapalı → top = screenH - controlBarArea - inputBarH
  //   Klavye açık → top = e.endCoordinates.screenY - inputBarH
  //   Bu değerler parent boyutundan bağımsız, her cihazda aynı.
  // ════════════════════════════════════════════════════════════
  const {
    hostRef: keyboardHostRef,
    onHostLayout: onKeyboardHostLayout,
    keyboardInset,
    keyboardVisible,
    hostHeight,
  } = useKeyboardAnchor();

  // Closed keyboard: sit exactly above the real room control bar.
  // Open keyboard: use the physically measured IME overlap of this overlay host.
  const fallbackRestBottom = CONTROL_BAR_AREA + Math.max(bottomInset || insets.bottom, 7);
  const restBottom = Math.max(bottomClearance || 0, fallbackRestBottom);
  const layoutHeight = Math.max(hostHeight, 320);
  const anchorBottom = keyboardVisible ? keyboardInset : restBottom;
  const availableH = Math.max(240, layoutHeight - anchorBottom - Math.max(insets.top, 20));
  const SNAP_CLOSED = 0;
  const SNAP_HALF = Math.min(availableH * 0.62, layoutHeight * 0.50);
  const SNAP_FULL = Math.min(availableH * 0.80, layoutHeight * 0.65);

  const GLOW_BANNER_H = 38;
  const INPUT_BAR_BASE_H = 54;
  const INPUT_BAR_H = pendingGlowStyle ? INPUT_BAR_BASE_H + GLOW_BANNER_H : INPUT_BAR_BASE_H;

  const sheetHeight = useRef(new Animated.Value(0)).current;
  const closeTranslateY = useRef(new Animated.Value(0)).current;
  const inputBarH = useRef(new Animated.Value(INPUT_BAR_H)).current;
  const currentSnap = useRef(0);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);
  const lastOpenSnapRef = useRef(SNAP_HALF);
  const inputBottomAnim = useRef(new Animated.Value(restBottom)).current;
  const sheetBottomAnim = useRef(new Animated.Value(restBottom)).current;

  useEffect(() => {
    if (!visible) return;
    inputBottomAnim.setValue(keyboardVisible ? keyboardInset : restBottom);
    sheetBottomAnim.setValue(keyboardVisible ? keyboardInset : restBottom);
  }, [visible, keyboardVisible, keyboardInset, restBottom, inputBottomAnim, sheetBottomAnim]);

  useEffect(() => {
    if (!visible) return;
    const targetBottom = keyboardVisible ? keyboardInset : restBottom;

    Animated.timing(sheetBottomAnim, {
      toValue: targetBottom,
      duration: keyboardVisible ? 120 : 170,
      useNativeDriver: false,
    }).start();

    if (keyboardVisible) {
      const topReserve = Math.max(insets.top + 60, 100);
      const visibleArea = Math.max(240, layoutHeight - targetBottom - topReserve - INPUT_BAR_H);
      if (currentSnap.current > visibleArea) {
        currentSnap.current = visibleArea;
        Animated.timing(sheetHeight, {
          toValue: visibleArea,
          duration: 140,
          useNativeDriver: false,
        }).start();
      }
    } else if (currentSnap.current > 0) {
      const restoredHeight = Math.min(lastOpenSnapRef.current, availableH);
      currentSnap.current = restoredHeight;
      Animated.timing(sheetHeight, {
        toValue: restoredHeight,
        duration: 170,
        useNativeDriver: false,
      }).start();
    }
  }, [
    visible, keyboardVisible, keyboardInset, restBottom, layoutHeight,
    INPUT_BAR_H, insets.top, availableH, sheetBottomAnim, sheetHeight,
  ]);

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

    if (capped === 0) {
      // ═══ KAPAMA — çekmece animasyonu ═══
      // closeTranslateY hem sheet'e hem input bar'a uygulanıyor (aynı Animated.Value).
      // İkisi birlikte aşağı kayarak kontrol barının arkasına girer.
      isClosingRef.current = true;
      currentSnap.current = 0;

      Animated.parallel([
        Animated.timing(closeTranslateY, {
          toValue: lastOpenSnapRef.current + restBottom + INPUT_BAR_H,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isClosingRef.current = false;
        sheetHeight.setValue(0);
        closeTranslateY.setValue(0);
        inputBottomAnim.setValue(restBottom);
        sheetBottomAnim.setValue(restBottom);
        onClose();
      });
    } else {
      // ═══ AÇMA / GENİŞLEME ═══
      currentSnap.current = capped;
      closeTranslateY.setValue(0);
      const speed = velocity ? Math.min(Math.abs(velocity) * 0.5, 2) : 1;
      Animated.spring(sheetHeight, {
        toValue: capped,
        useNativeDriver: false,
        damping: 22,
        stiffness: 250 * speed,
        mass: 0.8,
      }).start();
      lastOpenSnapRef.current = capped;
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
      const c = Math.min(currentSnap.current, availableH);
      currentSnap.current = c;
      Animated.timing(sheetHeight, { toValue: c, duration: 200, useNativeDriver: false }).start();
    }
  }, [availableH]);

  // En yakın snap noktasını bul
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
    let closest = pts[0], minDist = Math.abs(height - closest);
    for (const snap of pts) {
      const dist = Math.abs(height - snap);
      if (dist < minDist) { minDist = dist; closest = snap; }
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
  // visible değiştiğinde
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      closeTranslateY.setValue(0);
      animateTo(SNAP_HALF);
    } else {
      // Çekmece kapanma zaten çalışıyorsa tekrar başlatma
      if (isClosingRef.current) return;
      // Parent kapatma → aynı çekmece animasyonunu kullan
      if (currentSnap.current > 0) {
        animateTo(0);
      }
    }
  }, [visible]);

  useEffect(() => { if (!visible) setShowEmojiPicker(false); }, [visible]);

  // ════════════════════════════════════════════════════════════
  // ★ v56: Mesaj reaksiyonları (❤️) — state, fetch, realtime sync
  // ════════════════════════════════════════════════════════════
  // ★ v110.14: WhatsApp tarzı çoklu emoji — Record<messageId, Record<emoji, {count, liked}>>
  const [reactions, setReactions] = useState<Record<string, Record<string, { count: number; liked: boolean }>>>({});
  const reactionsRef = useRef(reactions);
  useEffect(() => { reactionsRef.current = reactions; }, [reactions]);
  // ★ v110.14: WhatsApp tarzı reaction picker — long press ile mesajın üstüne pop
  const [reactionPicker, setReactionPicker] = useState<{ messageId: string; anchorY: number } | null>(null);
  const reactionPickerScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reactionPicker) {
      reactionPickerScale.setValue(0);
      Animated.spring(reactionPickerScale, {
        toValue: 1, friction: 7, tension: 90, useNativeDriver: true,
      }).start();
    }
  }, [reactionPicker, reactionPickerScale]);

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
      // ★ v110.14: Yeni emoji-bazlı yapı — Record<emoji, {count, liked}>
      if (map[messageId] && Object.keys(map[messageId]).length > 0) {
        setReactions(prev => ({ ...prev, [messageId]: map[messageId] }));
      } else {
        // count düştü 0 — kaldır
        setReactions(prev => { const n = { ...prev }; delete n[messageId]; return n; });
      }
    });
    return unsub;
  }, [visible, currentUserId, roomId]);

  // ★ v110.14: WhatsApp tek-emoji-per-user. Yeni emoji secince eski silinir.
  const handleToggleReaction = useCallback(async (messageId: string, emoji = '❤️') => {
    if (!currentUserId || !messageId) return;
    const prevAll = reactionsRef.current[messageId] || {};
    // Kullanicinin bu mesaja koydugu mevcut emoji'yi bul
    const existingEmoji = Object.entries(prevAll).find(([, r]) => r.liked)?.[0];
    if (existingEmoji && existingEmoji !== emoji) {
      // Farkli emoji secildi — eski'yi sessizce kaldir
      RoomChatService.toggleReaction(messageId, currentUserId, existingEmoji).catch(() => {});
      // Optimistic: eski emoji'nin count'unu -1 + liked=false
      setReactions(r => {
        const next = { ...r };
        const msgMap = { ...(next[messageId] || {}) };
        const oldR = msgMap[existingEmoji];
        if (oldR) {
          const newCount = Math.max(0, oldR.count - 1);
          if (newCount === 0) delete msgMap[existingEmoji];
          else msgMap[existingEmoji] = { count: newCount, liked: false };
        }
        if (Object.keys(msgMap).length === 0) delete next[messageId];
        else next[messageId] = msgMap;
        return next;
      });
    }
    const prev = prevAll[emoji] || { count: 0, liked: false };
    const optimistic = { liked: !prev.liked, count: prev.count + (prev.liked ? -1 : 1) };
    // Optimistic state — emoji bazlı update
    setReactions(r => {
      const next = { ...r };
      const msgMap = { ...(next[messageId] || {}) };
      if (optimistic.count <= 0 && !optimistic.liked) {
        delete msgMap[emoji];
      } else {
        msgMap[emoji] = optimistic;
      }
      if (Object.keys(msgMap).length === 0) {
        delete next[messageId];
      } else {
        next[messageId] = msgMap;
      }
      return next;
    });
    const result = await RoomChatService.toggleReaction(messageId, currentUserId, emoji);
    if (result) {
      setReactions(r => {
        const next = { ...r };
        const msgMap = { ...(next[messageId] || {}) };
        if (result.count <= 0) {
          delete msgMap[emoji];
        } else {
          msgMap[emoji] = { count: result.count, liked: result.liked };
        }
        if (Object.keys(msgMap).length === 0) {
          delete next[messageId];
        } else {
          next[messageId] = msgMap;
        }
        return next;
      });
    } else {
      // rollback
      setReactions(r => {
        const next = { ...r };
        const msgMap = { ...(next[messageId] || {}) };
        if (prev.count <= 0) {
          delete msgMap[emoji];
        } else {
          msgMap[emoji] = prev;
        }
        if (Object.keys(msgMap).length === 0) {
          delete next[messageId];
        } else {
          next[messageId] = msgMap;
        }
        return next;
      });
    }
  }, [currentUserId]);

  // ════════════════════════════════════════════════════════════
  // Message render
  // ════════════════════════════════════════════════════════════
  const renderMessage = useCallback(({ item }: { item: ChatMsg }) => {
    if (!item) return null;
    // ★ v110.14 (8 May 2026): Join/Leave bildirimi — balonsuz, ortada, sade.
    //   Önceden büyük chat balonu olarak görünüyordu, içinde "odaya katıldı" yazıyordu.
    //   Şimdi tek satır italic gri text, akışı kesmiyor.
    const isJoin = (item as any).isJoin === true;
    const isLeave = (item as any).isLeave === true;
    if (isJoin || isLeave) {
      const name = item.profiles?.display_name || 'Misafir';
      const verb = isJoin ? i18n.t('auto.room.RoomChatDrawer.003') : i18n.t('auto.room.RoomChatDrawer.002');
      return (
        <View style={st.joinNotice}>
          <Text style={st.joinNoticeText}>
            <Text style={{ fontWeight: '600', color: 'rgba(255,255,255,0.55)' }}>{name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.40)' }}>{' ' + verb}</Text>
          </Text>
        </View>
      );
    }
    // ★ v92.10 (1 May 2026): DB type='system' mesajları (bağış vs.) — '✨' prefix ile
    //   gelen donation mesajları altın çerçeveli, diğer sistem mesajları sade gri.
    const isSystemMsg = item.isSystem || (item as any).type === 'system';
    // ★ v107 (4 May 2026): Sembol Hediye sistem mesajı — type='gift_system'
    const isGiftSystem = (item as any).type === 'gift_system';
    if (isGiftSystem) {
      const meta = (item as any).metadata || {};
      const color = meta.art_color || '#F472B6';
      const emoji = meta.art_emoji || '🎁';
      return (
        <View style={[st.giftSysMsg, { borderColor: color + '70' }]}>
          <LinearGradient
            colors={[color + '38', color + '15', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={st.giftSysEmoji}>{emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.giftSysTitle} numberOfLines={1}>
              <Text style={{ color: color, fontWeight: '800' }}>{meta.sender_name || 'Birisi'}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)' }}>{' → '}</Text>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>{meta.recipient_name || i18n.t('auto.room.RoomChatDrawer.001')}</Text>
            </Text>
            <Text style={st.giftSysSub} numberOfLines={1}>
              <Text style={{ color: color, fontWeight: '700' }}>{meta.item_name || 'Hediye'}</Text>
              {meta.price_sp ? <Text style={{ color: 'rgba(255,255,255,0.5)' }}>{' • ' + meta.price_sp + ' SP'}</Text> : null}
            </Text>
          </View>
        </View>
      );
    }
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
    // ★ v110.14: Cache lookup — eski mesajların profile join'i eksik olsa bile
    //   güncel renk/çerçeve gösterilir. Aynı kullanıcıdan gelen tüm mesajlar tutarlı.
    const cachedSenderProfile = getRoomProfileFromCache(item.user_id);
    const senderTierRaw = (item.profiles as any)?.subscription_tier ?? cachedSenderProfile?.subscription_tier ?? null;
    const nameColor = getUserColor(item.user_id || '', item.role, senderTierRaw);
    const msgReactions = reactions[item.id]; // Record<emoji, {count, liked}> | undefined
    const isOwn = item.user_id === currentUserId;

    // ★ 2026-04-26 FIX: Mesaj objesinde gönderen alanı `sender_id` (DB) — ChatMsg type'ında `user_id` adıyla
    //   aliaslanıyordu ama bazı kayıtlarda yalnız `sender_id` geliyor. İkisini de OR ile al.
    const senderUid = (item as any).user_id || (item as any).sender_id;
    // ★ v107 (3 May 2026): 6 stilli mesaj parlat — metadata.glow_style: 'gold'|'heart'|'neon'|'fire'|'celebration'|'galaxy'
    //   Backwards-compat: metadata.glow=true → 'gold' fallback.
    const glowStyleId: GlowStyleId | null =
      ((item as any).metadata?.glow_style as GlowStyleId) ||
      ((item as any).metadata?.glow ? 'gold' : null);
    const isGlowMsg = !!glowStyleId;
    const glowCfg = glowStyleId ? GLOW_STYLES[glowStyleId] : null;

    const senderFrame = (item.profiles as any)?.active_frame || cachedSenderProfile?.active_frame || null;
    // ★ 2026-05-05: Mesaj avatarı için kompakt tier etiketi (Plus/Pro/GM).
    const senderTier = migrateLegacyTier(senderTierRaw as string);
    const showSenderTier = senderTier !== 'Free';
    // ★ v268 (13 May 2026): Oda mesajlarına active_glow_id desteği — web admin "Parlak Mesajlar"
    //   editöründen seçilen Skia glow config'i. Hardcoded GLOW_STYLES sistemiyle birlikte çalışır
    //   (eski metadata.glow_style mesajlar bozulmaz, yeni dinamik glow eklenir).
    const senderActiveBadgeId = (item.profiles as any)?.active_badge_id
      ?? cachedSenderProfile?.active_badge_id
      ?? null;
    const senderActiveGlowId = (item.profiles as any)?.active_glow_id
      || (cachedSenderProfile as any)?.active_glow_id
      || null;
    // ★ v270: Custom emoji desteği — sender'ın active_emoji_id'si varsa :shortcode:
    //   pattern'lerini Skia ile image olarak render et.
    const senderActiveEmojiId = (item.profiles as any)?.active_emoji_id
      || (cachedSenderProfile as any)?.active_emoji_id
      || null;
    const hasEmojiShortcode = /:[a-z0-9_-]+:/i.test(content);
    return (
      <View style={st.msgRow}>
        {/* ★ 2026-04-26: Avatar tıklanınca profil sheet — diğer platformlardaki gibi standart davranış. */}
        <Pressable
          onPress={() => { if (senderUid && onAvatarPress) { Keyboard.dismiss(); onAvatarPress(senderUid); } }}
          hitSlop={6}
          style={{ position: 'relative', width: 32, height: 32 }}
        >
          {/* ★ v1.3.56: Image + RoomAvatarFrame + ayrı TierBadge yerine StatusAvatar —
               avatar_* filtreler (hue/shape/brightness/border/halo) + frame + tier badge tek
               yerde. Frame contextKey="mini" çünkü mesaj avatar'ı 32px (≤70 mini key). */}
          <StatusAvatar
            uri={item.profiles?.avatar_url}
            size={32}
            tier={senderTier}
            frameId={senderFrame}
            contextKey="mini"
            showTierBadge={showSenderTier}
            customBadgeId={senderActiveBadgeId}
          />
        </Pressable>
        <GlowMessageBubble glowItemId={senderActiveGlowId} isMine={isOwn} context="room" style={{ flex: 1 } as any}>
        <Pressable
          onPress={() => { /* no-op: onLongPress'in tetiklenmesi için onPress de tanımlı olmalı */ }}
          onLongPress={(e) => {
            // Picker'ı tam mesaj balonunun üstüne yerleştir (WhatsApp paritesi)
            const anchorY = (e.nativeEvent as any)?.pageY ?? 0;
            if (__DEV__) console.log('[Reaction] long press OK', item.id, 'anchorY=', anchorY);
            setReactionPicker({ messageId: item.id, anchorY });
          }}
          delayLongPress={300}
          style={({ pressed }) => [
            st.msgBubble,
            isGifSafe && { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 4, paddingVertical: 2 },
            isGlowMsg && st.glowMsgBubble,
            pressed && { opacity: 0.9 },
          ]}
        >
          {/* ★ v107: 6 stilli Mesaj Parlat (HTML mockup) — overlay arka plan + üst header strip */}
          {glowStyleId && (
            <>
              <GlowMessageOverlay style={glowStyleId} />
              <GlowHeader style={glowStyleId} />
            </>
          )}
          {/* ★ v110.14: İsim tıklanmasın — sadece avatar profil sheet'i açar.
               Balon tıklaması reaction'a ait, balon içine başka onPress girmesin. */}
          <Text style={[st.msgName, { color: glowCfg ? glowCfg.nameColor : nameColor }]}>{item.profiles?.display_name || (item.user_id ? `…${String(item.user_id).slice(0, 4)}` : '…')}</Text>
          {isGifSafe ? (
            <Image source={{ uri: gifMatch![1] }} style={{ width: 220, height: 165, borderRadius: 12 }} resizeMode="cover" />
          ) : emojiOnly ? (
            <Text style={{ fontSize: 36, lineHeight: 44 }}>{content}</Text>
          ) : hasEmojiShortcode && senderActiveEmojiId ? (
            // ★ v270: Custom emoji içeriyor → InlineEmoji ile shortcode'ları image render et
            <InlineEmoji text={content} emojiSetId={senderActiveEmojiId} textStyle={[st.msgText, glowCfg && { color: glowCfg.textColor, fontWeight: '500' }] as any} />
          ) : (
            // ★ v109: Linkify — URL'ler tıklanabilir + farklı renkte
            <LinkifiedText
              text={content}
              style={[st.msgText, glowCfg && { color: glowCfg.textColor, fontWeight: '500' }] as any}
              linkColor={glowCfg ? glowCfg.textColor : '#5EEAD4'}
            />
          )}
          {/* ★ v110.14: WhatsApp tarzı chip — count > 1 ise sayı göster */}
          {msgReactions && Object.keys(msgReactions).length > 0 ? (
            <View style={st.reactionChipRow}>
              {Object.entries(msgReactions).map(([emoji, r]) => (
                <Pressable
                  key={emoji}
                  onPress={(e) => { e.stopPropagation(); handleToggleReaction(item.id, emoji); }}
                  style={[st.reactionBadge, r.liked && st.reactionBadgeLiked]}
                  hitSlop={4}
                >
                  <Text style={st.reactionEmoji}>{emoji}</Text>
                  {r.count > 1 && <Text style={st.reactionCount}>{r.count}</Text>}
                </Pressable>
              ))}
            </View>
          ) : null}
        </Pressable>
        </GlowMessageBubble>
      </View>
    );
  }, [reactions, currentUserId, handleToggleReaction, onAvatarPress]);

  // Sheet kapalıysa render etme
  // ★ v1.7.13.161: isClosingRef — kapanma animasyonu sırasında component'ı unmount etme
  const isOpen = visible || currentSnap.current > 0 || isClosingRef.current;
  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onRequestClose={() => {
        if (keyboardVisible) Keyboard.dismiss();
        else animateTo(SNAP_CLOSED);
      }}
    >
      <View
        ref={keyboardHostRef}
        collapsable={false}
        onLayout={onKeyboardHostLayout}
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
      >
      {/* Backdrop — hafif karartma, tıklayınca kapat */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { zIndex: 55, elevation: 55, opacity: backdropOpacity, backgroundColor: 'rgba(8,12,22,0.45)' }]}
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
            transform: [{ translateY: closeTranslateY }],
          },
        ]}
      >
        {/* ★ 2026-05-05: NotificationDrawer dili — bildirim modalı ailesi.
            3 katman gradient: slate diagonal + üst teal halo + üst-sol soft glow.
            Karakter: teal (oda sohbeti). collapsable={false} ile RN view tree opt. */}
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

        {/* ── Handle bar — sürükle ── */}
        <View {...panResponder.panHandlers} collapsable={false}>
          <View style={st.handle}>
            <View style={st.handleBar} />
          </View>
          <View style={st.header}>
            <View style={st.headerTitleWrap}>
              <Ionicons name="chatbubble-ellipses" size={22} color="#14B8A6" style={st.headerIcon} />
              <Text style={st.headerTitle}>{i18n.t('rooms.chat_drawer_title')}</Text>
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
          contentContainerStyle={[st.listContent, { paddingTop: 4 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          // ★ v284 (16 May 2026): Performans config — uzun mesaj listelerinde JS bridge yükü düşürür
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={11}
          removeClippedSubviews={Platform.OS === 'android'}
        />

        {/* ★ v110.14: WhatsApp tarzı reaction picker — long press anchor pozisyonu üstüne pop */}
        {reactionPicker && (
          <Pressable
            onPress={() => setReactionPicker(null)}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.20)',
              zIndex: 200, elevation: 200,
            }}
          >
            <Animated.View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: Math.max(80, reactionPicker.anchorY - 60),
                left: 0, right: 0,
                alignItems: 'center',
                opacity: reactionPickerScale,
                transform: [
                  { scale: reactionPickerScale.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                  { translateY: reactionPickerScale.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                ],
              }}
            >
              <View style={{
                flexDirection: 'row',
                paddingHorizontal: 6, paddingVertical: 4,
                borderRadius: 28,
                backgroundColor: '#1F2937',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10,
                elevation: 10,
              }}>
                {['❤️', '😂', '👍', '😮', '😢', '🙏'].map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => {
                      handleToggleReaction(reactionPicker.messageId, emoji);
                      setReactionPicker(null);
                    }}
                    style={({ pressed }) => ({
                      width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
                      borderRadius: 18,
                      transform: pressed ? [{ scale: 1.3 }] : [{ scale: 1 }],
                    })}
                    hitSlop={2}
                  >
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          </Pressable>
        )}

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

        {/* ════════════════════════════════════════════════════════════
            INPUT BAR — sheet'in İÇİNDE, doğal flex ile alt kısımda.
            Sheet ile birlikte hareket eder (kapanma, translateY, vs).
            ════════════════════════════════════════════════════════════ */}
        <View style={st.inputBarInline}>
          {pendingGlowStyle && (
            <View style={st.glowBanner}>
              <LinearGradient
                colors={GLOW_STYLES[pendingGlowStyle].bgGradient as any}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={st.glowBannerIcon}>{GLOW_STYLES[pendingGlowStyle].icon}</Text>
              <Text style={st.glowBannerLabel}>{GLOW_STYLES[pendingGlowStyle].label}</Text>
              <View style={st.glowBannerCost}>
                <SPIcon size={11} />
                <Text style={st.glowBannerCostText}>{GLOW_STYLES[pendingGlowStyle].cost} SP</Text>
              </View>
              <Pressable onPress={() => setPendingGlowStyle(null)} hitSlop={8} style={st.glowBannerClose}>
                <Ionicons name="close" size={14} color="rgba(255,255,255,0.85)" />
              </Pressable>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
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
          <Pressable
            onPress={() => {
              inputRef.current?.blur();
              setShowEmojiPicker(false);
              Keyboard.dismiss();
              setTimeout(() => setGlowPickerVisible(true), 220);
            }}
            style={st.iconBtn}
            hitSlop={6}
          >
            <Ionicons name="sparkles" size={20} color={pendingGlowStyle ? '#FBBF24' : 'rgba(255,255,255,0.55)'} />
          </Pressable>
          <TextInput
            ref={inputRef}
            style={st.input}
            placeholder={i18n.t('rooms.chat_input_placeholder')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={chatInput}
            onChangeText={onChangeInput}
            onFocus={() => {
              setShowEmojiPicker(false);
              if (currentSnap.current < SNAP_FULL) {
                animateToRef.current(SNAP_FULL);
              }
            }}
            maxLength={300}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (pendingGlowStyle && onSendGlow && chatInput.trim()) {
                onSendGlow(chatInput, pendingGlowStyle);
                setPendingGlowStyle(null);
              } else {
                onSend();
              }
              inputRef.current?.focus();
            }}
          />
          <Pressable
            style={[st.sendBtn, !chatInput.trim() && { opacity: 0.35 }]}
            onPress={() => {
              if (pendingGlowStyle && onSendGlow && chatInput.trim()) {
                onSendGlow(chatInput, pendingGlowStyle);
                setPendingGlowStyle(null);
              } else {
                onSend();
              }
              inputRef.current?.focus();
            }}
            disabled={!chatInput.trim()}
            hitSlop={6}
          >
            <Ionicons name="send" size={16} color="#FFF" />
          </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* ★ v107: Stil seçim sheet'i */}
      <MessageGlowPickerSheet
        visible={glowPickerVisible}
        onClose={() => setGlowPickerVisible(false)}
        currentSP={currentSP}
        onSelect={(id) => setPendingGlowStyle(id)}
        ownedPremiumIds={ownedPremiumGlowIds}
        onOpenStore={onOpenStore}
      />
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════
const st = StyleSheet.create({
  // ★ v110.14: Sade join/leave notice — balon yok, orta hiza, küçük italik
  joinNotice: {
    paddingVertical: 4,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinNoticeText: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  sheet: {
    position: 'absolute',
    left: 6, right: 6,
    zIndex: 58,
    elevation: 58, // z-order için kritik (oda chat üstte kalmalı)
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a2030',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
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
  // ★ 2026-05-05: NotificationDrawer dili — teal glow ikonda, bold title, count pill.
  headerIcon: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerTitle: {
    fontSize: 15, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  msgCount: {
    fontSize: 10, fontWeight: '800', color: '#5EEAD4', letterSpacing: 0.3,
    paddingHorizontal: 7, paddingVertical: 2, marginLeft: 6,
    borderRadius: 100, minWidth: 20, textAlign: 'center',
    backgroundColor: 'rgba(20,184,166,0.18)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.45)',
    overflow: 'hidden',
  },
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
    flexDirection: 'column',
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
  // ★ v1.7.13.161: Input bar sheet'in içine taşındı — inline style
  inputBarInline: {
    flexDirection: 'column' as const,
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    marginHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(149,161,174,0.15)',
    backgroundColor: 'rgba(55,65,79,0.97)',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  // ★ v107: Mesaj Parlat — pending stil göstergesi (input bar üstünde mini banner)
  glowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  glowBannerIcon: { fontSize: 13 },
  glowBannerLabel: {
    fontSize: 10.5, fontWeight: '900',
    color: '#FFF', letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  glowBannerCost: {
    marginLeft: 'auto',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  glowBannerCostText: {
    fontSize: 10, fontWeight: '800',
    color: '#FAC775',
  },
  glowBannerClose: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    marginRight: 0,
  },

  // ── Messages ──
  // ★ v107: HTML mockup tasarımı — avatar alta hizalı (msg-row alignItems flex-end),
  //   balon içeriğe göre büzülür ama parent'ın %80'ini geçmez (chat balonu doğal davranış).
  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  msgAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5 },
  msgBubble: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  msgName: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  msgText: { fontSize: 13, color: '#FFFFFF', lineHeight: 18 },
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

  // ★ v107 (4 May 2026): Sembol Hediye sistem mesajı — premium kart, tematik renk
  giftSysMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: 8,
    marginVertical: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(15,22,38,0.7)',
    overflow: 'hidden',
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  giftSysEmoji: { fontSize: 22, lineHeight: 26 },
  giftSysTitle: { fontSize: 12, color: '#FFF', letterSpacing: 0.2 },
  giftSysSub: { fontSize: 11, marginTop: 2 },

  // ★ v107 (3 May 2026): Mesaj Parlat — 6 stilli (HTML mockup).
  //   Bg/border transparent (overlay hepsini çiziyor). paddingTop: 30 = 24px header + 6px nefes.
  //   minWidth: 175 → üst header strip (icon + label + cost badge) kısa mesajda da sığsın.
  glowMsgBubble: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingTop: 30,
    minWidth: 175,
  },

  // ★ v110.14: WhatsApp paritesi — balon ALT-SOL köşesinde yarı dış taşkın chip
  reactionChipRow: {
    position: 'absolute',
    bottom: -10,
    left: -4,
    flexDirection: 'row',
    gap: 3,
    zIndex: 5,
    elevation: 5,
  },
  // ★ v110.14: Küçük daire chip — emoji + sayı, koyu arkaplan + ince border
  reactionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 14,
    backgroundColor: '#1F2937',
    borderWidth: 1.5,
    borderColor: '#0B1220',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45, shadowRadius: 2,
    elevation: 4,
    minHeight: 24,
  },
  // ★ v110.14: Liked durum — sadece ince teal vurgu, dolgun kırmızı yerine sade
  reactionBadgeLiked: {
    backgroundColor: '#1F2937',
    borderColor: 'rgba(94,234,212,0.6)',
  },
  reactionEmoji: { fontSize: 10 },
  reactionCount: { fontSize: 10, fontWeight: '800', color: '#E2E8F0', letterSpacing: 0.2 },
});
