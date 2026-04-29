/**
 * SopranoChat — DonationAlert
 * ═══════════════════════════════════════════════════
 * Oda içindeki bağış bildirimini TÜM kullanıcılara animasyonlu, parıltılı,
 * premium bir banner olarak gösterir.
 * 
 * Kullanım:
 *   ref.current.show({ senderName, amount })
 * 
 * Ekranın ortasında belirip 4sn sonra kaybolur.
 * Altın parıltılar, kalp partikülleri ve gradient animasyonlarla
 * "X kişi Y SP bağış yaptı!" mesajını gösterir.
 */
import React, { useRef, useState, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// ★ 2026-04-29: SP miktarına göre tier paleti — diğer SP ekranlarıyla tutarlı.
import { getSPAmountTier, SP_TIER_VISUAL, SP_TIER_EMOJIS } from '../../constants/spAmountTier';

const { width: W, height: H } = Dimensions.get('window');

export interface DonationAlertData {
  senderName: string;
  amount: number;
  recipientName?: string;
  senderAvatar?: string;
}

export interface DonationAlertRef {
  show: (data: DonationAlertData) => void;
}

// ── Parıltı Partikülleri ──
interface Particle {
  id: number;
  anim: Animated.Value;
  x: number;
  y: number;
  emoji: string;
  delay: number;
}

let particleCounter = 0;

const DonationAlert = forwardRef<DonationAlertRef>((_, ref) => {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<DonationAlertData | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Ana banner animasyonları
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const heartBeat = useRef(new Animated.Value(1)).current;
  // ★ Loop ve timer ref'leri — unmount ve rapid-show durumlarında cleanup için
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const shimmerLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const heartBeatLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const particleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tüm loopları ve timer'ları temizle
  const stopAll = useCallback(() => {
    glowLoopRef.current?.stop();
    shimmerLoopRef.current?.stop();
    heartBeatLoopRef.current?.stop();
    if (dismissTimerRef.current) { clearTimeout(dismissTimerRef.current); dismissTimerRef.current = null; }
    if (particleTimerRef.current) { clearTimeout(particleTimerRef.current); particleTimerRef.current = null; }
  }, []);

  useEffect(() => () => stopAll(), []);

  const spawnParticles = useCallback((amount: number) => {
    // ★ Tier'a göre emoji havuzu + partikül sayısı (basic 8 → legendary 22)
    const tier = getSPAmountTier(amount);
    const tv = SP_TIER_VISUAL[tier];
    const EMOJIS = SP_TIER_EMOJIS[tier];
    const newParticles: Particle[] = [];
    for (let i = 0; i < tv.particleCount; i++) {
      const id = ++particleCounter;
      const anim = new Animated.Value(0);
      newParticles.push({
        id,
        anim,
        x: Math.random() * (W - 60) + 30,
        y: Math.random() * 40,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        delay: Math.random() * 600,
      });
    }
    setParticles(newParticles);

    // Her partiküle ayrı animasyon
    newParticles.forEach(p => {
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(p.anim, {
          toValue: 1,
          duration: 1800 + Math.random() * 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    });

    // 4sn sonra temizle
    if (particleTimerRef.current) clearTimeout(particleTimerRef.current);
    particleTimerRef.current = setTimeout(() => setParticles([]), 4500);
  }, []);

  const show = useCallback((alertData: DonationAlertData) => {
    // Önceki gösterimi varsa temizle — hızlı ardışık bağışlarda üstüne yazılmasın
    stopAll();
    glowAnim.stopAnimation();
    shimmerAnim.stopAnimation();
    heartBeat.stopAnimation();

    setData(alertData);
    setVisible(true);

    // Reset
    slideAnim.setValue(60);
    opacityAnim.setValue(0);
    scaleAnim.setValue(0.3);
    glowAnim.setValue(0);
    shimmerAnim.setValue(0);
    heartBeat.setValue(1);

    // ── 1. Giriş animasyonu ──
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, damping: 12, stiffness: 120, mass: 0.8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, damping: 8, stiffness: 180, mass: 0.6, useNativeDriver: true }),
    ]).start(() => {
      // ── 2. Glow pulse ──
      glowLoopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      glowLoopRef.current.start();

      // ── 3. Shimmer sweep ──
      shimmerLoopRef.current = Animated.loop(
        Animated.timing(shimmerAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
      );
      shimmerLoopRef.current.start();

      // ── 4. Kalp atışı ──
      heartBeatLoopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(heartBeat, { toValue: 1.2, duration: 300, useNativeDriver: true }),
        Animated.timing(heartBeat, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(500),
      ]));
      heartBeatLoopRef.current.start();
    });

    // Partiküller — tier'a göre sayı/emoji havuzu
    spawnParticles(alertData.amount);

    // ── 5. Çıkış animasyonu (4sn sonra) — ref ile takip et, üst üste çağrı güvenli ──
    dismissTimerRef.current = setTimeout(() => {
      stopAll();
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 60, duration: 500, easing: Easing.in(Easing.back(1.5)), useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.5, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        setVisible(false);
        setData(null);
      });
    }, 4000);
  }, [slideAnim, opacityAnim, scaleAnim, glowAnim, shimmerAnim, heartBeat, spawnParticles, stopAll]);

  useImperativeHandle(ref, () => ({ show }), [show]);

  if (!visible || !data) return null;

  // ── 2026-04-29: spAmountTier ile birleşik tier paleti (diğer SP ekranlarıyla aynı eşikler)
  //    basic <50 / premium ≥50 / elite ≥250 / legendary ≥1000
  const tier = getSPAmountTier(data.amount);
  const tv = SP_TIER_VISUAL[tier];
  const isPrestige = tier !== 'basic';   // Premium ve üstü için 👑 rozet
  // Heart gradient — tier'a göre 3-stop (glow ana renk, partikül paletinden ek 2 stop)
  const grad0 = tv.glow;
  const grad1 = tv.particleColors[1] || tv.glow;
  const grad2 = tv.particleColors[2] || tv.particleColors[0] || tv.glow;
  const gradColors: [string, string, string] = [grad0, grad1, grad2];
  const borderColor = tv.glow + '99';
  const shadowColor = tv.glow;
  const amountColor = tv.glow;

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-W, W],
  });

  return (
    <View style={s.container} pointerEvents="none">
      {/* ── Parıltı Partikülleri ── */}
      {particles.map(p => {
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, -80 - p.y],
        });
        const opacity = p.anim.interpolate({
          inputRange: [0, 0.1, 0.6, 1],
          outputRange: [0, 1, 0.8, 0],
        });
        const scale = p.anim.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0.3, 1.2, 0.4],
        });
        const rotate = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${Math.random() > 0.5 ? '' : '-'}${120 + Math.random() * 180}deg`],
        });
        return (
          <Animated.Text
            key={p.id}
            style={{
              position: 'absolute',
              left: p.x,
              top: 20,
              fontSize: 16 + Math.random() * 10,
              opacity,
              transform: [{ translateY }, { scale }, { rotate }],
            }}
          >
            {p.emoji}
          </Animated.Text>
        );
      })}

      {/* ── Ana Banner ── */}
      <Animated.View
        style={[
          s.banner,
          {
            borderColor,
            shadowColor,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim },
            ],
            opacity: opacityAnim,
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(15,23,42,0.95)', 'rgba(30,41,59,0.95)', 'rgba(15,23,42,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.bannerBg}
        >
          {/* Shimmer overlay */}
          <Animated.View style={[s.shimmer, { transform: [{ translateX: shimmerTranslateX }] }]}>
            <LinearGradient
              colors={['transparent', `${amountColor}15`, `${amountColor}30`, `${amountColor}15`, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: 120, height: '100%' }}
            />
          </Animated.View>

          {/* İçerik */}
          <View style={s.content}>
            {/* Kalp ikonu (animasyonlu) */}
            <Animated.View style={[s.heartWrap, { transform: [{ scale: heartBeat }] }]}>
              <LinearGradient
                colors={gradColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.heartGrad}
              >
                <Ionicons name="heart" size={20} color="#FFF" />
              </LinearGradient>
              {/* Glow ring */}
              <Animated.View style={[s.glowRing, {
                borderColor: amountColor,
                opacity: glowAnim,
              }]} />
            </Animated.View>

            {/* Metin */}
            <View style={s.textWrap}>
              <View style={s.nameRow}>
                <Text style={s.senderName} numberOfLines={1}>{data.senderName}</Text>
                {data.recipientName ? (
                  <>
                    <Ionicons name="arrow-forward" size={11} color="rgba(255,255,255,0.4)" style={{ marginHorizontal: 4 }} />
                    <Text style={s.recipientName} numberOfLines={1}>{data.recipientName}</Text>
                  </>
                ) : (
                  <Ionicons name="sparkles" size={12} color={amountColor} style={{ marginLeft: 4 }} />
                )}
              </View>
              <View style={s.amountRow}>
                <Text style={s.donationText}>{data.recipientName ? '' : 'bağış yaptı '}</Text>
                <View style={[s.amountPill, { backgroundColor: `${amountColor}20`, borderColor: `${amountColor}40` }]}>
                  <Ionicons name="diamond" size={11} color={amountColor} />
                  <Text style={[s.amountText, { color: amountColor }]}>{data.amount} SP bağış</Text>
                </View>
              </View>
            </View>

            {/* Premium ve üstü için 👑 rozet — tier 'basic' değilse görünür */}
            {isPrestige && (
              <Animated.View style={[s.megaBadge, { opacity: glowAnim }]}>
                <Text style={s.megaEmoji}>{tier === 'legendary' ? '👑' : tier === 'elite' ? '💎' : '⭐'}</Text>
              </Animated.View>
            )}
          </View>

          {/* Alt çizgi gradient */}
          <LinearGradient
            colors={['transparent', gradColors[0], gradColors[1], gradColors[2], 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.bottomLine}
          />
        </LinearGradient>
      </Animated.View>
    </View>
  );
});

DonationAlert.displayName = 'DonationAlert';
export default DonationAlert;

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════
const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
    elevation: 9998,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: H * 0.45,
  },
  banner: {
    width: W - 32,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    // Shadow
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
  },
  bannerBg: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 120,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heartWrap: {
    position: 'relative',
  },
  heartGrad: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 25,
    borderWidth: 2,
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  senderName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F1F5F9',
    maxWidth: '45%',
    letterSpacing: -0.3,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#14B8A6',
    maxWidth: '40%',
    letterSpacing: -0.3,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  donationText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  amountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  amountText: {
    fontSize: 13,
    fontWeight: '800',
  },
  megaBadge: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  megaEmoji: {
    fontSize: 24,
  },
  bottomLine: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 2,
    borderRadius: 1,
  },
});
