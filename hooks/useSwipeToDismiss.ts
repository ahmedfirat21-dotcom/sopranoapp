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

type Direction = 'down' | 'up' | 'right' | 'left';

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
  const sign = (direction === 'left' || direction === 'up') ? -1 : 1;

  const panResponder = useRef(
    PanResponder.create({
      // ★ Y16 FIX: Dokunma başlangıcında responder olma — taps ve iç scroll'lar pass etsin.
      // Sadece belirgin bir sürükleme hareketi başladığında responder devral.
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        // Eşik: eksenin diğer eksene göre baskın olması gerekir (scroll ile çakışmasın).
        if (isHorizontal) {
          const moved = direction === 'right' ? g.dx > 8 : g.dx < -8;
          return moved && Math.abs(g.dx) > Math.abs(g.dy) * 1.2;
        } else {
          // Dikey swipe: aşağı/yukarı yöne göre eşik
          const moved = direction === 'up' ? g.dy < -8 : g.dy > 8;
          return moved && Math.abs(g.dy) > Math.abs(g.dx) * 1.2;
        }
      },
      // ★ Move Capture — güçlü swipe'ta ScrollView'dan responder çal (iOS Sheet tarzı).
      // Küçük hareketler scroll'a gider; belirgin swipe parent'a geçer.
      onMoveShouldSetPanResponderCapture: (_, g) => {
        if (isHorizontal) {
          const moved = direction === 'right' ? g.dx > 25 : g.dx < -25;
          return moved && Math.abs(g.dx) > Math.abs(g.dy) * 2;
        } else {
          const moved = direction === 'up' ? g.dy < -25 : g.dy > 25;
          return moved && Math.abs(g.dy) > Math.abs(g.dx) * 2;
        }
      },
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
          // ★ 2026-04-23 DOUBLE-DRAG FIX: Eskiden önce translateValue'u sign*500'e
          //   animate ediyor, SONRA onDismiss çağırıyorduk. Parent'ın close animation'ı
          //   (slideAnim vs) SONRADAN başlıyordu → iki ayrı hareket = "çift sürüklenme".
          //   Artık onDismiss ANINDA çağrılıyor, translateValue swipe pozisyonunda kalıyor,
          //   parent'ın close anim'i o pozisyondan devralıp tek pürüzsüz hareketle kapatıyor.
          onDismissRef.current();
          // translateValue RESET ETMİYORUZ — parent'ın close anim'i compose edecek.
          // Sonraki open'da resetPosition() veya consumer kendi visible useEffect'inde sıfırlar.
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
