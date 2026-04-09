import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import PremiumAlert, { type AlertButton } from '../components/PremiumAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/theme';
import { useAuth } from './_layout';
import { showToast } from '../components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ROOM_TIER_LIMITS } from '../constants/tiers';
import { supabase } from '../constants/supabase';
import AppBackground from '../components/AppBackground';

type AlertConfig = { visible: boolean; title: string; message: string; type?: any; buttons?: AlertButton[] };

const PLANS = [
  {
    id: 'bronze',
    tier: 'Bronze' as const,
    name: 'Bronze',
    subtitle: 'Başlangıç',
    icon: 'medal-outline',
    gradient: ['#CD7F32', '#A0522D'] as [string, string],
    color: '#CD7F32',
    monthly: 49.99,
    yearly: 399.99,
    savePct: 33,
    features: [
      { text: `${ROOM_TIER_LIMITS.Bronze.maxSpeakers} kişi sahne`, included: true },
      { text: `${ROOM_TIER_LIMITS.Bronze.maxListeners} dinleyici`, included: true },
      { text: `${ROOM_TIER_LIMITS.Bronze.maxCameras} kamera`, included: true },
      { text: `${ROOM_TIER_LIMITS.Bronze.durationHours} saat oda süresi`, included: true },
      { text: `Günde ${ROOM_TIER_LIMITS.Bronze.dailyRooms} oda`, included: true },
      { text: 'Açık + Şifreli oda', included: true },
      { text: '480p video', included: true },
      { text: 'Reklamsız deneyim', included: true },
    ],
  },
  {
    id: 'silver',
    tier: 'Silver' as const,
    name: 'Silver',
    subtitle: 'Popüler',
    icon: 'star',
    gradient: ['#C0C0C0', '#A8A9AD'] as [string, string],
    color: '#C0C0C0',
    monthly: 99.99,
    yearly: 799.99,
    savePct: 33,
    features: [
      { text: `${ROOM_TIER_LIMITS.Silver.maxSpeakers} kişi sahne`, included: true },
      { text: `${ROOM_TIER_LIMITS.Silver.maxListeners} dinleyici`, included: true },
      { text: `${ROOM_TIER_LIMITS.Silver.maxCameras} kamera`, included: true },
      { text: `${ROOM_TIER_LIMITS.Silver.durationHours} saat oda süresi`, included: true },
      { text: `Günde ${ROOM_TIER_LIMITS.Silver.dailyRooms} oda`, included: true },
      { text: 'Oda teması + çerçeve', included: true },
      { text: 'HD ses + 720p video', included: true },
      { text: 'Yaş/Dil filtresi', included: true },
      { text: 'Reklamsız deneyim', included: true },
    ],
  },
  {
    id: 'gold',
    tier: 'Gold' as const,
    name: 'Gold',
    subtitle: 'Premium',
    icon: 'diamond',
    gradient: ['#FFD700', '#FFA500'] as [string, string],
    color: '#FFD700',
    monthly: 149.99,
    yearly: 1199.99,
    savePct: 33,
    features: [
      { text: `${ROOM_TIER_LIMITS.Gold.maxSpeakers} kişi sahne`, included: true },
      { text: `${ROOM_TIER_LIMITS.Gold.maxListeners} dinleyici`, included: true },
      { text: `${ROOM_TIER_LIMITS.Gold.maxCameras} kamera`, included: true },
      { text: 'Sınırsız oda süresi', included: true },
      { text: 'Sınırsız oda oluşturma', included: true },
      { text: 'Tüm oda türleri + Davetli', included: true },
      { text: 'HD ses + 1080p video', included: true },
      { text: 'Oda müziği + Resim', included: true },
      { text: 'Takipçi-only mod', included: true },
      { text: 'Hediye al + Cashout', included: true },
      { text: 'Reklamsız deneyim', included: true },
    ],
  },
  {
    id: 'vip',
    tier: 'VIP' as const,
    name: 'VIP',
    subtitle: 'En İyi',
    icon: 'diamond',
    gradient: ['#00BFFF', '#8B5CF6'] as [string, string],
    color: '#00BFFF',
    monthly: 299.99,
    yearly: 2399.99,
    savePct: 33,
    features: [
      { text: `${ROOM_TIER_LIMITS.VIP.maxSpeakers} kişi sahne`, included: true },
      { text: 'Sınırsız dinleyici', included: true },
      { text: `${ROOM_TIER_LIMITS.VIP.maxCameras} kamera`, included: true },
      { text: 'Sınırsız oda süresi', included: true },
      { text: 'Sınırsız oda oluşturma', included: true },
      { text: 'Tüm oda türleri', included: true },
      { text: 'HD ses stereo + 1080p', included: true },
      { text: 'Ghost mode + Kılık', included: true },
      { text: 'VIP giriş efekti', included: true },
      { text: 'Düşük komisyon cashout', included: true },
      { text: 'Haftalık boost', included: true },
      { text: 'Reklamsız deneyim', included: true },
    ],
  },
];

export default function PlusScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedTier, setSelectedTier] = useState<'bronze' | 'silver' | 'gold' | 'vip'>('silver');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [activating, setActivating] = useState(false);
  const [alertCfg, setAlertCfg] = useState<AlertConfig>({ visible: false, title: '', message: '' });

  const currentTier = profile?.subscription_tier || 'Free';
  const selectedPlan = PLANS.find(p => p.id === selectedTier)!;

  const handleActivate = async () => {
    if (!profile?.id) {
      showToast({ title: 'Önce giriş yapmalısınız', type: 'error' });
      return;
    }

    const price = billingCycle === 'monthly'
      ? `${selectedPlan.monthly}₺/ay`
      : `${selectedPlan.yearly}₺/yıl`;

    setAlertCfg({
      visible: true,
      title: `${selectedPlan.name}'a Yükselt`,
      message: `${selectedPlan.name} planına geçmek istediğinize emin misiniz?\n\nFiyat: ${price}\n\n⚠️ Test modunda — gerçek ödeme alınmaz.`,
      type: 'info',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: `${selectedPlan.name}'a Geç`,
          onPress: async () => {
            setActivating(true);
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ subscription_tier: selectedPlan.tier })
                .eq('id', profile.id);
              if (error) throw error;
              await refreshProfile();
              showToast({ title: `${selectedPlan.name} Aktif! 🎉`, message: `Tebrikler! Artık ${selectedPlan.name} üyesisiniz.`, type: 'success' });
            } catch (err: any) {
              showToast({ title: 'Hata', message: err.message || 'Yükseltme başarısız.', type: 'error' });
            } finally {
              setActivating(false);
            }
          },
        },
      ],
    });
  };

  const handleDowngrade = () => {
    setAlertCfg({
      visible: true,
      title: 'Planı İptal Et',
      message: `Mevcut planınız: ${currentTier}.\n\nFree (ücretsiz) plana dönmek ister misiniz?\nPremium özellikleriniz devre dışı kalacak.`,
      type: 'warning',
      buttons: [
        { text: 'Hayır', style: 'cancel' },
        {
          text: "Free'ye Dön",
          style: 'destructive',
          onPress: async () => {
            setActivating(true);
            try {
              await supabase
                .from('profiles')
                .update({ subscription_tier: 'Free' })
                .eq('id', profile!.id);
              await refreshProfile();
              showToast({ title: 'Plan değiştirildi', message: 'Free plana geri döndünüz.', type: 'info' });
            } catch (err: any) {
              showToast({ title: 'Hata', message: err.message, type: 'error' });
            } finally {
              setActivating(false);
            }
          },
        },
      ],
    });
  };

  return (
    <AppBackground><View style={styles.container}>{/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/home')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Üyelik Planları</Text>
        <Ionicons name="star" size={22} color={Colors.gold} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 20 }}>
        {/* Mevcut Tier */}
        <View style={styles.currentTierBar}>
          <Text style={styles.currentTierLabel}>Mevcut planın:</Text>
          <View style={[styles.currentTierBadge, {
            backgroundColor: currentTier === 'VIP' ? '#00BFFF18' : currentTier === 'Gold' ? '#FFD70018' : '#6B728018'
          }]}>
            <Text style={{
              color: currentTier === 'VIP' ? '#00BFFF' : currentTier === 'Gold' ? '#FFD700' : '#9CA3AF',
              fontSize: 12, fontWeight: '700'
            }}>
              {currentTier}
            </Text>
          </View>
        </View>

        {/* Aylık/Yıllık Toggle */}
        <View style={styles.billingToggle}>
          <Pressable
            style={[styles.billingBtn, billingCycle === 'monthly' && styles.billingActive]}
            onPress={() => setBillingCycle('monthly')}
          >
            <Text style={[styles.billingText, billingCycle === 'monthly' && { color: Colors.text }]}>Aylık</Text>
          </Pressable>
          <Pressable
            style={[styles.billingBtn, billingCycle === 'yearly' && styles.billingActive]}
            onPress={() => setBillingCycle('yearly')}
          >
            <Text style={[styles.billingText, billingCycle === 'yearly' && { color: Colors.text }]}>Yıllık</Text>
            <View style={[styles.saveBadge, { backgroundColor: Colors.emerald }]}>
              <Text style={styles.saveText}>%33</Text>
            </View>
          </Pressable>
        </View>

        {/* ═══ YAN YANA PLAN KARTLARI ═══ */}
        <View style={styles.plansRow}>
          {PLANS.map(plan => {
            const isSelected = selectedTier === plan.id;
            const isCurrentPlan = currentTier === plan.tier;
            const price = billingCycle === 'monthly' ? plan.monthly : plan.yearly;
            const period = billingCycle === 'monthly' ? '/ay' : '/yıl';

            return (
              <Pressable
                key={plan.id}
                style={[
                  styles.planCard,
                  isSelected && { borderColor: plan.color, borderWidth: 2 },
                  isCurrentPlan && !isSelected && { borderColor: plan.color + '60' },
                ]}
                onPress={() => setSelectedTier(plan.id as any)}
              >
                {/* Gradient Header */}
                <LinearGradient
                  colors={plan.gradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.planCardHeader}
                >
                  {plan.id === 'silver' && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>POPÜLER</Text>
                    </View>
                  )}
                  {plan.id === 'vip' && (
                    <View style={[styles.popularBadge, { backgroundColor: '#D97706' }]}>
                      <Text style={styles.popularText}>EN İYİ</Text>
                    </View>
                  )}
                  <Ionicons name={plan.icon as any} size={28} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.planCardName}>{plan.name}</Text>
                </LinearGradient>

                {/* Fiyat */}
                <View style={styles.planCardBody}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
                    <Text style={[styles.planPrice, { color: plan.color }]}>{price}₺</Text>
                    <Text style={styles.planPeriod}>{period}</Text>
                  </View>
                  {billingCycle === 'yearly' && (
                    <Text style={styles.planMonthly}>Aylık {(plan.yearly / 12).toFixed(0)}₺</Text>
                  )}

                  {/* Özellik Listesi */}
                  <View style={styles.planFeatures}>
                    {plan.features.filter(f => f.included).slice(0, 6).map((f, i) => (
                      <View key={i} style={styles.planFeatureRow}>
                        <Ionicons name="checkmark" size={13} color={plan.color} />
                        <Text style={styles.planFeatureText} numberOfLines={1}>{f.text}</Text>
                      </View>
                    ))}
                    {plan.features.filter(f => f.included).length > 6 && (
                      <Text style={[styles.planFeatureMore, { color: plan.color }]}>
                        +{plan.features.filter(f => f.included).length - 6} daha
                      </Text>
                    )}
                  </View>

                  {/* Aktif / Seçildi */}
                  {isCurrentPlan ? (
                    <View style={[styles.planSelectBtn, { backgroundColor: plan.color + '15', borderColor: plan.color + '40' }]}>
                      <Ionicons name="checkmark-circle" size={14} color={plan.color} />
                      <Text style={[styles.planSelectText, { color: plan.color }]}>Aktif</Text>
                    </View>
                  ) : (
                    <View style={[styles.planSelectBtn, isSelected ? { backgroundColor: plan.color + '15', borderColor: plan.color } : {}]}>
                      <Text style={[styles.planSelectText, isSelected && { color: plan.color }]}>
                        {isSelected ? '✓ Seçildi' : 'Seç'}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Karşılaştırma Tablosu */}
        <Text style={styles.sectionTitle}>Plan Karşılaştırması</Text>
        <View style={styles.compareTable}>
          <View style={styles.compareHeader}>
            <Text style={[styles.compareCell, { flex: 1.5 }]}> </Text>
            <Text style={[styles.compareCellHead, { color: '#9CA3AF' }]}>Free</Text>
            <Text style={[styles.compareCellHead, { color: '#C0C0C0' }]}>Silver</Text>
            <Text style={[styles.compareCellHead, { color: '#FFD700' }]}>Gold</Text>
            <Text style={[styles.compareCellHead, { color: '#00BFFF' }]}>VIP</Text>
          </View>
          {[
            { label: 'Sahne', values: [`${ROOM_TIER_LIMITS.Free.maxSpeakers}`, `${ROOM_TIER_LIMITS.Silver.maxSpeakers}`, `${ROOM_TIER_LIMITS.Gold.maxSpeakers}`, `${ROOM_TIER_LIMITS.VIP.maxSpeakers}`] },
            { label: 'Dinleyici', values: [`${ROOM_TIER_LIMITS.Free.maxListeners}`, `${ROOM_TIER_LIMITS.Silver.maxListeners}`, `${ROOM_TIER_LIMITS.Gold.maxListeners}`, '∞'] },
            { label: 'Kamera', values: [`${ROOM_TIER_LIMITS.Free.maxCameras}`, `${ROOM_TIER_LIMITS.Silver.maxCameras}`, `${ROOM_TIER_LIMITS.Gold.maxCameras}`, `${ROOM_TIER_LIMITS.VIP.maxCameras}`] },
            { label: 'Oda Süresi', values: [`${ROOM_TIER_LIMITS.Free.durationHours}sa`, `${ROOM_TIER_LIMITS.Silver.durationHours}sa`, '24sa', '∞'] },
            { label: 'Günlük Oda', values: [`${ROOM_TIER_LIMITS.Free.dailyRooms}`, `${ROOM_TIER_LIMITS.Silver.dailyRooms}`, '∞', '∞'] },
            { label: 'Oda Türü', values: ['Açık', 'A+Ş', 'Hepsi', 'Hepsi'] },
            { label: 'HD Ses', values: ['—', '✓', '✓', 'Stereo'] },
            { label: 'Video', values: ['—', '720p', '1080p', '1080p'] },
            { label: 'Tema', values: ['—', '✓', '✓', '✓'] },
            { label: 'Cashout', values: ['—', '—', '%30', '%15'] },
            { label: 'Çerçeve', values: ['—', '✓', '✓', 'VIP'] },
            { label: 'Reklam', values: ['Var', 'Yok', 'Yok', 'Yok'] },
          ].map((row, i) => (
            <View key={i} style={[styles.compareRow, i % 2 === 0 && { backgroundColor: 'rgba(255,255,255,0.02)' }]}>
              <Text style={[styles.compareCell, { flex: 1.5, color: Colors.text2 }]}>{row.label}</Text>
              {row.values.map((v, j) => (
                <Text key={j} style={[styles.compareCell, {
                  color: j === 0 ? '#6B7280' : j === 1 ? '#C0C0C0' : j === 2 ? Colors.amber : '#00BFFF'
                }]}>{v}</Text>
              ))}
            </View>
          ))}
        </View>

        {/* CTA */}
        {currentTier !== selectedPlan.tier && (
          <Pressable style={styles.ctaWrap} onPress={handleActivate} disabled={activating}>
            <LinearGradient
              colors={selectedPlan.gradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.ctaBtn}
            >
              {activating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="star" size={18} color="#fff" />
                  <Text style={styles.ctaText}>
                    {selectedPlan.name}'a Yükselt — {billingCycle === 'monthly' ? `${selectedPlan.monthly}₺/ay` : `${selectedPlan.yearly}₺/yıl`}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        )}

        {/* Silver'a dönme */}
        {currentTier !== 'Free' && (
          <Pressable style={styles.downgradeBtn} onPress={handleDowngrade}>
            <Text style={styles.downgradeText}>Planı İptal Et / Free'ye Dön</Text>
          </Pressable>
        )}

        <Text style={styles.disclaimer}>
          Abonelik otomatik yenilenir. İstediğin zaman iptal edebilirsin.{'\n'}
          Fiyatlara KDV dahildir.
        </Text>
      </ScrollView>

      <PremiumAlert
        visible={alertCfg.visible}
        title={alertCfg.title}
        message={alertCfg.message}
        type={alertCfg.type || 'info'}
        buttons={alertCfg.buttons}
        onDismiss={() => setAlertCfg(prev => ({ ...prev, visible: false }))}
      />
    </View></AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },

  currentTierBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 4, marginBottom: 12,
  },
  currentTierLabel: { color: Colors.text3, fontSize: 13 },
  currentTierBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },

  billingToggle: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, gap: 8 },
  billingBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  billingActive: { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)' },
  billingText: { fontSize: 13, fontWeight: '600', color: Colors.text3 },
  saveBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  saveText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  plansRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 10 },
  planCard: {
    flex: 1, borderRadius: 16, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  planCardHeader: { alignItems: 'center', paddingVertical: 18, gap: 4, position: 'relative' },
  planCardName: { fontSize: 18, fontWeight: '800', color: '#fff' },
  popularBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#0891B2', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  popularText: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  planCardBody: { padding: 12, gap: 4 },
  planPrice: { fontSize: 24, fontWeight: '800' },
  planPeriod: { fontSize: 11, color: Colors.text3, marginLeft: 2 },
  planMonthly: { fontSize: 10, color: Colors.text3, textAlign: 'center', marginBottom: 2 },

  planFeatures: { marginTop: 8, gap: 4 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  planFeatureText: { fontSize: 10, color: Colors.text2, flex: 1 },
  planFeatureMore: { fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 2 },

  planSelectBtn: {
    marginTop: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 4, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  planSelectText: { fontSize: 12, fontWeight: '700', color: Colors.text3 },

  sectionTitle: {
    fontSize: 15, fontWeight: '700', color: Colors.text,
    paddingHorizontal: 20, marginTop: 24, marginBottom: 12,
  },
  compareTable: {
    marginHorizontal: 20, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  compareHeader: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 10, paddingHorizontal: 12,
  },
  compareCellHead: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  compareRow: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 12 },
  compareCell: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '500', color: Colors.text2 },

  ctaWrap: { paddingHorizontal: 20, marginTop: 24 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 14,
  },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  disclaimer: {
    fontSize: 11, color: Colors.text3, textAlign: 'center',
    paddingHorizontal: 40, marginTop: 16, lineHeight: 16,
  },
  downgradeBtn: {
    alignSelf: 'center', marginTop: 12, paddingVertical: 10, paddingHorizontal: 24,
  },
  downgradeText: { fontSize: 13, color: Colors.red, fontWeight: '600' },
});
