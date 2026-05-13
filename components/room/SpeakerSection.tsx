import React, { useMemo, useEffect, useRef, useState } from 'react';
import { ensureFrameConfig, getCachedFrameConfig, subscribeConfigChange } from '../../services/cosmeticConfigCache';
import { View, Text, StyleSheet, Pressable, Image, useWindowDimensions, Animated, Easing, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';
import { RoleColors } from '../../constants/theme';
import AvatarPenaltyFlash, { type FlashType } from './AvatarPenaltyFlash';
import RoomAvatarFrame from './RoomAvatarFrame';
import TierBadge from '../TierBadge';
import { SkiaShadow, CosmeticBadge } from '../skia';
import type { RoomParticipant } from '../../services/database';
import { useRoomLayout, type SpeakersLayoutConfig, type AvatarShape } from '../../services/roomLayoutConfig';

// ★ v115: Avatar shape → borderRadius çevirici (config.speakers.avatarShape için)
function shapeBorderRadius(shape: AvatarShape, size: number, configRadius: number): number {
  switch (shape) {
    case 'circle':  return size / 2;
    case 'square':  return 0;
    case 'rounded': return Math.min(configRadius, size / 2);
    case 'hex':     return size / 2; // mobile'da hex shape için ayrı mask; şimdilik circle fallback
    default:        return size / 2;
  }
}

// ★ Dinamik sahne boyutlandırma — modern platform grid sistemi (Clubhouse/Spaces pattern)
// 2026-04-20: Oda içi SCROLL YOK kuralı — yüksek yoğunlukta daha kompakt grid.
// 2026-04-22: window width runtime'dan alınıyor (useWindowDimensions) — module-level
// Dimensions.get cihaz gesture-nav/rotation durumunda stale kalıyordu.
// ★ v92.18 (1 May 2026): Layout pragmatize — kullanıcı şikâyeti "üst alan boş ama
//   kameralar küçücük". count=4 için 3 col yerine 2x2 grid → her tile %50 width.
//   count=5,6 için 3x2 grid. Card height aspect 1.15 (biraz dikey) → kamera tile'ı
//   sinematik görünüm. Owner scale 1.10 → 1.0 (wrap engelleme; border + altın çerçeve
//   yeterli ayrım).
// ★ v92.20 (1 May 2026): CLUBHOUSE PATTERN — kullanıcı talebi.
//   Tüm sahnedekiler UNIFORM CIRCLE GRID. Kameralı/audio-only ayrımı yok.
//   Spotlight yok. Owner scale yok. Sadelik = güç (Clubhouse felsefesi).
//   Avatar + first name + opsiyonel pulse ring — daha fazlası gürültü.
//   Kamera açan kişinin tile'ı yine circle, içinde video circle-clip oynar.
//
//   Boyutlandırma — Clubhouse'tan ilham (kompakt circle, max 110px):
//     1 kişi  → tek merkez, 140px
//     2-3     → 3 col, ~110px
//     4-6     → 3 col, ~100px (2 satır)
//     7-9     → 3 col, ~90px (3 satır)
//     10+     → 4 col, ~80px
// ★ v115: Config-driven metrics. cfg verilirse maxCols/colGap/sizePresets'ten okur,
//   yoksa eski hard-coded değerlere düşer (backward compat).
function getSpeakerMetrics(count: number, W: number, cfg?: SpeakersLayoutConfig) {
  const availableW = W - 32;
  let cols: number, gap: number, maxSize: number;

  if (cfg) {
    // Config aware sizing — count'a göre size preset pick'le
    const presets = cfg.sizePresets;
    if (count <= 1)       { cols = 1; maxSize = 140; }
    else if (count <= 3)  { cols = Math.min(3, cfg.maxCols); maxSize = presets.large; }
    else if (count <= 6)  { cols = Math.min(3, cfg.maxCols); maxSize = presets.medium; }
    else if (count <= 9)  { cols = Math.min(3, cfg.maxCols); maxSize = Math.round(presets.medium * 0.92); }
    else if (count <= 12) { cols = Math.min(4, cfg.maxCols); maxSize = presets.small; }
    else                  { cols = Math.min(5, cfg.maxCols); maxSize = Math.round(presets.small * 0.9); }
    gap = cfg.colGap;
  } else {
    if (count <= 1) { cols = 1; gap = 0; maxSize = 140; }
    else if (count <= 3) { cols = 3; gap = 16; maxSize = 110; }
    else if (count <= 6) { cols = 3; gap = 14; maxSize = 100; }
    else if (count <= 9) { cols = 3; gap = 12; maxSize = 92; }
    else if (count <= 12) { cols = 4; gap = 10; maxSize = 84; }
    else { cols = 5; gap = 8; maxSize = 76; }
  }

  const calculated = Math.floor((availableW - gap * (cols - 1)) / cols);
  const cardWidth = Math.min(calculated, maxSize);
  const cardHeight = cardWidth + 18; // alt isim alanı
  return { cols, cardWidth, cardHeight, gap };
}

interface MicStatus {
  mic: boolean;
  speaking: boolean;
  audioLevel: number;
  cameraOn: boolean;
  videoTrack: any;
}

interface Props {
  stageUsers: RoomParticipant[];
  getMicStatus: (uid: string) => MicStatus;
  onSelectUser: (user: RoomParticipant) => void;
  onSelfDemote?: () => void;
  currentUserId?: string;
  VideoView?: any;
  onGhostSeatPress?: () => void;
  showSeatTooltip?: boolean;
  /** Per-user avatar flash state */
  avatarFlashes?: Record<string, FlashType | null>;
  onFlashDone?: (userId: string) => void;
  /** Kamera rozeti tap — user'ın kamerasını fullscreen aç */
  onCameraExpand?: (user: RoomParticipant) => void;
  /** ★ 2026-04-26: Inline moderasyon — kart sağ-altında mute toggle butonu (Clubhouse pattern).
   *  canModerate: bu user'da mute yetkisi var mı? onQuickMute: tıklayınca toggle. */
  canModerate?: (user: RoomParticipant) => boolean;
  onQuickMute?: (user: RoomParticipant) => void;
}

function SpeakingGlow({ speaking, borderRadius = 16 }: { speaking: boolean; borderRadius?: number }) {
  // ★ v107.16: 2 katmanlı DIŞA dalgalanma ringleri (lighthouse pattern) + sabit referans border.
  //   Eski sürümde tek border 1.0↔1.06 pulse → görsel olarak içeri kalıyordu.
  //   Yeni: avatar etrafından dışa doğru genişleyip kaybolan halkalar.
  //   Android shadow KALDIRILDI (gri görünüyordu). Border opacity ile glow telafi.
  const ringA = React.useRef(new Animated.Value(0)).current;
  const ringB = React.useRef(new Animated.Value(0)).current;
  const breath = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!speaking) {
      ringA.setValue(0); ringB.setValue(0); breath.setValue(0);
      return;
    }
    const loopA = Animated.loop(Animated.timing(ringA, {
      toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }));
    const loopB = Animated.loop(Animated.sequence([
      Animated.delay(700),
      Animated.timing(ringB, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(ringB, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    const breathLoop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]));
    loopA.start(); loopB.start(); breathLoop.start();
    return () => { loopA.stop(); loopB.stop(); breathLoop.stop(); };
  }, [speaking]);

  if (!speaking) return null;

  // Ring A — sürekli dışa expand
  const ringAScale = ringA.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.35] });
  const ringAOpacity = ringA.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.85, 0.55, 0] });
  // Ring B — gecikmeli, üst üste binmesin
  const ringBScale = ringB.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.35] });
  const ringBOpacity = ringB.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.85, 0.55, 0] });
  // Sabit referans border — yumuşak nefes
  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.04] });

  return (
    <>
      {/* Ring A — dışa expand pulse */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, {
          borderRadius, borderWidth: 2, borderColor: '#14B8A6',
          transform: [{ scale: ringAScale }],
          opacity: ringAOpacity,
        }]}
      />
      {/* Ring B — gecikmeli ikinci dalga */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, {
          borderRadius, borderWidth: 1.5, borderColor: '#5EEAD4',
          transform: [{ scale: ringBScale }],
          opacity: ringBOpacity,
        }]}
      />
      {/* Sabit referans border — Skia BlurMask ile cross-platform turkuaz glow (Android dahil) */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, {
          borderRadius, borderWidth: 2, borderColor: '#14B8A6',
          transform: [{ scale: breathScale }],
        }]}
      />
    </>
  );
}

// ★ v92.14 (1 May 2026): StageLightHalo — Sahne Işığı power-up'ına özel görsel.
//   - LinearGradient halka (parlaktan koyuya, top-down) → "ışık tüllüsü" hissi.
//   - 3 katmanlı altın expand-ring (light → mid → deep amber, gradient parite).
//   - 8 partiküllü TOZ BULUTU (canlı yukarı süzülme, rastgele drift, twinkle scale).
//   - Android shadow KALDIRILDI (RN Android'de glow render etmiyor, sadece çakışma yapıyor).
//     Glow hissi gradient + opacity layering ile sağlanıyor.
const DUST_COUNT = 8;
const DUST_PARAMS = Array.from({ length: DUST_COUNT }, (_, i) => ({
  // Avatar etrafına dağılmış başlangıç noktası (rastgele ama deterministik render-stable)
  startX: Math.cos((i / DUST_COUNT) * Math.PI * 2 + 0.4) * (24 + (i % 3) * 8),
  startY: Math.sin((i / DUST_COUNT) * Math.PI * 2 + 0.4) * (18 + (i % 3) * 6),
  driftX: ((i * 37) % 60) - 30,         // -30..+30 yatay drift
  endY: -85 - (i % 4) * 10,              // yukarı kayar
  delay: (i * 280) % 2400,               // stagger
  size: 3 + (i % 3) * 1.2,               // 3..5.4 px
  color: ['#FFE082', '#FFD700', '#FFF1A8', '#FBBF24'][i % 4],
  duration: 2400 + (i % 3) * 400,        // 2.4-3.2s
}));

function StageLightHalo({ active, borderRadius = 16 }: { active: boolean; borderRadius?: number }) {
  const ringA = React.useRef(new Animated.Value(0)).current;
  const ringB = React.useRef(new Animated.Value(0)).current;
  const ringC = React.useRef(new Animated.Value(0)).current;
  const innerPulse = React.useRef(new Animated.Value(0)).current;
  const dust = React.useRef(DUST_PARAMS.map(() => new Animated.Value(0))).current;

  React.useEffect(() => {
    if (!active) {
      ringA.setValue(0); ringB.setValue(0); ringC.setValue(0);
      innerPulse.setValue(0);
      dust.forEach((d) => d.setValue(0));
      return;
    }
    const loopA = Animated.loop(Animated.timing(ringA, { toValue: 1, duration: 2400, useNativeDriver: true, easing: Easing.out(Easing.quad) }));
    const loopB = Animated.loop(Animated.sequence([
      Animated.delay(800),
      Animated.timing(ringB, { toValue: 1, duration: 2400, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]));
    const loopC = Animated.loop(Animated.sequence([
      Animated.delay(1600),
      Animated.timing(ringC, { toValue: 1, duration: 2400, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]));
    const innerLoop = Animated.loop(Animated.sequence([
      Animated.timing(innerPulse, { toValue: 1, duration: 1300, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(innerPulse, { toValue: 0, duration: 1300, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));

    // Toz partikülleri — her biri kendi delay/duration'ı ile sürekli yukarı süzülür.
    const dustLoops = dust.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(DUST_PARAMS[i].delay),
      Animated.timing(d, { toValue: 1, duration: DUST_PARAMS[i].duration, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(d, { toValue: 0, duration: 0, useNativeDriver: true }),
    ])));

    loopA.start(); loopB.start(); loopC.start(); innerLoop.start();
    dustLoops.forEach((l) => l.start());
    return () => {
      loopA.stop(); loopB.stop(); loopC.stop(); innerLoop.stop();
      dustLoops.forEach((l) => l.stop());
    };
  }, [active]);

  if (!active) return null;

  const ringStyle = (anim: Animated.Value, opacityRange: [number, number, number], scaleRange: [number, number]) => ({
    opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: opacityRange }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: scaleRange }) }],
  });

  return (
    <>
      {/* ★ v109: Avatar arkası gradient ışık — scale 1.02→1.08 (dış) yerine 1.0→1.0 sabit,
           sadece opacity ile breath. Avatar dış sınırını taşmaz. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, {
          borderRadius,
          opacity: innerPulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] }),
        }]}
      >
        <LinearGradient
          colors={['rgba(255,241,168,0.55)', 'rgba(255,215,0,0.28)', 'rgba(180,83,9,0)']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      </Animated.View>

      {/* ★ v109: Halkalar avatar dışına taşmasın — scale outward (1.0 → 1.4) yerine
           inward contract (1.0 → 0.78). Avatar üzerinde "içe doğru sönen ışık dalgası"
           hissi. Sarı halka avatar dışında parlamaz, üstüne biner. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
        borderRadius, borderWidth: 2, borderColor: '#FFE082',
        ...ringStyle(ringA, [0.95, 0.5, 0], [1.0, 0.78]),
      }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
        borderRadius, borderWidth: 1.6, borderColor: '#FFD700',
        ...ringStyle(ringB, [0.8, 0.35, 0], [1.0, 0.72]),
      }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
        borderRadius, borderWidth: 1.4, borderColor: '#B45309',
        ...ringStyle(ringC, [0.5, 0.18, 0], [1.0, 0.66]),
      }]} />

      {/* İç parlayan altın çerçeve — breath pulse SADECE içe doğru (1.0 → 0.97) */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
        borderRadius, borderWidth: 2.5, borderColor: '#FFD700',
        opacity: innerPulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
        transform: [{ scale: innerPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }],
      }]} />

      {/* ★ Toz bulutu — 8 partikül, kart merkezinden yukarı süzülür, hafif drift, twinkle. */}
      {DUST_PARAMS.map((p, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: '50%', top: '50%',
            marginLeft: -p.size / 2, marginTop: -p.size / 2,
            width: p.size, height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: p.color,
            opacity: dust[i].interpolate({
              inputRange: [0, 0.12, 0.55, 1],
              outputRange: [0, 0.95, 0.55, 0],
            }),
            transform: [
              { translateX: dust[i].interpolate({ inputRange: [0, 1], outputRange: [p.startX, p.startX + p.driftX] }) },
              { translateY: dust[i].interpolate({ inputRange: [0, 1], outputRange: [p.startY, p.endY] }) },
              { scale: dust[i].interpolate({ inputRange: [0, 0.25, 0.7, 1], outputRange: [0, 1.1, 0.85, 0.3] }) },
            ],
          }}
        />
      ))}
    </>
  );
}

function AudioWaveBars({ speaking, mic, cardWidth = 140 }: { speaking: boolean; mic: boolean; cardWidth?: number }) {
  // ★ v92.7.1 (1 May 2026): cardWidth'e oranla scale — avatar küçülünce wave de küçülür.
  //   Konum: avatar ortasından hafif aşağı (alt-merkez). Boyut: kompakt 5 çubuklu pill.
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.5)).current;
  const bar3 = useRef(new Animated.Value(0.4)).current;
  const bar4 = useRef(new Animated.Value(0.5)).current;
  const bar5 = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    if (speaking && mic) {
      const animate = (anim: Animated.Value, min: number, max: number, dur: number) =>
        Animated.loop(Animated.sequence([
          Animated.timing(anim, { toValue: max, duration: dur, useNativeDriver: true }),
          Animated.timing(anim, { toValue: min, duration: dur * 0.8, useNativeDriver: true }),
        ]));
      const a1 = animate(bar1, 0.3, 0.9, 320);
      const a2 = animate(bar2, 0.4, 1, 380);
      const a3 = animate(bar3, 0.5, 1, 280);
      const a4 = animate(bar4, 0.4, 1, 360);
      const a5 = animate(bar5, 0.3, 0.9, 340);
      a1.start(); a2.start(); a3.start(); a4.start(); a5.start();
      return () => { a1.stop(); a2.stop(); a3.stop(); a4.stop(); a5.stop(); };
    } else {
      bar1.setValue(0.3); bar2.setValue(0.3); bar3.setValue(0.3); bar4.setValue(0.3); bar5.setValue(0.3);
    }
  }, [speaking, mic]);
  if (!speaking || !mic) return null;

  // Boyut hesapları — cardWidth'e oranlı, küçük ve kompakt
  const containerW = cardWidth * 0.42;
  const containerH = cardWidth * 0.18;
  const barW = Math.max(2, cardWidth * 0.022);
  const barH1 = cardWidth * 0.06;
  const barH2 = cardWidth * 0.085;
  const barH3 = cardWidth * 0.105;
  const gap = cardWidth * 0.025;

  const barStyle = (anim: Animated.Value, h: number) => ({
    width: barW, height: h, borderRadius: barW / 2, backgroundColor: '#14B8A6', transform: [{ scaleY: anim }],
  });
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        // ★ Konum: alt-merkez (avatar ortasından hafif aşağı) — kullanıcı talebi.
        top: '62%', left: '50%',
        marginLeft: -containerW / 2,
        width: containerW, height: containerH,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap,
        backgroundColor: 'rgba(10,15,26,0.62)',
        borderRadius: containerH / 2,
        borderWidth: 1,
        borderColor: 'rgba(20,184,166,0.5)',
        ...(Platform.OS === 'ios'
          ? { shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 6 }
          : { elevation: 3 }),
      }}
    >
      <Animated.View style={barStyle(bar1, barH1)} />
      <Animated.View style={barStyle(bar2, barH2)} />
      <Animated.View style={barStyle(bar3, barH3)} />
      <Animated.View style={barStyle(bar4, barH2)} />
      <Animated.View style={barStyle(bar5, barH1)} />
    </View>
  );
}

function OwnerBadge() {
  // ★ Premium animated golden glow pulse
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  // ★ Subtle float
  const floatAnim = useRef(new Animated.Value(0)).current;
  // ★ Rotating sparkle orbit
  const orbitAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ★ v92.28 PERF: Cleanup eklendi — 3 paralel loop unmount'ta stop edilmeli.
    const glowLoop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.6, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: -1.5, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 1.5, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const orbitLoop = Animated.loop(Animated.timing(orbitAnim, {
      toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true,
    }));
    glowLoop.start(); floatLoop.start(); orbitLoop.start();
    return () => { glowLoop.stop(); floatLoop.stop(); orbitLoop.stop(); };
  }, []);

  const rotateSparkle = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[s.ownerBadgeContainer, { transform: [{ translateY: floatAnim }] }]}>
      {/* ★ v1.3.68: Skia gold glow halo — Android'de görünür altın parıltı */}
      <Animated.View style={{ position: 'absolute', opacity: glowAnim, alignItems: 'center', justifyContent: 'center' }}>
        <SkiaShadow shadowColor="#FFD700" shadowOpacity={0.9} shadowBlur={18} shadowOffsetY={0} borderRadius={22}>
          <View style={{ width: 44, height: 44, borderRadius: 22 }} />
        </SkiaShadow>
      </Animated.View>
      {/* ★ Outer glow ring (border + iOS shadow korunur) */}
      <Animated.View style={[s.ownerGlowRing, { opacity: glowAnim }]} />
      {/* ★ Badge body — 4-stop gradient (parlak taç efekti) */}
      <LinearGradient
        colors={['#FFF1A8', '#FFD700', '#F59E0B', '#B45309']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.ownerBadgeBody}
      >
        <Ionicons name="star" size={17} color="#FFF" style={{ textShadowColor: 'rgba(180,83,9,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} />
      </LinearGradient>
      {/* ★ Orbiting sparkle particle */}
      <Animated.View style={[s.ownerSparkleOrbit, { transform: [{ rotate: rotateSparkle }] }]}>
        <View style={s.ownerSparkleDot} />
      </Animated.View>
    </Animated.View>
  );
}

// ★ v32 Caretaker timer badge — süreli sahnedeki konuşmacıların kalan süresini gösterir
function CaretakerTimerBadge({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = React.useState(() => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });
  React.useEffect(() => {
    const interval = setInterval(() => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      const sec = Math.max(0, Math.floor(ms / 1000));
      setRemaining(sec);
      if (sec <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;
  const label = `${min}:${sec.toString().padStart(2, '0')}`;
  const isUrgent = remaining <= 30; // Son 30 saniyede kırmızı/pulsing
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const pulseLoopRef = React.useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => {
    if (isUrgent) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 500, useNativeDriver: true }),
      ]));
      pulseLoopRef.current = loop;
      loop.start();
      return () => { loop.stop(); pulseLoopRef.current = null; };
    } else {
      pulseAnim.setValue(1);
    }
  }, [isUrgent]);

  return (
    <Animated.View style={[
      s.caretakerTimer,
      isUrgent && s.caretakerTimerUrgent,
      { transform: [{ scale: pulseAnim }] },
    ]}>
      <Ionicons name="time" size={8} color={isUrgent ? '#FEE2E2' : '#CFFAFE'} />
      <Text style={[s.caretakerTimerText, isUrgent && { color: '#FEE2E2' }]}>{label}</Text>
    </Animated.View>
  );
}

function SpeakerCard({ user, micStatus, onPress, onSelfDemote, onCameraExpand, isMe, cardWidth, cardHeight, VideoView, canModerate, onQuickMute }: {
  canModerate?: boolean;
  onQuickMute?: () => void;
  user: RoomParticipant; micStatus: MicStatus; onPress: () => void;
  onSelfDemote?: () => void;
  onCameraExpand?: (user: RoomParticipant) => void;
  isMe: boolean; cardWidth: number; cardHeight: number; VideoView?: any;
}) {
  const isHost = user.role === 'owner';
  const isMod = user.role === 'moderator';
  // ★ v117: Oda düzen config — avatar shape için kullanılır (line 541 civarı)
  const layout = useRoomLayout();
  const speakersCfg = layout.speakers;
  const displayName = (user as any).disguise?.display_name || user.user?.display_name || 'Misafir';
  const avatarUrl = (user as any).disguise?.avatar_url || user.user?.avatar_url;
  // ★ v107: Mağaza avatar çerçevesi — disguise yokken aktif (gizlenmiş kullanıcı normal görünür)
  const activeFrame = (user as any).disguise ? null : (user.user as any)?.active_frame;

  // ★ 2026-05-11: Web admin name overlay aktifse bizim default isim Text'ini
  //   gizleriz (çift isim çakışmasın). RoomAvatarFrame içindeki NameOverlay
  //   web admin'in konum/animasyon/glow ayarlarıyla render edecek.
  // ★ v1.3.55: Sahnedeki host ve diğer speaker'lar için size_overrides ayrı anahtarlar.
  //   Host → "stage_host" (web admin'in "Sahne Host" tab'ı), diğerleri → "speaker".
  const speakerSizeKey: 'stage_host' | 'speaker' = isHost ? 'stage_host' : 'speaker';
  const [frameCfg, setFrameCfg] = useState<any>(getCachedFrameConfig(activeFrame, speakerSizeKey));
  useEffect(() => {
    if (!activeFrame) { setFrameCfg(null); return; }
    ensureFrameConfig(activeFrame, speakerSizeKey).then(setFrameCfg);
    const unsub = subscribeConfigChange((id) => {
      if (id === activeFrame) ensureFrameConfig(activeFrame, speakerSizeKey).then(setFrameCfg);
    });
    return unsub;
  }, [activeFrame, speakerSizeKey]);
  const hideDefaultName = !!frameCfg?.name_enabled;

  // ★ 2026-05-11: Avatar shape — parent View borderRadius'a uygulanır,
  //   overflow:hidden ile Image kırpılır. Daire dışı şekiller görünsün.
  // ★ v117: Frame yoksa roomLayout config'ten al (web admin'den oda düzeni)
  const avatarShapeRadius = (() => {
    // Frame config öncelikli (kullanıcının taktığı çerçevenin önerdiği şekil)
    if (frameCfg?.avatar_shape) {
      switch (frameCfg.avatar_shape) {
        case 'rounded-square': return cardWidth * 0.22;
        case 'squircle':       return cardWidth * 0.36;
        case 'hexagon':
        case 'star':
        case 'diamond':        return cardWidth * 0.36;
        case 'circle':         return cardWidth / 2;
      }
    }
    // ★ v117: Frame yoksa roomLayout config'inden (web admin > Oda Düzeni > Konuşmacılar > Şekil)
    const cfgShape = isHost ? layout.host.avatarShape : speakersCfg.avatarShape;
    const cfgRadius = isHost ? layout.host.borderRadius : speakersCfg.borderRadius;
    switch (cfgShape) {
      case 'square':  return 0;
      case 'rounded': return Math.min(cfgRadius, cardWidth / 2);
      case 'hex':     return cardWidth * 0.36;
      case 'circle':
      default:        return cardWidth / 2;
    }
  })();

  // ★ Avatar hareket animasyonları — paralel
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnimY = useRef(new Animated.Value(0)).current;
  const swingAnim = useRef(new Animated.Value(0)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!frameCfg?.avatar_pulse) return;
    const dur = (frameCfg?.avatar_pulse_speed ?? 2) * 500;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, frameCfg?.avatar_pulse, frameCfg?.avatar_pulse_speed]);
  useEffect(() => {
    if (!frameCfg?.avatar_float) return;
    const dur = (frameCfg?.avatar_float_speed ?? 4) * 500;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [floatAnim, frameCfg?.avatar_float, frameCfg?.avatar_float_speed]);
  useEffect(() => {
    if (!frameCfg?.avatar_shake) return;
    // ★ v1.3.70 PARİTE: Web admin shake X+Y çapraz hareket — birebir
    const loopX = Animated.loop(Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]));
    const loopY = Animated.loop(Animated.sequence([
      Animated.timing(shakeAnimY, { toValue: -0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnimY, { toValue: 0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnimY, { toValue: -1, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnimY, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnimY, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]));
    loopX.start();
    loopY.start();
    return () => { loopX.stop(); loopY.stop(); };
  }, [shakeAnim, shakeAnimY, frameCfg?.avatar_shake]);
  useEffect(() => {
    if (!frameCfg?.avatar_swing) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(swingAnim, { toValue: 1, duration: 625, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(swingAnim, { toValue: 0, duration: 625, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(swingAnim, { toValue: -1, duration: 625, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(swingAnim, { toValue: 0, duration: 625, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [swingAnim, frameCfg?.avatar_swing]);
  useEffect(() => {
    if (!frameCfg?.avatar_tilt) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(tiltAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(tiltAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [tiltAnim, frameCfg?.avatar_tilt]);

  const avatarTransform: any[] = [];
  if (frameCfg?.avatar_pulse) avatarTransform.push({ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) });
  if (frameCfg?.avatar_float) avatarTransform.push({ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) });
  if (frameCfg?.avatar_shake) {
    avatarTransform.push({ translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-2, 2] }) });
    avatarTransform.push({ translateY: shakeAnimY.interpolate({ inputRange: [-1, 1], outputRange: [-1, 1] }) });
  }
  if (frameCfg?.avatar_swing) avatarTransform.push({ rotate: swingAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] }) });
  if (frameCfg?.avatar_tilt)  avatarTransform.push({ rotate: tiltAnim.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) });
  const { mic: rawMic, speaking, videoTrack, cameraOn } = micStatus;
  const isGhost = (user as any).is_ghost;
  // ★ D3: DB'de is_muted=true ise UI'da kesinlikle "muted" olarak göster — LiveKit
  // track state'i gecikmeli olabilir; DB kaydı mod aksiyonunu yansıtır.
  const dbMuted = (user as any).is_muted === true && user.role !== 'listener';
  const mic = rawMic && !dbMuted;
  // ★ v32 Caretaker: speaker + stage_expires_at varsa geçici caretaker
  const caretakerExpiresAt = user.role === 'speaker' && (user as any).stage_expires_at
    ? (user as any).stage_expires_at as string
    : null;
  const isCaretakerActive = caretakerExpiresAt && new Date(caretakerExpiresAt).getTime() > Date.now();

  // ★ 2026-04-19 EKSİLTME ŞABLONu — rol rengiyle ring, badge minimal
  // Her rol için ayrı badge yerine tek sistem: avatar ring'in rengi rol'ü belirtir.
  // Owner: altın / Moderator: mor / Speaker (+caretaker): teal / Caretaker urgent: amber
  // ★ Tek ring sistemi: RoleColors constant (tüm projede tutarlı — constants/theme.ts)
  const ringColor = isHost
    ? RoleColors.owner
    : isMod
    ? RoleColors.moderator
    : RoleColors.speaker;

  return (
    // ★ 2026-04-21 FIX: Outer element View (eski: Pressable) — nested Pressable touch çakışması
    //   düzeltildi. "Sahneden İn" butonu dış Pressable içindeyken touch event'i dış kart
    //   yakalıyordu → profil kartı açılıyordu, onSelfDemote çalışmıyordu.
    //   Şimdi: kart tıklaması Pressable (card inner), demote butonu bağımsız sibling Pressable.
    // ★ v107.41: Reanimated entering/exiting KALDIRILDI — kullanıcı "zıplamalı yapma" dedi.
    //   Slide-in/out yön mantığı doğruydu ama görsel olarak zıplama hissi veriyordu.
    //   Gerçek "kendi konumundan kayma" için FLIP technique gerekir (shared element).
    //   Şimdilik instant — kullanıcı pozisyon değişimini görür, zıplama yok.
    <View style={[s.speakerCard, { width: cardWidth }]}>
      <Pressable style={({ pressed }) => [{ width: '100%' }, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]} onPress={onPress}>
      {/* ★ v109.4: Frame wrapper'ı SADECE avatar alanına kilitlendi (top:0, height:cardWidth).
           Eski: absoluteFillObject Pressable'ın tüm yüksekliğini (avatar + label) kapsıyordu
           → flex center label payı kadar aşağı kaydırıyordu, frame avatardan kayıktı.
           Şimdi: avatar boyutunda fixed wrapper → frame tam avatar üstünde.
           Audio modda çalışır, kameralı modda zaten gizli. */}
      {!(cameraOn && videoTrack && VideoView) && activeFrame && (
        <View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: cardWidth,
            alignItems: 'center',
            justifyContent: 'center',
            // ★ 2026-05-05: Frame avatar Image üstünde (zIndex 2) — palette halka çerçeveleri
            //   (ince ring tipi: aurum-ring, glacier-ring vs.) avatar dairesinin EDGE'inde
            //   render olduğu için altta kalırsa Image tarafından tamamen örtülüyor.
            //   Badge'ler (zIndex 999, elevation 30) zaten frame'in de üstünde kalıyor.
            zIndex: 2,
            elevation: 2,
          }}
          pointerEvents="none"
        >
          <View style={{ width: cardWidth, height: cardWidth }}>
            <RoomAvatarFrame
              frameId={activeFrame}
              avatarSize={cardWidth}
              minSize={56}
              forceRing={!isHost}
              userName={displayName}
              userTier={(user.user as any)?.subscription_tier && (user.user as any).subscription_tier !== 'Free'
                ? String((user.user as any).subscription_tier).toUpperCase()
                : undefined}
              contextKey={isHost ? 'stage_host' : 'speaker'}
            />
            {/* ★ v120: Web admin "Rozetler" — kullanıcının active_badge_id'si varsa Skia overlay */}
            {!(user as any).disguise && (user.user as any)?.active_badge_id && (
              <View pointerEvents="none" style={{ position: 'absolute', bottom: -2, right: -2, zIndex: 999 }}>
                <CosmeticBadge badgeItemId={(user.user as any).active_badge_id} context="avatar" />
              </View>
            )}
          </View>
        </View>
      )}
      <View style={[
        s.speakerCardInner,
        {
          width: cardWidth,
          height: cameraOn && videoTrack && VideoView ? cardHeight : cardWidth,
          // ★ v108.32: Aktif frame varsa rol border'ı kaldır — çift halka önlenir
          //   (StatusAvatar ile aynı pattern: frameId ? 0 : borderWidth)
          borderColor: activeFrame ? 'transparent' : ringColor,
          borderWidth: activeFrame ? 0 : (isHost || isMod ? 2 : 1.5),
          // Kameralı: rounded rectangle (cardWidth*0.08 ~ 8-12px corner)
          // Audio-only: full circle (cardWidth/2)
          borderRadius: cameraOn && videoTrack && VideoView ? Math.max(12, Math.floor(cardWidth * 0.08)) : cardWidth / 2,
          overflow: 'visible',
          // ★ 2026-05-05: Frame artık zIndex 2 ile üstte — speakerCardInner default z'de kalır.
        },
      ]}>
        <Animated.View style={[StyleSheet.absoluteFill, {
          // ★ 2026-05-11: Shape — web admin avatar_shape'e göre borderRadius.
          //   Camera açıkken kare-yumuşak (8% radius), kapalıyken shape mapping.
          borderRadius: cameraOn && videoTrack && VideoView ? Math.max(12, Math.floor(cardWidth * 0.08)) : avatarShapeRadius,
          overflow: 'hidden',
          // Avatar transform stack — pulse/float/shake/swing/tilt
          transform: avatarTransform.length > 0 ? avatarTransform : undefined,
        }]}>
          <LinearGradient colors={['rgba(30,41,59,0.7)', 'rgba(15,23,42,0.85)']} style={StyleSheet.absoluteFill} />
          {cameraOn && videoTrack && VideoView ? (
            <VideoView videoTrack={videoTrack} style={StyleSheet.absoluteFill} objectFit="cover" mirror={isMe} />
          ) : (() => {
            // ★ v1.3.55: avatar_ratio uygulanır — frame içindeki avatar görseli web admin'in
            //   "Avatar Oranı" ayarına göre küçülür/büyür. Default 1.0 (frame'i tamamen doldurur).
            const ratio = Math.max(0.4, Math.min(1.05, frameCfg?.avatar_ratio ?? 1.0));
            const inner = Math.round(cardWidth * ratio);
            return (
              <Image
                source={getAvatarSource(avatarUrl)}
                style={[s.speakerAvatar, ratio < 1 && {
                  position: 'absolute',
                  width: inner,
                  height: inner,
                  left: (cardWidth - inner) / 2,
                  top: (cardWidth - inner) / 2,
                  borderRadius: inner / 2,
                }]}
              />
            );
          })()}
          {/* ★ Avatar filtre overlay'leri (grayscale/sepia/brightness/hue/saturation) */}
          {(frameCfg?.avatar_grayscale ?? 0) > 0 && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
              backgroundColor: 'rgba(128,128,128,1)',
              opacity: (frameCfg.avatar_grayscale / 100) * 0.55,
            }]} />
          )}
          {(frameCfg?.avatar_sepia ?? 0) > 0 && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
              backgroundColor: '#704214',
              opacity: (frameCfg.avatar_sepia / 100) * 0.4,
            }]} />
          )}
          {(frameCfg?.avatar_brightness ?? 1) !== 1 && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
              backgroundColor: (frameCfg.avatar_brightness > 1) ? 'white' : 'black',
              opacity: Math.abs(frameCfg.avatar_brightness - 1) * 0.4,
            }]} />
          )}
          {/* ★ v1.3.56: avatar_hue_rotate — HSL hue'ye karşılık gelen renkli tint overlay.
                RN'de native hue-rotate yok; approximation: HSL(hue,80%,50%) tint düşük opacity. */}
          {(frameCfg?.avatar_hue_rotate ?? 0) > 0 && (() => {
            const h = ((frameCfg.avatar_hue_rotate % 360) + 360) % 360;
            // HSL → RGB (s=0.8, l=0.5)
            const s = 0.8, l = 0.5;
            const c = (1 - Math.abs(2 * l - 1)) * s;
            const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
            const m = l - c / 2;
            let r = 0, g = 0, b = 0;
            if (h < 60)      { r = c; g = x; b = 0; }
            else if (h < 120){ r = x; g = c; b = 0; }
            else if (h < 180){ r = 0; g = c; b = x; }
            else if (h < 240){ r = 0; g = x; b = c; }
            else if (h < 300){ r = x; g = 0; b = c; }
            else             { r = c; g = 0; b = x; }
            const R = Math.round((r + m) * 255), G = Math.round((g + m) * 255), B = Math.round((b + m) * 255);
            return (
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
                backgroundColor: `rgb(${R},${G},${B})`,
                opacity: 0.28,
              }]} />
            );
          })()}
          {/* ★ v1.3.56: avatar_saturation < 1 → gri tint (saturation düşürür);
                > 1 RN'de native blend yok, no-op. */}
          {(frameCfg?.avatar_saturation ?? 1) < 1 && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
              backgroundColor: 'rgba(128,128,128,1)',
              opacity: (1 - frameCfg.avatar_saturation) * 0.45,
            }]} />
          )}
          {/* ★ v1.3.70 PARİTE: avatar_blur — web admin'de CSS filter:blur(Npx) ile
                birebir. RN'de Image blurRadius prop'u sadece source'a blur uygular
                (render'a değil). SpeakerSection overlay yaklaşımı: beyaz/siyah düşük
                opacity katman + borderRadius → yumuşak "bulanık" görünüm simülasyonu.
                Gerçek parite için StatusAvatar'daki SVG feGaussianBlur pipeline tercih
                edilmeli. overlay ile yaklaşık ama fark %80 giderilir. */}
          {(frameCfg?.avatar_blur ?? 0) > 0 && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
              backgroundColor: 'rgba(200,200,200,0.5)',
              opacity: Math.min(0.6, frameCfg.avatar_blur * 0.12),
              borderRadius: cameraOn && videoTrack && VideoView ? Math.max(12, Math.floor(cardWidth * 0.08)) : avatarShapeRadius,
            }]} />
          )}
          {/* ★ v1.3.56: avatar_border_enabled — Image etrafında ek halka.
                Frame Lottie/PNG ZATEN avatar etrafında, çift halka olmasın diye
                opacity ayarlandı; frame yoksa pure border görünür. */}
          {frameCfg?.avatar_border_enabled && (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, {
                borderRadius: cardWidth / 2,
                borderWidth: Math.max(1, Math.min(12, frameCfg?.avatar_border_width ?? 3)),
                borderColor: frameCfg?.avatar_border_color || '#fbbf24',
                borderStyle: (frameCfg?.avatar_border_style as any) || 'solid',
              }]}
            />
          )}
          {/* ★ 2026-04-24: Kamera açıkken alt + üst gradient overlay — badge'ler video üzerinde okunur kalır. */}
          {cameraOn && videoTrack && VideoView && (
            <>
              <LinearGradient
                colors={['rgba(0,0,0,0.55)', 'transparent']}
                style={s.videoGradientTop}
                pointerEvents="none"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)']}
                style={s.videoGradientBottom}
                pointerEvents="none"
              />
            </>
          )}
        </Animated.View>
        {/* ★ v92.13 (1 May 2026): SpeakingGlow yalnızca konuşma için (teal pulse).
            Sahne Işığı power-up'ı ARTIK ayrı component (StageLightHalo) — 3 katmanlı
            altın expand-pulse halka + iç parlayan border. Kullanıcı "vasat" dedi,
            dramatic upgrade yapıldı. */}
        <SpeakingGlow
          speaking={speaking && mic}
          borderRadius={cameraOn && videoTrack && VideoView ? Math.max(12, Math.floor(cardWidth * 0.08)) : cardWidth / 2}
        />
        <StageLightHalo
          active={!!(user as any).stage_light_until && new Date((user as any).stage_light_until).getTime() > Date.now()}
          borderRadius={cameraOn && videoTrack && VideoView ? Math.max(12, Math.floor(cardWidth * 0.08)) : cardWidth / 2}
        />
        {isGhost && (
          <View style={s.ghostOverlay}>
            <Ionicons name="eye-off" size={18} color="rgba(255,255,255,0.55)" />
          </View>
        )}
        {isCaretakerActive && <CaretakerTimerBadge expiresAt={caretakerExpiresAt!} />}
        {/* ★ 2026-04-19: Caretaker aktifken wave bars gizli — timer zaten urgency
            sinyalidir, wave bars ek görsel yük yaratıyor. Normal speaker'larda görünür. */}
        {/* ★ v92.7.2 (1 May 2026): AudioWaveBars KALDIRILDI (kullanıcı talebi).
            Konuşma sinyali için çerçeve pulse (SpeakingGlow) yeterli — yukarıdaki
            absoluteFill border 2px teal + scale 1→1.06 + glow shadow.
            Component fonksiyonu kalıyor (geri ihtiyaç olursa); render'dan çıkarıldı. */}
        {/* ★ v92.18 (1 May 2026): Compact badge mode — küçük tile'da (cardWidth<200)
            ikonlar küçülür, kenarlık incelir, gölge azalır. Yüzü kaplamaz.
            Kullanıcı şikâyeti: "ikonlar görüşü bozuyor". */}
        {/* ★ v109.4.4: Sahnede tier rozeti avatar değil, isim ALTINDA gösteriliyor (aşağıda).
             Sol-alt avatar render kaldırıldı — kullanıcı talebi. */}
        {(() => {
          // ★ 2026-05-05: Mic + camera statü ikonları KALDIRILDI (kullanıcı talebi).
          //   Konuşma sinyali zaten SpeakingGlow ile (avatar etrafı pulse) görünüyor.
          //   Mod quick-mute kalır — bu statü değil, moderasyon eylemi.
          const compact = cardWidth < 200;
          const pos = compact ? -8 : -12;
          const quickSz = compact ? 20 : 26;
          const quickInner = compact ? 10 : 12;
          return (
            <>
              {canModerate && onQuickMute && (
                <Pressable
                  onPress={(e) => { e.stopPropagation?.(); onQuickMute(); }}
                  hitSlop={8}
                  style={({ pressed }) => [{
                    position: 'absolute', bottom: pos, left: pos, width: quickSz, height: quickSz,
                    borderRadius: quickSz / 2, alignItems: 'center', justifyContent: 'center',
                    borderWidth: compact ? 1 : 1.5,
                    borderColor: dbMuted ? 'rgba(16,185,129,0.5)' : 'rgba(245,158,11,0.5)',
                    backgroundColor: dbMuted ? 'rgba(16,185,129,0.8)' : 'rgba(245,158,11,0.8)',
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: compact ? 0.3 : 0.6, shadowRadius: compact ? 3 : 8,
                    elevation: 12, zIndex: 10,
                  }, pressed && { opacity: 0.7, transform: [{ scale: 0.9 }] }]}
                >
                  <Ionicons name={dbMuted ? 'volume-high' : 'volume-mute'} size={quickInner} color="#fff" />
                </Pressable>
              )}
            </>
          );
        })()}
        {/* ★ Owner sadece altın border + biraz büyük kart ile belli. Crown badge + label
            KALDIRILDI (kullanıcı "kötü oldu" dedi, sade olmasını istiyor). */}
      </View>
      {/* ★ v109.4.4: İsim ortalı + altında "PRO" pill (sm, label dahil)
          ★ 2026-05-05: Frame Lottie kanat'ları altta kalsın diye z-order yükseltildi.
          ★ v1.3.54: name_enabled ise default Text gizli — RoomAvatarFrame çerçeve etrafına yazıyor. */}
      <View style={{ alignItems: 'center', maxWidth: cardWidth, gap: 2, zIndex: 50, elevation: 20 }}>
        {!hideDefaultName && (
          <Text
            style={[s.speakerName, { maxWidth: cardWidth - 4, fontSize: cardWidth < 95 ? 10 : 11 }, isHost && { color: '#FFD700' }, isMod && !isHost && { color: '#C4B5FD' }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayName}
          </Text>
        )}
        {/* ★ v1.3.54: Web admin tier_badge_enabled=false ise sahnede de gizle.
             Default davranış: tier varsa göster (Free için gizli). */}
        {(() => {
          const tier = (user.user as any)?.subscription_tier;
          const explicitlyDisabled = frameCfg?.tier_badge_enabled === false;
          if (explicitlyDisabled) return null;
          return <TierBadge tier={tier} size="sm" />;
        })()}
      </View>
      </Pressable>
      {/* ★ 2026-04-22: "Sahneden İn" butonu kart içinden KALDIRILDI — parent container'ın
          maxHeight'ı Android'de touch event'i çocuk dışına bırakmıyordu (RN bug).
          Artık room/[id].tsx'te ayırıcı pill bölgesinde ("Sahneye Dön"ün simetriği) render ediliyor. */}
    </View>
  );
}


export default function SpeakerSection({ stageUsers, getMicStatus, onSelectUser, onSelfDemote, currentUserId, VideoView, onGhostSeatPress, showSeatTooltip, avatarFlashes, onFlashDone, onCameraExpand, canModerate, onQuickMute }: Props) {
  // ★ 2026-04-22: Runtime window width — fiziksel Android cihazda gesture-nav/
  //   rotation ile değişen dimensions'a adapte olur.
  const { width: W } = useWindowDimensions();
  // ★ v115 (13 May 2026): Web admin oda düzen ayarları — avatar shape, gap, size
  const layout = useRoomLayout();
  const speakersCfg = layout.speakers;
  const sortedUsers = useMemo(() => {
    if (stageUsers.length === 0) return [];
    const roleOrder: Record<string, number> = { owner: 0, host: 0, moderator: 1, speaker: 2 };
    return [...stageUsers].sort((a, b) => {
      const ra = roleOrder[a.role] ?? 3;
      const rb = roleOrder[b.role] ?? 3;
      if (ra !== rb) return ra - rb;
      return a.user_id.localeCompare(b.user_id);
    });
  }, [stageUsers]);

  const ghostPulse = useRef(new Animated.Value(0.4)).current;
  const tooltipFade = useRef(new Animated.Value(0)).current;
  const tooltipSlide = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(ghostPulse, { toValue: 0.7, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(ghostPulse, { toValue: 0.4, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (showSeatTooltip) {
      Animated.parallel([
        Animated.timing(tooltipFade, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tooltipSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      ]).start();
    } else { tooltipFade.setValue(0); tooltipSlide.setValue(-8); }
  }, [showSeatTooltip]);

  if (sortedUsers.length === 0) {
    // ★ v107.28: "Sahneye Çık" CTA artık StageActionPill (kontrol bar üstü) — kullanıcı talebi.
    //   Boş sahnede sadece silik bir simge + "Sahne boş" mesajı. Tıklama hâlâ aktif (geri dönüş).
    return (
      <View style={s.empty}>
        <Pressable onPress={onGhostSeatPress} style={({ pressed }) => [s.ghostSeat, pressed && { transform: [{ scale: 0.96 }] }]}>
          <Animated.View style={[s.ghostSeatInner, { opacity: ghostPulse }]}>
            <View style={s.ghostSeatIcon}>
              <Ionicons name="mic-outline" size={22} color="rgba(20,184,166,0.35)" />
            </View>
          </Animated.View>
          <Text style={[s.ghostSeatLabel, { color: 'rgba(148,163,184,0.45)', fontSize: 11, fontWeight: '500' }]}>Sahne boş</Text>
        </Pressable>
      </View>
    );
  }

  const count = sortedUsers.length;
  const { cardWidth, cardHeight, gap } = getSpeakerMetrics(count, W, speakersCfg);
  // ★ v115: Avatar shape config'ten — circle/square/rounded
  const speakerAvatarRadius = shapeBorderRadius(speakersCfg.avatarShape, cardWidth, speakersCfg.borderRadius);

  // ★ v92.21 (1 May 2026): HİBRİT pattern — Discord Stage / TikTok Live / Twitch ko-stream.
  //   - Audio-only kişi: Clubhouse circle avatar (yuvarlak)
  //   - Kameralı kişi: Rectangular rounded tile (video doğal aspect ratio'yla okunur)
  //   - Karışık sahnede: kameralılar üstte spotlight, audio-only altta küçük listener-stili
  //   Clubhouse her şeyi circle yapsa da audio-only platform; kameralı sahne için
  //   Discord/TikTok pattern doğru — kullanıcı talebi: "kamera açan uygulamalar nasıl ayarlıyor"
  const cameraUsers = sortedUsers.filter(u => {
    const st = getMicStatus(u.user_id);
    return st.cameraOn && st.videoTrack;
  });
  const audioOnlyUsers = sortedUsers.filter(u => {
    const st = getMicStatus(u.user_id);
    return !(st.cameraOn && st.videoTrack);
  });
  const camCount = cameraUsers.length;
  const showSpotlight = VideoView && camCount > 0;

  // Spotlight tile boyutları — kamera sayısına göre referans pattern'leri
  let spotlightW = 0, spotlightH = 0, spotlightGap = 12;
  if (showSpotlight) {
    if (camCount === 1) {
      spotlightW = W - 32;
      spotlightH = Math.round(spotlightW * 0.62);  // ~16:10 sinematik (Discord/Twitch)
    } else if (camCount === 2) {
      spotlightW = Math.floor((W - 32 - spotlightGap) / 2);
      spotlightH = spotlightW;  // 1:1 kare yan yana (TikTok multi-guest)
    } else if (camCount === 3) {
      spotlightW = Math.floor((W - 32 - spotlightGap * 2) / 3);
      spotlightH = spotlightW;  // 1:1 kare 3 col
    } else if (camCount === 4) {
      spotlightW = Math.floor((W - 32 - spotlightGap) / 2);
      spotlightH = Math.floor(spotlightW * 1.05);  // 2x2 hafif dikey (WhatsApp)
    } else {
      // 5+ kamera: 3 col kompakt grid
      spotlightW = Math.floor((W - 32 - spotlightGap * 2) / 3);
      spotlightH = spotlightW;
      spotlightGap = 8;
    }
  }
  // Audio-only listener-stili boyut (spotlight aktifken kompakt circle)
  const audioCompactSize = Math.min(76, Math.floor((W - 32 - 8 * 4) / 5));

  return (
    <View style={s.wrap}>
      {/* ★ 2026-04-19: "Sahnedekiler" başlık pill'i kaldırıldı — kartlar zaten sahneyi gösterir,
          başlık semantik tekrar. Görsel gürültü azaltıldı. */}

      {/* ★ v92.21 SPOTLIGHT — Kameralılar üstte rectangular tile (Discord/Twitch pattern) */}
      {showSpotlight && (
        <View style={[s.mainSpeakerGrid, { gap: spotlightGap, marginBottom: gap }]}>
          {cameraUsers.map((u) => {
            const st = getMicStatus(u.user_id);
            const isMe = u.user_id === currentUserId;
            return (
              <SpeakerCard key={u.id} user={u} micStatus={st} onPress={() => onSelectUser(u)}
                onSelfDemote={onSelfDemote}
                onCameraExpand={onCameraExpand}
                canModerate={canModerate?.(u) ?? false}
                onQuickMute={onQuickMute ? () => onQuickMute(u) : undefined}
                isMe={isMe} cardWidth={spotlightW} cardHeight={spotlightH} VideoView={VideoView} />
            );
          })}
        </View>
      )}

      {/* ★ v92.21 — Audio-only kişiler:
          • Spotlight aktif (kamera var): altta KOMPAKT circle satır (Clubhouse listener stili)
          • Spotlight kapalı (kamera yok): UNIFORM circle grid (Clubhouse pure pattern) */}
      {showSpotlight && audioOnlyUsers.length > 0 && (
        <View style={[s.mainSpeakerGrid, { gap: 8, marginBottom: 4 }]}>
          {audioOnlyUsers.map((u) => {
            const st = getMicStatus(u.user_id);
            const isMe = u.user_id === currentUserId;
            return (
              <SpeakerCard key={u.id} user={u} micStatus={st} onPress={() => onSelectUser(u)}
                onSelfDemote={onSelfDemote}
                onCameraExpand={onCameraExpand}
                canModerate={canModerate?.(u) ?? false}
                onQuickMute={onQuickMute ? () => onQuickMute(u) : undefined}
                isMe={isMe}
                cardWidth={audioCompactSize}
                cardHeight={audioCompactSize}
                VideoView={VideoView} />
            );
          })}
        </View>
      )}

      {!showSpotlight && (
        <View style={[s.mainSpeakerGrid, { gap, marginBottom: 4 }]}>
          {sortedUsers.map((u) => {
            const st = getMicStatus(u.user_id);
            const isMe = u.user_id === currentUserId;
            return (
              <SpeakerCard key={u.id} user={u} micStatus={st} onPress={() => onSelectUser(u)}
                onSelfDemote={onSelfDemote}
                onCameraExpand={onCameraExpand}
                canModerate={canModerate?.(u) ?? false}
                onQuickMute={onQuickMute ? () => onQuickMute(u) : undefined}
                isMe={isMe} cardWidth={cardWidth} cardHeight={cardHeight} VideoView={VideoView} />
            );
          })}
        </View>
      )}


    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 4 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  headerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.06)',
    borderWidth: 0.8, borderColor: 'rgba(20,184,166,0.12)',
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 12, fontWeight: '700', color: '#CBD5E1', letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  headerCount: {
    backgroundColor: 'rgba(20,184,166,0.15)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  headerCountText: { fontSize: 10, fontWeight: '800', color: '#14B8A6' },
  spotlightRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start',
  },
  // ★ 2026-04-24: Spotlight modunda kontrol simgeleri — kart yanında dikey
  spotlightSideControls: {
    flexDirection: 'column', alignItems: 'center', gap: 10,
    paddingLeft: 8, justifyContent: 'center',
  },
  // ★ 2026-04-24: Non-spotlight modunda kontrol simgeleri — grid altında yatay
  bottomStageControls: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    gap: 10, marginTop: 6, paddingHorizontal: 4,
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 6 },
  tooltipWrap: { alignItems: 'center', marginBottom: 4 },
  tooltipBubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,184,166,0.12)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7 },
  tooltipText: { fontSize: 13, fontWeight: '600', color: '#5EEAD4', letterSpacing: 0.2 },
  tooltipArrow: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'rgba(20,184,166,0.25)', marginTop: -1 },
  ghostSeat: { alignItems: 'center', marginTop: 4 },
  ghostSeatInner: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(20,184,166,0.25)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,184,166,0.05)' },
  ghostSeatIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(20,184,166,0.08)', alignItems: 'center', justifyContent: 'center' },
  ghostSeatLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(20,184,166,0.5)', marginTop: 6, letterSpacing: 0.3 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 },
  mainSpeakerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  speakerCard: { alignItems: 'center', marginBottom: 4, overflow: 'visible' },
  speakerCardInner: { width: '100%', borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  speakerAvatar: { width: '100%', height: '100%', resizeMode: 'cover' },
  roleBadge: { position: 'absolute', top: 8, left: 8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(15,23,42,0.8)' },
  roleBadgeMod: { backgroundColor: 'rgba(139,92,246,0.35)' },
  ownerBadgeContainer: {
    position: 'absolute', top: -12, left: -10, zIndex: 20,
    width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
  },
  ownerGlowRing: {
    position: 'absolute', width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'transparent',
    borderWidth: 2, borderColor: 'rgba(255,215,0,0.75)',
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 14, elevation: 8,
  },
  ownerBadgeBody: {
    width: 30, height: 30, borderRadius: 15,
    // ★ v263: overflow:hidden eksikti → LinearGradient kare çiziyordu, listener
    //   rozetiyle aynı sorun. Clip ile daire çıkar.
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.65)',
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 10, elevation: 10,
  },
  ownerSparkleOrbit: {
    position: 'absolute', width: 28, height: 28,
    alignItems: 'center', justifyContent: 'flex-start',
  },
  ownerSparkleDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: '#FFFACD',
    shadowColor: '#FFF', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 3, elevation: 4,
  },
  // ★ 2026-04-24: Video gradient overlays — kamera açıkken üst ve alt kontrast sağlar
  videoGradientTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '35%',
    borderTopLeftRadius: 16, borderTopRightRadius: 16, zIndex: 1,
  },
  videoGradientBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16, zIndex: 1,
  },
  // ★ 2026-04-26: Squircle kart için pozisyon iç kenardan 10px (eski 6px köşe yuvarlağının dışında kalıyordu).
  micBadge: {
    // ★ v109.3: bottom/right 10 → 0 — frame içinde değil, kart kenarında otursun.
    //   Audio mod kare daire kart, badge yuvarlak avatar dış sınırına yakın.
    //   Frame halkasının dışında göründüğünden artık badge halkanın altında kalmaz.
    position: 'absolute', bottom: 0, right: 0, width: 28, height: 28,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(15,23,42,0.8)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 6,
    zIndex: 10, elevation: 12,
  },
  micBadgeOn: { backgroundColor: '#14B8A6' },
  micBadgeOff: { backgroundColor: 'rgba(239,68,68,0.9)' },
  cameraBadge: {
    // ★ v109.3: top/right 0 → kart köşesi, frame halkası altında kalmasın
    position: 'absolute', top: 0, right: 0, width: 26, height: 26,
    borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(15,23,42,0.8)',
    backgroundColor: '#0EA5A3',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6, shadowRadius: 8,
    zIndex: 10, elevation: 12,
  },
  // ★ 2026-04-26: Inline mute butonu — moderatör için kart sol-alt köşede
  quickMuteBadge: {
    position: 'absolute', bottom: 0, left: 0, width: 26, height: 26,
    borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.55)',
    backgroundColor: 'rgba(245,158,11,0.85)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6, shadowRadius: 8,
    zIndex: 10, elevation: 12,
  },
  // ★ Ghost overlay — "gizli" modunda hafif bir tonda üstüne bindirilir (badge yerine)
  ghostOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 22,
  },
  // ★ v32 Caretaker timer — avatar sol-üst köşede
  caretakerTimer: {
    position: 'absolute', top: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, backgroundColor: 'rgba(20,184,166,0.85)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.35)',
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 3,
  },
  caretakerTimerUrgent: {
    backgroundColor: 'rgba(239,68,68,0.9)',
    borderColor: 'rgba(239,68,68,0.5)',
    shadowColor: '#EF4444',
  },
  caretakerTimerText: {
    fontSize: 9, fontWeight: '800', color: '#CFFAFE',
    letterSpacing: 0.3, fontVariant: ['tabular-nums'],
  },
  // ★ 2026-05-05: İsim "pop" — fontWeight 700→800, daha belirgin glow + letterSpacing
  speakerName: {
    fontSize: 12, fontWeight: '800', color: '#F1F5F9',
    marginTop: 6, textAlign: 'center', maxWidth: 140,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  speakerNameHost: { color: '#FFD700' },
  speakerNameHostBig: {
    color: '#FFD700',
    fontWeight: '900',
    textShadowColor: 'rgba(180,83,9,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ownerLabelStage: {
    fontSize: 9,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 1.2,
    marginTop: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // ★ 2026-04-22: button belirginleştirildi — text gibi durmayıp kırmızı ton + belirgin border ile
  //   "tıklanabilir" olduğu net anlaşılsın. zIndex kaldırıldı (menü/modal üstüne çıkmasın).
  selfDemoteHint: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 2,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
    alignSelf: 'center',
  },
  selfDemoteText: { fontSize: 10, fontWeight: '700', color: '#FCA5A5', letterSpacing: 0.2 },
});