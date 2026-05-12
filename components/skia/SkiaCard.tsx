/**
 * SopranoChat — Skia tabanlı kart primitive'i.
 *
 * Web admin'deki kart tasarımının (yuvarlatılmış köşeler, gradient arka plan, kenarlık,
 * soft gölge) APK'da birebir çıktısını verir. RN'de yapılan kart kombinasyonu
 * (backgroundColor + borderRadius + borderWidth + utils/shadow) Android'de hep biraz
 * farklı görünüyordu — bu primitive Skia ile aynı pixel'leri çizer.
 *
 * KULLANIM:
 *   // Düz kart
 *   <SkiaCard width={300} height={120} backgroundColor="#1E293B" borderRadius={16} />
 *
 *   // Gradient kart + gölge + içerik
 *   <SkiaCard
 *     width={300} height={120} borderRadius={20}
 *     gradient={{ colors: ['#3B82F6', '#8B5CF6'], direction: 'horizontal' }}
 *     shadowColor="#000" shadowOpacity={0.4} shadowBlur={20} shadowOffsetY={6}
 *     borderColor="rgba(255,255,255,0.1)" borderWidth={1}
 *   >
 *     <Text>İçerik</Text>
 *   </SkiaCard>
 *
 * NATIVE MODULE FALLBACK: Skia yoksa düz View olarak davranır (basit backgroundColor + borderRadius).
 */

import React, { ReactNode } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { cssBlurToSkiaSigma } from '../../utils/skiaUnits';
import { isSkiaAvailable } from './SkiaShadow';

let SkiaMod: any = null;
try { SkiaMod = require('@shopify/react-native-skia'); } catch (_e) { /* fallback */ }

export interface SkiaGradient {
  /** Gradient renk dizisi (en az 2 stop). */
  colors: string[];
  /** 'vertical' = yukarıdan aşağı, 'horizontal' = soldan sağa, 'diagonal' = sol üstten sağ alta. */
  direction?: 'vertical' | 'horizontal' | 'diagonal';
}

export interface SkiaCardProps {
  /** Kart genişliği (px). */
  width: number;
  /** Kart yüksekliği (px). */
  height: number;
  /** Düz arka plan rengi. gradient verilirse yok sayılır. */
  backgroundColor?: string;
  /** Gradient arka plan. */
  gradient?: SkiaGradient;
  /** Köşe yarıçapı (px). Default 12. */
  borderRadius?: number;
  /** Kenarlık rengi. */
  borderColor?: string;
  /** Kenarlık kalınlığı (px). Default 0. */
  borderWidth?: number;
  /** Gölge rengi. */
  shadowColor?: string;
  /** Gölge saydamlığı (0-1). */
  shadowOpacity?: number;
  /** Gölge CSS blur radius (px). */
  shadowBlur?: number;
  /** Gölge dikey offset (px). */
  shadowOffsetY?: number;
  /** Gölge yatay offset (px). */
  shadowOffsetX?: number;
  /** Sarıcı View stili (pozisyon, margin gibi). */
  style?: ViewStyle | ViewStyle[];
  /** İçerik (mutlak konumla Skia üzerinde overlay olarak çizilir). */
  children?: ReactNode;
}

export function SkiaCard({
  width,
  height,
  backgroundColor,
  gradient,
  borderRadius = 12,
  borderColor,
  borderWidth = 0,
  shadowColor,
  shadowOpacity = 0.25,
  shadowBlur = 0,
  shadowOffsetY = 0,
  shadowOffsetX = 0,
  style,
  children,
}: SkiaCardProps) {
  // Skia yoksa fallback: sade View.
  if (!isSkiaAvailable() || !SkiaMod) {
    return (
      <View
        style={[
          {
            width,
            height,
            backgroundColor: backgroundColor ?? gradient?.colors[0] ?? 'transparent',
            borderRadius,
            borderColor,
            borderWidth,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  const { Canvas, RoundedRect, BlurMask, LinearGradient, vec } = SkiaMod;

  const hasShadow = shadowColor && shadowBlur > 0;
  const padding = hasShadow ? shadowBlur + Math.max(Math.abs(shadowOffsetX), Math.abs(shadowOffsetY)) + 4 : 0;
  const canvasW = width + padding * 2;
  const canvasH = height + padding * 2;

  const gradStart = gradient ? vec(padding, padding) : null;
  let gradEnd = null;
  if (gradient) {
    const dir = gradient.direction ?? 'vertical';
    if (dir === 'vertical') gradEnd = vec(padding, padding + height);
    else if (dir === 'horizontal') gradEnd = vec(padding + width, padding);
    else gradEnd = vec(padding + width, padding + height);
  }

  return (
    <View style={[{ width, height }, style]}>
      <Canvas
        style={{ position: 'absolute', left: -padding, top: -padding, width: canvasW, height: canvasH }}
        pointerEvents="none"
      >
        {hasShadow && (
          <RoundedRect
            x={padding + shadowOffsetX}
            y={padding + shadowOffsetY}
            width={width}
            height={height}
            r={borderRadius}
            color={shadowColor}
            opacity={shadowOpacity}
          >
            <BlurMask blur={cssBlurToSkiaSigma(shadowBlur)} style="normal" />
          </RoundedRect>
        )}
        <RoundedRect
          x={padding}
          y={padding}
          width={width}
          height={height}
          r={borderRadius}
          color={gradient ? undefined : (backgroundColor ?? 'transparent')}
        >
          {gradient && (
            <LinearGradient
              start={gradStart}
              end={gradEnd}
              colors={gradient.colors}
            />
          )}
        </RoundedRect>
        {borderWidth > 0 && borderColor && (
          <RoundedRect
            x={padding + borderWidth / 2}
            y={padding + borderWidth / 2}
            width={width - borderWidth}
            height={height - borderWidth}
            r={Math.max(0, borderRadius - borderWidth / 2)}
            color={borderColor}
            style="stroke"
            strokeWidth={borderWidth}
          />
        )}
      </Canvas>
      {children && <View style={StyleSheet.absoluteFill}>{children}</View>}
    </View>
  );
}
