/**
 * SopranoChat — Sosyal Linkler Editörü
 * v110.5 (6 May 2026)
 *
 * Edit profile sayfasından açılan inline form modal.
 * Instagram / X (Twitter) / Web sitesi.
 *
 * Sanitization: kullanıcı '@username' veya 'username' yazsa bile
 * düzgün URL'ye çevrilir. https:// prefix otomatik eklenir.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Dimensions, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadows } from '../../constants/theme';

const { height: H } = Dimensions.get('window');

export type SocialLinks = {
  instagram?: string;
  twitter?: string;
  website?: string;
};

type Props = {
  visible: boolean;
  initial: SocialLinks | null | undefined;
  onSave: (links: SocialLinks) => void;
  onClose: () => void;
};

// '@kullanici' veya 'kullanici' veya tam URL → tam URL
const normalizeHandle = (raw: string, prefix: string): string => {
  const s = (raw || '').trim();
  if (!s) return '';
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return prefix + s.replace(/^@/, '');
};

export default function SocialLinksEditor({ visible, initial, onSave, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [ig, setIg] = useState('');
  const [tw, setTw] = useState('');
  const [web, setWeb] = useState('');

  const translateY = useRef(new Animated.Value(H + 50)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Initial'dan gelen URL'leri kullanıcı dostu @handle formatına dönüştür
      setIg((initial?.instagram || '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '@'));
      setTw((initial?.twitter || '').replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//, '@'));
      setWeb(initial?.website || '');
      Animated.parallel([
        Animated.spring(translateY, { toValue: 60, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: H + 50, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, initial]);

  const handleSave = () => {
    const out: SocialLinks = {};
    const igNorm = normalizeHandle(ig, 'https://instagram.com/');
    const twNorm = normalizeHandle(tw, 'https://x.com/');
    const webNorm = web.trim()
      ? (web.startsWith('http://') || web.startsWith('https://') ? web.trim() : 'https://' + web.trim())
      : '';
    if (igNorm) out.instagram = igNorm;
    if (twNorm) out.twitter = twNorm;
    if (webNorm) out.website = webNorm;
    onSave(out);
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={s.root} pointerEvents="box-none">
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(8,12,22,0.55)', opacity: backdropOpacity }]}
        pointerEvents="auto"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(245,158,11,0.20)', 'rgba(245,158,11,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={s.handleWrap}><View style={s.dragHandle} /></View>
        <View style={s.header}>
          <Pressable onPress={onClose} style={s.iconBtn} hitSlop={8}>
            <Ionicons name="chevron-down" size={22} color="#F1F5F9" />
          </Pressable>
          <Text style={s.title}>SOSYAL LİNKLER</Text>
          <Pressable onPress={handleSave} style={s.saveBtn} hitSlop={8}>
            <Text style={s.saveText}>Kaydet</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={[s.body, { paddingBottom: 24 + insets.bottom }]}>
            <Text style={s.hint}>
              Profilinde gösterilen opsiyonel sosyal linkler. Kullanıcı adını
              veya tam URL'yi yazabilirsin.
            </Text>

            {/* Instagram */}
            <View style={s.row}>
              <View style={[s.iconWrap, { backgroundColor: 'rgba(225,48,108,0.12)' }]}>
                <Ionicons name="logo-instagram" size={20} color="#E1306C" />
              </View>
              <TextInput
                value={ig}
                onChangeText={setIg}
                placeholder="@kullaniciadin"
                placeholderTextColor="rgba(148,163,184,0.5)"
                autoCapitalize="none"
                autoCorrect={false}
                style={s.input}
              />
            </View>

            {/* X (eski Twitter) */}
            <View style={s.row}>
              <View style={[s.iconWrap, { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }]}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#F1F5F9' }}>𝕏</Text>
              </View>
              <TextInput
                value={tw}
                onChangeText={setTw}
                placeholder="@kullaniciadin"
                placeholderTextColor="rgba(148,163,184,0.5)"
                autoCapitalize="none"
                autoCorrect={false}
                style={s.input}
              />
            </View>

            {/* Website */}
            <View style={s.row}>
              <View style={[s.iconWrap, { backgroundColor: 'rgba(20,184,166,0.12)' }]}>
                <Ionicons name="globe-outline" size={20} color="#14B8A6" />
              </View>
              <TextInput
                value={web}
                onChangeText={setWeb}
                placeholder="ornek.com veya https://..."
                placeholderTextColor="rgba(148,163,184,0.5)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={s.input}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  sheet: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  handleWrap: { alignItems: 'center', paddingTop: 8 },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 13, fontWeight: '900' as const, color: '#F1F5F9',
    letterSpacing: 1.5, textAlign: 'center' as const,
    ...Shadows.text,
  },
  saveBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.45)',
  },
  saveText: {
    fontSize: 13, fontWeight: '800' as const, color: '#FBBF24', letterSpacing: 0.4,
  },
  body: {
    flex: 1, paddingHorizontal: 16, paddingTop: 16,
  },
  hint: {
    fontSize: 12, color: '#94A3B8', lineHeight: 17, marginBottom: 16,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 14, color: '#F1F5F9',
    fontWeight: '600' as const,
    paddingVertical: 4,
  },
});
