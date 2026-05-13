/**
 * GlowMessageBubble — Web admin "Parlak Mesajlar" config'i tüketen Skia bubble wrapper
 * ════════════════════════════════════════════════════════════════════
 * v117 (13 May 2026) — Skia BlurMaskFilter + RoundedRect ile bubble glow/shadow.
 * Animasyon: pulse/breathe/shimmer/rainbow → react-native-reanimated SharedValue.
 *
 * Kullanım:
 *   <GlowMessageBubble glowItemId={user.active_glow_id} isMine={isMine}>
 *     <Text>...mesaj içeriği...</Text>
 *   </GlowMessageBubble>
 *
 * itemId null/yok ise standart bubble render edilir (no-op wrapper).
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useGlowMessageConfig, type GlowMessageConfig } from '../../services/cosmeticEditorConfigs';

let SkiaMod: any = null;
let ReanimatedMod: any = null;
try { SkiaMod = require('@shopify/react-native-skia'); } catch {}
try { ReanimatedMod = require('react-native-reanimated'); } catch {}

// React rule: hook'lar her zaman aynı sırada çağrılmalı.
// SkiaGlowBubble içinde useSharedValue koşulsuz çağrılmalı — eğer reanimated yoksa
// dummy bir noop sağlayıcı kullan.
const _useStableValue = ReanimatedMod?.useSharedValue
  ? ReanimatedMod.useSharedValue
  : (initial: any) => ({ value: initial });
const _useStableDerived = ReanimatedMod?.useDerivedValue
  ? ReanimatedMod.useDerivedValue
  : (fn: () => any) => { try { return { value: fn() }; } catch { return { value: 0 }; } };

interface Props {
  glowItemId: string | null | undefined;
  isMine?: boolean;
  context?: 'chat' | 'dm' | 'room';
  children: React.ReactNode;
  style?: ViewStyle;
}

export function GlowMessageBubble({ glowItemId, isMine, context = 'chat', children, style }: Props) {
  const cfg = useGlowMessageConfig(glowItemId);

  // Bağlam görünürlük kontrolü
  if (cfg) {
    if (context === 'chat' && !cfg.visible_in_chat) return <View style={style}>{children}</View>;
    if (context === 'dm' && !cfg.visible_in_dm) return <View style={style}>{children}</View>;
    if (context === 'room' && !cfg.visible_in_room) return <View style={style}>{children}</View>;
  }

  // Config yoksa veya Skia yoksa düz bubble
  if (!cfg || !SkiaMod) return <View style={style}>{children}</View>;

  return <SkiaGlowBubble cfg={cfg} style={style}>{children}</SkiaGlowBubble>;
}

function SkiaGlowBubble({ cfg, children, style }: { cfg: GlowMessageConfig; children: React.ReactNode; style?: ViewStyle }) {
  const { Canvas, RoundedRect, BlurMask, Group, LinearGradient, vec } = SkiaMod;
  const { withRepeat, withTiming, Easing, cancelAnimation } = ReanimatedMod || {};

  const [size, setSize] = React.useState({ w: 0, h: 0 });

  // Animasyon shared value (0-1) — KOŞULSUZ hook (React rules)
  const t = _useStableValue(0);

  useEffect(() => {
    if (!t || !ReanimatedMod) return;
    cancelAnimation?.(t);
    if (cfg.glow_animation === 'none') { t.value = 0; return; }
    const speed = cfg.glow_anim_speed_ms || 1600;
    t.value = 0;
    if (cfg.glow_animation === 'rainbow') {
      t.value = withRepeat(withTiming(1, { duration: (cfg.rainbow_speed_sec || 6) * 1000, easing: Easing.linear }), -1, false);
    } else if (cfg.glow_animation === 'pulse' || cfg.glow_animation === 'breathe') {
      t.value = withRepeat(withTiming(1, { duration: speed / 2, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else if (cfg.glow_animation === 'shimmer') {
      t.value = withRepeat(withTiming(1, { duration: speed, easing: Easing.linear }), -1, false);
    }
    return () => { try { cancelAnimation?.(t); } catch {} };
  }, [cfg.glow_animation, cfg.glow_anim_speed_ms, cfg.rainbow_speed_sec]);

  // Shape → border radius
  const radius = (() => {
    switch (cfg.bubble_shape) {
      case 'pill':   return 999;
      case 'square': return 0;
      case 'speech':
      case 'rounded':
      default:       return cfg.bubble_border_radius;
    }
  })();

  // Hex → rgba alpha (koşulsuz hook çağrıları)
  const glowAlpha = _useStableDerived(() => {
    'worklet';
    if (cfg.glow_animation === 'pulse' || cfg.glow_animation === 'breathe') {
      const min = cfg.glow_intensity * (1 - (cfg.glow_anim_amplitude || 0.3));
      return min + (cfg.glow_intensity - min) * (t?.value ?? 0);
    }
    return cfg.glow_intensity;
  });

  // Glow blur — animated
  const glowBlur = _useStableDerived(() => {
    'worklet';
    const base = cfg.glow_blur;
    if (cfg.glow_animation === 'pulse' || cfg.glow_animation === 'breathe') {
      return base * (0.7 + 0.6 * (t?.value ?? 0));
    }
    return base;
  });

  // Bubble pulse scale (transform) — RN tarafında
  const [scale, setScale] = React.useState(1);
  useEffect(() => {
    if (!cfg.bubble_pulse) { setScale(1); return; }
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) / 1400;
      const v = 1 + Math.sin(elapsed * Math.PI * 2) * 0.5 * (cfg.bubble_pulse_scale - 1);
      setScale(v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cfg.bubble_pulse, cfg.bubble_pulse_scale]);

  // Canvas padding (blur'un dışına taşmasına izin ver)
  const canvasPad = cfg.glow_blur + cfg.glow_spread + 4;

  return (
    <View
      style={[
        style,
        {
          paddingHorizontal: cfg.bubble_padding_x,
          paddingVertical: cfg.bubble_padding_y,
          transform: cfg.bubble_pulse ? [{ scale }] : undefined,
        },
      ]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {/* Skia underlay — glow + bg */}
      {size.w > 0 && size.h > 0 && cfg.glow_enabled && (
        <Canvas
          style={[styles.canvas, {
            top: -canvasPad,
            left: -canvasPad,
            width: size.w + canvasPad * 2,
            height: size.h + canvasPad * 2,
          }]}
          pointerEvents="none"
        >
          <Group>
            {/* Glow halo — blurMask ile */}
            <RoundedRect
              x={canvasPad}
              y={canvasPad}
              width={size.w}
              height={size.h}
              r={radius}
              color={cfg.glow_color}
              opacity={glowAlpha}
            >
              <BlurMask blur={glowBlur} style={cfg.glow_inset ? 'inner' : 'normal'} />
            </RoundedRect>
            {/* Bubble bg (gradient veya düz) */}
            {cfg.bubble_bg_gradient_enabled ? (
              <RoundedRect
                x={canvasPad}
                y={canvasPad}
                width={size.w}
                height={size.h}
                r={radius}
                opacity={cfg.bubble_opacity}
              >
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(0, size.h)}
                  colors={[cfg.bubble_bg_gradient_top, cfg.bubble_bg_gradient_bottom]}
                />
              </RoundedRect>
            ) : (
              <RoundedRect
                x={canvasPad}
                y={canvasPad}
                width={size.w}
                height={size.h}
                r={radius}
                color={cfg.bubble_bg_color}
                opacity={cfg.bubble_opacity}
              />
            )}
            {/* Sınır (border) — outline RoundedRect */}
            {cfg.border_enabled && cfg.border_width > 0 && (
              <RoundedRect
                x={canvasPad}
                y={canvasPad}
                width={size.w}
                height={size.h}
                r={radius}
                color={cfg.border_color}
                style="stroke"
                strokeWidth={cfg.border_width}
              />
            )}
          </Group>
        </Canvas>
      )}
      {/* Mesaj içeriği — Skia katmanının üstünde */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'absolute' },
  content: { position: 'relative', zIndex: 1 },
});
