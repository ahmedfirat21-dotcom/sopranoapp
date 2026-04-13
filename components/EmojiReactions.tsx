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
    emojis: ['😊','😄','😁','🤣','😅','😆','😉','😋','😘','😗','🤑','🤭','🤫','🤔','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','🤪','😝','🤤','😒','😓','😔','😕','🙃','😲','🤯','😳','🥺','😢','😭','😤','😠','🤬','🤡','💀','☠️','👻','👽','🤖'],
  },
  {
    id: 'love', icon: '💖', label: 'Aşk',
    emojis: ['💖','💗','💓','💞','💘','💝','💟','❣️','💋','👫','💑','💏','🌹','🌸','🌺','🌷','💐','🥀','💍','💎','🧸','🍫','🍷','🥂'],
  },
  {
    id: 'hands', icon: '🤝', label: 'El',
    emojis: ['👍','👎','👊','✊','🤛','🤜','🤝','👐','🙌','👋','🤚','✋','🖖','🫰','✌️','🤞','🫶','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✍️','🙏','💅','🤳'],
  },
  {
    id: 'celebrate', icon: '🎊', label: 'Kutlama',
    emojis: ['🎉','🎊','🥳','🎁','🎈','🎄','🎃','🏆','🥇','🥈','🥉','🏅','🎀','🎆','🎇','✨','🌟','⭐','💫','🎵','🎶','🎤','🎧','🎸','🎹','🎺','🎻','🥁','🎯','🎮','🕹️','🎲'],
  },
  {
    id: 'food', icon: '🍕', label: 'Yemek',
    emojis: ['🍕','🍔','🍟','🌭','🍿','🥐','🍩','🍪','🎂','🍰','🧁','🍫','🍬','🍭','🍮','🍯','☕','🍵','🧋','🥤','🧃','🍷','🍸','🍹','🍺','🥂','🍾','🍉','🍇','🍓','🍊','🍋','🍌','🍑','🍒','🥑','🌶️','🌽'],
  },
  {
    id: 'nature', icon: '🌿', label: 'Doğa',
    emojis: ['🌈','☀️','🌤️','⛅','🌧️','❄️','🔥','💧','🌊','🌱','🌲','🌳','🌴','🌵','🌿','☘️','🍀','🍁','🍂','🍃','🌺','🌻','🌼','🌷','🌹','💐','🐶','🐱','🐭','🐰','🦊','🐻','🐼','🦁','🐯','🐸','🦋','🐝','🌙','⭐','💫'],
  },
  {
    id: 'objects', icon: '💡', label: 'Nesne',
    emojis: ['💡','🔮','🧿','🎭','🎨','📸','📱','💻','⌚','📺','🎬','🎙️','🎧','🎮','🕹️','🧩','🪄','💣','🔑','💰','💸','💵','🚀','🛸','✈️','⛵','🏎️','🏍️','🚲'],
  },
  {
    id: 'flags', icon: '🏳️', label: 'Bayrak',
    emojis: ['🏳️','🏴','🏁','🚩','🇹🇷','🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇮🇹','🇪🇸','🇯🇵','🇰🇷','🇨🇳','🇧🇷','🇷🇺','🇮🇳','🇦🇪','🇸🇦','🇪🇬','🇦🇿','🇳🇱','🇧🇪','🇸🇪','🇵🇱','🇺🇦','🇨🇦','🇦🇺'],
  },
];

// Tenor API
const TENOR_API_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';
const TENOR_BASE = 'https://tenor.googleapis.com/v2';

// ═══════════════════════════════════════════════════
// EMOJİ + GIF PICKER
// ═══════════════════════════════════════════════════
export function EmojiReactionBar({ onReaction, onClose }: { onReaction: (emoji: string) => void; onClose?: () => void }) {
  const [tab, setTab] = useState<'emoji' | 'gif'>('emoji');
  const [selectedCategory, setSelectedCategory] = useState('popular');
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [trendingGifs, setTrendingGifs] = useState<any[]>([]);
  const searchTimerRef = useRef<any>(null);

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
    <View style={sty.picker}>
      {/* Tab Header */}
      <View style={sty.tabHeader}>
        <TouchableOpacity style={[sty.tabBtn, tab === 'emoji' && sty.tabActive]} onPress={() => setTab('emoji')}>
          <Text style={[sty.tabText, tab === 'emoji' && sty.tabTextActive]}>😊 Emoji</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[sty.tabBtn, tab === 'gif' && sty.tabActive]} onPress={() => setTab('gif')}>
          <Text style={[sty.tabText, tab === 'gif' && sty.tabTextActive]}>GIF</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity style={{ marginLeft: 'auto', padding: 4 }} onPress={onClose}>
            <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
      </View>

      {/* ════ Emoji Tab ════ */}
      {tab === 'emoji' && (
        <>
          {/* Kategori scrollbar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 36, flexGrow: 0 }} contentContainerStyle={{ gap: 3, paddingHorizontal: 6, alignItems: 'center' }}>
            {EMOJI_CATEGORIES.map(cat => (
              <TouchableOpacity key={cat.id} style={[sty.catBtn, selectedCategory === cat.id && sty.catBtnActive]} onPress={() => setSelectedCategory(cat.id)}>
                <Text style={{ fontSize: 15 }}>{cat.icon}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Emoji grid */}
          <ScrollView style={{ height: 190 }} contentContainerStyle={sty.emojiGrid} showsVerticalScrollIndicator={false}>
            {currentCategory.emojis.map((emoji, i) => (
              <TouchableOpacity key={`${emoji}_${i}`} activeOpacity={0.5} onPress={() => onReaction(emoji)} style={sty.emojiBtn}>
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* ════ GIF Tab ════ */}
      {tab === 'gif' && (
        <>
          {/* Arama */}
          <View style={sty.gifSearchWrap}>
            <Ionicons name="search" size={14} color="rgba(255,255,255,0.35)" />
            <TextInput style={sty.gifInput} placeholder="GIF ara..." placeholderTextColor="rgba(255,255,255,0.25)" value={gifSearch} onChangeText={handleGifSearch} />
          </View>
          {/* GIF Grid */}
          {loadingGifs ? (
            <ActivityIndicator color="#5CE1E6" style={{ marginTop: 20 }} />
          ) : (
            <ScrollView style={{ height: 180 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4 }} showsVerticalScrollIndicator={false}>
              {displayGifs.map((item: any, idx: number) => {
                const gifUrl = item.media_formats?.tinygif?.url || item.media?.[0]?.tinygif?.url;
                if (!gifUrl) return null;
                return (
                  <TouchableOpacity key={item.id || idx} activeOpacity={0.7} onPress={() => onReaction(`[gif:${gifUrl}]`)} style={sty.gifItem}>
                    <Image source={{ uri: gifUrl }} style={sty.gifImage} resizeMode="cover" />
                  </TouchableOpacity>
                );
              })}
              {displayGifs.length === 0 && (
                <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', width: '100%', marginTop: 20 }}>
                  {gifSearch.length >= 2 ? 'Sonuç bulunamadı' : 'Popüler GIFler yükleniyor...'}
                </Text>
              )}
            </ScrollView>
          )}
          <Text style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.12)', paddingBottom: 4 }}>Powered by Tenor</Text>
        </>
      )}
    </View>
  );
}

// ─── Floating Emojis ───
export interface FloatingReactionsRef {
  spawn: (emoji: string) => void;
}

export const FloatingReactionsView = forwardRef<FloatingReactionsRef, {}>((_props, ref) => {
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);

  const spawn = useCallback((emoji: string) => {
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
    <View style={sty.floatingContainer} pointerEvents="none">
      {emojis.map(e => (
        <Animated.Text
          key={e.id}
          style={[
            sty.floatingEmoji,
            {
              left: e.startX,
              opacity: e.anim.interpolate({ inputRange: [0, 0.08, 0.65, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateY: e.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -H * 0.45] }) },
                { translateX: e.anim.interpolate({ inputRange: [0, 1], outputRange: [0, e.drift] }) },
                { scale: e.anim.interpolate({ inputRange: [0, 0.15, 0.4, 1], outputRange: [0.4, 1.2, 1, 0.5] }) },
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

interface FloatingEmoji { id: number; emoji: string; startX: number; anim: Animated.Value; drift: number; }
let emojiCounter = 0;

// ═══════════════════════════════════════════════════
// STYLES — Koyu transparan cam efekti (lacivert değil)
// ═══════════════════════════════════════════════════
const GIF_ITEM_SIZE = (W - 48) / 3;

const sty = StyleSheet.create({
  picker: {
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    width: W - 24,
    overflow: 'hidden',
  },
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabActive: {
    backgroundColor: 'rgba(92,225,230,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(92,225,230,0.3)',
  },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.35)' },
  tabTextActive: { color: '#5CE1E6' },
  // Kategori
  catBtn: {
    width: 34, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  catBtnActive: {
    backgroundColor: 'rgba(92,225,230,0.15)',
    borderWidth: 1, borderColor: 'rgba(92,225,230,0.25)',
  },
  // Emoji grid
  emojiGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 6, gap: 2,
  },
  emojiBtn: {
    width: (W - 48) / 8, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8,
  },
  // GIF
  gifSearchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 10,
    marginHorizontal: 8, marginVertical: 6, gap: 6,
  },
  gifInput: { flex: 1, paddingVertical: 8, fontSize: 13, color: '#F1F5F9' },
  gifItem: {
    width: GIF_ITEM_SIZE, height: GIF_ITEM_SIZE,
    borderRadius: 8, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  gifImage: { width: '100%', height: '100%' },
  // Floating
  floatingContainer: {
    position: 'absolute', bottom: 100, left: 0, right: 0,
    height: H * 0.45, zIndex: 999, elevation: 999,
  },
  floatingEmoji: { position: 'absolute', bottom: 0, fontSize: 28 },
});
