/**
 * SopranoChat — Emoji & GIF Picker (DM Sohbet İçi)
 * ★ v1.7.13.141: GIF sekmesi eklendi — Tenor API (callTenorProxy) ile arama + trending
 * ★ WhatsApp tarzı kompakt inline klavye boyutu
 */
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Image, TextInput, FlatList } from 'react-native';
import { i18n } from '../services/i18n';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '../constants/theme';
import AppLoader from './AppLoader';
// ★ v277 (14 May 2026): Custom emoji desteği — kullanıcının active_emoji_id seti
//   "Özel" sekmesinde image'larla listelenir. Seçince :shortcode: input'a düşer.
import { useEmojiConfig } from '../services/cosmeticEditorConfigs';
// ★ v1.7.13.141: Tenor GIF API — EmojiReactions'daki proxy reuse
import { callTenorProxy } from './EmojiReactions';

const { height: H, width: W } = Dimensions.get('window');
const GIF_ITEM_SIZE = (W - 24) / 3;

const EMOJI_CATEGORIES = [
  {
    name: i18n.t('emojipicker.001'),
    icon: 'time-outline' as const,
    emojis: ['😀', '😂', '❤️', '🔥', '👍', '😍', '🥺', '😎', '🤣', '💪', '🎉', '😊', '🥰', '😘', '💕', '✨', '🙏', '😭'],
  },
  {
    name: i18n.t('emojipicker.002'),
    icon: 'happy-outline' as const,
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🫢', '🤫', '🤔', '🫡', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '😎', '🥸', '😱', '😨', '😰', '😢', '😭', '🥺'],
  },
  {
    name: 'El Hareketleri',
    icon: 'hand-left-outline' as const,
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '💪'],
  },
  {
    name: 'Kalpler',
    icon: 'heart-outline' as const,
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '🫀'],
  },
  {
    name: 'Hayvanlar',
    icon: 'paw-outline' as const,
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🦄', '🐝', '🦋', '🐌', '🐞'],
  },
  {
    name: 'Yiyecek',
    icon: 'fast-food-outline' as const,
    emojis: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🍕', '🍔', '🌭', '🍟', '🌮', '🍦', '🍩', '🍪', '🎂', '🍰', '☕', '🧃', '🥤', '🍷', '🍺'],
  },
  {
    name: 'Objeler',
    icon: 'diamond-outline' as const,
    emojis: ['⚽', '🏀', '🎮', '🎯', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎵', '🎶', '💎', '🔮', '🎁', '🏆', '🥇', '🥈', '🥉', '🎖️', '🏅', '⭐', '🌟', '💫', '✨', '🌈', '☀️', '🌙'],
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  /** ★ v1.7.13.141: GIF seçildiğinde URL ile callback */
  onGifSelect?: (gifUrl: string) => void;
  /** ★ v277: Kullanıcının active_emoji_id'si — varsa "Özel" sekmesi otomatik açılır */
  customEmojiSetId?: string | null;
};

export function EmojiPicker({ visible, onClose, onEmojiSelect, onGifSelect, customEmojiSetId }: Props) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [activeTab, setActiveTab] = useState<'emoji' | 'gif'>('emoji');
  const customCfg = useEmojiConfig(customEmojiSetId);
  const hasCustom = !!(customCfg && customCfg.emojis && customCfg.emojis.length > 0);

  // ★ v1.7.13.141: GIF state
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [trendingGifs, setTrendingGifs] = useState<any[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const searchTimerRef = useRef<any>(null);
  const trendingLoadedRef = useRef(false);

  // GIF sekmesine ilk geçişte trending yükle
  useEffect(() => {
    if (activeTab === 'gif' && !trendingLoadedRef.current && visible) {
      trendingLoadedRef.current = true;
      setLoadingGifs(true);
      callTenorProxy({ type: 'featured', limit: 30 })
        .then(setTrendingGifs)
        .catch(() => {})
        .finally(() => setLoadingGifs(false));
    }
  }, [activeTab, visible]);

  // Picker kapanınca GIF search sıfırla
  useEffect(() => {
    if (!visible) {
      setGifSearch('');
      setGifs([]);
      setActiveTab('emoji');
    }
  }, [visible]);

  const handleGifSearch = useCallback((text: string) => {
    setGifSearch(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (text.trim().length < 2) { setGifs([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setLoadingGifs(true);
      try {
        const results = await callTenorProxy({ type: 'search', q: text.trim(), limit: 30 });
        setGifs(results);
      } catch {} finally { setLoadingGifs(false); }
    }, 400);
  }, []);

  const handleGifSelect = useCallback((item: any) => {
    // Tenor API v2 — media_formats.tinygif > gif > url
    const gifUrl = item.media_formats?.tinygif?.url
      || item.media_formats?.gif?.url
      || item.media?.[0]?.tinygif?.url
      || item.media?.[0]?.gif?.url
      || item.url;
    if (gifUrl && onGifSelect) {
      onGifSelect(gifUrl);
      onClose();
    }
  }, [onGifSelect, onClose]);

  if (!visible) return null;

  // ★ v277: Custom emoji sekmesi varsa indeks = native kategori sayısı (sona)
  const customIndex = hasCustom ? EMOJI_CATEGORIES.length : -1;
  const isCustomActive = activeCategory === customIndex;

  const displayGifs = gifSearch.trim().length >= 2 ? gifs : trendingGifs;

  return (
    <View style={styles.container}>
      {/* ★ v1.7.13.141: Emoji / GIF tab switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabSwitchBtn, activeTab === 'emoji' && styles.tabSwitchActive]}
          onPress={() => setActiveTab('emoji')}
        >
          <Ionicons name="happy-outline" size={15} color={activeTab === 'emoji' ? Colors.teal : Colors.text3} />
          <Text style={[styles.tabSwitchText, activeTab === 'emoji' && styles.tabSwitchTextActive]}>Emoji</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabSwitchBtn, activeTab === 'gif' && styles.tabSwitchActive]}
          onPress={() => setActiveTab('gif')}
        >
          <Text style={[styles.tabSwitchText, activeTab === 'gif' && styles.tabSwitchTextActive, { fontSize: 12, fontWeight: '800' }]}>GIF</Text>
        </TouchableOpacity>
        {/* Kapat butonu — sağ uçta */}
        <TouchableOpacity style={styles.closeTab} onPress={onClose}>
          <Ionicons name="close" size={16} color={Colors.text3} />
        </TouchableOpacity>
      </View>

      {/* ════ Emoji Tab ════ */}
      {activeTab === 'emoji' && (
        <>
          {/* Kategori tabs — kompakt */}
          <View style={styles.categoryBar}>
            {EMOJI_CATEGORIES.map((cat, i) => (
              <TouchableOpacity
                key={cat.name}
                style={[styles.categoryTab, activeCategory === i && styles.categoryTabActive]}
                onPress={() => setActiveCategory(i)}
              >
                <Ionicons name={cat.icon} size={16} color={activeCategory === i ? Colors.teal : Colors.text3} />
              </TouchableOpacity>
            ))}
            {/* ★ v277: Özel emoji sekmesi (sadece set varsa) */}
            {hasCustom && (
              <TouchableOpacity
                style={[styles.categoryTab, isCustomActive && styles.categoryTabActive]}
                onPress={() => setActiveCategory(customIndex)}
              >
                <Ionicons name="sparkles-outline" size={16} color={isCustomActive ? Colors.teal : Colors.text3} />
              </TouchableOpacity>
            )}
          </View>

          {/* Emoji grid — kompakt */}
          <ScrollView style={styles.emojiScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.emojiGrid}>
              {isCustomActive
                ? (customCfg?.emojis || []).map((e: any, i: number) => (
                    <TouchableOpacity
                      key={`${e.shortcode}_${i}`}
                      style={styles.emojiBtn}
                      onPress={() => onEmojiSelect(e.shortcode)}
                      activeOpacity={0.5}
                    >
                      {e.image_url ? (
                        <Image source={{ uri: e.image_url }} style={{ width: 28, height: 28 }} resizeMode="contain" />
                      ) : (
                        <Text style={styles.emojiText}>{e.fallback || '✦'}</Text>
                      )}
                    </TouchableOpacity>
                  ))
                : EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
                    <TouchableOpacity
                      key={`${emoji}_${i}`}
                      style={styles.emojiBtn}
                      onPress={() => onEmojiSelect(emoji)}
                      activeOpacity={0.5}
                    >
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
            </View>
          </ScrollView>
        </>
      )}

      {/* ════ GIF Tab ════ */}
      {activeTab === 'gif' && (
        <>
          {/* GIF Arama */}
          <View style={styles.gifSearchWrap}>
            <Ionicons name="search" size={14} color="rgba(255,255,255,0.35)" />
            <TextInput
              style={styles.gifInput}
              placeholder={i18n.t('chat.gif_search_placeholder')}
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={gifSearch}
              onChangeText={handleGifSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {gifSearch.length > 0 && (
              <TouchableOpacity onPress={() => { setGifSearch(''); setGifs([]); }} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
          </View>
          {/* GIF Grid */}
          {loadingGifs ? (
            <View style={{ alignItems: 'center', paddingVertical: 30 }}>
              <AppLoader size="small" color={Colors.teal} />
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 200 }}
              contentContainerStyle={styles.gifGrid}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {displayGifs.map((item: any, idx: number) => {
                const gifUrl = item.media_formats?.tinygif?.url
                  || item.media_formats?.gif?.url
                  || item.media?.[0]?.tinygif?.url
                  || item.media?.[0]?.gif?.url
                  || item.url;
                if (!gifUrl) return null;
                return (
                  <TouchableOpacity
                    key={item.id || idx}
                    activeOpacity={0.7}
                    onPress={() => handleGifSelect(item)}
                    style={styles.gifItem}
                  >
                    <Image
                      source={{ uri: gifUrl }}
                      style={styles.gifImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })}
              {displayGifs.length === 0 && !loadingGifs && (
                <Text style={styles.gifEmptyText}>
                  {gifSearch.trim().length >= 2 ? i18n.t('chat.gif_no_results') : i18n.t('chat.gif_trending_empty')}
                </Text>
              )}
            </ScrollView>
          )}
          <Text style={styles.tenorBranding}>Powered by Tenor</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bg2,
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
    maxHeight: 280,
  },
  // ★ v1.7.13.141: Emoji/GIF tab switcher
  tabSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    paddingHorizontal: 8,
    gap: 2,
  },
  tabSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tabSwitchActive: {
    backgroundColor: 'rgba(20,184,166,0.12)',
  },
  tabSwitchText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text3,
  },
  tabSwitchTextActive: {
    color: Colors.teal,
  },
  closeTab: {
    marginLeft: 'auto',
    width: 36,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    paddingHorizontal: 4,
  },
  categoryTab: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.teal,
  },
  emojiScroll: {
    paddingHorizontal: 4,
    maxHeight: 200,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emojiBtn: {
    width: `${100 / 8}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: { fontSize: 22 },
  // ★ v1.7.13.141: GIF styles
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
  gifInput: {
    flex: 1,
    paddingVertical: 7,
    fontSize: 13,
    color: '#F1F5F9',
  },
  gifGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 4,
  },
  gifItem: {
    width: GIF_ITEM_SIZE,
    height: GIF_ITEM_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  gifEmptyText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    textAlign: 'center',
    width: '100%',
    marginTop: 30,
  },
  tenorBranding: {
    textAlign: 'center',
    fontSize: 9,
    color: 'rgba(255,255,255,0.12)',
    paddingBottom: 4,
  },
});
