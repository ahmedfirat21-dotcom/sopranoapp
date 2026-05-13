/**
 * EntryEffectExtras — Giriş animasyonu için partikül + sahne efekti + aura layer'ları
 * ════════════════════════════════════════════════════════════════════
 * v117 — entry_config'in yeni alanlarını (particles_*, scene_*, aura_*, halo_*)
 * Skia ile render eder. RoomEntryEffectOverlay tarafından mount edilir.
 * Visible: intro tamamlandığı anda mount → duration_ms sonra unmount.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import type { EntryConfig } from '../../services/cosmeticConfigCache';

let SkiaMod: any = null;
try { SkiaMod = require('@shopify/react-native-skia'); } catch {}

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  cfg: EntryConfig;
  active: boolean;        // intro+loop fazında true, outro'da false
}

type P = {
  x: number; y: number;
  vx: number; vy: number;
  size: number; color: string;
  rot: number; vrot: number;
  born: number; life: number;
};

export function EntryEffectExtras({ cfg, active }: Props) {
  if (!SkiaMod || !active) return null;
  const hasAny =
    cfg.particles_enabled ||
    cfg.scene_flash_enabled || cfg.scene_shake_enabled ||
    cfg.scene_vignette_enabled || cfg.scene_color_tint_enabled ||
    cfg.aura_enabled || cfg.halo_ring_enabled;
  if (!hasAny) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cfg.particles_enabled && <ParticlesLayer cfg={cfg} />}
      {(cfg.scene_flash_enabled || cfg.scene_vignette_enabled || cfg.scene_color_tint_enabled) && (
        <SceneLayer cfg={cfg} />
      )}
    </View>
  );
}

function ParticlesLayer({ cfg }: { cfg: EntryConfig }) {
  const Skia = SkiaMod;
  if (!Skia) return null;
  const { Canvas, Path, Group } = Skia;
  const particlesRef = useRef<P[]>([]);
  const [, force] = useState(0);
  const startedRef = useRef(performance.now());
  const lastEmitRef = useRef(performance.now());
  const lastFrameRef = useRef(performance.now());
  const rafRef = useRef<number | null>(null);
  const pathCache = useRef<Map<string, any>>(new Map());

  const emitX = W * (cfg.particles_emit_x ?? 0.5);
  const emitY = H * (cfg.particles_emit_y ?? 0.5);
  const count = cfg.particles_count ?? 40;
  const lifetime = cfg.particles_lifetime_ms ?? 2500;
  const speedMul = cfg.particles_speed ?? 1;
  const palette = cfg.particles_color_palette && cfg.particles_color_palette.length > 0
    ? cfg.particles_color_palette : ['#FBBF24'];

  function spawn(now: number) {
    const spread = ((cfg.particles_spread_deg ?? 180) * Math.PI) / 180;
    const baseAngle = -Math.PI / 2;
    const angle = baseAngle + (Math.random() - 0.5) * spread;
    const speed = (80 + Math.random() * 140) * speedMul;
    const sMin = cfg.particles_size_min ?? 6;
    const sMax = cfg.particles_size_max ?? 14;
    const size = sMin + Math.random() * Math.max(0, sMax - sMin);
    const color = palette[Math.floor(Math.random() * palette.length)];
    particlesRef.current.push({
      x: emitX, y: emitY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size, color,
      rot: Math.random() * Math.PI * 2,
      vrot: ((cfg.particles_rotation_speed ?? 180) * Math.PI / 180) * (0.4 + Math.random()),
      born: now,
      life: lifetime,
    });
  }

  useEffect(() => {
    particlesRef.current = [];
    if (cfg.particles_burst) {
      for (let i = 0; i < count; i++) spawn(performance.now());
    }
    function tick() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;
      if (!cfg.particles_burst) {
        const interval = 1000 / Math.max(1, cfg.particles_emit_rate ?? 8);
        while (now - lastEmitRef.current > interval && particlesRef.current.length < count) {
          spawn(now);
          lastEmitRef.current += interval;
        }
      }
      const gravity = (cfg.particles_gravity ?? 0.3) * 250;
      const arr = particlesRef.current;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        if (now - p.born > p.life) { arr.splice(i, 1); continue; }
        p.vy += gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
      }
      force(v => (v + 1) % 1000);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [cfg]);

  function buildPath(type: string, size: number): any {
    const path = Skia.Path.Make();
    const s = size;
    switch (type) {
      case 'stars':
      case 'sparkles': {
        const points = type === 'stars' ? 5 : 4;
        for (let i = 0; i < points * 2; i++) {
          const r = i % 2 === 0 ? s / 2 : s / 5;
          const a = (i * Math.PI) / points - Math.PI / 2;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
        }
        path.close(); break;
      }
      case 'hearts': {
        path.moveTo(0, s * 0.35);
        path.cubicTo(-s * 0.6, -s * 0.1, -s * 0.6, -s * 0.5, 0, -s * 0.15);
        path.cubicTo(s * 0.6, -s * 0.5, s * 0.6, -s * 0.1, 0, s * 0.35);
        path.close(); break;
      }
      case 'confetti': {
        path.addRect(Skia.XYWHRect(-s / 2, -s / 4, s, s / 2));
        break;
      }
      case 'snowflakes': {
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          path.moveTo(0, 0);
          path.lineTo(Math.cos(a) * s / 2, Math.sin(a) * s / 2);
        }
        break;
      }
      case 'glitter':
      case 'firefly':
      default: path.addCircle(0, 0, s / 2);
    }
    return path;
  }
  function getPath(type: string, size: number) {
    const k = `${type}_${Math.round(size)}`;
    let p = pathCache.current.get(k);
    if (!p) { p = buildPath(type, Math.round(size)); pathCache.current.set(k, p); }
    return p;
  }

  const fade = cfg.particles_fade_out ?? true;
  const type = cfg.particles_type ?? 'confetti';

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {particlesRef.current.map((p, idx) => {
        const age = performance.now() - p.born;
        const alpha = fade ? Math.max(0, 1 - age / p.life) : 1;
        if (alpha < 0.02) return null;
        return (
          <Group key={idx} transform={[{ translateX: p.x }, { translateY: p.y }, { rotate: p.rot }]}>
            <Path
              path={getPath(type, p.size)}
              color={p.color}
              opacity={alpha}
              style={type === 'snowflakes' ? 'stroke' : 'fill'}
              strokeWidth={type === 'snowflakes' ? 1.5 : 0}
            />
          </Group>
        );
      })}
    </Canvas>
  );
}

function SceneLayer({ cfg }: { cfg: EntryConfig }) {
  const Skia = SkiaMod;
  if (!Skia) return null;
  const { Canvas, Rect, RadialGradient, vec } = Skia;

  const [flashAlpha, setFlashAlpha] = useState(cfg.scene_flash_enabled ? (cfg.scene_flash_intensity ?? 0.6) : 0);

  useEffect(() => {
    if (!cfg.scene_flash_enabled) return;
    const dur = cfg.scene_flash_duration_ms ?? 300;
    setFlashAlpha(cfg.scene_flash_intensity ?? 0.6);
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / dur);
      setFlashAlpha((cfg.scene_flash_intensity ?? 0.6) * (1 - t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cfg.scene_flash_enabled, cfg.scene_flash_duration_ms, cfg.scene_flash_intensity]);

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {/* Color tint */}
      {cfg.scene_color_tint_enabled && (
        <Rect x={0} y={0} width={W} height={H}
          color={cfg.scene_color_tint_color ?? '#FBBF24'}
          opacity={cfg.scene_color_tint_intensity ?? 0.25}
        />
      )}
      {/* Vignette */}
      {cfg.scene_vignette_enabled && (
        <Rect x={0} y={0} width={W} height={H}>
          <RadialGradient
            c={vec(W / 2, H / 2)}
            r={Math.max(W, H) * (cfg.scene_vignette_size ?? 0.7)}
            colors={['transparent', cfg.scene_vignette_color ?? '#000000']}
          />
        </Rect>
      )}
      {/* Flash (fading) */}
      {cfg.scene_flash_enabled && flashAlpha > 0.01 && (
        <Rect x={0} y={0} width={W} height={H}
          color={cfg.scene_flash_color ?? '#FFFFFF'}
          opacity={flashAlpha}
        />
      )}
    </Canvas>
  );
}
