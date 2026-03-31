/**
 * SopranoChat — Mikrofon Ses Seviyesi Simülasyonu
 * expo-av native modülü Expo Go'da çalışmadığı için,
 * mikrofon açıkken organik bir ses dalgası simülasyonu üretir.
 * LiveKit bağlantısı aktifken gerçek audioLevel kullanılır.
 * 
 * ⚡ Performans: useRef ile state güncellemesi throttle edildi (250ms)
 *    önceki 80ms interval → saniyede 12 re-render → donma yapıyordu
 */
import { useEffect, useRef, useState, useCallback } from 'react';

export function useMicMeter(enabled: boolean): number {
  const [audioLevel, setAudioLevel] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const levelRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setAudioLevel(0);
      levelRef.current = 0;
      return;
    }

    // Her 250ms'de ses seviyesi hesapla ve state güncelle
    // (eskisi 80ms idi → saniyede 12.5 re-render → donmaya neden oluyordu)
    intervalRef.current = setInterval(() => {
      phaseRef.current += 0.25;
      const t = phaseRef.current;

      // Doğal konuşma ritmi simülasyonu
      const wave1 = Math.sin(t * 2.5) * 0.3;
      const wave2 = Math.sin(t * 7.3) * 0.2;
      const wave3 = Math.sin(t * 13.7) * 0.1;
      const noise = (Math.random() - 0.5) * 0.25;
      const burst = Math.max(0, Math.sin(t * 1.1)) * 0.15;

      const raw = 0.35 + wave1 + wave2 + wave3 + noise + burst;
      const level = Math.max(0.05, Math.min(1.0, raw));

      levelRef.current = level;
      setAudioLevel(level);
    }, 250); // 80ms → 250ms (saniyede 4 güncelleme yeterli)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);

  return audioLevel;
}
