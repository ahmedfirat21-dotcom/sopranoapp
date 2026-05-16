/**
 * SopranoChat — Emoji & GIF Reactions (Premium)
 * Kategorili emoji picker + Tenor GIF entegrasyonu
 * ref.current.spawn(emoji) ile floating emoji tetiklenir.
 */
import React, { useState, useCallback, useImperativeHandle, forwardRef, useEffect, useRef } from 'react';
import { i18n } from '../services/i18n';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions, useWindowDimensions,
  ScrollView, TextInput, Image, FlatList, Alert,
} from 'react-native';
import AppLoader from './AppLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase, SUPABASE_ANON_KEY } from '../constants/supabase';

// ★ Module-level snapshot — picker/emoji keyboard için statik değerler yeterli.
// FloatingReactionsView içinde useWindowDimensions + useSafeAreaInsets ile runtime alınır.
const { height: H, width: W } = Dimensions.get('window');

// ═══════════════════════════════════════════════════
// EMOJİ KATEGORİLERİ
// ═══════════════════════════════════════════════════
const EMOJI_CATEGORIES = [
  {
    id: 'popular', icon: '⭐', label: i18n.t('emojireactions.001'),
    emojis: ['❤️','🔥','👏','😂','🎉','💎','👍','🥰','😍','🤩','💯','🙌','✨','💪','🎶','💕','🫶','😎','🤗','🥳'],
  },
  {
    id: 'faces', icon: '😊', label: i18n.t('emojireactions.002'),
    emojis: ['😊','😄','😁','🤣','😅','😆','😉','😋','😘','😗','🤑','🤭','🤫','🤔','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','🤪','😝','🤤','😒','😓','😔','😕','🙃','😲','🤯','😳','🥺','😢','😭','😤','😠','🤬','🤡','💀','☠️','👻','👽','🤖'],
  },
  {
    id: 'love', icon: '💖', label: i18n.t('emojireactions.003'),
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
    id: 'nature', icon: '🌿', label: i18n.t('emojireactions.004'),
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

// ★ Y18 FIX: Tenor API artık edge function proxy üzerinden çağrılır.
// Key client'ta expose değil; NSFW filter + rate limit sunucuda uygulanır.
// Edge function deploy edilmediyse legacy direct fetch fallback çalışır.
const _TENOR_LEGACY_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';
const _TENOR_BASE = 'https://tenor.googleapis.com/v2';
let _tenorProxyAvailable: boolean | null = null;

// ★ D2: In-memory GIF cache — TTL 10 dakika. Her picker açılışında 30 GIF re-fetch
// etmek yerine cache'i kullan; memory pressure azalır, ağ trafiği düşer.
const _GIF_CACHE_TTL_MS = 10 * 60_000;
const _gifCache = new Map<string, { at: number; results: any[] }>();
function _cacheKey(params: { type: string; q?: string; limit?: number }) {
  return `${params.type}|${params.q || ''}|${params.limit || 30}`;
}

async function _callTenorProxy(params: { type: 'featured' | 'search'; q?: string; limit?: number }): Promise<any[]> {
  const key = _cacheKey(params);
  const hit = _gifCache.get(key);
  if (hit && Date.now() - hit.at < _GIF_CACHE_TTL_MS) {
    return hit.results;
  }

  // ★ v86 FIX: supabase.functions.invoke Firebase JWT eklediği için Gateway 401 dönebiliyordu.
  //   Direkt fetch + Anon Key — sade, güvenilir. Edge Function --no-verify-jwt deploy edildi,
  //   anon key her zaman kabul eder.
  try {
    const SUPABASE_URL_LOCAL = 'https://kpofiuczyjesjlqjxswh.supabase.co';
    const res = await fetch(`${SUPABASE_URL_LOCAL}/functions/v1/tenor-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.results && data.results.length > 0) {
        _gifCache.set(key, { at: Date.now(), results: data.results });
        return data.results;
      }
    }
    if (__DEV__) console.warn('[GIF] proxy non-200 or empty:', res.status);
  } catch (e: any) {
    if (__DEV__) console.warn('[GIF] proxy fetch error:', e?.message);
  }

  // Legacy fallback — Tenor public API direkt
  try {
    const limit = params.limit || 30;
    const url = params.type === 'featured'
      ? `${_TENOR_BASE}/featured?key=${_TENOR_LEGACY_KEY}&limit=${limit}&media_filter=tinygif&contentfilter=high`
      : `${_TENOR_BASE}/search?key=${_TENOR_LEGACY_KEY}&q=${encodeURIComponent(params.q || '')}&limit=${limit}&media_filter=tinygif&contentfilter=high`;
    const res = await fetch(url);
    const data = await res.json();
    const results = data?.results || [];
    if (results.length > 0) {
      _gifCache.set(key, { at: Date.now(), results });
    }
    return results;
  } catch (e: any) {
    if (__DEV__) console.warn('[GIF] legacy fallback error:', e?.message);
    return [];
  }
}

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

  // ★ v86: GIF özelliği geçici kaldırıldı — fetch hiç tetiklenmesin (gereksiz network).
  //   useEffect(() => { fetchTrendingGifs(); }, []);

  const fetchTrendingGifs = async () => {
    try {
      setLoadingGifs(true);
      const results = await _callTenorProxy({ type: 'featured', limit: 30 });
      setTrendingGifs(results);
      // ★ v86 debug: kullanıcının cihazında neden boş geldiğini görmek için
      if (results.length === 0) {
        Alert.alert(
          'GIF Yüklenemedi (Debug)',
          'Tenor API boş döndü. Olası sebepler:\n• İnternet/firewall blok\n• Edge Function 401\n• Tenor erişim engelli\n\nLütfen bu mesajı geliştiriciye iletin.',
          [{ text: 'Tamam' }],
        );
      }
    } catch (e: any) {
      Alert.alert('GIF Hatası (Debug)', (e?.message || String(e) || 'Bilinmeyen').slice(0, 300), [{ text: 'Tamam' }]);
    } finally {
      setLoadingGifs(false);
    }
  };

  const searchGifs = async (q: string) => {
    if (q.length < 2) { setGifs([]); return; }
    try {
      setLoadingGifs(true);
      const results = await _callTenorProxy({ type: 'search', q, limit: 30 });
      setGifs(results);
    } catch { } finally { setLoadingGifs(false); }
  };

  const handleGifSearch = (text: string) => {
    setGifSearch(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => searchGifs(text), 400);
  };

  const currentCategory = EMOJI_CATEGORIES.find(c => c.id === selectedCategory) || EMOJI_CATEGORIES[0];
  const displayGifs = gifSearch.length >= 2 ? gifs : trendingGifs;

  // ★ v86: GIF özelliği geçici olarak kaldırıldı (post-launch'ta temiz yeniden eklenecek).
  //   Tab header gizlendi, sadece emoji picker görünür. GIF state/fetch'leri kullanılmıyor ama
  //   kod içinde duruyor — sonradan reaktive etmek kolay olsun.
  const SHOW_GIF_TAB = false;

  return (
    <View style={sty.picker}>
      {/* Tab Header — sadece GIF tab aktifse göster */}
      {SHOW_GIF_TAB && (
        <View style={sty.tabHeader}>
          <TouchableOpacity style={sty.tabBtn} onPress={() => setTab('emoji')}>
            <Text style={[sty.tabText, tab === 'emoji' && sty.tabTextActive]}>😊 Emoji</Text>
          </TouchableOpacity>
          <TouchableOpacity style={sty.tabBtn} onPress={() => setTab('gif')}>
            <Text style={[sty.tabText, tab === 'gif' && sty.tabTextActive]}>🎬 GIF</Text>
          </TouchableOpacity>
        </View>
      )}

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
            <AppLoader color="#5CE1E6" style={{ marginTop: 20 }} />
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4 }} showsVerticalScrollIndicator={false}>
              {displayGifs.map((item: any, idx: number) => {
                // ★ v86 FIX: Tenor API v2 — `item.url` SHARE link (HTML page redirect), Image yüklemiyor.
                //   Gerçek media URL `media_formats.tinygif/gif.url`'de. Proxy zaten doğru format döndürüyor;
                //   legacy fallback için media_formats öncelikli, item.url sadece son çare.
                const gifUrl = item.media_formats?.tinygif?.url
                  || item.media_formats?.gif?.url
                  || item.media?.[0]?.tinygif?.url
                  || item.media?.[0]?.gif?.url
                  || item.url;
                if (!gifUrl) return null;
                return (
                  <TouchableOpacity key={item.id || idx} activeOpacity={0.7} onPress={() => onReaction(`[gif:${gifUrl}]`)} style={sty.gifItem}>
                    <Image
                      source={{ uri: gifUrl }}
                      style={sty.gifImage}
                      resizeMode="cover"
                      onError={(e) => { if (__DEV__) console.warn('[GIF] load failed:', gifUrl, e.nativeEvent?.error); }}
                    />
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
  // ★ 2026-04-22: Runtime boyut + safe-area — gesture nav bar varken bottom: 100
  //   yetmiyor, control bar üstüne floating emoji'ler control bar'ın ÜSTÜNE uçsun.
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const floatingBottom = Math.max(insets.bottom, 14) + 80; // ~RoomControlBar yüksekliği
  const floatingHeight = winH * 0.45;
  // ★ D1: Unmount sırasında dangling animasyon setState yakalanmasın.
  const mountedRef = useRef(true);
  const activeAnimsRef = useRef<Animated.CompositeAnimation[]>([]);
  // ★ 2026-04-19: Spawn rate limit — sliding window max 8 burst/1sn. Spam veya
  // hızlı tıklamada gereksiz Animated.Value oluşturulmasını önler.
  const spawnTimesRef = useRef<number[]>([]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeAnimsRef.current.forEach(a => { try { a.stop(); } catch {} });
      activeAnimsRef.current = [];
    };
  }, []);

  const spawn = useCallback((emoji: string) => {
    if (!mountedRef.current) return;
    if (emoji.startsWith('[gif:')) return;
    const now = Date.now();
    spawnTimesRef.current = spawnTimesRef.current.filter(t => now - t < 1000);
    if (spawnTimesRef.current.length >= 8) return;
    spawnTimesRef.current.push(now);
    const id = ++emojiCounter;
    const anim = new Animated.Value(0);
    const startX = winW * 0.3 + Math.random() * winW * 0.4;
    const drift = -30 + Math.random() * 60;

    setEmojis(prev => [...prev.slice(-8), { id, emoji, startX, anim, drift }]);

    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: 2200 + Math.random() * 800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    activeAnimsRef.current.push(animation);
    animation.start(() => {
      activeAnimsRef.current = activeAnimsRef.current.filter(a => a !== animation);
      if (mountedRef.current) {
        setEmojis(prev => prev.filter(e => e.id !== id));
      }
    });
  }, []);

  useImperativeHandle(ref, () => ({ spawn }), [spawn]);

  return (
    <View style={[sty.floatingContainer, { bottom: floatingBottom, height: floatingHeight }]} pointerEvents="none">
      {emojis.map(e => (
        <Animated.Text
          key={e.id}
          style={[
            sty.floatingEmoji,
            {
              left: e.startX,
              opacity: e.anim.interpolate({ inputRange: [0, 0.08, 0.65, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateY: e.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -floatingHeight] }) },
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
const GIF_ITEM_SIZE = (W - 20) / 3;

const sty = StyleSheet.create({
  picker: {
    backgroundColor: 'transparent',
    width: '100%',
    overflow: 'hidden',
  },
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 14,
  },
  tabBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  tabText: {
    fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.45)',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
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
    width: (W - 28) / 9, height: 40,
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
    // ★ 2026-04-22: bottom & height artık inline (FloatingReactionsView içinde hesaplanıyor).
    position: 'absolute', left: 0, right: 0,
    zIndex: 999, elevation: 999,
  },
  floatingEmoji: { position: 'absolute', bottom: 0, fontSize: 28 },
});
