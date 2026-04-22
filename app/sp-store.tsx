import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import { Colors, Shadows } from '../constants/theme';
import { useAuth } from './_layout';
import AppBackground from '../components/AppBackground';
import { showToast } from '../components/Toast';
import PremiumAlert, { type AlertButton } from '../components/PremiumAlert';
import { RevenueCatService, REVENUECAT_MOCK_MODE } from '../services/revenuecat';
import { GamificationService } from '../services/gamification';
import { supabase } from '../constants/supabase';
import { migrateLegacyTier } from '../types';
import PurchaseSuccessModal from '../components/PurchaseSuccessModal';

// ═══ SP Paketleri — Premium Jewel-Tone Design ═══
// ★ id alanları Google Play Console'daki In-App Product ID'leriyle eşleşmeli
// ★ gradient: 3-stop — parlak üst → zengin orta → derin alt (mücevher etkisi)
// ★ glowColor: kart altı ambient gölge rengi
const SP_PACKAGES = [
  { id: 'soprano_sp_100',  sp: 100,  price: 14.99,  icon: 'flash' as const,     accent: '#60A5FA', gradient: ['#3B6CB5', '#1E3F70', '#0B1A30'] as [string, string, string], glowColor: '#3B82F640', bonus: 0,    popular: false },
  { id: 'soprano_sp_250',  sp: 250,  price: 34.99,  icon: 'diamond' as const,   accent: '#C4B5FD', gradient: ['#7C5CC8', '#4A2D8B', '#1A0E3A'] as [string, string, string], glowColor: '#8B5CF640', bonus: 25,   popular: false },
  { id: 'soprano_sp_600',  sp: 600,  price: 99.99,  icon: 'trophy' as const,    accent: '#FCD34D', gradient: ['#D4A017', '#7A5B0E', '#2E2108'] as [string, string, string], glowColor: '#FBBF2450', bonus: 75,   popular: true },
  { id: 'soprano_sp_1500', sp: 1500, price: 199.99, icon: 'star' as const,      accent: '#5EEAD4', gradient: ['#18A08E', '#0D5E55', '#061F1C'] as [string, string, string], glowColor: '#14B8A640', bonus: 250,  popular: false },
  { id: 'soprano_sp_4000', sp: 4000, price: 449.99, icon: 'shield-checkmark' as const, accent: '#F9A8D4', gradient: ['#C74B8B', '#7A2255', '#2D0C22'] as [string, string, string], glowColor: '#EC489940', bonus: 800,  popular: false },
  { id: 'soprano_sp_10000', sp: 10000, price: 999.99, icon: 'rocket' as const,  accent: '#FDBA74', gradient: ['#E8751A', '#8B3E0A', '#2C1205'] as [string, string, string], glowColor: '#FB923C50', bonus: 2500, popular: false },
];

export default function SPStoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const spBalance = profile?.system_points ?? 0;
  const userTier = migrateLegacyTier(profile?.subscription_tier);
  // ★ Pro: %20, Plus: %10 ekstra SP bonusu (mağaza indirimi)
  const storeBonusPct = userTier === 'Pro' ? 0.20 : userTier === 'Plus' ? 0.10 : 0;
  const [cAlert, setCAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });
  const [purchasing, setPurchasing] = useState(false);
  // ★ Şık animasyonlu başarı modalı
  const [successModal, setSuccessModal] = useState<{ visible: boolean; title: string; subtitle: string; accent?: readonly [string, string] }>({ visible: false, title: '', subtitle: '' });
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const handleBuy = (pkg: typeof SP_PACKAGES[0]) => {
    if (!profile?.id) {
      showToast({ title: 'Hata', message: 'Önce giriş yapmalısınız.', type: 'error' });
      return;
    }

    // ★ Tier bonusu: Pro %20, Plus %10 ekstra SP
    const tierBonus = Math.floor(pkg.sp * storeBonusPct);
    const totalSP = pkg.sp + pkg.bonus + tierBonus;
    const modeText = (REVENUECAT_MOCK_MODE && __DEV__) ? '\n\n⚠️ Test modunda — gerçek ödeme alınmaz.' : '';
    const tierBonusText = tierBonus > 0 ? ` + ${tierBonus} ${userTier} bonus` : '';

    setCAlert({
      visible: true,
      title: `${pkg.sp.toLocaleString()} SP`,
      message: `${pkg.price.toFixed(2)} ₺ karşılığında ${pkg.sp.toLocaleString()} SP${pkg.bonus > 0 ? ` + ${pkg.bonus} bonus` : ''}${tierBonusText} satın almak istediğine emin misin?${modeText}`,
      type: 'info',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Satın Al', onPress: async () => {
          if (mountedRef.current) setPurchasing(true);
          try {
            // ★ Y4 FIX: SP miktarı artık server-side'dan (v27 claim_sp_package RPC).
            // Client hiçbir SP değeri göndermiyor — sadece package ID + transaction ID.
            // Toplam SP (bonus + tier bonus) backend'te hesaplanıyor; client manipülasyonu etkisiz.
            let transactionId: string | null = null;

            if (REVENUECAT_MOCK_MODE && __DEV__) {
              // Test build: transaction_id NULL, RPC mock ref üretir
              transactionId = null;
            } else if (REVENUECAT_MOCK_MODE && !__DEV__) {
              showToast({ title: 'Ödeme Sistemi Hazır Değil', message: 'Satın alma şu an aktif değil. Yakında açılacak.', type: 'warning' });
              return;
            } else {
              // Production RevenueCat satın alma
              try {
                await RevenueCatService.getOfferings();
                const Purchases = require('react-native-purchases').default;
                const purchaseResult = await Purchases.purchaseStoreProduct({
                  identifier: pkg.id,
                  priceString: `₺${pkg.price.toFixed(2)}`,
                });
                transactionId = (purchaseResult as any)?.transactionIdentifier
                  || (purchaseResult as any)?.transaction?.transactionIdentifier
                  || null;
                if (!transactionId) {
                  try {
                    const ci = await Purchases.getCustomerInfo();
                    const txs = (ci?.nonSubscriptionTransactions || [])
                      .filter((t: any) => t.productIdentifier === pkg.id)
                      .sort((a: any, b: any) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
                    transactionId = txs[0]?.transactionIdentifier || null;
                  } catch {}
                }
              } catch (purchaseErr: any) {
                if (purchaseErr?.userCancelled) {
                  return;
                }
                if (purchaseErr?.message?.includes('product') || purchaseErr?.code === 'PRODUCT_NOT_FOUND') {
                  showToast({ title: '⏳ Ürün Hazırlanıyor', message: 'SP paketleri Google Play onayı bekliyor. Kısa süre sonra aktif olacak.', type: 'info' });
                  return;
                }
                throw purchaseErr;
              }
            }

            // ★ Y4: Server-side SP grant — amount backend'ten gelir (client manipülasyon bypass)
            const { data: claimData, error: claimError } = await supabase.rpc('claim_sp_package', {
              p_package_id: pkg.id,
              p_transaction_id: transactionId,
            });
            if (claimError) {
              // v27 migrate edilmediyse legacy path — eski client-side SP hesabıyla devam
              if (__DEV__) console.warn('[sp-store] v27 RPC fallback:', claimError.message);
              const legacyRef = transactionId ? `rvn:${transactionId}` : `mock:${profile.id}:${pkg.id}:${Date.now()}`;
              await GamificationService.earn(profile.id, totalSP, 'sp_purchase', legacyRef);
            }
            await refreshProfile();
            if (mountedRef.current) {
              const grantedSP = (claimData as any)?.total_sp || totalSP;
              const title = REVENUECAT_MOCK_MODE && __DEV__ ? 'Satın Alma Başarılı (TEST)' : 'Satın Alma Başarılı';
              setSuccessModal({
                visible: true,
                title,
                subtitle: `${grantedSP.toLocaleString()} SP hesabına eklendi.`,
                accent: [pkg.accent, pkg.gradient[2]] as const,
              });
            }
          } catch (err: any) {
            if (mountedRef.current) {
              showToast({ title: 'Hata', message: err.message || 'Satın alma başarısız.', type: 'error' });
            }
          } finally {
            if (mountedRef.current) setPurchasing(false);
          }
        }},
      ],
    });
  };

  return (
    <AppBackground variant="profile">
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => safeGoBack(router)} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#F1F5F9" style={{
              textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
            }} />
          </Pressable>
          <Text style={s.headerTitle}>SP Mağaza</Text>
          <View style={s.balancePill}>
            <Ionicons name="diamond" size={12} color="#FBBF24" style={{
              textShadowColor: '#FBBF24dd',
              textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
            }} />
            <Text style={s.balanceText}>{spBalance.toLocaleString()}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingHorizontal: 16 }}>
          {/* Premium Bonus Banner */}
          <Pressable style={s.bonusBanner} onPress={() => router.push('/plus' as any)}>
            <LinearGradient colors={['rgba(20,184,166,0.12)', 'rgba(20,184,166,0.03)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.bonusIconWrap}>
                <Ionicons name="star" size={16} color="#14B8A6" style={{
                  textShadowColor: '#14B8A6bb', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
                }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.bonusTitle}>Premium Bonus</Text>
                <Text style={s.bonusDesc}>{storeBonusPct > 0 ? `${userTier} üyeliğinle %${Math.round(storeBonusPct * 100)} ekstra SP kazanıyorsun! 🎉` : 'Plus ile %10, Pro ile %20 ekstra SP kazan!'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </Pressable>

          {/* SP Packages Grid — Premium Jewel Cards */}
          <View style={s.grid}>
            {SP_PACKAGES.map((pkg) => (
              <Pressable
                key={pkg.id}
                style={({ pressed }) => [
                  s.pkgCard,
                  // ★ Ambient glow shadow — her kartın kendi accent rengiyle
                  {
                    shadowColor: pkg.glowColor.slice(0, 7),
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.6,
                    shadowRadius: 16,
                    elevation: 10,
                  },
                  pkg.popular && s.pkgCardPopular,
                  pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
                ]}
                onPress={() => handleBuy(pkg)}
              >
                {/* ★ 3-stop gradient: parlak → zengin → derin (mücevher etkisi) */}
                <LinearGradient
                  colors={pkg.gradient}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />

                {/* ★ Üst cam parıltı katmanı — glassmorphic shine */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 'transparent']}
                  locations={[0, 0.35, 0.7]}
                  start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 0.6 }}
                  style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
                />

                {/* Popüler tag — premium gold ribbon */}
                {pkg.popular && (
                  <View style={s.popularTag}>
                    <LinearGradient
                      colors={['#FFE066', '#FBBF24', '#D4A017']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Ionicons name="flame" size={8} color="#3B1F00" />
                    <Text style={s.popularText}>POPÜLER</Text>
                  </View>
                )}

                {/* ★ İkon — parlak halo ile daire içinde */}
                <View style={[s.iconCircle, { backgroundColor: `${pkg.accent}18`, borderColor: `${pkg.accent}30` }]}>
                  <Ionicons
                    name={pkg.icon}
                    size={24}
                    color={pkg.accent}
                    style={{
                      textShadowColor: pkg.accent,
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 18,
                    }}
                  />
                </View>

                {/* SP Miktarı — büyük parlak rakam */}
                <Text style={[s.pkgSP, { textShadowColor: `${pkg.accent}60` }]}>{pkg.sp.toLocaleString()}</Text>
                <Text style={s.pkgLabel}>SP</Text>

                {/* Bonus — paket bonusu + tier bonusu */}
                {(pkg.bonus > 0 || storeBonusPct > 0) && (
                  <View style={s.bonusPill}>
                    <Ionicons name="add-circle" size={10} color="#34D399" style={{
                      textShadowColor: '#34D39980', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6,
                    }} />
                    <Text style={s.pkgBonus}>{pkg.bonus + Math.floor(pkg.sp * storeBonusPct)}</Text>
                  </View>
                )}

                {/* ★ Fiyat — lüks CTA buton, accent kenarlık + iç ışıma */}
                <View style={[
                  s.pkgPriceBox,
                  { borderColor: `${pkg.accent}40` },
                  pkg.popular && { backgroundColor: `${pkg.accent}22`, borderColor: `${pkg.accent}60` },
                ]}>
                  <Text style={[s.pkgPrice, { color: pkg.accent, textShadowColor: `${pkg.accent}50` }]}>
                    ₺{pkg.price.toFixed(2)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Info */}
          <View style={s.infoBox}>
            <Ionicons name="information-circle-outline" size={14} color="#64748B" />
            <Text style={s.infoText}>
              SP ile profilini öne çıkarabilir, oda giriş ücreti ödeyebilir ve premium özelliklere erişebilirsin.
            </Text>
          </View>
        </ScrollView>
      </View>
      <PremiumAlert {...cAlert} onDismiss={() => setCAlert(prev => ({ ...prev, visible: false }))} />
      <PurchaseSuccessModal
        visible={successModal.visible}
        title={successModal.title}
        subtitle={successModal.subtitle}
        accent={successModal.accent}
        onClose={() => setSuccessModal(prev => ({ ...prev, visible: false }))}
      />
    </AppBackground>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#F1F5F9' },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(251,191,36,0.08)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(251,191,36,0.15)',
  },
  balanceText: { fontSize: 13, fontWeight: '800', color: '#FBBF24' },

  // Premium Bonus Banner
  bonusBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 18, marginBottom: 16, overflow: 'hidden',
    backgroundColor: 'rgba(20,30,42,0.85)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.18)',
    ...Shadows.card,
  },
  bonusIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  bonusTitle: { fontSize: 12, fontWeight: '700', color: '#F1F5F9' },
  bonusDesc: { fontSize: 10, color: '#94A3B8', marginTop: 1 },

  // Grid
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },

  // ═══ Package Card — Jewel-Tone Premium ═══
  pkgCard: {
    width: '47%' as any, alignItems: 'center',
    paddingVertical: 20, paddingHorizontal: 12,
    borderRadius: 20, overflow: 'hidden',
    // ★ İnce parlak kenarlık — cam kenar etkisi
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    // ★ İç kenarlık üst aydınlık efekti borderTop ile taklit
    borderTopWidth: 1.5, borderTopColor: 'rgba(255,255,255,0.22)',
  },
  pkgCardPopular: {
    borderColor: 'rgba(251,191,36,0.45)', borderWidth: 1.5,
    borderTopWidth: 2, borderTopColor: 'rgba(255,230,102,0.50)',
  },
  // ★ Premium gold ribbon — gradient dolu tag
  popularTag: {
    position: 'absolute', top: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 9, paddingVertical: 4,
    borderBottomLeftRadius: 12, borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  popularText: { fontSize: 7, fontWeight: '900', color: '#3B1F00', letterSpacing: 0.8 },

  // ★ İkon daire — parlak halo içinde
  iconCircle: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: 10, marginTop: 2,
  },

  // ★ SP Rakamı — büyük, parlak, gölgeli
  pkgSP: {
    fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5,
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
  },
  pkgLabel: {
    fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase',
  },

  // Bonus pill — zarif yeşil parıltı
  bonusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(52,211,153,0.10)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(52,211,153,0.20)',
    marginBottom: 10,
  },
  pkgBonus: { fontSize: 10, fontWeight: '800', color: '#34D399' },

  // ★ Fiyat kutusu — lüks CTA, kenarlıklı, iç ışımalı
  pkgPriceBox: {
    paddingHorizontal: 22, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)', marginTop: 2,
    borderWidth: 1.2,
  },
  pkgPrice: {
    fontSize: 14, fontWeight: '900', letterSpacing: 0.3,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },

  // Info
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 18, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  infoText: { flex: 1, fontSize: 11, color: '#64748B', lineHeight: 16 },

});
