import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import { Colors, Radius } from '../constants/theme';
import { useAuth } from './_layout';
import AppBackground from '../components/AppBackground';
import { showToast } from '../components/Toast';
import PremiumAlert, { type AlertButton } from '../components/PremiumAlert';
import { BadgeCheckerService, type UserBadge } from '../services/engagement/badges';
import { useEffect } from 'react';

// ═══ SP Paketleri (TL) ═══
const SP_PACKAGES = [
  { id: 'sp_50',    sp: 50,    price: 14.99,   icon: '🪙', popular: false, bonus: 0 },
  { id: 'sp_150',   sp: 150,   price: 34.99,   icon: '💰', popular: false, bonus: 10 },
  { id: 'sp_500',   sp: 500,   price: 99.99,   icon: '💎', popular: true,  bonus: 50 },
  { id: 'sp_1200',  sp: 1200,  price: 199.99,  icon: '🏆', popular: false, bonus: 200 },
  { id: 'sp_3000',  sp: 3000,  price: 449.99,  icon: '👑', popular: false, bonus: 600 },
  { id: 'sp_7500',  sp: 7500,  price: 999.99,  icon: '🔥', popular: false, bonus: 2000 },
];

type Tab = 'packages' | 'badges';

export default function SPStoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const spBalance = profile?.system_points ?? (profile as any)?.sp ?? 0;
  const [activeTab, setActiveTab] = useState<Tab>('packages');
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [cAlert, setCAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });

  useEffect(() => {
    if (profile?.id) {
      BadgeCheckerService.getUserBadges(profile.id).then(setBadges).catch(() => {});
    }
  }, [profile?.id]);

  const handleBuy = (pkg: typeof SP_PACKAGES[0]) => {
    setCAlert({
      visible: true,
      title: `${pkg.icon} ${pkg.sp.toLocaleString()} SP`,
      message: `${pkg.price.toFixed(2)} ₺ karşılığında ${pkg.sp.toLocaleString()} SP${pkg.bonus > 0 ? ` + ${pkg.bonus} bonus SP` : ''} satın almak istediğine emin misin?`,
      type: 'info',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Satın Al', onPress: () => {
          // ★ BUG-B1 FIX: IAP entegrasyonu henüz tamamlanmadı.
          // Gerçek SP ekleme yapılmıyor — kullanıcı yanıltılmasın.
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

        {/* Tab Bar */}
        <View style={s.tabBar}>
          <Pressable style={[s.tab, activeTab === 'packages' && s.tabActive]} onPress={() => setActiveTab('packages')}>
            <Ionicons name="diamond" size={14} color={activeTab === 'packages' ? '#FBBF24' : '#64748B'} />
            <Text style={[s.tabText, activeTab === 'packages' && s.tabTextActive]}>SP Paketleri</Text>
          </Pressable>
          <Pressable style={[s.tab, activeTab === 'badges' && s.tabActive]} onPress={() => setActiveTab('badges')}>
            <Ionicons name="trophy" size={14} color={activeTab === 'badges' ? '#FBBF24' : '#64748B'} />
            <Text style={[s.tabText, activeTab === 'badges' && s.tabTextActive]}>Rozetlerim</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingHorizontal: 16 }}>
          {activeTab === 'packages' ? (
            <>
              {/* Tier Bonus Banner */}
              <Pressable style={s.bonusBanner} onPress={() => router.push('/plus' as any)}>
                <LinearGradient colors={['rgba(20,184,166,0.08)', 'rgba(20,184,166,0.02)']} style={StyleSheet.absoluteFill} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="star" size={18} color={Colors.gold} />
                  <View>
                    <Text style={s.bonusTitle}>Premium Bonus</Text>
                    <Text style={s.bonusDesc}>Premium üyelikle her satın almada %20 ekstra SP</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#64748B" />
              </Pressable>

              {/* SP Packages Grid */}
              <View style={s.grid}>
                {SP_PACKAGES.map((pkg) => (
                  <Pressable key={pkg.id} style={[s.pkgCard, pkg.popular && s.pkgCardPopular]} onPress={() => handleBuy(pkg)}>
                    {pkg.popular && (
                      <View style={s.popularTag}>
                        <Text style={s.popularText}>EN POPÜLER</Text>
                      </View>
                    )}
                    <Text style={s.pkgIcon}>{pkg.icon}</Text>
                    <Text style={s.pkgSP}>{pkg.sp.toLocaleString()}</Text>
                    <Text style={s.pkgLabel}>SP</Text>
                    {pkg.bonus > 0 && (
                      <Text style={s.pkgBonus}>+{pkg.bonus} bonus</Text>
                    )}
                    <View style={[s.pkgPriceBox, pkg.popular && { backgroundColor: '#FBBF24' }]}>
                      <Text style={[s.pkgPrice, pkg.popular && { color: '#0F172A' }]}>₺{pkg.price.toFixed(2)}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              {/* Info */}
              <View style={s.infoBox}>
                <Ionicons name="information-circle" size={16} color="#64748B" />
                <Text style={s.infoText}>
                  SP ile profilini öne çıkarabilir, oda giriş ücreti ödeyebilir ve premium özelliklere erişebilirsin.
                </Text>
              </View>
            </>
          ) : (
            /* Badges Tab */
            <>
              {badges.length > 0 ? (
                <View style={s.badgeGrid}>
                  {badges.map((b, i) => (
                    <View key={i} style={s.badgeItem}>
                      <View style={s.badgeIconBox}>
                        <Ionicons name={b.icon as any} size={22} color={b.color} />
                      </View>
                      <Text style={s.badgeName}>{b.name}</Text>
                      <Text style={s.badgeDesc}>{b.description || ''}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={s.emptyState}>
                  <Ionicons name="trophy-outline" size={48} color="#334155" />
                  <Text style={s.emptyTitle}>Henüz rozet kazanılmadı</Text>
                  <Text style={s.emptyDesc}>Odalara katılarak, takipçi kazanarak ve aktif olarak rozet kazanabilirsin!</Text>
                </View>
              )}
            </>
          )}
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

  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 14,
    borderRadius: 14, backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)', padding: 3,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
  },
  tabActive: { backgroundColor: 'rgba(251,191,36,0.08)' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FBBF24' },

  bonusBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 14, marginBottom: 14, overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.85)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  bonusTitle: { fontSize: 12, fontWeight: '700', color: '#F1F5F9' },
  bonusDesc: { fontSize: 10, color: '#94A3B8', marginTop: 1 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  pkgCard: {
    width: '48%' as any, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 10,
    borderRadius: 16, backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  pkgCardPopular: {
    borderColor: 'rgba(251,191,36,0.3)', borderWidth: 1.5,
  },
  popularTag: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#FBBF24', paddingHorizontal: 8, paddingVertical: 3,
    borderBottomLeftRadius: 10, borderTopRightRadius: 14,
  },
  popularText: { fontSize: 7, fontWeight: '900', color: '#0F172A', letterSpacing: 0.5 },
  pkgIcon: { fontSize: 28, marginBottom: 6 },
  pkgSP: { fontSize: 22, fontWeight: '900', color: '#F1F5F9' },
  pkgLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 1, marginBottom: 4 },
  pkgBonus: { fontSize: 10, fontWeight: '700', color: '#22C55E', marginBottom: 6 },
  pkgPriceBox: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', marginTop: 4,
  },
  pkgPrice: { fontSize: 13, fontWeight: '800', color: '#FBBF24' },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 16, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)',
  },
  infoText: { flex: 1, fontSize: 11, color: '#64748B', lineHeight: 16 },

  // Badges
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeItem: {
    width: '30%' as any, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 6,
    borderRadius: 14, backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  badgeIconBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(251,191,36,0.06)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.1)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  badgeEmoji: { fontSize: 22 },
  badgeName: { fontSize: 10, fontWeight: '700', color: '#E2E8F0', textAlign: 'center' },
  badgeDesc: { fontSize: 8, color: '#64748B', textAlign: 'center', marginTop: 2 },

  emptyState: {
    alignItems: 'center', paddingVertical: 60, gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#94A3B8' },
  emptyDesc: { fontSize: 12, color: '#64748B', textAlign: 'center', paddingHorizontal: 40 },
});
