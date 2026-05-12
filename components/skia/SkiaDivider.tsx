/**
 * SopranoChat — Skia tabanlı hairline divider.
 *
 * Android'de borderWidth: 0.5 veya StyleSheet.hairlineWidth bazı cihazlarda yuvarlanıp
 * 0'a düşüyor (çizgi kayboluyor) veya 1px'e çıkıyor (kalın). Skia ile gerçek 1 fiziksel
 * pixel'e snap edilmiş bir çizgi çiziyoruz → her DPI'da aynı görünür.
 *
 * KULLANIM:
 *   <SkiaDivider color="rgba(255,255,255,0.1)" />
 *   <SkiaDivider color="#475569" thickness={1.5} vertical />
 *
 * NATIVE MODULE FALLBACK: Skia yoksa View borderBottom ile çizgi çizer (yuvarlamayla).
 */

import React from 'react';
import { View, ViewStyle, StyleSheet, DimensionValue } from 'react-native';
import { snap, hairline } from '../../utils/skiaUnits';
import { isSkiaAvailable } from './SkiaShadow';

let SkiaMod: any = null;
try { SkiaMod = require('@shopify/react-native-skia'); } catch (_e) { /* fallback */ }

export interface SkiaDividerProps {
  /** Çizgi rengi. Default rgba(255,255,255,0.1). */
  color?: string;
  /** Çizgi kalınlığı (px). Default 1 fiziksel pixel (hairline). */
  thickness?: number;
  /** Yatay divider'da genişlik (default '100%'). Dikey'de yükseklik. */
  length?: DimensionValue;
  /** Dikey divider mı? Default false (yatay). */
  vertical?: boolean;
  /** Sarıcı stil. */
  style?: ViewStyle | ViewStyle[];
}

export function SkiaDivider({
  color = 'rgba(255,255,255,0.1)',
  thickness,
  length = '100%',
  vertical = false,
  style,
}: SkiaDividerProps) {
  const t = thickness ?? hairline();
  const snappedT = snap(t);

  // Skia yoksa fallback: View with background.
  if (!isSkiaAvailable() || !SkiaMod) {
    return (
      <View
        style={[
          vertical
            ? { width: snappedT, height: length, backgroundColor: color }
            : { width: length, height: snappedT, backgroundColor: color },
          style,
        ]}
      />
    );
  }

  const { Canvas, Rect } = SkiaMod;

  // Skia Canvas için sayısal boyut gerekli. % değer verildiyse parent ölçer.
  // Bu primitive sade — fixed boyut verildiğinde Skia, % verildiğinde View fallback.
  if (typeof length !== 'number') {
    return (
      <View
        style={[
          vertical
            ? { width: snappedT, height: length, backgroundColor: color }
            : { width: length, height: snappedT, backgroundColor: color },
          style,
        ]}
      />
    );
  }

  const w = vertical ? snappedT : length;
  const h = vertical ? length : snappedT;

  return (
    <View style={[{ width: w, height: h }, style]}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Rect x={0} y={0} width={w} height={h} color={color} />
      </Canvas>
    </View>
  );
}
