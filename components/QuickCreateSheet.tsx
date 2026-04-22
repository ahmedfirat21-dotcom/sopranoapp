/**
 * SopranoChat — Quick Create Sheet
 * FAB tıklanınca açılan 3 seçenekli bottom sheet:
 *  - Hızlı Aç: varsayılanlarla anında oda açar
 *  - Detaylı Ayarla: mevcut çok-adımlı create-room sayfasına gider
 *  - Planla: ileri tarihli oda (yakında)
 * Clubhouse backchannel pattern'ine uygun: aşağıdan yukarı kayar, swipe-down ile kapanır.
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder, Pressable, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');
const PANEL_HEIGHT = 320;

interface Props {
  visible: boolean;
  onClose: () => void;
  onQuickCreate: () => void;
  onDetailedCreate: () => void;
  onSchedule?: () => void;
  bottomInset: number;
  /**
   * ★ 2026-04-23: Tab bar / alt navigasyon yüksekliği — panel bu kadar yukarı kalkar,
   * aksi halde CurvedTabBar son seçeneği kırpar. Tabs dışında kullanılırsa 0.
   */
  bottomOffset?: number;
}

export default function QuickCreateSheet({
  visible, onClose, onQuickCreate, onDetailedCreate, onSchedule, bottomInset,
  bottomOffset = 0,
}: Props) {
  // ★ Panel artık bottom:0'da ve paddingBottom ile yüksekliği şişiyor;
  // CLOSED_Y tüm görünür yüksekliği + buffer kadar olmalı ki translate off-screen temiz kaysın.
  const CLOSED_Y = PANEL_HEIGHT + bottomInset + bottomOffset + 50;
  const translateY = useRef(new Animated.Value(CLOSED_Y)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // ★ 2026-04-23: Internal mount state — parent visible=false yapsa bile component
  //   kapanış animasyonu bitene kadar render'da kalsın. Aksi halde "return null" hemen
  //   unmount ediyor, kapanış animasyonu oynamıyor, modal kesik görünüyor.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: CLOSED_Y, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // ★ 2026-04-23: Sadece aşağı yönlü drag'i yakala — yukarı çekmek boş alan açıyordu
      // (panel fixed-height, bottom:0; yukarı shift panelin altını ekran dibinden ayırıp kesik yaratıyor).
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 4 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        // Aşağı yönde 1-to-1 follow; yukarı hareket yok (clamp at 0).
        translateY.setValue(Math.max(0, gs.dy));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60 || gs.vy > 0.4) {
          Animated.timing(translateY, { toValue: CLOSED_Y, duration: 180, useNativeDriver: true })
            .start(() => onClose());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220 }).start();
        }
      },
    })
  ).current;

  if (!mounted) return null;

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 100, opacity: backdropOpacity }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          s.panel,
          {
            // ★ 2026-04-23: RoomChatDrawer pattern — panel ekranın en altına kadar uzanır,
            // tab bar panelin üstünde floats (higher z-index/elevation). Böylece panel ile
            // tab bar arasında kesik kalmaz, tek sürekli yüzey oluşur.
            bottom: 0,
            paddingBottom: bottomOffset + Math.max(bottomInset, 14) + 14,
            transform: [{ translateY }],
          },
        ]}
      >
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          locations={[0, 0.35, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 20, borderTopRightRadius: 20 }]}
        />

        {/* ★ 2026-04-23: Drag alanı artık tüm üst blok (handle + başlık) —
             tap'lar Option'lara gider, yukarı/aşağı sürükleme kapatır. */}
        <View {...panResponder.panHandlers}>
          <View style={s.handle}>
            <View style={s.handleBar} />
          </View>
          <View style={s.header}>
            <Ionicons name="mic" size={18} color="#14B8A6" />
            <Text style={s.headerTitle}>Yeni Oda Aç</Text>
          </View>
        </View>

        <View style={s.optionsWrap}>
          <Option
            icon="flash"
            iconColor="#14B8A6"
            title="Hızlı Aç"
            subtitle="Varsayılanlarla hemen yayına başla"
            onPress={() => { onClose(); setTimeout(() => onQuickCreate(), 160); }}
            primary
          />
          <Option
            icon="options-outline"
            iconColor="#A78BFA"
            title="Detaylı Ayarla"
            subtitle="Tip, şifre, hoş geldin mesajı, tema — tamamını belirle"
            onPress={() => { onClose(); setTimeout(() => onDetailedCreate(), 160); }}
          />
          <Option
            icon="calendar-outline"
            iconColor="#F59E0B"
            title="Planla"
            subtitle="İleri tarihli oda — yakında"
            onPress={() => onSchedule?.()}
            disabled={!onSchedule}
          />
        </View>
      </Animated.View>
    </>
  );
}

function Option({
  icon, iconColor, title, subtitle, onPress, primary, disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.option,
        primary && s.optionPrimary,
        disabled && { opacity: 0.35 },
        pressed && !disabled && { backgroundColor: 'rgba(20,184,166,0.08)' },
      ]}
    >
      <View style={s.optionIconWrap}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.optionTitle}>{title}</Text>
        <Text style={s.optionSubtitle}>{subtitle}</Text>
      </View>
      {!disabled && <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.35)" />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 101,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#95a1ae',
  },
  handle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(20,184,166,0.06)',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  optionsWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  optionPrimary: {
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.25)',
    backgroundColor: 'rgba(20,184,166,0.05)',
  },
  optionIconWrap: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
});
