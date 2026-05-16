/**
 * SopranoChat — Profil Hediye Vitrini
 * ═══════════════════════════════════════════════════════════════════
 * v107 (4 May 2026) — Profil sayfasında kullanıcının ALDIĞI veya
 * VERDİĞİ hediyelerin grid vitrin'i. TikTok/Bigo benzeri statü göstergesi.
 *
 * Format:
 *   🌹×12  ⚜×3  ✨×8  🔥×1  ...
 *
 * Tıklama: hediye detayı (gönderenler listesi) — opsiyonel.
 */

import React, { useEffect, useState } from 'react';
import { i18n } from '../../services/i18n';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GiftStatsService, type GiftAggregate } from '../../services/giftStats';
import { getGiftLottie, hasGiftLottie } from '../../constants/giftLottieRegistry';

let LottieView: any = null;
try {
  LottieView = require('lottie-react-native').default;
} catch { /* fallback */ }

interface Props {
  userId: string;
  /** 'received' = aldığı, 'sent' = verdiği */
  mode: 'received' | 'sent';
  limit?: number;
  /** ★ 2026-05-05: Embedded mod — kart kabuğunu render etme, sadece grid.
   *  GiftSection gibi parent zaten kart kabuğu veriyorsa kullanılır. */
  embedded?: boolean;
}

export default function GiftShowcase({ userId, mode, limit = 8, embedded = false }: Props) {
  const [gifts, setGifts] = useState<GiftAggregate[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const data = mode === 'received'
        ? await GiftStatsService.getReceivedGifts(userId, limit)
        : await GiftStatsService.getSentGifts(userId, limit);
      if (cancelled) return;
      setGifts(data);
      setTotalAmount(data.reduce((sum, g) => sum + g.total_amount, 0));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, mode, limit]);

  if (loading) return null;
  if (gifts.length === 0) return null;

  const titleLabel = mode === 'received' ? 'Aldığı Hediyeler' : 'Verdiği Hediyeler';
  const titleIcon = mode === 'received' ? 'gift' : 'send';
  const TEAL = '#14B8A6';

  // ★ Grid + total — embedded modda sadece bunu render eder, parent kart verir
  const Body = (
    <>
      <View style={s.embeddedTotalRow}>
        <Text style={s.totalText}>
          <Text style={{ color: '#FBBF24', fontWeight: '800' }}>{totalAmount.toLocaleString('tr-TR')} SP</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)' }}>{i18n.t('profile.giftshowcase.001')}</Text>
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
      >
        {gifts.map((g) => (
          <View key={g.gift_id} style={s.cell}>
            {hasGiftLottie(g.gift_id) && LottieView ? (
              <View style={s.thumbWrap} pointerEvents="none">
                <LottieView source={getGiftLottie(g.gift_id)} autoPlay={false} loop={false} style={{ flex: 1 }} />
              </View>
            ) : (
              <View style={[s.thumbWrap, { alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={[s.emoji, { textShadowColor: g.art_color || '#fff' }]}>
                  {g.art_emoji || '✨'}
                </Text>
              </View>
            )}
            <View style={s.countPill}>
              <Text style={s.countText}>×{g.count}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );

  // ★ Embedded mode — parent kart kabuğu verir, biz sadece içerik
  if (embedded) {
    return <View style={s.embeddedWrap}>{Body}</View>;
  }

  return (
    <View style={s.card}>
      <LinearGradient
        colors={['#3a4658', '#2a3344', '#1a2030']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(20,184,166,0.18)', 'rgba(20,184,166,0.05)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={s.header}>
        <Ionicons name={titleIcon as any} size={14} color={TEAL} />
        <Text style={[s.title, { color: TEAL }]}>{titleLabel.toUpperCase()}</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.totalText}>
          <Text style={{ color: TEAL, fontWeight: '800' }}>{totalAmount.toLocaleString('tr-TR')}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)' }}>{i18n.t('profile.giftshowcase.002')}</Text>
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
      >
        {gifts.map((g) => (
          <View key={g.gift_id} style={s.cell}>
            {hasGiftLottie(g.gift_id) && LottieView ? (
              <View style={s.thumbWrap} pointerEvents="none">
                <LottieView source={getGiftLottie(g.gift_id)} autoPlay={false} loop={false} style={{ flex: 1 }} />
              </View>
            ) : (
              <View style={[s.thumbWrap, { alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={[s.emoji, { textShadowColor: g.art_color || '#fff' }]}>
                  {g.art_emoji || '✨'}
                </Text>
              </View>
            )}
            <View style={s.countPill}>
              <Text style={s.countText}>×{g.count}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  // ★ 2026-05-05: Aile dili — slate + teal halo, radius 26, amber border kaldırıldı
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 26,
    backgroundColor: '#1a2030',
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 14 },
      android: { elevation: 10 },
    }),
  },
  // ★ 2026-05-05: Embedded — parent kart sağladığı için sadece padding
  embeddedWrap: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  embeddedTotalRow: {
    paddingHorizontal: 12, paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  totalText: { fontSize: 10 },
  // ★ v108.17: Yatay scroll — 48x48 kompakt hücre
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
  },
  cell: {
    width: 48, height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'visible',
    position: 'relative',
  },
  thumbWrap: {
    width: '100%', height: '100%',
    borderRadius: 10,
    overflow: 'hidden',
  },
  emoji: {
    fontSize: 26,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  countPill: {
    position: 'absolute',
    bottom: -3, right: -3,
    backgroundColor: 'rgba(15,22,38,0.95)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(251,191,36,0.5)',
  },
  countText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFE082',
  },
});
