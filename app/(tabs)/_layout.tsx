import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// sc2 Premium Renk Paleti
const C = {
  cyan: '#00BFFF',
  pink: '#FF1493',
  gold: '#FFD700',
  purple: '#8B5CF6',
  fabGlass: 'rgba(15, 15, 25, 0.75)',
};

type TabIconName = 'home' | 'compass' | 'add' | 'chatbubbles' | 'person';

const ICON_MAP: Record<TabIconName, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  home: { active: 'home', inactive: 'home-outline' },
  compass: { active: 'compass', inactive: 'compass-outline' },
  add: { active: 'add', inactive: 'add' },
  chatbubbles: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  person: { active: 'person', inactive: 'person-outline' },
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // Fiziksel nav bar varsa (insets.bottom > 0) üstüne otur, yoksa 10px boşluk
  const tabBottom = Platform.OS === 'ios' ? 20 : Math.max(insets.bottom, 6);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { bottom: tabBottom }],
        tabBarShowLabel: false,
        tabBarActiveTintColor: C.cyan,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarItemStyle: styles.tabItem,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: '#000000' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Anasayfa',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home" focused={focused} color={C.cyan} />
          ),
          tabBarActiveTintColor: C.cyan,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Keşfet',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="compass" focused={focused} color={C.pink} />
          ),
          tabBarActiveTintColor: C.pink,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <CreateButton focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Mesajlar',
          tabBarIcon: ({ focused }) => (
            <View>
              <TabIcon name="chatbubbles" focused={focused} color={C.gold} />
              {/* Badge will be shown when unread count logic is connected */}
            </View>
          ),
          tabBarActiveTintColor: C.gold,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profilim',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person" focused={focused} color={C.purple} />
          ),
          tabBarActiveTintColor: C.purple,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, focused, color }: { name: TabIconName; focused: boolean; color: string }) {
  const iconName = focused ? ICON_MAP[name].active : ICON_MAP[name].inactive;
  return (
    <View style={styles.tabIconWrap}>
      <Ionicons
        name={iconName}
        size={24}
        color={focused ? color : 'rgba(255,255,255,0.4)'}
      />
      {focused && (
        <View style={[styles.activeIndicator, { backgroundColor: color, shadowColor: color }]} />
      )}
    </View>
  );
}

function CreateButton({ focused }: { focused: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const bgColors: [string, string] = focused ? ['#FFD700', '#FFA500'] : ['#00E5FF', '#0099CC'];
  const glowShadow = focused ? '#FFD700' : '#00E5FF';

  return (
    <View style={styles.createBtnContainer}>
      {/* Premium Animated Background Aura */}
      <Animated.View style={[
        styles.fabAura,
        { 
          backgroundColor: glowShadow,
          transform: [{ scale: pulseAnim }],
          opacity: pulseAnim.interpolate({ inputRange: [1, 1.15], outputRange: [0.6, 0.1] })
        }
      ]} />

      {/* The static premium button */}
      <LinearGradient
        colors={bgColors}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.createButton, { shadowColor: glowShadow }]}
      >
        <Ionicons name="add" size={32} color="#FFF" />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    // bottom değeri TabLayout'ta dinamik ayarlanıyor
    left: 12,
    right: 12,
    height: 58,
    borderRadius: 32,
    backgroundColor: C.fabGlass,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    paddingBottom: 0,
    paddingTop: 0,
  },
  tabItem: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  activeIndicator: {
    width: 16,
    height: 3,
    borderRadius: 2,
    marginTop: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
  createBtnContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -36,
  },
  fabAura: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  createButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 15,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#000',
  },
});
