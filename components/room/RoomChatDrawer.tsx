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
import MessageGlowPickerSheet from './MessageGlowPickerSheet';
import SPIcon from '../SPIcon';

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
}

export default function RoomChatDrawer({
  visible, messages, chatInput, onChangeInput, onSend, onClose, onSendRaw, currentUserId, roomId, onAvatarPress,
  currentSP = 0, onSendGlow,
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // ★ v107: Mesaj Parlat — picker visibility + seçilen stil (sonraki mesaja uygulanır)
  const [glowPickerVisible, setGlowPickerVisible] = useState(false);
  const [pendingGlowStyle, setPendingGlowStyle] = useState<GlowStyleId | null>(null);

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
    // ★ v107 (3 May 2026): 6 stilli mesaj parlat — metadata.glow_style: 'gold'|'heart'|'neon'|'fire'|'celebration'|'galaxy'
    //   Backwards-compat: metadata.glow=true → 'gold' fallback.
    const glowStyleId: GlowStyleId | null =
      ((item as any).metadata?.glow_style as GlowStyleId) ||
      ((item as any).metadata?.glow ? 'gold' : null);
    const isGlowMsg = !!glowStyleId;
    const glowCfg = glowStyleId ? GLOW_STYLES[glowStyleId] : null;

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
          {/* ★ v107: 6 stilli Mesaj Parlat (HTML mockup) — overlay arka plan + üst header strip */}
          {glowStyleId && (
            <>
              <GlowMessageOverlay style={glowStyleId} />
              <GlowHeader style={glowStyleId} />
            </>
          )}
          {/* İsim de tıklanır — avatar gibi profil sheet'i açar */}
          <Pressable
            onPress={() => { if (senderUid && onAvatarPress) onAvatarPress(senderUid); }}
            hitSlop={4}
          >
            <Text style={[st.msgName, { color: glowCfg ? glowCfg.nameColor : nameColor }]}>{item.profiles?.display_name || 'Kullanıcı'}</Text>
          </Pressable>
          {isGifSafe ? (
            <Image source={{ uri: gifMatch![1] }} style={{ width: 220, height: 165, borderRadius: 12 }} resizeMode="cover" />
          ) : emojiOnly ? (
            <Text style={{ fontSize: 36, lineHeight: 44 }}>{content}</Text>
          ) : (
            <Text style={[st.msgText, glowCfg && { color: glowCfg.textColor, fontWeight: '500' }]}>{content}</Text>
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
        {/* ★ v107: Pending glow style banner — kullanıcı bir stil seçti, henüz mesaj göndermedi.
            Cancel için X butonu. Mesaj gönderilince state otomatik temizlenir. */}
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
        {/* ★ v107: Mesaj Parlat — picker aç */}
        <Pressable
          onPress={() => { inputRef.current?.blur(); setShowEmojiPicker(false); setGlowPickerVisible(true); }}
          style={st.iconBtn}
          hitSlop={6}
        >
          <Ionicons name="sparkles" size={20} color={pendingGlowStyle ? '#FBBF24' : 'rgba(255,255,255,0.55)'} />
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
      </Animated.View>

      {/* ★ v107: Stil seçim sheet'i */}
      <MessageGlowPickerSheet
        visible={glowPickerVisible}
        onClose={() => setGlowPickerVisible(false)}
        currentSP={currentSP}
        onSelect={(id) => setPendingGlowStyle(id)}
      />
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
    // ★ v92.23 (1 May 2026): drop shadow — iOS shadowColor/Opacity, Android elevation: 58 (yukarıda)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
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
    flexDirection: 'column',  // ★ v107: banner üstte + input row altta
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

  // ★ v107 (3 May 2026): Mesaj Parlat — 6 stilli (HTML mockup).
  //   Bg/border transparent (overlay hepsini çiziyor). paddingTop: 30 = 24px header + 6px nefes.
  //   minWidth: 175 → üst header strip (icon + label + cost badge) kısa mesajda da sığsın.
  glowMsgBubble: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingTop: 30,
    minWidth: 175,
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
