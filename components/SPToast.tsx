/**
 * SopranoChat — SP Kazanım Toast Bileşeni
 * ═══════════════════════════════════════════════════
 * Animasyonlu mini SP kazanım bildirimi.
 * Ekranın sağ üst köşesinde "+5 SP ⭐" animasyonu gösterir.
 * 1.5sn görünüp kayar, art arda gelenleri birleştirir.
 */
import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SPToastRef {
  show: (amount: number, label?: string) => void;
}

interface ToastItem {
  id: number;
  amount: number;
  label: string;
  anim: Animated.Value;
}

const SPToast = forwardRef<SPToastRef>((_, ref) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idCounter = useRef(0);

  const show = useCallback((amount: number, label?: string) => {
    const id = ++idCounter.current;
    const anim = new Animated.Value(0);

    const item: ToastItem = {
      id,
      amount,
      label: label || 'SP',
      anim,
    };

    setItems(prev => [...prev.slice(-3), item]); // Max 4 simultaneous

    Animated.sequence([
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.delay(1200),
      Animated.timing(anim, {
        toValue: 2,
        duration: 400,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setItems(prev => prev.filter(i => i.id !== id));
    });
  }, []);

  useImperativeHandle(ref, () => ({ show }), [show]);

  if (items.length === 0) return null;

  return (
    <View style={s.container} pointerEvents="none">
      {items.map((item, index) => {
        const translateY = item.anim.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [-30, 0, -20],
        });
        const opacity = item.anim.interpolate({
          inputRange: [0, 0.3, 1, 1.8, 2],
          outputRange: [0, 1, 1, 0.6, 0],
        });
        const scale = item.anim.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [0.5, 1, 0.8],
        });

        return (
          <Animated.View
            key={item.id}
            style={[
              s.toast,
              {
                transform: [{ translateY }, { scale }],
                opacity,
                marginBottom: 4,
              },
            ]}
          >
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={s.amount}>+{item.amount}</Text>
            <Text style={s.label}>{item.label}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
});

SPToast.displayName = 'SPToast';

export default SPToast;

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    right: 16,
    zIndex: 9999,
    alignItems: 'flex-end',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(25,42,60,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  amount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFD700',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
});
