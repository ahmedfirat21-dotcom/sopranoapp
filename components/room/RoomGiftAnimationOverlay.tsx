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

// ★ v1.7.13 (18 May 2026): Skia — halo + confetti + emoji shadow için.
//   Mevcut Skia migration pattern'i (CosmeticParticleEffect, GlowView, SkiaShadow)
//   ile birebir uyumlu: lazy require + null fallback. Native modül yoksa eski
//   LinearGradient katmanlarına düşer.
let SkiaMod: any = null;
try {
  SkiaMod = require('@shopify/react-native-skia');
} catch { /* sessiz fallback */ }

const { width: W, height: H } = Dimensions.get('window');

// ─── Tier Eşikleri ───
type GiftTier = 'mini' | 'normal' | 'mega';
function getGiftTier(priceSP: number): GiftTier {
  if (priceSP >= 250) return 'mega';
  if (priceSP >= 65) return 'normal';
  return 'mini';
}

// ★ v1.7.13 (18 May 2026): Kullanıcı raporu — "mini hediye neredeyse görünmüyor,
//   süre kısa, banner küçük, Android shadow yok, FPS drop". Skia migration +
//   parametre revize ile çözüldü.
//
//   DEĞİŞİKLİK ÖZETİ:
//   - mini: 100→160 px, scalePeak 1.0→1.18, halo eklendi (40), haptic eklendi,
//     süre 2.2→3.5s, banner font 11→14
//   - normal: 200→230 px, scalePeak 1.20→1.30, süre 3.2→4.8s, banner 14→17
//   - mega: 320→340 px, scalePeak 1.45→1.55, süre 4.5→6.5s, banner 18→22
//   - mini için mini confetti (4 partikül) eklendi → tier farkı korunur
//   - Tüm timeout'lar +%50 — animasyon ekranda kalma süresi
// ★ v1.7.13.33 (19 May 2026): TikTok-style sadeleştirme.
//   Kullanıcı: "sadece lottie animasyonu ve altta succes ekranı tarzı banner".
//   Confetti, halo, bg-dim KAPATILDI. Sadece gift visual + alta clean banner.
const TIER_CONFIG: Record<GiftTier, {
  size: number; duration: number; liftY: number;
  scalePeak: number; showConfetti: boolean; confettiCount: number;
  haptic: boolean; bannerFontSize: number; glowRadius: number; timeout: number;
}> = {
  mini:   { size: 160, duration: 3500, liftY: -60,  scalePeak: 1.18, showConfetti: false, confettiCount: 0,  haptic: true, bannerFontSize: 13, glowRadius: 40,  timeout: 4200 },
  normal: { size: 230, duration: 4800, liftY: -110, scalePeak: 1.30, showConfetti: false, confettiCount: 0,  haptic: true, bannerFontSize: 15, glowRadius: 90,  timeout: 5800 },
  mega:   { size: 340, duration: 6500, liftY: -150, scalePeak: 1.55, showConfetti: false, confettiCount: 0,  haptic: true, bannerFontSize: 17, glowRadius: 160, timeout: 7500 },
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

    // ★ v1.7.13: Haptic — mini tek kısa titreşim, normal orta, mega çift güçlü
    if (cfg.haptic) {
      try {
        if (tier === 'mega') Vibration.vibrate([0, 60, 80, 60]);
        else if (tier === 'normal') Vibration.vibrate([0, 40]);
        else Vibration.vibrate(25); // mini — tek kısa puls
      } catch {}
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
// Glow Halo — Skia Canvas + RadialGradient (cross-platform)
// ═══════════════════════════════════════════════════
// ★ v1.7.13: Önceki 4 katman LinearGradient + 2 absolute View = ağır GPU yükü
//   ve Android'de keskin kırpılma. Skia Canvas tek seferde RadialGradient çiziyor,
//   blur native CPU katmanında, FPS daha stabil. Skia yoksa eski fallback'e düşer.
function GlowHalo({ color, size, tier }: { color: string; size: number; tier: GiftTier }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: tier === 'mega' ? 700 : 900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(pulse, { toValue: 0.35, duration: tier === 'mega' ? 700 : 900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [tier]);

  // Mini için de halo göster (eskiden hiç yoktu)
  const haloSize = size * (tier === 'mega' ? 2.6 : tier === 'normal' ? 2.0 : 1.6);

  // ─── Skia varsa: tek Canvas + RadialGradient + altın iç çekirdek ───
  if (SkiaMod) {
    const { Canvas, Circle, RadialGradient, vec, Group, BlurMask } = SkiaMod;
    const cx = haloSize / 2;
    const cy = haloSize / 2;
    const outerR = haloSize / 2;
    const innerR = haloSize / 4;
    // Tier'a göre opaklık katsayıları (mini soluk, mega doygun)
    const outerOpacity = tier === 'mega' ? 0.55 : tier === 'normal' ? 0.45 : 0.30;
    const innerOpacity = tier === 'mega' ? 0.45 : tier === 'normal' ? 0.35 : 0.22;
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
        <Canvas style={{ flex: 1 }}>
          <Group>
            {/* Dış halo — tier renginde geniş radial fade */}
            <Circle cx={cx} cy={cy} r={outerR} opacity={outerOpacity}>
              <RadialGradient
                c={vec(cx, cy)}
                r={outerR}
                colors={[color, color + '60', color + '00']}
              />
              <BlurMask blur={tier === 'mega' ? 24 : tier === 'normal' ? 16 : 10} style="normal" />
            </Circle>
            {/* İç çekirdek — sıcak altın (#FFE082) parıltı */}
            <Circle cx={cx} cy={cy} r={innerR} opacity={innerOpacity}>
              <RadialGradient
                c={vec(cx, cy)}
                r={innerR}
                colors={['#FFE082', '#FBBF24', '#FBBF2400']}
              />
              <BlurMask blur={tier === 'mega' ? 14 : 8} style="normal" />
            </Circle>
          </Group>
        </Canvas>
      </Animated.View>
    );
  }

  // ─── Skia yoksa: eski multi-layer fallback (mini için minimal) ───
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
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: haloSize / 2,
        backgroundColor: color, opacity: 0.10,
      }} />
      <View style={{
        position: 'absolute', top: '20%', left: '20%', right: '20%', bottom: '20%',
        borderRadius: haloSize / 2,
        backgroundColor: '#FBBF24', opacity: 0.14,
      }} />
      <View style={{
        position: 'absolute', top: '36%', left: '36%', right: '36%', bottom: '36%',
        borderRadius: haloSize / 2,
        backgroundColor: '#FFE082', opacity: 0.20,
      }} />
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

      {/* ★ v1.7.13.33 (19 May 2026): TikTok-style banner ALT KISIMDA, gift altında.
          Yapı: "Burak DENİZ → Beren Arancak'a 15 SP Konfeti gönderdi"
          Tek satır doğal Türkçe cümle. Pill bg koyu cam + ince hairline,
          fancy gradient KALDIRILDI (kullanıcı sadeleştirme istedi). */}
      <Animated.View
        style={[
          styles.banner,
          {
            opacity: bannerOpacity,
            transform: [{ translateY: bannerSlide }, { scale: bannerScale }],
            // Gift center'in ALTINDA — gift effectiveStartY + liftY + size/2 sonrası
            top: H * 0.62 + stackIndex * 56,
          },
        ]}
      >
        <View style={[styles.bannerInner, tier === 'mega' && styles.bannerInnerMega]}>
          <Text style={[styles.bannerSentence, { fontSize: cfg.bannerFontSize }]} numberOfLines={2}>
            <Text style={{ color: event.color, fontWeight: '900' }}>{event.senderName}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)' }}>{' '}{'→'}{' '}</Text>
            <Text style={{ color: '#FFF', fontWeight: '800' }}>{event.recipientName}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)' }}>{'\'a '}</Text>
            {event.priceSP > 0 && (
              <Text style={{ color: '#FBBF24', fontWeight: '900' }}>{`${event.priceSP} SP `}</Text>
            )}
            <Text style={{ color: event.color, fontWeight: '900' }}>{event.itemName}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)' }}>{' gönderdi'}</Text>
          </Text>
        </View>
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
        {/* ★ v1.7.13.33: GlowHalo KAPATILDI — kullanıcı sadeleştirme istedi.
            Sadece Lottie/3D/emoji görseli kalır, halka/parıltı yok. */}
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
          <>
            {/* ★ v1.7.13: Skia BlurMask glow — Android'de de gerçek renkli halo.
                Eskiden ios: shadow*, android: {} idi → Android emojisi sade görünüyordu.
                Şimdi emoji'nin arkasında Skia ile çizilen renkli soft circle var. */}
            {SkiaMod && (() => {
              const { Canvas, Circle, BlurMask } = SkiaMod;
              const glowSize = cfg.size * 0.9;
              const blurAmount = tier === 'mega' ? 28 : tier === 'normal' ? 20 : 14;
              return (
                <View pointerEvents="none" style={{
                  position: 'absolute',
                  top: (cfg.size - glowSize) / 2,
                  left: (cfg.size - glowSize) / 2,
                  width: glowSize,
                  height: glowSize,
                }}>
                  <Canvas style={{ flex: 1 }}>
                    <Circle
                      cx={glowSize / 2}
                      cy={glowSize / 2}
                      r={glowSize / 2.5}
                      color={event.color}
                      opacity={tier === 'mega' ? 0.45 : tier === 'normal' ? 0.35 : 0.22}
                    >
                      <BlurMask blur={blurAmount} style="normal" />
                    </Circle>
                  </Canvas>
                </View>
              );
            })()}
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
          </>
        )}
      </Animated.View>

      {/* ★ v1.7.13: Confetti her tier'da, sayı parametrize (mini 4 / normal 6 / mega 12) */}
      {cfg.showConfetti && (
        <>
          {Array.from({ length: cfg.confettiCount }).map((_, i) => (
            <ConfettiParticle
              key={`confetti-${event.id}-${i}`}
              color={event.color}
              delay={200 + i * (tier === 'mega' ? 100 : 150)}
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
    left: 16, right: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 101,
  },
  // ★ v1.7.13.33: Tek satır TikTok-style — koyu cam pill, ortalı.
  bannerInner: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(8,12,22,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  bannerInnerMega: {
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,224,130,0.45)',
    shadowColor: '#FBBF24',
    shadowOpacity: 0.55,
    shadowRadius: 22,
  },
  bannerSentence: {
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 20,
  },
});
