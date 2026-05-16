/**
 * useAnimatedLoop — Animated.loop için cleanup-safe React hook
 * ═════════════════════════════════════════════════════════════════
 * ★ v284 (16 May 2026)
 *
 * SORUN:
 *   `Animated.loop(...).start()` doğrudan çağrıldığında loop instance ref'i
 *   yakalanmaz. Component unmount olduğunda veya `value.stopAnimation()`
 *   çağrıldığında loop sequence callback yeni iterasyon spawn eder → orphan
 *   loop birikir → FPS düşer.
 *
 * ÇÖZÜM:
 *   Loop instance ref olarak tutulup `loop.stop()` ile durdurulur.
 *   Bu hook factory pattern ile loop'u oluşturur, active flag ile başlat/durdur.
 *
 * Kullanım:
 *
 *   // Basit — her zaman çalışsın
 *   useAnimatedLoop(() => Animated.loop(
 *     Animated.sequence([
 *       Animated.timing(opacity, { toValue: 1, duration: 1500, useNativeDriver: true }),
 *       Animated.timing(opacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
 *     ])
 *   ), []);
 *
 *   // Koşullu — visible iken çalışsın (modal aç-kapat senaryo)
 *   useAnimatedLoop(
 *     () => Animated.loop(...),
 *     [visible],
 *     visible, // active flag
 *   );
 *
 *   // Birden fazla loop bir component içinde — sadece hook'u çoğul çağır
 *   useAnimatedLoop(() => createLoopA(), []);
 *   useAnimatedLoop(() => createLoopB(), []);
 */
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

type LoopFactory = () => Animated.CompositeAnimation;

export function useAnimatedLoop(factory: LoopFactory, deps: React.DependencyList = [], active: boolean = true): void {
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!active) {
      loopRef.current?.stop();
      loopRef.current = null;
      return;
    }
    const loop = factory();
    loopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      if (loopRef.current === loop) loopRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, active]);
}

/**
 * Birden fazla loop bir array ile — staggered partikül animasyonları için.
 * Her loop bağımsız ref + cleanup.
 */
export function useAnimatedLoopArray(
  factoryArray: LoopFactory[],
  deps: React.DependencyList = [],
  active: boolean = true,
): void {
  const loopsRef = useRef<(Animated.CompositeAnimation | null)[]>([]);

  useEffect(() => {
    // Önce eski loop'ları durdur
    loopsRef.current.forEach(l => l?.stop());
    loopsRef.current = [];

    if (!active) return;

    const loops = factoryArray.map(f => {
      const l = f();
      l.start();
      return l;
    });
    loopsRef.current = loops;

    return () => {
      loops.forEach(l => l?.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, active]);
}
