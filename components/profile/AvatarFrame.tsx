/**
 * SopranoChat — Avatar Çerçevesi
 * ═══════════════════════════════════════════════════════════════════
 * v107 (4 May 2026) — Mağazadan satın alınmış atelier ürününü
 * (Phoenix Diadem, Galactique, Aurum Strike, Glacier, Vesuvius) avatar
 * etrafında çerçeve olarak render eder.
 *
 * Kullanım: avatar Image'in çevresine bu component'i sar.
 *   <View style={{ position: 'relative' }}>
 *     <Image style={{ width: 96, height: 96, borderRadius: 48 }} ... />
 *     <AvatarFrame frameId={profile.active_frame} size={96} />
 *   </View>
 *
 * Frame ürün id'sine göre tematik renk + çift halka (dış glow + iç parlak çizgi).
 * Item3DArt yerine native View kullanır (performans için, WebView her avatara çok ağır).
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface FramePalette {
  outer: string[];   // dış halka gradient (3 stop)
  inner: string;     // iç çizgi rengi
  glowIos: string;   // iOS için shadow rengi
}

const FRAME_PALETTES: Record<string, FramePalette> = {
  'phoenix-diadem': {
    outer: ['#FFE082', '#F472B6', '#831843'],
    inner: '#FCE7F3',
    glowIos: 'rgba(244,114,182,0.7)',
  },
  galactique: {
    outer: ['#A78BFA', '#7C3AED', '#1E1B4B'],
    inner: '#DDD6FE',
    glowIos: 'rgba(167,139,250,0.7)',
  },
  'aurum-strike': {
    outer: ['#FFE082', '#FBBF24', '#854F0B'],
    inner: '#FFF4D6',
    glowIos: 'rgba(255,224,130,0.85)',
  },
  'glacier-aura': {
    outer: ['#A5F3FC', '#22D3EE', '#0E7490'],
    inner: '#F0F9FF',
    glowIos: 'rgba(34,211,238,0.7)',
  },
  vesuvius: {
    outer: ['#FED7AA', '#FB923C', '#7F1D1D'],
    inner: '#FEF3C7',
    glowIos: 'rgba(251,146,60,0.75)',
  },
};

interface Props {
  /** profiles.active_frame değeri — null/undefined ise hiçbir şey render etmez */
  frameId?: string | null;
  /** Avatar boyutu (px) — frame buna göre genişler */
  size: number;
}

export default function AvatarFrame({ frameId, size }: Props) {
  if (!frameId) return null;
  const palette = FRAME_PALETTES[frameId];
  if (!palette) return null;

  const ringSize = size + 14;
  const offset = -7;
  const halfSize = ringSize / 2;

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          top: offset, left: offset, right: offset, bottom: offset,
          alignItems: 'center', justifyContent: 'center',
        },
      ]}
    >
      {/* Dış halka — tematik gradient + iOS shadow */}
      <View
        style={[
          {
            width: ringSize, height: ringSize, borderRadius: halfSize,
            overflow: 'hidden',
            ...Platform.select({
              ios: {
                shadowColor: palette.glowIos,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 1, shadowRadius: 8,
              },
              android: {},
            }),
          },
        ]}
      >
        <LinearGradient
          colors={palette.outer as any}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      {/* İç delik — gradient'in ortasını maskeler, halka görünümü verir */}
      <View
        style={{
          position: 'absolute',
          width: size + 4, height: size + 4, borderRadius: (size + 4) / 2,
          backgroundColor: '#0A0F1A', // arka plan rengi (theme bg)
          borderWidth: 0.8, borderColor: palette.inner,
        }}
      />
    </View>
  );
}
