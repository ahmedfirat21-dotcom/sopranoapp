/**
 * SopranoChat — Oda Takipçileri Sheet (1 May 2026)
 * ═══════════════════════════════════════════════════
 * Host'un oda takipçilerini gördüğü minimal bottom sheet.
 * RoomFollowService.getRoomFollowers ile veri çekilir, FlatList ile
 * avatar + isim listesi. Tap'te profil sheet açılır.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, FlatList,
  Image, Dimensions, Platform, PanResponder,
} from 'react-native';
import AppLoader from '../AppLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoomFollowService } from '../../services/roomFollow';
import { getAvatarSource } from '../../constants/avatars';

const { height: H } = Dimensions.get('window');

interface Follower {
  id: string;
  display_name: string;
  avatar_url: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  totalCount: number;
  onSelectUser?: (userId: string) => void;
}

const PANEL_HEIGHT = H * 0.75;

export default function RoomFollowersSheet({ visible, onClose, roomId, totalCount, onSelectUser }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [items, setItems] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);

  // Pan responder — swipe down to dismiss
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 200, useNativeDriver: true }).start(() => onCloseRef.current());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      // Veri çek
      setLoading(true);
      RoomFollowService.getRoomFollowers(roomId, 100)
        .then(list => setItems(list))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, roomId]);

  if (!visible) return null;

  const renderItem = ({ item }: { item: Follower }) => (
    <Pressable
      onPress={() => onSelectUser?.(item.id)}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.6, backgroundColor: 'rgba(255,255,255,0.04)' }]}
    >
      <Image source={getAvatarSource(item.avatar_url)} style={s.avatar} />
      <Text style={s.name} numberOfLines={1}>{item.display_name}</Text>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
    </Pressable>
  );

  return (
    <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
      <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 530 }} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: 'rgba(0,0,0,0.55)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            s.panel,
            { paddingBottom: 16 + insets.bottom, transform: [{ translateY }] },
          ]}
          {...panResponder.panHandlers}
        >
          <LinearGradient
            colors={['#1e2230', '#15182a', '#0a0b16']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['transparent', 'rgba(236,72,153,0.85)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
          />

          <View style={s.handle}>
            <View style={s.handleBar} />
          </View>

          <View style={s.header}>
            <View style={s.headerIconWrap}>
              <Ionicons name="people-circle" size={18} color="#EC4899" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>ODA TAKİPÇİLERİ</Text>
              <Text style={s.subtitle}>
                {totalCount > 0
                  ? `${totalCount} kişi bu odayı takip ediyor`
                  : 'Henüz takipçi yok'}
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={s.loadingWrap}>
              <AppLoader size="small" color="#EC4899" />
            </View>
          ) : items.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="heart-dislike-outline" size={36} color="rgba(255,255,255,0.18)" />
              <Text style={s.emptyText}>Bu odanın henüz takipçisi yok</Text>
              <Text style={s.emptyHint}>Odanın altında "Takip Et" tıklayanlar burada listelenir.</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(it) => it.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={s.sep} />}
            />
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: PANEL_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(236,72,153,0.35)',
    borderBottomWidth: 0,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.6, shadowRadius: 22 },
      android: {},
    }),
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.6 },
  handle: { alignItems: 'center', paddingVertical: 12 },
  handleBar: { width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(236,72,153,0.5)' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
  },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(236,72,153,0.15)',
    borderWidth: 1, borderColor: 'rgba(236,72,153,0.45)',
  },
  title: {
    fontSize: 13, fontWeight: '900', color: '#EC4899',
    letterSpacing: 1.4,
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: '#F1F5F9' },
  sep: { height: 1, marginHorizontal: 18, backgroundColor: 'rgba(255,255,255,0.04)' },
  loadingWrap: { paddingVertical: 32, alignItems: 'center' },
  emptyWrap: { paddingVertical: 36, alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '700', marginTop: 10, textAlign: 'center' },
  emptyHint: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, textAlign: 'center' },
});
