import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import PremiumAlert, { type AlertButton } from '../components/PremiumAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import { Colors, Shadows } from '../constants/theme';
import { useAuth } from './_layout';
import { showToast } from '../components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ROOM_TIER_LIMITS, TIER_DEFINITIONS } from '../constants/tiers';
import { migrateLegacyTier } from '../types';
import { supabase } from '../constants/supabase';
import { RevenueCatService, REVENUECAT_MOCK_MODE } from '../services/revenuecat';
import AppBackground from '../components/AppBackground';

type AlertConfig = { visible: boolean; title: string; message: string; type?: any; buttons?: AlertButton[] };

const PLANS = [
  {
    id: 'plus',
    tier: 'Plus' as const,
    name: TIER_DEFINITIONS.Plus.label,
    subtitle: 'Gelişmiş',
    icon: 'rocket',
    gradient: TIER_DEFINITIONS.Plus.gradient,
    color: TIER_DEFINITIONS.Plus.color,
    monthly: TIER_DEFINITIONS.Plus.monthlyPrice,
    yearly: TIER_DEFINITIONS.Plus.yearlyPrice,
    savePct: 27,
    features: [
      { text: `${ROOM_TIER_LIMITS.Plus.maxSpeakers} kişi sahne`, included: true },
      { text: `${ROOM_TIER_LIMITS.Plus.maxListeners} dinleyici`, included: true },
      { text: `${ROOM_TIER_LIMITS.Plus.maxCameras} kamera`, included: true },
      { text: `${ROOM_TIER_LIMITS.Plus.durationHours} saat oda süresi`, included: true },
      { text: `Günde ${ROOM_TIER_LIMITS.Plus.dailyRooms} oda`, included: true },
      { text: 'Tüm oda türleri', included: true },
      { text: 'HD ses + 720p video', included: true },
      { text: 'Oda teması + çerçeve', included: true },
      { text: 'Yaş/Dil filtresi', included: true },
      { text: 'Kalıcı oda (3 adet)', included: true },
    ],
  },
  {
    id: 'pro',
    tier: 'Pro' as const,
    name: TIER_DEFINITIONS.Pro.label,
    subtitle: 'Sınırsız',
    icon: 'flame',
    gradient: TIER_DEFINITIONS.Pro.gradient,
    color: TIER_DEFINITIONS.Pro.color,
    monthly: TIER_DEFINITIONS.Pro.monthlyPrice,
    yearly: TIER_DEFINITIONS.Pro.yearlyPrice,
    savePct: 25,
    features: [
      { text: `${ROOM_TIER_LIMITS.Pro.maxSpeakers} kişi sahne`, included: true },
      { text: 'Sınırsız dinleyici', included: true },
      { text: `${ROOM_TIER_LIMITS.Pro.maxCameras} kamera`, included: true },
      { text: 'Sınırsız oda süresi', included: true },
      { text: 'Sınırsız oda oluşturma', included: true },
      { text: 'HD stereo ses + 1080p', included: true },
      { text: 'Oda müziği + Arka plan', included: true },
      { text: 'Ghost mode + Kılık', included: true },
      { text: 'Takipçi-only mod', included: true },
      { text: '2× SP kazanım çarpanı', included: true },
      { text: 'Keşfet boost erişimi', included: true },
      { text: 'Mağaza %20 SP indirimi', included: true },
    ],
  },
];

export default function PlusScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedTier, setSelectedTier] = useState<'plus' | 'pro'>('plus');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [activating, setActivating] = useState(false);
  const [alertCfg, setAlertCfg] = useState<AlertConfig>({ visible: false, title: '', message: '' });

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const currentTier = migrateLegacyTier(profile?.subscription_tier);
  const selectedPlan = PLANS.find(p => p.id === selectedTier)!;

  const handleActivate = async () => {
    if (!profile?.id) {
      showToast({ title: 'Önce giriş yapmalısınız', type: 'error' });
      return;
    }

    const price = billingCycle === 'monthly'
      ? `${selectedPlan.monthly}₺/ay`
      : `${selectedPlan.yearly}₺/yıl`;

    const modeText = (REVENUECAT_MOCK_MODE && __DEV__) ? '\n\n⚠️ Test modunda — gerçek ödeme alınmaz.' : '';

    setAlertCfg({
      visible: true,
      title: `${selectedPlan.name}'a Yükselt`,
      message: `${selectedPlan.name} planına geçmek istediğinize emin misiniz?\n\nFiyat: ${price}${modeText}`,
      type: 'info',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: `${selectedPlan.name}'a Geç`,
          onPress: async () => {
            if (mountedRef.current) setActivating(true);
            try {
              const result = await RevenueCatService.purchasePackage(
                { identifier: `tier_${selectedPlan.id}`, billingCycle },
                profile.id,
                selectedPlan.tier,
              );
              if (!mountedRef.current) return;
              if (result.error) throw new Error(result.error);
              if (result.newTier) {
                await refreshProfile();
                if (mountedRef.current) {
                  showToast({ title: `${selectedPlan.name} Aktif! 🎉`, message: `Tebrikler! Artık ${selectedPlan.name} üyesisiniz.`, type: 'success' });
                }
              }
            } catch (err: any) {
              if (mountedRef.current) {
                showToast({ title: 'Hata', message: err.message || 'Yükseltme başarısız.', type: 'error' });
              }
            } finally {
              if (mountedRef.current) setActivating(false);
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
            if (mountedRef.current) setActivating(true);
            try {
              const success = await RevenueCatService.cancelSubscription(profile!.id);
              if (!mountedRef.current) return;
              if (success) {
                await refreshProfile();
                if (mountedRef.current) showToast({ title: 'Plan değiştirildi', message: 'Free plana geri döndünüz.', type: 'info' });
              } else {
                showToast({ title: 'Bilgi', message: 'Aboneliğinizi Google Play ayarlarından iptal edebilirsiniz.', type: 'info' });
              }
            } catch (err: any) {
              if (mountedRef.current) showToast({ title: 'Hata', message: err.message, type: 'error' });
            } finally {
              if (mountedRef.current) setActivating(false);
            }
          },
        },
      ],
    });
  };

  return (
    <AppBackground><View style={styles.container}>{/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <Pressable onPress={() => safeGoBack(router)} style={styles.backBtn}>
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
            backgroundColor: currentTier === 'Pro' ? '#F59E0B18' : currentTier === 'Plus' ? '#A855F718' : '#6B728018'
          }]}>
            <Text style={{
              color: currentTier === 'Pro' ? '#F59E0B' : currentTier === 'Plus' ? '#A855F7' : '#9CA3AF',
              fontSize: 12, fontWeight: '700'
            }}>
              {currentTier}
            </Text>
          </View>
        </View>

        {/* Aylık/Yıllık Toggle */}
        <View style={styles.billingToggle}>
          <Pressable
            style={[styles.billingBtn, billingCycle === 'monthly' && styles.billingActive, { overflow: 'hidden' }]}
            onPress={() => setBillingCycle('monthly')}
            android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
          >
            {billingCycle === 'monthly' && <View style={styles.billingDot} />}
            <Text style={[styles.billingText, billingCycle === 'monthly' && styles.billingTextActive]}>Aylık</Text>
          </Pressable>
          <Pressable
            style={[styles.billingBtn, billingCycle === 'yearly' && styles.billingActive, { overflow: 'hidden' }]}
            onPress={() => setBillingCycle('yearly')}
            android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
          >
            {billingCycle === 'yearly' && <View style={styles.billingDot} />}
            <Text style={[styles.billingText, billingCycle === 'yearly' && styles.billingTextActive]}>Yıllık</Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveText}>-27%</Text>
            </View>
          </Pressable>
        </View>

        {/* ═══ YAN YANA PLAN KARTLARI (2 Plan) ═══ */}
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
                  {plan.id === 'pro' && (
                    <View style={[styles.popularBadge, { backgroundColor: '#D97706' }]}>
                      <Text style={styles.popularText}>EN İYİ</Text>
                    </View>
                  )}
                  <Ionicons name={plan.icon as any} size={32} color="rgba(255,255,255,0.95)" style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }} />
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
                    {plan.features.filter(f => f.included).slice(0, 7).map((f, i) => (
                      <View key={i} style={styles.planFeatureRow}>
                        <Ionicons name="checkmark" size={13} color={plan.color} />
                        <Text style={styles.planFeatureText} numberOfLines={1}>{f.text}</Text>
                      </View>
                    ))}
                    {plan.features.filter(f => f.included).length > 7 && (
                      <Text style={[styles.planFeatureMore, { color: plan.color }]}>
                        +{plan.features.filter(f => f.included).length - 7} daha
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

        {/* Karşılaştırma Tablosu — 3 Sütun */}
        <Text style={styles.sectionTitle}>Plan Karşılaştırması</Text>
        <LinearGradient
          colors={['rgba(40,48,62,0.95)', 'rgba(30,38,50,0.85)', 'rgba(25,32,44,0.9)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.compareTable}
        >
          <View style={styles.compareHeader}>
            <Text style={[styles.compareCell, { flex: 1.5 }]}> </Text>
            <Text style={[styles.compareCellHead, { color: '#9CA3AF' }]}>Free</Text>
            <Text style={[styles.compareCellHead, { color: TIER_DEFINITIONS.Plus.color }]}>Plus</Text>
            <Text style={[styles.compareCellHead, { color: TIER_DEFINITIONS.Pro.color }]}>Pro</Text>
          </View>
          {[
            { label: 'Sahne', values: [`${ROOM_TIER_LIMITS.Free.maxSpeakers}`, `${ROOM_TIER_LIMITS.Plus.maxSpeakers}`, `${ROOM_TIER_LIMITS.Pro.maxSpeakers}`] },
            { label: 'Dinleyici', values: [`${ROOM_TIER_LIMITS.Free.maxListeners}`, `${ROOM_TIER_LIMITS.Plus.maxListeners}`, '∞'] },
            { label: 'Kamera', values: [`${ROOM_TIER_LIMITS.Free.maxCameras}`, `${ROOM_TIER_LIMITS.Plus.maxCameras}`, `${ROOM_TIER_LIMITS.Pro.maxCameras}`] },
            { label: 'Oda Süresi', values: [`${ROOM_TIER_LIMITS.Free.durationHours}sa`, `${ROOM_TIER_LIMITS.Plus.durationHours}sa`, '∞'] },
            { label: 'Günlük Oda', values: [`${ROOM_TIER_LIMITS.Free.dailyRooms}`, `${ROOM_TIER_LIMITS.Plus.dailyRooms}`, '∞'] },
            { label: 'Oda Türü', values: ['Açık', 'Hepsi', 'Hepsi'] },
            { label: 'Ses', values: ['Mono', 'HD', 'Stereo'] },
            { label: 'Video', values: ['480p', '720p', '1080p'] },
            { label: 'Tema', values: ['—', '✓', '✓'] },
            { label: 'Çerçeve', values: ['—', '✓', 'Pro'] },
            { label: 'Müzik', values: ['—', '—', '✓'] },
            { label: 'Cashout', values: ['—', '%30', '%15'] },
            { label: 'Reklam', values: ['Var', 'Yok', 'Yok'] },
          ].map((row, i) => (
            <View key={i} style={[styles.compareRow, i % 2 === 0 && { backgroundColor: 'rgba(255,255,255,0.03)' }]}>
              <Text style={[styles.compareCell, { flex: 1.5, color: Colors.text2 }]}>{row.label}</Text>
              {row.values.map((v, j) => (
                <Text key={j} style={[styles.compareCell, {
                  color: j === 0 ? '#6B7280' : j === 1 ? TIER_DEFINITIONS.Plus.color : TIER_DEFINITIONS.Pro.color
                }]}>{v}</Text>
              ))}
            </View>
          ))}
        </LinearGradient>

        {/* CTA */}
        {currentTier !== selectedPlan.tier && (
          <View style={styles.ctaWrap}>
            <Pressable onPress={handleActivate} disabled={activating} style={styles.ctaOuter}>
              <LinearGradient
                colors={selectedPlan.gradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.ctaBtn}
              >
                {activating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name={selectedPlan.icon as any} size={20} color="#fff" style={{ textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }} />
                    <Text style={styles.ctaText}>
                      {selectedPlan.name}'a Yükselt — {billingCycle === 'monthly' ? `${selectedPlan.monthly}₺/ay` : `${selectedPlan.yearly}₺/yıl`}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* Free'ye dönme */}
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
  backBtn: {
    width: 38, height: 38, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    ...Shadows.icon,
  },
  headerTitle: {
    fontSize: 17, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.3,
    ...Shadows.text,
  },

  currentTierBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 4, marginBottom: 14,
  },
  currentTierLabel: { color: Colors.text3, fontSize: 13, fontWeight: '500' },
  currentTierBadge: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },

  billingToggle: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 18, gap: 6,
  },
  billingBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder,
    ...Shadows.icon,
  },
  billingActive: {
    backgroundColor: '#3D4F57', borderColor: 'rgba(115,194,189,0.35)',
  },
  billingDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accentTeal,
  },
  billingText: {
    fontSize: 13, fontWeight: '700', color: '#94A3B8',
    ...Shadows.textLight,
  },
  billingTextActive: { color: Colors.accentTeal },
  saveBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  saveText: { fontSize: 9, fontWeight: '800', color: '#F59E0B' },

  plansRow: { flexDirection: 'row', paddingHorizontal: 14, gap: 12 },
  planCard: {
    flex: 1, borderRadius: 18, overflow: 'hidden',
    backgroundColor: Colors.cardBg,
    borderWidth: 1.5, borderColor: Colors.cardBorder + '40',
    ...Shadows.card,
  },
  planCardHeader: {
    alignItems: 'center', paddingVertical: 20, gap: 6, position: 'relative',
  },
  planCardName: {
    fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 0.5,
    ...Shadows.text,
  },
  popularBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: '#0891B2', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3,
    ...Shadows.icon,
  },
  popularText: { fontSize: 8, fontWeight: '900', color: '#fff', letterSpacing: 0.8 },

  planCardBody: { padding: 14, gap: 6 },
  planPrice: { fontSize: 26, fontWeight: '900', ...Shadows.textLight },
  planPeriod: { fontSize: 11, color: Colors.text3, marginLeft: 2, fontWeight: '600' },
  planMonthly: { fontSize: 10, color: Colors.text3, textAlign: 'center', marginBottom: 2, fontWeight: '500' },

  planFeatures: { marginTop: 10, gap: 5 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  planFeatureText: { fontSize: 11, color: '#CBD5E1', flex: 1, fontWeight: '500' },
  planFeatureMore: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 4 },

  planSelectBtn: {
    marginTop: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 4, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  planSelectText: { fontSize: 13, fontWeight: '800', color: Colors.text3 },

  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: '#F1F5F9',
    paddingHorizontal: 20, marginTop: 28, marginBottom: 14,
    ...Shadows.text,
  },
  compareTable: {
    marginHorizontal: 16, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1.5, borderColor: Colors.cardBorder + '30',
    backgroundColor: Colors.cardBg,
    ...Shadows.card,
  },
  compareHeader: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  compareCellHead: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  compareRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 14 },
  compareCell: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: Colors.text2 },

  ctaWrap: { paddingHorizontal: 20, marginTop: 26 },
  ctaOuter: {
    borderRadius: 14, overflow: 'hidden',
    ...Shadows.button,
  },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  ctaText: {
    fontSize: 15, fontWeight: '800', color: '#fff',
    ...Shadows.text,
  },
  disclaimer: {
    fontSize: 11, color: Colors.text3, textAlign: 'center',
    paddingHorizontal: 40, marginTop: 16, lineHeight: 16,
  },
  downgradeBtn: {
    alignSelf: 'center', marginTop: 14, paddingVertical: 10, paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  downgradeText: { fontSize: 13, color: Colors.red, fontWeight: '700' },
});
