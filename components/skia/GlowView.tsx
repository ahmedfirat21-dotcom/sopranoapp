/**
 * SopranoChat — GlowView
 * ═══════════════════════════════════════════════════════════════════
 * Drop-in `<View>` değiştirici. Style içindeki `shadowColor` SİYAH DEĞİLSE
 * (yani Android'de zaten renderlanamayan renkli glow ise), View'ı SkiaShadow
 * ile sarıp gerçek cross-platform colored halo çiziyor.
 *
 * Kullanım:
 *   import { GlowView } from '../skia/GlowView';
 *   // 'View' yerine 'GlowView' yaz, style aynı kalır.
 *   <GlowView style={[s.card, s.premiumGlow]}> ... </GlowView>
 *
 * Davranış:
 *   - style.shadowColor siyah/karanlık (#000, rgba(0,0,0,...)) → standart View döner,
 *     Android elevation zaten çalışıyor.
 *   - style.shadowColor renkli → SkiaShadow underlay + plain View (shadow props
 *     temizlenir, çakışma olmaz).
 *
 * Bu yaklaşım: tek import + bir replace_all = onlarca yer otomatik Skia parite.
 */

import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, ViewProps } from 'react-native';
import { SkiaShadow } from './SkiaShadow';

interface GlowViewProps extends ViewProps {
  children?: ReactNode;
}

function isBlackish(color: any): boolean {
  if (!color || typeof color !== 'string') return true;
  const c = color.trim().toLowerCase();
  if (c === '#000' || c === '#000000' || c === 'black') return true;
  if (c.startsWith('rgba(0,0,0') || c.startsWith('rgb(0,0,0')) return true;
  if (c.startsWith('rgba(0, 0, 0') || c.startsWith('rgb(0, 0, 0')) return true;
  return false;
}

export function GlowView({ style, children, ...rest }: GlowViewProps) {
  const flat: any = StyleSheet.flatten(style) || {};
  const {
    shadowColor,
    shadowOpacity,
    shadowRadius,
    shadowOffset,
    elevation,
    ...restStyle
  } = flat as any;

  // Skia gerek yok: siyah gölge veya hiç gölge yok.
  if (!shadowColor || isBlackish(shadowColor)) {
    return <View style={style} {...rest}>{children}</View>;
  }

  // Renkli gölge — Skia ile gerçek halo.
  const opacity = typeof shadowOpacity === 'number' ? shadowOpacity : 0.5;
  const blur = typeof shadowRadius === 'number' ? shadowRadius : 8;
  const offsetY = shadowOffset && typeof shadowOffset.height === 'number' ? shadowOffset.height : 0;
  const offsetX = shadowOffset && typeof shadowOffset.width === 'number' ? shadowOffset.width : 0;
  const borderRadius = typeof restStyle.borderRadius === 'number' ? restStyle.borderRadius : 0;

  // restStyle: shadow props çıkarılmış, alignSelf/width/height vb. korunmuş.
  // SkiaShadow underlay + plain View; çakışan elevation/shadow* prop'ları drop edildi.
  return (
    <SkiaShadow
      shadowColor={shadowColor}
      shadowOpacity={opacity}
      shadowBlur={blur}
      shadowOffsetX={offsetX}
      shadowOffsetY={offsetY}
      borderRadius={borderRadius}
      style={{
        alignSelf: restStyle.alignSelf,
        margin: restStyle.margin,
        marginTop: restStyle.marginTop,
        marginBottom: restStyle.marginBottom,
        marginLeft: restStyle.marginLeft,
        marginRight: restStyle.marginRight,
        marginVertical: restStyle.marginVertical,
        marginHorizontal: restStyle.marginHorizontal,
      } as ViewStyle}
    >
      <View style={restStyle as any} {...rest}>{children}</View>
    </SkiaShadow>
  );
}
