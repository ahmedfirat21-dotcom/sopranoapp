import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Pressable, Dimensions, Platform, useWindowDimensions } from 'react-native';
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
  withSequence,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';

export { useAuth } from '../_layout';
export { useBadges } from '../_layout';
import { useBadges } from '../_layout';

// ★ 2026-04-22: Module-level width kullanımı kaldırıldı — fiziksel telefonda (özellikle
// Android gesture-nav) Dimensions.get('window') modül yüklenirken sistem bar boyutunu
// çıkartarak daha küçük dönebiliyor → bar yanlardan daralmış görünüyordu. Artık
// CurvedTabBar içinde useWindowDimensions hook'u ile runtime'da alınıyor.

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
  home:     { activeIcon: 'radio',               inactiveIcon: 'radio-outline',               label: 'Keşfet',   accent: '#14B8A6' },
  myrooms:  { activeIcon: 'home',                inactiveIcon: 'home-outline',                label: 'Odalarım', accent: '#3B82F6' },
  messages: { activeIcon: 'chatbubble-ellipses', inactiveIcon: 'chatbubble-ellipses-outline', label: 'Mesajlar', accent: '#8B5CF6' },
  profile:  { activeIcon: 'person',              inactiveIcon: 'person-outline',              label: 'Profil',   accent: '#F59E0B' },
};

const TABS = ['home', 'myrooms', 'messages', 'profile'];
const INACTIVE = '#7B8D9F';

// Ölçüler
// ★ 2026-04-21 (geç): Bar yanal olarak genişletildi, dikey olarak kısaltıldı.
//   İkon/bubble boyutları değişmedi — sadece bar çerçevesi ince-uzun oldu.
const BAR_MARGIN = 6;
const BAR_H = 60;
const BUBBLE = 58;
// ★ 2026-04-20: Alt bar kendi renk ailesi içinde gradient — bg'ye karışmaz.
//   Floating surface hissi (Apple macOS Dock gibi).
const BAR_BG = '#1F2E48';                 // Ana bar tonu (fallback)
const BAR_GRADIENT_TOP = '#2A3A58';       // Üst — en aydınlık (highlight)
const BAR_GRADIENT_MID = '#243250';       // Orta — ana ton
const BAR_GRADIENT_BOTTOM = '#1A2540';    // Alt — hafif koyulaşma (DERİN değil)
const SCREEN_BG = '#0F1929';              // Tema arka planı (notch ear referansı)

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
function Tab({ isFocused, cfg, badge, onPress, routeName }: {
  isFocused: boolean;
  cfg: typeof TAB_CFG[string];
  badge: number;
  onPress: () => void;
  routeName: string;
}) {
  const progress = useSharedValue(isFocused ? 1 : 0);
  // ★ 2026-04-21: Tab-specific animation shared values.
  const iconX = useSharedValue(0);      // translateX wiggle (Keşfet + Mesajlar)
  const iconScale = useSharedValue(1);  // scale (Profil)
  const iconRotate = useSharedValue(0); // rotate (Odalarım + Profil)
  const iconOpacity = useSharedValue(1);

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

  // ★ Her tab'a özel ikon animasyon stili — translateX + scale + rotate + opacity
  const iconAnim = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [
      { translateX: iconX.value },
      { scale: iconScale.value },
      { rotate: `${iconRotate.value}deg` },
    ],
  }));

  // ★ Keşfet — 3 konsantrik radyo dalgası, teker teker yayılır (sequential).
  const wave1Scale = useSharedValue(0); const wave1Opacity = useSharedValue(0);
  const wave2Scale = useSharedValue(0); const wave2Opacity = useSharedValue(0);
  const wave3Scale = useSharedValue(0); const wave3Opacity = useSharedValue(0);
  const wave1Anim = useAnimatedStyle(() => ({ opacity: wave1Opacity.value, transform: [{ scale: wave1Scale.value }] }));
  const wave2Anim = useAnimatedStyle(() => ({ opacity: wave2Opacity.value, transform: [{ scale: wave2Scale.value }] }));
  const wave3Anim = useAnimatedStyle(() => ({ opacity: wave3Opacity.value, transform: [{ scale: wave3Scale.value }] }));

  const handlePress = () => {
    // Reset shared values
    iconX.value = 0;
    iconScale.value = 1;
    iconRotate.value = 0;
    iconOpacity.value = 1;

    // ★ Tüm tab'lar için ortak translateX wiggle — yumuşak sağa-sola hareket
    const defaultWiggle = () => {
      iconX.value = withSequence(
        withTiming(9, { duration: 260, easing: Easing.out(Easing.sin) }),
        withTiming(-9, { duration: 360, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 280, easing: Easing.in(Easing.sin) }),
      );
    };

    if (routeName === 'home') {
      // 🎙 Keşfet — 3 dalga TEK TEK (sıralı, örtüşmez). İkon hafif pulse.
      iconScale.value = withSequence(
        withTiming(1.12, { duration: 200, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 250, easing: Easing.in(Easing.quad) }),
      );
      const WAVE_DUR = 500;
      const waveLaunch = (sc: typeof wave1Scale, op: typeof wave1Opacity, delayMs: number) => {
        sc.value = 0; op.value = 0;
        sc.value = withDelay(delayMs, withTiming(2.6, { duration: WAVE_DUR, easing: Easing.out(Easing.quad) }));
        op.value = withDelay(delayMs, withSequence(
          withTiming(0.75, { duration: 80 }),
          withTiming(0, { duration: WAVE_DUR - 80, easing: Easing.out(Easing.quad) }),
        ));
      };
      waveLaunch(wave1Scale, wave1Opacity, 0);
      waveLaunch(wave2Scale, wave2Opacity, WAVE_DUR);
      waveLaunch(wave3Scale, wave3Opacity, WAVE_DUR * 2);
    } else if (routeName === 'myrooms') {
      // 🏠 Odalarım — Ev sallanması: sola-sağa rotate
      iconRotate.value = withSequence(
        withTiming(-14, { duration: 100, easing: Easing.out(Easing.quad) }),
        withTiming(14, { duration: 180, easing: Easing.inOut(Easing.quad) }),
        withTiming(-10, { duration: 140, easing: Easing.inOut(Easing.quad) }),
        withTiming(8, { duration: 120, easing: Easing.inOut(Easing.quad) }),
        withTiming(-4, { duration: 100, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 120, easing: Easing.in(Easing.quad) }),
      );
    } else if (routeName === 'messages') {
      defaultWiggle(); // 💬 Mesajlar — eski translateX wiggle
    } else if (routeName === 'profile') {
      // 👤 Profil — Selam: büyüt + hafif baş-sallama rotate
      iconScale.value = withSequence(
        withTiming(0.82, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(1.22, { duration: 200, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }),
      );
      iconRotate.value = withSequence(
        withTiming(0, { duration: 60 }),
        withTiming(-10, { duration: 180, easing: Easing.inOut(Easing.quad) }),
        withTiming(10, { duration: 200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 160, easing: Easing.in(Easing.quad) }),
      );
    }

    onPress();
  };

  return (
    <Pressable style={s.tab} onPress={handlePress}>

      {/* ═══ AKTİF: 3D Glossy Gradient Buton (oda içi gibi) ═══ */}
      <Animated.View style={[s.bubble, bubbleAnim]}>
        {/* ★ Keşfet — 3 dalga teker teker, bubble arkasından yayılır */}
        {routeName === 'home' && (
          <>
            <Animated.View style={[s.radioWave, { borderColor: cfg.accent }, wave1Anim]} pointerEvents="none" />
            <Animated.View style={[s.radioWave, { borderColor: cfg.accent }, wave2Anim]} pointerEvents="none" />
            <Animated.View style={[s.radioWave, { borderColor: cfg.accent }, wave3Anim]} pointerEvents="none" />
          </>
        )}
        <LinearGradient
          colors={[lighten(cfg.accent, 25), cfg.accent, darken(cfg.accent, 35)] as any}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={s.gradient}
        >
          <Animated.View style={iconAnim}>
            <Ionicons name={cfg.activeIcon} size={24} color="#FFF" style={s.iconDrop} />
          </Animated.View>
        </LinearGradient>
        {/* ★ 2026-04-21: Glossy parlaklık — üstten aşağı fade out, sert çizgi yok */}
        <LinearGradient
          colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.08)', 'transparent']}
          locations={[0, 0.6, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={s.gloss}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ═══ PASİF İKON ═══ */}
      <Animated.View style={[s.passiveIcon, passiveAnim]}>
        <Animated.View style={iconAnim}>
          <Ionicons name={cfg.inactiveIcon} size={28} color={INACTIVE} style={s.inactiveShadow} />
        </Animated.View>
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
  // ★ Runtime width — fiziksel telefonda gesture-nav varken güncellenen değer alınır.
  //   SafeArea insets'i de çıkararak (landscape notch) tam ekran genişliğini kullan.
  const { width: winW } = useWindowDimensions();
  const barWidth = Math.max(0, winW - BAR_MARGIN * 2 - (insets.left + insets.right));

  return (
    <View style={[s.outer, { paddingBottom: Math.max(insets.bottom, 8), paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={[s.bar, { width: barWidth }]}>
        {/* ★ 2026-04-20: Gradient zemin — bar kendi rengi içinde tonlanır, bg'ye kaynaşmaz */}
        <LinearGradient
          colors={[BAR_GRADIENT_TOP, BAR_GRADIENT_MID, BAR_GRADIENT_BOTTOM]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.barGradient}
          pointerEvents="none"
        />
        {/* Hafif teal sol spotlight — premium aksan */}
        <LinearGradient
          colors={['rgba(20,184,166,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={s.barGradient}
          pointerEvents="none"
        />
        {state.routes.map((route, i) => {
          if (!TABS.includes(route.name)) return null;
          const cfg = TAB_CFG[route.name];
          if (!cfg) return null;
          return (
            <Tab
              key={route.key}
              isFocused={state.index === i}
              cfg={cfg}
              routeName={route.name}
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
    // width inline olarak CurvedTabBar içinde atanır (runtime useWindowDimensions).
    height: BAR_H,
    borderRadius: 22,
    backgroundColor: BAR_BG,
    alignItems: 'flex-end',
    // ★ 2026-04-20: Parlak ince çerçeve — premium metalik his
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'visible',
    position: 'relative',
    // Drop shadow (alt zemin ayrımı) + parlak glow (üst aydınlık hale)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 14,
  },
  // ★ 2026-04-20: Gradient zemin — bar borderRadius ile kırpılır
  barGradient: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 22,
  },
  tab: {
    flex: 1,
    height: BAR_H,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
    overflow: 'visible',
  },

  /* 3D Gradient Bubble — aktif ikon */
  bubble: {
    position: 'absolute',
    top: 1,
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
    // ★ 2026-04-21: Yükseklik %45→%55, LinearGradient fade olduğu için alt kenar görünmez
    height: '55%',
    borderTopLeftRadius: BUBBLE / 2,
    borderTopRightRadius: BUBBLE / 2,
  },
  // ★ Keşfet'e özel radyo dalgası — bubble arkasından yayılan ring (3 adet, sequential)
  radioWave: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: BUBBLE / 2,
    borderWidth: 2,
    zIndex: -1,
  },
  iconDrop: {
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  /* Pasif ikon */
  passiveIcon: {
    position: 'absolute',
    top: 8,
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
