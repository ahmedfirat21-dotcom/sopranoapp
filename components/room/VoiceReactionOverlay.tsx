/**
 * SopranoChat — Voice Reaction Floating Overlay (Faz 3.2)
 * ═══════════════════════════════════════════════════
 * Gelen reaction emoji'lerini ekranın altından yukarı uçuran overlay.
 * Twitch/Spaces tarzı emote shower. Tek mount yeterli — RoomScreen'in
 * en üstüne yerleştirilir, pointerEvents='none' ile etkileşimi engellemez.
 *
 * Performans:
 *   - Max 30 simultaneous emoji (üzeri eski temizlenir)
 *   - useNativeDriver: true (60fps)
 *   - 2.5s sonra otomatik unmount
 */
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { VoiceReactionService } from '../../services/voiceReactions';

const { width: W, height: H } = Dimensions.get('window');
const MAX_ACTIVE = 30;
const FLY_DURATION = 2500;

interface FlyingEmoji {
  key: string;
  emoji: string;
  startX: number;
  drift: number;
  scale: number;
  translateY: Animated.Value;
  opacity: Animated.Value;
}

export interface VoiceReactionOverlayHandle {
  show: (reactionId: string) => void;
}

const VoiceReactionOverlay = forwardRef<VoiceReactionOverlayHandle, {}>(function VoiceReactionOverlay(_props, ref) {
  const [items, setItems] = useState<FlyingEmoji[]>([]);
  const counterRef = useRef(0);
  // ★ Spawn rate limit — saniyede max 6 emoji (frame drop önleme)
  const lastSpawnRef = useRef(0);

  const spawn = (reactionId: string) => {
    const def = VoiceReactionService.getDef(reactionId);
    if (!def) return;

    // Spam guard: ardışık spawn'lar arası 150ms minimum
    const now = Date.now();
    if (now - lastSpawnRef.current < 150) return;
    lastSpawnRef.current = now;

    counterRef.current += 1;
    const key = `${Date.now()}-${counterRef.current}`;
    const startX = 20 + Math.random() * (W - 80);
    const drift = (Math.random() - 0.5) * 60; // ±30px yatay sapma
    const scale = 0.9 + Math.random() * 0.5; // 0.9 - 1.4

    const translateY = new Animated.Value(0);
    const opacity = new Animated.Value(1);

    const newItem: FlyingEmoji = {
      key,
      emoji: def.emoji,
      startX,
      drift,
      scale,
      translateY,
      opacity,
    };

    setItems(prev => {
      const next = [...prev, newItem];
      // En fazla MAX_ACTIVE — üzeri eski temizlenir
      return next.length > MAX_ACTIVE ? next.slice(-MAX_ACTIVE) : next;
    });

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -(H * 0.7),
        duration: FLY_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(FLY_DURATION * 0.6),
        Animated.timing(opacity, {
          toValue: 0,
          duration: FLY_DURATION * 0.4,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setItems(prev => prev.filter(i => i.key !== key));
    });
  };

  useImperativeHandle(ref, () => ({ show: spawn }), []);

  if (items.length === 0) return null;

  return (
    <View
      style={s.overlay}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {items.map(item => (
        <Animated.Text
          key={item.key}
          style={[
            s.emoji,
            {
              left: item.startX,
              transform: [
                { translateY: item.translateY },
                { translateX: item.drift },
                { scale: item.scale },
              ],
              opacity: item.opacity,
            },
          ]}
        >
          {item.emoji}
        </Animated.Text>
      ))}
    </View>
  );
});

export default VoiceReactionOverlay;

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  emoji: {
    position: 'absolute',
    bottom: 100,
    fontSize: 44,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
