/**
 * SopranoChat — Oda İçi Hediye Animasyon Overlay'i
 * ═══════════════════════════════════════════════════════════════════
 * v108 (4 May 2026) — TikTok/Bigo seviyesinde dramatik hediye animasyonu.
 *
 * 3 TIER SİSTEMİ (fiyata göre):
 *   🟢 Mini   (< 65 SP)   — Kompakt yükselen emoji, kısa banner
 *   🟡 Normal (65-249 SP)  — Orta boyut, glow halo, 3.5sn
 *   🔴 Mega   (250+ SP)    — TAM EKRAN, radial glow, confetti, haptic, 5sn
 *
 * Akış:
 *  1. room_live_gifts tablosuna yeni satır INSERT
 *  2. postgres_changes realtime → bu component yakalar
 *  3. Fiyat bazlı tier belirlenir → uygun animasyon oynar
 *  4. pointerEvents="none" → odadaki hiçbir tıklamayı engellemez
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Animated, Easing, StyleSheet, Text, Dimensions, Platform, Vibration, DeviceEventEmitter,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlowView } from '../skia';
import { supabase } from '../../constants/supabase';
import Item3DArt from '../store/Item3DArt';
import { hasIllustration } from '../../constants/storeIllustrationsPng';
import { getGiftLottie, hasGiftLottie } from '../../constants/giftLottieRegistry';
import { i18n } from '../../services/i18n';

// Lottie opsiyonel (native modül yoksa fallback)
let LottieView: any = null;
try {
  LottieView = require('lottie-react-native').default;
} catch { /* native module yoksa fallback null */ }

const { width: W, height: H } = Dimensions.get('window');

// ─── Tier Eşikleri ───
type GiftTier = 'mini' | 'normal' | 'mega';
function getGiftTier(priceSP: number): GiftTier {
  if (priceSP >= 250) return 'mega';
  if (priceSP >= 65) return 'normal';
  return 'mini';
}

// ★ v110.14: Tier farkı agresifleştirildi — kullanıcı raporu: "düşük/yüksek SP aynı görünüyor".
//   mini → daha kompakt, mega → daha dramatik. Glow ve scalePeak da farklılaştı.
const TIER_CONFIG: Record<GiftTier, {
  size: number; duration: number; liftY: number;
  scalePeak: number; showConfetti: boolean; haptic: boolean;
  bannerFontSize: number; glowRadius: number; timeout: number;
}> = {
  mini:   { size: 100,  duration: 2200, liftY: -40,  scalePeak: 1.0,  showConfetti: false, haptic: false, bannerFontSize: 11, glowRadius: 0,   timeout: 2800 },
  normal: { size: 200,  duration: 3200, liftY: -90,  scalePeak: 1.20, showConfetti: false, haptic: true,  bannerFontSize: 14, glowRadius: 60,  timeout: 4000 },
  mega:   { size: 320,  duration: 4500, liftY: -140, scalePeak: 1.45, showConfetti: true,  haptic: true,  bannerFontSize: 18, glowRadius: 120, timeout: 5500 },
};

interface GiftEvent {
  id: string;
  itemId: string;
  emoji: string;
  color: string;
  itemName: string;
  senderName: string;
  recipientName: string;
  amount: number;
  priceSP: number;
  receivedAt: number;
}

interface Props {
  roomId: string;
  /** Sahne alanının alt kenarı — animasyon buradan başlar */
  stageBottomY?: number;
  /** Kullanıcının kendi UID'si — realtime'dan gelen kendi gönderimini atlamak için
   *  (optimistic local play zaten gösterdi, çift göstermek istemiyoruz) */
  currentUserId?: string;
}

export default function RoomGiftAnimationOverlay({ roomId, stageBottomY, currentUserId }: Props) {
  const [activeAnimations, setActiveAnimations] = useState<GiftEvent[]>([]);

  // Item bilgisi cache — ID → {emoji, color, name, price}
  const itemCacheRef = useRef<Map<string, { emoji: string; color: string; name: string; price: number }>>(new Map());

  const enqueue = useCallback((evt: GiftEvent) => {
    const tier = getGiftTier(evt.priceSP);
    const cfg = TIER_CONFIG[tier];

    // Haptic feedback — normal ve mega hediyeler
    if (cfg.haptic) {
      try { Vibration.vibrate(tier === 'mega' ? [0, 60, 80, 60] : [0, 40]); } catch {}
    }

    setActiveAnimations((prev) => [...prev, evt]);
    setTimeout(() => {
      setActiveAnimations((prev) => prev.filter((e) => e.id !== evt.id));
    }, cfg.timeout);
  }, []);

  // ★ v108.7: Optimistic local play — sender RPC dönmeden anında animasyon görür.
  //   Realtime postgres_changes 200-1500ms gecikme yaratıyordu; sender artık tıklar tıklamaz görüyor.
  //   Diğer odadakiler realtime'dan gelir (her ikisini de gösterirsek deduplikasyon
  //   şart — id eşleşirse skip et).
  const seenIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('room_gift_local', (evt: GiftEvent) => {
      if (seenIdsRef.current.has(evt.id)) return;
      seenIdsRef.current.add(evt.id);
      enqueue(evt);
      // 30sn sonra id'yi unut (memory cleanup)
      setTimeout(() => seenIdsRef.current.delete(evt.id), 30000);
    });
    return () => sub.remove();
  }, [enqueue]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room_live_gifts:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_live_gifts', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const row = payload.new as any;
          const itemId: string = row.gift_id;
          const senderId: string = row.sender_id;
          const receiverId: string = row.receiver_id;

          // ★ v108.11: Sender'ın kendi gönderimini atla — optimistic local zaten oynattı,
          //   ikinci kez göstermek çift animasyon yaratırdı.
          if (currentUserId && senderId === currentUserId) return;

          // Item bilgisini cache'den veya DB'den çek
          let item = itemCacheRef.current.get(itemId);
          if (!item) {
            const { data } = await supabase
              .from('cosmetic_items')
              .select('art_emoji, art_color, name, price_sp')
              .eq('id', itemId)
              .single();
            if (data) {
              item = {
                emoji: data.art_emoji || '✨',
                color: data.art_color || '#FBBF24',
                name: data.name || 'Hediye',
                price: data.price_sp || 0,
              };
              itemCacheRef.current.set(itemId, item);
            }
          }

          // Sender + receiver adlarını çek (paralel)
          const [senderRes, receiverRes] = await Promise.all([
            supabase.from('profiles').select('display_name').eq('id', senderId).single(),
            supabase.from('profiles').select('display_name').eq('id', receiverId).single(),
          ]);

          const evtId = row.id || `${Date.now()}-${Math.random()}`;
          if (seenIdsRef.current.has(evtId)) return;
          seenIdsRef.current.add(evtId);
          setTimeout(() => seenIdsRef.current.delete(evtId), 30000);
          enqueue({
            id: evtId,
            itemId,
            emoji: item?.emoji || '✨',
            color: item?.color || '#FBBF24',
            itemName: item?.name || 'Hediye',
            senderName: senderRes.data?.display_name || 'Birisi',
            recipientName: receiverRes.data?.display_name || i18n.t('auto.room.RoomGiftAnimationOverlay.001'),
            amount: row.amount || 0,
            priceSP: item?.price || 0,
            receivedAt: Date.now(),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, enqueue]);

  if (activeAnimations.length === 0) return null;

  return (
    // ★ v108.7: zIndex 700 — RoomGiftPanel (600) üstünde; modal açıkken bile animasyon görünür
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { zIndex: 700, elevation: 700 }]}>
      {activeAnimations.map((evt, idx) => (
        <FloatingGift
          key={evt.id}
          event={evt}
          startY={stageBottomY || H * 0.55}
          stackIndex={idx}
        />
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════
// Confetti Parçacık — Mega hediyeler için
// ═══════════════════════════════════════════════════
const CONFETTI_EMOJIS = ['🎉', '✨', '⭐', '💫', '🌟', '🎊'];

function ConfettiParticle({ color, delay, side }: { color: string; delay: number; side: 'left' | 'right' }) {
  const t = useRef(new Animated.Value(0)).current;
  const emoji = CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)];
  const startX = side === 'left' ? -20 : W + 20;
  const endX = side === 'left' ? W * 0.3 + Math.random() * W * 0.4 : W * 0.3 + Math.random() * W * 0.4;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start();
  }, []);

  return (
    <Animated.Text
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: H * 0.15 + Math.random() * H * 0.3,
        left: startX,
        fontSize: 18 + Math.random() * 14,
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, endX - startX] }) },
          { translateY: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -80 - Math.random() * 60, 120] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 + Math.random() * 360}deg`] }) },
          { scale: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1.2, 0.3] }) },
        ],
        opacity: t.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

// ═══════════════════════════════════════════════════
// Glow Halo — Normal ve Mega hediyeler için
// ═══════════════════════════════════════════════════
function GlowHalo({ color, size, tier }: { color: string; size: number; tier: GiftTier }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (tier === 'mini') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.8, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [tier]);

  if (tier === 'mini') return null;
  const haloSize = size * (tier === 'mega' ? 2.6 : 2.0);

  // ★ v108.20: Premium halo — 4 katman soft fade + 2 farklı renkli gradient
  //   (tier color + altın). Keskin çizgi yok, multi-color geçişli.
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: haloSize,
        height: haloSize,
        opacity: pulse,
        top: (size - haloSize) / 2,
        left: (size - haloSize) / 2,
      }}
    >
      {/* Katman 1: en dış — soluk geniş halo */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: haloSize / 2,
        backgroundColor: color, opacity: 0.08,
      }} />
      {/* Katman 2: altın çevre — sıcak premium aura */}
      <View style={{
        position: 'absolute', top: '8%', left: '8%', right: '8%', bottom: '8%',
        borderRadius: haloSize / 2,
        backgroundColor: '#FBBF24', opacity: 0.10,
      }} />
      {/* Katman 3: orta — tier doygun */}
      <View style={{
        position: 'absolute', top: '18%', left: '18%', right: '18%', bottom: '18%',
        borderRadius: haloSize / 2,
        backgroundColor: color, opacity: 0.22,
      }} />
      {/* Katman 4: iç çekirdek — sıcak */}
      <View style={{
        position: 'absolute', top: '32%', left: '32%', right: '32%', bottom: '32%',
        borderRadius: haloSize / 2,
        backgroundColor: '#FFE082', opacity: 0.18,
      }} />
      {/* Vertical multi-color gradient — geçişli renkler (tier → altın → tier) */}
      <LinearGradient
        colors={[color + '00', color + '38', '#FBBF2440', color + '38', color + '00']}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: '12%', left: '12%', right: '12%', bottom: '12%', borderRadius: haloSize / 2 }}
      />
      {/* Diagonal cross gradient — premium parıltı çapraz */}
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.18)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: '20%', left: '20%', right: '20%', bottom: '20%', borderRadius: haloSize / 2 }}
      />
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════
// FloatingGift — Ana hediye animasyonu
// ═══════════════════════════════════════════════════
function FloatingGift({ event, startY, stackIndex }: {
  event: GiftEvent;
  startY: number;
  stackIndex: number;
}) {
  const tier = getGiftTier(event.priceSP);
  const cfg = TIER_CONFIG[tier];

  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.3)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerSlide = useRef(new Animated.Value(-40)).current;
  const bannerScale = useRef(new Animated.Value(0.8)).current;
  // Mega — arka plan dim overlay
  const bgDim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = stackIndex * 300;
    const holdDuration = cfg.duration - 800;

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        // Hediye yükselmesi
        Animated.timing(translateY, {
          toValue: cfg.liftY,
          duration: cfg.duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Fade in → hold → fade out
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.delay(holdDuration),
          Animated.timing(opacity, { toValue: 0, duration: 550, useNativeDriver: true }),
        ]),
        // Scale bounce — daha dramatik
        Animated.sequence([
          Animated.spring(scale, {
            toValue: cfg.scalePeak,
            damping: tier === 'mega' ? 10 : 14,
            stiffness: tier === 'mega' ? 120 : 180,
            useNativeDriver: true,
          }),
          Animated.delay(holdDuration - 400),
          Animated.timing(scale, { toValue: 0.5, duration: 500, useNativeDriver: true }),
        ]),
        // Banner — daha gösterişli giriş
        Animated.sequence([
          Animated.delay(100),
          Animated.parallel([
            Animated.timing(bannerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.spring(bannerSlide, { toValue: 0, damping: 16, stiffness: 160, useNativeDriver: true }),
            Animated.spring(bannerScale, { toValue: 1, damping: 16, stiffness: 160, useNativeDriver: true }),
          ]),
          Animated.delay(holdDuration),
          Animated.parallel([
            Animated.timing(bannerOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.timing(bannerSlide, { toValue: -30, duration: 400, useNativeDriver: true }),
          ]),
        ]),
        // Mega: arka plan dim
        ...(tier === 'mega' ? [
          Animated.sequence([
            Animated.timing(bgDim, { toValue: 0.35, duration: 300, useNativeDriver: true }),
            Animated.delay(holdDuration + 200),
            Animated.timing(bgDim, { toValue: 0, duration: 500, useNativeDriver: true }),
          ]),
        ] : []),
      ]),
    ]).start();
  }, [stackIndex, tier]);

  // Render önceliği: 1) Lottie, 2) Item3DArt PNG, 3) emoji
  const useLottie = hasGiftLottie(event.itemId) && !!LottieView;
  const useIllustrationFallback = !useLottie && hasIllustration(event.itemId);

  // ★ v108.10: Hediye yerleşimi — sahne avatarlarının ALTINDA, banner ÜSTÜNDE
  //   görünür. Avatar bölgesine (üst %50) girmesin diye startY = H*0.55, liftY küçük.
  const offsetX = 0;
  const effectiveStartY = tier === 'mega' ? H * 0.5 - cfg.size / 2 : H * 0.55 - cfg.size / 2;

  return (
    <>
      {/* Mega: Arka plan karartma */}
      {tier === 'mega' && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: bgDim }]}
        />
      )}

      {/* Banner: "Sender → Recipient · Item Name" — ★ v108.9: Alt kısımda */}
      <Animated.View
        style={[
          styles.banner,
          {
            opacity: bannerOpacity,
            transform: [{ translateY: bannerSlide }, { scale: bannerScale }],
            bottom: tier === 'mega' ? H * 0.2 : H * 0.18 + stackIndex * 44,
          },
        ]}
      >
        {/* ★ v108.20: Tier rengiyle 3-stop sıcak gradient — geçişli, tek renk değil */}
        <LinearGradient
          colors={[event.color + '00', event.color + '50', '#FFE08220', event.color + '00']}
          locations={[0, 0.3, 0.6, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 999 }]}
        />
        <GlowView style={[
          styles.bannerInner,
          tier === 'mega' && styles.bannerInnerMega,
        ]}>
          {/* Emoji badge */}
          <View style={[styles.bannerEmoji, { backgroundColor: event.color + '25' }]}>
            <Text style={{ fontSize: tier === 'mega' ? 18 : 14 }}>{event.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerNames, { fontSize: cfg.bannerFontSize }]} numberOfLines={1}>
              <Text style={{ color: event.color, fontWeight: '900' }}>{event.senderName}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)' }}>{'  →  '}</Text>
              <Text style={{ color: '#FFF', fontWeight: '800' }}>{event.recipientName}</Text>
            </Text>
            <Text style={[styles.bannerItemName, { color: event.color }]} numberOfLines={1}>
              {event.itemName}
              {event.priceSP > 0 && (
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{`  · ${event.priceSP} SP`}</Text>
              )}
            </Text>
          </View>
        </GlowView>
      </Animated.View>

      {/* Yükselen hediye görseli */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: W / 2 - cfg.size / 2 + offsetX,
          top: effectiveStartY,
          width: cfg.size,
          height: cfg.size,
          opacity,
          transform: [{ translateY }, { scale }],
        }}
      >
        {/* Glow Halo — Normal ve Mega */}
        <GlowHalo color={event.color} size={cfg.size} tier={tier} />

        {/* Ana görsel */}
        {useLottie ? (
          <LottieView
            source={getGiftLottie(event.itemId)}
            autoPlay
            loop
            style={{ width: '100%', height: '100%' }}
          />
        ) : useIllustrationFallback ? (
          <Item3DArt itemId={event.itemId} size={cfg.size} color={event.color} staticMode={false} />
        ) : (
          <Text
            style={{
              fontSize: cfg.size * 0.7,
              textAlign: 'center',
              lineHeight: cfg.size,
              color: event.color,
              textShadowColor: event.color,
              textShadowRadius: tier === 'mega' ? 50 : 30,
              textShadowOffset: { width: 0, height: 0 },
              ...Platform.select({
                ios: { shadowColor: event.color, shadowOpacity: 1, shadowRadius: tier === 'mega' ? 40 : 22, shadowOffset: { width: 0, height: 0 } },
                android: {},
              }),
            }}
          >
            {event.emoji}
          </Text>
        )}
      </Animated.View>

      {/* Mega: Confetti parçacıkları */}
      {cfg.showConfetti && (
        <>
          {Array.from({ length: 8 }).map((_, i) => (
            <ConfettiParticle
              key={`confetti-${event.id}-${i}`}
              color={event.color}
              delay={200 + i * 120}
              side={i % 2 === 0 ? 'left' : 'right'}
            />
          ))}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 10, right: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 101,
  },
  // ★ v110.14: Banner rafine — koyu cam efekti, ince altın hairline, daha şık
  bannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(8,12,22,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  // ★ v110.14: Mega — altın hairline + daha kalın padding + güçlü glow
  bannerInnerMega: {
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,224,130,0.50)',
    shadowOpacity: 0.85,
    shadowRadius: 28,
  },
  bannerEmoji: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bannerNames: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bannerItemName: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
