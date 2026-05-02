// SopranoChat — SP Gönderme Başarı Modalı v4 (1 May 2026)
// ═══════════════════════════════════════════════════════════════════
// ★ v92.5: DiscoverWelcomeSheet pattern'iyle baştan yazıldı. Tüm karmaşık
// katmanlar (sunburst, volumetric halo, light burst, anamorphic flare,
// shimmer sweep, ring expand, ground shadow, lens flare, sparkles, gold
// shower, vs.) KALDIRILDI. Sade ama zengin: WebView içinde rich gem +
// 3-stop diagonal gradient bg + spring entrance + amount + recipient.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, Modal, Dimensions,
  PanResponder, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import SPHexagonIcon from '../SPHexagonIcon';
import { getSPAmountTier, type SPAmountTier } from '../../constants/spAmountTier';
import { getAvatarSource } from '../../constants/avatars';

const { width: W, height: H } = Dimensions.get('window');

// ── Tier renkleri — DiscoverWelcomeSheet stiliyle uyumlu (3-stop diagonal bg)
type Tier = SPAmountTier;
const getTier = getSPAmountTier;

interface TierConfig {
  bgFrom: string;          // diagonal gradient üst-sol
  bgTo: string;            // diagonal gradient orta
  amountColor: string;     // rakam rengi
  amountShadow: string;    // rakam shadow
  amountFont: number;
  label: string | null;
  labelColor: string;
}

const TIER_CONFIG: Record<Tier, TierConfig> = {
  basic: {
    bgFrom: '#042F2E', bgTo: '#0A0F1A',
    amountColor: '#5EEAD4', amountShadow: 'rgba(20,184,166,0.55)',
    amountFont: 64,
    label: null, labelColor: '#14B8A6',
  },
  premium: {
    bgFrom: '#3B2507', bgTo: '#0A0F1A',
    amountColor: '#FFE082', amountShadow: 'rgba(251,191,36,0.65)',
    amountFont: 70,
    label: 'PREMIUM', labelColor: '#FBBF24',
  },
  elite: {
    bgFrom: '#4A0E2E', bgTo: '#0A0F1A',
    amountColor: '#FCE7F3', amountShadow: 'rgba(244,114,182,0.75)',
    amountFont: 76,
    label: 'ELITE', labelColor: '#F472B6',
  },
  legendary: {
    bgFrom: '#2E1065', bgTo: '#0A0F1A',
    amountColor: '#EDE9FE', amountShadow: 'rgba(167,139,250,0.85)',
    amountFont: 82,
    label: 'LEGENDARY', labelColor: '#A78BFA',
  },
};

const HEX_SIZE = 240;

interface Props {
  visible: boolean;
  amount: number;
  recipientName: string;
  /** ★ v92.6 (1 May 2026): Alıcı avatar URL'i — hexagon altında küçük yuvarlak avatar gösterilir */
  recipientAvatar?: string;
  onClose: () => void;
}

export default function SPSentSuccessModal({ visible, amount, recipientName, recipientAvatar, onClose }: Props) {
  const tier = useMemo(() => getTier(amount), [amount]);
  const cfg = TIER_CONFIG[tier];

  // ── Animated values ──
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // ★ v92.6: Hero gem — yavaş yakınlaşan zoom-in fade (scale 0.4→1, 1300ms)
  const heroAnim = useRef(new Animated.Value(0)).current;
  // ★ Title (amount) — stagger fade-in
  const titleAnim = useRef(new Animated.Value(0)).current;
  // ★ Body (recipient + avatar) — stagger fade-in (daha geç)
  const bodyAnim = useRef(new Animated.Value(0)).current;
  // ★ Label pill — sade fade
  const labelAnim = useRef(new Animated.Value(0)).current;
  // ★ v92.6 (1 May 2026): Exit animation — sahne sona doğru hızlı akıcı fade-out.
  //   Auto-dismiss'ten önce sahne 1→0 opacity + scale 1→1.08 hızla genişler ve kaybolur.
  const exitAnim = useRef(new Animated.Value(0)).current;

  // ★ Swipe-to-dismiss
  const panY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.3,
      onPanResponderMove: (_, g) => { if (g.dy > 0) panY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(panY, { toValue: H, duration: 200, useNativeDriver: true }).start(() => {
            panY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (!visible) return;

    // Reset
    backdropOpacity.setValue(0);
    heroAnim.setValue(0);
    titleAnim.setValue(0);
    bodyAnim.setValue(0);
    labelAnim.setValue(0);
    exitAnim.setValue(0);
    panY.setValue(0);

    // ★ v92.6 ENTRANCE: yavaş yakınlaşan zoom-in (scale 0.4→1, 1300ms cubic).
    //   Hexagon uzaktan yaklaşan mücevher gibi büyüyerek belirir, sonra metin/avatar
    //   stagger ile takip eder.
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 480, useNativeDriver: true }),
      // Hero — yavaş yakınlaşan zoom-in (0.4→1 scale, fade)
      Animated.timing(heroAnim, { toValue: 1, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      // Title (amount) — peak zoom anında belirir
      Animated.sequence([
        Animated.delay(550),
        Animated.timing(titleAnim, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      // Body (recipient + avatar) — geç stagger
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(bodyAnim, { toValue: 1, duration: 640, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      // Label pill — en son
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(labelAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
      ]),
    ]).start();

    // ★ v92.6: Auto-dismiss + akıcı fade-out exit animation.
    //   ~5800ms izleme + 350ms hızlı fade-out → toplam ~6150ms görünür.
    //   Exit anim: scale 1→1.08 hafif genişler + opacity 1→0 hızla söner.
    const HOLD_MS = 5800;
    const FADE_OUT_MS = 350;
    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(exitAnim, { toValue: 1, duration: FADE_OUT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: FADE_OUT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => onClose());
    }, HOLD_MS);

    return () => { clearTimeout(exitTimer); };
  }, [visible, amount, tier]);

  if (!visible) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      {/* ★ DiscoverWelcomeSheet bg pattern: tier'a göre 3-stop diagonal gradient.
          Tek katman — banding'i kıracak kadar koyulaşma + temiz görünüm. */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: backdropOpacity }]} pointerEvents="none">
        <LinearGradient
          colors={[cfg.bgFrom, cfg.bgTo, '#050811']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <Pressable style={s.pressArea} onPress={onClose} {...panResponder.panHandlers}>
        {/* ★ v92.6: Sahne — exitAnim ile akıcı fade-out (opacity 1→0 + scale 1→1.08) */}
        <Animated.View
          style={[
            s.center,
            {
              opacity: exitAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                { translateY: panY },
                { scale: exitAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
              ],
            },
          ]}
        >

          {/* ★ Hero gem — rich=true ile DiscoverWelcomeSheet kalitesinde.
              ★ v92.6: yavaş yakınlaşan zoom-in (scale 0.4→1, 1300ms) — uzaktan
              yaklaşan mücevher hissi. */}
          <Animated.View
            style={[
              s.heroWrap,
              {
                opacity: heroAnim,
                transform: [
                  { scale: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                ],
              },
            ]}
          >
            <SPHexagonIcon size={HEX_SIZE} tier={tier as any} rich />
          </Animated.View>

          {/* ★ Amount — büyük rakam, tier renginde, stagger fade+slide */}
          <Animated.View
            style={{
              opacity: titleAnim,
              transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            }}
          >
            <Text
              style={[
                s.amountText,
                { fontSize: cfg.amountFont, color: cfg.amountColor, textShadowColor: cfg.amountShadow },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {amount.toLocaleString('tr-TR')}
            </Text>
          </Animated.View>

          {/* ★ Tier label — sade pill (premium+) */}
          {cfg.label && (
            <Animated.View
              style={[
                s.labelPill,
                {
                  opacity: labelAnim,
                  borderColor: cfg.labelColor + '66',
                  backgroundColor: cfg.labelColor + '1A',
                },
              ]}
            >
              <Text style={[s.labelText, { color: cfg.labelColor }]}>{cfg.label}</Text>
            </Animated.View>
          )}

          {/* ★ v92.6: Recipient row — avatar + isim + "'e gönderildi" yatay diziliş.
              Body stagger fade+slide ile birlikte. Avatar tier rengi border ile öne çıkar. */}
          <Animated.View
            style={[
              s.recipientRow,
              {
                opacity: bodyAnim,
                transform: [{ translateY: bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                marginTop: cfg.label ? 18 : 22,
              },
            ]}
          >
            {recipientAvatar ? (
              <Image
                source={getAvatarSource(recipientAvatar)}
                style={[s.recipientAvatar, { borderColor: cfg.amountColor + 'AA' }]}
              />
            ) : null}
            <Text style={s.recipientText} numberOfLines={1}>
              <Text style={[s.recipientName, { color: cfg.amountColor }]}>{recipientName}</Text>
              <Text>{'’a gönderildi'}</Text>
            </Text>
          </Animated.View>

          {/* Hint — alta dokunmak için */}
          <Animated.Text style={[s.hint, { opacity: bodyAnim }]}>
            Kapatmak için dokun
          </Animated.Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  pressArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  center: {
    alignItems: 'center', justifyContent: 'center',
  },
  // ★ Hero gem — 240px DiscoverWelcomeSheet kalitesi rich hexagon
  heroWrap: {
    width: HEX_SIZE, height: HEX_SIZE,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  amountText: {
    fontWeight: '900',
    letterSpacing: -2,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
  },
  labelPill: {
    marginTop: 14,
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 12, borderWidth: 1,
  },
  labelText: {
    fontSize: 11, fontWeight: '900', letterSpacing: 2.4,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // ★ v92.6: Recipient row — avatar + isim yatay
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    maxWidth: W - 32,
  },
  recipientAvatar: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 2,
  },
  recipientText: {
    fontSize: 16, color: 'rgba(255,255,255,0.82)', fontWeight: '500',
    textAlign: 'left',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  recipientName: {
    fontWeight: '800',
  },
  hint: {
    position: 'absolute', bottom: -120, alignSelf: 'center',
    fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '500',
    letterSpacing: 0.5,
  },
});
