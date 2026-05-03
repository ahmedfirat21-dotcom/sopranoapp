// ★ v107 (4 May 2026): Koleksiyon detay sayfası — tek koleksiyondaki ürünleri grid'de gösterir.
//   /store/collection/[id] route'u. Collection kartına tıklamak buraya yönlendirir.
//   StoreScreen'deki gallery card pattern'ı + filtered fetch.

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated, Easing, Platform, Dimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../../constants/navigation';
import AppBackground from '../../../components/AppBackground';
import SPIcon from '../../../components/SPIcon';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../_layout';
import { StoreService, type CosmeticItem, type Collection, type Rarity } from '../../../services/store';
import { getIllustrationHtml, isFullCardItem } from '../../../constants/storeIllustrations';

const { width: W } = Dimensions.get('window');

const RARITY_LABEL: Record<Rarity, string> = {
  divine: 'İLAHİ', mythic: 'EFSANEVİ', legendary: 'EFSANE', rare: 'NADİR', new: 'YENİ',
};
const RARITY_COLOR: Record<Rarity, string> = {
  divine: '#F472B6', mythic: '#C4B5FD', legendary: '#FBBF24', rare: '#22D3EE', new: '#FB923C',
};

function Item3DArt({ itemId, fullSize = false, size = 110 }: { itemId: string; fullSize?: boolean; size?: number }) {
  const html = getIllustrationHtml(itemId);
  if (!html) return null;
  const wrapStyle = fullSize ? StyleSheet.absoluteFillObject : { width: size, height: size };
  const webStyle = fullSize
    ? { flex: 1, backgroundColor: 'transparent' as const }
    : { width: size, height: size, backgroundColor: 'transparent' as const };
  return (
    <View pointerEvents="none" style={wrapStyle}>
      <WebView source={{ html }} style={webStyle} containerStyle={{ backgroundColor: 'transparent' }}
        scrollEnabled={false} bounces={false} originWhitelist={['*']}
        javaScriptEnabled domStorageEnabled={false} androidLayerType="hardware" scalesPageToFit={false} />
    </View>
  );
}

function ItemCard({ item, owned, onPress }: { item: CosmeticItem; owned: boolean; onPress: () => void }) {
  const rarity = (item.rarity as Rarity) || 'rare';
  const rarityColor = RARITY_COLOR[rarity];
  const fullCard = isFullCardItem(item.id);
  return (
    <Pressable onPress={onPress} style={[s.card, { borderColor: rarityColor + '4D' }]}>
      {fullCard ? (
        <Item3DArt itemId={item.id} fullSize />
      ) : (
        <LinearGradient
          colors={[item.bg_gradient_start || '#1a1330', item.bg_gradient_end || '#0a0a1a']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <View style={[s.rareDot, { backgroundColor: rarityColor }]} />
      {owned && (
        <View style={s.ownedBadge}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="checkmark-circle" size={10} color="#5DCAA5" />
          <Text style={s.ownedText}>SAHİP</Text>
        </View>
      )}
      <View style={s.cardInfo}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.95)']}
          locations={[0, 0.4, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={s.cardName}>{item.name}</Text>
        {item.meta && <Text style={s.cardMeta} numberOfLines={1}>{item.meta}</Text>}
        <View style={s.priceRow}>
          <SPIcon size={11} />
          <Text style={s.priceText}>{item.price_sp.toLocaleString('tr-TR')}</Text>
          {item.per_message && <Text style={s.priceUnit}>/ mesaj</Text>}
        </View>
      </View>
    </Pressable>
  );
}

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
    Alert.alert(
      'Satın Al',
      `${item.name} için ${item.price_sp.toLocaleString('tr-TR')} SP harcanacak. Onaylıyor musun?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Satın Al', style: 'default',
          onPress: async () => {
            setPurchasing(item.id);
            const r = await StoreService.purchase(firebaseUser.uid, item.id);
            setPurchasing(null);
            if (r.success) {
              showToast({ title: '✓ Satın Alındı', message: `${item.name} envanterinde`, type: 'success' });
              setInventory((prev) => new Set(prev).add(item.id));
            } else {
              showToast({ title: 'Hata', message: r.error || 'Bağlantı sorunu', type: 'error' });
            }
          },
        },
      ],
    );
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
              <Text style={s.emptyText}>Bu koleksiyonda henüz ürün yok</Text>
            </View>
          ) : (
            <View style={s.grid}>
              {items.map((item) => (
                <ItemCard
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
