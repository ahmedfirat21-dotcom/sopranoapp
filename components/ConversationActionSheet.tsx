/**
 * ★ 2026-04-21: ConversationActionSheet
 * ═══════════════════════════════════════════════════════════════════
 * DM uzun bas aksiyonları için premium bottom sheet. PremiumAlert modal
 * yerine — WhatsApp/Telegram tarzı native hissi.
 *
 * Özellikler:
 *  - Aşağıdan yumuşak kayma (spring)
 *  - Partner avatar + isim header
 *  - Action rows (icon + label + destructive renk)
 *  - Swipe-down to dismiss
 *  - Backdrop tap to dismiss
 *  - Açılışta haptic feedback
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Image, Dimensions, Animated, PanResponder, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import StatusAvatar from './StatusAvatar';

const { height: H } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = Math.min(H * 0.68, 560);

export interface SheetAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Destructive → kırmızı tema; primary → teal; default → nötr */
  style?: 'default' | 'destructive' | 'primary';
  /** Right alt text (ör. mevcut durumu belirtmek için: "Açık"/"Kapalı") */
  accessory?: string;
  /** Action disabled (gri, tıklanamaz) */
  disabled?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  partnerName: string;
  partnerAvatar?: string | null;
  partnerOnline?: boolean;
  /** Sheet üstünde gösterilecek kısa info (örn. "5 yeni mesaj" veya kapalı bırak) */
  subtitle?: string;
  actions: SheetAction[];
}

export default function ConversationActionSheet({
  visible, onClose, partnerName, partnerAvatar, partnerOnline, subtitle, actions,
}: Props) {
  const translateY = useRef(new Animated.Value(SHEET_MAX_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Haptic feedback — açılış vuruşu
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Medium);
      } catch {}
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SHEET_MAX_HEIGHT, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Swipe-down to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && Math.abs(gs.dx) < 20,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 90 || gs.vy > 0.6) {
          Animated.timing(translateY, { toValue: SHEET_MAX_HEIGHT, duration: 200, useNativeDriver: true }).start(() => onClose());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
        }
      },
    })
  ).current;

  const handleAction = (action: SheetAction) => {
    if (action.disabled) return;
    // Destructive için daha güçlü haptic
    try {
      const Haptics = require('expo-haptics');
      if (action.style === 'destructive') {
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType?.Warning);
      } else {
        Haptics.selectionAsync?.();
      }
    } catch {}
    // Aksiyon çalışmadan sheet kapansın (flicker yok)
    onClose();
    // Küçük gecikme: kullanıcı kapanışı hissetsin, sonra aksiyon çalışsın
    setTimeout(() => action.onPress(), 120);
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose}>
          <View style={s.backdrop} />
        </Pressable>
      </Animated.View>

      {/* Sheet — panResponder tüm sheet üzerinde (sadece handle değil) */}
      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        <LinearGradient
          colors={['#1C2840', '#122036', '#0B1829']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={s.sheetInner}
        >
          {/* Handle bar (swipe indicator) */}
          <View style={s.handleWrap}>
            <View style={s.handle} />
          </View>

          {/* Partner header */}
          <View style={s.header}>
            <StatusAvatar uri={partnerAvatar || undefined} size={48} isOnline={partnerOnline} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.name} numberOfLines={1}>{partnerName}</Text>
              {!!subtitle && <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>

          <View style={s.divider} />

          {/* Actions */}
          <View style={s.actions}>
            {actions.map((action, i) => {
              const isDestructive = action.style === 'destructive';
              const isPrimary = action.style === 'primary';
              const iconColor = action.disabled
                ? 'rgba(148,163,184,0.4)'
                : isDestructive ? '#F87171'
                : isPrimary ? '#5EEAD4'
                : 'rgba(255,255,255,0.85)';
              const textColor = action.disabled
                ? 'rgba(148,163,184,0.45)'
                : isDestructive ? '#F87171'
                : isPrimary ? '#5EEAD4'
                : '#F1F5F9';
              const bgColor = isDestructive ? 'rgba(239,68,68,0.08)' : 'transparent';
              return (
                <Pressable
                  key={action.id}
                  onPress={() => handleAction(action)}
                  android_ripple={{ color: isDestructive ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)' }}
                  style={({ pressed }) => [
                    s.actionRow,
                    { backgroundColor: bgColor },
                    pressed && { backgroundColor: isDestructive ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)' },
                    i === 0 && { marginTop: 6 },
                  ]}
                >
                  <View style={[s.actionIconWrap, isDestructive && { backgroundColor: 'rgba(239,68,68,0.12)' }, isPrimary && { backgroundColor: 'rgba(20,184,166,0.14)' }]}>
                    <Ionicons name={action.icon} size={19} color={iconColor} />
                  </View>
                  <Text style={[s.actionLabel, { color: textColor }]} numberOfLines={1}>{action.label}</Text>
                  {action.accessory && (
                    <Text style={s.accessoryText}>{action.accessory}</Text>
                  )}
                  <Ionicons
                    name="chevron-forward"
                    size={15}
                    color={action.disabled ? 'rgba(148,163,184,0.25)' : 'rgba(255,255,255,0.25)'}
                    style={{ marginLeft: 4 }}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Safe bottom padding (home indicator) */}
          <View style={{ height: 34 }} />
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    maxHeight: SHEET_MAX_HEIGHT,
    overflow: 'hidden',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 24,
  },
  sheetInner: {
    paddingTop: 8,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(115,194,189,0.12)', // ★ Teal accent border — odada kullanılan palet
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148,163,184,0.3)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(148,163,184,0.8)',
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 14,
  },
  actions: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 12,
    marginVertical: 2,
    gap: 12,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  accessoryText: {
    fontSize: 12,
    color: 'rgba(148,163,184,0.7)',
    fontWeight: '500',
  },
});
