/**
 * useSwipeToDismiss — Instagram-style swipe-to-dismiss gesture hook
 * 
 * Bottom sheets: aşağı sürükle → kapat
 * Side drawers: sola/sağa sürükle → kapat
 * 
 * PanResponder kullanır, sadece handle/header alanına uygulanır.
 * ScrollView ile çakışmaz çünkü handle ayrı bir View'a bağlıdır.
 */
import { useRef, useCallback } from 'react';
import { Animated, PanResponder, PanResponderInstance } from 'react-native';

type Direction = 'down' | 'right' | 'left';

interface SwipeConfig {
  direction: Direction;
  threshold?: number;
  velocityThreshold?: number;
  onDismiss: () => void;
}

interface SwipeResult {
  translateValue: Animated.Value;
  panHandlers: PanResponderInstance['panHandlers'];
  resetPosition: () => void;
}

export function useSwipeToDismiss({
  direction,
  threshold = 80,
  velocityThreshold = 0.4,
  onDismiss,
}: SwipeConfig): SwipeResult {
  const translateValue = useRef(new Animated.Value(0)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const isHorizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'left' ? -1 : 1;

  const panResponder = useRef(
    PanResponder.create({
      // ★ Y16 FIX: Dokunma başlangıcında responder olma — taps ve iç scroll'lar pass etsin.
      // Sadece belirgin bir sürükleme hareketi başladığında responder devral.
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        // Eşik: eksenin diğer eksene göre baskın olması gerekir (scroll ile çakışmasın).
        if (isHorizontal) {
          const moved = direction === 'right' ? g.dx > 12 : g.dx < -12;
          return moved && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
        } else {
          // Dikey swipe (bottom sheet): yukarı scroll'u bozmamak için yalnızca aşağı swipe'ta claim
          return g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5;
        }
      },
      // Capture'da NEGATIVE tutarak iç bileşenlerin (scroll/buton) gesture'ını engelleme.
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const delta = isHorizontal ? g.dx : g.dy;
        if (sign > 0) {
          translateValue.setValue(Math.max(0, delta));
        } else {
          translateValue.setValue(Math.min(0, delta));
        }
      },
      onPanResponderRelease: (_, g) => {
        const delta = isHorizontal ? g.dx : g.dy;
        const velocity = isHorizontal ? g.vx : g.vy;
        const shouldDismiss =
          (sign > 0 && (delta > threshold || velocity > velocityThreshold)) ||
          (sign < 0 && (delta < -threshold || velocity < -velocityThreshold));

        if (shouldDismiss) {
          Animated.timing(translateValue, {
            toValue: sign * 500,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDismissRef.current();
            translateValue.setValue(0);
          });
        } else {
          Animated.spring(translateValue, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 14,
          }).start();
        }
      },
    })
  ).current;

  const resetPosition = useCallback(() => {
    translateValue.setValue(0);
  }, [translateValue]);

  return {
    translateValue,
    panHandlers: panResponder.panHandlers,
    resetPosition,
  };
}
