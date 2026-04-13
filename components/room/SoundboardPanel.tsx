import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal,
  Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';

const { width: W } = Dimensions.get('window');

// ════════════════════════════════════════════════════════════
// KOMPAKT SES EFEKTLERİ PANELİ (Canlı URL'ler ile)
// ════════════════════════════════════════════════════════════
const SOUND_EFFECTS = [
  { id: 'clap',    icon: 'thumbs-up',        label: 'Alkış',    color: '#22C55E', url: 'https://actions.google.com/sounds/v1/crowds/light_applause.ogg' },
  { id: 'laugh',   icon: 'happy-outline',    label: 'Kahkaha',  color: '#FBBF24', url: 'https://actions.google.com/sounds/v1/human_voices/human_laugh_crowd_2.ogg' },
  { id: 'wow',     icon: 'eye-outline',      label: 'Vay!',     color: '#60A5FA', url: 'https://actions.google.com/sounds/v1/human_voices/human_gasp.ogg' },
  { id: 'boo',     icon: 'thumbs-down',      label: 'Buu!',     color: '#F87171', url: 'https://actions.google.com/sounds/v1/crowds/crowd_booing.ogg' },
  { id: 'heart',   icon: 'heart',            label: 'Sevgi',    color: '#F472B6', url: 'https://actions.google.com/sounds/v1/cartoon/cartoon_magic_chime.ogg' },
  { id: 'fire',    icon: 'flame',            label: 'Ateş!',    color: '#FB923C', url: 'https://actions.google.com/sounds/v1/water/fire_burning.ogg' },
  { id: 'horn',    icon: 'megaphone-outline',label: 'Korna',    color: '#A78BFA', url: 'https://actions.google.com/sounds/v1/alarms/car_horn.ogg' },
  { id: 'bell',    icon: 'notifications-outline', label: 'Zil', color: '#FBBF24', url: 'https://actions.google.com/sounds/v1/alarms/dinner_bell_triangle.ogg' },
  { id: 'drum',    icon: 'radio-outline',    label: 'Davul',    color: '#F97316', url: 'https://actions.google.com/sounds/v1/cartoon/cartoon_cowbell.ogg' },
  { id: 'whistle', icon: 'volume-high-outline', label: 'Düdük', color: '#34D399', url: 'https://actions.google.com/sounds/v1/cartoon/clown_horn_honk.ogg' },
  { id: 'cricket', icon: 'bug-outline',      label: 'Cırcır',   color: '#6EE7B7', url: 'https://actions.google.com/sounds/v1/animals/crickets_chirping.ogg' },
  { id: 'tada',    icon: 'sparkles',         label: 'Tada!',    color: '#C084FC', url: 'https://actions.google.com/sounds/v1/cartoon/pop_and_ding.ogg' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onPlaySound?: (soundId: string) => void;
};

export default function SoundboardPanel({ visible, onClose, onPlaySound }: Props) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const scaleAnims = useRef<Record<string, Animated.Value>>({});

  const getScaleAnim = (id: string) => {
    if (!scaleAnims.current[id]) {
      scaleAnims.current[id] = new Animated.Value(1);
    }
    return scaleAnims.current[id];
  };

  const handlePlay = useCallback(async (effect: typeof SOUND_EFFECTS[0]) => {
    const anim = getScaleAnim(effect.id);
    setPlayingId(effect.id);

    // Hafif zıplama animasyonu
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => setPlayingId(null));

    // Odaya broadcast et
    onPlaySound?.(effect.id);

    // Gerçek ses çal (URL üzerinden)
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: effect.url },
        { shouldPlay: true, volume: 1.0 }
      );
      // Ses arka planda çalarken belleği temizlemek için event dinle
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (e) {
      if (__DEV__) console.warn('[Soundboard] Ses çalma hatası:', e);
    }
  }, [onPlaySound]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill}>
        <Pressable style={sb.overlay} onPress={onClose}>
          <Pressable style={sb.sheet} onPress={e => e.stopPropagation()}>
            
            {/* Header */}
            <View style={sb.headerRow}>
              <View style={sb.headerLeft}>
                <View style={sb.iconWrap}>
                  <Ionicons name="musical-notes" size={16} color="#14B8A6" />
                </View>
                <View>
                  <Text style={sb.headerTitle}>Ses Efektleri</Text>
                  <Text style={sb.headerSub}>Odada herkese duyurulur</Text>
                </View>
              </View>
              <Pressable onPress={onClose} style={sb.closeBtn}>
                <Ionicons name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Grid - Komple Kompakt Yapı (3x4 Layout) */}
            <View style={sb.grid}>
              {SOUND_EFFECTS.map((effect) => {
                const isPlaying = playingId === effect.id;
                const scale = getScaleAnim(effect.id);

                return (
                  <Pressable key={effect.id} onPress={() => handlePlay(effect)} style={sb.btnWrap}>
                    <Animated.View style={[
                      sb.effectBtn,
                      isPlaying && { borderColor: effect.color + '50', backgroundColor: effect.color + '15' },
                      { transform: [{ scale }] },
                    ]}>
                      <Ionicons name={effect.icon as any} size={22} color={effect.color} />
                    </Animated.View>
                    <Text style={[sb.effectLabel, isPlaying && { color: effect.color }]}>
                      {effect.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

          </Pressable>
        </Pressable>
      </BlurView>
    </Modal>
  );
}

// 4 sütun için boşluk hesaplaması (Küsürattan dolayı alt satıra geçmemesi için yuvarlama ve ekstra tolerans):
const PADDING_H = 20;
const GAP = 12;
const COLUMNS = 4;
const BTN_SIZE = Math.floor((W - (PADDING_H * 2) - (GAP * (COLUMNS - 1))) / COLUMNS) - 0.5;

const sb = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1E293B', // Koyu Slate Blue
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 0,
    paddingHorizontal: PADDING_H,
    paddingTop: 16,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  btnWrap: {
    alignItems: 'center',
    width: BTN_SIZE,
    gap: 6,
  },
  effectBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  effectLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
