/**
 * SopranoChat — Premium Alert Modal
 * Native Alert.alert yerine kullanılan cyberpunk temalı özel dialog.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Modal, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const { width: W } = Dimensions.get('window');

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
}

const ALERT_CONFIG = {
  info: {
    icon: 'information-circle',
    gradient: ['rgba(59,130,246,0.15)', 'rgba(59,130,246,0.05)'] as [string, string],
    accentColor: '#60A5FA',
    iconBg: 'rgba(59,130,246,0.2)',
  },
  warning: {
    icon: 'warning',
    gradient: ['rgba(245,158,11,0.15)', 'rgba(245,158,11,0.05)'] as [string, string],
    accentColor: '#FBBF24',
    iconBg: 'rgba(245,158,11,0.2)',
  },
  error: {
    icon: 'close-circle',
    gradient: ['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.05)'] as [string, string],
    accentColor: '#F87171',
    iconBg: 'rgba(239,68,68,0.2)',
  },
  success: {
    icon: 'checkmark-circle',
    gradient: ['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.05)'] as [string, string],
    accentColor: '#34D399',
    iconBg: 'rgba(16,185,129,0.2)',
  },
};

export default function PremiumAlert({ visible, title, message, type = 'info', buttons, onDismiss, icon }: PremiumAlertProps) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const config = ALERT_CONFIG[type];
  const alertIcon = icon || config.icon;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.8, duration: 150, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const defaultButtons: AlertButton[] = buttons || [{ text: 'Tamam', onPress: onDismiss }];

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={styles.backdrop}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]} />

        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          {/* Top accent line */}
          <LinearGradient
            colors={[config.accentColor, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.accentLine}
          />

          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
            <Ionicons name={alertIcon as any} size={32} color={config.accentColor} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Buttons */}
          <View style={styles.buttonRow}>
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
                    styles.button,
                    isPrimary && { backgroundColor: config.accentColor + '30', borderColor: config.accentColor + '60' },
                    isDestructive && { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' },
                    isCancel && { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
                    defaultButtons.length === 1 && { flex: 1 },
                  ]}
                >
                  <Text style={[
                    styles.buttonText,
                    isPrimary && { color: config.accentColor },
                    isDestructive && { color: '#F87171' },
                    isCancel && { color: 'rgba(255,255,255,0.5)' },
                  ]}>
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  container: {
    width: W - 64,
    maxWidth: 360,
    backgroundColor: '#141B2D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 25,
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 2,
    borderRadius: 1,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
  },
});
