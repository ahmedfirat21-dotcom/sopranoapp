import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors } from '../../constants/theme';
import { useTheme } from '../_layout';

export { useAuth } from '../_layout';
export { useBadges } from '../_layout';
import { useBadges } from '../_layout';

const { width: W } = Dimensions.get('window');

// ════════════════════════════════════════════════════════════
// Tab konfigürasyonu — mockup'a birebir uyumlu 4 tab
// ════════════════════════════════════════════════════════════
const TAB_CONFIG: Record<string, { activeIcon: keyof typeof Ionicons.glyphMap; inactiveIcon: keyof typeof Ionicons.glyphMap; label: string }> = {
  home:     { activeIcon: 'compass',                inactiveIcon: 'compass-outline',                label: 'Keşfet' },
  myrooms:  { activeIcon: 'home',                   inactiveIcon: 'home-outline',                   label: 'Odalarım' },
  messages: { activeIcon: 'chatbubble-ellipses',    inactiveIcon: 'chatbubble-ellipses-outline',    label: 'Mesajlar' },
  profile:  { activeIcon: 'person',                 inactiveIcon: 'person-outline',                 label: 'Profil' },
};

const VISIBLE_TABS = ['home', 'myrooms', 'messages', 'profile'];
const TEAL = '#14B8A6';
const INACTIVE = Colors.cardBorder;
const BAR_BG = '#2a3a48';
const BAR_H = 60;

// ════════════════════════════════════════════════════════════
// Custom Tab Bar — temiz, düz, FAB yok
// ════════════════════════════════════════════════════════════
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const pad = Math.max(insets.bottom, 6);
  const { unreadDMs } = useBadges();

  return (
    <View style={[s.bar, { paddingBottom: pad }]}>
      {/* Üst ince çizgi */}
      <View style={s.topLine} />

      {/* Tab ikonları */}
      <View style={s.tabRow}>
        {state.routes.map((route, index) => {
          if (!VISIBLE_TABS.includes(route.name)) return null;
          const isFocused = state.index === index;
          const cfg = TAB_CONFIG[route.name];
          if (!cfg) return null;

          let badge = 0;
          if (route.name === 'messages') badge = unreadDMs;

          return (
            <Pressable
              key={route.key}
              style={s.tabItem}
              onPress={() => {
                const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !ev.defaultPrevented) navigation.navigate(route.name);
              }}
            >
              <View style={s.iconWrap}>
                <Ionicons
                  name={isFocused ? cfg.activeIcon : cfg.inactiveIcon}
                  size={26}
                  color={isFocused ? TEAL : INACTIVE}
                />
                {badge > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.label, isFocused && s.labelActive]}>
                {cfg.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BAR_BG,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 15,
  },
  topLine: {
    height: 1,
    backgroundColor: 'rgba(92,198,198,0.08)',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: BAR_H,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    flex: 1,
    paddingTop: 4,
  },
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: BAR_BG,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: INACTIVE,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  labelActive: {
    color: TEAL,
    fontWeight: '700',
  },
});

// ════════════════════════════════════════════════════════════
// Tab Layout — 4 sekme
// ════════════════════════════════════════════════════════════
export default function TabLayout() {
  const { themeVersion: _tv } = useTheme();
  return (
    <Tabs tabBar={(p) => <CustomTabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Colors.bg } }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="myrooms" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
