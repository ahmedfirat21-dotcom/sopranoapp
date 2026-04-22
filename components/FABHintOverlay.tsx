// ★ 2026-04-21: Onboarding tamamlandıktan sonra + butonunu işaret eden tek-seferlik hint.
//   Pulse glow + animasyonlu arrow + tooltip. AsyncStorage flag ile bir kez gösterilir.
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: W, height: H } = Dimensions.get('window');
const STORAGE_KEY = 'soprano_fab_hint_seen';

export async function hasSeenFABHint(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    return v === '1';
  } catch {
    return true;
  }
}

export async function markFABHintSeen() {
  try { await AsyncStorage.setItem(STORAGE_KEY, '1'); } catch {}
}

type Props = {
  visible: boolean;
  /** FAB'ın bottom offset'i — hint'in doğru noktaya işaret etmesi için. */
  bottomOffset: number;
  onDismiss: () => void;
};

export default function FABHintOverlay({ visible, bottomOffset, onDismiss }: Props) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const glow1 = useRef(new Animated.Value(0)).current;
  const glow2 = useRef(new Animated.Value(0)).current;
  const arrowBounce = useRef(new Animated.Value(0)).current;
  const tooltipSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!visible) return;

    fadeIn.setValue(0);
    glow1.setValue(0);
    glow2.setValue(0);
    tooltipSlide.setValue(20);

    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(tooltipSlide, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // Glow pulse — çift dalga (staggered)
    const glowLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(glow1, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow1, { toValue: 0, duration: 1, useNativeDriver: true }),
      ]),
    );
    const glowLoop2 = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(glow2, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow2, { toValue: 0, duration: 1, useNativeDriver: true }),
      ]),
    );

    // Arrow bounce — yukarı aşağı
    const arrowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowBounce, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(arrowBounce, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );

    glowLoop1.start();
    glowLoop2.start();
    arrowLoop.start();

    return () => {
      glowLoop1.stop();
      glowLoop2.stop();
      arrowLoop.stop();
    };
  }, [visible]);

  if (!visible) return null;

  const handleDismiss = () => {
    markFABHintSeen();
    Animated.timing(fadeIn, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      onDismiss();
    });
  };

  // FAB merkezi: right=16+28=44 from right, bottom=bottomOffset+28
  const fabCenterRight = 44;
  const fabCenterBottom = bottomOffset + 28;

  const glow1Scale = glow1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const glow1Opacity = glow1.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] });
  const glow2Scale = glow2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const glow2Opacity = glow2.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.5, 0] });
  const arrowTranslate = arrowBounce.interpolate({ inputRange: [0, 1], outputRange: [0, 12] });

  return (
    <Pressable style={s.overlay} onPress={handleDismiss}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeIn, backgroundColor: 'rgba(0,0,0,0.6)' }]} />

      {/* Glow ringleri — FAB etrafında */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.glow,
          {
            right: fabCenterRight - 56,
            bottom: fabCenterBottom - 56,
            opacity: glow1Opacity,
            transform: [{ scale: glow1Scale }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          s.glow,
          {
            right: fabCenterRight - 56,
            bottom: fabCenterBottom - 56,
            opacity: glow2Opacity,
            transform: [{ scale: glow2Scale }],
          },
        ]}
      />

      {/* Arrow — FAB'ın hemen üstünde yukarıdan aşağı salınıyor */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.arrowWrap,
          {
            right: fabCenterRight - 20,
            bottom: fabCenterBottom + 68,
            transform: [{ translateY: arrowTranslate }],
          },
        ]}
      >
        <Ionicons name="arrow-down" size={32} color="#14B8A6" style={s.arrowShadow} />
      </Animated.View>

      {/* Tooltip card — FAB'ın sol üstünde */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          s.tooltip,
          {
            right: fabCenterRight + 40,
            bottom: fabCenterBottom + 40,
            opacity: fadeIn,
            transform: [{ translateY: tooltipSlide }],
          },
        ]}
      >
        <View style={s.tooltipCard}>
          <View style={s.tooltipHeader}>
            <Ionicons name="sparkles" size={14} color="#14B8A6" />
            <Text style={s.tooltipTitle}>İpucu</Text>
          </View>
          <Text style={s.tooltipBody}>
            Buradan yeni bir oda açabilirsin. Arkadaşlarını davet et, sohbete başla!
          </Text>
          <View style={s.tooltipFooter}>
            <Text style={s.tooltipDismiss}>Anladım — dokun</Text>
          </View>
          {/* Arrow pointer → FAB yönüne */}
          <View style={s.tooltipTail} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  glow: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 2,
    borderColor: '#14B8A6',
    backgroundColor: 'rgba(20,184,166,0.06)',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
  },
  arrowWrap: {
    position: 'absolute',
  },
  arrowShadow: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  tooltip: {
    position: 'absolute',
    maxWidth: W * 0.68,
  },
  tooltipCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.4)',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 16,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  tooltipTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#14B8A6',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tooltipBody: {
    fontSize: 13,
    color: '#F1F5F9',
    lineHeight: 18,
    fontWeight: '500',
  },
  tooltipFooter: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  tooltipDismiss: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    textAlign: 'right',
  },
  tooltipTail: {
    position: 'absolute',
    bottom: -6,
    right: 16,
    width: 10,
    height: 10,
    backgroundColor: '#0F172A',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(20,184,166,0.4)',
    transform: [{ rotate: '45deg' }],
  },
});
