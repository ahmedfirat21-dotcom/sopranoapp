import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Gradients, Radius, Spacing } from '../constants/theme';
import { CoinService, type CoinTransaction } from '../services/database';
import { RevenueCatService, REVENUECAT_MOCK_MODE } from '../services/revenuecat';
import { useAuth } from './_layout';
import { showToast } from '../components/Toast';
import SopranoCoin from '../components/SopranoCoin';

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins}dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

const TX_TYPE_LABELS: Record<string, string> = {
  purchase: 'Coin satın aldın',
  gift_sent: 'Hediye gönderdin',
  gift_received: 'Hediye aldın',
  room_boost: 'Oda Boost',
  reward: 'Ödül kazandın',
};

export default function WalletScreen() {
  const router = useRouter();
  const { firebaseUser, profile, refreshProfile } = useAuth();
  
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const balance = profile?.coins ?? 0;

  useEffect(() => {
    if (!firebaseUser || !profile) return;
    RevenueCatService.configure(profile.id);

    const loadData = async () => {
      try {
        const history = await CoinService.getHistory(firebaseUser.uid);
        setTransactions(history);

        const data = await RevenueCatService.getOfferings();
        if (data?.current?.availablePackages) {
          setOfferings(data.current.availablePackages);
        }
      } catch (err) {
        console.warn('Veri yüklenemedi:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [firebaseUser, profile?.id]);

  const handlePurchase = async (pkg: any) => {
    if (!profile) return;
    setProcessingId(pkg.identifier);
    try {
      const result = await RevenueCatService.purchasePackage(pkg, profile.id);
      
      if (result) {
        if (result.type === 'plus') {
          showToast({ title: 'Tebrikler!', message: 'Artık SopranoChat Plus üyesisin!', type: 'success' });
        } else {
          showToast({ title: 'Başarılı', message: `${result.amount} Jeton hesabına eklendi!`, type: 'success' });
        }
        await refreshProfile();
        // Geçmişi yeniden yükle
        if (firebaseUser) {
           const history = await CoinService.getHistory(firebaseUser.uid);
           setTransactions(history);
        }
      }
    } catch (e: any) {
      if (e.message !== 'USER_CANCELLED') {
        showToast({ title: 'İşlem Başarısız', message: 'Satın alma tamamlanamadı.', type: 'error' });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const plusPackage = offerings.find(o => o.packageType === 'MONTHLY');
  const coinPackages = offerings.filter(o => o.packageType !== 'MONTHLY');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Cüzdan & Mağaza</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          {REVENUECAT_MOCK_MODE && (
            <View style={styles.mockBanner}>
              <Ionicons name="construct" size={16} color={Colors.amber} />
              <Text style={styles.mockText}>Test Modu (Mock): Gerçek para çekilmez</Text>
            </View>
          )}

          {/* Balance Card */}
          <View style={styles.balanceWrap}>
            <LinearGradient
              colors={Gradients.gold as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceCard}
            >
              <SopranoCoin size={28} />
              <Text style={styles.balanceAmount}>{balance}</Text>
              <Text style={styles.balanceLabel}>Soprano Jeton</Text>
            </LinearGradient>
          </View>

          {/* Üyelik Planları Banner */}
          <Pressable style={styles.sectionWrap} onPress={() => router.push('/plus')}>
            <LinearGradient colors={['rgba(20,184,166,0.12)', 'rgba(245,158,11,0.08)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.plusCard}>
              <View style={styles.plusHeader}>
                <Ionicons name="star" size={24} color={Colors.gold} />
                <Text style={styles.plusTitle}>Üyelik Planları</Text>
              </View>
              <Text style={styles.plusDesc}>
                {profile?.is_plus
                  ? `Aktif planın: ${profile?.tier === 'VIP' ? 'VIP' : 'Plus'}. Detayları görüntüle →`
                  : 'Plus veya VIP\'a yükselerek daha fazla sahne, dinleyici ve özellik aç →'}
              </Text>
              <View style={[styles.plusBtn, profile?.is_plus && styles.plusBtnActive]}>
                <Text style={styles.plusBtnText}>
                  {profile?.is_plus ? 'Planını Yönet' : 'Planları Gör'}
                </Text>
              </View>
            </LinearGradient>
          </Pressable>

          {/* Coin Packages */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Jeton Yükle</Text>
            <View style={styles.packagesGrid}>
              {coinPackages.map((pkg) => {
                const isProcessing = processingId === pkg.identifier;
                return (
                  <Pressable 
                    key={pkg.identifier} 
                    style={[styles.packageCard, isProcessing && { opacity: 0.5 }]}
                    disabled={!!processingId}
                    onPress={() => handlePurchase(pkg)}
                  >
                    <SopranoCoin size={24} />
                    <Text style={styles.packageCoins}>{pkg.product.title.split(' ')[0]}</Text>
                    <Text style={styles.packageLabel}>Jeton</Text>
                    <View style={styles.packagePriceBtn}>
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.packagePriceText}>{pkg.product.priceString}</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Transaction History */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>İşlem Geçmişi</Text>
            {transactions.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Ionicons name="receipt-outline" size={32} color={Colors.text3} />
                <Text style={styles.emptyText}>Henüz bir işlem yok.</Text>
              </View>
            ) : (
              transactions.map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <View key={tx.id} style={styles.txItem}>
                    <View style={styles.txLeft}>
                      <View style={[styles.txIcon, { backgroundColor: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                        <Ionicons 
                          name={isPositive ? 'arrow-down' : 'arrow-up'} 
                          size={16} 
                          color={isPositive ? Colors.emerald : Colors.red} 
                        />
                      </View>
                      <View>
                        <Text style={styles.txTitle}>{TX_TYPE_LABELS[tx.type] || 'İşlem'}</Text>
                        <Text style={styles.txDate}>{getRelativeTime(tx.created_at)}</Text>
                      </View>
                    </View>
                    <Text style={[styles.txAmount, { color: isPositive ? Colors.emerald : Colors.red }]}>
                      {isPositive ? '+' : '-'}{Math.abs(tx.amount)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.glassBorder
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.gold },

  mockBanner: { flexDirection: 'row', backgroundColor: 'rgba(251,191,36,0.1)', margin: 20, paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.default, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' },
  mockText: { color: Colors.amber, fontSize: 13, fontWeight: '600' },

  balanceWrap: { padding: 20 },
  balanceCard: {
    borderRadius: Radius.default, padding: 24, alignItems: 'center',
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8
  },
  balanceAmount: { fontSize: 44, fontWeight: '800', color: '#fff', marginVertical: 8 },
  balanceLabel: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },

  sectionWrap: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 16 },

  plusCard: { padding: 20, borderRadius: Radius.default, borderWidth: 1, borderColor: Colors.gold },
  plusHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  plusTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  plusDesc: { fontSize: 14, color: Colors.text2, lineHeight: 22, marginBottom: 20 },
  plusBtn: { backgroundColor: Colors.gold, paddingVertical: 16, borderRadius: Radius.full, alignItems: 'center' },
  plusBtnActive: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.gold },
  plusBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },

  packagesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  packageCard: {
    width: '48%', backgroundColor: Colors.bg2, borderRadius: Radius.default, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.glassBorder, marginBottom: 16
  },
  packageIcon: { marginBottom: 12 },
  packageCoins: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  packageLabel: { fontSize: 13, color: Colors.text3, marginBottom: 16 },
  packagePriceBtn: {
    backgroundColor: Colors.bg3, paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.glassBorder, width: '100%', alignItems: 'center'
  },
  packagePriceText: { color: Colors.text, fontWeight: '700', fontSize: 14 },

  divider: { height: 1, backgroundColor: Colors.glassBorder, marginHorizontal: 20, marginBottom: 24 },
  
  txItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.bg2 },
  txLeft: { flexDirection: 'row', alignItems: 'center' },
  txIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  txDate: { fontSize: 12, color: Colors.text3 },
  txAmount: { fontSize: 16, fontWeight: '700' },

  emptyHistory: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: Colors.text3, fontSize: 14, marginTop: 12 },
});
