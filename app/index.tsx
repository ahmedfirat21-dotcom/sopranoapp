// ★ 2026-05-09: Auth state'e göre akıllı redirect — flash önler.
//   Eski hâl: koşulsuz /(tabs)/home redirect → AuthGuard 2. redirect ile düzeltirdi (1-2 frame flash).
//   Yeni hâl: AuthGuard zaten loader gösteriyor, biz sadece auth hazır olunca doğru yere atıyoruz.
import { Redirect } from 'expo-router';
import { useAuth } from './_layout';

export default function Index() {
  const { isAuthReady, isLoggedIn } = useAuth();
  // AuthGuard isAuthReady=false iken kendi loader'ını gösteriyor; biz null döndürürsek o devreye girer.
  if (!isAuthReady) return null;
  return <Redirect href={isLoggedIn ? '/(tabs)/home' : '/(auth)/login'} />;
}
