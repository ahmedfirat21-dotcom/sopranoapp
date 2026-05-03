// ★ v107 (3 May 2026): Maison Soprano mağaza — native UI (HTML mockup ilhamlı).
//
// HTML mockup: sopranochat_luxury_store_redesign.html
// Native render — RN Animated API ile akıcı animasyonlar (HeroFleurDeLis float,
// HeroGlow pulse, ShowcaseArtAnimated rotate-scale, BrandOrbitDot 12s rotate,
// ShimmerOverlay balance + SP packs).
//
// DB-bound: cosmetic_items + collections + user_inventory + store_purchase RPC.
// Showcase/gallery kart tıklama → Alert onay → SP düş + envantere ekle + toast.

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated, Platform, Dimensions, Alert, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import AppBackground from '../components/AppBackground';
import SPIcon from '../components/SPIcon';
import { showToast } from '../components/Toast';
import { useAuth } from './_layout';
import { StoreService, type CosmeticItem, type Collection, type Rarity } from '../services/store';
import { getIllustrationHtml, isFullCardItem } from '../constants/storeIllustrations';

const { width: W } = Dimensions.get('window');

const CATEGORIES = ['★ Atelier', 'Profil', 'Mesaj Sanatı', 'Hediyeler', 'Salonlar', 'Ünvanlar', 'Boost', 'SP'] as const;

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

// ★ 3D SVG illustration WebView'i — transparent zemin, küçük scope (yalnız art alanı).
//   itemId → constants/storeIllustrations.ts'ten HTML string. Her ürün için ayrı 3D SVG.
//   fullSize=true → WebView parent View'i tamamen kapsar (full-card item için).
function Item3DArt({ itemId, size = 140, fullSize = false }: {
  itemId: string; size?: number; fullSize?: boolean;
}) {
  const html = getIllustrationHtml(itemId);
  if (!html) return null;
  const wrapStyle = fullSize ? StyleSheet.absoluteFillObject : { width: size, height: size };
  const webStyle = fullSize
    ? { flex: 1, backgroundColor: 'transparent' }
    : { width: size, height: size, backgroundColor: 'transparent' };
  return (
    <View pointerEvents="none" style={wrapStyle}>
      <WebView
        source={{ html }}
        style={webStyle}
        containerStyle={{ backgroundColor: 'transparent' }}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        androidLayerType="hardware"
        scalesPageToFit={false}
      />
    </View>
  );
}

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

// ─── SP paketleri (statik UI, fiat ödeme için sp-store'a yönlendir) ──
interface SPPack {
  id: string; tierName: string; tierKey: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  amount: number; bonusAmount?: number; bonusPct?: number;
  fiat: string; popular?: boolean; tierColor: string;
}
const SP_PACKS: SPPack[] = [
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

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, firebaseUser } = useAuth();
  const sp = (profile as any)?.system_points || 0;
  const [activeCat, setActiveCat] = useState(0);
  const [items, setItems] = useState<CosmeticItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [inventory, setInventory] = useState<Set<string>>(new Set());
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { items: fetchedItems, collections: fetchedCols } = await StoreService.getCatalog();
      if (cancelled) return;
      setItems(fetchedItems);
      setCollections(fetchedCols);
    })();
    if (firebaseUser?.uid) {
      StoreService.getUserInventory(firebaseUser.uid).then((inv) => {
        if (!cancelled) setInventory(inv);
      });
    }
    return () => { cancelled = true; };
  }, [firebaseUser?.uid]);

  const showcaseItems = items.filter((i) => i.category === 'atelier');
  const galleryItems = items.filter((i) => i.category === 'message_art');

  const handlePurchase = (item: CosmeticItem) => {
    if (!firebaseUser?.uid) return;
    if (inventory.has(item.id)) {
      showToast({ title: 'Zaten sahipsin', message: `${item.name} envanterinde.`, type: 'info' });
      return;
    }
    if (item.per_message) {
      showToast({
        title: 'Mesaj başına',
        message: `"${item.name}" oda sohbetinde ✨ butonundan kullanılır.`,
        type: 'info',
      });
      return;
    }
    Alert.alert(
      'Satın Al',
      `${item.name} için ${item.price_sp.toLocaleString('tr-TR')} SP harcanacak. Onaylıyor musun?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Satın Al', style: 'default',
          onPress: async () => {
            setPurchasing(item.id);
            const r = await StoreService.purchase(firebaseUser.uid, item.id);
            setPurchasing(null);
            if (r.success) {
              showToast({
                title: '✓ Satın Alındı',
                message: `${item.name} envanterinde (-${r.cost} SP)`,
                type: 'success',
              });
              setInventory((prev) => new Set(prev).add(item.id));
            } else {
              showToast({
                title: 'Hata',
                message: r.error || 'Bağlantı sorunu',
                type: r.alreadyOwned ? 'info' : 'error',
              });
            }
          },
        },
      ],
    );
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

          <View style={s.search}>
            <Ionicons name="search" size={13} color="rgba(251,191,36,0.6)" />
            <Text style={s.searchText}>Koleksiyonda ara…</Text>
            <Ionicons name="mic-outline" size={13} color="rgba(255,255,255,0.4)" />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CATEGORIES.map((cat, idx) => {
              const active = idx === activeCat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setActiveCat(idx)}
                  style={[s.catPill, active && s.catPillActive]}
                >
                  <Text style={[s.catPillText, active && s.catPillTextActive]}>{cat}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* BODY */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={s.hero}>
            <LinearGradient
              colors={['rgba(124,58,237,0.3)', 'rgba(190,24,93,0.2)', 'rgba(0,0,0,0.3)']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <HeroGlow />
            <View pointerEvents="none" style={s.heroArt}><HeroFleurDeLis /></View>
            <View style={s.heroTag}>
              <View style={s.heroTagDot} />
              <Text style={s.heroTagText}>CANLI · YENİ KOLEKSİYON</Text>
            </View>
            <Text style={s.heroTitle}>Soprano Couture{'\n'}Sonbahar 2026</Text>
            <Text style={s.heroDesc}>Yedi tasarımcı. On iki sınırlı parça.{'\n'}Sadece bu sezona özel.</Text>
            <Pressable style={s.heroCta}>
              <LinearGradient
                colors={['#FFE082', '#FAC775']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={s.heroCtaText}>KEŞFET</Text>
              <Ionicons name="arrow-forward" size={14} color="#3D1F00" />
            </Pressable>
          </View>

          {/* Atelier Vitrin */}
          <SectionDivider label="★ ATELIER · İMZA PARÇALARI ★" />
          <Text style={s.sectionTitle}>Vitrin</Text>
          <Text style={s.sectionSub}>El işçiliği · Sınırlı sayıda · Her biri tek</Text>
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingHorizontal: 4, paddingVertical: 8 }}
            style={{ marginHorizontal: -4 }}
          >
            {showcaseItems.map((item) => (
              <ShowcaseCard
                key={item.id}
                item={item}
                owned={inventory.has(item.id)}
                purchasing={purchasing === item.id}
                onPress={() => handlePurchase(item)}
              />
            ))}
          </ScrollView>

          {/* Galeri */}
          <SectionDivider label="— GALERİ · MESAJ SANATI —" />
          <View style={s.galleryGrid}>
            {galleryItems.map((item) => (
              <GalleryCard
                key={item.id}
                item={item}
                owned={inventory.has(item.id)}
                onPress={() => handlePurchase(item)}
              />
            ))}
          </View>

          {/* Soprano Tezgâhı */}
          <View style={s.tierSection}>
            <View pointerEvents="none" style={s.tierTopLine} />
            <View style={s.tierHeaderBlock}>
              <Text style={s.tierHeaderSymbol}>⚜</Text>
              <Text style={s.tierHeaderTitle}>Soprano Tezgâhı</Text>
              <Text style={s.tierHeaderSub}>S P · K O L E K S İ Y O N L A R I</Text>
            </View>
            {SP_PACKS.map((pack) => <SPPackRow key={pack.id} pack={pack} onPress={() => router.push('/sp-store')} />)}
          </View>

          {/* Koleksiyonlar */}
          <SectionDivider label="— KOLEKSİYONLAR · TÜM SEZON —" />
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 4, paddingVertical: 8 }}
            style={{ marginHorizontal: -16 }}
          >
            {collections.map((col) => <CollectionCard key={col.id} col={col} />)}
          </ScrollView>
        </ScrollView>

        {/* Bottom bar — glassmorphism (BlurView + soft gradient) */}
        <View style={[s.bottomBar, { bottom: 12 + insets.bottom }]}>
          <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFillObject} />
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'rgba(15,23,41,0.85)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View>
            <Text style={s.bottomLabel}>EKSİK SP MİKTARI</Text>
            <Text style={s.bottomAction}>Hesabını yükle</Text>
          </View>
          <Pressable style={s.bottomCta} onPress={() => router.push('/sp-store')}>
            <LinearGradient
              colors={['#FFE082', '#FAC775', '#EF9F27']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={s.bottomCtaText}>⚜ ŞIK YÜKLEME</Text>
          </Pressable>
        </View>
      </View>
    </AppBackground>
  );
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

function ShowcaseCard({ item, owned, purchasing, onPress }: {
  item: CosmeticItem; owned: boolean; purchasing: boolean; onPress: () => void;
}) {
  const rarity = (item.rarity as Rarity) || 'rare';
  const rarityColor = RARITY_COLOR[rarity];
  const bgGradient = [item.bg_gradient_start, item.bg_gradient_mid, item.bg_gradient_end].filter(Boolean) as string[];
  const fullCard = isFullCardItem(item.id);
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
      {/* Full-card item ise WebView kartın tüm zeminini kapsar (frame bg + rays HTML içinde) */}
      {fullCard ? (
        <Item3DArt itemId={item.id} fullSize />
      ) : (
        <>
          <LinearGradient
            colors={(bgGradient.length >= 2 ? bgGradient : ['#1a1330', '#2D1B4E', '#0a0a1a']) as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* ★ v107 hotfix: 3D illustration'lı ürünlerde dairesel halo yok — illustration kendi
              drop-shadow'unu taşır, ek halka double-vision yaratıyordu. */}
          {item.bg_radial && !getIllustrationHtml(item.id) && (
            <View pointerEvents="none" style={[s.showcaseRadial, { backgroundColor: item.bg_radial }]} />
          )}
        </>
      )}
      <View style={[s.rareTag, { borderColor: rarityColor + '80' }]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
        <Text style={[s.rareTagText, { color: rarityColor }]}>{RARITY_LABEL[rarity]}</Text>
      </View>
      {owned && (
        <View style={s.ownedBadge}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="checkmark-circle" size={11} color="#5DCAA5" />
          <Text style={s.ownedBadgeText}>SAHİPSİN</Text>
        </View>
      )}
      {/* Native SoftHalo SADECE emoji ürünlerde — 3D illustration kendi drop-shadow'unu taşır */}
      {!getIllustrationHtml(item.id) && (
        <View pointerEvents="none" style={{ position: 'absolute', top: '20%', left: '20%', right: '20%', height: '60%' }}>
          <SoftHalo color={item.art_color || '#fff'} size={140} opacity={0.3} />
        </View>
      )}
      {/* Full-card item ise yukarıda WebView kart-genişliği render ediliyor; orta art skip */}
      {!fullCard && (
        <View style={s.showcaseArtWrap}>
          {getIllustrationHtml(item.id) ? (
            <Item3DArt itemId={item.id} size={110} />
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
          <Text style={s.showcasePriceNum}>{item.price_sp.toLocaleString('tr-TR')}</Text>
          <Text style={s.showcasePriceUnit}>SP</Text>
        </View>
      </View>
    </Pressable>
  );
}

function GalleryCard({ item, owned, onPress }: {
  item: CosmeticItem; owned: boolean; onPress: () => void;
}) {
  const rarity = (item.rarity as Rarity) || 'rare';
  const rarityColor = RARITY_COLOR[rarity];
  const featured = item.is_featured;
  const bgGradient = [item.bg_gradient_start, item.bg_gradient_end].filter(Boolean) as string[];
  // ★ v107 hotfix: tüm illustration'lı ürünler luxury frame ile sarılı geliyor — kart kenarına yay.
  const fullCard = isFullCardItem(item.id);
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.galleryCard,
        featured && s.galleryCardFeatured,
        { borderColor: featured ? rarityColor + '4D' : 'rgba(255,255,255,0.06)' },
      ]}
    >
      {fullCard ? (
        <Item3DArt itemId={item.id} fullSize />
      ) : (
        <>
          <LinearGradient
            colors={(bgGradient.length >= 2 ? bgGradient : ['#1a1330', '#2D1B4E']) as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {item.bg_radial && !getIllustrationHtml(item.id) && (
            <View pointerEvents="none" style={[s.galleryRadial, { backgroundColor: item.bg_radial }]} />
          )}
        </>
      )}
      <View style={[s.rareDot, {
        backgroundColor: rarityColor,
        ...Platform.select({
          ios: { shadowColor: rarityColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 },
          android: {},
        }),
      }]} />
      {owned && (
        <View style={[s.ownedBadge, { top: 8, left: 8, right: 'auto' }]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="checkmark-circle" size={10} color="#5DCAA5" />
          <Text style={[s.ownedBadgeText, { fontSize: 7 }]}>SAHİP</Text>
        </View>
      )}
      {/* Native halo SADECE illustration olmayanlarda (3D HTML kendi drop-shadow'u taşır) */}
      {!getIllustrationHtml(item.id) && (
        <View pointerEvents="none" style={{
          position: 'absolute',
          top: '20%',
          left: featured ? '50%' : '20%',
          right: featured ? 'auto' : '20%',
          width: featured ? '40%' : undefined,
          height: featured ? '60%' : '50%',
        }}>
          <SoftHalo color={item.art_color || '#fff'} size={featured ? 110 : 80} opacity={0.28} />
        </View>
      )}
      {!fullCard && !getIllustrationHtml(item.id) && (
        <Text style={[s.galleryArt, featured && s.galleryArtFeatured, {
          color: item.art_color || '#fff',
          textShadowColor: item.art_color || '#fff',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 16,
        }]}>{item.art_emoji}</Text>
      )}
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
          <Text style={[s.galleryPrice, featured && { fontSize: 16 }]}>✦ {item.price_sp}</Text>
          {item.per_message && <Text style={s.galleryPriceUnit}>SP / mesaj</Text>}
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
        {pack.bonusPct && (
          <View style={[s.spPackBonus, { backgroundColor: pack.tierColor + '26' }]}>
            <Text style={[s.spPackBonusText, { color: pack.tierColor }]}>
              + %{pack.bonusPct} LÜTUF{pack.bonusAmount ? ` · ${pack.bonusAmount.toLocaleString('tr-TR')} SP` : ''}
            </Text>
          </View>
        )}
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

function CollectionCard({ col }: { col: Collection }) {
  const bgGradient = [col.bg_gradient_start, col.bg_gradient_end].filter(Boolean) as string[];
  const nameLines = col.name.split(' ');
  const displayName = nameLines.length > 1
    ? nameLines[0] + '\n' + nameLines.slice(1).join(' ')
    : col.name;
  return (
    <Pressable style={s.collectionCard}>
      {/* ★ v107 hotfix: koleksiyonlar da luxury frame ile sarılı geliyor — kart kenarına yay. */}
      {isFullCardItem(col.id) ? (
        <Item3DArt itemId={col.id} fullSize />
      ) : (
        <LinearGradient
          colors={(bgGradient.length >= 2 ? bgGradient : ['#1a1330', '#2D1B4E']) as any}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      {col.tag && (
        <View style={s.collectionTag}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Text style={s.collectionTagText}>{col.tag}</Text>
        </View>
      )}
      {/* Native halo SADECE illustration olmayanlarda */}
      {!getIllustrationHtml(col.id) && (
        <View pointerEvents="none" style={{ position: 'absolute', top: '15%', left: '15%', right: '15%', height: '50%' }}>
          <SoftHalo color={col.art_color || '#fff'} size={110} opacity={0.25} />
        </View>
      )}
      {!getIllustrationHtml(col.id) && (
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
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 12,
  },
  searchText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, flex: 1 },
  catPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  catPillActive: { backgroundColor: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.5)' },
  catPillText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  catPillTextActive: { color: '#FBBF24' },

  hero: {
    marginVertical: 16, paddingVertical: 24, paddingHorizontal: 20,
    borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
    overflow: 'hidden', minHeight: 180, position: 'relative',
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

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 14 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(251,191,36,0.3)' },
  dividerLabel: { color: '#FBBF24', fontSize: 9, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' },
  sectionTitle: { color: '#fff', fontFamily: serif, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  sectionSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginBottom: 14 },

  showcaseCard: { width: 180, height: 240, borderRadius: 18, borderWidth: 0.5, overflow: 'hidden' },
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
  showcaseArtWrap: { position: 'absolute', top: '25%', left: 0, right: 0, alignItems: 'center' },
  showcaseInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingVertical: 12, overflow: 'hidden',
  },
  showcaseName: { color: '#fff', fontFamily: serif, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  showcaseMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  showcasePrice: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  showcasePriceNum: { color: '#FFE082', fontSize: 16, fontWeight: '800', fontFamily: serif },
  showcasePriceUnit: { color: 'rgba(251,191,36,0.7)', fontSize: 10, fontWeight: '600' },

  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  galleryCard: { width: (W - 16 * 2 - 10) / 2, aspectRatio: 1, borderRadius: 16, borderWidth: 0.5, overflow: 'hidden', position: 'relative' },
  galleryCardFeatured: { width: '100%', aspectRatio: 2.2 },
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
  galleryPriceUnit: { fontSize: 9, color: 'rgba(251,191,36,0.6)', fontWeight: '600' },

  tierSection: {
    marginTop: 20, marginBottom: 20, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16,
    borderRadius: 24, borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.15)',
    backgroundColor: 'rgba(255,255,255,0.02)', position: 'relative', overflow: 'hidden',
  },
  tierTopLine: { position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, backgroundColor: 'rgba(251,191,36,0.5)' },
  tierHeaderBlock: { alignItems: 'center', marginBottom: 18 },
  tierHeaderSymbol: { fontSize: 24, marginBottom: 6, color: '#FBBF24' },
  tierHeaderTitle: { color: '#fff', fontFamily: serif, fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  tierHeaderSub: { color: 'rgba(251,191,36,0.7)', fontSize: 9, letterSpacing: 2.5, marginTop: 4, fontWeight: '600' },
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

  collectionCard: { width: 140, height: 180, borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' },
  collectionTag: { position: 'absolute', top: 8, right: 8, zIndex: 3, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 100, overflow: 'hidden' },
  collectionTagText: { color: 'rgba(255,255,255,0.7)', fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  collectionArt: { position: 'absolute', top: 38, left: '50%', fontSize: 50, transform: [{ translateX: -25 }] },
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
