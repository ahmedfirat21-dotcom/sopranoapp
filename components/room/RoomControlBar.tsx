import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ★ 2026-04-23 redesign v2: Ana sayfa alt nav (CurvedTabBar) ile birebir tema.
//   Bar: gradient (#2A3A58→#243250→#1A2540) + teal spotlight + parlak beyaz border + radius 22.
//   Active buton: tab bubble gibi 3D gradient + gloss (accent-based).
//   Inactive buton: bg yok, sadece ikon + drop shadow (tab'daki pasif ikon gibi).
const BAR_H = 56;
const BTN_SIZE = 42;
const BUBBLE_SIZE = 42; // active button bubble size
// ★ 2026-04-23: İkon boyutları büyütüldü — zemin aynı, sadece ikonlar iri.
//   MIC_ICON diğerlerinden 4px büyük (primary vurgu). Default diğer tüm ikonlar için.
const ICON_SIZE = 24;
const MIC_ICON = 32;

// ════════════════════════════════════════════════════════════
// Renk tonlama helperları — tab bar ile aynı math
// ════════════════════════════════════════════════════════════
const lighten = (hex: string, pct: number) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xFF) + pct);
  const g = Math.min(255, ((num >> 8) & 0xFF) + pct);
  const b = Math.min(255, (num & 0xFF) + pct);
  return `rgb(${r},${g},${b})`;
};
const darken = (hex: string, pct: number) => lighten(hex, -pct);

// ════════════════════════════════════════════════════════════
// Unified control button — tab bubble estetiğinde
//   Inactive: bg yok, ikon drop-shadow ile pasif
//   Active: 3D gradient bubble (accent'in 3 tonu) + glossy üst
// ════════════════════════════════════════════════════════════
function CtrlBtn({
  icon, onPress, active, accent = '#14B8A6',
  badge, label, mutedColor, iconSize = ICON_SIZE,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
  accent?: string;
  badge?: number;
  label?: string;
  mutedColor?: string;
  iconSize?: number;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handleIn = () => Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true, damping: 8, stiffness: 300 }).start();
  const handleOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }).start();

  // mutedColor varsa (force-mute gibi özel bir durum) → onu primary color olarak kullan
  const filled = !!active || !!mutedColor;
  const fillBase = mutedColor || (active ? accent : null);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handleIn}
      onPressOut={handleOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      style={s.tab}
    >
      <Animated.View style={[s.btnBase, { transform: [{ scale: scaleAnim }] }]}>
        {filled && fillBase ? (
          // ═══ ACTIVE = Tab bubble stili: 3D gradient + gloss + subtle border
          <>
            <LinearGradient
              colors={[lighten(fillBase, 25), fillBase, darken(fillBase, 30)] as any}
              start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
              style={s.bubble}
            >
              <Ionicons name={icon} size={iconSize} color="#FFF" style={s.iconDrop} />
            </LinearGradient>
            {/* glossy üst highlight — cam parlaklığı */}
            <LinearGradient
              colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.08)', 'transparent']}
              locations={[0, 0.6, 1]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={s.bubbleGloss}
              pointerEvents="none"
            />
          </>
        ) : (
          // ═══ INACTIVE = bg yok, sadece ikon + drop-shadow (tab pasif ikon gibi)
          <Ionicons name={icon} size={iconSize} color="#7B8D9F" style={s.iconDrop} />
        )}
      </Animated.View>
      {badge !== undefined && badge > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════
// MicRequestBtn — Listener için özel primary CTA (waiting = pulse + shimmer)
//   Variant'lar: direct_join / raise_hand / waiting / locked
//   Görsel dil CtrlBtn bubble ile tutarlı ama animasyonlu katmanlar ekli.
// ════════════════════════════════════════════════════════════
export type StageAction = 'direct_join' | 'raise_hand' | 'waiting' | 'locked';

function MicRequestBtn({ onPress, stageAction, queuePosition }: {
  onPress: () => void;
  stageAction: StageAction;
  queuePosition?: number;
}) {
  const isActive = stageAction === 'waiting';
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.35, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]));
      const glow = Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]));
      const shimmer = Animated.loop(Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]));
      pulse.start(); glow.start(); shimmer.start();
      return () => { pulse.stop(); glow.stop(); shimmer.stop(); };
    } else {
      pulseAnim.setValue(1); glowAnim.setValue(0); shimmerAnim.setValue(0);
    }
  }, [isActive]);

  const handleIn = () => Animated.spring(scaleAnim, { toValue: 1.12, useNativeDriver: true, damping: 8, stiffness: 300 }).start();
  const handleOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }).start();

  const pulseOpacity = pulseAnim.interpolate({ inputRange: [1, 1.35], outputRange: [0.6, 0] });
  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.35, 0.08] });

  const variant = (() => {
    switch (stageAction) {
      case 'direct_join':
        return { icon: 'mic' as const, colors: ['#34D399', '#14B8A6', '#0F766E'] as [string, string, string], label: 'Sahneye çık (serbest mod)', ringColor: '#14B8A6' };
      case 'waiting':
        return { icon: 'hand-left' as const, colors: ['#FBBF24', '#F59E0B', '#D97706'] as [string, string, string], label: queuePosition && queuePosition > 0 ? `Sıradasın (${queuePosition}. sıra) — dokun ve iptal et` : 'Onay bekleniyor — dokun ve iptal et', ringColor: '#FBBF24' };
      case 'locked':
        return { icon: 'lock-closed' as const, colors: ['#475569', '#334155', '#1E293B'] as [string, string, string], label: 'Sahne kilitli — sadece oda sahibi konuşmacı seçer', ringColor: '#475569' };
      case 'raise_hand':
      default:
        return { icon: 'hand-left' as const, colors: ['#64748B', '#475569', '#334155'] as [string, string, string], label: 'El kaldır (sahne talebi gönder)', ringColor: '#64748B' };
    }
  })();

  return (
    <Pressable onPress={onPress} onPressIn={handleIn} onPressOut={handleOut}
      accessibilityRole="button"
      accessibilityLabel={variant.label}
      accessibilityState={{ selected: isActive, disabled: stageAction === 'locked' }}
      style={s.tab}>
      <View style={micS.wrap}>
        {isActive && (
          <Animated.View style={[micS.pulseRing, { borderColor: variant.ringColor, transform: [{ scale: pulseAnim }], opacity: pulseOpacity }]} />
        )}
        <Animated.View style={[s.btnBase, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient colors={variant.colors as any} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.bubble}>
            <Ionicons name={variant.icon} size={ICON_SIZE} color="#FFF" style={s.iconDrop} />
          </LinearGradient>
          <LinearGradient
            colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.08)', 'transparent']}
            locations={[0, 0.6, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={s.bubbleGloss}
            pointerEvents="none"
          />
          {isActive && <Animated.View style={[micS.shimmer, { opacity: shimmerOpacity }]} />}
          {isActive && <Animated.View style={[micS.innerGlow, { opacity: glowAnim, backgroundColor: `${variant.ringColor}40` }]} />}
        </Animated.View>
        {isActive && queuePosition && queuePosition > 0 && (
          <View style={micS.queueBadge}><Text style={micS.queueBadgeText}>{queuePosition}</Text></View>
        )}
      </View>
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════
// Props + Main component
// ════════════════════════════════════════════════════════════
interface Props {
  isMicOn: boolean; isCameraOn: boolean; showCamera: boolean;
  isHandRaised: boolean; handBadgeCount: number; canModerate: boolean;
  chatBadgeCount: number; isChatOpen: boolean;
  isListener?: boolean;
  isRoomMuted?: boolean;
  isOwnerInListenerMode?: boolean;
  isModInListenerMode?: boolean;
  stageAction?: StageAction;
  stageQueuePosition?: number;
  isForcedMuted?: boolean;
  isChatInputDisabled?: boolean;
  onJoinStagePress?: () => void;
  onMicPress: () => void; onCameraPress: () => void;
  onHandPress: () => void;
  onChatPress: () => void; onPlusPress: () => void;
  onMuteRoomPress?: () => void;
  onLeavePress?: () => void;
  dmBadgeCount?: number;
  onDmPress?: () => void;
  isDmOpen?: boolean;
  isPlusOpen?: boolean;
}

export default function RoomControlBar({
  isMicOn, isCameraOn, showCamera, isHandRaised, isRoomMuted,
  handBadgeCount, canModerate, chatBadgeCount, isChatOpen,
  isListener, isOwnerInListenerMode, isModInListenerMode,
  isForcedMuted,
  stageAction, stageQueuePosition,
  onMicPress, onCameraPress,
  onHandPress, onChatPress, onPlusPress, onMuteRoomPress,
  onJoinStagePress,
  dmBadgeCount, onDmPress, isDmOpen, isPlusOpen,
}: Props) {
  const resolvedStageAction: StageAction = stageAction ?? (isHandRaised ? 'waiting' : 'raise_hand');

  const handleMicPress = () => {
    if (isForcedMuted) {
      try { require('../Toast').showToast({ title: '🔇 Sessize alındınız', message: 'Moderatör tarafından sustruldunuz.', type: 'warning' }); } catch {}
      return;
    }
    onMicPress();
  };

  return (
    <View style={s.wrap}>
      <View style={s.bar}>
        {/* ★ Gradient zemin — tab bar ile birebir */}
        <LinearGradient
          colors={['#2A3A58', '#243250', '#1A2540']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.barGradient}
          pointerEvents="none"
        />
        {/* ★ Teal spotlight — sol üstten hafif teal akıtma (premium aksan) */}
        <LinearGradient
          colors={['rgba(20,184,166,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={s.barGradient}
          pointerEvents="none"
        />

        {/* Chat */}
        <CtrlBtn
          icon={isChatOpen ? 'chatbubble' : 'chatbubble-outline'}
          onPress={onChatPress}
          badge={chatBadgeCount}
          active={isChatOpen}
          accent="#3B82F6"
          label="Sohbet"
        />

        {/* Mic / Cam (speaker) — veya Volume / MicReq (listener)
            ★ 2026-04-23: Speaker için sıra değişti: önce Kamera, sonra Mic (mic daha büyük = primary). */}
        {isListener ? (
          <>
            <CtrlBtn
              icon={isRoomMuted ? 'volume-mute' : 'volume-high'}
              onPress={onMuteRoomPress || (() => {})}
              active={!isRoomMuted}
              accent="#14B8A6"
              label={isRoomMuted ? 'Oda sesini aç' : 'Oda sesini kapat'}
            />

            {isOwnerInListenerMode ? (
              <CtrlBtn icon="mic" onPress={onJoinStagePress || (() => {})} active accent="#D4AF37" label="Sahneye geri dön" iconSize={MIC_ICON} />
            ) : isModInListenerMode ? (
              <CtrlBtn icon="shield-checkmark" onPress={onJoinStagePress || (() => {})} active accent="#A78BFA" label="Sahneye geri dön" />
            ) : (
              <MicRequestBtn onPress={onHandPress} stageAction={resolvedStageAction} queuePosition={stageQueuePosition} />
            )}
          </>
        ) : (
          <>
            {/* Kamera önce — mic'ten sonra geldi, şimdi sola alındı */}
            {showCamera && (
              <CtrlBtn
                icon={isCameraOn ? 'videocam' : 'videocam-off'}
                onPress={onCameraPress}
                active={isCameraOn}
                accent="#14B8A6"
                label={isCameraOn ? 'Kamerayı kapat' : 'Kamerayı aç'}
              />
            )}

            {/* Mic primary — kameranın sağında, diğerlerinden 4px daha büyük */}
            <CtrlBtn
              icon={isForcedMuted ? 'mic-off' : (isMicOn ? 'mic' : 'mic-off')}
              onPress={handleMicPress}
              active={isMicOn && !isForcedMuted}
              accent="#14B8A6"
              mutedColor={isForcedMuted ? '#991B1B' : undefined}
              label={isForcedMuted ? 'Mikrofon kapalı (susturuldun)' : (isMicOn ? 'Mikrofonu kapat' : 'Mikrofonu aç')}
              iconSize={MIC_ICON}
            />
          </>
        )}

        {/* Moderasyon kuyruğu — sadece host/moderatörde */}
        {canModerate && (
          <CtrlBtn
            icon="hand-right"
            onPress={onHandPress}
            badge={handBadgeCount}
            active={handBadgeCount > 0}
            accent="#FBBF24"
            label={`Mikrofon istek kuyruğu${handBadgeCount > 0 ? `, ${handBadgeCount} bekleyen` : ''}`}
          />
        )}

        {/* DM */}
        {onDmPress && (
          <CtrlBtn
            icon="mail-outline"
            onPress={onDmPress}
            badge={dmBadgeCount}
            active={isDmOpen}
            accent="#8B5CF6"
            label="Mesajlar"
          />
        )}

        {/* Plus */}
        <CtrlBtn
          icon="add-circle-outline"
          onPress={onPlusPress}
          active={isPlusOpen}
          accent="#14B8A6"
          label="Daha fazla seçenek"
        />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════
// ★ MicRequestBtn animasyon katmanları
// ═══════════════════════════════════════════════════
const micS = StyleSheet.create({
  wrap: { width: BUBBLE_SIZE + 2, height: BUBBLE_SIZE + 2, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 2.5, borderColor: '#FBBF24',
  },
  shimmer: { ...StyleSheet.absoluteFillObject, borderRadius: BUBBLE_SIZE / 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  innerGlow: { ...StyleSheet.absoluteFillObject, borderRadius: BUBBLE_SIZE / 2 },
  queueBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#F59E0B',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: '#1A2540',
  },
  queueBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
});

// ═══════════════════════════════════════════════════
// ★ Ana bar stilleri — CurvedTabBar ile birebir tema
// ═══════════════════════════════════════════════════
const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 6,
    paddingBottom: 4,
    alignItems: 'center',
  },
  // ★ Bar — tab bar dimensionları (h 56, radius 22, parlak border, deep shadow)
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    height: BAR_H,
    paddingHorizontal: 6,
    borderRadius: 22,
    backgroundColor: '#1F2E48',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 14,
  },
  barGradient: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ★ Button base — inactive'de bg yok; active'de LinearGradient bubble dolgusu
  btnBase: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  // ★ Active button gradient bubble — 3D derinlik + border
  bubble: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
    borderRadius: BUBBLE_SIZE / 2,
  },
  bubbleGloss: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '55%',
    borderTopLeftRadius: BUBBLE_SIZE / 2,
    borderTopRightRadius: BUBBLE_SIZE / 2,
  },
  // ★ Icon drop-shadow — pasif ve aktifte aynı, derinlik hissi
  iconDrop: {
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  // ★ Badge — dark border bar bg'ye kaynaşsın
  badge: {
    position: 'absolute', top: 0, right: 2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#1A2540',
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
});
