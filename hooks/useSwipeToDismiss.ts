/**
 * useSwipeToDismiss — Modallara sürükleyerek kapatma özelliği ekler
 * Bottom-sheet tarzı modallar için aşağı sürükle → kapat.
 */
import { useRef } from 'react';
import { Animated, PanResponder, Dimensions } from 'react-native';

const { height: H } = Dimensions.get('window');

interface SwipeToDismissConfig {
  onDismiss: () => void;
  /** Kapatma eşiği (px) — bu kadar sürüklenince kapanır. Default: 100 */
  threshold?: number;
  /** Animasyon süresi (ms). Default: 200 */
  duration?: number;
}

export function useSwipeToDismiss({ onDismiss, threshold = 100, duration = 200 }: SwipeToDismissConfig) {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        // Sadece aşağı doğru belirgin sürüklemede aktif ol
        return gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5;
      },
      onPanResponderMove: (_, gesture) => {
        // Sadece aşağı doğru sürüklemeye izin ver
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > threshold || gesture.vy > 0.5) {
          // Eşiği aştı — kapat
          Animated.timing(translateY, {
            toValue: H * 0.5,
            duration,
            useNativeDriver: true,
          }).start(() => onDismiss());
        } else {
          // Geri dön
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 12,
          }).start();
        }
      },
    })
  ).current;

  return { translateY, panResponder };
}
