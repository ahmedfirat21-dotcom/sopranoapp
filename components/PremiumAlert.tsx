/**
 * SopranoChat — Premium Alert Modal
 * ★ 2026-04-23: Tam redesign — koyu glassmorphic tema ile uyumlu.
 *   Eski açık gri-mavi zemin kaldırıldı, derin koyu gradient + accent glow eklendi.
 *   Butonlar pill shape + icon desteği, slide-up animasyon korundu.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, Dimensions, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');

export type AlertType = 'info' | 'warning' | 'error' | 'success';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  icon?: keyof typeof Ionicons.glyphMap; // ★ 2026-04-21: Ionicons ikonu (emoji yerine vektör)
}

interface PremiumAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: AlertType;
  buttons?: AlertButton[];
  onDismiss?: () => void;
  icon?: string;
  customContent?: React.ReactNode;
}

const ALERT_CONFIG = {
  info: {
    icon: 'information-circle',
    // Gradient: koyu mavi tabanı
    bgGradient: ['#101c2e', '#0d1520', '#0a0f18'] as const,
    accentColor: '#60A5FA',
    iconBg: 'rgba(59,130,246,0.12)',
    iconGlow: 'rgba(59,130,246,0.3)',
    borderColor: 'rgba(59,130,246,0.15)',
  },
  warning: {
    icon: 'warning',
    bgGradient: ['#1c1a0e', '#15120a', '#0a0f18'] as const,
    accentColor: '#FBBF24',
    iconBg: 'rgba(245,158,11,0.12)',
    iconGlow: 'rgba(245,158,11,0.3)',
    borderColor: 'rgba(245,158,11,0.15)',
  },
  error: {
    icon: 'close-circle',
    bgGradient: ['#1e0f0f', '#170a0d', '#0a0f18'] as const,
    accentColor: '#F87171',
    iconBg: 'rgba(239,68,68,0.12)',
    iconGlow: 'rgba(239,68,68,0.3)',
    borderColor: 'rgba(239,68,68,0.18)',
  },
  success: {
    icon: 'checkmark-circle',
    bgGradient: ['#0e1c16', '#0a1510', '#0a0f18'] as const,
    accentColor: '#34D399',
    iconBg: 'rgba(16,185,129,0.12)',
    iconGlow: 'rgba(16,185,129,0.3)',
    borderColor: 'rgba(16,185,129,0.15)',
  },
};

export default function PremiumAlert({ visible, title, message, type = 'info', buttons, onDismiss, icon, customContent }: PremiumAlertProps) {
  const slideY = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // ★ Swipe-to-dismiss — aşağı sürükle kapat
  const panY = useRef(new Animated.Value(0)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.3,
      onPanResponderMove: (_, g) => { if (g.dy > 0) panY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(panY, { toValue: H, duration: 200, useNativeDriver: true }).start(() => {
            panY.setValue(0);
            onDismissRef.current?.();
          });
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
        }
      },
    })
  ).current;

  const config = ALERT_CONFIG[type];
  const alertIcon = icon || config.icon;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      panY.setValue(0);
    } else {
      slideY.setValue(60);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const defaultButtons: AlertButton[] = buttons || [{ text: 'Tamam', onPress: onDismiss }];
  const useGrid = defaultButtons.length >= 4;
  const useVertical = defaultButtons.length >= 3 && !useGrid;

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={sty.backdrop}>
        <Animated.View style={[sty.overlay, { opacity: opacityAnim }]} />

        <Animated.View
          style={[sty.container, { transform: [{ translateY: slideY }, { translateY: panY }], opacity: opacityAnim }]}
          {...panResponder.panHandlers}
        >
          {/* ★ Koyu gradient zemin — proje bg'sine kaynaşır */}
          <LinearGradient
            colors={config.bgGradient as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
          />

          {/* Top accent glow line */}
          <LinearGradient
            colors={['transparent', config.accentColor, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={sty.accentLine}
          />

          {/* Icon — glow halka + koyu bg */}
          <View style={[sty.iconOuter, { shadowColor: config.accentColor }]}>
            <View style={[sty.iconContainer, { backgroundColor: config.iconBg, borderColor: config.iconGlow }]}>
              <Ionicons name={alertIcon as any} size={24} color={config.accentColor} />
            </View>
          </View>

          {/* Title */}
          <Text style={sty.title}>{title}</Text>

          {/* Message */}
          {message ? <Text style={sty.message}>{message}</Text> : null}

          {/* Custom Content */}
          {customContent || null}

          {/* Buttons */}
          <View style={useGrid ? sty.buttonGrid : useVertical ? sty.buttonColumn : sty.buttonRow}>
            {defaultButtons.map((btn, i) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              const isPrimary = !isCancel && !isDestructive && i === defaultButtons.length - 1;

              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.7}
                  onPress={() => { btn.onPress?.(); onDismiss?.(); }}
                  style={[
                    useGrid ? sty.gridButton : useVertical ? sty.verticalButton : sty.button,
                    isPrimary && {
                      backgroundColor: config.accentColor + '15',
                      borderColor: config.accentColor + '30',
                    },
                    isDestructive && {
                      backgroundColor: 'rgba(239,68,68,0.1)',
                      borderColor: 'rgba(239,68,68,0.25)',
                    },
                    isCancel && {
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderColor: 'rgba(255,255,255,0.08)',
                    },
                    defaultButtons.length === 1 && { flex: 1 },
                    btn.icon && { flexDirection: 'row', gap: 8 },
                  ]}
                >
                  {btn.icon && (
                    <Ionicons
                      name={btn.icon}
                      size={17}
                      color={isDestructive ? '#F87171' : isCancel ? 'rgba(255,255,255,0.4)' : isPrimary ? config.accentColor : 'rgba(255,255,255,0.75)'}
                    />
                  )}
                  <Text style={[
                    sty.buttonText,
                    isPrimary && { color: config.accentColor },
                    isDestructive && { color: '#F87171' },
                    isCancel && { color: 'rgba(255,255,255,0.4)' },
                  ]} numberOfLines={useVertical ? undefined : 1}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const sty = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  container: {
    width: W - 56,
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 22,
    alignItems: 'center',
    overflow: 'hidden',
    // Premium shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 24,
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },
  iconOuter: {
    marginTop: 4,
    marginBottom: 14,
    // Glow shadow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F1F5F9',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.15,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  message: {
    fontSize: 12.5,
    color: 'rgba(148,163,184,0.9)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Normal row: 2-3 buton
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  // Vertical: 3 buton
  buttonColumn: {
    flexDirection: 'column',
    gap: 8,
    width: '100%',
  },
  verticalButton: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  // Grid: 4+ buton
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  gridButton: {
    width: '47%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
