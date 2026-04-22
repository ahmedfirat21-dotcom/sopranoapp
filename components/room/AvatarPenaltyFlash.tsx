/**
 * AvatarPenaltyFlash — Avatar üzerinde geçici moderasyon simgesi
 * ═══════════════════════════════════════════════════════════════
 * Bir moderasyon aksiyonu gerçekleştiğinde hedef kullanıcının avatarının
 * üstünde kısa süreli animasyonlu flash simge gösterir.
 * Tüm katılımcılar tarafından görülür.
 *
 * ★ 2026-04-20: 'ban' ve 'permban' için DRAMATİK animasyon eklendi —
 *   tam avatar kırmızı overlay + sallanma + rotasyon + yanıp sönen "BANLANDI" yazısı.
 *   Normal mute/unmute/chat flash'ları eskisi gibi sade kalır.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type FlashType = 'mute' | 'unmute' | 'chat_mute' | 'chat_unmute' | 'kick' | 'ban' | 'permban' | 'demote' | 'promote';

type FlashConfig = {
  icon: string;
  color: string;
  bg: string;
};

const FLASH_MAP: Record<FlashType, FlashConfig> = {
  mute:        { icon: 'volume-mute',       color: '#EF4444', bg: 'rgba(239,68,68,0.85)'   },
  unmute:      { icon: 'volume-high',       color: '#22C55E', bg: 'rgba(34,197,94,0.85)'   },
  chat_mute:   { icon: 'chatbox-outline',   color: '#FFF',    bg: 'rgba(249,115,22,0.85)'  },
  chat_unmute: { icon: 'chatbox',           color: '#FFF',    bg: 'rgba(34,197,94,0.85)'   },
  kick:        { icon: 'exit',              color: '#FFF',    bg: 'rgba(220,38,38,0.95)'   },
  ban:         { icon: 'ban',               color: '#FFF',    bg: 'rgba(220,38,38,0.95)'   },
  permban:     { icon: 'skull',             color: '#FFF',    bg: 'rgba(127,29,29,0.98)'   },
  demote:      { icon: 'arrow-down-circle', color: '#FFF',    bg: 'rgba(59,130,246,0.85)'  },
  promote:     { icon: 'arrow-up-circle',   color: '#FFF',    bg: 'rgba(20,184,166,0.85)'  },
};

const DRAMATIC_TYPES: FlashType[] = ['ban', 'permban', 'kick'];

type Props = {
  flashType: FlashType | null;
  size?: number;
  onFlashDone?: () => void;
};

export default function AvatarPenaltyFlash({ flashType, size = 64, onFlashDone }: Props) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // ★ Ban/kick için ekstra animasyonlar
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!flashType) return;
    const isDramatic = DRAMATIC_TYPES.includes(flashType);
    const duration = isDramatic ? 4500 : 2500;

    // Reset
    scaleAnim.setValue(0);
    opacityAnim.setValue(0);
    pulseAnim.setValue(1);
    shakeAnim.setValue(0);
    overlayOpacity.setValue(0);
    rotateAnim.setValue(0);
    labelOpacity.setValue(0);

    // Giriş — dramatic: daha keskin spring + rotation
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: isDramatic ? 150 : 120, friction: isDramatic ? 5 : 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ...(isDramatic ? [
        Animated.timing(overlayOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(labelOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      ] : []),
    ]).start();

    // Shake (sadece dramatic)
    let shake: Animated.CompositeAnimation | null = null;
    if (isDramatic) {
      shake = Animated.loop(Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        Animated.delay(300),
      ]), { iterations: 6 });
      shake.start();
    }

    // Pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: isDramatic ? 1.35 : 1.2, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Çıkış
    const timer = setTimeout(() => {
      pulse.stop();
      shake?.stop();
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: isDramatic ? 1.5 : 0.3, duration: 400, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(labelOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        onFlashDone?.();
      });
    }, duration);

    return () => {
      clearTimeout(timer);
      pulse.stop();
      shake?.stop();
    };
  }, [flashType]);

  if (!flashType) return null;

  const config = FLASH_MAP[flashType];
  if (!config) return null;

  const isDramatic = DRAMATIC_TYPES.includes(flashType);
  const badgeSize = isDramatic ? Math.max(36, size * 0.6) : Math.max(28, size * 0.45);
  const shakeX = shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] });
  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] });
  const label = flashType === 'permban' ? 'KALICI BAN' : flashType === 'ban' ? 'BANLANDI' : flashType === 'kick' ? 'ATILDI' : '';

  return (
    <>
      {/* ★ Dramatic overlay — tüm avatarı kaplar, kırmızı tint */}
      {isDramatic && (
        <Animated.View
          pointerEvents="none"
          style={[
            sty.fullOverlay,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: overlayOpacity,
              backgroundColor: flashType === 'permban' ? 'rgba(127,29,29,0.7)' : 'rgba(220,38,38,0.55)',
              transform: [{ translateX: shakeX }],
            },
          ]}
        />
      )}

      {/* ★ Merkez badge — icon */}
      <Animated.View
        style={[
          sty.root,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: config.bg,
            transform: [
              { translateX: shakeX },
              { scale: scaleAnim },
              { scale: pulseAnim },
              ...(isDramatic ? [{ rotate }] : []),
            ],
            opacity: opacityAnim,
          },
          isDramatic && sty.rootDramatic,
        ]}
        pointerEvents="none"
      >
        <Ionicons name={config.icon as any} size={badgeSize * 0.6} color={config.color} />
      </Animated.View>

      {/* ★ "BANLANDI" label — avatarın altında */}
      {isDramatic && label && (
        <Animated.View
          pointerEvents="none"
          style={[
            sty.labelWrap,
            {
              opacity: labelOpacity,
              top: size + 4,
              transform: [{ translateX: shakeX }],
            },
          ]}
        >
          <View style={sty.labelPill}>
            <Text style={sty.labelText}>{label}</Text>
          </View>
        </Animated.View>
      )}
    </>
  );
}

const sty = StyleSheet.create({
  root: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -14,
    marginLeft: -14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 15,
    zIndex: 100,
  },
  rootDramatic: {
    marginTop: -20,
    marginLeft: -20,
    shadowColor: '#EF4444',
    shadowOpacity: 1,
    shadowRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  fullOverlay: {
    position: 'absolute',
    top: 0, left: 0,
    zIndex: 99,
  },
  labelWrap: {
    position: 'absolute',
    left: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 101,
    marginLeft: -40,
  },
  labelPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#DC2626',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 10,
  },
  labelText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
