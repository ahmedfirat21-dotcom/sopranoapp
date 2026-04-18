/**
 * Güvenli Navigation Yardımcıları
 * GO_BACK hatasını önler — yığında geri gidilecek ekran yoksa ana sayfaya yönlendirir.
 */
import type { Router } from 'expo-router';

/**
 * Güvenli geri gitme — yığında ekran varsa back(), yoksa home'a replace.
 * ★ ORTA-F: Deep link / uninitialized stack durumunda replace de fail edebilir;
 * try/catch ile son fallback olarak home'a push dene.
 */
export function safeGoBack(router: Router) {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/home' as any);
  } catch {
    try { router.replace('/(tabs)/home' as any); } catch {}
    try { router.push('/(tabs)/home' as any); } catch {}
  }
}
