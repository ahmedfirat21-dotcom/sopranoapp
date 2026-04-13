import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
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

// ═══ SP Paketleri — Premium Ionicons ═══
const SP_PACKAGES = [
  { id: 'sp_50',   sp: 50,   price: 14.99,  icon: 'flash-outline' as const,     accent: '#60A5FA', gradient: ['#1E3A5F', '#0F2744'] as [string, string], bonus: 0,    popular: false },
  { id: 'sp_150',  sp: 150,  price: 34.99,  icon: 'diamond-outline' as const,   accent: '#A78BFA', gradient: ['#3B1F5E', '#2D1648'] as [string, string], bonus: 10,   popular: false },
  { id: 'sp_500',  sp: 500,  price: 99.99,  icon: 'trophy-outline' as const,    accent: '#FBBF24', gradient: ['#3D2E10', '#2E2108'] as [string, string], bonus: 50,   popular: true },
  { id: 'sp_1200', sp: 1200, price: 199.99, icon: 'star-outline' as const,      accent: '#14B8A6', gradient: ['#0F2E4A', '#0A2038'] as [string, string], bonus: 200,  popular: false },
  { id: 'sp_3000', sp: 3000, price: 449.99, icon: 'shield-checkmark-outline' as const, accent: '#F472B6', gradient: ['#3B1042', '#2D0C34'] as [string, string], bonus: 600,  popular: false },
  { id: 'sp_7500', sp: 7500, price: 999.99, icon: 'rocket-outline' as const,    accent: '#FB923C', gradient: ['#4A1525', '#3A0F1E'] as [string, string], bonus: 2000, popular: false },
];

export default function SPStoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const spBalance = profile?.system_points ?? (profile as any)?.sp ?? 0;
  const [cAlert, setCAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });

  const handleBuy = (pkg: typeof SP_PACKAGES[0]) => {
    setCAlert({
      visible: true,
      title: `${pkg.sp.toLocaleString()} SP`,
      message: `${pkg.price.toFixed(2)} ₺ karşılığında ${pkg.sp.toLocaleString()} SP${pkg.bonus > 0 ? ` + ${pkg.bonus} bonus SP` : ''} satın almak istediğine emin misin?`,
      type: 'info',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Satın Al', onPress: () => {
          showToast({ title: '🚧 Yakında!', message: 'Uygulama içi satın alma yakında aktif olacak.', type: 'info' });
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
            <Ionicons name="chevron-back" size={22} color="#F1F5F9" />
          </Pressable>
          <Text style={s.headerTitle}>SP Mağaza</Text>
          <View style={s.balancePill}>
            <Ionicons name="diamond" size={12} color="#FBBF24" />
            <Text style={s.balanceText}>{spBalance.toLocaleString()}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingHorizontal: 16 }}>
          {/* Premium Bonus Banner */}
          <Pressable style={s.bonusBanner} onPress={() => router.push('/plus' as any)}>
            <LinearGradient colors={['rgba(20,184,166,0.08)', 'rgba(20,184,166,0.02)']} style={StyleSheet.absoluteFill} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={s.bonusIconWrap}>
                <Ionicons name="star" size={16} color="#14B8A6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.bonusTitle}>Premium Bonus</Text>
                <Text style={s.bonusDesc}>Premium üyelikle her satın almada %20 ekstra SP</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </Pressable>

          {/* SP Packages Grid — Premium Cards */}
          <View style={s.grid}>
            {SP_PACKAGES.map((pkg) => (
              <Pressable
                key={pkg.id}
                style={({ pressed }) => [
                  s.pkgCard,
                  pkg.popular && s.pkgCardPopular,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => handleBuy(pkg)}
              >
                {/* Gradient arka plan */}
                <LinearGradient
                  colors={pkg.gradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />

                {/* Popüler tag */}
                {pkg.popular && (
                  <View style={s.popularTag}>
                    <Ionicons name="trending-up" size={7} color="#0F172A" />
                    <Text style={s.popularText}>POPÜLER</Text>
                  </View>
                )}

                {/* İkon */}
                <View style={[s.pkgIconWrap, { backgroundColor: `${pkg.accent}15`, borderColor: `${pkg.accent}30` }]}>
                  <Ionicons name={pkg.icon} size={20} color={pkg.accent} />
                </View>

                {/* SP Miktarı */}
                <Text style={s.pkgSP}>{pkg.sp.toLocaleString()}</Text>
                <Text style={s.pkgLabel}>SP</Text>

                {/* Bonus */}
                {pkg.bonus > 0 && (
                  <View style={s.bonusPill}>
                    <Ionicons name="add-circle" size={9} color="#22C55E" />
                    <Text style={s.pkgBonus}>{pkg.bonus}</Text>
                  </View>
                )}

                {/* Fiyat — CTA tarzı */}
                <View style={[s.pkgPriceBox, pkg.popular && { backgroundColor: pkg.accent }]}>
                  <Text style={[s.pkgPrice, pkg.popular && { color: '#0F172A' }]}>₺{pkg.price.toFixed(2)}</Text>
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
    padding: 14, borderRadius: 16, marginBottom: 14, overflow: 'hidden',
    backgroundColor: '#2D3740',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.15)',
    ...Shadows.card,
  },
  bonusIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  bonusTitle: { fontSize: 12, fontWeight: '700', color: '#F1F5F9' },
  bonusDesc: { fontSize: 10, color: '#94A3B8', marginTop: 1 },

  // Grid
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },

  // Package Card — Premium Glassmorphism
  pkgCard: {
    width: '47.5%' as any, alignItems: 'center',
    paddingVertical: 18, paddingHorizontal: 10,
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    ...Shadows.card,
  },
  pkgCardPopular: {
    borderColor: 'rgba(251,191,36,0.35)', borderWidth: 1.5,
    shadowColor: '#FBBF24', shadowOpacity: 0.15,
  },
  popularTag: {
    position: 'absolute', top: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#FBBF24', paddingHorizontal: 7, paddingVertical: 3,
    borderBottomLeftRadius: 10, borderTopRightRadius: 16,
  },
  popularText: { fontSize: 7, fontWeight: '900', color: '#0F172A', letterSpacing: 0.5 },

  // Icon wrap
  pkgIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: 8,
  },

  pkgSP: { fontSize: 22, fontWeight: '900', color: '#F1F5F9', ...Shadows.text },
  pkgLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', letterSpacing: 1, marginBottom: 4 },

  // Bonus pill
  bonusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
    marginBottom: 8,
  },
  pkgBonus: { fontSize: 9, fontWeight: '700', color: '#22C55E' },

  // Price box — CTA tarzı
  pkgPriceBox: {
    paddingHorizontal: 18, paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pkgPrice: { fontSize: 13, fontWeight: '800', color: '#FBBF24' },

  // Info
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 16, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)',
  },
  infoText: { flex: 1, fontSize: 11, color: '#64748B', lineHeight: 16 },

});
