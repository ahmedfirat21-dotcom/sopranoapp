/**
 * SopranoChat — Diller + İlgi Alanları Seçici Sheet
 * v110.5 (6 May 2026)
 *
 * Edit profile sayfasından açılan bottom sheet — kullanıcı dil ve ilgi
 * alanlarını chip'lere tıklayarak seçer/çıkarır. Max sınırlar otomatik
 * uygulanır (5 dil, 8 ilgi).
 *
 * Tutarlılık: Profil sheet aile dili (slate gradient + amber halo + chevron-down).
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Dimensions,
  Animated, PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadows } from '../../constants/theme';
import {
  LANGUAGE_OPTIONS, MAX_LANGUAGES,
  INTEREST_TAGS, MAX_INTERESTS,
  INTEREST_CATEGORY_LABELS, INTEREST_CATEGORY_COLOR,
  type InterestCategory,
} from '../../constants/profileTags';

const { height: H } = Dimensions.get('window');
const SHEET_FULL = 60;
const SHEET_DISMISS = H + 50;

type Props = {
  visible: boolean;
  initialLanguages: string[];
  initialInterests: string[];
  onSave: (languages: string[], interests: string[]) => void;
  onClose: () => void;
};

export default function LanguageInterestPicker({
  visible, initialLanguages, initialInterests, onSave, onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'lang' | 'interest'>('lang');
  const [langs, setLangs] = useState<string[]>(initialLanguages);
  const [ints, setInts] = useState<string[]>(initialInterests);

  const translateY = useRef(new Animated.Value(SHEET_DISMISS)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // visible toggle → animate
  useEffect(() => {
    if (visible) {
      // İçerik state'i her açılışta initial'a sıfırla (kullanıcı kaydetmeden çıkıp tekrar açabilir)
      setLangs(initialLanguages);
      setInts(initialInterests);
      setTab('lang');
      translateY.setValue(SHEET_DISMISS);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: SHEET_FULL, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, initialLanguages, initialInterests, translateY, backdropOpacity]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SHEET_DISMISS, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onCloseRef.current());
  };

  const handleSave = () => {
    onSave(langs, ints);
    handleClose();
  };

  // ★ Drag-to-dismiss: header'dan başla
  const headerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(SHEET_FULL + g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.6) {
          handleClose();
        } else {
          Animated.spring(translateY, { toValue: SHEET_FULL, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
        }
      },
    }),
  ).current;

  if (!visible) return null;

  // Dil toggle
  const toggleLang = (code: string) => {
    setLangs(prev => {
      if (prev.includes(code)) return prev.filter(l => l !== code);
      if (prev.length >= MAX_LANGUAGES) return prev; // sınır
      return [...prev, code];
    });
  };

  // İlgi toggle
  const toggleInt = (id: string) => {
    setInts(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      if (prev.length >= MAX_INTERESTS) return prev; // sınır
      return [...prev, id];
    });
  };

  // İlgi alanlarını kategoriye göre gruple
  const groupedInts: Record<InterestCategory, typeof INTEREST_TAGS> = INTEREST_TAGS.reduce(
    (acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    },
    {} as Record<InterestCategory, typeof INTEREST_TAGS>,
  );

  return (
    <View style={s.root} pointerEvents="box-none">
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(8,12,22,0.55)', opacity: backdropOpacity }]}
        pointerEvents="auto"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
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

        {/* Header */}
        <View {...headerPan.panHandlers}>
          <View style={s.handleWrap}>
            <View style={s.dragHandle} />
          </View>
          <View style={s.header}>
            <Pressable onPress={handleClose} style={s.iconBtn} hitSlop={8}>
              <Ionicons name="chevron-down" size={22} color="#F1F5F9" />
            </Pressable>
            <Text style={s.title}>KİMLİĞİN</Text>
            <Pressable onPress={handleSave} style={s.saveBtn} hitSlop={8}>
              <Text style={s.saveText}>Kaydet</Text>
            </Pressable>
          </View>

          {/* Tab switcher */}
          <View style={s.tabRow}>
            <Pressable
              onPress={() => setTab('lang')}
              style={[s.tab, tab === 'lang' && s.tabActive]}
            >
              <Ionicons name="language" size={14} color={tab === 'lang' ? '#FBBF24' : '#94A3B8'} />
              <Text style={[s.tabText, tab === 'lang' && s.tabTextActive]}>
                Diller {langs.length > 0 ? `· ${langs.length}` : ''}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('interest')}
              style={[s.tab, tab === 'interest' && s.tabActive]}
            >
              <Ionicons name="sparkles" size={14} color={tab === 'interest' ? '#FBBF24' : '#94A3B8'} />
              <Text style={[s.tabText, tab === 'interest' && s.tabTextActive]}>
                İlgi Alanları {ints.length > 0 ? `· ${ints.length}` : ''}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 + insets.bottom, paddingHorizontal: 16, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'lang' ? (
            <>
              <Text style={s.hint}>
                Konuştuğun dilleri seç (en fazla {MAX_LANGUAGES}). Yabancı kullanıcılar
                hangi dilde sohbet edeceğini görebilir.
              </Text>
              <View style={s.chipGrid}>
                {LANGUAGE_OPTIONS.map(l => {
                  const selected = langs.includes(l.code);
                  return (
                    <Pressable
                      key={l.code}
                      onPress={() => toggleLang(l.code)}
                      style={({ pressed }) => [
                        s.langOption,
                        selected && s.langOptionSelected,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={s.langOptionFlag}>{l.flag}</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.langOptionLabel, selected && { color: '#FBBF24' }]} numberOfLines={1}>
                          {l.label}
                        </Text>
                        <Text style={s.langOptionNative} numberOfLines={1}>{l.nativeLabel}</Text>
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={18} color="#FBBF24" />}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <Text style={s.hint}>
                İlgilendiğin konuları seç (en fazla {MAX_INTERESTS}). Profilinde görünür ve
                keşfet algoritması bu seçimleri kullanır.
              </Text>
              {(Object.keys(groupedInts) as InterestCategory[]).map(cat => (
                <View key={cat} style={{ marginBottom: 14 }}>
                  <View style={s.categoryHeader}>
                    <View style={[s.categoryDot, { backgroundColor: INTEREST_CATEGORY_COLOR[cat] }]} />
                    <Text style={s.categoryLabel}>{INTEREST_CATEGORY_LABELS[cat]}</Text>
                  </View>
                  <View style={s.intGrid}>
                    {groupedInts[cat].map(t => {
                      const selected = ints.includes(t.id);
                      const color = INTEREST_CATEGORY_COLOR[t.category];
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => toggleInt(t.id)}
                          style={({ pressed }) => [
                            s.intOption,
                            selected && {
                              borderColor: color,
                              backgroundColor: color + '22',
                            },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Ionicons
                            name={t.icon as any}
                            size={13}
                            color={selected ? color : '#94A3B8'}
                          />
                          <Text style={[
                            s.intOptionLabel,
                            selected && { color, fontWeight: '800' },
                          ]}>
                            {t.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </>
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
    fontSize: 14, fontWeight: '900' as const, color: '#F1F5F9',
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
  tabRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  tabText: {
    fontSize: 12, fontWeight: '700' as const, color: '#94A3B8', letterSpacing: 0.3,
  },
  tabTextActive: { color: '#FBBF24' },
  hint: {
    fontSize: 12, color: '#94A3B8', lineHeight: 17, marginBottom: 14,
  },
  chipGrid: { gap: 8 },
  // Diller — liste şeklinde (her satır bir dil, yeterince yer)
  langOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  langOptionSelected: {
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderColor: 'rgba(245,158,11,0.5)',
  },
  langOptionFlag: { fontSize: 22 },
  langOptionLabel: {
    fontSize: 14, fontWeight: '700' as const, color: '#F1F5F9',
    ...Shadows.text,
  },
  langOptionNative: {
    fontSize: 11, color: '#94A3B8', marginTop: 2,
  },
  // İlgi alanları — flex grid (kategori altında küçük chip'ler)
  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 8, marginTop: 4,
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  categoryLabel: {
    fontSize: 11, fontWeight: '900' as const, color: '#CBD5E1',
    letterSpacing: 1, textTransform: 'uppercase' as const,
  },
  intGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
  },
  intOption: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6.5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  intOptionLabel: {
    fontSize: 11, fontWeight: '700' as const, color: '#CBD5E1',
    letterSpacing: 0.2,
  },
});
