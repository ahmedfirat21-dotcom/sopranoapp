/**
 * CosmeticBadge — Web admin "Rozetler" editör config'i tüketen Skia rozet
 * ════════════════════════════════════════════════════════════════════
 * v117 (13 May 2026) — Skia Path/Circle/Group ile 8 farklı şekil
 * (circle/rounded-square/shield/star/diamond/hexagon/crown/gem)
 * + BlurMask glow + animasyon (pulse/spin/shimmer/bounce/rainbow/breathe).
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

// ★ v281 (16 May 2026): MaterialCommunityIcons'a geçildi — lucide-react (web admin) ikon
//   setine en yakın eşdeğer set. Önceden Ionicons (verified=checkmark-circle DAİRE) idi,
//   web admin'in lucide BadgeCheck (shield/decagram) ile parite YOKTU.
//   MDI eşleştirmeleri: BadgeCheck → check-decagram, Crown → crown, vb.
const ICON_MAP: Record<string, string> = {
  verified: 'check-decagram',   // lucide BadgeCheck eşi (shield/decagram + check)
  crown:    'crown',             // lucide Crown
  star:     'star',              // lucide Star
  award:    'trophy-variant',    // lucide Award (trophy)
  diamond:  'diamond-stone',     // lucide Diamond
  shield:   'shield-check',      // lucide Shield (+ check)
};

interface Props {
  badgeItemId: string | null | undefined;
  context?: 'avatar' | 'profile' | 'inline';
  containerStyle?: ViewStyle;
  /**
   * ★ v281 (16 May 2026): Avatar bağlamında render boyutu. Verilirse cfg.size yerine
   * `avatarSize * cfg.scale_on_avatar` baz alınır (frame PNG mantığı: avatar × user_ratio).
   * Yani admin web admin'de "scale_on_avatar = %35" derken → APK her avatar boyutunda
   * avatar'ın %35'i kadar rozet çizer. cfg.size sadece web admin Solo preview için.
   */
  avatarSize?: number;
}

export function CosmeticBadge({ badgeItemId, context = 'avatar', containerStyle, avatarSize }: Props) {
  const cfg = useBadgeConfig(badgeItemId);
  if (!cfg) return null;
  if (context === 'avatar' && !cfg.visible_on_avatar) return null;
  if (context === 'profile' && !cfg.visible_on_profile) return null;
  if (context === 'inline' && !cfg.visible_inline_with_name) return null;

  // ★ v281: avatarSize verilmişse cfg.size'ı override et — frame mantığı paritesi
  const effectiveCfg = (() => {
    if (avatarSize == null || typeof cfg.scale_on_avatar !== 'number') return cfg;
    const targetSize = Math.max(8, Math.round(avatarSize * cfg.scale_on_avatar));
    if (targetSize === cfg.size) return cfg;
    return { ...cfg, size: targetSize };
  })();

  return <BadgeRender cfg={effectiveCfg} containerStyle={containerStyle} />;
}

function shapePath(shape: string, size: number, Skia: any, opts?: { borderRadius?: number }): any {
  const path = Skia.Path.Make();
  const s = size;
  switch (shape) {
    case 'circle': {
      path.addCircle(s / 2, s / 2, s / 2);
      break;
    }
    case 'rounded-square': {
      // ★ v281 (16 May 2026): Web admin border_radius slider'ı APK'da çalışmıyordu (eskiden
      //   hardcode `s * 0.2`). Şimdi opts.borderRadius (cfg.border_radius) kullanıyor.
      const r = Math.min(opts?.borderRadius ?? s * 0.2, s / 2);
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
      // ★ v281 (16 May 2026): İç yarıçap düzeltildi — `s/5` (0.2s) idi, web admin polygon'unda
      //   yaklaşık 0.191s. Klasik 5 köşeli yıldız geometrisi: r_inner = r_outer * (3-√5)/2 ≈ 0.382.
      //   Eski APK yıldızı daha şişmandı; şimdi web admin ile birebir.
      const cx = s / 2, cy = s / 2;
      const rOut = s / 2;
      const rIn = rOut * 0.382; // ~s * 0.191
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? rOut : rIn;
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
  // ★ v281 (16 May 2026) FIX: @shopify/react-native-skia'da `Skia` ile `Path` farklı
  //   exportlar. `Skia` = imperative namespace (Skia.Path.Make()), `Path` = JSX component.
  //   Önceki: const Skia = SkiaMod → Skia.Path.Make() çalışıyor sandık, ama SkiaMod.Path
  //   JSX component'idir; Make metodu yok → "Skia.Path.Make is not a function" render error.
  //   Düzeltme: namespace için SkiaMod.Skia, JSX componentleri için SkiaMod top-level.
  const SkiaNS = SkiaMod?.Skia;
  if (!SkiaMod || !SkiaNS) {
    // Skia yoksa sade fallback
    const iconName = ICON_MAP[cfg.icon_type] || 'check';
    return (
      <View style={[{ width: cfg.size, height: cfg.size, borderRadius: cfg.size / 2, backgroundColor: cfg.bg_color, alignItems: 'center', justifyContent: 'center' }, containerStyle]}>
        {cfg.icon_type !== 'none' && <MaterialCommunityIcons name={iconName as any} size={cfg.size * cfg.icon_size_ratio} color={cfg.icon_color} />}
      </View>
    );
  }

  const { Canvas, Path, Group, LinearGradient, BlurMask, vec } = SkiaMod;
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

  // Path tek seferlik oluştur (size'a göre) — SkiaNS namespace ile (Skia.Path.Make)
  const path = React.useMemo(
    () => shapePath(cfg.shape, cfg.size, SkiaNS, { borderRadius: cfg.border_radius }),
    [cfg.shape, cfg.size, cfg.border_radius],
  );

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
          {/* ★ v281 (16 May 2026): CSS box-shadow blur RADIUS ile Skia BlurMask SIGMA farklı.
                CSS spec: blur-radius = 2 × gauss_stddev. Skia sigma = gauss_stddev.
                Yani Skia sigma = CSS blur / 2 olmalı. Önceden doğrudan veriyorduk → 2x büyük halka.
                Glow halo */}
          {cfg.glow_enabled && (
            <Path path={path} color={cfg.glow_color} opacity={glowOpacity}>
              <BlurMask blur={cfg.glow_blur / 2} style="normal" />
            </Path>
          )}
          {/* ★ v281 (16 May 2026): Border ÖNCE çizilir, fill sonra üstüne biner — CSS
                "outer border" davranışına eşit. Eskiden fill önce + ortalanmış stroke vardı,
                bu Skia default'unda border bg'nin yarısını yiyordu (yani CSS border'dan
                farklı görünüyordu). Şimdi: 2x strokeWidth ile çizip, sonra normal fill ile
                içerideki yarısını kapatıyoruz → görünür border tam dış, bg geometrisi sabit. */}
          {cfg.border_enabled && cfg.border_width > 0 && (
            <Path path={path} color={cfg.border_color} style="stroke" strokeWidth={cfg.border_width * 2} />
          )}
          {/* Bg fill — gradient veya solid (border'ın iç yarısının üstüne biner) */}
          {cfg.bg_gradient_enabled ? (() => {
            // ★ v281: bg_gradient_angle desteği — CSS gradient açısıyla uyumlu
            //   (0deg=yukarı, 90deg=sağ, 180deg=aşağı, 270deg=sol). Önce her zaman 135° idi.
            const angle = ((cfg.bg_gradient_angle ?? 135) - 90) * Math.PI / 180;
            const cx = cfg.size / 2;
            const cy = cfg.size / 2;
            const r = cfg.size / 2;
            const sx = cx - Math.cos(angle) * r;
            const sy = cy - Math.sin(angle) * r;
            const ex = cx + Math.cos(angle) * r;
            const ey = cy + Math.sin(angle) * r;
            return (
              <Path path={path} opacity={cfg.bg_opacity}>
                <LinearGradient
                  start={vec(sx, sy)}
                  end={vec(ex, ey)}
                  colors={[cfg.bg_gradient_from, cfg.bg_gradient_to]}
                />
              </Path>
            );
          })() : (
            <Path path={path} color={cfg.bg_color} opacity={cfg.bg_opacity} />
          )}
        </Group>
      </Canvas>
      {/* ★ v281 (16 May 2026): tier_label_override desteği — admin "PLUS"/"PRO" yazısı.
            Önce icon render ediliyordu; web admin'de label varsa icon yerine LABEL gözükür. */}
      {cfg.tier_label_override ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <Text
            style={{
              color: cfg.tier_label_color || '#FFFFFF',
              fontSize: (cfg.size / 24) * (cfg.tier_label_font_size || 9),
              fontWeight: '900',
              letterSpacing: 0.5,
              textShadowColor: 'rgba(0,0,0,0.6)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
              lineHeight: cfg.size,
            }}
            numberOfLines={1}
          >
            {cfg.tier_label_override}
          </Text>
        </View>
      ) : iconName ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <MaterialCommunityIcons name={iconName as any} size={iconSize} color={cfg.icon_color} />
        </View>
      ) : null}
      {cfg.icon_type === 'custom' && !!cfg.custom_image_url && !cfg.tier_label_override && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          {/* TODO v281+: custom image — RN Image ile render edilecek (admin custom_image_url yüklemesi). */}
        </View>
      )}
    </View>
  );
}
