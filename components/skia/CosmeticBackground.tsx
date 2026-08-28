/**
 * CosmeticBackground — Web admin "Arkaplanlar" config'i tüketen Skia bg renderer
 * ════════════════════════════════════════════════════════════════════
 * v117 — Skia Image / LinearGradient / RadialGradient + ColorMatrix
 * filter (brightness/contrast/saturate/hue) + BlurMaskFilter (vignette).
 * Pan/Zoom/Ken-Burns animasyonu için Reanimated transform.
 *
 * Kullanım:
 *   <CosmeticBackground bgItemId={user.active_bg_id} context="profile">
 *     <ProfileContent />
 *   </CosmeticBackground>
 */
import React, { Component, useEffect } from 'react';
import { View, Image as RNImage, StyleSheet, type ViewStyle } from 'react-native';
import { useBackgroundConfig, type BackgroundConfig } from '../../services/cosmeticEditorConfigs';

let SkiaMod: any = null;
let ReanimatedMod: any = null;
try { SkiaMod = require('@shopify/react-native-skia'); } catch { SkiaMod = null; }
try { ReanimatedMod = require('react-native-reanimated'); } catch { ReanimatedMod = null; }



// Reanimated noop fallback — koşulsuz hook çağrısı için
const _useStableValue = ReanimatedMod?.useSharedValue
  ? ReanimatedMod.useSharedValue
  : (initial: any) => ({ value: initial });
const _useStableDerived = ReanimatedMod?.useDerivedValue
  ? ReanimatedMod.useDerivedValue
  : (fn: () => any) => { try { return { value: fn() }; } catch { return { value: 0 }; } };

interface Props {
  bgItemId: string | null | undefined;
  context?: 'profile' | 'room' | 'chat' | 'home' | 'myrooms' | 'messages' | 'edit-profile' | 'leaderboard' | 'notifications';
  children?: React.ReactNode;
  style?: ViewStyle;
}

export function CosmeticBackground({ bgItemId, context = 'profile', children, style }: Props) {
  const cfg = useBackgroundConfig(bgItemId);

  // Görünürlük kontrolü
  if (cfg) {
    if (context === 'profile' && !cfg.applies_to_profile) return <View style={[styles.fill, style]}>{children}</View>;
    if (context === 'room' && !cfg.applies_to_room) return <View style={[styles.fill, style]}>{children}</View>;
    if (context === 'chat' && !cfg.applies_to_chat) return <View style={[styles.fill, style]}>{children}</View>;
  }

  if (!cfg || !SkiaMod) return <View style={[styles.fill, style]}>{children}</View>;

  return (
    <SkiaErrorBoundary fallbackStyle={[styles.fill, { backgroundColor: cfg.fallback_color }, style]}>
      <BgRender cfg={cfg} style={style}>{children}</BgRender>
    </SkiaErrorBoundary>
  );
}

// Skia'nın garanti olduğu component — koşulsuz hook çağrıları
function BgRender({ cfg, children, style }: { cfg: BackgroundConfig; children?: React.ReactNode; style?: ViewStyle }) {
  const Skia = SkiaMod; // garantili (parent kontrolü)
  const [size, setSize] = React.useState({ w: 0, h: 0 });

  // Reanimated shared values (pan/zoom/ken-burns) — koşulsuz hook
  const { withRepeat, withTiming, Easing, cancelAnimation } = ReanimatedMod || {};
  const t = _useStableValue(0);

  useEffect(() => {
    if (!t || !ReanimatedMod) return;
    cancelAnimation?.(t);
    if (cfg.animation === 'none') { t.value = 0; return; }
    const dur = (cfg.anim_speed_sec || 20) * 1000;
    if (cfg.animation === 'rotate') {
      t.value = withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1, false);
    } else {
      t.value = withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) }), -1, true);
    }
    return () => { try { cancelAnimation?.(t); } catch {} };
  }, [cfg.animation, cfg.anim_speed_sec]);

  // ColorMatrix filter — brightness/contrast/saturation/hue/sepia/invert
  const colorMatrix = React.useMemo(() => {
    // 5x4 color matrix — brightness × saturation × contrast birleşik approx
    const b = cfg.brightness;
    const c = cfg.contrast;
    const off = (1 - c) * 0.5 * 255 / 255; // contrast offset
    // saturation matrix (linear approx)
    const sR = 0.213, sG = 0.715, sB = 0.072;
    const s = cfg.saturation;
    const cosH = Math.cos((cfg.hue_rotate * Math.PI) / 180);
    const sinH = Math.sin((cfg.hue_rotate * Math.PI) / 180);
    // Combined: just brightness*contrast for now (full hue rotate ekstra matris)
    const k = b * c;
    return [
      k * (sR + (1 - sR) * s), k * (sG - sG * s), k * (sB - sB * s), 0, off,
      k * (sR - sR * s), k * (sG + (1 - sG) * s), k * (sB - sB * s), 0, off,
      k * (sR - sR * s), k * (sG - sG * s), k * (sB + (1 - sB) * s), 0, off,
      0, 0, 0, 1, 0,
    ];
  }, [cfg.brightness, cfg.contrast, cfg.saturation, cfg.hue_rotate]);

  // Transform (pan/zoom/ken-burns) — koşulsuz hook
  const transform = _useStableDerived(() => {
    'worklet';
    const tr: any[] = [];
    const v = t.value;
    const amp = cfg.anim_amplitude || 0.5;
    if (cfg.animation === 'pan' || cfg.animation === 'parallax-scroll') {
      tr.push({ translateX: v * 30 * amp });
      tr.push({ translateY: v * 30 * amp });
    } else if (cfg.animation === 'zoom') {
      tr.push({ scale: 1 + v * 0.3 * amp });
    } else if (cfg.animation === 'ken-burns') {
      tr.push({ scale: 1 + v * (cfg.ken_burns_zoom_to - 1) });
      tr.push({ translateX: -v * 20 * amp });
      tr.push({ translateY: -v * 20 * amp });
    } else if (cfg.animation === 'rotate') {
      tr.push({ rotate: v * 2 * Math.PI });
    }
    return tr;
  });

  // Image source — koşulsuz hook (Skia guaranteed exists)
  const imageUri = cfg.bg_type === 'image' && cfg.image_url ? cfg.image_url : null;
  // ★ v1.7.13.143 FIX: useImage('') → "Expected arraybuffer" crash. null geçince Skia decode atlar.
  const imageSrc = Skia.useImage(imageUri);

  if (size.w === 0 || size.h === 0) {
    return (
      <View style={[styles.fill, { backgroundColor: cfg.fallback_color }, style]}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {children}
      </View>
    );
  }

  const { Canvas, Image, Group, Rect, LinearGradient, RadialGradient, ColorMatrix, BlurMask, vec } = Skia;

  return (
    <View style={[styles.fill, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Group transform={transform}>
          {/* Fallback solid */}
          <Rect x={0} y={0} width={size.w} height={size.h} color={cfg.fallback_color} />

          {/* Bg layer */}
          {cfg.bg_type === 'image' && imageSrc && (
            <Image image={imageSrc} x={0} y={0} width={size.w} height={size.h} fit={cfg.image_fit as any} opacity={cfg.image_opacity}>
              <ColorMatrix matrix={colorMatrix} />
              {cfg.blur_enabled && cfg.blur_amount > 0 && <BlurMask blur={cfg.blur_amount} style="normal" />}
            </Image>
          )}

          {cfg.bg_type === 'solid' && (
            <Rect x={0} y={0} width={size.w} height={size.h} color={cfg.solid_color} />
          )}

          {cfg.bg_type === 'gradient' && (
            <Rect x={0} y={0} width={size.w} height={size.h}>
              {cfg.gradient_type === 'linear' ? (
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(
                    Math.sin((cfg.gradient_angle * Math.PI) / 180) * size.w,
                    Math.cos((cfg.gradient_angle * Math.PI) / 180) * size.h
                  )}
                  colors={cfg.gradient_stops.map((s: string) => s.split(' ')[0])}
                />
              ) : (
                <RadialGradient c={vec(size.w / 2, size.h / 2)} r={size.w / 2}
                  colors={cfg.gradient_stops.map((s: string) => s.split(' ')[0])}
                />
              )}
            </Rect>
          )}

          {cfg.bg_type === 'radial' && (
            <Rect x={0} y={0} width={size.w} height={size.h}>
              <RadialGradient
                c={vec(size.w / 2, size.h / 2)}
                r={(size.w / 2) * (cfg.radial_size / 100)}
                colors={[cfg.radial_color_in, cfg.radial_color_out]}
              />
            </Rect>
          )}
        </Group>

        {/* Overlay (tint) */}
        {cfg.overlay_enabled && (
          <Rect x={0} y={0} width={size.w} height={size.h} color={cfg.overlay_color} opacity={cfg.overlay_opacity} />
        )}

        {/* Vignette (radial gradient) */}
        {cfg.vignette_enabled && (
          <Rect x={0} y={0} width={size.w} height={size.h}>
            <RadialGradient
              c={vec(size.w / 2, size.h / 2)}
              r={Math.max(size.w, size.h) * 0.7}
              colors={['transparent', cfg.vignette_color]}
            />
          </Rect>
        )}
      </Canvas>

      {/* Children content over bg */}
      <View style={{ flex: 1, zIndex: 1 }}>{children}</View>

      {/* Video fallback — RN Video (Skia video oynatamaz) */}
      {cfg.bg_type === 'video' && cfg.image_url && (
        <RNImage
          source={{ uri: cfg.image_url }}
          style={[StyleSheet.absoluteFill, { opacity: 0.3 }]}
          resizeMode="cover"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, position: 'relative' },
});

// ★ v1.7.13.143: Skia Canvas crash'lerini yakala — "Expected arraybuffer" gibi native hatalar
class SkiaErrorBoundary extends Component<
  { children: React.ReactNode; fallbackStyle?: any },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: any) {
    if (__DEV__) console.warn('[CosmeticBackground] Skia crash, falling back:', err?.message);
  }
  render() {
    if (this.state.hasError) {
      return <View style={this.props.fallbackStyle}>{this.props.children}</View>;
    }
    return this.props.children;
  }
}
