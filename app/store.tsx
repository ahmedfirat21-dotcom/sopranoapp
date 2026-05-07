// ★ v108 (4 May 2026): Maison Soprano mağaza — Oda odaklı kozmetik sistemi.
//
// Kategoriler: Çerçeveler (avatar frames), Giriş Efektleri (oda giriş animasyonları),
// Hediyeler (oda içi gift), SP Paketleri.
//
// DB-bound: cosmetic_items + collections + user_inventory + store_purchase RPC.
// Showcase/gallery kart tıklama → Alert onay → SP düş + envantere ekle + toast.

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated, Platform, Dimensions, Easing, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import AppBackground from '../components/AppBackground';
import SPIcon from '../components/SPIcon';
import { showToast } from '../components/Toast';
import PremiumAlert, { type AlertButton } from '../components/PremiumAlert';
import PurchaseSuccessModal from '../components/PurchaseSuccessModal';
import { useAuth } from './_layout';
import { StoreService, type CosmeticItem, type Collection, type Rarity, type SPPack as SPPackDB, type CosmeticBundle, type DailyDeal } from '../services/store';
import { hasIllustration, isFullCardItem } from '../constants/storeIllustrationsPng';
import Item3DArt from '../components/store/Item3DArt';
import StoreItemPreviewSheet from '../components/store/StoreItemPreviewSheet';
import { hasGiftLottie, getGiftLottie } from '../constants/giftLottieRegistry';
import { hasFrameLottie, getFrameLottie, getFrameMeta } from '../constants/frameLottieRegistry';
import { hasEntryEffectLottie, getEntryEffectLottie } from '../constants/entryEffectLottieRegistry';

let LottieView: any = null;
try {
  LottieView = require('lottie-react-native').default;
} catch { /* PNG fallback */ }

function lottieFor(id: string): any | null {
  if (hasGiftLottie(id)) return getGiftLottie(id);
  if (hasFrameLottie(id)) return getFrameLottie(id);
  if (hasEntryEffectLottie(id)) return getEntryEffectLottie(id);
  return null;
}

/** ★ v110.12: SopranoAura-tarzı halka frame'ler (scale ≤ 1.25) mağaza kartında
 *  daha küçük gösterilmeli — 500px canvas'ta 450px çaplı halka 125px'te çok büyük.
 *  Kanatlı VIP frame'ler ve entry effect'ler 125px kalır. */
function storeLottieSize(id: string): number {
  const meta = getFrameMeta(id);
  if (meta && meta.scale <= 1.25) return 90;
  return 125;
}

const { width: W } = Dimensions.get('window');

// ★ v108.21: Hediyeler vitrin olarak geri eklendi — satılmaz, fiyat referansı
//   (pay-per-send oda içi). Kullanıcı hediye fiyatlarını mağazada görsün.
type CategoryKey = 'bundles' | 'frames' | 'entry_effect' | 'gifts' | 'sp';
const CATEGORIES: { key: CategoryKey; label: string; icon: string }[] = [
  { key: 'bundles',      label: 'Setler',          icon: 'cube-outline' },
  { key: 'frames',       label: 'Çerçeveler',     icon: 'ellipse-outline' },
  { key: 'entry_effect', label: 'Giriş Efektleri', icon: 'sparkles-outline' },
  { key: 'gifts',        label: 'Hediyeler',       icon: 'gift-outline' },
  { key: 'sp',           label: 'SP Paketleri',    icon: 'diamond-outline' },
];

const RARITY_LABEL: Record<Rarity, string> = {
  divine: 'İLAHİ', mythic: 'EFSANEVİ', legendary: 'EFSANE', rare: 'NADİR', new: 'YENİ',
};
const RARITY_COLOR: Record<Rarity, string> = {
  divine: '#F472B6', mythic: '#C4B5FD', legendary: '#FBBF24', rare: '#22D3EE', new: '#FB923C',
};

// ─── SP jeton ikonu (SPIcon wrapper, mağaza içinde "gem" yerine) ──
function SPGem({ size = 22 }: { size?: number }) {
  return <SPIcon size={size} />;
}

// ─── Animation components ──
function HeroFleurDeLis() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(t, { toValue: 0, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.Text
      style={{
        fontSize: 90, color: '#FBBF24',
        textShadowColor: 'rgba(251,191,36,0.7)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 24,
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) },
        ],
      }}
    >⚜️</Animated.Text>
  );
}

// ★ HTML hero-glow filter:blur(30px) — RN'de native blur yok, 3 katmanlı soft fade
//   ile pofuduk halo simülasyonu. Her katman farklı boyut + opacity → derinlik.
function HeroGlow() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 3000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(t, { toValue: 0, duration: 3000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top: -100, right: -100,
        width: 300, height: 300,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.15] }) }],
      }}
    >
      {/* Dış katman — en soft, en geniş */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: 150, backgroundColor: 'rgba(251,191,36,0.12)',
      }} />
      {/* Orta katman */}
      <View style={{
        position: 'absolute', top: 30, left: 30, right: 30, bottom: 30,
        borderRadius: 120, backgroundColor: 'rgba(251,191,36,0.22)',
      }} />
      {/* İç parlak çekirdek */}
      <View style={{
        position: 'absolute', top: 70, left: 70, right: 70, bottom: 70,
        borderRadius: 80, backgroundColor: 'rgba(255,224,130,0.4)',
      }} />
      {/* En iç sıcak nokta */}
      <View style={{
        position: 'absolute', top: 110, left: 110, right: 110, bottom: 110,
        borderRadius: 40, backgroundColor: 'rgba(255,243,200,0.55)',
      }} />
    </Animated.View>
  );
}

// ★ HTML soft glow halo — kart arkasında pofuduk ışık.
//   Çoklu katman + breath pulse ile derinlik. Renk emoji'nin (currentColor) rengini taşır.
function SoftHalo({ color, size = 180, opacity = 0.55, pulse = true }: {
  color: string; size?: number; opacity?: number; pulse?: boolean;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 2400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(t, { toValue: 0, duration: 2400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t, pulse]);
  const scale = pulse ? t.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.1] }) : 1;
  const fade = pulse ? t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) : 1;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: -size / 3, left: -size / 3, right: -size / 3, bottom: -size / 3,
      transform: [{ scale }],
      opacity: fade,
    }}>
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: size, backgroundColor: color, opacity: opacity * 0.18,
      }} />
      <View style={{
        position: 'absolute', top: '12%', left: '12%', right: '12%', bottom: '12%',
        borderRadius: size, backgroundColor: color, opacity: opacity * 0.32,
      }} />
      <View style={{
        position: 'absolute', top: '28%', left: '28%', right: '28%', bottom: '28%',
        borderRadius: size, backgroundColor: color, opacity: opacity * 0.55,
      }} />
      <View style={{
        position: 'absolute', top: '42%', left: '42%', right: '42%', bottom: '42%',
        borderRadius: size, backgroundColor: color, opacity: opacity,
      }} />
    </Animated.View>
  );
}

// ★ HTML showcase ::before conic-gradient rays — dönen ışın efekti.
function ConicRays({ size = 200, color = 'rgba(255,255,255,0.08)' }: { size?: number; color?: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, {
      toValue: 1, duration: 20000, useNativeDriver: true, easing: Easing.linear,
    }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: '50%', left: '50%',
        marginTop: -size / 2, marginLeft: -size / 2,
        width: size, height: size,
        transform: [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    >
      {[0, 45, 90, 135].map((deg) => (
        <View
          key={deg}
          style={{
            position: 'absolute',
            top: 0, left: '50%', marginLeft: -1,
            width: 2, height: size,
            backgroundColor: color,
            transform: [{ rotate: `${deg}deg` }],
            opacity: 0.6,
          }}
        />
      ))}
    </Animated.View>
  );
}

// ★ v107 hotfix: Item3DArt WebView'dan PNG asset'e geçti (components/store/Item3DArt.tsx).
//   Eski 23 WebView mağaza performansını yiyordu; native <Image> ile sorun çözüldü.

function ShowcaseArtAnimated({ emoji, color }: { emoji: string; color: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(t, { toValue: 0, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.Text
      style={{
        fontSize: 80, color,
        textShadowColor: color,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
        transform: [
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
        ],
      }}
    >{emoji}</Animated.Text>
  );
}

function BrandOrbitDot() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, {
      toValue: 1, duration: 12000, useNativeDriver: true, easing: Easing.linear,
    }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        transform: [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    >
      <View style={{
        position: 'absolute', top: -2, left: '50%', marginLeft: -2,
        width: 4, height: 4, borderRadius: 2, backgroundColor: '#FBBF24',
        ...Platform.select({
          ios: { shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4 },
          android: {},
        }),
      }} />
    </Animated.View>
  );
}

function ShimmerOverlay({ duration = 5000 }: { duration?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t, duration]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, bottom: 0, width: 100,
        transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-100, W + 50] }) }],
      }}
    >
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.12)', 'transparent']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  );
}

// ─── SP paketleri ───────────────────────────────────────────────
// ★ v108.21: Hardcoded yerine sp_packages tablosundan çekilir.
//   Local UI tipi (DB tipinden minimal map). Fallback olarak DEFAULT_SP_PACKS,
//   DB henüz yüklenmediği veya boş döndüğü durumlar için.
interface SPPack {
  id: string; tierName: string; tierKey: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  amount: number; bonusAmount?: number; bonusPct?: number;
  fiat: string; popular?: boolean; tierColor: string;
}
const DEFAULT_SP_PACKS: SPPack[] = [
  { id: 'sp-bronze', tierName: 'Bronz · Atölye', tierKey: 'bronze',
    amount: 100, fiat: '9,99 ₺', tierColor: '#D4A574' },
  { id: 'sp-silver', tierName: 'Gümüş · Salon', tierKey: 'silver',
    amount: 500, bonusPct: 10, fiat: '39,99 ₺', tierColor: '#D1D5DB' },
  { id: 'sp-gold', tierName: 'Altın · Vitrin', tierKey: 'gold',
    amount: 1500, bonusAmount: 1800, bonusPct: 20, fiat: '99,99 ₺', popular: true, tierColor: '#FBBF24' },
  { id: 'sp-platinum', tierName: 'Platin · Loca', tierKey: 'platinum',
    amount: 5000, bonusAmount: 6750, bonusPct: 35, fiat: '299,99 ₺', tierColor: '#C4B5FD' },
  { id: 'sp-diamond', tierName: 'Elmas · Maison', tierKey: 'diamond',
    amount: 15000, bonusAmount: 22500, bonusPct: 50, fiat: '799,99 ₺', tierColor: '#F9A8D4' },
];

function spPackFromDB(p: SPPackDB): SPPack {
  const total = p.sp_amount + (p.bonus_sp || 0);
  return {
    id: p.id,
    tierName: p.tier_name,
    tierKey: p.tier_key,
    amount: p.sp_amount,
    bonusAmount: p.bonus_sp > 0 ? total : undefined,
    // ★ v108.21 hotfix: 0 → undefined; aksi halde JSX'te `{0 && ...}` naked "0" render eder
    bonusPct: (p.bonus_pct && p.bonus_pct > 0) ? p.bonus_pct : undefined,
    fiat: p.fiat_label,
    popular: p.popular,
    tierColor: p.tier_color,
  };
}

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, firebaseUser } = useAuth();
  const sp = (profile as any)?.system_points || 0;
  // ★ v108.21: Tier indirimi — Plus %10, Pro/GodMaster %20
  const tier = (profile as any)?.subscription_tier;
  const expires = (profile as any)?.subscription_expires_at;
  const tierActive = !expires || new Date(expires) > new Date();
  const tierDiscountPct = tierActive
    ? (tier === 'Pro' || tier === 'GodMaster' ? 20 : tier === 'Plus' ? 10 : 0)
    : 0;
  const [activeCat, setActiveCat] = useState<CategoryKey>('frames');
  const [items, setItems] = useState<CosmeticItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [inventory, setInventory] = useState<Set<string>>(new Set());
  const [purchasing, setPurchasing] = useState<string | null>(null);
  // ★ v108.21: Search + Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'default' | 'price-asc' | 'price-desc' | 'rarity'>('default');
  // ★ v108.21: SP paketleri DB'den; fallback hardcoded
  const [spPacks, setSpPacks] = useState<SPPack[]>(DEFAULT_SP_PACKS);
  // ★ v108.21: Bundle paketleri (set fırsatları)
  const [bundles, setBundles] = useState<CosmeticBundle[]>([]);
  // ★ v108.21: Wishlist + daily deal
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [dailyDeal, setDailyDeal] = useState<DailyDeal | null>(null);
  // ★ v108.21: Yükleniyor durumu — boş kartlar yerine skeleton göstermek için
  const [catalogLoading, setCatalogLoading] = useState(true);
  // ★ v107 hotfix: Native Alert.alert → PremiumAlert (uygulama tasarımına uygun)
  const [confirmAlert, setConfirmAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: AlertButton[];
  }>({ visible: false, title: '', message: '', buttons: [] });
  // ★ v109.1: Satın alma başarı modalı — toast yerine premium kutlama (Applied.json Lottie)
  const [successModal, setSuccessModal] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    accent?: readonly [string, string];
  }>({ visible: false, title: '' });
  // ★ v109.5: Ürün önizleme sheet'i — kart/banner tıklaması direkt PremiumAlert'e gitmez,
  //   önce ürünü gösterir (Item3DArt + bilgi + fiyat). Sheet'teki "Satın Al" butonu
  //   PremiumAlert onay akışını tetikler.
  const [previewItem, setPreviewItem] = useState<CosmeticItem | null>(null);
  // ★ v107 hotfix: pill tıklama scroll-to-section anchor — ScrollView ref + her section'ın y offset'i
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<CategoryKey, number>>({
    bundles: 0, frames: 0, entry_effect: 0, gifts: 0, sp: 0,
  });
  const scrollToSection = (key: CategoryKey) => {
    setActiveCat(key);
    const y = sectionOffsets.current[key];
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ items: fetchedItems, collections: fetchedCols }, packs, fetchedBundles, deal] = await Promise.all([
        StoreService.getCatalog(),
        StoreService.getSPPacks(),
        StoreService.getBundles(),
        StoreService.getDailyDeal(),
      ]);
      if (cancelled) return;
      setItems(fetchedItems);
      setCollections(fetchedCols);
      if (packs.length > 0) setSpPacks(packs.map(spPackFromDB));
      setBundles(fetchedBundles);
      setDailyDeal(deal);
      setCatalogLoading(false);
    })();
    if (firebaseUser?.uid) {
      Promise.all([
        StoreService.getUserInventory(firebaseUser.uid),
        StoreService.getWishlist(firebaseUser.uid),
      ]).then(([inv, wish]) => {
        if (cancelled) return;
        setInventory(inv);
        setWishlist(wish);
      });
    }
    return () => { cancelled = true; };
  }, [firebaseUser?.uid]);

  // ★ v108.21: Search + sort uygulanan filter helper
  const RARITY_RANK: Record<string, number> = { divine: 0, mythic: 1, legendary: 2, rare: 3, new: 4 };
  const applyFilters = (list: CosmeticItem[]): CosmeticItem[] => {
    let filtered = list;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((i) =>
        i.name?.toLowerCase().includes(q) ||
        i.meta?.toLowerCase().includes(q) ||
        i.tagline?.toLowerCase().includes(q)
      );
    }
    if (sortMode === 'price-asc') filtered = [...filtered].sort((a, b) => a.price_sp - b.price_sp);
    else if (sortMode === 'price-desc') filtered = [...filtered].sort((a, b) => b.price_sp - a.price_sp);
    else if (sortMode === 'rarity') filtered = [...filtered].sort((a, b) =>
      (RARITY_RANK[a.rarity || 'new'] ?? 5) - (RARITY_RANK[b.rarity || 'new'] ?? 5)
    );
    return filtered;
  };
  const frameItems = applyFilters(items.filter((i) => i.category === 'atelier' || i.category === 'frames'));
  const entryItems = applyFilters(items.filter((i) => i.category === 'message_art' || i.category === 'entry_effect'));
  const giftItems = applyFilters(items.filter((i) => i.category === 'gift'));

  // ★ v108.21: Wishlist toggle (optimistic update + DB sync)
  const handleWishlistToggle = async (item: CosmeticItem) => {
    if (!firebaseUser?.uid) return;
    if (inventory.has(item.id)) return; // owned → wishlist gerekmez
    const isOnList = wishlist.has(item.id);
    setWishlist((prev) => {
      const next = new Set(prev);
      if (isOnList) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    const ok = isOnList
      ? await StoreService.removeFromWishlist(firebaseUser.uid, item.id)
      : await StoreService.addToWishlist(firebaseUser.uid, item.id);
    if (!ok) {
      // Rollback
      setWishlist((prev) => {
        const next = new Set(prev);
        if (isOnList) next.add(item.id);
        else next.delete(item.id);
        return next;
      });
      showToast({ title: 'Hata', message: 'İstek listesi güncellenemedi', type: 'error' });
    } else if (!isOnList) {
      showToast({ title: '♡ Listene eklendi', message: `${item.name} istek listende.`, type: 'success' });
    }
  };

  // ★ v109.1: Kategori → kullanıcı dostu etiket eşlemesi (success modal alt metni için)
  const categoryLabel = (cat: string): string => {
    if (cat === 'atelier' || cat === 'frames') return 'Çerçeve';
    if (cat === 'message_art' || cat === 'entry_effect') return 'Giriş Efekti';
    if (cat === 'gift') return 'Hediye';
    return 'Ürün';
  };
  const accentForRarity = (rarity?: string | null): readonly [string, string] => {
    switch (rarity) {
      case 'divine': return ['#FBBF24', '#854F0B'] as const;
      case 'mythic': return ['#F472B6', '#831843'] as const;
      case 'legendary': return ['#FFE082', '#B45309'] as const;
      case 'rare': return ['#A78BFA', '#5B21B6'] as const;
      default: return ['#14B8A6', '#0E7490'] as const;
    }
  };

  const handleBundlePurchase = (bundle: CosmeticBundle) => {
    if (!firebaseUser?.uid) return;
    const allOwned = bundle.item_ids.every((id) => inventory.has(id));
    if (allOwned) {
      showToast({ title: 'Tüm parçalar sende', message: `${bundle.name} parçalarına zaten sahipsin.`, type: 'info' });
      return;
    }
    const totalDiscount = Math.min(bundle.discount_pct + tierDiscountPct, 80);
    const finalPrice = Math.round(bundle.total_price_sp * (100 - totalDiscount) / 100);
    setConfirmAlert({
      visible: true,
      title: 'Set Satın Al',
      message: `${bundle.name} setinin ${bundle.item_ids.length} parçası ${finalPrice.toLocaleString('tr-TR')} SP karşılığında envanterine eklenecek (-%${totalDiscount}${tierDiscountPct > 0 ? ` · ${tier}` : ''}). Onaylıyor musun?`,
      buttons: [
        { text: 'Vazgeç', style: 'cancel', onPress: () => setConfirmAlert(p => ({ ...p, visible: false })) },
        {
          text: 'Satın Al', style: 'default', icon: 'cube',
          onPress: async () => {
            setConfirmAlert(p => ({ ...p, visible: false }));
            setPurchasing(bundle.id);
            const r = await StoreService.purchaseBundle(firebaseUser.uid, bundle.id);
            setPurchasing(null);
            if (r.success) {
              setSuccessModal({
                visible: true,
                title: `${bundle.name} Satın Alındı`,
                subtitle: `${r.items_added || bundle.item_ids.length} parça envanterine eklendi · ${r.cost} SP harcandı`,
                accent: accentForRarity(bundle.rarity),
              });
              setInventory((prev) => {
                const next = new Set(prev);
                bundle.item_ids.forEach((id) => next.add(id));
                return next;
              });
            } else {
              showToast({
                title: 'Hata',
                message: r.error || 'Bağlantı sorunu',
                type: r.already_owned ? 'info' : 'error',
              });
            }
          },
        },
      ],
    });
  };

  // ★ v109.5: Daily Deal banner için ürün önizleme — direkt satın alma onay modalı yerine
  //   önce ürün görseli + fiyat detayı + indirim breakdown'ı sheet olarak gösterilir.
  //   Sheet'in "Satın Al" butonu executePurchase'i direkt çağırır (preview ZATEN onaydır,
  //   ikinci PremiumAlert'e gerek yok — friction azaltma).
  const openItemPreview = (item: CosmeticItem) => {
    if (!firebaseUser?.uid) return;
    setPreviewItem(item);
  };

  // ★ v109.5: Ortak satın alma akışı — hem PremiumAlert (handlePurchase) hem
  //   preview sheet onPurchase tarafından çağrılır. StoreService.purchase + success
  //   modal + inventory güncelleme + tier-lock + error handling tek yerde.
  const executePurchase = async (item: CosmeticItem) => {
    if (!firebaseUser?.uid) return;
    setPurchasing(item.id);
    const r = await StoreService.purchase(firebaseUser.uid, item.id);
    setPurchasing(null);
    if (r.success) {
      const label = categoryLabel(item.category);
      setSuccessModal({
        visible: true,
        title: `${label} Satın Alındı`,
        subtitle: `${item.name} envanterine eklendi · ${r.cost} SP harcandı`,
        accent: accentForRarity(item.rarity),
      });
      setInventory((prev) => new Set(prev).add(item.id));
    } else if ((r as any).tier_locked) {
      const reqTier = (r as any).required_tier || 'Plus';
      setConfirmAlert({
        visible: true,
        title: `${reqTier} Üyelik Gerekiyor`,
        message: `${item.name} sadece ${reqTier} üyelere açık. ${reqTier} üyelik avantajları arasında %10-20 mağaza indirimi, premium oda araçları ve daha fazlası var.`,
        buttons: [
          { text: 'Şimdi Değil', style: 'cancel', onPress: () => setConfirmAlert(p => ({ ...p, visible: false })) },
          {
            text: `${reqTier}'a Yükselt`, style: 'default', icon: 'star',
            onPress: () => {
              setConfirmAlert(p => ({ ...p, visible: false }));
              router.push('/plus' as any);
            },
          },
        ],
      });
    } else {
      showToast({
        title: 'Hata',
        message: r.error || 'Bağlantı sorunu',
        type: r.alreadyOwned ? 'info' : 'error',
      });
    }
  };

  const handlePurchase = (item: CosmeticItem) => {
    if (!firebaseUser?.uid) return;
    if (inventory.has(item.id)) {
      showToast({ title: 'Zaten sahipsin', message: `${item.name} envanterinde.`, type: 'info' });
      return;
    }
    // ★ v107 hotfix: PremiumAlert (native Alert yerine) — uygulama tasarımıyla tutarlı
    setConfirmAlert({
      visible: true,
      title: 'Satın Al',
      message: (() => {
        const dealOff = (dailyDeal && dailyDeal.item_id === item.id) ? dailyDeal.extra_discount_pct : 0;
        const totalOff = Math.min(tierDiscountPct + dealOff, 80);
        if (totalOff === 0) {
          return `${item.name} için ${item.price_sp.toLocaleString('tr-TR')} SP harcanacak. Onaylıyor musun?`;
        }
        const final = Math.round(item.price_sp * (100 - totalOff) / 100);
        const parts: string[] = [];
        if (tierDiscountPct > 0) parts.push(`${tier} indirimi -%${tierDiscountPct}`);
        if (dealOff > 0) parts.push(`Günün Fırsatı -%${dealOff}`);
        return `${item.name} için ${final.toLocaleString('tr-TR')} SP harcanacak (${parts.join(' + ')}). Onaylıyor musun?`;
      })(),
      buttons: [
        { text: 'Vazgeç', style: 'cancel', onPress: () => setConfirmAlert(p => ({ ...p, visible: false })) },
        {
          text: 'Satın Al', style: 'default', icon: 'sparkles',
          onPress: () => {
            setConfirmAlert(p => ({ ...p, visible: false }));
            executePurchase(item);
          },
        },
      ],
    });
  };

  return (
    <AppBackground>
      <View style={{ flex: 1 }}>
        {/* Ambient parıltı */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: 0.7 }]}>
          <LinearGradient
            colors={['rgba(251,191,36,0.12)', 'transparent']}
            start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['transparent', 'rgba(167,139,250,0.10)']}
            start={{ x: 0.3, y: 0.5 }} end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>

        {/* HEADER */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.1)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.headerTop}>
            <Pressable onPress={() => safeGoBack(router)} hitSlop={8} style={s.backBtn}>
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
            <View style={s.brand}>
              <View style={s.brandMark}>
                <View style={s.brandOrbit} />
                <BrandOrbitDot />
                <View style={{ position: 'absolute', top: 6, left: 6, right: 6, bottom: 6, alignItems: 'center', justifyContent: 'center' }}>
                  <SPGem size={20} />
                </View>
              </View>
              <View>
                <Text style={s.brandName}>Maison Soprano</Text>
                <Text style={s.brandSub}>L U X U R Y · M A R K E T</Text>
              </View>
            </View>
            <View style={s.balanceCard}>
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFillObject} />
              <LinearGradient
                colors={['rgba(255,224,130,0.12)', 'rgba(0,0,0,0.4)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <ShimmerOverlay duration={4000} />
              <SPGem size={22} />
              <Text style={s.balanceNum}>{sp.toLocaleString('tr-TR')}</Text>
            </View>
          </View>

          {/* ★ v108.21: GÜNÜN FIRSATI — bugünün daily deal'ı varsa banner */}
          {/* ★ v109.5: onPress artık önce StoreItemPreviewSheet'i açar — ürünü gör + fiyat + indirim breakdown */}
          <DailyDealBanner
            dailyDeal={dailyDeal}
            items={items}
            inventory={inventory}
            tierDiscountPct={tierDiscountPct}
            onPress={openItemPreview}
          />

          {/* ★ v108.21: Tier indirim rozet — Plus/Pro üyelere kozmetiklerde indirim */}
          {tierDiscountPct > 0 && (
            <View style={s.tierDiscountBanner}>
              <LinearGradient
                colors={['rgba(34,211,238,0.18)', 'rgba(34,211,238,0.04)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="diamond" size={14} color="#22D3EE" />
              <Text style={s.tierDiscountText}>
                {tier} üyeliğinle çerçeve & efektlerde <Text style={{ color: '#22D3EE', fontWeight: '800' }}>%{tierDiscountPct}</Text> indirim aktif.
              </Text>
            </View>
          )}

          {/* ★ v108.21: Functional search + sort */}
          <View style={s.searchRow}>
            <View style={s.search}>
              <Ionicons name="search" size={13} color="rgba(251,191,36,0.6)" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Koleksiyonda ara…"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={s.searchInput}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.5)" />
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={() => {
                const next = sortMode === 'default' ? 'price-asc'
                  : sortMode === 'price-asc' ? 'price-desc'
                  : sortMode === 'price-desc' ? 'rarity'
                  : 'default';
                setSortMode(next);
              }}
              style={s.sortBtn}
              hitSlop={6}
            >
              <Ionicons
                name={sortMode === 'price-asc' ? 'arrow-up' : sortMode === 'price-desc' ? 'arrow-down' : sortMode === 'rarity' ? 'star' : 'swap-vertical'}
                size={13}
                color="#FBBF24"
              />
              <Text style={s.sortBtnText}>
                {sortMode === 'price-asc' ? 'Ucuz' : sortMode === 'price-desc' ? 'Pahalı' : sortMode === 'rarity' ? 'Nadir' : 'Sırala'}
              </Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CATEGORIES.map((cat) => {
              const active = cat.key === activeCat;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => scrollToSection(cat.key)}
                  style={[s.catPill, active && s.catPillActive]}
                >
                  <Ionicons name={cat.icon as any} size={12} color={active ? '#FBBF24' : 'rgba(255,255,255,0.45)'} style={{ marginRight: 4 }} />
                  <Text style={[s.catPillText, active && s.catPillTextActive]}>{cat.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* BODY */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero — ★ v107 hotfix: HeroGlow (4 katmanlı altın daire) kaldırıldı ve
              renkli mor/pembe gradient sakin slate + altın hint'e indirgendi.
              Fleur-de-lis kendi başına focal point. */}
          <View style={s.hero}>
            <LinearGradient
              colors={['rgba(30,40,65,0.65)', 'rgba(15,22,38,0.85)', 'rgba(8,12,22,0.95)']}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Fleur tarafına çok hafif altın halo (tek katman, daire değil — soft oval glow) */}
            <LinearGradient
              colors={['transparent', 'rgba(251,191,36,0.10)', 'transparent']}
              start={{ x: 0.4, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View pointerEvents="none" style={s.heroArt}><HeroFleurDeLis /></View>
            <View style={s.heroTag}>
              <View style={s.heroTagDot} />
              <Text style={s.heroTagText}>CANLI · YENİ KOLEKSİYON</Text>
            </View>
            <Text style={s.heroTitle}>Soprano Couture{'\n'}Sonbahar 2026</Text>
            <Text style={s.heroDesc}>Yedi tasarımcı. On iki sınırlı parça.{'\n'}Sadece bu sezona özel.</Text>
            <Pressable
              style={s.heroCta}
              onPress={() => scrollToSection(bundles.length > 0 ? 'bundles' : 'frames')}
            >
              <LinearGradient
                colors={['#FFE082', '#FAC775']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={s.heroCtaText}>KEŞFET</Text>
              <Ionicons name="arrow-forward" size={14} color="#3D1F00" />
            </Pressable>
          </View>

          {/* ═══ SETLER — Tema Bundle Paketleri (FOMO + indirim) ═══ */}
          {(catalogLoading || bundles.length > 0) ? (
            <>
              <View onLayout={(e) => { sectionOffsets.current.bundles = e.nativeEvent.layout.y; }} />
              <SectionDivider label="— SETLER · TEMA PAKETLERİ —" />
              <Text style={s.sectionTitle}>Set Fırsatları</Text>
              <Text style={s.sectionSub}>Birlikte daha ucuz · Tema set + büyük indirim</Text>
              {catalogLoading && bundles.length === 0 ? (
                <SkeletonShowcaseRow />
              ) : (
                <ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingHorizontal: 4, paddingVertical: 8 }}
                  style={{ marginHorizontal: -4 }}
                >
                  {bundles.map((b) => (
                    <BundleCard
                      key={b.id}
                      bundle={b}
                      items={items}
                      owned={b.item_ids.every((id) => inventory.has(id))}
                      purchasing={purchasing === b.id}
                      tierDiscountPct={tierDiscountPct}
                      onPress={() => handleBundlePurchase(b)}
                    />
                  ))}
                </ScrollView>
              )}
            </>
          ) : null}

          {/* ═══ ÇERÇEVELER — Avatar Frame Koleksiyonu ═══ */}
          <View onLayout={(e) => { sectionOffsets.current.frames = e.nativeEvent.layout.y; }} />
          <SectionDivider label="— ÇERÇEVELER · AVATAR —" />
          <Text style={s.sectionTitle}>Avatar Çerçeveleri</Text>
          <Text style={s.sectionSub}>Profilini özelleştir · Tarzını yansıt</Text>
          {catalogLoading && frameItems.length === 0 ? (
            <SkeletonShowcaseRow />
          ) : (
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingHorizontal: 4, paddingVertical: 8 }}
              style={{ marginHorizontal: -4 }}
            >
              {frameItems.map((item) => {
                const dealOff = (dailyDeal && dailyDeal.item_id === item.id) ? dailyDeal.extra_discount_pct : 0;
                const totalOff = inventory.has(item.id) ? 0 : Math.min(tierDiscountPct + dealOff, 80);
                return (
                  <ShowcaseCard
                    key={item.id}
                    item={item}
                    owned={inventory.has(item.id)}
                    purchasing={purchasing === item.id}
                    discountPct={totalOff}
                    wished={wishlist.has(item.id)}
                    onWishToggle={() => handleWishlistToggle(item)}
                    onPress={() => handlePurchase(item)}
                  />
                );
              })}
            </ScrollView>
          )}

          {/* ═══ GİRİŞ EFEKTLERİ — Odaya Giriş Animasyonları ═══ */}
          <View onLayout={(e) => { sectionOffsets.current.entry_effect = e.nativeEvent.layout.y; }} />
          <SectionDivider label="— GİRİŞ EFEKTLERİ · ODA —" />
          <Text style={s.sectionTitle}>Giriş Efektleri</Text>
          <Text style={s.sectionSub}>Odaya girdiğinde herkes görsün · Şıklığını göster</Text>
          {catalogLoading && entryItems.length === 0 ? (
            <SkeletonGalleryGrid />
          ) : (
            <View style={s.galleryGrid}>
              {entryItems.map((item) => {
                const dealOff = (dailyDeal && dailyDeal.item_id === item.id) ? dailyDeal.extra_discount_pct : 0;
                const totalOff = inventory.has(item.id) ? 0 : Math.min(tierDiscountPct + dealOff, 80);
                return (
                  <GalleryCard
                    key={item.id}
                    item={item}
                    owned={inventory.has(item.id)}
                    discountPct={totalOff}
                    wished={wishlist.has(item.id)}
                    onWishToggle={() => handleWishlistToggle(item)}
                    onPress={() => handlePurchase(item)}
                  />
                );
              })}
            </View>
          )}

          {/* ═══ HEDİYELER — Vitrin (pay-per-send, oda içi gönderim) ═══ */}
          <View onLayout={(e) => { sectionOffsets.current.gifts = e.nativeEvent.layout.y; }} />
          <SectionDivider label="— HEDİYELER · ODA İÇİ —" />
          <Text style={s.sectionTitle}>Sembol Hediyeler</Text>
          <Text style={s.sectionSub}>Vitrin · Odada 🎁 panelden gönder, satın almaya gerek yok</Text>
          {catalogLoading && giftItems.length === 0 ? (
            <SkeletonGalleryGrid />
          ) : (
            <View style={s.galleryGrid}>
              {giftItems.map((item) => (
                <GalleryCard
                  key={item.id}
                  item={item}
                  owned={false}
                  onPress={() => router.push('/(tabs)/myrooms' as any)}
                />
              ))}
            </View>
          )}

          {/* Soprano Tezgâhı */}
          <View
            onLayout={(e) => { sectionOffsets.current.sp = e.nativeEvent.layout.y; }}
            style={s.tierSection}
          >
            <View pointerEvents="none" style={s.tierTopLine} />
            <View style={s.tierHeaderBlock}>
              <Text style={s.tierHeaderSymbol}>⚜</Text>
              <Text style={s.tierHeaderTitle}>Soprano Tezgâhı</Text>
              <Text style={s.tierHeaderSub}>S P · K O L E K S İ Y O N L A R I</Text>
            </View>

            {/* ★ v109.3: Premium Bonus banner — eski sp-store'dan taşındı.
                 Plus %10, Pro %20 ekstra SP bilgilendirmesi. */}
            <Pressable style={s.spBonusBanner} onPress={() => router.push('/plus' as any)}>
              <LinearGradient
                colors={['rgba(20,184,166,0.14)', 'rgba(20,184,166,0.04)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={s.spBonusIconWrap}>
                <Ionicons name="star" size={15} color="#14B8A6" style={{
                  textShadowColor: '#14B8A6bb', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
                }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.spBonusTitle}>Premium Bonus</Text>
                <Text style={s.spBonusDesc}>
                  {tierDiscountPct >= 20 ? `${tier} üyeliğinle %20 ekstra SP kazanıyorsun! 🎉`
                    : tierDiscountPct >= 10 ? `${tier} üyeliğinle %10 ekstra SP kazanıyorsun! 🎉`
                    : 'Plus ile %10, Pro ile %20 ekstra SP kazan'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.4)" />
            </Pressable>

            {spPacks.map((pack) => (
              <SPPackRow
                key={pack.id}
                pack={pack}
                onPress={() => {
                  // ★ v109.3: Eski sp-store'a yönlendirme yerine doğrudan burada bilgilendirme.
                  //   Google Play IAP henüz aktif değil; alpha sürüm boyunca kapalı.
                  showToast({
                    title: '🚧 Yakında',
                    message: 'SP satın alma alfa sürüm süresince kapalı. Yakında Google Play üzerinden aktif olacak!',
                    type: 'info',
                  });
                }}
              />
            ))}
          </View>

          {/* Koleksiyonlar */}
          <SectionDivider label="— KOLEKSİYONLAR · TÜM SEZON —" />
          {catalogLoading && collections.length === 0 ? (
            <SkeletonCollectionRow />
          ) : (
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingHorizontal: 4, paddingVertical: 8 }}
              style={{ marginHorizontal: -16 }}
            >
              {collections.map((col) => (
                <CollectionCard
                  key={col.id}
                  col={col}
                  itemCount={items.filter((i) => i.collection_id === col.id).length}
                  onPress={() => router.push(`/store/collection/${col.id}` as any)}
                />
              ))}
            </ScrollView>
          )}
        </ScrollView>

        {/* Bottom bar — glassmorphism (BlurView + soft gradient).
            ★ v108.21: ŞIK YÜKLEME ayrı sp-store sayfası yerine sayfa içi
            "Soprano Tezgâhı" bölümüne kaydırır (SP paketleri zaten orada). */}
        <View style={[s.bottomBar, { bottom: 12 + insets.bottom }]}>
          <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFillObject} />
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'rgba(15,23,41,0.85)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View>
            <Text style={s.bottomLabel}>SP PAKETLERİ</Text>
            <Text style={s.bottomAction}>Daha fazla SP edin</Text>
          </View>
          <Pressable style={s.bottomCta} onPress={() => scrollToSection('sp')}>
            <LinearGradient
              colors={['#FFE082', '#FAC775', '#EF9F27']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={s.bottomCtaText}>⚜ ŞIK YÜKLEME</Text>
          </Pressable>
        </View>
      </View>
      {/* ★ v107 hotfix: Native Alert yerine premium tasarım onay diyaloğu */}
      <PremiumAlert
        visible={confirmAlert.visible}
        title={confirmAlert.title}
        message={confirmAlert.message}
        type="warning"
        icon="bag-handle"
        buttons={confirmAlert.buttons}
        onDismiss={() => setConfirmAlert(p => ({ ...p, visible: false }))}
      />
      {/* ★ v109.1: Satın alma başarı modalı (Applied.json Lottie) */}
      <PurchaseSuccessModal
        visible={successModal.visible}
        title={successModal.title}
        subtitle={successModal.subtitle}
        accent={successModal.accent}
        onClose={() => setSuccessModal(p => ({ ...p, visible: false }))}
      />
      {/* ★ v109.5: Ürün önizleme bottom sheet — Daily Deal banner tıklamasında ve
           gelecekteki kart tıklamalarında kullanılır. Sheet'in "Satın Al" butonu
           handlePurchase'i tetikler (mevcut PremiumAlert onay akışı). */}
      <StoreItemPreviewSheet
        visible={!!previewItem}
        item={previewItem}
        dailyDeal={dailyDeal}
        tierDiscountPct={tierDiscountPct}
        currentTier={(tier || 'Free') as any}
        spBalance={sp}
        owned={previewItem ? inventory.has(previewItem.id) : false}
        purchasing={!!purchasing}
        onClose={() => setPreviewItem(null)}
        // ★ v109.5: Sheet'in "Satın Al"ı PremiumAlert atlayıp direkt purchase yapar.
        //   Sheet ZATEN onaydır — fiyat, indirim, bakiye hep görünür. İkinci modal friction.
        onPurchase={(it) => { setPreviewItem(null); executePurchase(it); }}
        onUpgradeTier={() => router.push('/plus' as any)}
      />
    </AppBackground>
  );
}

// ★ v108.21: Skeleton placeholder — veriler yüklenirken boş ekran yerine
//   pulse animasyonlu kutucuk göster. Showcase (yatay) + Gallery (grid) varyantları.
function SkeletonPulse({ children, style }: { children?: React.ReactNode; style?: any }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.8, duration: 800, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

function SkeletonCardInner() {
  return (
    <>
      {/* art alanı placeholder dairesi */}
      <View style={s.skelArt} />
      {/* iki kısa çizgi (isim + fiyat) */}
      <View style={s.skelLineLong} />
      <View style={s.skelLineShort} />
    </>
  );
}

function SkeletonShowcaseRow() {
  return (
    <ScrollView
      horizontal scrollEnabled={false}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 4, paddingVertical: 8 }}
      style={{ marginHorizontal: -4 }}
    >
      {[0, 1, 2].map((i) => (
        <SkeletonPulse key={i} style={[s.showcaseCard, s.skelCard]}>
          <SkeletonCardInner />
        </SkeletonPulse>
      ))}
    </ScrollView>
  );
}

function SkeletonGalleryGrid() {
  return (
    <View style={s.galleryGrid}>
      {[0, 1, 2, 3].map((i) => (
        <SkeletonPulse key={i} style={[s.galleryCard, s.skelCard]}>
          <SkeletonCardInner />
        </SkeletonPulse>
      ))}
    </View>
  );
}

function SkeletonCollectionRow() {
  return (
    <ScrollView
      horizontal scrollEnabled={false}
      contentContainerStyle={{ gap: 10, paddingHorizontal: 4, paddingVertical: 8 }}
      style={{ marginHorizontal: -16 }}
    >
      {[0, 1, 2].map((i) => (
        <SkeletonPulse key={i} style={[s.collectionCard, s.skelCard]}>
          <SkeletonCardInner />
        </SkeletonPulse>
      ))}
    </ScrollView>
  );
}

// ★ v108.21: GÜNÜN FIRSATI banner — daily deal var + dealItem yüklü + henüz satın alınmamış
function DailyDealBanner({
  dailyDeal, items, inventory, tierDiscountPct, onPress,
}: {
  dailyDeal: DailyDeal | null;
  items: CosmeticItem[];
  inventory: Set<string>;
  tierDiscountPct: number;
  onPress: (item: CosmeticItem) => void;
}) {
  if (!dailyDeal) return null;
  const dealItem = items.find((i) => i.id === dailyDeal.item_id);
  if (!dealItem) return null;
  // ★ v109.2: Sahip olsa bile banner kalır — flicker önlenir, kullanıcı kaçırmadığını bilir.
  //   Tıklanırsa "Zaten sahipsin" toast'ı çıkar (handlePurchase guard'ı zaten var).
  const isOwned = inventory.has(dealItem.id);

  const totalOff = Math.min(tierDiscountPct + dailyDeal.extra_discount_pct, 80);
  const finalPrice = Math.round(dealItem.price_sp * (100 - totalOff) / 100);

  return (
    <Pressable onPress={() => onPress(dealItem)} style={s.dailyDealBanner}>
      <LinearGradient
        colors={isOwned
          ? ['#475569', '#1E293B', '#0A0F1A'] as [string, string, string]
          : ['#F472B6', '#831843', '#0A0F1A'] as [string, string, string]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <ShimmerOverlay duration={4500} />
      <View style={s.dailyDealLeft}>
        <Text style={s.dailyDealKicker}>
          {isOwned ? '✓ SAHİPSİN' : '⚡ GÜNÜN FIRSATI'}
        </Text>
        <Text style={s.dailyDealItemName}>{dealItem.name}</Text>
        {dailyDeal.banner_text ? (
          <Text style={s.dailyDealSubtitle} numberOfLines={2}>
            {isOwned ? 'Bu ürün zaten envanterinde · iyi tercih!' : dailyDeal.banner_text}
          </Text>
        ) : null}
        {!isOwned ? (
          <View style={s.dailyDealPriceRow}>
            <Text style={s.dailyDealStrike}>{dealItem.price_sp.toLocaleString('tr-TR')}</Text>
            <Text style={s.dailyDealFinal}>{finalPrice.toLocaleString('tr-TR')}</Text>
            <Text style={s.dailyDealUnit}>SP</Text>
            <View style={s.dailyDealOff}>
              <Text style={s.dailyDealOffText}>-%{totalOff}</Text>
            </View>
          </View>
        ) : null}
      </View>
      <View style={s.dailyDealRight}>
        {isOwned ? (
          <View style={[s.dailyDealArrow, { backgroundColor: 'rgba(93,202,165,0.18)', borderColor: 'rgba(93,202,165,0.4)' }]}>
            <Ionicons name="checkmark" size={16} color="#5DCAA5" />
          </View>
        ) : (
          <>
            <DailyDealCountdown />
            <View style={s.dailyDealArrow}>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
}

// ★ v108.21: Daily deal countdown — gece yarısına kadar kalan saat:dk
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
    <View style={s.dailyDealCountdown}>
      <Ionicons name="time" size={11} color="#fff" />
      <Text style={s.dailyDealCountdownText}>
        {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}
      </Text>
    </View>
  );
}

// ★ v108.21: Limited edition rozetleri — countdown + stok + yeni
function getLimitedInfo(item: CosmeticItem): {
  isLimited: boolean;
  isExpired: boolean;
  isSoldOut: boolean;
  isNew: boolean;
  daysLeft: number | null;
  remainingStock: number | null;
} {
  const now = Date.now();
  const expiresAt = item.available_until ? new Date(item.available_until).getTime() : null;
  const launchedAt = item.launched_at ? new Date(item.launched_at).getTime() : null;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))) : null;
  const remainingStock = item.max_supply != null ? Math.max(0, item.max_supply - (item.sold_count || 0)) : null;
  const isExpired = !!(expiresAt && expiresAt < now);
  const isSoldOut = !!(remainingStock !== null && remainingStock === 0);
  const isLimited = expiresAt !== null || item.max_supply !== null;
  const isNew = !!(launchedAt && (now - launchedAt) < 7 * 24 * 60 * 60 * 1000);
  return { isLimited, isExpired, isSoldOut, isNew, daysLeft, remainingStock };
}

// ★ v109.2: Plus/Pro üyelik gerektiren ürünler için kilit rozeti
function TierLockBadge({ tier, offsetTop = 8, alignRight }: {
  tier: 'Plus' | 'Pro' | 'GodMaster' | 'Free';
  offsetTop?: number;
  alignRight?: boolean;
}) {
  const tierColors: Record<string, [string, string]> = {
    Plus: ['#14B8A6', '#0E7490'],
    Pro: ['#FBBF24', '#854F0B'],
    GodMaster: ['#F472B6', '#831843'],
    Free: ['#94A3B8', '#475569'],
  };
  const colors = tierColors[tier] || tierColors.Plus;
  return (
    <View style={[s.tierLockBadge, {
      top: offsetTop,
      ...(alignRight ? { right: 8 } : { left: 8 }),
    }]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Ionicons name="lock-closed" size={9} color="#fff" style={{ marginRight: 3 }} />
      <Text style={s.tierLockBadgeText}>{tier.toUpperCase()}</Text>
    </View>
  );
}

function LimitedBadge({ item, offsetTop = 8 }: { item: CosmeticItem; offsetTop?: number }) {
  const info = getLimitedInfo(item);
  if (!info.isLimited && !info.isNew) return null;
  if (info.isExpired || info.isSoldOut) {
    return (
      <View style={[s.limitedBadge, { top: offsetTop }]}>
        <LinearGradient
          colors={['#9CA3AF', '#4B5563']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={s.limitedBadgeText}>{info.isSoldOut ? 'TÜKENDİ' : 'SÜRE DOLDU'}</Text>
      </View>
    );
  }
  if (info.daysLeft !== null) {
    const urgent = info.daysLeft <= 3;
    return (
      <View style={[s.limitedBadge, { top: offsetTop }]}>
        <LinearGradient
          colors={urgent ? ['#EF4444', '#991B1B'] : ['#F472B6', '#831843']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Ionicons name="hourglass" size={9} color="#fff" style={{ marginRight: 3 }} />
        <Text style={s.limitedBadgeText}>{info.daysLeft}G KALDI</Text>
      </View>
    );
  }
  if (info.remainingStock !== null) {
    const urgent = info.remainingStock <= 10;
    return (
      <View style={[s.limitedBadge, { top: offsetTop }]}>
        <LinearGradient
          colors={urgent ? ['#EF4444', '#991B1B'] : ['#FBBF24', '#854F0B']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Ionicons name="flame" size={9} color="#fff" style={{ marginRight: 3 }} />
        <Text style={s.limitedBadgeText}>{info.remainingStock} ADET</Text>
      </View>
    );
  }
  if (info.isNew) {
    return (
      <View style={[s.limitedBadge, { top: offsetTop }]}>
        <LinearGradient
          colors={['#22D3EE', '#0E7490']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={s.limitedBadgeText}>YENİ</Text>
      </View>
    );
  }
  return null;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <View style={s.divider}>
      <View style={s.dividerLine} />
      <Text style={s.dividerLabel}>{label}</Text>
      <View style={s.dividerLine} />
    </View>
  );
}

function ShowcaseCard({ item, owned, purchasing, onPress, discountPct = 0, wished, onWishToggle }: {
  item: CosmeticItem; owned: boolean; purchasing: boolean; onPress: () => void;
  discountPct?: number;
  wished?: boolean;
  onWishToggle?: () => void;
}) {
  const rarity = (item.rarity as Rarity) || 'rare';
  const rarityColor = RARITY_COLOR[rarity];
  const bgGradient = [item.bg_gradient_start, item.bg_gradient_mid, item.bg_gradient_end].filter(Boolean) as string[];
  const fullCard = isFullCardItem(item.id);
  // ★ v108: Lottie öncelikli — frame/gift Lottie varsa PNG yerine onu göster.
  const lottieSrc = LottieView ? lottieFor(item.id) : null;
  return (
    <Pressable
      onPress={onPress}
      disabled={purchasing}
      style={[s.showcaseCard, {
        borderColor: rarityColor + '66',
        opacity: purchasing ? 0.6 : 1,
        ...Platform.select({
          ios: { shadowColor: rarityColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 12 },
          android: {},
        }),
      }]}
    >
      {/* Koyu zemin + rarity tint */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0A0F1A' }]} />
      <LinearGradient
        colors={[rarityColor + '1F', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.7 }}
        style={StyleSheet.absoluteFillObject}
      />
      {fullCard && !lottieSrc && (
        <Item3DArt itemId={item.id} fullSize color={item.art_color || undefined} />
      )}
      <View style={[s.rareTag, { borderColor: rarityColor + '80' }]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
        <Text style={[s.rareTagText, { color: rarityColor }]}>{RARITY_LABEL[rarity]}</Text>
      </View>
      {!owned && <LimitedBadge item={item} offsetTop={36} />}
      {!owned && item.min_tier && item.min_tier !== 'Free' && (
        <TierLockBadge tier={item.min_tier} offsetTop={36} alignRight />
      )}
      {!owned && onWishToggle && (
        <Pressable
          onPress={(e) => { e.stopPropagation(); onWishToggle(); }}
          hitSlop={10}
          style={s.wishlistBtn}
        >
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons
            name={wished ? 'heart' : 'heart-outline'}
            size={14}
            color={wished ? '#F472B6' : 'rgba(255,255,255,0.85)'}
          />
        </Pressable>
      )}
      {owned && (
        <View style={s.ownedBadge}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="checkmark-circle" size={11} color="#5DCAA5" />
          <Text style={s.ownedBadgeText}>SAHİPSİN</Text>
        </View>
      )}
      {/* ★ v108: Lottie öncelikli — frame/gift Lottie varsa kart art alanında oynat
          ★ v110.12 (8 May 2026): SopranoAura-tarzı halka frame'ler 90px, diğerleri 125px */}
      {lottieSrc ? (
        <View style={s.showcaseArtWrap}>
          <View style={{ width: storeLottieSize(item.id), height: storeLottieSize(item.id) }}>
            <LottieView
              source={lottieSrc}
              autoPlay
              loop
              resizeMode="contain"
              style={{ width: '100%', height: '100%' }}
            />
          </View>
        </View>
      ) : !fullCard && (
        <View style={s.showcaseArtWrap}>
          {hasIllustration(item.id) ? (
            <Item3DArt itemId={item.id} size={110} color={item.art_color || undefined} />
          ) : (
            <ShowcaseArtAnimated emoji={item.art_emoji || '✦'} color={item.art_color || '#fff'} />
          )}
        </View>
      )}
      <View style={s.showcaseInfo}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.95)']}
          locations={[0, 0.4, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={s.showcaseName}>{item.name}</Text>
        {item.meta && <Text style={s.showcaseMeta}>{item.meta}</Text>}
        <View style={s.showcasePrice}>
          {discountPct > 0 ? (
            <>
              <Text style={s.showcasePriceStrike}>{item.price_sp.toLocaleString('tr-TR')}</Text>
              <Text style={[s.showcasePriceNum, { color: '#22D3EE' }]}>
                {Math.round(item.price_sp * (100 - discountPct) / 100).toLocaleString('tr-TR')}
              </Text>
              <Text style={s.showcasePriceUnit}>SP</Text>
              <Text style={s.discountChip}>-%{discountPct}</Text>
            </>
          ) : (
            <>
              <Text style={s.showcasePriceNum}>{item.price_sp.toLocaleString('tr-TR')}</Text>
              <Text style={s.showcasePriceUnit}>SP</Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ★ v108.21: Bundle paketi kartı — yatay scroll, set parça önizleme + total indirim badge
function BundleCard({ bundle, items, owned, purchasing, tierDiscountPct, onPress }: {
  bundle: CosmeticBundle;
  items: CosmeticItem[];
  owned: boolean;
  purchasing: boolean;
  tierDiscountPct: number;
  onPress: () => void;
}) {
  const totalDiscount = Math.min(bundle.discount_pct + tierDiscountPct, 80);
  const finalPrice = Math.round(bundle.total_price_sp * (100 - totalDiscount) / 100);
  const rarity = (bundle.rarity as Rarity) || 'legendary';
  const rarityColor = RARITY_COLOR[rarity];
  const bundleItems = bundle.item_ids
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean) as CosmeticItem[];

  return (
    <Pressable
      onPress={onPress}
      disabled={purchasing || owned}
      style={[s.showcaseCard, {
        borderColor: rarityColor + '80',
        opacity: purchasing ? 0.6 : 1,
        ...Platform.select({
          ios: { shadowColor: rarityColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 14 },
          android: {},
        }),
      }]}
    >
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0A0F1A' }]} />
      <LinearGradient
        colors={[bundle.bg_gradient_start || rarityColor + '33', bundle.bg_gradient_end || '#0A0F1A']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <ShimmerOverlay duration={5500} />

      {/* Discount big badge */}
      <View style={s.bundleDiscountBadge}>
        <LinearGradient
          colors={['#22D3EE', '#0E7490']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={s.bundleDiscountBadgeText}>-%{totalDiscount}</Text>
      </View>

      {owned && (
        <View style={s.ownedBadge}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="checkmark-circle" size={11} color="#5DCAA5" />
          <Text style={s.ownedBadgeText}>SAHİPSİN</Text>
        </View>
      )}

      {/* Mini avatars row — set parça vitrini */}
      <View style={s.bundleItemsRow}>
        {bundleItems.slice(0, 3).map((it, idx) => {
          const lottieSrc = LottieView ? lottieFor(it.id) : null;
          return (
            <View
              key={it.id}
              style={[
                s.bundleItemMini,
                {
                  borderColor: rarityColor + '66',
                  marginLeft: idx === 0 ? 0 : -16,
                  zIndex: 10 - idx,
                },
              ]}
            >
              {lottieSrc ? (
                <LottieView source={lottieSrc} autoPlay loop resizeMode="contain" style={{ width: '110%', height: '110%' }} />
              ) : (
                <Text style={{ fontSize: 28, color: it.art_color || '#fff' }}>{it.art_emoji || '✦'}</Text>
              )}
            </View>
          );
        })}
        {bundleItems.length > 3 && (
          <View style={[s.bundleItemMini, { marginLeft: -16, zIndex: 0, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>+{bundleItems.length - 3}</Text>
          </View>
        )}
      </View>

      <View style={s.showcaseInfo}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.95)']}
          locations={[0, 0.4, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={s.showcaseName}>{bundle.name}</Text>
        {bundle.tagline && <Text style={s.showcaseMeta}>{bundle.tagline}</Text>}
        <View style={s.showcasePrice}>
          <Text style={s.showcasePriceStrike}>{bundle.total_price_sp.toLocaleString('tr-TR')}</Text>
          <Text style={[s.showcasePriceNum, { color: '#22D3EE' }]}>{finalPrice.toLocaleString('tr-TR')}</Text>
          <Text style={s.showcasePriceUnit}>SP</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function GalleryCard({ item, owned, onPress, discountPct = 0, wished, onWishToggle }: {
  item: CosmeticItem; owned: boolean; onPress: () => void;
  discountPct?: number;
  wished?: boolean;
  onWishToggle?: () => void;
}) {
  const rarity = (item.rarity as Rarity) || 'rare';
  const rarityColor = RARITY_COLOR[rarity];
  const featured = item.is_featured;
  const bgGradient = [item.bg_gradient_start, item.bg_gradient_end].filter(Boolean) as string[];
  // ★ v107 hotfix: featured kartlarda fullCard kapalı — frame geniş ama art %60 sıkışıyordu,
  //   kenarlarda boş alan oluşuyordu. Featured = sağda büyük art + solda info eski layout'una dön.
  //   Normal kartlarda fullCard aktif (kart-kenarına yayılan luxury frame).
  const fullCard = isFullCardItem(item.id) && !featured;
  // ★ v108: Lottie öncelikli — Lottie varsa PNG/emoji yerine onu göster.
  const lottieSrc = LottieView ? lottieFor(item.id) : null;
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.galleryCard,
        featured && s.galleryCardFeatured,
        { borderColor: featured ? rarityColor + '4D' : 'rgba(255,255,255,0.06)' },
      ]}
    >
      {/* Koyu zemin + rarity tint */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0A0F1A' }]} />
      <LinearGradient
        colors={[rarityColor + '1F', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.7 }}
        style={StyleSheet.absoluteFillObject}
      />
      {fullCard && !lottieSrc && (
        <Item3DArt itemId={item.id} fullSize color={item.art_color || undefined} />
      )}
      <View style={[s.rareDot, {
        backgroundColor: rarityColor,
        ...Platform.select({
          ios: { shadowColor: rarityColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 },
          android: {},
        }),
      }]} />
      {!owned && <LimitedBadge item={item} />}
      {!owned && item.min_tier && item.min_tier !== 'Free' && (
        <TierLockBadge tier={item.min_tier} offsetTop={8} alignRight />
      )}
      {!owned && onWishToggle && (
        <Pressable
          onPress={(e) => { e.stopPropagation(); onWishToggle(); }}
          hitSlop={10}
          style={s.wishlistBtn}
        >
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons
            name={wished ? 'heart' : 'heart-outline'}
            size={14}
            color={wished ? '#F472B6' : 'rgba(255,255,255,0.85)'}
          />
        </Pressable>
      )}
      {owned && (
        <View style={[s.ownedBadge, { top: 8, left: 8, right: 'auto' }]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="checkmark-circle" size={10} color="#5DCAA5" />
          <Text style={[s.ownedBadgeText, { fontSize: 7 }]}>SAHİP</Text>
        </View>
      )}
      {/* ★ v108: Lottie öncelikli — varsa PNG/emoji yerine animasyon göster
          ★ v110.12: SopranoAura-tarzı halka frame'ler daha küçük inset ile */}
      {lottieSrc ? (() => {
          const isRing = storeLottieSize(item.id) < 125;
          return (
            <View style={[
              { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
              featured
                ? { top: '10%', left: '50%', width: '45%', height: '80%' }
                : isRing
                  ? { top: '18%', left: '18%', right: '18%', height: '55%' }
                  : { top: '8%', left: '8%', right: '8%', height: '70%' },
            ]}>
              <LottieView
                source={lottieSrc}
                autoPlay
                loop
                resizeMode="contain"
                style={{ width: '100%', height: '100%' }}
              />
            </View>
          );
        })()
      : !fullCard && hasIllustration(item.id) ? (
        <View style={[
          { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
          featured
            ? { top: '15%', left: '55%', width: '40%', height: '70%' }
            : { top: '15%', left: '15%', right: '15%', height: '60%' },
        ]}>
          <Item3DArt itemId={item.id} size={featured ? 110 : 70} color={item.art_color || undefined} />
        </View>
      ) : !fullCard ? (
        <Text style={[s.galleryArt, featured && s.galleryArtFeatured, {
          color: item.art_color || '#fff',
          textShadowColor: item.art_color || '#fff',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 16,
        }]}>{item.art_emoji}</Text>
      ) : null}
      <View style={[s.galleryInfo, featured && s.galleryInfoFeatured]}>
        <LinearGradient
          colors={featured
            ? ['rgba(0,0,0,0.9)', 'rgba(0,0,0,0)'] as [string, string]
            : ['transparent', 'rgba(0,0,0,0.85)'] as [string, string]
          }
          start={featured ? { x: 0, y: 0 } : { x: 0.5, y: 0 }}
          end={featured ? { x: 1, y: 0 } : { x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={[s.galleryName, featured && s.galleryNameFeatured]}>{item.name}</Text>
        {item.tagline && <Text style={s.galleryTagline}>{item.tagline}</Text>}
        <View style={s.galleryPriceRow}>
          {discountPct > 0 ? (
            <>
              <Text style={[s.galleryPriceStrike, featured && { fontSize: 12 }]}>✦ {item.price_sp}</Text>
              <Text style={[s.galleryPrice, featured && { fontSize: 16 }, { color: '#22D3EE' }]}>
                ✦ {Math.round(item.price_sp * (100 - discountPct) / 100)}
              </Text>
              <Text style={s.discountChip}>-%{discountPct}</Text>
            </>
          ) : (
            <Text style={[s.galleryPrice, featured && { fontSize: 16 }]}>✦ {item.price_sp}</Text>
          )}
          {item.per_message && <Text style={s.galleryPriceUnit}>SP · sınırsız</Text>}
        </View>
      </View>
    </Pressable>
  );
}

function SPPackRow({ pack, onPress }: { pack: SPPack; onPress: () => void }) {
  const tierAccent: Record<typeof pack.tierKey, string> = {
    bronze: 'rgba(184,100,50,0.3)',
    silver: 'rgba(192,192,192,0.3)',
    gold: 'rgba(251,191,36,0.4)',
    platinum: 'rgba(167,139,250,0.4)',
    diamond: 'rgba(244,114,182,0.4)',
  };
  const tierBg: Record<typeof pack.tierKey, [string, string]> = {
    bronze: ['rgba(255,255,255,0.04)', 'rgba(0,0,0,0.3)'],
    silver: ['rgba(255,255,255,0.04)', 'rgba(0,0,0,0.3)'],
    gold: ['rgba(251,191,36,0.12)', 'rgba(0,0,0,0.3)'],
    platinum: ['rgba(167,139,250,0.15)', 'rgba(0,0,0,0.3)'],
    diamond: ['rgba(244,114,182,0.15)', 'rgba(0,0,0,0.3)'],
  };
  const buyBtnColors: Record<typeof pack.tierKey, [string, string]> = {
    bronze: ['#D4A574', '#B8723A'],
    silver: ['#E2E8F0', '#94A3B8'],
    gold: ['#FFE082', '#FAC775'],
    platinum: ['#C4B5FD', '#A78BFA'],
    diamond: ['#F9A8D4', '#F472B6'],
  };
  const buyBtnTextColor: Record<typeof pack.tierKey, string> = {
    bronze: '#fff', silver: '#1F2937', gold: '#3D1F00', platinum: '#2E1065', diamond: '#500724',
  };

  return (
    <Pressable onPress={onPress} style={[s.spPack, { borderColor: tierAccent[pack.tierKey] }]}>
      <LinearGradient
        colors={tierBg[pack.tierKey]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <ShimmerOverlay duration={5000} />
      {pack.popular && (
        <View style={s.popularBadge}>
          <LinearGradient
            colors={['#FFE082', '#EF9F27']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={s.popularBadgeText}>⚜ EN POPÜLER</Text>
        </View>
      )}
      <SPGem size={pack.tierKey === 'gold' || pack.tierKey === 'platinum' ? 48 : pack.tierKey === 'diamond' ? 50 : 44} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[s.spPackTier, { color: pack.tierColor }]}>{pack.tierName.toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
          <Text style={s.spPackAmount}>{pack.amount.toLocaleString('tr-TR')}</Text>
          <Text style={s.spPackAmountUnit}>SP</Text>
        </View>
        {pack.bonusPct ? (
          <View style={[s.spPackBonus, { backgroundColor: pack.tierColor + '26' }]}>
            <Text style={[s.spPackBonusText, { color: pack.tierColor }]}>
              + %{pack.bonusPct} LÜTUF{pack.bonusAmount ? ` · ${pack.bonusAmount.toLocaleString('tr-TR')} SP` : ''}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text style={s.spPackFiat}>{pack.fiat}</Text>
        <View style={s.spPackBuyBtn}>
          <LinearGradient
            colors={buyBtnColors[pack.tierKey]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={[s.spPackBuyText, { color: buyBtnTextColor[pack.tierKey] }]}>SATIN AL</Text>
        </View>
      </View>
    </Pressable>
  );
}

function CollectionCard({ col, onPress, itemCount }: {
  col: Collection;
  onPress?: () => void;
  itemCount: number;
}) {
  const bgGradient = [col.bg_gradient_start, col.bg_gradient_end].filter(Boolean) as string[];
  const nameLines = col.name.split(' ');
  const displayName = nameLines.length > 1
    ? nameLines[0] + '\n' + nameLines.slice(1).join(' ')
    : col.name;
  // ★ v108.21: DB tag yanıltıcıydı ("8 PARÇA" yazılıyor ama 4 item var). Gerçek
  //   itemCount baz alınır; sadece "SINIRLI" gibi özel etiketler korunur.
  const isSpecialTag = col.tag && !/parça/i.test(col.tag);
  const displayTag = isSpecialTag ? col.tag : `${itemCount} PARÇA`;
  return (
    <Pressable style={s.collectionCard} onPress={onPress}>
      {/* ★ v107 hotfix: Düz koyu zemin + col.art_color üstten abartısız ışık */}
      {isFullCardItem(col.id) ? (
        <Item3DArt itemId={col.id} fullSize color={col.art_color || undefined} />
      ) : (
        <>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0A0F1A' }]} />
          <LinearGradient
            colors={[(col.art_color || '#94A3B8') + '1A', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.7 }}
            style={StyleSheet.absoluteFillObject}
          />
        </>
      )}
      {itemCount > 0 ? (
        <View style={s.collectionTag}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Text style={s.collectionTagText}>{displayTag}</Text>
        </View>
      ) : null}
      {/* ★ v108.21: PNG asset'i varsa Item3DArt göster, yoksa emoji.
           Önceden sadece !hasIllustration koşulunda emoji render ediliyordu;
           PNG kolu yoktu → kart boş görünüyordu. */}
      {hasIllustration(col.id) ? (
        <View pointerEvents="none" style={s.collectionArtWrap}>
          <Item3DArt itemId={col.id} size={68} color={col.art_color || undefined} />
        </View>
      ) : (
        <Text style={[s.collectionArt, {
          color: col.art_color || '#fff',
          textShadowColor: col.art_color || '#fff',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 14,
        }]}>{col.art_emoji}</Text>
      )}
      <Text style={s.collectionName}>{displayName}</Text>
      <View style={s.collectionCta}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
        <Text style={s.collectionCtaText}>KEŞFET →</Text>
      </View>
    </Pressable>
  );
}

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(251,191,36,0.12)' },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 },
  backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  brandMark: { width: 36, height: 36, position: 'relative' },
  brandOrbit: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 18, borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.3)' },
  brandName: { color: '#fff', fontFamily: serif, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  brandSub: { color: 'rgba(251,191,36,0.7)', fontSize: 7, letterSpacing: 2.5, fontWeight: '600', marginTop: 2 },
  balanceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 5, paddingLeft: 6,
    borderRadius: 100, borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.4)',
    backgroundColor: 'rgba(0,0,0,0.4)', overflow: 'hidden',
  },
  balanceNum: { color: '#FFE082', fontSize: 13, fontWeight: '800', fontFamily: serif, letterSpacing: 0.5 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  // ★ v108.21: GÜNÜN FIRSATI banner — sticky FOMO at top
  dailyDealBanner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 14, borderRadius: 18,
    borderWidth: 0.5, borderColor: 'rgba(244,114,182,0.45)',
    marginBottom: 12, overflow: 'hidden', minHeight: 92,
  },
  dailyDealLeft: { flex: 1, gap: 3 },
  dailyDealKicker: {
    color: '#FCE7F3', fontSize: 9, fontWeight: '800', letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  dailyDealItemName: {
    color: '#fff', fontFamily: serif, fontSize: 16, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  dailyDealSubtitle: {
    color: 'rgba(255,255,255,0.7)', fontSize: 10, fontStyle: 'italic',
    marginBottom: 4, maxWidth: '95%',
  },
  dailyDealPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 2 },
  dailyDealStrike: {
    color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600',
    textDecorationLine: 'line-through', fontFamily: serif,
  },
  dailyDealFinal: { color: '#FFE082', fontSize: 18, fontWeight: '800', fontFamily: serif },
  dailyDealUnit: { color: 'rgba(255,224,130,0.75)', fontSize: 9, fontWeight: '700' },
  dailyDealOff: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 0.5, borderColor: 'rgba(255,224,130,0.35)',
    marginLeft: 4,
  },
  dailyDealOffText: { color: '#FFE082', fontSize: 9, fontWeight: '800' },
  dailyDealRight: { alignItems: 'center', gap: 8, marginLeft: 8 },
  dailyDealCountdown: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  dailyDealCountdownText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  dailyDealArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  tierDiscountBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    borderWidth: 0.5, borderColor: 'rgba(34,211,238,0.35)',
    marginBottom: 12, overflow: 'hidden',
  },
  tierDiscountText: {
    flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', letterSpacing: 0.2,
  },
  search: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 9,
  },
  searchInput: {
    flex: 1, color: '#fff', fontSize: 12, padding: 0,
    fontFamily: Platform.OS === 'ios' ? undefined : 'sans-serif',
  },
  searchText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, flex: 1 },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 9,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.3)',
    borderRadius: 100,
  },
  sortBtnText: {
    color: '#FBBF24', fontSize: 10, fontWeight: '700',
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  catPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  catPillActive: { backgroundColor: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.5)' },
  catPillText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  catPillTextActive: { color: '#FBBF24' },

  hero: {
    marginTop: 12, marginBottom: 8, paddingVertical: 20, paddingHorizontal: 20,
    borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
    overflow: 'hidden', minHeight: 168, position: 'relative',
  },
  heroArt: { position: 'absolute', right: -10, top: '50%', transform: [{ translateY: -45 }] },
  heroTag: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 0.5, borderColor: 'rgba(244,114,182,0.4)', borderRadius: 100, marginBottom: 12,
  },
  heroTagDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#F472B6' },
  heroTagText: { color: '#F9A8D4', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  heroTitle: { color: '#fff', fontFamily: serif, fontSize: 22, fontWeight: '700', lineHeight: 26, marginBottom: 8, maxWidth: '75%' },
  heroDesc: { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 18, marginBottom: 14, maxWidth: '70%' },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 100, overflow: 'hidden',
  },
  heroCtaText: { color: '#3D1F00', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 10 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(251,191,36,0.3)' },
  dividerLabel: { color: '#FBBF24', fontSize: 9, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' },
  sectionTitle: { color: '#fff', fontFamily: serif, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  sectionSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginBottom: 10 },

  showcaseCard: { width: 158, height: 212, borderRadius: 16, borderWidth: 0.5, overflow: 'hidden' },
  showcaseRadial: {
    position: 'absolute', top: '20%', left: '20%', right: '20%', height: '60%',
    borderRadius: 100, opacity: 0.7,
  },
  rareTag: {
    position: 'absolute', top: 12, left: 12, zIndex: 5,
    paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 100, borderWidth: 0.5, overflow: 'hidden',
  },
  rareTagText: { fontSize: 8, fontWeight: '800', letterSpacing: 1.5 },
  ownedBadge: {
    position: 'absolute', top: 12, right: 12, zIndex: 5,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 100, borderWidth: 0.5, borderColor: 'rgba(93,202,165,0.5)',
    overflow: 'hidden',
  },
  ownedBadgeText: { fontSize: 8, fontWeight: '800', letterSpacing: 1, color: '#5DCAA5' },
  // ★ v108.21: Wishlist heart — bottom-right, blur backdrop
  wishlistBtn: {
    position: 'absolute', top: 8, right: 8, zIndex: 4,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  // ★ v108.21: Limited edition badge — top-left, FOMO indicator
  limitedBadge: {
    position: 'absolute', top: 8, left: 8, zIndex: 4,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 100, overflow: 'hidden',
  },
  limitedBadgeText: {
    color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 1,
  },
  // ★ v109.2: Tier-lock badge — Plus/Pro üyelik kilidi
  tierLockBadge: {
    position: 'absolute', zIndex: 4,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 7, paddingVertical: 4,
    borderRadius: 100, overflow: 'hidden',
  },
  tierLockBadgeText: {
    color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 1,
  },
  showcaseArtWrap: { position: 'absolute', top: '8%', left: 0, right: 0, alignItems: 'center' },
  // ★ v108.21: Bundle card-specific
  bundleItemsRow: {
    position: 'absolute', top: 28, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 88,
  },
  bundleItemMini: {
    width: 66, height: 66, borderRadius: 33, borderWidth: 1.2,
    backgroundColor: 'rgba(0,0,0,0.55)', overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  bundleDiscountBadge: {
    position: 'absolute', top: 8, right: 8, zIndex: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  bundleDiscountBadgeText: {
    color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5,
  },
  showcaseInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingVertical: 12, overflow: 'hidden',
  },
  showcaseName: { color: '#fff', fontFamily: serif, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  showcaseMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  showcasePrice: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  showcasePriceNum: { color: '#FFE082', fontSize: 16, fontWeight: '800', fontFamily: serif },
  showcasePriceStrike: {
    color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600', fontFamily: serif,
    textDecorationLine: 'line-through',
  },
  showcasePriceUnit: { color: 'rgba(251,191,36,0.7)', fontSize: 10, fontWeight: '600' },

  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  // ★ v107 hotfix: aspectRatio yerine fixed height — RN'de aspectRatio'lu container içindeki
  //   absolute child WebView height hesaplamasını kaçırıyor, gallery'de boş render veriyordu.
  galleryCard: { width: (W - 16 * 2 - 10) / 2, height: (W - 16 * 2 - 10) / 2, borderRadius: 16, borderWidth: 0.5, overflow: 'hidden', position: 'relative' },
  galleryCardFeatured: { width: '100%', height: (W - 32) / 2.2 },
  galleryRadial: { position: 'absolute', top: '20%', left: '20%', right: '20%', height: '60%', borderRadius: 80, opacity: 0.7 },
  rareDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, zIndex: 3 },
  galleryArt: { position: 'absolute', top: '38%', left: '50%', fontSize: 56, transform: [{ translateX: -28 }, { translateY: -28 }] },
  galleryArtFeatured: { left: '70%', fontSize: 72, transform: [{ translateX: -36 }, { translateY: -36 }] },
  galleryInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingVertical: 10, overflow: 'hidden' },
  galleryInfoFeatured: { bottom: 0, left: 0, right: 'auto', width: '60%', height: '100%', paddingTop: 16, justifyContent: 'flex-end' },
  galleryName: { color: '#fff', fontFamily: serif, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  galleryNameFeatured: { fontSize: 16, marginBottom: 4 },
  galleryTagline: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontStyle: 'italic', marginBottom: 8, maxWidth: '90%' },
  galleryPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  galleryPrice: { color: '#FFE082', fontSize: 12, fontWeight: '700', fontFamily: serif },
  galleryPriceStrike: {
    color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600', fontFamily: serif,
    textDecorationLine: 'line-through',
  },
  galleryPriceUnit: { fontSize: 9, color: 'rgba(251,191,36,0.6)', fontWeight: '600' },
  // ★ v108.21: Plus/Pro tier discount chip
  discountChip: {
    color: '#06B6D4', fontSize: 9, fontWeight: '800', letterSpacing: 0.5,
    backgroundColor: 'rgba(34,211,238,0.18)', borderWidth: 0.5, borderColor: 'rgba(34,211,238,0.45)',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, marginLeft: 4,
  },

  tierSection: {
    marginTop: 12, marginBottom: 12, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14,
    borderRadius: 24, borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.15)',
    backgroundColor: 'rgba(255,255,255,0.02)', position: 'relative', overflow: 'hidden',
  },
  tierTopLine: { position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, backgroundColor: 'rgba(251,191,36,0.5)' },
  tierHeaderBlock: { alignItems: 'center', marginBottom: 14 },
  tierHeaderSymbol: { fontSize: 24, marginBottom: 6, color: '#FBBF24' },
  tierHeaderTitle: { color: '#fff', fontFamily: serif, fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  tierHeaderSub: { color: 'rgba(251,191,36,0.7)', fontSize: 9, letterSpacing: 2.5, marginTop: 4, fontWeight: '600' },
  // ★ v109.3: Premium bonus banner — Soprano Tezgâhı içine eklendi (eski sp-store'dan)
  spBonusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(20,184,166,0.25)',
    overflow: 'hidden', marginBottom: 12,
  },
  spBonusIconWrap: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderWidth: 0.5, borderColor: 'rgba(20,184,166,0.3)',
  },
  spBonusTitle: { color: '#5EEAD4', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  spBonusDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },
  spPack: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 16, borderWidth: 0.5, overflow: 'hidden', position: 'relative', marginBottom: 10,
  },
  popularBadge: {
    position: 'absolute', top: -1, right: 16, zIndex: 3,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, overflow: 'hidden',
  },
  popularBadgeText: { color: '#3D1F00', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  spPackTier: { fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  spPackAmount: { color: '#fff', fontFamily: serif, fontSize: 22, fontWeight: '800' },
  spPackAmountUnit: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginLeft: 4 },
  spPackBonus: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  spPackBonusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  spPackFiat: { color: '#fff', fontSize: 14, fontWeight: '800', fontFamily: serif },
  spPackBuyBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, overflow: 'hidden' },
  spPackBuyText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  collectionCard: { width: 124, height: 160, borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' },
  collectionTag: { position: 'absolute', top: 8, right: 8, zIndex: 3, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 100, overflow: 'hidden' },
  collectionTagText: { color: 'rgba(255,255,255,0.7)', fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  collectionArt: { position: 'absolute', top: 38, left: '50%', fontSize: 50, transform: [{ translateX: -25 }] },
  collectionArtWrap: {
    position: 'absolute', top: 28, left: 0, right: 0, height: 68,
    alignItems: 'center', justifyContent: 'center',
  },
  // ★ v108.21: Skeleton placeholder stilleri — pulse animasyonlu, içeride
  //   art dairesi + 2 çizgi göstererek kart şekli hissi verir.
  skelCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 24,
  },
  skelArt: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginBottom: 16,
  },
  skelLineLong: {
    width: '60%', height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.10)', marginBottom: 6,
  },
  skelLineShort: {
    width: '35%', height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  collectionName: { position: 'absolute', bottom: 36, left: 0, right: 0, textAlign: 'center', color: '#fff', fontFamily: serif, fontSize: 12, fontWeight: '700', paddingHorizontal: 8 },
  collectionCta: {
    position: 'absolute', bottom: 8, left: '50%', transform: [{ translateX: -42 }],
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)',
    width: 84, alignItems: 'center', overflow: 'hidden',
  },
  collectionCtaText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  bottomBar: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18,
    backgroundColor: 'rgba(15,23,41,0.6)', borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.3)',
    zIndex: 100, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.6, shadowRadius: 16 },
      android: { elevation: 14 },
    }),
  },
  bottomLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, letterSpacing: 1, fontWeight: '600' },
  bottomAction: { color: '#FBBF24', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  bottomCta: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, overflow: 'hidden' },
  bottomCtaText: { color: '#3D1F00', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
});
