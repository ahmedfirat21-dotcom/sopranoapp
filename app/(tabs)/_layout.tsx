import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Pressable, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors } from '../../constants/theme';
import { useTheme } from '../_layout';
import React, { useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

export { useAuth } from '../_layout';
export { useBadges } from '../_layout';
import { useBadges } from '../_layout';

const { width: W } = Dimensions.get('window');

// ════════════════════════════════════════════════════════════
// Renk Yardımcıları (3D Tonlama — RoomControlBar ile aynı)
// ════════════════════════════════════════════════════════════
const lighten = (hex: string, pct: number) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xFF) + pct);
  const g = Math.min(255, ((num >> 8) & 0xFF) + pct);
  const b = Math.min(255, (num & 0xFF) + pct);
  return `rgb(${r},${g},${b})`;
};
const darken = (hex: string, pct: number) => lighten(hex, -pct);

// ════════════════════════════════════════════════════════════
// Tab konfigürasyonu
// ════════════════════════════════════════════════════════════
const TAB_CFG: Record<string, {
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent: string;
}> = {
  home:     { activeIcon: 'compass',             inactiveIcon: 'compass-outline',             label: 'Keşfet',   accent: '#14B8A6' },
  myrooms:  { activeIcon: 'home',                inactiveIcon: 'home-outline',                label: 'Odalarım', accent: '#3B82F6' },
  messages: { activeIcon: 'chatbubble-ellipses', inactiveIcon: 'chatbubble-ellipses-outline', label: 'Mesajlar', accent: '#8B5CF6' },
  profile:  { activeIcon: 'person',              inactiveIcon: 'person-outline',              label: 'Profil',   accent: '#F59E0B' },
};

const TABS = ['home', 'myrooms', 'messages', 'profile'];
const INACTIVE = '#7B8D9F';

// Ölçüler
const BAR_MARGIN = 16;
const BAR_W = W - BAR_MARGIN * 2;
const BAR_H = 60;
const BUBBLE = 54;
const BAR_BG = '#253545';       // Tema bg (#2f404f) ile uyumlu koyu ton
const SCREEN_BG = '#2f404f';   // Tema arka planı

// Animasyon — her yerde aynı
const TIMING = { duration: 300, easing: Easing.out(Easing.quad) };

// ════════════════════════════════════════════════════════════
// Notch kulakları — aktif tab'ın yanlarında kavis efekti
// ════════════════════════════════════════════════════════════
function NotchEar({ side }: { side: 'left' | 'right' }) {
  return (
    <View style={[
      ear.wrap,
      side === 'left' ? { right: BUBBLE / 2 } : { left: BUBBLE / 2 },
    ]}>
      <View style={[
        ear.shape,
        side === 'left'
          ? { borderBottomRightRadius: 14, right: 0 }
          : { borderBottomLeftRadius: 14, left: 0 },
      ]} />
    </View>
  );
}

const ear = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -12,
    width: 14,
    height: 14,
    overflow: 'hidden',
  },
  shape: {
    position: 'absolute',
    bottom: 0,
    width: 14,
    height: 14,
    backgroundColor: SCREEN_BG,
  },
});

// ════════════════════════════════════════════════════════════
// Tek Tab
// ════════════════════════════════════════════════════════════
function Tab({ isFocused, cfg, badge, onPress }: {
  isFocused: boolean;
  cfg: typeof TAB_CFG[string];
  badge: number;
  onPress: () => void;
}) {
  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, TIMING);
  }, [isFocused]);

  // 3D buton stili — yukarı çıkma
  const bubbleAnim = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [8, -4]) },
      { scale: interpolate(progress.value, [0, 1], [0.4, 1]) },
    ],
  }));

  // Pasif ikon — aktifken kaybolur
  const passiveAnim = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 0.5]) },
      { translateY: interpolate(progress.value, [0, 1], [0, 8]) },
    ],
  }));

  // Label — aktifken kaybolur
  const labelAnim = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, 6]) }],
  }));

  return (
    <Pressable style={s.tab} onPress={onPress}>

      {/* ═══ AKTİF: 3D Glossy Gradient Buton (oda içi gibi) ═══ */}
      <Animated.View style={[s.bubble, bubbleAnim]}>
        <LinearGradient
          colors={[lighten(cfg.accent, 25), cfg.accent, darken(cfg.accent, 35)] as any}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={s.gradient}
        >
          <Ionicons name={cfg.activeIcon} size={24} color="#FFF" style={s.iconDrop} />
        </LinearGradient>
        {/* Glossy cam parlaklığı */}
        <View style={s.gloss} />
      </Animated.View>

      {/* ═══ PASİF İKON ═══ */}
      <Animated.View style={[s.passiveIcon, passiveAnim]}>
        <Ionicons name={cfg.inactiveIcon} size={28} color={INACTIVE} style={s.inactiveShadow} />
        {badge > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </Animated.View>

      {/* ═══ LABEL ═══ (D-2: overflow koruması) */}
      <Animated.Text style={[s.label, labelAnim]} numberOfLines={1} ellipsizeMode="tail">{cfg.label}</Animated.Text>
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════
// Custom Tab Bar
// ════════════════════════════════════════════════════════════
function CurvedTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { unreadDMs } = useBadges();

  return (
    <View style={[s.outer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={s.bar}>
        {state.routes.map((route, i) => {
          if (!TABS.includes(route.name)) return null;
          const cfg = TAB_CFG[route.name];
          if (!cfg) return null;
          return (
            <Tab
              key={route.key}
              isFocused={state.index === i}
              cfg={cfg}
              badge={route.name === 'messages' ? unreadDMs : 0}
              onPress={() => {
                const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (state.index !== i && !ev.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
  bar: {
    flexDirection: 'row',
    width: BAR_W,
    height: BAR_H,
    borderRadius: 22,
    backgroundColor: BAR_BG,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'visible',
    // ★ Güçlendirilmiş gölge — çerçeve arkasında derin blur gölge
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.65,
    shadowRadius: 24,
    elevation: 24,
  },
  tab: {
    flex: 1,
    height: BAR_H,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    overflow: 'visible',
  },

  /* 3D Gradient Bubble — aktif ikon */
  bubble: {
    position: 'absolute',
    top: 4,
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    overflow: 'hidden',
    zIndex: 20,
    // 3D Border ring — elevation yerine
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    // ★ Seçili ikon arkası yumuşak koyu gölge
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  gradient: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  gloss: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '45%',
    borderTopLeftRadius: BUBBLE / 2,
    borderTopRightRadius: BUBBLE / 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  iconDrop: {
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  /* Pasif ikon */
  passiveIcon: {
    position: 'absolute',
    top: 12,
    zIndex: 10,
  },

  /* Label */
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: INACTIVE,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  /* Pasif ikon gölgesi */
  inactiveShadow: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  /* Badge */
  badge: {
    position: 'absolute',
    top: -5, right: -10,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: BAR_BG,
  },
  badgeTxt: { fontSize: 9, fontWeight: '800', color: '#FFF' },
});

// ════════════════════════════════════════════════════════════
export default function TabLayout() {
  const { themeVersion: _tv } = useTheme();
  return (
    <Tabs tabBar={(p) => <CurvedTabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Colors.bg } }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="myrooms" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
