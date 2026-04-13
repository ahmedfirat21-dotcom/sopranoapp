/**
 * SopranoChat — Emoji & GIF Reactions (Premium)
 * Kategorili emoji picker + Tenor GIF entegrasyonu
 * ref.current.spawn(emoji) ile floating emoji tetiklenir.
 */
import React, { useState, useCallback, useImperativeHandle, forwardRef, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions,
  ScrollView, TextInput, Image, FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: H, width: W } = Dimensions.get('window');

// ═══════════════════════════════════════════════════
// EMOJİ KATEGORİLERİ
// ═══════════════════════════════════════════════════
const EMOJI_CATEGORIES = [
  {
    id: 'popular', icon: '⭐', label: 'Popüler',
    emojis: ['❤️','🔥','👏','😂','🎉','💎','👍','🥰','😍','🤩','💯','🙌','✨','💪','🎶','💕','🫶','😎','🤗','🥳'],
  },
  {
    id: 'faces', icon: '😊', label: 'Yüzler',
    emojis: ['😊','😄','😁','🤣','😅','😆','😉','😋','😘','😗','🤑','🤭','🤫','🤔','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','🤪','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','🤯','😳','🥺','😢','😭','😤','😠','🤬','🤡','💀','☠️','👻','👽','🤖'],
  },
  {
    id: 'love', icon: '💖', label: 'Aşk',
    emojis: ['💖','💗','💓','💞','💘','💝','💟','❣️','💋','👫','👩‍❤️‍👨','💑','💏','🌹','🌸','🌺','🌷','💐','🥀','🫀','💍','💎','🧸','🍫','🍷','🥂'],
  },
  {
    id: 'hands', icon: '🤝', label: 'El',
    emojis: ['👍','👎','👊','✊','🤛','🤜','🤝','👐','🙌','👋','🤚','✋','🖖','🫱','🫲','🫳','🫴','🫰','✌️','🤞','🫶','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✍️','🙏','💅','🤳'],
  },
  {
    id: 'celebrate', icon: '🎊', label: 'Kutlama',
    emojis: ['🎉','🎊','🥳','🎁','🎈','🎄','🎃','🏆','🥇','🥈','🥉','🏅','🎖‍','🎗️','🎀','🎆','🎇','🧨','✨','🌟','⭐','💫','🎵','🎶','🎤','🎧','🎸','🎹','🎺','🎻','🥁','🎯','🎮','🕹️','🎲'],
  },
  {
    id: 'food', icon: '🍕', label: 'Yemek',
    emojis: ['🍕','🍔','🍟','🌭','🍿','🧂','🥐','🍩','🍪','🎂','🍰','🧁','🍫','🍬','🍭','🍮','🍯','☕','🍵','🧋','🥤','🧃','🍷','🍸','🍹','🍺','🥂','🍾','🧊','🍉','🍇','🍓','🫐','🍊','🍋','🍌','🍑','🍒','🥑','🌶️','🌽'],
  },
  {
    id: 'nature', icon: '🌿', label: 'Doğa',
    emojis: ['🌈','☀️','🌤️','⛅','🌦️','🌧️','⛈️','🌩️','❄️','❤️‍🔥','🔥','💧','🌊','🌱','🌲','🌳','🌴','🌵','🌾','🌿','☘️','🍀','🍁','🍂','🍃','🌺','🌻','🌼','🌷','🌹','🪷','💐','🐶','🐱','🐭','🐰','🦊','🐻','🐼','🦁','🐯','🐸','🦋','🐝','🐛','🌙','⭐','💫'],
  },
  {
    id: 'objects', icon: '💡', label: 'Nesne',
    emojis: ['💡','🔮','🧿','🪬','🎭','🎨','🖼️','📸','📱','💻','⌚','📺','🎬','🎙️','🎧','🎮','🕹️','🧩','♟️','🪄','🧲','💣','🔫','🪓','🛡️','🔑','🗝️','❤️‍🔥','💰','💸','💵','💊','🧬','🔬','🔭','📡','🚀','🛸','✈️','⛵','🏎️','🏍️','🚲','🛹'],
  },
  {
    id: 'flags', icon: '🏳️', label: 'Bayrak',
    emojis: ['🏳️','🏴','🏁','🚩','🇹🇷','🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇮🇹','🇪🇸','🇯🇵','🇰🇷','🇨🇳','🇧🇷','🇷🇺','🇮🇳','🇦🇪','🇸🇦','🇪🇬','🇦🇿','🇳🇱','🇧🇪','🇸🇪','🇵🇱','🇺🇦','🇨🇦','🇦🇺'],
  },
];

// Tenor API (ücretsiz) — GIF arama
const TENOR_API_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Google Tenor v2 API
const TENOR_BASE = 'https://tenor.googleapis.com/v2';

// ═══════════════════════════════════════════════════
// EMOJİ + GIF PICKER (TabView)
// ═══════════════════════════════════════════════════
export function EmojiReactionBar({ onReaction, onClose }: { onReaction: (emoji: string) => void; onClose?: () => void }) {
  const [tab, setTab] = useState<'emoji' | 'gif'>('emoji');
  const [selectedCategory, setSelectedCategory] = useState('popular');
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [trendingGifs, setTrendingGifs] = useState<any[]>([]);
  const searchTimerRef = useRef<any>(null);

  // Trending GIFs yükle
  useEffect(() => {
    fetchTrendingGifs();
  }, []);

  const fetchTrendingGifs = async () => {
    try {
      setLoadingGifs(true);
      const res = await fetch(`${TENOR_BASE}/featured?key=${TENOR_API_KEY}&limit=30&media_filter=tinygif`);
      const data = await res.json();
      setTrendingGifs(data.results || []);
    } catch { } finally { setLoadingGifs(false); }
  };

  const searchGifs = async (q: string) => {
    if (q.length < 2) { setGifs([]); return; }
    try {
      setLoadingGifs(true);
      const res = await fetch(`${TENOR_BASE}/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(q)}&limit=30&media_filter=tinygif`);
      const data = await res.json();
      setGifs(data.results || []);
    } catch { } finally { setLoadingGifs(false); }
  };

  const handleGifSearch = (text: string) => {
    setGifSearch(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => searchGifs(text), 400);
  };

  const currentCategory = EMOJI_CATEGORIES.find(c => c.id === selectedCategory) || EMOJI_CATEGORIES[0];
  const displayGifs = gifSearch.length >= 2 ? gifs : trendingGifs;

  return (
    <View style={styles.pickerContainer}>
      {/* Tab Header */}
      <View style={styles.tabHeader}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'emoji' && styles.tabBtnActive]} onPress={() => setTab('emoji')}>
          <Text style={[styles.tabBtnText, tab === 'emoji' && styles.tabBtnTextActive]}>😊 Emoji</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'gif' && styles.tabBtnActive]} onPress={() => setTab('gif')}>
          <Text style={[styles.tabBtnText, tab === 'gif' && styles.tabBtnTextActive]}>GIF</Text>
        </TouchableOpacity>
        {/* Kapat butonu */}
        {onClose && (
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Emoji Tab */}
      {tab === 'emoji' && (
        <View style={{ flex: 1 }}>
          {/* Kategori scrollbar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBar} contentContainerStyle={{ gap: 2, paddingHorizontal: 4 }}>
            {EMOJI_CATEGORIES.map(cat => (
              <TouchableOpacity key={cat.id} style={[styles.categoryBtn, selectedCategory === cat.id && styles.categoryBtnActive]} onPress={() => setSelectedCategory(cat.id)}>
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Emoji grid */}
          <ScrollView style={{ flex: 1, maxHeight: 180 }} contentContainerStyle={styles.emojiGrid} showsVerticalScrollIndicator={false}>
            {currentCategory.emojis.map((emoji, i) => (
              <TouchableOpacity key={`${emoji}_${i}`} activeOpacity={0.5} onPress={() => onReaction(emoji)} style={styles.emojiBtn}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* GIF Tab */}
      {tab === 'gif' && (
        <View style={{ flex: 1 }}>
          {/* Arama */}
          <View style={styles.gifSearchWrap}>
            <Ionicons name="search" size={14} color="rgba(255,255,255,0.35)" />
            <TextInput style={styles.gifSearchInput} placeholder="GIF ara..." placeholderTextColor="rgba(255,255,255,0.25)" value={gifSearch} onChangeText={handleGifSearch} />
          </View>
          {/* GIF Grid */}
          {loadingGifs ? (
            <ActivityIndicator color="#5CE1E6" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={displayGifs}
              numColumns={3}
              keyExtractor={(item, idx) => item.id || String(idx)}
              style={{ maxHeight: 180 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 4, padding: 4 }}
              columnWrapperStyle={{ gap: 4 }}
              renderItem={({ item }) => {
                const gifUrl = item.media_formats?.tinygif?.url || item.media?.[0]?.tinygif?.url;
                if (!gifUrl) return null;
                return (
                  <TouchableOpacity activeOpacity={0.7} onPress={() => onReaction(`[gif:${gifUrl}]`)} style={styles.gifItem}>
                    <Image source={{ uri: gifUrl }} style={styles.gifImage} resizeMode="cover" />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.gifEmpty}>{gifSearch.length >= 2 ? 'Sonuç bulunamadı' : 'Popüler GIFler yükleniyor...'}</Text>}
            />
          )}
          {/* Tenor attribution */}
          <View style={styles.tenorAttr}>
            <Text style={styles.tenorText}>Powered by Tenor</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Floating Emojis (bağımsız bileşen — üst bileşeni RE-RENDER ETMEZ) ───
export interface FloatingReactionsRef {
  spawn: (emoji: string) => void;
}

export const FloatingReactionsView = forwardRef<FloatingReactionsRef, {}>((_props, ref) => {
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);

  const spawn = useCallback((emoji: string) => {
    // GIF'ler floating olarak gösterilmez
    if (emoji.startsWith('[gif:')) return;
    const id = ++emojiCounter;
    const anim = new Animated.Value(0);
    const startX = W * 0.3 + Math.random() * W * 0.4;
    const drift = -30 + Math.random() * 60;

    setEmojis(prev => [...prev.slice(-12), { id, emoji, startX, anim, drift }]);

    Animated.timing(anim, {
      toValue: 1,
      duration: 2200 + Math.random() * 800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setEmojis(prev => prev.filter(e => e.id !== id));
    });
  }, []);

  useImperativeHandle(ref, () => ({ spawn }), [spawn]);

  return (
    <View style={styles.floatingContainer} pointerEvents="none">
      {emojis.map(e => (
        <Animated.Text
          key={e.id}
          style={[
            styles.floatingEmoji,
            {
              left: e.startX,
              opacity: e.anim.interpolate({
                inputRange: [0, 0.08, 0.65, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateY: e.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -H * 0.45],
                  }),
                },
                {
                  translateX: e.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, e.drift],
                  }),
                },
                {
                  scale: e.anim.interpolate({
                    inputRange: [0, 0.15, 0.4, 1],
                    outputRange: [0.4, 1.2, 1, 0.5],
                  }),
                },
              ],
            },
          ]}
        >
          {e.emoji}
        </Animated.Text>
      ))}
    </View>
  );
});

interface FloatingEmoji {
  id: number;
  emoji: string;
  startX: number;
  anim: Animated.Value;
  drift: number;
}

let emojiCounter = 0;

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════
const styles = StyleSheet.create({
  pickerContainer: {
    backgroundColor: 'rgba(15,20,35,0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(92,225,230,0.1)',
    width: W - 24,
    maxHeight: 310,
    overflow: 'hidden',
  },
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 4,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(92,225,230,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(92,225,230,0.25)',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  tabBtnTextActive: {
    color: '#5CE1E6',
  },
  closeBtn: {
    marginLeft: 'auto',
    padding: 4,
  },
  // Emoji
  categoryBar: {
    flexDirection: 'row',
    paddingVertical: 6,
    maxHeight: 40,
  },
  categoryBtn: {
    width: 32,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  categoryBtnActive: {
    backgroundColor: 'rgba(92,225,230,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(92,225,230,0.2)',
  },
  categoryIcon: {
    fontSize: 14,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 4,
    gap: 2,
  },
  emojiBtn: {
    width: (W - 48) / 8,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  emojiText: {
    fontSize: 22,
  },
  // GIF
  gifSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 10,
    marginHorizontal: 8,
    marginVertical: 6,
    gap: 6,
  },
  gifSearchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 13,
    color: '#F1F5F9',
  },
  gifItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  gifEmpty: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    marginTop: 20,
  },
  tenorAttr: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  tenorText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.15)',
    fontWeight: '600',
  },
  // Floating
  floatingContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    height: H * 0.45,
    zIndex: 999,
    elevation: 999,
  },
  floatingEmoji: {
    position: 'absolute',
    bottom: 0,
    fontSize: 28,
  },
});
