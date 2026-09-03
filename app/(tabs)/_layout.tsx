import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors } from '../../constants/theme';

export { useAuth } from '../_layout';
export { useBadges } from '../_layout';
import { useAuth, useBadges } from '../_layout';

type TabConfig = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

const TABS = ['home', 'messages', 'myrooms', 'cevre', 'profile'];

const TAB_CFG: Record<string, TabConfig> = {
  home: {
    label: 'Lobi',
    icon: 'home-outline',
    activeIcon: 'home',
  },
  messages: {
    label: 'Sohbet',
    icon: 'chatbubbles-outline',
    activeIcon: 'chatbubbles',
  },
  myrooms: {
    label: 'Frekans',
    icon: 'radio-outline',
    activeIcon: 'radio',
  },
  cevre: {
    label: 'Çevre',
    icon: 'people-outline',
    activeIcon: 'people',
  },
  profile: {
    label: 'Profil',
    icon: 'person-outline',
    activeIcon: 'person',
  },
};

function RetroTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { unreadDMs } = useBadges();
  const { tabBarCovered } = useAuth();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (tabBarCovered || keyboardOpen) return null;

  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <LinearGradient
        colors={['#5D5E68', '#3B3C44', '#22232A']}
        locations={[0, 0.46, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topChrome} />
      <View style={styles.tabsRow}>
        {state.routes.map((route, index) => {
          if (!TABS.includes(route.name)) return null;
          const cfg = TAB_CFG[route.name];
          if (!cfg) return null;
          const focused = state.index === index;
          const badge = route.name === 'messages' ? unreadDMs : 0;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tab}
              android_ripple={{ color: 'rgba(255,255,255,.08)', borderless: false }}
            >
              {focused ? (
                <LinearGradient
                  colors={['#FFFFFF', '#D9DAE4', '#A9AABD']}
                  locations={[0, 0.5, 1]}
                  style={styles.activePill}
                >
                  <View style={styles.activeHighlight} />
                  <Ionicons name={cfg.activeIcon} size={21} color="#343544" />
                  <Text style={styles.activeLabel}>{cfg.label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.passiveWrap}>
                  <Ionicons name={cfg.icon} size={21} color="#D5D7E4" />
                  <Text style={styles.passiveLabel}>{cfg.label}</Text>
                </View>
              )}

              {badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const renderTabBar = (props: BottomTabBarProps) => <RetroTabBar {...props} />;

const TAB_SCREEN_OPTIONS = {
  headerShown: false,
  sceneStyle: { backgroundColor: Colors.bg },
  lazy: true,
  freezeOnBlur: true,
  animation: 'none',
} as const;

export default function TabLayout() {
  return (
    <Tabs tabBar={renderTabBar} screenOptions={TAB_SCREEN_OPTIONS}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="myrooms" />
      <Tabs.Screen name="cevre" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 66,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.55)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 18,
    overflow: 'hidden',
  },
  topChrome: {
    height: 2,
    backgroundColor: 'rgba(232,233,247,.38)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,.45)',
  },
  tabsRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 5,
  },
  tab: {
    flex: 1,
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activePill: {
    width: '94%',
    height: 49,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.75)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
  },
  activeHighlight: {
    position: 'absolute',
    top: 1,
    left: 4,
    right: 4,
    height: 15,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    backgroundColor: 'rgba(255,255,255,.45)',
  },
  activeLabel: {
    marginTop: 1,
    color: '#343544',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  passiveWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  passiveLabel: {
    color: '#E0E2ED',
    fontSize: 9.5,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badge: {
    position: 'absolute',
    right: 8,
    top: 1,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C62E44',
    borderWidth: 1,
    borderColor: '#FFE8ED',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
});
