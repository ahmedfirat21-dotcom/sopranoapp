// ★ v107 (4 May 2026): Koleksiyon detay sayfası — tek koleksiyondaki ürünleri grid'de gösterir.
//   /store/collection/[id] route'u. Collection kartına tıklamak buraya yönlendirir.
//   StoreScreen'deki gallery card pattern'ı + filtered fetch.

import React, { useEffect, useState } from 'react';
import { i18n } from '../../../services/i18n';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated, Easing, Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../../constants/navigation';
import AppBackground from '../../../components/AppBackground';
import SPIcon from '../../../components/SPIcon';
import { showToast } from '../../../components/Toast';
import PremiumAlert, { type AlertButton } from '../../../components/PremiumAlert';
import PurchaseSuccessModal from '../../../components/PurchaseSuccessModal';
import { useAuth } from '../../_layout';
import { StoreService, type CosmeticItem, type Collection, type Rarity } from '../../../services/store';
// ★ v109.2: Ana store'daki GalleryCard'ı reuse — kart render hiyerarşisi
//   (Lottie / Item3DArt / emoji) tek yerde, kod tekrarı yok.
import { GalleryCard } from '../../store';

const { width: W } = Dimensions.get('window');

const RARITY_LABEL: Record<Rarity, string> = {
  divine: 'İLAHİ', mythic: 'EFSANEVİ', legendary: 'EFSANE', rare: 'NADİR', new: 'YENİ',
};
const RARITY_COLOR: Record<Rarity, string> = {
  divine: '#F472B6', mythic: '#C4B5FD', legendary: '#FBBF24', rare: '#22D3EE', new: '#FB923C',
};

// ★ v109.2: Local ItemCard kaldırıldı — ana store'daki GalleryCard reuse edildi
//   (yukarı import'a bakın). Lottie/PNG/emoji render hiyerarşisi tek yerde.

export default function CollectionDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, firebaseUser } = useAuth();
  const sp = (profile as any)?.system_points || 0;
  const [items, setItems] = useState<CosmeticItem[]>([]);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [inventory, setInventory] = useState<Set<string>>(new Set());
  const [purchasing, setPurchasing] = useState<string | null>(null);
  // ★ v107 hotfix: Native Alert → PremiumAlert
  const [confirmAlert, setConfirmAlert] = useState<{
    visible: boolean; title: string; message: string; buttons: AlertButton[];
  }>({ visible: false, title: '', message: '', buttons: [] });
  // ★ v109.1: Satın alma başarı modalı
  const [successModal, setSuccessModal] = useState<{
    visible: boolean; title: string; subtitle?: string; accent?: readonly [string, string];
  }>({ visible: false, title: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { items: allItems, collections } = await StoreService.getCatalog();
      if (cancelled) return;
      const filtered = allItems.filter((i) => i.collection_id === id);
      setItems(filtered);
      setCollection(collections.find((c) => c.id === id) || null);
    })();
    if (firebaseUser?.uid) {
      StoreService.getUserInventory(firebaseUser.uid).then((inv) => {
        if (!cancelled) setInventory(inv);
      });
    }
    return () => { cancelled = true; };
  }, [id, firebaseUser?.uid]);

  const handlePurchase = (item: CosmeticItem) => {
    if (!firebaseUser?.uid) return;
    if (inventory.has(item.id)) {
      showToast({ title: 'Zaten sahipsin', message: `${item.name} envanterinde.`, type: 'info' });
      return;
    }
    setConfirmAlert({
      visible: true,
      title: i18n.t('store.collection.id.001'),
      message: `${item.name} için ${item.price_sp.toLocaleString('tr-TR')} SP harcanacak. Onaylıyor musun?`,
      buttons: [
        { text: 'Vazgeç', style: 'cancel', onPress: () => setConfirmAlert(p => ({ ...p, visible: false })) },
        {
          text: 'Satın Al', style: 'default', icon: 'sparkles',
          onPress: async () => {
            setConfirmAlert(p => ({ ...p, visible: false }));
            setPurchasing(item.id);
            const r = await StoreService.purchase(firebaseUser.uid, item.id);
            setPurchasing(null);
            if (r.success) {
              const label = (item.category === 'atelier' || item.category === 'frames') ? 'Çerçeve'
                : (item.category === 'message_art' || item.category === 'entry_effect') ? 'Giriş Efekti'
                : item.category === 'gift' ? 'Hediye' : 'Ürün';
              const accentByRarity: readonly [string, string] = item.rarity === 'divine' ? ['#FBBF24', '#854F0B']
                : item.rarity === 'mythic' ? ['#F472B6', '#831843']
                : item.rarity === 'legendary' ? ['#FFE082', '#B45309']
                : item.rarity === 'rare' ? ['#A78BFA', '#5B21B6']
                : ['#14B8A6', '#0E7490'];
              setSuccessModal({
                visible: true,
                title: `${label} Satın Alındı`,
                subtitle: `${item.name} envanterine eklendi · ${r.cost} SP harcandı`,
                accent: accentByRarity,
              });
              setInventory((prev) => new Set(prev).add(item.id));
            } else {
              showToast({ title: 'Hata', message: r.error || 'Bağlantı sorunu', type: 'error' });
            }
          },
        },
      ],
    });
  };

  return (
    <AppBackground>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          {collection && (
            <LinearGradient
              colors={[collection.bg_gradient_start || '#1a1330', collection.bg_gradient_end || '#0a0a1a']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <View style={s.headerRow}>
            <Pressable onPress={() => safeGoBack(router)} hitSlop={8} style={s.backBtn}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.title}>{collection?.name || 'Koleksiyon'}</Text>
              {collection?.tag && <Text style={s.subtitle}>{collection.tag}</Text>}
            </View>
            <View style={s.balancePill}>
              <SPIcon size={14} />
              <Text style={s.balanceText}>{sp.toLocaleString('tr-TR')}</Text>
            </View>
          </View>
          <Text style={s.itemCount}>{items.length} parça</Text>
        </View>

        {/* Grid */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 + insets.bottom, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="bag-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={s.emptyText}>{i18n.t('store.collection.id.001')}</Text>
            </View>
          ) : (
            <View style={s.grid}>
              {items.map((item) => (
                <GalleryCard
                  key={item.id}
                  item={item}
                  owned={inventory.has(item.id)}
                  onPress={() => handlePurchase(item)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
      <PremiumAlert
        visible={confirmAlert.visible}
        title={confirmAlert.title}
        message={confirmAlert.message}
        type="warning"
        icon="bag-handle"
        buttons={confirmAlert.buttons}
        onDismiss={() => setConfirmAlert(p => ({ ...p, visible: false }))}
      />
      <PurchaseSuccessModal
        visible={successModal.visible}
        title={successModal.title}
        subtitle={successModal.subtitle}
        accent={successModal.accent}
        onClose={() => setSuccessModal(p => ({ ...p, visible: false }))}
      />
    </AppBackground>
  );
}

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const cardSize = (W - 16 * 2 - 10) / 2;

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(251,191,36,0.2)',
    overflow: 'hidden', position: 'relative',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  backBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  title: { color: '#fff', fontFamily: serif, fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  subtitle: { color: 'rgba(251,191,36,0.7)', fontSize: 9, letterSpacing: 2.5, fontWeight: '600', marginTop: 2 },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 100, borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.4)',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  balanceText: { color: '#FFE082', fontSize: 12, fontWeight: '800' },
  itemCount: {
    color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 1.5,
    fontWeight: '600', textAlign: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontStyle: 'italic' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: cardSize, height: cardSize,
    borderRadius: 16, borderWidth: 0.5,
    overflow: 'hidden', position: 'relative',
  },
  // ★ v109.2: Art alanı — Lottie/PNG ortalanmış, kart üst %70 alanı
  artWrap: {
    position: 'absolute',
    top: '8%', left: '8%', right: '8%', height: '60%',
    alignItems: 'center', justifyContent: 'center',
  },
  cardArt: {
    position: 'absolute',
    top: '20%', left: '50%',
    fontSize: 56,
    transform: [{ translateX: -28 }],
  },
  rareDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4, zIndex: 3,
  },
  ownedBadge: {
    position: 'absolute', top: 8, left: 8, zIndex: 3,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 100, borderWidth: 0.5,
    borderColor: 'rgba(93,202,165,0.5)', overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  ownedText: { fontSize: 8, fontWeight: '800', letterSpacing: 1, color: '#5DCAA5' },
  cardInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 10, paddingVertical: 10, overflow: 'hidden',
  },
  cardName: { color: '#fff', fontFamily: serif, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  cardMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 8.5, letterSpacing: 0.8, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceText: { color: '#FFE082', fontSize: 13, fontWeight: '800', fontFamily: serif },
  priceUnit: { color: 'rgba(251,191,36,0.6)', fontSize: 9, fontWeight: '600' },
});
