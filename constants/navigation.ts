/**
 * Güvenli Navigation Yardımcıları
 * GO_BACK hatasını önler — yığında geri gidilecek ekran yoksa ana sayfaya yönlendirir.
 */
import type { Router } from 'expo-router';

/**
 * Güvenli geri gitme — yığında ekran varsa back(), yoksa home'a replace.
 */
export function safeGoBack(router: Router) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(tabs)/home' as any);
  }
}
