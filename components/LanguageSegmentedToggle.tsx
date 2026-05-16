/**
 * LanguageSegmentedToggle — modern TR/EN dil seçici
 * ════════════════════════════════════════════════════════════════════
 * v283 (16 May 2026): Eski lang pill (bayrak emoji + harf) "retro"
 * görünüyordu. iOS UISegmentedControl tarzı; aktif segmentin altında
 * animated bir teal indicator slide eder.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet, Easing } from 'react-native';

interface Props {
  value: 'tr' | 'en';
  onChange: (next: 'tr' | 'en') => void;
}

const SEG_W = 36;     // her segment genişliği
const SEG_H = 26;     // segment yüksekliği
const GAP = 0;        // segment arası

export default function LanguageSegmentedToggle({ value, onChange }: Props) {
  const indicatorX = useRef(new Animated.Value(value === 'tr' ? 0 : SEG_W + GAP)).current;

  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: value === 'tr' ? 0 : SEG_W + GAP,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [value, indicatorX]);

  return (
    <View style={s.container}>
      <Animated.View
        style={[
          s.indicator,
          { width: SEG_W, height: SEG_H, transform: [{ translateX: indicatorX }] },
        ]}
      />
      <Pressable
        style={[s.segment, { width: SEG_W, height: SEG_H }]}
        onPress={() => onChange('tr')}
        hitSlop={6}
      >
        <Text style={[s.label, value === 'tr' && s.labelActive]}>TR</Text>
      </Pressable>
      <Pressable
        style={[s.segment, { width: SEG_W, height: SEG_H }]}
        onPress={() => onChange('en')}
        hitSlop={6}
      >
        <Text style={[s.label, value === 'en' && s.labelActive]}>EN</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,25,38,0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 2,
    left: 2,
    borderRadius: 11,
    backgroundColor: 'rgba(20,184,166,0.85)',
    shadowColor: '#14B8A6',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  segment: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: 'rgba(148,163,184,0.7)',
  },
  labelActive: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
