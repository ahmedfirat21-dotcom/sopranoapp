/**
 * SopranoChat — Premium Alert Modal
 * Glassmorphism + Slide-up animasyon + Pill shape butonlar
 * Tüm Alert.alert kullanımlarının yerine geçer.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

const { width: W, height: H } = Dimensions.get('window');

export type AlertType = 'info' | 'warning' | 'error' | 'success';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
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
    gradient: ['rgba(59,130,246,0.12)', 'rgba(59,130,246,0.03)'] as [string, string],
    accentColor: '#60A5FA',
    iconBg: 'rgba(59,130,246,0.15)',
  },
  warning: {
    icon: 'warning',
    gradient: ['rgba(245,158,11,0.12)', 'rgba(245,158,11,0.03)'] as [string, string],
    accentColor: '#FBBF24',
    iconBg: 'rgba(245,158,11,0.15)',
  },
  error: {
    icon: 'close-circle',
    gradient: ['rgba(239,68,68,0.12)', 'rgba(239,68,68,0.03)'] as [string, string],
    accentColor: '#F87171',
    iconBg: 'rgba(239,68,68,0.15)',
  },
  success: {
    icon: 'checkmark-circle',
    gradient: ['rgba(16,185,129,0.12)', 'rgba(16,185,129,0.03)'] as [string, string],
    accentColor: '#34D399',
    iconBg: 'rgba(16,185,129,0.15)',
  },
};

export default function PremiumAlert({ visible, title, message, type = 'info', buttons, onDismiss, icon, customContent }: PremiumAlertProps) {
  const slideY = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const config = ALERT_CONFIG[type];
  const alertIcon = icon || config.icon;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      slideY.setValue(60);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const defaultButtons: AlertButton[] = buttons || [{ text: 'Tamam', onPress: onDismiss }];
  const useGrid = defaultButtons.length >= 4;

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={sty.backdrop}>
        <Animated.View style={[sty.overlay, { opacity: opacityAnim }]} />

        <Animated.View style={[sty.container, { transform: [{ translateY: slideY }], opacity: opacityAnim }]}>
          {/* Top accent line */}
          <LinearGradient
            colors={[config.accentColor, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={sty.accentLine}
          />

          {/* Icon */}
          <View style={[sty.iconContainer, { backgroundColor: config.iconBg }]}>
            <Ionicons name={alertIcon as any} size={22} color={config.accentColor} />
          </View>

          {/* Title */}
          <Text style={sty.title}>{title}</Text>

          {/* Message */}
          {message ? <Text style={sty.message}>{message}</Text> : null}

          {/* Custom Content */}
          {customContent || null}

          {/* Buttons — grid veya row */}
          <View style={useGrid ? sty.buttonGrid : sty.buttonRow}>
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
                    useGrid ? sty.gridButton : sty.button,
                    isPrimary && { backgroundColor: config.accentColor + '18', borderColor: config.accentColor + '40' },
                    isDestructive && { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)' },
                    isCancel && { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
                    defaultButtons.length === 1 && { flex: 1 },
                  ]}
                >
                  <Text style={[
                    sty.buttonText,
                    isPrimary && { color: config.accentColor },
                    isDestructive && { color: '#F87171' },
                    isCancel && { color: 'rgba(255,255,255,0.45)' },
                  ]} numberOfLines={1}>
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
    padding: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  container: {
    width: W - 80,
    maxWidth: 320,
    backgroundColor: 'rgba(45,61,77,0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 2,
    borderRadius: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  message: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 14,
  },
  // Normal row: 2-3 buton
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
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
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
});
