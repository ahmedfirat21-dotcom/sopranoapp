/**
 * CosmeticParticleEffect — Web admin "Efektler" config'i tüketen Skia partikül sistemi
 * ════════════════════════════════════════════════════════════════════
 * v117 — Skia Canvas + Path + Group + setState/RAF döngüsü ile gerçek
 * zamanlı partikül simülasyonu (sparkle/star/heart/confetti/snowflake/
 * leaf/firefly/bubble/petal). Web admin'deki Canvas2D logic'ini birebir
 * mobile Skia'ya port eder.
 *
 * Kullanım:
 *   <CosmeticParticleEffect effectItemId={room.effect_id} context="room"
 *                            width={W} height={H} />
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useEffectConfig, type EffectConfig } from '../../services/cosmeticEditorConfigs';

let SkiaMod: any = null;
try { SkiaMod = require('@shopify/react-native-skia'); } catch {}

interface Props {
  effectItemId: string | null | undefined;
  context?: 'profile' | 'room' | 'chat' | 'app';
  width: number;
  height: number;
}

type ParticleState = {
  x: number; y: number;
  vx: number; vy: number;
  size: number; color: string;
  rot: number; vrot: number;
  born: number; life: number;
};

export function CosmeticParticleEffect({ effectItemId, context = 'room', width, height }: Props) {
  const cfg = useEffectConfig(effectItemId);

  if (!cfg) return null;
  if (context === 'profile' && !cfg.applies_to_profile) return null;
  if (context === 'room' && !cfg.applies_to_room) return null;
  if (context === 'chat' && !cfg.applies_to_chat) return null;
  if (context === 'app' && !cfg.applies_to_app_wide) return null;

  return <ParticleCanvas cfg={cfg} width={width} height={height} />;
}

function ParticleCanvas({ cfg, width, height }: { cfg: EffectConfig; width: number; height: number }) {
  const Skia = SkiaMod;
  if (!Skia) return null;

  const { Canvas, Path, Group, Rect, RadialGradient, vec } = Skia;
  const particlesRef = useRef<ParticleState[]>([]);
  const [, force] = useState(0);
  const startedRef = useRef<number>(performance.now());
  const lastEmitRef = useRef<number>(performance.now());
  const lastFrameRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);

  // Emit area
  function emitPos(): { x: number; y: number } {
    switch (cfg.particle_emit_area) {
      case 'top': return { x: Math.random() * width, y: 0 };
      case 'bottom': return { x: Math.random() * width, y: height };
      case 'left': return { x: 0, y: Math.random() * height };
      case 'right': return { x: width, y: Math.random() * height };
      case 'center': return { x: width / 2 + (Math.random() - 0.5) * 40, y: height / 2 + (Math.random() - 0.5) * 40 };
      default: return { x: Math.random() * width, y: Math.random() * height };
    }
  }

  function spawn(now: number) {
    const palette = cfg.particle_color_palette.length > 0 ? cfg.particle_color_palette : ['#FBBF24'];
    const color = palette[Math.floor(Math.random() * palette.length)];
    const speed = cfg.particle_velocity_min + Math.random() * Math.max(0, cfg.particle_velocity_max - cfg.particle_velocity_min);
    const angle = Math.random() * Math.PI * 2;
    const size = cfg.particle_size_min + Math.random() * Math.max(0, cfg.particle_size_max - cfg.particle_size_min);
    const { x, y } = emitPos();
    particlesRef.current.push({
      x, y,
      vx: Math.cos(angle) * speed * cfg.animation_speed,
      vy: Math.sin(angle) * speed * cfg.animation_speed,
      size, color,
      rot: Math.random() * Math.PI * 2,
      vrot: (cfg.particle_rotation_speed * Math.PI / 180) * (0.4 + Math.random()),
      born: now,
      life: cfg.particle_lifetime_sec * 1000,
    });
  }

  useEffect(() => {
    startedRef.current = performance.now();
    lastEmitRef.current = performance.now();
    lastFrameRef.current = performance.now();
    particlesRef.current = [];

    // Initial burst
    if (cfg.effect_type === 'particles' || cfg.effect_type === 'snow' || cfg.effect_type === 'rain') {
      for (let i = 0; i < Math.min(20, cfg.particle_count); i++) spawn(performance.now());
    }

    function tick() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;

      // Emit
      if (cfg.effect_type === 'particles' || cfg.effect_type === 'snow' || cfg.effect_type === 'rain') {
        const interval = 1000 / Math.max(1, cfg.particle_emit_rate_per_sec);
        while (now - lastEmitRef.current > interval && particlesRef.current.length < cfg.particle_count) {
          spawn(now);
          lastEmitRef.current += interval;
        }
      }

      // Update
      const gravity = cfg.particle_gravity * 200;
      const arr = particlesRef.current;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        const age = now - p.born;
        if (age > p.life) { arr.splice(i, 1); continue; }
        p.vy += gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
      }

      // ★ Trigger re-render (Skia particles için)
      force(v => (v + 1) % 1000);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [cfg]);

  // Path builder — partikül tipine göre Skia Path
  function buildPath(type: string, size: number): any {
    const path = Skia.Path.Make();
    const s = size;
    switch (type) {
      case 'sparkle':
      case 'star': {
        const points = type === 'star' ? 5 : 4;
        for (let i = 0; i < points * 2; i++) {
          const r = i % 2 === 0 ? s / 2 : s / 5;
          const a = (i * Math.PI) / points - Math.PI / 2;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
        }
        path.close();
        break;
      }
      case 'heart': {
        path.moveTo(0, s * 0.35);
        path.cubicTo(-s * 0.6, -s * 0.1, -s * 0.6, -s * 0.5, 0, -s * 0.15);
        path.cubicTo(s * 0.6, -s * 0.5, s * 0.6, -s * 0.1, 0, s * 0.35);
        path.close();
        break;
      }
      case 'confetti': {
        path.addRect(Skia.XYWHRect(-s / 2, -s / 4, s, s / 2));
        break;
      }
      case 'snowflake': {
        // 6 kollu — Skia Path stroke modu yok arrow gibi, basit lines
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          path.moveTo(0, 0);
          path.lineTo(Math.cos(a) * s / 2, Math.sin(a) * s / 2);
        }
        break;
      }
      case 'leaf':
      case 'petal': {
        path.addOval(Skia.XYWHRect(-s / 3, -s / 2, s * 2 / 3, s));
        break;
      }
      case 'firefly':
      case 'bubble': {
        path.addCircle(0, 0, s / 2);
        break;
      }
      default: path.addCircle(0, 0, s / 2);
    }
    return path;
  }

  const pathCache = useRef<Map<string, any>>(new Map());
  function getPath(type: string, size: number) {
    const k = `${type}_${Math.round(size)}`;
    let p = pathCache.current.get(k);
    if (!p) {
      p = buildPath(type, Math.round(size));
      pathCache.current.set(k, p);
    }
    return p;
  }

  return (
    <View style={[styles.canvas, { width, height, zIndex: cfg.layer_z_index }]} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Vignette */}
        {cfg.scene_vignette_enabled && (
          <Rect x={0} y={0} width={width} height={height}>
            <RadialGradient
              c={vec(width / 2, height / 2)}
              r={Math.max(width, height) * 0.7}
              colors={['transparent', `rgba(0,0,0,${cfg.scene_vignette_intensity})`]}
            />
          </Rect>
        )}

        {/* Particles */}
        {particlesRef.current.map((p, idx) => {
          const age = performance.now() - p.born;
          const ageNorm = age / p.life;
          const alpha = cfg.particle_fade_out ? Math.max(0, 1 - ageNorm) * cfg.particle_opacity : cfg.particle_opacity;
          if (alpha < 0.02) return null;
          return (
            <Group key={idx} transform={[{ translateX: p.x }, { translateY: p.y }, { rotate: p.rot }]}>
              <Path
                path={getPath(cfg.particle_type, p.size)}
                color={p.color}
                opacity={alpha}
                style={cfg.particle_type === 'snowflake' ? 'stroke' : 'fill'}
                strokeWidth={cfg.particle_type === 'snowflake' ? 1.5 : 0}
              />
            </Group>
          );
        })}

        {/* Scene overlay */}
        {cfg.scene_overlay_opacity > 0 && (
          <Rect x={0} y={0} width={width} height={height} color={cfg.scene_overlay_color} opacity={cfg.scene_overlay_opacity} />
        )}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'absolute', top: 0, left: 0 },
});
