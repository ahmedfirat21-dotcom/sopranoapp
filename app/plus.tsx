import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { i18n } from '../services/i18n';
import AppLoader from '../components/AppLoader';
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
import PurchaseSuccessModal from '../components/PurchaseSuccessModal';

type AlertConfig = { visible: boolean; title: string; message: string; type?: any; buttons?: AlertButton[] };

const PLANS = [
  {
    id: 'plus',
    tier: 'Plus' as const,
    name: TIER_DEFINITIONS.Plus.label,
    subtitle: i18n.t('plus.002'),
    icon: 'rocket',
    // ★ 3-stop jewel-tone gradient — ametist (parlak mor → derin mor → indigo siyah)
    gradient: ['#C084FC', '#7C3AED', '#2A1065'] as [string, string, string],
    headerGradient: TIER_DEFINITIONS.Plus.gradient,
    color: TIER_DEFINITIONS.Plus.color,
    glowColor: '#A855F750',
    monthly: TIER_DEFINITIONS.Plus.monthlyPrice,
    yearly: TIER_DEFINITIONS.Plus.yearlyPrice,
    savePct: 27,
    features: [
      { text: `${ROOM_TIER_LIMITS.Plus.maxSpeakers} kişi sahne`, included: true },
      { text: `${ROOM_TIER_LIMITS.Plus.maxListeners} dinleyici`, included: true },
      { text: `${ROOM_TIER_LIMITS.Plus.maxCameras} kamera`, included: true },
      { text: `Her oda ${ROOM_TIER_LIMITS.Plus.durationHours} saat açık kalır`, included: true },
      { text: `Günde ${ROOM_TIER_LIMITS.Plus.dailyRooms} oda açabilirsin`, included: true },
      { text: 'Tüm oda türleri', included: true },
      { text: 'HD ses + 720p video', included: true },
      { text: 'Oda kart görseli + arka plan', included: true },
      { text: 'Yaş/Dil filtresi', included: true },
      { text: 'Sadece Arkadaşlar modu', included: true },
      { text: '3 odanı dondurup tekrar açabilirsin', included: true },
      { text: '600 SP karşılama bonusu', included: true },
    ],
  },
  {
    id: 'pro',
    tier: 'Pro' as const,
    name: TIER_DEFINITIONS.Pro.label,
    subtitle: i18n.t('plus.003'),
    icon: 'flame',
    // ★ 3-stop jewel-tone gradient — topaz (parlak altın → kehribar → derin kahve)
    gradient: ['#FDE68A', '#D97706', '#451A03'] as [string, string, string],
    headerGradient: TIER_DEFINITIONS.Pro.gradient,
    color: TIER_DEFINITIONS.Pro.color,
    glowColor: '#F59E0B60',
    monthly: TIER_DEFINITIONS.Pro.monthlyPrice,
    yearly: TIER_DEFINITIONS.Pro.yearlyPrice,
    savePct: 25,
    features: [
      { text: `${ROOM_TIER_LIMITS.Pro.maxSpeakers} kişi sahne`, included: true },
      { text: 'Sınırsız dinleyici', included: true },
      { text: `${ROOM_TIER_LIMITS.Pro.maxCameras} kamera`, included: true },
      { text: 'Odan 7/24 açık kalır, kapanmaz', included: true },
      { text: 'Sınırsız oda açabilirsin', included: true },
      { text: 'HD stereo ses + 1080p video', included: true },
      { text: 'Oda müziği + Arka plan', included: true },
      { text: 'Ghost mode + Kılık', included: true },
      { text: 'Takipçi-only mod', included: true },
      { text: 'Seçilmişler konuşma modu', included: true },
      { text: 'Keşfet boost erişimi', included: true },
      { text: '1500 SP karşılama bonusu', included: true },
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
  // ★ 2026-04-20: Abonelik sistemi prod'da kuruldu mu? RevenueCat Dashboard
  // yapılandırılmadıysa "sistem hazır değil" uyarısı göster + CTA disable.
  const [subReady, setSubReady] = useState<boolean>(RevenueCatService.isSubscriptionAvailable());
  // ★ Şık animasyonlu başarı modalı (toast yerine)
  const [successModal, setSuccessModal] = useState<{ visible: boolean; title: string; subtitle: string; accent?: readonly [string, string] }>({ visible: false, title: '', subtitle: '' });

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Init sonrası Dashboard durumu netleşir — tekrar kontrol et
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await RevenueCatService.init(profile?.id); } catch {}
      if (!cancelled && mountedRef.current) {
        setSubReady(RevenueCatService.isSubscriptionAvailable());
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  // ★ 2026-04-25: Analytics — premium ekranı görüntülendi
  useEffect(() => {
    try {
      const { Analytics, Events } = require('../services/analytics');
      Analytics.track(Events.PREMIUM_VIEWED, {
        current_tier: migrateLegacyTier(profile?.subscription_tier),
      });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTier = migrateLegacyTier(profile?.subscription_tier);
  const selectedPlan = PLANS.find(p => p.id === selectedTier)!;
  // ★ Tier hierarchy: Free(0) < Plus(1) < Pro(2). Yön'e göre "Yükselt" / "Düşür" metni.
  const tierRank = (t: string) => (t === 'Pro' ? 2 : t === 'Plus' ? 1 : 0);
  const isUpgrade = tierRank(selectedPlan.tier) > tierRank(currentTier);
  const actionVerb = isUpgrade ? 'Yükselt' : 'Düşür';

  const handleActivate = async () => {
    if (!profile?.id) {
      showToast({ title: i18n.t('plus.004'), type: 'error' });
      return;
    }

    const price = billingCycle === 'monthly'
      ? `${selectedPlan.monthly}₺/ay`
      : `${selectedPlan.yearly}₺/yıl`;

    const modeText = (REVENUECAT_MOCK_MODE && __DEV__) ? '\n\n⚠️ Test modunda — gerçek ödeme alınmaz.' : '';

    setAlertCfg({
      visible: true,
      title: `${selectedPlan.name}'a ${actionVerb}`,
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
                null,
                profile.id,
                selectedPlan.tier,
                billingCycle,
              );
              if (!mountedRef.current) return;
              if (result.error) throw new Error(result.error);
              if (result.newTier) {
                await refreshProfile();
                if (mountedRef.current) {
                  setSuccessModal({
                    visible: true,
                    title: `${selectedPlan.name} Üyelik Aktif!`,
                    subtitle: `Artık ${selectedPlan.name} üyesisiniz — tüm premium özellikler açıldı.`,
                    accent: [selectedPlan.headerGradient[0], selectedPlan.headerGradient[1]] as const,
                  });
                }
              }
            } catch (err: any) {
              if (mountedRef.current) {
                showToast({ title: i18n.t('plus.005'), message: err.message || 'Üyelik aktifleştirilemedi.', type: 'error' });
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
      title: i18n.t('plus.006'),
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
                if (mountedRef.current) showToast({ title: i18n.t('plus.007'), message: i18n.t('plus.008'), type: 'info' });
              } else {
                showToast({ title: 'Bilgi', message: i18n.t('plus.009'), type: 'info' });
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
    <AppBackground radialGlow><View style={styles.container}>{/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <Pressable onPress={() => safeGoBack(router)} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} style={{
            textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
          }} />
        </Pressable>
        <Text style={styles.headerTitle}>{i18n.t('plus.001')}</Text>
        <Ionicons name="star" size={22} color={Colors.gold} style={{
          textShadowColor: `${Colors.gold}dd`,
          textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
        }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 20 }}>
        {/* Mevcut Tier */}
        <View style={styles.currentTierBar}>
          <Text style={styles.currentTierLabel}>{i18n.t('plus.002')}</Text>
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
            <Text style={[styles.billingText, billingCycle === 'monthly' && styles.billingTextActive]}>{i18n.t('plus.003')}</Text>
          </Pressable>
          <Pressable
            style={[styles.billingBtn, billingCycle === 'yearly' && styles.billingActive, { overflow: 'hidden' }]}
            onPress={() => setBillingCycle('yearly')}
            android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
          >
            {billingCycle === 'yearly' && <View style={styles.billingDot} />}
            <Text style={[styles.billingText, billingCycle === 'yearly' && styles.billingTextActive]}>{i18n.t('plus.004')}</Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveText}>-{selectedPlan.savePct}%</Text>
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
                style={({ pressed }) => [
                  styles.planCard,
                  // ★ Glow shadow — accent rengi ile ambient halo
                  {
                    shadowColor: plan.glowColor.slice(0, 7),
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.6,
                    shadowRadius: 18,
                    elevation: 12,
                  },
                  isSelected && { borderColor: plan.color, borderWidth: 2 },
                  isCurrentPlan && !isSelected && { borderColor: plan.color + '60' },
                  pressed && { transform: [{ scale: 0.97 }], opacity: 0.95 },
                ]}
                onPress={() => setSelectedTier(plan.id as any)}
              >
                {/* ★ 3-stop jewel-tone gradient (kart geneli) */}
                <LinearGradient
                  colors={plan.gradient}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />

                {/* ★ Üst cam parıltı — glassmorphic shine */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.05)', 'transparent']}
                  locations={[0, 0.4, 0.8]}
                  start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 0.5 }}
                  style={[StyleSheet.absoluteFillObject, { borderRadius: 18 }]}
                />

                {/* Header: ikon + isim + EN İYİ rozeti */}
                <View style={styles.planCardHeader}>
                  {plan.id === 'pro' && (
                    <View style={styles.popularBadge}>
                      <LinearGradient
                        colors={['#FFE066', '#FBBF24', '#D4A017']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <Ionicons name="flame" size={9} color="#3B1F00" />
                      <Text style={styles.popularText}>{i18n.t('plus.005')}</Text>
                    </View>
                  )}
                  <View style={[styles.planIconCircle, { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.35)' }]}>
                    <Ionicons
                      name={plan.icon as any}
                      size={26}
                      color="#FFFFFF"
                      style={{ textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 }}
                    />
                  </View>
                  <Text style={styles.planCardName}>{plan.name}</Text>
                </View>

                {/* Fiyat & İçerik (cam katman üstünde) */}
                <View style={styles.planCardBody}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
                    <Text style={styles.planPrice}>{price}₺</Text>
                    <Text style={styles.planPeriod}>{period}</Text>
                  </View>
                  {billingCycle === 'yearly' && (
                    <Text style={styles.planMonthly}>Aylık {(plan.yearly / 12).toFixed(0)}₺</Text>
                  )}

                  {/* Özellik Listesi */}
                  <View style={styles.planFeatures}>
                    {plan.features.filter(f => f.included).slice(0, 7).map((f, i) => (
                      <View key={i} style={styles.planFeatureRow}>
                        <Ionicons name="checkmark-circle" size={13} color="#FFFFFF" style={{ textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} />
                        <Text style={styles.planFeatureText} numberOfLines={1}>{f.text}</Text>
                      </View>
                    ))}
                    {plan.features.filter(f => f.included).length > 7 && (
                      <Text style={styles.planFeatureMore}>
                        +{plan.features.filter(f => f.included).length - 7} daha
                      </Text>
                    )}
                  </View>

                  {/* Aktif / Seçildi */}
                  {isCurrentPlan ? (
                    <View style={[styles.planSelectBtn, { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.50)' }]}>
                      <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                      <Text style={[styles.planSelectText, { color: '#FFFFFF' }]}>Aktif</Text>
                    </View>
                  ) : (
                    <View style={[styles.planSelectBtn, isSelected ? { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.50)' } : {}]}>
                      <Text style={[styles.planSelectText, isSelected && { color: '#FFFFFF' }]}>
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
        <Text style={styles.sectionTitle}>{i18n.t('plus.006')}</Text>
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
            { label: i18n.t('plus.010'), values: [`${ROOM_TIER_LIMITS.Free.durationHours}sa`, `${ROOM_TIER_LIMITS.Plus.durationHours}sa`, '7/24'] },
            { label: i18n.t('plus.011'), values: [`${ROOM_TIER_LIMITS.Free.dailyRooms}`, `${ROOM_TIER_LIMITS.Plus.dailyRooms}`, '∞'] },
            { label: i18n.t('plus.012'), values: ['—', '3', '∞'] },
            { label: i18n.t('plus.013'), values: ['Açık + Şifreli', 'Hepsi', 'Hepsi'] },
            { label: 'Ses', values: ['HD Mono', 'HD', 'Stereo'] },
            { label: 'Video', values: ['720p', '720p', '1080p'] },
            { label: i18n.t('plus.014'), values: ['Temel', 'Tümü', 'Tümü'] },
            { label: i18n.t('plus.015'), values: ['✓', '✓', '✓'] },
            { label: 'Tema', values: ['—', '✓', '✓'] },
            { label: i18n.t('plus.016'), values: ['—', '2', '5'] },
            { label: i18n.t('plus.017'), values: ['—', '✓', '✓'] },
            { label: i18n.t('plus.018'), values: ['—', '—', '✓'] },
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

        {/* ═══ Oda Açık Kalma Süresi Açıklaması ═══ */}
        <View style={styles.durationExplain}>
          <View style={styles.durationRow}>
            <View style={[styles.durationIcon, { backgroundColor: '#94A3B818', borderColor: '#94A3B830' }]}>
              <Ionicons name="time-outline" size={16} color="#94A3B8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.durationTitle, { color: '#94A3B8' }]}>Free</Text>
              <Text style={styles.durationDesc}>{i18n.t('plus.007')}</Text>
            </View>
          </View>
          <View style={styles.durationDivider} />
          <View style={styles.durationRow}>
            <View style={[styles.durationIcon, { backgroundColor: TIER_DEFINITIONS.Plus.color + '18', borderColor: TIER_DEFINITIONS.Plus.color + '40' }]}>
              <Ionicons name="snow-outline" size={16} color={TIER_DEFINITIONS.Plus.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.durationTitle, { color: TIER_DEFINITIONS.Plus.color }]}>Plus</Text>
              <Text style={styles.durationDesc}>{i18n.t('plus.008')}</Text>
            </View>
          </View>
          <View style={styles.durationDivider} />
          <View style={styles.durationRow}>
            <View style={[styles.durationIcon, { backgroundColor: TIER_DEFINITIONS.Pro.color + '18', borderColor: TIER_DEFINITIONS.Pro.color + '40' }]}>
              <Ionicons name="infinite-outline" size={16} color={TIER_DEFINITIONS.Pro.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.durationTitle, { color: TIER_DEFINITIONS.Pro.color }]}>Pro</Text>
              <Text style={styles.durationDesc}>{i18n.t('plus.009')}</Text>
            </View>
          </View>
        </View>

        {/* ★ Abonelik sistemi kurulum uyarısı (prod'da Dashboard boşsa) */}
        {!subReady && !__DEV__ && (
          <View style={styles.subUnavailWrap}>
            <Ionicons name="time-outline" size={18} color="#FBBF24" />
            <Text style={styles.subUnavailText}>{i18n.t('plus.001')}</Text>
          </View>
        )}

        {/* CTA */}
        {currentTier !== selectedPlan.tier && (
          <View style={styles.ctaWrap}>
            <Pressable
              onPress={handleActivate}
              disabled={activating || (!subReady && !__DEV__)}
              style={[styles.ctaOuter, (!subReady && !__DEV__) && { opacity: 0.45 }]}
            >
              <LinearGradient
                colors={selectedPlan.headerGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.ctaBtn}
              >
                {activating ? (
                  <AppLoader size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name={selectedPlan.icon as any} size={20} color="#fff" style={{ textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }} />
                    <Text style={styles.ctaText}>
                      {selectedPlan.name}'a {actionVerb} — {billingCycle === 'monthly' ? `${selectedPlan.monthly}₺/ay` : `${selectedPlan.yearly}₺/yıl`}
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
            <Text style={styles.downgradeText}>{i18n.t('plus.010')}</Text>
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

      <PurchaseSuccessModal
        visible={successModal.visible}
        title={successModal.title}
        subtitle={successModal.subtitle}
        accent={successModal.accent}
        onClose={() => setSuccessModal(prev => ({ ...prev, visible: false }))}
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
    flex: 1, borderRadius: 20, overflow: 'hidden',
    // ★ İnce parlak kenarlık — cam kenar etkisi
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    borderTopWidth: 1.8, borderTopColor: 'rgba(255,255,255,0.32)',
    minHeight: 380,
  },
  planCardHeader: {
    alignItems: 'center', paddingTop: 22, paddingBottom: 6, gap: 8, position: 'relative',
  },
  planIconCircle: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.2,
  },
  planCardName: {
    fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
  },
  popularBadge: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, overflow: 'hidden',
    zIndex: 2,
  },
  popularText: { fontSize: 9, fontWeight: '900', color: '#3B1F00', letterSpacing: 0.8 },

  planCardBody: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 8, gap: 6 },
  planPrice: {
    fontSize: 30, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  planPeriod: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginLeft: 3, fontWeight: '700' },
  planMonthly: {
    fontSize: 11, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginBottom: 2, fontWeight: '600',
  },

  planFeatures: { marginTop: 10, gap: 6 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planFeatureText: {
    fontSize: 11, color: 'rgba(255,255,255,0.95)', flex: 1, fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  planFeatureMore: {
    fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 4,
    color: 'rgba(255,255,255,0.85)',
  },

  planSelectBtn: {
    marginTop: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 4, paddingVertical: 11, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.20)',
  },
  planSelectText: { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },

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
  subUnavailWrap: {
    marginTop: 24,
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subUnavailText: {
    flex: 1,
    fontSize: 12,
    color: '#FBBF24',
    fontWeight: '600',
    lineHeight: 17,
  },
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

  // ═══ Oda Açık Kalma Açıklaması ═══
  durationExplain: {
    marginHorizontal: 16, marginTop: 22, padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(20,30,42,0.85)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    ...Shadows.card,
  },
  durationRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 4,
  },
  durationIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  durationTitle: {
    fontSize: 13, fontWeight: '800', letterSpacing: 0.3, marginBottom: 2,
  },
  durationDesc: {
    fontSize: 11.5, color: '#94A3B8', lineHeight: 16, fontWeight: '500',
  },
  durationDivider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 8, marginLeft: 44,
  },
});
