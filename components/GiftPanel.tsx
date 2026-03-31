/**
 * SopranoChat — Hediye Gönderme Paneli
 * Chat ve Room ekranlarında kullanılır
 * Animasyonlu hediye kataloğu + gönderme akışı
 */
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Modal, Animated, Dimensions, ActivityIndicator, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Radius } from '../constants/theme';
import { showToast } from './Toast';
import SopranoCoin from './SopranoCoin';
import GiftAnimation from './GiftAnimation';
import { Image } from 'react-native';
import { PREMIUM_3D_GIFTS } from '../constants/Gifts3D';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Yerleşik hediye emojileri (Lottie yoksa fallback)
const GIFT_EMOJI: Record<string, string> = {
  rose: '🌹', tea: '☕', ring: '💍', icecream: '🍦', chocolate: '🍫', cookie: '🍪', lollipop: '🍭', balloon: '🎈', kiss: '💋', sunglasses: '🕶️',
  soda: '🥤', note: '🎵', wand: '🪄', hourglass: '⏳', letter: '💌', rainbow: '🌈', matcha: '🍵', cocktail: '🍹', daisy: '🌼', cactus: '🌵',
  coffee: '☕', sword: '⚔️', ghost: '👻', pizza: '🍕', burger: '🍔',
  heart: '💖', cat: '😻', moneybag: '💰', guitar: '🎸', teddy: '🧸', watch: '⌚', giftbox: '🎁', star: '⭐', cake: '🎂', mic: '🎤',
  popcorn: '🍿', headphones: '🎧', champagne: '🍾', medal: '🏅', crown: '👑', crystalball: '🔮', bouquet: '💐', alien: '👽', sun: '🌞',
  diamond: '💎', dart: '🎯', fire: '🔥', unicorn: '🦄', rocket: '🚀', sportscar: '🏎️', plane: '✈️', ship: '🛳️', castle: '🏰', dragon: '🐉',
  cybercity: '🏙️', soprano: '⚜️', lion: '🦁', panther: '🐆', throne: '🪑', planet: '🪐'
};

// Yerleşik hediye kataloğu (DB'den gelemezse)
const DEFAULT_GIFTS = [
  // Basic (5 - 25 SC) — ucuz, sık gönderilebilir
  { id: 'rose', name: 'Gül', price: 5, animation_url: '', is_premium: false },
  { id: 'tea', name: 'Çay', price: 5, animation_url: '', is_premium: false },
  { id: 'ring', name: 'Yüzük', price: 5, animation_url: '', is_premium: false },
  { id: 'icecream', name: 'Dondurma', price: 5, animation_url: '', is_premium: false },
  { id: 'chocolate', name: 'Çikolata', price: 5, animation_url: '', is_premium: false },
  { id: 'cookie', name: 'Kurabiye', price: 5, animation_url: '', is_premium: false },
  { id: 'lollipop', name: 'Lolipop', price: 5, animation_url: '', is_premium: false },
  { id: 'balloon', name: 'Balon', price: 5, animation_url: '', is_premium: false },
  { id: 'kiss', name: 'Öpücük', price: 5, animation_url: '', is_premium: false },
  { id: 'sunglasses', name: 'Gözlük', price: 5, animation_url: '', is_premium: false },
  { id: 'soda', name: 'Kola', price: 5, animation_url: '', is_premium: false },
  { id: 'note', name: 'Nota', price: 5, animation_url: '', is_premium: false },
  { id: 'wand', name: 'Sihir', price: 10, animation_url: '', is_premium: false },
  { id: 'hourglass', name: 'Kum Saati', price: 10, animation_url: '', is_premium: false },
  { id: 'letter', name: 'Aşk Mektubu', price: 15, animation_url: '', is_premium: false },
  { id: 'rainbow', name: 'Gökkuşağı', price: 15, animation_url: '', is_premium: false },
  { id: 'matcha', name: 'Matcha', price: 15, animation_url: '', is_premium: false },
  { id: 'cocktail', name: 'Kokteyl', price: 15, animation_url: '', is_premium: false },
  { id: 'daisy', name: 'Papatya', price: 20, animation_url: '', is_premium: false },
  { id: 'cactus', name: 'Kaktüs', price: 20, animation_url: '', is_premium: false },
  { id: 'coffee', name: 'Kahve', price: 25, animation_url: '', is_premium: false },
  { id: 'sword', name: 'Savaşçı', price: 25, animation_url: '', is_premium: false },
  { id: 'ghost', name: 'Hayalet', price: 25, animation_url: '', is_premium: false },
  { id: 'pizza', name: 'Pizza', price: 25, animation_url: '', is_premium: false },
  { id: 'burger', name: 'Burger', price: 25, animation_url: '', is_premium: false },

  // Premium (50 - 250 SC) — orta segment
  { id: 'heart', name: 'Kalp', price: 50, animation_url: '', is_premium: true },
  { id: 'cat', name: 'Kedicik', price: 50, animation_url: '', is_premium: true },
  { id: 'moneybag', name: 'Para Çantası', price: 50, animation_url: '', is_premium: true },
  { id: 'guitar', name: 'Gitar', price: 50, animation_url: '', is_premium: true },
  { id: 'teddy', name: 'Ayıcık', price: 50, animation_url: '', is_premium: true },
  { id: 'watch', name: 'Saat', price: 75, animation_url: '', is_premium: true },
  { id: 'giftbox', name: 'Hediye Kutusu', price: 100, animation_url: '', is_premium: true },
  { id: 'star', name: 'Yıldız', price: 100, animation_url: '', is_premium: true },
  { id: 'cake', name: 'Pasta', price: 100, animation_url: '', is_premium: true },
  { id: 'mic', name: 'Mikrofon', price: 100, animation_url: '', is_premium: true },
  { id: 'popcorn', name: 'Mısır', price: 125, animation_url: '', is_premium: true },
  { id: 'headphones', name: 'Kulaklık', price: 150, animation_url: '', is_premium: true },
  { id: 'champagne', name: 'Şampanya', price: 150, animation_url: '', is_premium: true },
  { id: 'medal', name: 'Madalya', price: 200, animation_url: '', is_premium: true },
  { id: 'crown', name: 'Taç', price: 250, animation_url: '', is_premium: true },
  { id: 'crystalball', name: 'Kahin', price: 250, animation_url: '', is_premium: true },
  { id: 'bouquet', name: 'Buket', price: 250, animation_url: '', is_premium: true },
  { id: 'alien', name: 'Uzaylı', price: 250, animation_url: '', is_premium: true },
  { id: 'sun', name: 'Güneş', price: 250, animation_url: '', is_premium: true },

  // Legendary (500 - 25000 SC) — gösteriş odaklı
  { id: 'diamond', name: 'Elmas', price: 500, animation_url: '', is_premium: true },
  { id: 'dart', name: 'Tam İsabet', price: 500, animation_url: '', is_premium: true },
  { id: 'fire', name: 'Ateş', price: 750, animation_url: '', is_premium: true },
  { id: 'unicorn', name: 'Unicorn', price: 750, animation_url: '', is_premium: true },
  { id: 'rocket', name: 'Roket', price: 1000, animation_url: '', is_premium: true },
  { id: 'sportscar', name: 'Spor Araba', price: 1500, animation_url: '', is_premium: true },
  { id: 'plane', name: 'Uçak', price: 1500, animation_url: '', is_premium: true },
  { id: 'ship', name: 'Yat', price: 2000, animation_url: '', is_premium: true },
  { id: 'castle', name: 'Şato', price: 2500, animation_url: '', is_premium: true },
  { id: 'dragon', name: 'Ejderha', price: 3500, animation_url: '', is_premium: true },
  { id: 'cybercity', name: 'Cyberpunk Şehir', price: 5000, animation_url: '', is_premium: true },
  { id: 'soprano', name: 'Soprano King', price: 5000, animation_url: '', is_premium: true },
  { id: 'lion', name: 'Aslan', price: 7500, animation_url: '', is_premium: true },
  { id: 'panther', name: 'Panter', price: 10000, animation_url: '', is_premium: true },
  { id: 'throne', name: 'Taht', price: 15000, animation_url: '', is_premium: true },
  { id: 'planet', name: 'Gezegen', price: 25000, animation_url: '', is_premium: true },
];

type GiftItem = {
  id: string;
  name: string;
  price: number;
  animation_url: string;
  is_premium: boolean;
};

export type RoomUserForGift = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
};

type GiftPanelProps = {
  visible: boolean;
  onClose: () => void;
  userCoins: number;
  onSend: (giftId: string, giftPrice: number, count: number, targetId: string) => Promise<boolean>;
  roomUsers: RoomUserForGift[];
  defaultTargetId?: string;
};

type GiftCategory = 'basic' | 'premium' | 'legendary';

export function GiftPanel({ visible, onClose, userCoins, onSend, roomUsers = [], defaultTargetId }: GiftPanelProps) {
  const [gifts] = useState<GiftItem[]>(DEFAULT_GIFTS);
  const [selectedGift, setSelectedGift] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [sending, setSending] = useState(false);
  const [showAnimation, setShowAnimation] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<GiftCategory>('basic');

  const filteredGifts = gifts.filter(g => {
    if (activeCategory === 'basic') return g.price <= 50;
    if (activeCategory === 'premium') return g.price > 50 && g.price < 1000;
    return g.price >= 1000; // legendary
  });

  useEffect(() => {
    if (visible) {
      if (defaultTargetId) setSelectedTargetId(defaultTargetId);
      else if (roomUsers.length > 0) setSelectedTargetId(roomUsers[0].id);
      setQuantity(1);
    }
  }, [visible, defaultTargetId, roomUsers]);

  // 1. Native Modal yerine tam kontrollü Animated View
  const translateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 150,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: Dimensions.get('window').height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  const handleSend = async () => {
    if (!selectedGift || !selectedTargetId) {
      showToast({ title: 'Hedef ve hediye seçin', type: 'info' });
      return;
    }

    const gift = gifts.find(g => g.id === selectedGift);
    if (!gift) return;

    const totalCost = gift.price * quantity;

    if (userCoins < totalCost) {
      showToast({ title: 'Yetersiz Soprano Coin!', message: 'Cüzdandan satın alın.', type: 'error' });
      return;
    }

    setSending(true);
    try {
      const success = await onSend(gift.id, gift.price, quantity, selectedTargetId);
      if (success) {
        setSelectedGift(null);
        setShowAnimation(null);
        onClose();
      }
    } catch (err) {
      // silent
    } finally {
      setSending(false);
    }
  };

  const renderGiftItem = ({ item }: { item: GiftItem }) => {
    const isSelected = selectedGift === item.id;
    const canAfford = userCoins >= item.price;
    const emoji = GIFT_EMOJI[item.id] || '🎁';
    const premiumGift = PREMIUM_3D_GIFTS[item.id];

    return (
      <Pressable
        style={[
          styles.giftItem,
          isSelected && styles.giftItemSelected,
          !canAfford && styles.giftItemDisabled,
        ]}
        onPress={() => canAfford && setSelectedGift(item.id)}
      >
        {premiumGift?.imageSrc ? (
          <Image 
            source={premiumGift.imageSrc} 
            style={{ width: 44, height: 44, marginBottom: 4 }} 
            resizeMode="contain" 
          />
        ) : (
          <Text style={styles.giftEmoji}>{emoji}</Text>
        )}
        <Text style={[styles.giftName, isSelected && styles.giftNameSelected]}>
          {item.name}
        </Text>
        <View style={styles.giftPriceRow}>
          <SopranoCoin size={12} />
          <Text style={[styles.giftPrice, !canAfford && { color: Colors.red }]}>
            {item.price}
          </Text>
        </View>
        {item.is_premium && (
          <View style={styles.premiumBadge}>
            <Ionicons name="star" size={8} color="#FBBF24" />
          </View>
        )}
      </Pressable>
    );
  };

  // pointerEvents='none' görünmezken dokunmaları yutar
  return (
    <Animated.View 
      pointerEvents={visible ? 'auto' : 'none'} 
      style={[
        StyleSheet.absoluteFill, 
        { 
          zIndex: 99999, 
          elevation: 99999, 
          backgroundColor: 'transparent',
          opacity: overlayOpacity
        }
      ]}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View 
          style={[
            styles.panelContainer, 
            { transform: [{ translateY }] }
          ]} 
          onStartShouldSetResponder={() => true}
        >
          <View style={{ width: '100%', paddingTop: 16 }} onStartShouldSetResponder={() => true}>
            {/* Animasyonlu hediye gösterimi */}
            <GiftAnimation
              giftId={showAnimation || 'rose'}
              senderName="Sen"
              giftName={gifts.find(g => g.id === showAnimation)?.name || "Hediye"}
              tier={gifts.find(g => g.id === showAnimation)?.price! >= 50 ? 'legendary' : gifts.find(g => g.id === showAnimation)?.price! >= 10 ? 'premium' : 'basic'}
              visible={!!showAnimation}
              onComplete={() => setShowAnimation(null)}
            />

            {/* Panel başlığı */}
            <View style={styles.panelHeader}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={onClose} style={{ padding: 4, marginRight: 8 }}>
                  <Ionicons name="chevron-down" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.panelTitle}>Hediye Gönder</Text>
              </View>
              <View style={styles.coinBalance}>
                <SopranoCoin size={12} />
                <Text style={styles.coinText}>{userCoins}</Text>
              </View>
            </View>

          {/* Hedef Kullanıcı Seçici (Kime?) */}
          <View style={styles.selectorSection}>
            <Text style={styles.sectionLabel}>Hedef ({roomUsers.find(u=>u.id === selectedTargetId)?.name || '...'})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetList}>
              {roomUsers.length === 0 && <Text style={{color: 'rgba(255,255,255,0.4)', fontSize: 12}}>Odada kimse yok</Text>}
              {roomUsers.map(u => {
                const isSelected = selectedTargetId === u.id;
                return (
                  <Pressable
                    key={u.id}
                    style={[styles.targetAvatarBg, isSelected && styles.targetAvatarSelected]}
                    onPress={() => setSelectedTargetId(u.id)}
                  >
                    <Text style={{color: isSelected ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 'bold'}}>
                      {u.name.slice(0, 2).toUpperCase()}
                    </Text>
                    {u.role === 'host' && (
                      <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: Colors.bg2, borderRadius: 8, padding: 1 }}>
                        <Ionicons name="star" size={10} color={Colors.gold} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* ═══ KATEGORİ TABLARI ═══ */}
          <View style={{ flexDirection: 'row', marginBottom: 8, gap: 6 }}>
            {([['basic', '🎈 Basit'], ['premium', '💎 Premium'], ['legendary', '🔥 Efsanevi']] as [GiftCategory, string][]).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => { setActiveCategory(key); setSelectedGift(null); }}
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: activeCategory === key
                    ? key === 'basic' ? 'rgba(92,225,230,0.2)' : key === 'premium' ? 'rgba(168,85,247,0.2)' : 'rgba(255,107,53,0.2)'
                    : 'rgba(255,255,255,0.04)',
                  borderWidth: activeCategory === key ? 1 : 0,
                  borderColor: key === 'basic' ? 'rgba(92,225,230,0.4)' : key === 'premium' ? 'rgba(168,85,247,0.4)' : 'rgba(255,107,53,0.4)',
                }}
              >
                <Text style={{ color: activeCategory === key ? '#fff' : 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Hediye grid — sabit yükseklik, scroll edilebilir */}
          <View style={{ maxHeight: 140 }}>
            <FlatList
              data={filteredGifts}
              keyExtractor={(item) => item.id}
              renderItem={renderGiftItem}
              numColumns={4}
              columnWrapperStyle={styles.giftRow}
              contentContainerStyle={styles.giftGrid}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            />
          </View>

          {/* ═══ ALT EYLEM ALANI (Adet + Gönder) ═══ */}
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginTop: 8, paddingTop: 10 }}>
            {/* Adet Seçici */}
            <View style={styles.quantityRow}>
              {[1, 5, 10, 99].map(num => (
                <Pressable
                  key={num}
                  style={[styles.qtyBtn, quantity === num && styles.qtyBtnActive]}
                  onPress={() => setQuantity(num)}
                >
                  <Text style={[styles.qtyText, quantity === num && styles.qtyTextActive]}>{num}x</Text>
                </Pressable>
              ))}
            </View>

            {/* Gönder butonu */}
            <Pressable
              onPress={handleSend}
              disabled={!selectedGift || sending}
            >
              <LinearGradient
                colors={selectedGift ? (Gradients.teal as [string, string]) : ['#333', '#444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.sendBtn, (!selectedGift || sending) && { opacity: 0.5 }]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="gift" size={20} color="#fff" />
                    <Text style={styles.sendBtnText}>
                      {selectedGift
                        ? `${quantity}x ${gifts.find(g => g.id === selectedGift)?.name} (${gifts.find(g => g.id === selectedGift)!.price * quantity} SC)`
                        : 'Hediye Seçin'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  panelContainer: {
    backgroundColor: Colors.bg2 || '#111318',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    height: '62%',
  },
  panelHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.text3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  coinBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,191,36,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  coinIcon: { fontSize: 14 },
  coinText: { fontSize: 13, fontWeight: '700', color: Colors.gold },
  
  giftGrid: { paddingBottom: 16 },
  giftRow: { gap: 10, marginBottom: 10 },
  giftItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: Radius.default,
    backgroundColor: Colors.bg3 || '#1a1d24',
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  giftItemSelected: {
    borderColor: Colors.teal,
    backgroundColor: 'rgba(20,184,166,0.08)',
  },
  giftItemDisabled: { opacity: 0.4 },
  giftEmoji: { fontSize: 28, marginBottom: 4 },
  giftName: { fontSize: 10, fontWeight: '600', color: Colors.text2, marginBottom: 2 },
  giftNameSelected: { color: Colors.teal },
  giftPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  giftPrice: { fontSize: 10, fontWeight: '700', color: Colors.gold },
  premiumBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(251,191,36,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.default,
    marginTop: 4,
  },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  giftAnimation: {
    position: 'absolute',
    top: -120,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  giftAnimEmoji: {
    fontSize: 80,
    textShadowColor: 'rgba(20,184,166,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  selectorSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text3,
    marginBottom: 8,
  },
  targetList: {
    gap: 12,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  targetAvatarBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetAvatarSelected: {
    borderColor: Colors.teal,
    backgroundColor: 'rgba(20,184,166,0.15)',
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  qtyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  qtyBtnActive: {
    backgroundColor: 'rgba(236,72,153,0.15)',
    borderColor: '#EC4899',
  },
  qtyText: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
    fontSize: 13,
  },
  qtyTextActive: {
    color: '#EC4899',
  },
});
