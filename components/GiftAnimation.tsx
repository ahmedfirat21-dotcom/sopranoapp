import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
let LottieView: any = null;
try { LottieView = require('lottie-react-native').default; } catch (e) { /* native module unavailable */ }
let Haptics: any = { impactAsync: async () => {}, ImpactFeedbackStyle: { Light: 0, Medium: 1, Heavy: 2 } };
try { Haptics = require('expo-haptics'); } catch (e) { /* haptics unavailable */ }
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';
import ParticleEffect from './ParticleEffect';

const { width, height } = Dimensions.get('window');

export interface GiftAnimationProps {
  giftId: string;
  senderName: string;
  targetName?: string;
  giftName: string;
  visible: boolean;
  onComplete: () => void;
  tier: 'basic' | 'premium' | 'legendary';
}

const GIFT_CONFIG: Record<string, { color: string; particle: any; emoji: string }> = {
  // Basic
  rose: { color: '#FF6B8A', particle: 'hearts', emoji: '🌹' },
  tea: { color: '#A0522D', particle: 'sparkle', emoji: '☕' },
  ring: { color: '#FFD700', particle: 'sparkle', emoji: '💍' },
  icecream: { color: '#FFB6C1', particle: 'sparkle', emoji: '🍦' },
  chocolate: { color: '#8B4513', particle: 'sparkle', emoji: '🍫' },
  cookie: { color: '#DEB887', particle: 'sparkle', emoji: '🍪' },
  lollipop: { color: '#FF69B4', particle: 'sparkle', emoji: '🍭' },
  balloon: { color: '#FF4500', particle: 'confetti', emoji: '🎈' },
  kiss: { color: '#FF1493', particle: 'hearts', emoji: '💋' },
  sunglasses: { color: '#1E90FF', particle: 'sparkle', emoji: '🕶️' },
  soda: { color: '#DC143C', particle: 'sparkle', emoji: '🥤' },
  note: { color: '#9370DB', particle: 'sparkle', emoji: '🎵' },
  wand: { color: '#9B59B6', particle: 'sparkle', emoji: '🪄' },
  hourglass: { color: '#DAA520', particle: 'sparkle', emoji: '⏳' },
  letter: { color: '#FF69B4', particle: 'hearts', emoji: '💌' },
  rainbow: { color: '#FF6347', particle: 'confetti', emoji: '🌈' },
  matcha: { color: '#2E8B57', particle: 'sparkle', emoji: '🍵' },
  cocktail: { color: '#FF4500', particle: 'sparkle', emoji: '🍹' },
  daisy: { color: '#FFD700', particle: 'sparkle', emoji: '🌼' },
  cactus: { color: '#2E8B57', particle: 'sparkle', emoji: '🌵' },
  coffee: { color: '#8B6F47', particle: 'sparkle', emoji: '☕' },
  sword: { color: '#C0C0C0', particle: 'sparkle', emoji: '⚔️' },
  ghost: { color: '#E8E8E8', particle: 'sparkle', emoji: '👻' },
  pizza: { color: '#FF8C00', particle: 'sparkle', emoji: '🍕' },
  burger: { color: '#FF8C00', particle: 'sparkle', emoji: '🍔' },
  // Premium
  heart: { color: '#FF1744', particle: 'hearts', emoji: '💖' },
  cat: { color: '#FF69B4', particle: 'hearts', emoji: '😻' },
  moneybag: { color: '#FFD700', particle: 'sparkle', emoji: '💰' },
  guitar: { color: '#CD853F', particle: 'sparkle', emoji: '🎸' },
  teddy: { color: '#DEB887', particle: 'hearts', emoji: '🧸' },
  watch: { color: '#C0C0C0', particle: 'sparkle', emoji: '⌚' },
  giftbox: { color: '#FF4500', particle: 'confetti', emoji: '🎁' },
  star: { color: '#FFC107', particle: 'stars', emoji: '⭐' },
  cake: { color: '#FFB6C1', particle: 'confetti', emoji: '🎂' },
  mic: { color: '#C0C0C0', particle: 'sparkle', emoji: '🎤' },
  popcorn: { color: '#FFD700', particle: 'sparkle', emoji: '🍿' },
  headphones: { color: '#4169E1', particle: 'sparkle', emoji: '🎧' },
  champagne: { color: '#FFD700', particle: 'confetti', emoji: '🍾' },
  medal: { color: '#FFD700', particle: 'sparkle', emoji: '🏅' },
  crown: { color: '#FFD700', particle: 'sparkle', emoji: '👑' },
  crystalball: { color: '#9B59B6', particle: 'sparkle', emoji: '🔮' },
  bouquet: { color: '#FF69B4', particle: 'hearts', emoji: '💐' },
  alien: { color: '#32CD32', particle: 'sparkle', emoji: '👽' },
  sun: { color: '#FFD700', particle: 'sparkle', emoji: '🌞' },
  // Legendary
  diamond: { color: '#00E5FF', particle: 'sparkle', emoji: '💎' },
  dart: { color: '#FF4500', particle: 'sparkle', emoji: '🎯' },
  fire: { color: '#FF5722', particle: 'fire_sparks', emoji: '🔥' },
  unicorn: { color: '#FF69B4', particle: 'confetti', emoji: '🦄' },
  rocket: { color: '#FF6B35', particle: 'confetti', emoji: '🚀' },
  sportscar: { color: '#FF0000', particle: 'sparkle', emoji: '🏎️' },
  plane: { color: '#87CEEB', particle: 'sparkle', emoji: '✈️' },
  ship: { color: '#4169E1', particle: 'sparkle', emoji: '🛳️' },
  castle: { color: '#8B7355', particle: 'sparkle', emoji: '🏰' },
  dragon: { color: '#FF4500', particle: 'fire_sparks', emoji: '🐉' },
  cybercity: { color: '#00E5FF', particle: 'sparkle', emoji: '🏙️' },
  soprano: { color: '#FFD700', particle: 'confetti', emoji: '⚜️' },
  lion: { color: '#DAA520', particle: 'sparkle', emoji: '🦁' },
  panther: { color: '#2F4F4F', particle: 'sparkle', emoji: '🐆' },
  throne: { color: '#FFD700', particle: 'sparkle', emoji: '🪑' },
  planet: { color: '#9370DB', particle: 'sparkle', emoji: '🪐' },
};

// İlk asama icin Lottie JSON'lari yuklenene kadar fallback calissin.
// Lottie hazir olunca buradaki objeyi importlarla dolduracagiz.
const LOTTIE_SOURCES: Record<string, any> = {
  // rose: require('../assets/lottie/gifts/rose.json'),
};

export default function GiftAnimation({ giftId, senderName, targetName, giftName, visible, onComplete, tier }: GiftAnimationProps) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const giftScale = useRef(new Animated.Value(0)).current;
  const giftOpacity = useRef(new Animated.Value(0)).current;
  const bannerTranslate = useRef(new Animated.Value(100)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.3)).current;

  const config = GIFT_CONFIG[giftId] || GIFT_CONFIG['rose'];
  const [lottieHasError, setLottieHasError] = useState(true);

  // Tier'a gore dinamik degerler
  const TIER_CONFIG = {
    basic:     { emojiSize: 60,  delay: 1200, overlayAlpha: 0,    glowSize: 0,           springFriction: 6, springTension: 80, particleCount: 0  },
    premium:   { emojiSize: 100, delay: 2500, overlayAlpha: 0.15, glowSize: width * 0.3, springFriction: 4, springTension: 50, particleCount: 25 },
    legendary: { emojiSize: 140, delay: 4000, overlayAlpha: 0.25, glowSize: width * 0.5, springFriction: 3, springTension: 30, particleCount: 50 },
  };
  const tc = TIER_CONFIG[tier] || TIER_CONFIG.basic;

  useEffect(() => {
    if (!visible) return;

    setLottieHasError(!LOTTIE_SOURCES[giftId]);
    overlayOpacity.setValue(0);
    giftScale.setValue(0);
    giftOpacity.setValue(0);
    bannerTranslate.setValue(100);
    bannerOpacity.setValue(0);

    // Haptics
    if (tier === 'legendary') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (tier === 'premium') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Glow pulse (sadece premium+)
    let glowAnim: Animated.CompositeAnimation | null = null;
    if (tier !== 'basic') {
      glowAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: tier === 'legendary' ? 1 : 0.6, duration: tier === 'legendary' ? 600 : 1000, useNativeDriver: true }),
          Animated.timing(glowPulse, { toValue: 0.2, duration: tier === 'legendary' ? 600 : 1000, useNativeDriver: true })
        ])
      );
      glowAnim.start();
    }

    Animated.sequence([
      Animated.timing(overlayOpacity, { toValue: 1, duration: tier === 'basic' ? 150 : 300, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(giftScale, { toValue: tier === 'legendary' ? 1.4 : 1.2, friction: tc.springFriction, tension: tc.springTension, useNativeDriver: true }),
        Animated.timing(giftOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(bannerTranslate, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(bannerOpacity, { toValue: 1, duration: 400, useNativeDriver: true })
      ]),
      Animated.timing(giftScale, { toValue: 1.0, duration: 200, useNativeDriver: true }),
      Animated.delay(tc.delay),
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(giftScale, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(giftOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(bannerTranslate, { toValue: 100, duration: 300, useNativeDriver: true }),
        Animated.timing(bannerOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
      ])
    ]).start(() => {
      glowAnim?.stop();
      onComplete();
    });

  }, [visible, giftId]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      
      {/* TEK KATMAN Overlay — düz, dikişsiz */}
      <Animated.View style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
        opacity: Animated.multiply(overlayOpacity, tier === 'basic' ? 0.7 : 0.85),
      }} />

      {/* Partiküller — basic'te yok */}
      {tier !== 'basic' && (
        <ParticleEffect 
          type={config.particle} 
          color={config.color} 
          duration={tier === 'legendary' ? 5000 : 3500}
          count={tc.particleCount}
        />
      )}

      {/* Hediye Emoji */}
      <View style={styles.centerStage}>
        <View style={{ justifyContent: 'center', alignItems: 'center', width: tc.emojiSize * 1.5, height: tc.emojiSize * 1.5 }}>
          {/* Glow — sadece premium+, çok hafif */}
          {tc.glowSize > 0 && (
            <Animated.View style={{
              position: 'absolute',
              width: tc.glowSize,
              height: tc.glowSize,
              borderRadius: tc.glowSize / 2,
              backgroundColor: config.color,
              opacity: Animated.multiply(glowPulse, 0.15),
              transform: [{ scale: giftScale }]
            }} />
          )}
          <Animated.Text style={{
            fontSize: tc.emojiSize,
            opacity: giftOpacity,
            transform: [{ scale: giftScale }],
            textShadowColor: tier === 'legendary' ? config.color : 'rgba(255,255,255,0.2)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: tier === 'legendary' ? 20 : tier === 'premium' ? 10 : 3,
          }}>
            {config.emoji}
          </Animated.Text>
        </View>
      </View>

      {/* Premium Banner */}
      <View style={styles.bannerContainer}>
        <Animated.View style={[
          styles.bannerOuter,
          { opacity: bannerOpacity, transform: [{ translateY: bannerTranslate }] },
        ]}>
          <View style={[
            styles.banner, 
            tier === 'legendary' && { borderColor: config.color, borderWidth: 1.5 },
            tier === 'premium' && { borderColor: 'rgba(168,85,247,0.4)', borderWidth: 1 },
          ]}>
            <LinearGradient
              colors={tier === 'legendary'
                ? ['rgba(20,15,35,0.98)', 'rgba(30,20,50,0.95)']
                : tier === 'premium'
                ? ['rgba(20,15,35,0.95)', 'rgba(25,20,40,0.92)']
                : ['rgba(25,25,30,0.92)', 'rgba(20,20,25,0.90)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
            />
            <View style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.senderText}>{senderName}</Text>
                {targetName && (
                  <>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>→</Text>
                    <Text style={[styles.senderText, { color: '#5CE1E6' }]}>{targetName}</Text>
                  </>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 18 }}>{config.emoji}</Text>
                <Text style={[styles.giftDesc, { color: config.color }]}>
                  {giftName} gönderdi!
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  centerStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerContainer: {
    position: 'absolute',
    bottom: height * 0.25,
    width: '100%',
    alignItems: 'center',
  },
  bannerOuter: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    minWidth: 200,
    borderRadius: 20,
  },
  banner: {
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  senderText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  giftDesc: {
    fontSize: 15,
    fontWeight: '600',
  }
});
