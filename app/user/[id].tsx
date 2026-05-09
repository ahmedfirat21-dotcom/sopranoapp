/**
 * SopranoChat — Kullanıcı Profili Bouncer
 * ═══════════════════════════════════════════════════
 * ★ v110 (6 May 2026): Tam profil sayfası KALDIRILDI.
 *   Tüm profil verileri (avatar, bio, stats, üyelik, cüzdan, ARKADAŞLAR, ODALAR,
 *   SP gönder, rapor, engelle) artık global InRoomUserProfile sheet'inde gösteriliyor.
 *
 *   Bu route hâlâ mevcut çünkü:
 *     - Deep link `sopranochat://user/<id>` veya https://sopranochat.com/user/<id>
 *     - Eski uygulama içi push çağrıları (geriye uyumluluk)
 *
 *   Davranış: route mount olunca → sheet'i aç → bir önceki ekrana geri dön
 *   (deep link entry'sinde geçmiş yoksa ana sayfaya).
 */
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUserProfileSheet } from '../../providers/UserProfileSheetContext';

export default function UserProfileBouncer() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = (params.id as string) || '';
  const { openUserProfile } = useUserProfileSheet();
  const bouncedRef = useRef(false);

  useEffect(() => {
    if (!id || bouncedRef.current) return;
    bouncedRef.current = true;
    // Sheet'i aç, sonra geri dön — kullanıcı sheet'i kapattığında route stack'te kalmasın.
    openUserProfile(id);
    // Geçmişe dön; yoksa home (deep link senaryosu)
    setTimeout(() => {
      try {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/home' as any);
      } catch {
        router.replace('/(tabs)/home' as any);
      }
    }, 50);
  }, [id]);

  return <View style={{ flex: 1, backgroundColor: '#0A0F1A' }} />;
}
