import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, DeviceEventEmitter,
  Platform, Dimensions, Pressable, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'upsell';

export interface ToastMessage {
  title: string;
  message?: string;
  type?: ToastType;
  duration?: number;
  /** Aksiyon butonu (ör: "Pro'ya Geç") */
  action?: { label: string; onPress: () => void };
  /** Benzersiz id — aynı toast tekrar gösterilmez (opsiyonel) */
  id?: string;
}

/**
 * ★ Global Toast tetikleyici — uygulamanın herhangi bir yerinden çağrılabilir.
 * Kuyruk sistemi: ardışık toast'lar üst üste binmez, sırayla gösterilir.
 */
export const showToast = (toast: ToastMessage) => {
  DeviceEventEmitter.emit('SHOW_TOAST', toast);
};

const { width: SCREEN_W } = Dimensions.get('window');
const TOAST_MAX_W = Math.min(SCREEN_W - 32, 420);

// ═══════════════════════════════════════
// Toast Bileşeni — Premium Glassmorphism
// ═══════════════════════════════════════

export function Toast() {
  const [queue, setQueue] = useState<ToastMessage[]>([]);
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownIdsRef = useRef(new Set<string>());
  const isAnimatingRef = useRef(false);

  // ★ Swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 8 && gs.dy < 0,
      onPanResponderMove: (_, gs) => {
        if (gs.dy < 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -40) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setCurrent(null);
      isAnimatingRef.current = false;
    });
  }, []);

  // Kuyruktan sonraki toast'u göster
  useEffect(() => {
    if (current || queue.length === 0 || isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    const next = queue[0];
    setQueue(q => q.slice(1));
    setCurrent(next);

    // Reset
    translateY.setValue(-120);
    opacity.setValue(0);
    progress.setValue(0);

    const duration = next.duration || (next.message ? 3500 : 2500);

    // Giriş animasyonu
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar animasyonu
    Animated.timing(progress, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start();

    // Otomatik gizle
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setCurrent(null);
        isAnimatingRef.current = false;
      });
    }, duration);
  }, [queue, current]);

  // Event listener
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('SHOW_TOAST', (data: ToastMessage) => {
      // Aynı id tekrar gösterilmez (10 saniye cache)
      if (data.id) {
        if (shownIdsRef.current.has(data.id)) return;
        shownIdsRef.current.add(data.id);
        setTimeout(() => shownIdsRef.current.delete(data.id!), 10_000);
      }
      setQueue(q => [...q, data]);
    });
    return () => sub.remove();
  }, []);

  // 30 sn'de bir eski id'leri temizle
  useEffect(() => {
    const interval = setInterval(() => shownIdsRef.current.clear(), 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!current) return null;

  const THEMES = {
    success: {
      icon: 'checkmark-circle' as const,
      color: '#34D399',
      gradient: ['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.05)'] as [string, string],
      border: 'rgba(52,211,153,0.30)',
      progressColor: '#34D399',
    },
    error: {
      icon: 'close-circle' as const,
      color: '#F87171',
      gradient: ['rgba(248,113,113,0.15)', 'rgba(248,113,113,0.05)'] as [string, string],
      border: 'rgba(248,113,113,0.30)',
      progressColor: '#F87171',
    },
    info: {
      icon: 'information-circle' as const,
      color: '#60A5FA',
      gradient: ['rgba(96,165,250,0.15)', 'rgba(96,165,250,0.05)'] as [string, string],
      border: 'rgba(96,165,250,0.30)',
      progressColor: '#60A5FA',
    },
    warning: {
      icon: 'warning' as const,
      color: '#FBBF24',
      gradient: ['rgba(251,191,36,0.15)', 'rgba(251,191,36,0.05)'] as [string, string],
      border: 'rgba(251,191,36,0.30)',
      progressColor: '#FBBF24',
    },
    upsell: {
      icon: 'rocket' as const,
      color: '#A78BFA',
      gradient: ['rgba(167,139,250,0.15)', 'rgba(167,139,250,0.05)'] as [string, string],
      border: 'rgba(167,139,250,0.30)',
      progressColor: '#A78BFA',
    },
  };

  const theme = THEMES[current.type || 'info'];
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['100%', '0%'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { top: Math.max(insets.top, 12) + 8, transform: [{ translateY }], opacity },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={[styles.toast, { borderColor: theme.border }]}>
        <LinearGradient
          colors={theme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Sol renkli çizgi */}
        <View style={[styles.accentBar, { backgroundColor: theme.color }]} />

        {/* İkon */}
        <View style={[styles.iconWrap, { backgroundColor: `${theme.color}18` }]}>
          <Ionicons name={theme.icon} size={20} color={theme.color} />
        </View>

        {/* İçerik */}
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{current.title}</Text>
          {current.message ? (
            <Text style={styles.message} numberOfLines={2}>{current.message}</Text>
          ) : null}
        </View>

        {/* Aksiyon butonu */}
        {current.action && (
          <Pressable
            style={[styles.actionBtn, { backgroundColor: `${theme.color}20`, borderColor: `${theme.color}40` }]}
            onPress={() => { dismiss(); current.action?.onPress(); }}
          >
            <Text style={[styles.actionText, { color: theme.color }]}>{current.action.label}</Text>
          </Pressable>
        )}

        {/* Kapatma butonu */}
        <Pressable style={styles.closeBtn} onPress={dismiss} hitSlop={8}>
          <Ionicons name="close" size={14} color="rgba(255,255,255,0.4)" />
        </Pressable>

        {/* ★ Progress bar — kalan süre göstergesi */}
        <Animated.View style={[styles.progressBar, { width: progressWidth, backgroundColor: theme.progressColor }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    elevation: 99999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    paddingLeft: 0,
    borderRadius: 14,
    borderWidth: 0.5,
    maxWidth: TOAST_MAX_W,
    width: '100%',
    backgroundColor: 'rgba(15,23,42,0.92)',
    // Glassmorphism gölge
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 20,
    overflow: 'hidden',
  },
  accentBar: {
    width: 3.5,
    borderRadius: 2,
    alignSelf: 'stretch',
    marginRight: 10,
    marginLeft: 0,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textWrap: {
    flex: 1,
    marginRight: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: 0.1,
  },
  message: {
    fontSize: 11,
    color: 'rgba(148,163,184,0.9)',
    marginTop: 2,
    lineHeight: 15,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 4,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2.5,
    borderRadius: 2,
    opacity: 0.6,
  },
});
