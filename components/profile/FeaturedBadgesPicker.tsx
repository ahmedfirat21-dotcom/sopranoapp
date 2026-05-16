/**
 * SopranoChat — Öne Çıkan Rozet Seçici
 * v110.5 (6 May 2026)
 *
 * Kullanıcı sahip olduğu rozetlerden en fazla 3 tanesini öne çıkarır.
 * Edit profile sayfasından açılır.
 */
import React, { useEffect, useRef, useState } from 'react';
import { i18n } from '../../services/i18n';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadows } from '../../constants/theme';
import { BADGES } from '../../constants/badges';
import { showToast } from '../Toast';
import {
  FeaturedBadgesService, MAX_FEATURED_BADGES,
} from '../../services/profileExtras';
import { supabase } from '../../constants/supabase';

const { height: H } = Dimensions.get('window');

type Props = {
  visible: boolean;
  userId: string;
  onSaved: (selectedIds: string[]) => void;
  onClose: () => void;
};

export default function FeaturedBadgesPicker({ visible, userId, onSaved, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [allBadges, setAllBadges] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const translateY = useRef(new Animated.Value(H + 50)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: H + 50, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      return;
    }
    setLoading(true);
    Promise.all([
      supabase.from('user_badges').select('badge_id, is_featured').eq('user_id', userId),
    ]).then(([r]) => {
      const rows = (r.data || []) as any[];
      setAllBadges(rows.map(x => x.badge_id));
      setSelected(rows.filter(x => x.is_featured).map(x => x.badge_id));
    }).finally(() => setLoading(false));
    Animated.parallel([
      Animated.spring(translateY, { toValue: 60, useNativeDriver: true, damping: 22, stiffness: 200 }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [visible, userId]);

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_FEATURED_BADGES) {
        showToast({ title: i18n.t('auto.profile.FeaturedBadgesPicker.002', { 0: MAX_FEATURED_BADGES }), type: 'info' });
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await FeaturedBadgesService.setFeatured(userId, selected);
      onSaved(selected);
      onClose();
      showToast({ title: i18n.t('profile.featuredbadgespicker.001'), type: 'success' });
    } catch (e: any) {
      showToast({ title: 'Kaydedilemedi', message: e?.message || '', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  const validBadges = allBadges.map(id => BADGES[id]).filter(Boolean);

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
          <Text style={s.title}>{i18n.t('profile.featuredbadgespicker.001')}</Text>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[s.saveBtn, saving && { opacity: 0.5 }]}
            hitSlop={8}
          >
            <Text style={s.saveText}>Kaydet</Text>
          </Pressable>
        </View>

        <Text style={s.hint}>
          Profilinde öne çıkacak en fazla {MAX_FEATURED_BADGES} rozet seç.
          {selected.length > 0 && i18n.t('auto.profile.FeaturedBadgesPicker.001', { 0: selected.length, 1: MAX_FEATURED_BADGES })}
        </Text>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <Text style={[s.hint, { textAlign: 'center', marginTop: 40 }]}>{i18n.t('profile.featuredbadgespicker.002')}</Text>
          ) : validBadges.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="ribbon-outline" size={48} color="rgba(148,163,184,0.5)" />
              <Text style={s.emptyTitle}>{i18n.t('profile.featuredbadgespicker.003')}</Text>
              <Text style={s.emptyDesc}>{i18n.t('profile.featuredbadgespicker.004')}</Text>
            </View>
          ) : (
            <View style={s.grid}>
              {validBadges.map(b => {
                const sel = selected.includes(b.id);
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => toggle(b.id)}
                    style={({ pressed }) => [
                      s.cell,
                      sel && { borderColor: b.color, backgroundColor: b.color + '22' },
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    {sel && (
                      <View style={s.checkAbs}>
                        <Ionicons name="checkmark" size={11} color="#FFF" />
                      </View>
                    )}
                    <LinearGradient
                      colors={[b.color + 'CC', b.color + '55']}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={s.iconCircle}
                    >
                      <Ionicons name={b.icon as any} size={20} color="#FFF" />
                    </LinearGradient>
                    <Text style={[s.label, { color: sel ? b.color : '#CBD5E1' }]} numberOfLines={1}>
                      {b.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
  },
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
  hint: {
    fontSize: 12, color: '#94A3B8', lineHeight: 17,
    paddingHorizontal: 16, marginBottom: 4,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  cell: {
    width: '30%',
    alignItems: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative' as const,
  },
  checkAbs: {
    position: 'absolute' as const, top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FBBF24',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 3,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  label: {
    fontSize: 10, fontWeight: '700' as const,
    letterSpacing: 0.3, textAlign: 'center' as const,
  },
  emptyBox: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 60, gap: 10,
  },
  emptyTitle: {
    fontSize: 14, fontWeight: '800' as const, color: '#CBD5E1',
  },
  emptyDesc: {
    fontSize: 11, color: '#94A3B8', textAlign: 'center' as const,
  },
});
