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
import { View, Text, StyleSheet, Pressable, Image, Dimensions, Animated, PanResponder, Easing } from 'react-native';
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

  // ★ 2026-04-24: Swipe-down to dismiss — daha agresif hassasiyet,
  //   Pressable child'lar tap'i alır; aşağı swipe PanResponder capture eder.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        // Aşağı hareket baskın (dy > dx * 1.5) + minimum 6px → capture
        return gs.dy > 6 && gs.dy > Math.abs(gs.dx) * 1.5;
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return gs.dy > 10 && gs.dy > Math.abs(gs.dx) * 1.5;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 70 || gs.vy > 0.5) {
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
    <View style={s.root} pointerEvents={visible ? 'box-none' : 'none'}>
      {/* Backdrop — tıklayınca kapat; animasyon ile fade */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]} pointerEvents={visible ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose}>
          <View style={s.backdrop} />
        </Pressable>
      </Animated.View>

      {/* Sheet — panResponder tüm sheet üzerinde */}
      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          locations={[0, 0.35, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.sheetInner}
        >
          {/* Handle bar — beyaz şerit (RoomChatDrawer ile aynı) */}
          <View style={s.handleWrap}>
            <View style={s.handle} />
          </View>

          {/* Partner header — X kaldırıldı, swipe-to-dismiss yeterli */}
          <View style={s.header}>
            <StatusAvatar uri={partnerAvatar || undefined} size={48} isOnline={partnerOnline} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.name} numberOfLines={1}>{partnerName}</Text>
              {!!subtitle && <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>}
            </View>
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
                  <View style={s.actionIconWrap}>
                    <Ionicons name={action.icon} size={22} color={iconColor} style={s.actionIconShadow} />
                  </View>
                  <Text style={[s.actionLabel, { color: textColor }]} numberOfLines={1}>{action.label}</Text>
                  {action.accessory && (
                    <Text style={s.accessoryText}>{action.accessory}</Text>
                  )}
                  <Ionicons
                    name="chevron-forward"
                    size={15}
                    color={action.disabled ? 'rgba(148,163,184,0.25)' : 'rgba(255,255,255,0.35)'}
                    style={[{ marginLeft: 4 }, s.actionIconShadow]}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Safe inner padding — floating card zaten tab bar üstünde, ekstra padding gerekmiyor */}
          <View style={{ height: 10 }} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  // ★ 2026-04-24 v2: HandRaiseQueuePanel stili — tab bar'ın ÜSTÜNDE floating card
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 45,
    elevation: 45,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 14, right: 14,
    bottom: 96, // tab bar (~82) + 14px gap → panel tab bar'ın tam üstünde floats
    maxHeight: SHEET_MAX_HEIGHT,
    overflow: 'hidden',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 20,
  },
  sheetInner: {
    paddingTop: 8,
    borderRadius: 18,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
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
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(148,163,184,0.8)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
  // ★ 2026-04-24: İkon çerçevesi kaldırıldı — sadece ikonun kendi drop shadow'u
  actionIconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconShadow: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  accessoryText: {
    fontSize: 12,
    color: 'rgba(148,163,184,0.7)',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
