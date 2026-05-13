/**
 * CosmeticBadge — Web admin "Rozetler" editör config'i tüketen Skia rozet
 * ════════════════════════════════════════════════════════════════════
 * v117 (13 May 2026) — Skia Path/Circle/Group ile 8 farklı şekil
 * (circle/rounded-square/shield/star/diamond/hexagon/crown/gem)
 * + BlurMask glow + animasyon (pulse/spin/shimmer/bounce/rainbow/breathe).
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBadgeConfig, type BadgeConfig } from '../../services/cosmeticEditorConfigs';

let SkiaMod: any = null;
let ReanimatedMod: any = null;
try { SkiaMod = require('@shopify/react-native-skia'); } catch {}
try { ReanimatedMod = require('react-native-reanimated'); } catch {}

// Reanimated noop fallback — koşulsuz hook çağrısı için
const _useStableValue = ReanimatedMod?.useSharedValue
  ? ReanimatedMod.useSharedValue
  : (initial: any) => ({ value: initial });
const _useStableDerived = ReanimatedMod?.useDerivedValue
  ? ReanimatedMod.useDerivedValue
  : (fn: () => any) => { try { return { value: fn() }; } catch { return { value: 0 }; } };

// Ionicons isim haritası — 'crown' Ionicons'ta yok, MaterialCommunityIcons gerekti
// Pragmatik: tüm ikonları Ionicons'tan kullanan en yakın eşleştirmeleri seç
const ICON_MAP: Record<string, string> = {
  verified: 'checkmark-circle',
  crown: 'star',                  // crown yok → star fallback
  star: 'star',
  award: 'trophy',
  diamond: 'diamond',
  shield: 'shield',
};

interface Props {
  badgeItemId: string | null | undefined;
  context?: 'avatar' | 'profile' | 'inline';
  containerStyle?: ViewStyle;
}

export function CosmeticBadge({ badgeItemId, context = 'avatar', containerStyle }: Props) {
  const cfg = useBadgeConfig(badgeItemId);
  if (!cfg) return null;
  if (context === 'avatar' && !cfg.visible_on_avatar) return null;
  if (context === 'profile' && !cfg.visible_on_profile) return null;
  if (context === 'inline' && !cfg.visible_inline_with_name) return null;

  return <BadgeRender cfg={cfg} containerStyle={containerStyle} />;
}

function shapePath(shape: string, size: number, Skia: any): any {
  const path = Skia.Path.Make();
  const s = size;
  switch (shape) {
    case 'circle': {
      path.addCircle(s / 2, s / 2, s / 2);
      break;
    }
    case 'rounded-square': {
      const r = Math.min(s * 0.2, s / 2);
      path.addRRect(Skia.RRectXY(Skia.XYWHRect(0, 0, s, s), r, r));
      break;
    }
    case 'shield': {
      path.moveTo(s * 0.5, 0);
      path.lineTo(s, s * 0.25);
      path.lineTo(s, s * 0.75);
      path.lineTo(s * 0.5, s);
      path.lineTo(0, s * 0.75);
      path.lineTo(0, s * 0.25);
      path.close();
      break;
    }
    case 'star': {
      const cx = s / 2, cy = s / 2;
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? s / 2 : s / 5;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
      }
      path.close();
      break;
    }
    case 'diamond': {
      path.moveTo(s / 2, 0);
      path.lineTo(s, s / 2);
      path.lineTo(s / 2, s);
      path.lineTo(0, s / 2);
      path.close();
      break;
    }
    case 'hexagon': {
      path.moveTo(s * 0.25, 0);
      path.lineTo(s * 0.75, 0);
      path.lineTo(s, s * 0.5);
      path.lineTo(s * 0.75, s);
      path.lineTo(s * 0.25, s);
      path.lineTo(0, s * 0.5);
      path.close();
      break;
    }
    case 'crown': {
      path.moveTo(0, s * 0.3);
      path.lineTo(s * 0.2, s * 0.3);
      path.lineTo(s * 0.25, 0);
      path.lineTo(s * 0.5, s * 0.3);
      path.lineTo(s * 0.75, 0);
      path.lineTo(s * 0.8, s * 0.3);
      path.lineTo(s, s * 0.3);
      path.lineTo(s, s);
      path.lineTo(0, s);
      path.close();
      break;
    }
    case 'gem': {
      path.moveTo(s * 0.2, 0);
      path.lineTo(s * 0.8, 0);
      path.lineTo(s, s * 0.35);
      path.lineTo(s / 2, s);
      path.lineTo(0, s * 0.35);
      path.close();
      break;
    }
    default: {
      path.addCircle(s / 2, s / 2, s / 2);
    }
  }
  return path;
}

function BadgeRender({ cfg, containerStyle }: { cfg: BadgeConfig; containerStyle?: ViewStyle }) {
  const Skia = SkiaMod;
  if (!Skia) {
    // Skia yoksa sade fallback
    const iconName = ICON_MAP[cfg.icon_type] || 'checkmark';
    return (
      <View style={[{ width: cfg.size, height: cfg.size, borderRadius: cfg.size / 2, backgroundColor: cfg.bg_color, alignItems: 'center', justifyContent: 'center' }, containerStyle]}>
        {cfg.icon_type !== 'none' && <Ionicons name={iconName as any} size={cfg.size * cfg.icon_size_ratio} color={cfg.icon_color} />}
      </View>
    );
  }

  const { Canvas, Path, Group, LinearGradient, BlurMask, vec } = Skia;
  const { withRepeat, withTiming, Easing, cancelAnimation } = ReanimatedMod || {};

  // Animasyon shared value — koşulsuz hook
  const t = _useStableValue(0);

  useEffect(() => {
    if (!t || !ReanimatedMod) return;
    cancelAnimation?.(t);
    if (cfg.animation === 'none') { t.value = 0; return; }
    const speed = cfg.anim_speed_ms || 1500;
    if (cfg.animation === 'spin' || cfg.animation === 'rainbow') {
      t.value = withRepeat(withTiming(1, { duration: speed, easing: Easing.linear }), -1, false);
    } else if (cfg.animation === 'pulse' || cfg.animation === 'breathe' || cfg.animation === 'shimmer') {
      t.value = withRepeat(withTiming(1, { duration: speed / 2, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else if (cfg.animation === 'bounce') {
      t.value = withRepeat(withTiming(1, { duration: speed / 2, easing: Easing.inOut(Easing.quad) }), -1, true);
    }
    return () => { try { cancelAnimation?.(t); } catch {} };
  }, [cfg.animation, cfg.anim_speed_ms]);

  // Canvas padding (glow için)
  const glowPad = cfg.glow_enabled ? cfg.glow_blur + 4 : 0;
  const totalW = cfg.size + glowPad * 2;
  const totalH = cfg.size + glowPad * 2;

  // Path tek seferlik oluştur (size'a göre)
  const path = React.useMemo(() => shapePath(cfg.shape, cfg.size, Skia), [cfg.shape, cfg.size]);

  // Glow opacity animated (pulse için) — koşulsuz hook
  const glowOpacity = _useStableDerived(() => {
    'worklet';
    if (cfg.glow_pulse) {
      return cfg.glow_intensity * (0.6 + 0.4 * t.value);
    }
    return cfg.glow_intensity;
  });

  // Transform — pulse/bounce için scale, spin için rotate
  const transform = _useStableDerived(() => {
    'worklet';
    const tr: any[] = [{ translateX: cfg.size / 2 + glowPad }, { translateY: cfg.size / 2 + glowPad }];
    if (cfg.animation === 'pulse') {
      tr.push({ scale: 1 + (t.value * (cfg.anim_amplitude || 0.3) * 0.25) });
    } else if (cfg.animation === 'bounce') {
      tr.push({ translateY: -(t.value * (cfg.anim_amplitude || 0.3) * 6) });
    } else if (cfg.animation === 'spin') {
      tr.push({ rotate: t.value * 2 * Math.PI });
    }
    tr.push({ translateX: -cfg.size / 2 });
    tr.push({ translateY: -cfg.size / 2 });
    return tr;
  });

  const iconName = ICON_MAP[cfg.icon_type] || null;
  const iconSize = cfg.size * cfg.icon_size_ratio;

  return (
    <View style={[{ width: totalW, height: totalH }, containerStyle]}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Group transform={transform}>
          {/* Glow halo */}
          {cfg.glow_enabled && (
            <Path path={path} color={cfg.glow_color} opacity={glowOpacity}>
              <BlurMask blur={cfg.glow_blur} style="normal" />
            </Path>
          )}
          {/* Bg fill — gradient veya solid */}
          {cfg.bg_gradient_enabled ? (
            <Path path={path} opacity={cfg.bg_opacity}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(cfg.size, cfg.size)}
                colors={[cfg.bg_gradient_from, cfg.bg_gradient_to]}
              />
            </Path>
          ) : (
            <Path path={path} color={cfg.bg_color} opacity={cfg.bg_opacity} />
          )}
          {/* Border (stroke) */}
          {cfg.border_enabled && cfg.border_width > 0 && (
            <Path path={path} color={cfg.border_color} style="stroke" strokeWidth={cfg.border_width} />
          )}
        </Group>
      </Canvas>
      {/* Icon (RN tarafında — Skia içinde Ionicons render zor) */}
      {iconName && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <Ionicons name={iconName as any} size={iconSize} color={cfg.icon_color} />
        </View>
      )}
      {cfg.icon_type === 'custom' && !!cfg.custom_image_url && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          {/* custom image — RN Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
        </View>
      )}
    </View>
  );
}
