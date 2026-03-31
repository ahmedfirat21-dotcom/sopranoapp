import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, DeviceEventEmitter, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  title: string;
  message?: string;
  type?: ToastType;
  duration?: number;
}

export const showToast = (toast: ToastMessage) => {
  DeviceEventEmitter.emit('SHOW_TOAST', toast);
};

const { width: SCREEN_W } = Dimensions.get('window');

export function Toast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('SHOW_TOAST', (data: ToastMessage) => {
      // Önceki zamanlayıcıyı temizle (hızlı ardışık toast'larda üst üste binmesin)
      if (timerRef.current) clearTimeout(timerRef.current);

      setToast(data);

      // Yumuşak giriş
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: Platform.OS === 'ios' ? Math.max(insets.top, 44) : 36,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Otomatik gizle
      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -100,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => setToast(null));
      }, data.duration || 2500);
    });

    return () => subscription.remove();
  }, [insets.top, translateY, opacity]);

  if (!toast) return null;

  const config = {
    success: { icon: 'checkmark-circle', color: '#34D399', accent: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.25)' },
    error:   { icon: 'close-circle',     color: '#F87171', accent: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.25)' },
    info:    { icon: 'information-circle', color: '#60A5FA', accent: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.25)' },
    warning: { icon: 'warning',           color: '#FBBF24', accent: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.25)' },
  };

  const { icon, color, accent, border } = config[toast.type || 'info'];

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <View style={[styles.toast, { borderColor: border, backgroundColor: '#1A1F27' }]}>
        {/* Sol renkli çizgi */}
        <View style={[styles.accentBar, { backgroundColor: color }]} />
        <View style={[styles.iconWrap, { backgroundColor: accent }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
          {toast.message ? <Text style={styles.message} numberOfLines={2}>{toast.message}</Text> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 99999,
    elevation: 99999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingLeft: 0,
    borderRadius: 12,
    borderWidth: 0.5,
    maxWidth: Math.min(SCREEN_W - 40, 400),
    width: '100%',
    // Hafif gölge
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  accentBar: {
    width: 3,
    borderRadius: 2,
    alignSelf: 'stretch',
    marginRight: 10,
    marginLeft: 0,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F1F5F9',
    letterSpacing: 0.1,
  },
  message: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
    lineHeight: 15,
  },
});
