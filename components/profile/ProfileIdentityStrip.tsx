/**
 * SopranoChat — Profil kimlik şeridi
 * v110.5.2 (6 May 2026)
 *
 * Diller (bayrak chip'leri) + ilgi alanları.
 * ★ "Gazino" rengarenk görünümü kaldırıldı — tek görsel dil:
 *    mat slate background + subtle border + ikon. Featured Badges
 *    showcase tarzı premium sade his. Kategori rengi sadece ikonda
 *    nokta vurgu olarak görünür.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getLanguage,
  getInterest,
  INTEREST_CATEGORY_COLOR,
} from '../../constants/profileTags';
import { Shadows } from '../../constants/theme';

type Props = {
  languages?: string[] | null;
  interests?: string[] | null;
  /** Kendi profilim mi — boşsa "+ Ekle" CTA gösterilsin */
  isOwn?: boolean;
  /** Kendi profilimde "+ Ekle"ye tıklayınca edit profile sayfasına git */
  onEditPress?: () => void;
};

export default function ProfileIdentityStrip({ languages, interests, isOwn, onEditPress }: Props) {
  const langs = (languages || []).map(getLanguage).filter((l): l is NonNullable<typeof l> => !!l);
  const ints = (interests || []).map(getInterest).filter((i): i is NonNullable<typeof i> => !!i);

  const hasContent = langs.length > 0 || ints.length > 0;
  const showEmptyCta = isOwn && !hasContent && onEditPress;

  if (!hasContent && !showEmptyCta) return null;

  return (
    <View style={s.wrap}>
      {/* ★ v110.5.2: Diller + ilgi alanları TEK satır (yatay scroll), tek görsel dil.
           Diller önde (bayrak), ilgiler arkada (ikon + nokta vurgu). */}
      {(langs.length > 0 || ints.length > 0) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
        >
          {/* Diller — bayrak + dil adı */}
          {langs.map((l) => (
            <View key={`lang-${l.code}`} style={s.chip}>
              <Text style={s.flagText}>{l.flag}</Text>
              <Text style={s.chipLabel}>{l.label}</Text>
            </View>
          ))}

          {/* Diller ile ilgiler arası ince ayraç (her ikisi varsa) */}
          {langs.length > 0 && ints.length > 0 && <View style={s.divider} />}

          {/* İlgi alanları — kategori rengi sadece nokta + ikon, chip mat slate */}
          {ints.map((t) => {
            const color = INTEREST_CATEGORY_COLOR[t.category];
            return (
              <View key={`int-${t.id}`} style={s.chip}>
                <View style={[s.categoryDot, { backgroundColor: color }]} />
                <Ionicons name={t.icon as any} size={11} color="#CBD5E1" />
                <Text style={s.chipLabel}>{t.label}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Boş + kendi profilim → "+ Ekle" CTA */}
      {showEmptyCta && (
        <Pressable
          onPress={onEditPress}
          style={({ pressed }) => [s.emptyCta, pressed && { opacity: 0.7 }]}
          hitSlop={6}
        >
          <Ionicons name="add-circle-outline" size={14} color="rgba(20,184,166,0.85)" />
          <Text style={s.emptyCtaText}>Dil ve ilgi alanı ekle</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 16,
  },
  // ★ v110.5.2: Tek görsel dil — mat slate, hairline border, sade chip
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  flagText: { fontSize: 13 },
  chipLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#E2E8F0',
    letterSpacing: 0.2,
    ...Shadows.text,
  },
  // Kategori vurgusu sadece küçük nokta — chip dolu rengi yok
  categoryDot: {
    width: 5, height: 5, borderRadius: 2.5,
  },
  // Diller-ilgiler ayraç çizgisi
  divider: {
    width: 1, height: 16, marginHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  // Boş CTA
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.25)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(20,184,166,0.05)',
  },
  emptyCtaText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'rgba(20,184,166,0.85)',
    letterSpacing: 0.2,
  },
});
