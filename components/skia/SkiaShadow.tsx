/**
 * SopranoChat — Skia tabanlı cross-platform gölge primitive.
 *
 * SORUN (utils/shadow.ts'in çözemediği):
 *   - iOS shadowColor/shadowRadius vs Android elevation: aynı şey değil, görsel olarak farklı.
 *   - Android elevation glow yapamaz; renk parametresi sınırlı, sub-pixel offset yok.
 *   - Aynı tasarım değeri ("4px black 20% opacity, 12px blur, 4px down") iki platformda iki
 *     farklı şey çiziyor → web admin önizlemesi ile APK birbirini tutmuyor.
 *
 * ÇÖZÜM:
 *   Skia Canvas içinde gerçek bir RoundedRect + BlurMask çiziyoruz. Bu çıktı iOS, Android ve
 *   web'de aynı pixel'leri üretir — çünkü Skia Chrome'un da kullandığı motor.
 *   Çocuk view normal RN olarak render olur (text, image, touch hâlâ native), gölge altta Skia.
 *
 * KULLANIM:
 *   <SkiaShadow shadowColor="#000" shadowOpacity={0.25} shadowBlur={12} shadowOffsetY={4} borderRadius={16}>
 *     <View style={{ width: 200, height: 100, backgroundColor: '#1a2030', borderRadius: 16 }}>
 *       <Text>Card content</Text>
 *     </View>
 *   </SkiaShadow>
 *
 * NOT:
 *   shadowBlur web admin'deki CSS blur radius değerini (px) doğrudan kabul eder.
 *   Skia BlurMask sigma dönüşümü dahili olarak yapılır (cssBlurToSkiaSigma).
 */

import React, { useState, useCallback, ReactNode } from 'react';
import { View, ViewStyle, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Canvas, RoundedRect, BlurMask } from '@shopify/react-native-skia';
import { cssBlurToSkiaSigma } from '../../utils/skiaUnits';

export interface SkiaShadowProps {
  /** Gölge rengi. CSS color string. Default #000. */
  shadowColor?: string;
  /** 0-1 arası. Default 0.25. */
  shadowOpacity?: number;
  /** CSS blur radius (px). Default 12. */
  shadowBlur?: number;
  /** Yatay offset (px). Pozitif sağa. Default 0. */
  shadowOffsetX?: number;
  /** Dikey offset (px). Pozitif aşağı. Default 4. */
  shadowOffsetY?: number;
  /** Gölgenin alacağı şeklin köşe yarıçapı (px). Child'ın borderRadius'u ile aynı olmalı. Default 0. */
  borderRadius?: number;
  /** Sarıcı View'ın stili. */
  style?: ViewStyle | ViewStyle[];
  /** Child genelde tek bir kart/buton View'ı. */
  children: ReactNode;
}

export function SkiaShadow({
  shadowColor = '#000',
  shadowOpacity = 0.25,
  shadowBlur = 12,
  shadowOffsetX = 0,
  shadowOffsetY = 4,
  borderRadius = 0,
  style,
  children,
}: SkiaShadowProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
  }, [size.width, size.height]);

  const padding = shadowBlur + Math.max(Math.abs(shadowOffsetX), Math.abs(shadowOffsetY)) + 4;

  return (
    <View style={[styles.container, style]}>
      {size.width > 0 && size.height > 0 && (
        <Canvas
          style={{
            position: 'absolute',
            left: -padding,
            top: -padding,
            width: size.width + padding * 2,
            height: size.height + padding * 2,
          }}
          pointerEvents="none"
        >
          <RoundedRect
            x={padding + shadowOffsetX}
            y={padding + shadowOffsetY}
            width={size.width}
            height={size.height}
            r={borderRadius}
            color={shadowColor}
            opacity={shadowOpacity}
          >
            <BlurMask blur={cssBlurToSkiaSigma(shadowBlur)} style="normal" />
          </RoundedRect>
        </Canvas>
      )}
      <View onLayout={onLayout} style={styles.contentWrapper}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  contentWrapper: {
    alignSelf: 'flex-start',
  },
});
