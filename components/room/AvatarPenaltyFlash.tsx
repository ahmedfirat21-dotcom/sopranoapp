/**
 * AvatarPenaltyFlash — Avatar üzerinde geçici moderasyon simgesi
 * ═══════════════════════════════════════════════════════════════
 * Bir moderasyon aksiyonu gerçekleştiğinde hedef kullanıcının avatarının
 * üstünde kısa süreli (3sn) animasyonlu flash simge gösterir.
 * Tüm katılımcılar tarafından görülür.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type FlashType = 'mute' | 'unmute' | 'chat_mute' | 'chat_unmute' | 'kick' | 'ban' | 'demote' | 'promote';

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
  kick:        { icon: 'exit',              color: '#FFF',    bg: 'rgba(220,38,38,0.9)'    },
  ban:         { icon: 'ban',               color: '#FFF',    bg: 'rgba(220,38,38,0.9)'    },
  demote:      { icon: 'arrow-down-circle', color: '#FFF',    bg: 'rgba(59,130,246,0.85)'  },
  promote:     { icon: 'arrow-up-circle',   color: '#FFF',    bg: 'rgba(20,184,166,0.85)'  },
};

type Props = {
  flashType: FlashType | null;
  size?: number; // Avatar boyutuna göre flash boyutu
  onFlashDone?: () => void;
};

export default function AvatarPenaltyFlash({ flashType, size = 64, onFlashDone }: Props) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!flashType) return;

    // Reset
    scaleAnim.setValue(0);
    opacityAnim.setValue(0);
    pulseAnim.setValue(1);

    // Giriş: scale 0→1 + opacity 0→1
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Pulse efekti
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();

    // 3sn sonra kaybol
    const timer = setTimeout(() => {
      pulse.stop();
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        onFlashDone?.();
      });
    }, 2500);

    return () => {
      clearTimeout(timer);
      pulse.stop();
    };
  }, [flashType]);

  if (!flashType) return null;

  const config = FLASH_MAP[flashType];
  if (!config) return null;

  const badgeSize = Math.max(28, size * 0.45);

  return (
    <Animated.View
      style={[
        sty.root,
        {
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
          backgroundColor: config.bg,
          transform: [{ scale: scaleAnim }, { scale: pulseAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      <Ionicons name={config.icon as any} size={badgeSize * 0.55} color={config.color} />
    </Animated.View>
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
});
