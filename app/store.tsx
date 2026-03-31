import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, Gradients, Radius } from '../constants/theme';
import { StoreService, type StoreItem, type UserPurchase } from '../services/database';
import EmptyState from '../components/EmptyState';
import { useAuth } from './_layout';
import { showToast } from '../components/Toast';
import SopranoCoin from '../components/SopranoCoin';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'frames' | 'colors' | 'effects' | 'themes' | 'emojis';

export default function StoreScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('frames');
  const [items, setItems] = useState<StoreItem[]>([]);
  const [purchases, setPurchases] = useState<UserPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadStoreData();
  }, []);

  const loadStoreData = async () => {
    if (!profile) return;
    try {
      const dbItems = await StoreService.getStoreItems();
      const dbPurchases = await StoreService.getUserPurchases(profile.id);
      setItems(dbItems);
      setPurchases(dbPurchases);
    } catch (error) {
      console.warn('Mağaza yüklenemedi:', error);
      showToast({ title: 'Hata', message: 'Mağaza verileri alınamadı.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (item: StoreItem) => {
    if (!profile) return;
    if (profile.coins < item.price_coins) {
      showToast({ title: 'Yetersiz Bakiye', message: 'Daha fazla Coin satın almalısın.', type: 'error' });
      return;
    }
    
    setProcessingId(item.id);
    try {
      await StoreService.purchaseItem(profile.id, item.id);
      showToast({ title: 'Satın Alındı!', message: `${item.name} artık senin!`, type: 'success' });
      // Refresh local data
      await loadStoreData();
      await refreshProfile();
    } catch (error: any) {
      showToast({ title: 'Satın alma başarısız', message: error.message, type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleEquip = async (item: StoreItem) => {
    if (!profile) return;
    setProcessingId(item.id);
    try {
      await StoreService.equipItem(profile.id, item.id);
      showToast({ title: 'Kuşanıldı!', message: `${item.name} başarıyla aktifleşti.`, type: 'success' });
      await refreshProfile();
    } catch (error) {
      showToast({ title: 'Hata', message: 'Eşya kuşanılamadı.', type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnequip = async (type: string) => {
    if (!profile) return;
    setProcessingId(`unequip_${type}`);
    try {
      // API currently uses null to unequip, but we didn't fully implement categorical nulling in RPC easily.
      // So we just re-sync if it supports it, or pass null and it removes it.
      await StoreService.equipItem(profile.id, null);
      showToast({ title: 'Çıkarıldı', message: 'Kozmetik başarıyla çıkarıldı.', type: 'success' });
      await refreshProfile();
    } catch (error) {
      showToast({ title: 'Hata', message: 'Mevcut kozmetik çıkarılamadı.', type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  // Helper getters
  const hasPurchased = (itemId: string) => purchases.some(p => p.item_id === itemId);
  const isEquipped = (itemId: string) => [profile?.active_frame, profile?.active_chat_color, profile?.active_entry_effect].includes(itemId);

  const getFilteredItems = (type: TabType) => {
    const typeMapping: Record<TabType, string> = {
      frames: 'profile_frame',
      colors: 'chat_bubble',
      effects: 'entry_effect',
      themes: 'room_theme',
      emojis: 'emoji_pack',
    };
    return items.filter(i => i.type === typeMapping[type]);
  };

  const renderItemCard = (item: StoreItem) => {
    const owned = hasPurchased(item.id);
    const equipped = isEquipped(item.id);
    const isProcessing = processingId === item.id;

    // Renk veya çerçeve görselini placeholder
    const isColor = item.type === 'chat_bubble';
    const rarityColors = { common: '#A0AEC0', rare: '#3B82F6', epic: '#8B5CF6', legendary: '#F59E0B' };
    const rColor = rarityColors[item.rarity as keyof typeof rarityColors] || rarityColors.common;

    return (
      <View key={item.id} style={[styles.itemCard, { borderColor: owned ? Colors.teal : Colors.glassBorder }]}>
        {/* Görsel Kutusu */}
        <View style={styles.itemImageContainer}>
          {isColor ? (
            <View style={[styles.colorPreview, { backgroundColor: rColor, opacity: 0.8 }]} />
          ) : (
            <View style={[styles.framePreview, { borderColor: rColor }]} />
          )}
          <View style={[styles.rarityBadge, { backgroundColor: rColor }]}>
            <Text style={styles.rarityText}>{item.rarity.toUpperCase()}</Text>
          </View>
        </View>

        {/* Detaylar */}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
          
          <View style={styles.actionRow}>
            {!owned ? (
              <Text style={styles.priceText}><SopranoCoin size={14} /> {item.price_coins}</Text>
            ) : (
              <Text style={styles.ownedText}>Sende Var ✅</Text>
            )}

            <Pressable
              style={[
                styles.actionBtn,
                owned ? (equipped ? styles.actionBtnEquipped : styles.actionBtnEquip) : styles.actionBtnBuy,
                isProcessing && { opacity: 0.5 }
              ]}
              disabled={isProcessing || equipped}
              onPress={() => owned ? handleEquip(item) : handlePurchase(item)}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>
                  {owned ? (equipped ? 'Kuşanıldı' : 'Kullan') : 'Satın Al'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Soprano Mağazası</Text>
        <View style={styles.walletBox}>
          <SopranoCoin size={16} />
          <Text style={styles.walletText}>{profile?.coins ?? 0}</Text>
        </View>
      </View>

      <View style={styles.tabsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          <Pressable style={[styles.tab, activeTab === 'frames' && styles.activeTab]} onPress={() => setActiveTab('frames')}>
            <Text style={[styles.tabText, activeTab === 'frames' && styles.activeTabText]}>Çerçeveler</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'colors' && styles.activeTab]} onPress={() => setActiveTab('colors')}>
            <Text style={[styles.tabText, activeTab === 'colors' && styles.activeTabText]}>Sohbet Renkleri</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'effects' && styles.activeTab]} onPress={() => setActiveTab('effects')}>
            <Text style={[styles.tabText, activeTab === 'effects' && styles.activeTabText]}>Giriş Efektleri</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'themes' && styles.activeTab]} onPress={() => setActiveTab('themes')}>
            <Text style={[styles.tabText, activeTab === 'themes' && styles.activeTabText]}>Oda Temaları</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'emojis' && styles.activeTab]} onPress={() => setActiveTab('emojis')}>
            <Text style={[styles.tabText, activeTab === 'emojis' && styles.activeTabText]}>Emoji Paketleri</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.teal} style={{ marginTop: 60 }} />
        ) : (
          <View style={styles.grid}>
            {getFilteredItems(activeTab).length === 0 ? (
              <View style={{ width: '100%', marginTop: 20 }}>
                <EmptyState
                  icon="storefront-outline"
                  title="Mağaza hazırlanıyor"
                  subtitle="Çok yakında harika ürünler burada olacak!"
                />
              </View>
            ) : (
              getFilteredItems(activeTab).map(renderItemCard)
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.glassBorder
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bg3, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  walletBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251,191,36,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  coinIcon: { fontSize: 16, marginRight: 4 },
  walletText: { fontSize: 15, fontWeight: '700', color: Colors.gold },

  tabsRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.bg2 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.full, backgroundColor: Colors.bg3, marginRight: 8 },
  activeTab: { backgroundColor: Colors.teal },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.text2 },
  activeTabText: { color: '#fff' },

  content: { padding: 20, paddingBottom: 60 },
  grid: { gap: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  emptyText: { color: Colors.text3, textAlign: 'center', width: '100%', marginTop: 40 },

  itemCard: {
    width: (SCREEN_WIDTH - 56) / 2, // 2 kolon
    backgroundColor: Colors.bg3,
    borderRadius: Radius.default,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden'
  },
  itemImageContainer: {
    height: 100, backgroundColor: Colors.bg4,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative'
  },
  rarityBadge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rarityText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 1 },

  framePreview: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderStyle: 'dashed' },
  colorPreview: { width: 60, height: 30, borderRadius: 15 },

  itemInfo: { padding: 12 },
  itemName: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  itemDesc: { fontSize: 11, color: Colors.text2, lineHeight: 16, marginBottom: 12, height: 32 },
  
  actionRow: { flexDirection: 'column', gap: 8 },
  priceText: { fontSize: 14, fontWeight: '700', color: Colors.gold, textAlign: 'center' },
  ownedText: { fontSize: 12, fontWeight: '700', color: Colors.teal, textAlign: 'center' },
  
  actionBtn: { paddingVertical: 8, borderRadius: Radius.sm, alignItems: 'center' },
  actionBtnBuy: { backgroundColor: 'rgba(251,191,36,0.1)' },
  actionBtnEquip: { backgroundColor: Colors.teal },
  actionBtnEquipped: { backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.glassBorder },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
