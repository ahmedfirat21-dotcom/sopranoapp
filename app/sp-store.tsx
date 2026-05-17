/**
 * SopranoChat — Eski SP Mağaza Ekranı (DEPRECATED v300)
 * ═══════════════════════════════════════════════════════════════════
 * Asıl SP satın alma akışı artık tek mağaza ekranında: Maison Soprano
 * (`app/store.tsx`). Bu route geriye uyumluluk için kalıyor — eski deep
 * link / Ayarlar / push notification yönlendirmeleri kırılmasın diye
 * doğrudan /store sayfasına bounce eder.
 *
 * Bouncing pattern: app/user/[id].tsx ile aynı (route mount → redirect → 0ms).
 */
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

export default function SPStoreBouncer() {
  const router = useRouter();
  const bouncedRef = useRef(false);

  useEffect(() => {
    if (bouncedRef.current) return;
    bouncedRef.current = true;
    // Replace — geri tuşu /sp-store'a takılmasın
    router.replace('/store' as any);
  }, [router]);

  return <View style={{ flex: 1, backgroundColor: '#0A0F1A' }} />;
}
