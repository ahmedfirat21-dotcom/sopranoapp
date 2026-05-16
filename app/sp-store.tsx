import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { i18n } from '../services/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SPIcon from '../components/SPIcon';
import { SkiaShadow } from '../components/skia';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import { Shadows } from '../constants/theme';
import { useAuth } from './_layout';
import AppBackground from '../components/AppBackground';
import { showToast } from '../components/Toast';
import { migrateLegacyTier } from '../types';
import { RevenueCatService } from '../services/revenuecat';

// ═══ SP Paketleri — Premium Jewel-Tone Design ═══
// ★ id alanları Google Play Console'daki In-App Product ID'leriyle eşleşmeli
// ★ v108: store.tsx SP_PACKS ile birebir eşleştirildi (aynı 5 tier, aynı fiyat/bonus)
// ★ gradient: 3-stop — parlak üst → zengin orta → derin alt (mücevher etkisi)
// ★ glowColor: kart altı ambient gölge rengi
const SP_PACKAGES = [
  { id: 'soprano_sp_100',   sp: 100,   price: 9.99,   icon: 'flash' as const,             accent: '#D4A574', gradient: ['#A67C52', '#6B4A2E', '#2E1F12'] as [string, string, string], glowColor: '#D4A57440', bonus: 0,    popular: false, tierName: 'Bronz' },
  { id: 'soprano_sp_500',   sp: 500,   price: 39.99,  icon: 'diamond' as const,            accent: '#D1D5DB', gradient: ['#7C8490', '#4A4F5A', '#1A1D24'] as [string, string, string], glowColor: '#D1D5DB40', bonus: 50,   popular: false, tierName: i18n.t('auto.sp_store.003') },
  { id: 'soprano_sp_1500',  sp: 1500,  price: 99.99,  icon: 'trophy' as const,             accent: '#FBBF24', gradient: ['#D4A017', '#7A5B0E', '#2E2108'] as [string, string, string], glowColor: '#FBBF2450', bonus: 300,  popular: true,  tierName: i18n.t('auto.sp_store.002') },
  { id: 'soprano_sp_5000',  sp: 5000,  price: 299.99, icon: 'star' as const,               accent: '#C4B5FD', gradient: ['#7C5CC8', '#4A2D8B', '#1A0E3A'] as [string, string, string], glowColor: '#8B5CF640', bonus: 1750, popular: false, tierName: 'Platin' },
  { id: 'soprano_sp_15000', sp: 15000, price: 799.99, icon: 'shield-checkmark' as const,   accent: '#F9A8D4', gradient: ['#C74B8B', '#7A2255', '#2D0C22'] as [string, string, string], glowColor: '#EC489940', bonus: 7500, popular: false, tierName: 'Elmas' },
];

export default function SPStoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const spBalance = profile?.system_points ?? 0;
  const userTier = migrateLegacyTier(profile?.subscription_tier);
  const storeBonusPct = userTier === 'Pro' ? 0.20 : userTier === 'Plus' ? 0.10 : 0;
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // ★ v298 (17 May 2026): Gerçek SP satın alma — RevenueCat Google Play consumable IAP
  //   sonrası Supabase RPC ile DB'ye SP credit. Eski "fake toast" davranışı kaldırıldı.
  const handleBuy = async (packageId: string) => {
    if (!profile?.id) {
      showToast({ title: 'Giriş Gerekli', message: 'Önce hesabına gir.', type: 'error' });
      return;
    }
    if (purchasing) return; // Çift tıklama koruması
    setPurchasing(packageId);
    try {
      const result = await RevenueCatService.purchaseSPPackage(profile.id, packageId);
      if (!result.success) {
        if (result.error === 'iptal_edildi') {
          // Sessizce geç — kullanıcı kendi iptal etti
          return;
        }
        if (result.error === 'already_processed') {
          showToast({ title: 'Zaten İşlendi', message: 'Bu satın alma daha önce kaydedildi.', type: 'info' });
          return;
        }
        showToast({
          title: 'Satın Alma Başarısız',
          message: result.error || 'Bilinmeyen hata',
          type: 'error',
        });
        return;
      }
      // Profili yenile (balance güncel görünsün)
      try { await refreshProfile?.(); } catch {}
      showToast({
        title: 'SP Yüklendi! ✨',
        message: `+${result.spAdded?.toLocaleString('tr-TR')} SP hesabına eklendi.`,
        type: 'success',
      });
    } catch (e: any) {
      showToast({
        title: 'Hata',
        message: e?.message || 'Beklenmedik hata',
        type: 'error',
      });
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <AppBackground variant="profile" radialGlow>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => safeGoBack(router)} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#F1F5F9" style={{
              textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
            }} />
          </Pressable>
          <Text style={s.headerTitle}>{i18n.t('spstore.001')}</Text>
          <View style={s.balancePill}>
            <SPIcon size={16} />
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
                <Text style={s.bonusDesc}>{storeBonusPct > 0 ? i18n.t('auto.sp_store.001', { 0: userTier, 1: Math.round(storeBonusPct * 100) }) : 'Plus ile %10, Pro ile %20 ekstra SP kazan!'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </Pressable>

          {/* SP Packages Grid — Premium Jewel Cards */}
          <View style={s.grid}>
            {SP_PACKAGES.map((pkg) => (
              <SkiaShadow
                key={pkg.id}
                shadowColor={pkg.glowColor.slice(0, 7)}
                shadowOpacity={0.55}
                shadowBlur={18}
                shadowOffsetY={8}
                borderRadius={20}
              >
              <Pressable
                style={({ pressed }) => [
                  s.pkgCard,
                  pkg.popular && s.pkgCardPopular,
                  pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
                  purchasing && purchasing !== pkg.id && { opacity: 0.5 },
                ]}
                onPress={() => handleBuy(pkg.id)}
                disabled={!!purchasing}
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
                    <Text style={s.popularText}>{i18n.t('spstore.002')}</Text>
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
              </SkiaShadow>
            ))}
          </View>

          {/* Info */}
          <View style={s.infoBox}>
            <Ionicons name="information-circle-outline" size={14} color="#64748B" />
            <Text style={s.infoText}>{i18n.t('spstore.001')}</Text>
          </View>
        </ScrollView>
      </View>
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
