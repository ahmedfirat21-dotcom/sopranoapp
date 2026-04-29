// ★ 2026-04-29: Animated header icon button — tab focus'ta alttan stagger slide-up.
//   Logo partner kelimesinin animasyonuyla aynı dilde (alttan + fade-in), ama
//   index'e göre kademeli (her ikon 70ms sonra). Tüm tab sayfalarının (home,
//   myrooms, messages, profile) header'larındaki sağ butonları sarmak için.
import React, { useCallback, useRef } from 'react';
import { Animated, Pressable, ViewStyle, StyleProp } from 'react-native';
import { useFocusEffect } from 'expo-router';

interface Props {
  /** Stagger sırası (0 = ilk, 1 = ikinci...) — her ikon 70ms sonra başlar */
  index?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'image';
  /** ★ 2026-04-29: Sayfalar arası değişmeyen ikonlar için animation skip
   *  (örn: NotificationBell — keşfet/odalarım/mesajlar'da hep var, gereksiz tetiklenmesin) */
  staticIcon?: boolean;
}

export default function AnimatedHeaderIconBtn({
  index = 0,
  onPress,
  onLongPress,
  hitSlop = 8,
  style,
  children,
  accessibilityLabel,
  accessibilityRole = 'button',
  staticIcon = false,
}: Props) {
  const ty = useRef(new Animated.Value(staticIcon ? 0 : 16)).current;
  const op = useRef(new Animated.Value(staticIcon ? 1 : 0)).current;

  useFocusEffect(
    useCallback(() => {
      if (staticIcon) return; // Sayfalar arası değişmeyen ikon — animasyon yok
      ty.setValue(16);
      op.setValue(0);
      Animated.sequence([
        Animated.delay(100 + index * 70),
        Animated.parallel([
          Animated.spring(ty, { toValue: 0, friction: 7, tension: 70, useNativeDriver: true }),
          Animated.timing(op, { toValue: 1, duration: 280, useNativeDriver: true }),
        ]),
      ]).start();
    }, [index, staticIcon])
  );

  return (
    <Animated.View style={{ opacity: op, transform: [{ translateY: ty }] }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        hitSlop={hitSlop}
        style={style}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
