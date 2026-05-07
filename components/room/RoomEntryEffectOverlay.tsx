/**
 * SopranoChat — Oda Giriş Efekti Overlay
 * ═══════════════════════════════════════════════════════════════════
 * v108 (4 May 2026) — Kullanıcı odaya katılınca ekranda 2-3 sn Lottie
 * animasyonu + kullanıcı adı gösterir. TikTok/Bigo paritesi.
 *
 * Tetikleme: room_participants realtime INSERT olayı →
 *   entry_effect NOT NULL ise bu overlay render olur.
 *
 * Props:
 *   effectId  — cosmetic_items.id (message_art/entry_effect kategori)
 *   userName  — giren kullanıcının display_name
 *   onDone    — animasyon bitince temizle
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getIllustrationPng } from '../../constants/storeIllustrationsPng';
import { getEntryEffectLottie } from '../../constants/entryEffectLottieRegistry';
import { getCosmeticAsset, getCachedCosmeticAsset, type AssetMeta } from '../../services/cosmeticAssetCache';

// ★ v110.7: Lottie player — web admin'den URL ile eklenen entry_effect ürünleri için
let LottieView: any = null;
try { LottieView = require('lottie-react-native').default; } catch { /* fallback */ }

const { width: W, height: H } = Dimensions.get('window');

// ★ v108.19: Şiirsel/otantik label'lar — sade çeviriler (Alev, Şimşek vb.) yerine
//   premium markalı isimler. Kullanıcının vurgusu: "daha vurucu" → epik kelime seçimi.
const ENTRY_META: Record<string, { emoji: string; color: string; label: string }> = {
  'constellation':  { emoji: '✦',  color: '#FBBF24', label: 'Sonsuz Burç' },
  'or-ancien':      { emoji: '✨', color: '#FBBF24', label: 'Kadim Altın' },
  'inferno':        { emoji: '🔥', color: '#DC2626', label: 'Volkan Nefesi' },
  'voltaire':       { emoji: '⚡', color: '#22D3EE', label: 'Yıldırımın Sesi' },
  'belle-epoque':   { emoji: '💗', color: '#F472B6', label: 'Zarif Çağ' },
  'aurum-strike':   { emoji: '⚡', color: '#FBBF24', label: 'Altın Hükmü' },
  'glacier-aura':   { emoji: '❄️', color: '#22D3EE', label: 'Buzul Hâlesi' },
  'vesuvius':       { emoji: '🌋', color: '#FB923C', label: 'Vesuvius' },
  'ai-spark':       { emoji: '🤖', color: '#A78BFA', label: 'AI Spark' },
};

interface Props {
  effectId: string;
  userName: string;
  onDone: () => void;
}

// ★ v109.4: Particle — mağaza PNG asset'i (Constellation → constellation.png, vb).
//   Emoji TEXT yerine 3D fluent PNG ikonları, mağaza kartlarıyla görsel paritesi.
function SparkleParticle({ delay, color, side, png }: { delay: number; color: string; side: 'tl' | 'tr' | 'bl' | 'br'; png: any }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, []);
  const dx = side === 'tl' || side === 'bl' ? -W * 0.3 : W * 0.3;
  const dy = side === 'tl' || side === 'tr' ? -H * 0.15 : H * 0.15;
  const sz = 32 + Math.random() * 10;
  if (!png) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: '45%', left: '50%',
        width: sz, height: sz,
        marginLeft: -sz / 2, marginTop: -sz / 2,
        opacity: t.interpolate({ inputRange: [0, 0.2, 0.85, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 + Math.random() * 360}deg`] }) },
          { scale: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1.3, 0.6] }) },
        ],
        ...Platform.select({
          ios: {
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 10,
          },
          android: {},
        }),
      }}
    >
      <Image source={png} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </Animated.View>
  );
}

export default function RoomEntryEffectOverlay({ effectId, userName, onDone }: Props) {
  // ★ v108.20: Yandan slide-in — sağdan kayma + opacity. Köşeler yumuşak,
  //   sis/toz hissi için banner kart border'ı yok, soft radial fade.
  const opacity = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(W * 0.5)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      // Tier rengi vignette glow — yumuşak kenar
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        Animated.delay(1700),
        Animated.timing(glowOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      // Banner: sağdan slide-in → hold → sola çıkış
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.spring(slideX, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 90 }),
        ]),
        Animated.delay(2000),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
          Animated.timing(slideX, { toValue: -W * 0.4, duration: 500, useNativeDriver: true, easing: Easing.in(Easing.cubic) }),
        ]),
      ]),
    ]).start(() => onDone());
  }, []);

  // ★ v109.4: Lottie kaldırıldı — mağaza PNG'leri kullanılıyor (kullanıcı talebi).
  const pngSource = getIllustrationPng(effectId);
  // ★ v110.12 (8 May 2026): PNG yoksa LOCAL Lottie registry'den çek (AI Spark gibi
  //   sadece Lottie asset'i olan ürünler için). Mağaza Item3DArt ile aynı kaynak.
  const localLottieSource = !pngSource ? getEntryEffectLottie(effectId) : null;
  const meta = ENTRY_META[effectId] || { emoji: '✨', color: '#FBBF24', label: effectId.toUpperCase() };

  // ★ v110.7: Hardcoded PNG/meta'da yoksa cosmetic_items.meta'dan runtime URL fetch.
  //   Web admin'den eklenen yeni entry_effect ürünleri için Lottie/Image render.
  const initialAsset = getCachedCosmeticAsset(effectId);
  const [remoteAsset, setRemoteAsset] = useState<AssetMeta | null>(initialAsset);
  const needsRemoteFetch = !pngSource && !localLottieSource && !ENTRY_META[effectId];

  useEffect(() => {
    if (!needsRemoteFetch || initialAsset) return;
    let cancelled = false;
    getCosmeticAsset(effectId).then(m => {
      if (!cancelled) setRemoteAsset(m);
    });
    return () => { cancelled = true; };
  }, [effectId, needsRemoteFetch, initialAsset]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { zIndex: 9999 }]}>
      {/* Tier rengi vignette glow — ekran kenarlarından merkeze */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: glowOpacity }]}>
        <LinearGradient
          colors={[meta.color + '00', meta.color + '20', meta.color + '60']}
          start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[meta.color + '00', meta.color + '20', meta.color + '60']}
          start={{ x: 0.5, y: 0.5 }} end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* 4 PNG ikon — köşelerden uçar (mağaza görselinin kendisi) */}
      <SparkleParticle delay={0}   color={meta.color} side="tl" png={pngSource} />
      <SparkleParticle delay={120} color={meta.color} side="tr" png={pngSource} />
      <SparkleParticle delay={240} color={meta.color} side="bl" png={pngSource} />
      <SparkleParticle delay={360} color={meta.color} side="br" png={pngSource} />

      <Animated.View
        pointerEvents="none"
        style={[s.container, { opacity, transform: [{ translateX: slideX }] }]}
      >
        {/* ★ v109.4: Mağaza PNG ana animasyon — pulse + breath */}
        {pngSource ? (
          <Image
            source={pngSource}
            style={[s.lottie, Platform.select({
              ios: {
                shadowColor: meta.color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.85, shadowRadius: 20,
              },
              android: {},
            })] as any}
            resizeMode="contain"
          />
        ) : localLottieSource && LottieView ? (
          /* ★ v110.12: Local Lottie registry (AI Spark gibi sadece Lottie urunler) */
          <LottieView
            source={localLottieSource}
            autoPlay
            loop={false}
            speed={1}
            resizeMode="contain"
            style={s.lottie}
          />
        ) : remoteAsset?.url && remoteAsset.type === 'lottie' && LottieView ? (
          /* ★ v110.7: Web admin'den yüklenen Lottie URL */
          <LottieView
            source={{ uri: remoteAsset.url }}
            autoPlay
            loop={false}
            speed={1}
            resizeMode="contain"
            style={s.lottie}
          />
        ) : remoteAsset?.url && remoteAsset.type === 'image' ? (
          /* ★ v110.7: Web admin'den yüklenen PNG/SVG URL */
          <Image
            source={{ uri: remoteAsset.url }}
            style={[s.lottie, Platform.select({
              ios: {
                shadowColor: meta.color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.85, shadowRadius: 20,
              },
              android: {},
            })] as any}
            resizeMode="contain"
          />
        ) : (
          <Text style={[s.emoji, { textShadowColor: meta.color }]}>
            {meta.emoji}
          </Text>
        )}

        {/* ★ v108.20: Tier-renkli toz bulutu — her efekt kendi rengiyle parlar */}
        <View style={s.textBlock}>
          {/* Yatay soft fade — tier rengi belirgin orta + kenarlarda transparan */}
          <LinearGradient
            colors={[meta.color + '00', meta.color + '55', meta.color + '00']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text
            style={[s.userName, {
              color: meta.color,
              textShadowColor: meta.color,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 14,
            }]}
            numberOfLines={1}
          >
            {userName}
          </Text>
          <Text style={s.joinedText}>aramıza katıldı</Text>
          <Text
            style={[s.effectLabelInline, {
              color: meta.color,
              textShadowColor: meta.color,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 8,
            }]}
            numberOfLines={1}
          >
            {meta.emoji} {meta.label}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: H * 0.15,
    left: W * 0.1,
    right: W * 0.1,
    alignItems: 'center',
    zIndex: 9999,
  },
  lottie: {
    // ★ v110.14: 200 → 300 (kullanıcı "çok küçük giriyor"). Oda girişinde
    //   Lottie animasyon daha büyük + dramatik görünür.
    width: 300,
    height: 300,
  },
  emoji: {
    fontSize: 100,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
    marginBottom: 8,
  },
  // ★ v108.20: Toz bulutu banner — border YOK, kapsül form, ORTALANMIŞ metin
  textBlock: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
    overflow: 'hidden',
    minWidth: 240,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },
  effectLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: serif,
    marginTop: 4,
  },
  effectLabelInline: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    fontFamily: serif,
    marginTop: 5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    maxWidth: W * 0.55,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  joinedText: {
    fontSize: 11, color: 'rgba(255,255,255,0.6)',
    marginTop: 3, letterSpacing: 0.3,
    textAlign: 'center',
  },
});
