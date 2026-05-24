/**
 * SopranoChat — Soprano Lobi Radyo Kanal Seçici
 * ═══════════════════════════════════════════════════
 * Bottom sheet — Soprano modal ailesi pattern'i (RoomFollowersSheet referansı):
 * slate diagonal gradient + üst altın halo + inline PanResponder drag-to-dismiss + backdrop tap.
 * Modal component'i KULLANILMAZ — parent layout konteksti içinde absoluteFill render.
 *
 * Memory: feedback_modal_drag_dismiss + feedback_modal_consistency
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Dimensions, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SOPRANO_RADIO_CHANNELS } from '../../constants/sopranoRadioChannels';

const { height: SCREEN_H } = Dimensions.get('window');
const PANEL_HEIGHT = Math.min(SCREEN_H * 0.7, 580);

interface Props {
  visible: boolean;
  currentChannelId: string;
  onSelect: (channelId: string) => void;
  onClose: () => void;
}

export default function RadioChannelSheet({ visible, currentChannelId, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ★ PanResponder — Soprano aile pattern'i (RoomFollowersSheet referansı)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 200, useNativeDriver: true })
            .start(() => onCloseRef.current());
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
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
      <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 540 }} pointerEvents="box-none">
        {/* Backdrop — boş yere dokun = kapat */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: 'rgba(8,12,22,0.50)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Panel — slate gradient + altın halo (radyo karakteri) */}
        <Animated.View
          style={[s.panel, { paddingBottom: 16 + insets.bottom, transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          {/* Soprano slate aile dili */}
          <LinearGradient
            colors={['#3a4658', '#2a3344', '#1a2030']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* Üst altın halo — radyo karakteri */}
          <LinearGradient
            colors={['rgba(251,191,36,0.22)', 'rgba(251,191,36,0.06)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Drag handle bar */}
          <View style={s.dragHandle} />

          {/* Section header */}
          <View style={s.headerRow}>
            <Ionicons name="radio" size={20} color="#FBBF24" style={{ marginRight: 8 }} />
            <Text style={s.headerTitle}>Radyo Kanalları</Text>
          </View>

          {/* Liste */}
          <View style={s.list}>
            {SOPRANO_RADIO_CHANNELS.map((ch) => {
              const isActive = ch.id === currentChannelId;
              return (
                <Pressable
                  key={ch.id}
                  style={({ pressed }) => [
                    s.row,
                    isActive && s.rowActive,
                    pressed && { opacity: 0.7, backgroundColor: 'rgba(255,255,255,0.04)' },
                  ]}
                  onPress={() => { onSelect(ch.id); setTimeout(() => onClose(), 100); }}
                >
                  <LinearGradient
                    colors={ch.gradient as readonly [string, string]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={s.iconCircle}
                  >
                    <Ionicons name={ch.icon as any} size={18} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.chName}>{ch.name}</Text>
                    <Text style={s.chSubtitle}>{ch.subtitle}</Text>
                  </View>
                  {isActive ? (
                    <View style={s.activeBadge}>
                      <Ionicons name="volume-high" size={14} color="#FBBF24" />
                    </View>
                  ) : (
                    <Ionicons name="play" size={16} color="rgba(255,255,255,0.35)" />
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text style={s.footnote}>📻 Yayınlar 3. parti — sürekli güncellenmektedir.</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    minHeight: 380,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 8,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: -4 },
    elevation: 14,
  },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'center', marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 2, marginBottom: 18,
  },
  headerTitle: {
    fontSize: 17, fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  list: { gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1, borderColor: 'transparent',
  },
  rowActive: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.35)',
  },
  iconCircle: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  chName: {
    fontSize: 14, fontWeight: '700',
    color: '#F1F5F9',
  },
  chSubtitle: {
    fontSize: 11, fontWeight: '500',
    color: 'rgba(203,213,225,0.65)',
    marginTop: 2,
  },
  activeBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  footnote: {
    fontSize: 10, color: 'rgba(148,163,184,0.55)',
    textAlign: 'center', marginTop: 18,
  },
});
