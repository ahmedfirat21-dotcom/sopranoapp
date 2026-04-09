import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, ScrollView,
  Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

const { width: W } = Dimensions.get('window');

// ════════════════════════════════════════════════════════════
// SES EFEKTLERİ — Modern Ionicons tabanlı
// ════════════════════════════════════════════════════════════
const SOUND_EFFECTS = [
  // Tepkiler
  { id: 'clap',    icon: 'thumbs-up',        label: 'Alkış',     category: 'reaction', color: '#22C55E', freq: 800 },
  { id: 'laugh',   icon: 'happy-outline',     label: 'Kahkaha',   category: 'reaction', color: '#FBBF24', freq: 600 },
  { id: 'wow',     icon: 'eye-outline',       label: 'Vay!',      category: 'reaction', color: '#60A5FA', freq: 500 },
  { id: 'boo',     icon: 'thumbs-down',       label: 'Buu!',      category: 'reaction', color: '#F87171', freq: 200 },
  { id: 'heart',   icon: 'heart',             label: 'Sevgi',     category: 'reaction', color: '#F472B6', freq: 700 },
  { id: 'fire',    icon: 'flame',             label: 'Ateş!',     category: 'reaction', color: '#FB923C', freq: 900 },
  // Sesler
  { id: 'horn',    icon: 'megaphone-outline',   label: 'Korna',   category: 'sound', color: '#A78BFA', freq: 350 },
  { id: 'bell',    icon: 'notifications-outline', label: 'Zil',   category: 'sound', color: '#FBBF24', freq: 1000 },
  { id: 'drum',    icon: 'radio-outline',       label: 'Davul',   category: 'sound', color: '#F97316', freq: 150 },
  { id: 'whistle', icon: 'volume-high-outline',  label: 'Düdük',  category: 'sound', color: '#34D399', freq: 1200 },
  { id: 'cricket', icon: 'bug-outline',         label: 'Cırcır',  category: 'sound', color: '#6EE7B7', freq: 400 },
  { id: 'tada',    icon: 'sparkles',            label: 'Tada!',   category: 'sound', color: '#C084FC', freq: 880 },
  // Müzik
  { id: 'rizz',    icon: 'musical-note-outline', label: 'Saksafon', category: 'music', color: '#818CF8', freq: 440 },
  { id: 'piano',   icon: 'musical-notes-outline', label: 'Piyano', category: 'music', color: '#E2E8F0', freq: 523 },
  { id: 'guitar',  icon: 'pulse-outline',        label: 'Gitar',   category: 'music', color: '#FB923C', freq: 330 },
  { id: 'vinyl',   icon: 'disc-outline',         label: 'Scratch', category: 'music', color: '#94A3B8', freq: 250 },
];

const CATEGORIES = [
  { id: 'all',      label: 'Tümü',     icon: 'grid-outline' },
  { id: 'reaction', label: 'Tepkiler', icon: 'happy-outline' },
  { id: 'sound',    label: 'Sesler',   icon: 'volume-high-outline' },
  { id: 'music',    label: 'Müzik',    icon: 'musical-notes-outline' },
];

// ═══ Basit PCM WAV üretici — expo-av için ═══
function generateToneWav(frequency: number, durationMs: number = 200, volume: number = 0.4): string {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationMs / 1000);
  const dataSize = numSamples * 2; // 16-bit mono
  const fileSize = 44 + dataSize;
  
  // WAV header bytes
  const header = [
    0x52,0x49,0x46,0x46, // "RIFF"
    (fileSize-8)&0xff, ((fileSize-8)>>8)&0xff, ((fileSize-8)>>16)&0xff, ((fileSize-8)>>24)&0xff,
    0x57,0x41,0x56,0x45, // "WAVE"
    0x66,0x6d,0x74,0x20, // "fmt "
    16,0,0,0,            // chunk size
    1,0,                  // PCM format
    1,0,                  // mono
    sampleRate&0xff, (sampleRate>>8)&0xff, 0, 0, // sample rate
    (sampleRate*2)&0xff, ((sampleRate*2)>>8)&0xff, 0, 0, // byte rate
    2,0,                  // block align
    16,0,                 // bits per sample
    0x64,0x61,0x74,0x61, // "data"
    dataSize&0xff, (dataSize>>8)&0xff, (dataSize>>16)&0xff, (dataSize>>24)&0xff,
  ];
  
  // Sample data
  const samples: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, (numSamples - i) / (numSamples * 0.3)); // fade out
    const sample = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    samples.push(intSample & 0xff, (intSample >> 8) & 0xff);
  }
  
  // Combine to base64
  const allBytes = [...header, ...samples];
  let binary = '';
  for (const byte of allBytes) {
    binary += String.fromCharCode(byte & 0xff);
  }
  return btoa(binary);
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onPlaySound?: (soundId: string) => void;
};

export default function SoundboardPanel({ visible, onClose, onPlaySound }: Props) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const scaleAnims = useRef<Record<string, Animated.Value>>({});

  const getScaleAnim = (id: string) => {
    if (!scaleAnims.current[id]) {
      scaleAnims.current[id] = new Animated.Value(1);
    }
    return scaleAnims.current[id];
  };

  const filteredEffects = activeCategory === 'all'
    ? SOUND_EFFECTS
    : SOUND_EFFECTS.filter(e => e.category === activeCategory);

  const handlePlay = useCallback(async (effect: typeof SOUND_EFFECTS[0]) => {
    const anim = getScaleAnim(effect.id);
    setPlayingId(effect.id);

    // Bounce animasyonu
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.15, duration: 80, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.92, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => setPlayingId(null));

    // Broadcast
    onPlaySound?.(effect.id);

    // ═══ Gerçek ses üret ve çal ═══
    try {
      const wavBase64 = generateToneWav(effect.freq, 220, 0.35);
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${wavBase64}` },
        { shouldPlay: true, volume: 0.5 }
      );
      setTimeout(() => sound.unloadAsync(), 500);
    } catch (e) {
      if (__DEV__) console.warn('[Soundboard] Ses çalma hatası:', e);
    }
  }, [onPlaySound]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={sb.overlay} onPress={onClose}>
        <Pressable style={sb.sheet} onPress={e => e.stopPropagation()}>
          {/* Handle */}
          <View style={sb.handle} />

          {/* Header */}
          <View style={sb.headerRow}>
            <View style={sb.headerLeft}>
              <Ionicons name="musical-notes" size={18} color="#14B8A6" />
              <Text style={sb.headerTitle}>Ses Efektleri</Text>
            </View>
            <Pressable onPress={onClose} style={sb.closeBtn}>
              <Ionicons name="close" size={16} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Kategori */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={sb.categoryBar}
          >
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                style={[sb.categoryChip, activeCategory === cat.id && sb.categoryChipActive]}
                onPress={() => setActiveCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon as any} size={12}
                  color={activeCategory === cat.id ? '#FFF' : '#64748B'}
                />
                <Text style={[sb.categoryText, activeCategory === cat.id && sb.categoryTextActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Grid */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={sb.grid}
          >
            {filteredEffects.map((effect) => {
              const isPlaying = playingId === effect.id;
              const scale = getScaleAnim(effect.id);

              return (
                <Pressable key={effect.id} onPress={() => handlePlay(effect)}>
                  <Animated.View style={[
                    sb.effectBtn,
                    isPlaying && { borderColor: effect.color + '60', backgroundColor: effect.color + '10' },
                    { transform: [{ scale }] },
                  ]}>
                    <View style={[sb.effectIconWrap, { backgroundColor: effect.color + '18' }]}>
                      <Ionicons name={effect.icon as any} size={20} color={effect.color} />
                    </View>
                    <Text style={[sb.effectLabel, isPlaying && { color: effect.color }]}>
                      {effect.label}
                    </Text>
                  </Animated.View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Info */}
          <View style={sb.infoRow}>
            <Ionicons name="information-circle-outline" size={12} color="#475569" />
            <Text style={sb.infoText}>Ses efektleri odadaki herkese duyurulur</Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const BTN_SIZE = (W - 32 - 18) / 4; // 4 sütun: padding 16*2=32, gap 6*3=18

const sb = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#2d3d4d',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 0,
    maxHeight: '58%',
    paddingBottom: 30,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Kategori
  categoryBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  categoryChipActive: {
    backgroundColor: 'rgba(20,184,166,0.15)',
    borderColor: 'rgba(20,184,166,0.35)',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryTextActive: {
    color: '#FFF',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 6,
    paddingBottom: 10,
  },
  effectBtn: {
    width: BTN_SIZE,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  effectIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effectLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // Info
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  infoText: {
    fontSize: 10,
    color: '#475569',
  },
});
