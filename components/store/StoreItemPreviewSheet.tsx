/**
 * SopranoChat — Store Item Preview Sheet
 * ═══════════════════════════════════════════════════════════════════
 * v109.5 (5 May 2026)
 *
 * Mağaza ürününe (frame, entry_effect, gift, sembol) tıklanınca açılan
 * "ürünü gör" bottom sheet'i. Eskiden direkt PremiumAlert "şunu satın al?"
 * çıkıyordu — ürün hiç görünmeden satın alma onayı isteniyordu.
 *
 * Tasarım:
 *  - Drag-to-dismiss + handle + backdrop tap (memory: feedback_modal_drag_dismiss)
 *  - X butonu YOK (memory: feedback_no_x_on_draggable)
 *  - Hero: Item3DArt büyük (220px) + rarity rengi glow
 *  - İsim (serif), kategori meta + nadirlik chip, tagline
 *  - Fiyat bloku: orijinal + indirim chip'leri + final fiyat
 *  - Günün Fırsatı: gece yarısına kadar kalan saat:dk countdown
 *  - Footer: "Satın Al — XXX SP" (sahip ise disabled "Sahipsin", tier-lock ise "Plus Üyelik Gerekli")
 *
 * Parent (store.tsx, collection/[id].tsx) sadece sheet'i açar; gerçek satın alma
 * akışı hâlâ parent'ta kalır (StoreService.purchase + success modal).
 */

import React, { useEffect, useRef, useState } from 'react';
import { i18n } from '../../services/i18n';
import {
  View, Text, StyleSheet, Animated, PanResponder, Dimensions,
  Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Item3DArt from './Item3DArt';
import SPIcon from '../SPIcon';
import type { CosmeticItem, Rarity, DailyDeal } from '../../services/store';

const { width: W } = Dimensions.get('window');

const RARITY_LABEL: Record<Rarity, string> = {
  divine: 'İLAHİ', mythic: 'EFSANEVİ', legendary: 'EFSANE', rare: 'NADİR', new: 'YENİ',
};
const RARITY_COLOR: Record<Rarity, string> = {
  divine: '#F472B6', mythic: '#C4B5FD', legendary: '#FBBF24', rare: '#22D3EE', new: '#FB923C',
};

function categoryLabel(cat: string): string {
  if (cat === 'atelier' || cat === 'frames') return 'Çerçeve';
  if (cat === 'message_art' || cat === 'entry_effect') return 'Giriş Efekti';
  if (cat === 'gift') return 'Hediye';
  return 'Ürün';
}

const TIER_RANK: Record<string, number> = { Free: 0, Plus: 1, Pro: 2, GodMaster: 3 };

interface Props {
  visible: boolean;
  item: CosmeticItem | null;
  /** Bugünün daily deal'ı — varsa ekstra indirim & countdown gösterir */
  dailyDeal?: DailyDeal | null;
  /** Tier indirim yüzdesi (Plus/Pro üyelere otomatik kozmetik indirimi) */
  tierDiscountPct: number;
  /** Mevcut kullanıcı tier'ı — tier-lock kontrolü için */
  currentTier: 'Free' | 'Plus' | 'Pro' | 'GodMaster';
  /** Kullanıcı SP bakiyesi — yetersizse "X SP eksik" uyarısı */
  spBalance: number;
  /** Bu ürün envanterde mi? */
  owned: boolean;
  /** Yükleniyor (aktif satın alma) — buton disabled + spinner */
  purchasing: boolean;
  onClose: () => void;
  /** Satın al butonu — parent'ta gerçek StoreService.purchase çağrılır */
  onPurchase: (item: CosmeticItem) => void;
  /** Plus/Pro yükseltme CTA — tier-lock durumunda */
  onUpgradeTier?: (requiredTier: string) => void;
}

export default function StoreItemPreviewSheet({
  visible, item, dailyDeal, tierDiscountPct, currentTier, spBalance, owned,
  purchasing, onClose, onPurchase, onUpgradeTier,
}: Props) {
  const insets = useSafeAreaInsets();
  const PANEL_HEIGHT = 580 + Math.max(insets.bottom, 0);

  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const heroBreath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      const breath = Animated.loop(Animated.sequence([
        Animated.timing(heroBreath, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(heroBreath, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ]));
      breath.start();
      return () => { breath.stop(); };
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, PANEL_HEIGHT]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) translateY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60 || gs.vy > 0.5) {
          Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 200, useNativeDriver: true })
            .start(() => onCloseRef.current());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
      },
    })
  ).current;

  if (!visible && !item) return null;
  if (!item) return null;

  const dealOff = dailyDeal && dailyDeal.item_id === item.id ? dailyDeal.extra_discount_pct : 0;
  const totalOff = Math.min(tierDiscountPct + dealOff, 80);
  const finalPrice = totalOff > 0 ? Math.round(item.price_sp * (100 - totalOff) / 100) : item.price_sp;
  const insufficientSP = !owned && spBalance < finalPrice;

  const rarity = item.rarity;
  const rarityColor = rarity ? RARITY_COLOR[rarity] : '#14B8A6';
  const rarityLabel = rarity ? RARITY_LABEL[rarity] : '';
  const artColor = item.art_color || rarityColor;

  // Tier-lock kontrolü — min_tier rank > currentTier rank
  const minTier = item.min_tier || null;
  const tierLocked = !!(minTier && minTier !== 'Free' && (TIER_RANK[currentTier] ?? 0) < (TIER_RANK[minTier] ?? 0));

  const heroScale = heroBreath.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.05] });

  return (
    <View style={s.root} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose}>
          <BlurView intensity={Platform.OS === 'ios' ? 22 : 14} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(5,8,18,0.45)' }]} />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[s.panel, { height: PANEL_HEIGHT, transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Panel arka — slate gradient (profil sheet'i ile aynı palet) */}
        <LinearGradient
          colors={['#1E293B', '#0F172A', '#070B14']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Drag handle */}
        <View style={s.handle} />

        {/* Hero — büyük ürün görseli */}
        <View style={s.hero}>
          {/* Rarity glow halo */}
          {/* ★ v110.14: Android'de heroGlow tamamen kaldırıldı — shadow blur etmediği
               için yumuşak halo yerine düz dolgun renk dairesi çıkıyordu (kullanıcı
               "modal öncesi hal gibi göster"). iOS'ta shadow gerçek halo yaptığı için
               iOS'ta korunuyor. */}
          {Platform.OS === 'ios' && (
            <View style={[s.heroGlow, { backgroundColor: rarityColor + '22', shadowColor: rarityColor }]} pointerEvents="none" />
          )}
          <Animated.View style={{ transform: [{ scale: heroScale }] }}>
            <Item3DArt
              itemId={item.id}
              size={180}
              color={artColor}
            />
          </Animated.View>
          {dealOff > 0 && (
            <View style={s.dealBadge}>
              <Ionicons name="flash" size={11} color="#fff" />
              <Text style={s.dealBadgeText}>{i18n.t('store.storeitempreviewsheet.001')}</Text>
              <DailyDealCountdown />
            </View>
          )}
        </View>

        {/* Bilgi alanı */}
        <View style={s.infoRow}>
          <Text style={s.metaLabel}>{categoryLabel(item.category)}</Text>
          {rarityLabel ? (
            <View style={[s.rarityChip, { borderColor: rarityColor + '88', backgroundColor: rarityColor + '14' }]}>
              <Text style={[s.rarityChipText, { color: rarityColor }]}>{rarityLabel}</Text>
            </View>
          ) : null}
          {minTier && minTier !== 'Free' && (
            <View style={[s.rarityChip, { borderColor: 'rgba(34,211,238,0.5)', backgroundColor: 'rgba(34,211,238,0.10)' }]}>
              <Ionicons name="diamond" size={9} color="#22D3EE" />
              <Text style={[s.rarityChipText, { color: '#22D3EE' }]}>{minTier}+</Text>
            </View>
          )}
        </View>
        <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
        {item.tagline ? (
          <Text style={s.tagline} numberOfLines={3}>{item.tagline}</Text>
        ) : null}

        {/* Fiyat kartı */}
        <View style={s.priceCard}>
          <LinearGradient
            colors={['rgba(251,191,36,0.10)', 'rgba(0,0,0,0.30)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.priceLeft}>
            <Text style={s.priceLabel}>{i18n.t('store.storeitempreviewsheet.002')}</Text>
            <View style={s.priceRow}>
              {totalOff > 0 && (
                <Text style={s.priceStrike}>{item.price_sp.toLocaleString('tr-TR')}</Text>
              )}
              <Text style={s.priceFinal}>{finalPrice.toLocaleString('tr-TR')}</Text>
              <SPIcon size={18} />
            </View>
            {totalOff > 0 && (
              <View style={s.discountChips}>
                {tierDiscountPct > 0 && (
                  <View style={s.discountChip}>
                    <Ionicons name="diamond" size={9} color="#22D3EE" />
                    <Text style={s.discountChipText}>{currentTier} -%{tierDiscountPct}</Text>
                  </View>
                )}
                {dealOff > 0 && (
                  <View style={[s.discountChip, { borderColor: 'rgba(244,114,182,0.45)', backgroundColor: 'rgba(244,114,182,0.10)' }]}>
                    <Ionicons name="flash" size={9} color="#F472B6" />
                    <Text style={[s.discountChipText, { color: '#F472B6' }]}>Fırsat -%{dealOff}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          <View style={[s.priceOff, { borderColor: rarityColor + '66', backgroundColor: rarityColor + '14' }]}>
            <Text style={[s.priceOffText, { color: rarityColor }]}>
              {totalOff > 0 ? `-%${totalOff}` : 'TAM FİYAT'}
            </Text>
          </View>
        </View>

        {/* Bakiye satırı */}
        {!owned && !tierLocked && (
          <View style={s.balanceRow}>
            <Text style={s.balanceLabel}>Bakiyen:</Text>
            <Text style={[s.balanceValue, insufficientSP && { color: '#F87171' }]}>
              {spBalance.toLocaleString('tr-TR')}
            </Text>
            <SPIcon size={12} />
            {insufficientSP && (
              <Text style={s.insufficientText}>
                · {(finalPrice - spBalance).toLocaleString('tr-TR')} SP eksik
              </Text>
            )}
          </View>
        )}

        {/* Footer aksiyon */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
          {owned ? (
            <View style={[s.actionBtn, s.actionBtnOwned]}>
              <Ionicons name="checkmark-circle" size={18} color="#5DCAA5" />
              <Text style={[s.actionText, { color: '#5DCAA5' }]}>Sahipsin</Text>
            </View>
          ) : tierLocked ? (
            <Pressable
              onPress={() => { onClose(); setTimeout(() => onUpgradeTier?.(minTier!), 200); }}
              style={({ pressed }) => [s.actionBtn, { backgroundColor: '#0A0F1A', borderColor: '#22D3EE' }, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="diamond" size={16} color="#22D3EE" />
              <Text style={[s.actionText, { color: '#22D3EE' }]}>{minTier} Üyelik Gerekli</Text>
            </Pressable>
          ) : insufficientSP ? (
            <View style={[s.actionBtn, { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.5)' }]}>
              <Ionicons name="alert-circle" size={16} color="#F87171" />
              <Text style={[s.actionText, { color: '#F87171' }]}>Yetersiz Bakiye</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => onPurchase(item)}
              disabled={purchasing}
              style={({ pressed }) => [
                s.actionBtn,
                { borderColor: rarityColor + 'AA' },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                purchasing && { opacity: 0.6 },
              ]}
            >
              <LinearGradient
                colors={[rarityColor, artColor, '#0A0F1A']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={s.actionText}>
                {purchasing ? 'Satın alınıyor…' : `Satın Al — ${finalPrice.toLocaleString('tr-TR')} SP`}
              </Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

// Daily deal countdown — gece yarısına kadar kalan saat:dk
function DailyDealCountdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const today = new Date(now);
  const midnight = new Date(today);
  midnight.setHours(24, 0, 0, 0);
  const ms = Math.max(0, midnight.getTime() - now);
  const totalMin = Math.floor(ms / 60_000);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return (
    <View style={s.countdown}>
      <Ionicons name="time" size={9} color="#fff" />
      <Text style={s.countdownText}>
        {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}
      </Text>
    </View>
  );
}

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
    elevation: 1000,
  },
  panel: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: 0.8,
    borderColor: 'rgba(251,191,36,0.18)',
  },
  handle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'center', marginTop: 4, marginBottom: 8,
  },
  hero: {
    height: 220,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    width: 220, height: 220, borderRadius: 110,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 32,
    ...(Platform.OS === 'android' ? { elevation: 8 } : {}),
  },
  dealBadge: {
    position: 'absolute', top: 6, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(244,114,182,0.95)',
  },
  dealBadgeText: {
    color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5,
  },
  countdown: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 6,
    paddingHorizontal: 4, paddingVertical: 1,
    marginLeft: 4,
  },
  countdownText: {
    color: '#fff', fontSize: 9, fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14,
  },
  metaLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11, fontWeight: '600', letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rarityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, borderWidth: 0.8,
  },
  rarityChipText: {
    fontSize: 9, fontWeight: '800', letterSpacing: 0.6,
  },
  itemName: {
    color: '#fff', fontSize: 22, fontWeight: '800',
    fontFamily: serif, letterSpacing: 0.3,
    marginTop: 4,
  },
  tagline: {
    color: 'rgba(226,232,240,0.78)',
    fontSize: 13, fontStyle: 'italic',
    marginTop: 4, lineHeight: 18,
  },
  priceCard: {
    marginTop: 18,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 0.8, borderColor: 'rgba(251,191,36,0.25)',
    overflow: 'hidden',
  },
  priceLeft: { flex: 1, gap: 4 },
  priceLabel: {
    color: 'rgba(251,191,36,0.7)',
    fontSize: 10, fontWeight: '700', letterSpacing: 1,
  },
  priceRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
  },
  priceStrike: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13, textDecorationLine: 'line-through',
  },
  priceFinal: {
    color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 0.3,
  },
  discountChips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4,
    marginTop: 4,
  },
  discountChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 5, borderWidth: 0.6,
    borderColor: 'rgba(34,211,238,0.45)',
    backgroundColor: 'rgba(34,211,238,0.10)',
  },
  discountChipText: {
    color: '#22D3EE', fontSize: 9, fontWeight: '700',
  },
  priceOff: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 0.8,
  },
  priceOffText: {
    fontSize: 13, fontWeight: '900', letterSpacing: 0.5,
  },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 10,
  },
  balanceLabel: {
    color: 'rgba(148,163,184,0.85)', fontSize: 11, fontWeight: '600',
  },
  balanceValue: {
    color: '#fff', fontSize: 12, fontWeight: '800',
  },
  insufficientText: {
    color: '#F87171', fontSize: 11, fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 14,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionBtnOwned: {
    backgroundColor: 'rgba(93,202,165,0.10)',
    borderColor: 'rgba(93,202,165,0.5)',
  },
  actionText: {
    color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3,
  },
});
