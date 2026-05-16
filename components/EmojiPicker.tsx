/**
 * SopranoChat — Emoji Picker (DM Sohbet İçi)
 * ★ WhatsApp tarzı kompakt inline klavye boyutu
 */
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Image } from 'react-native';
import { i18n } from '../services/i18n';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '../constants/theme';
// ★ v277 (14 May 2026): Custom emoji desteği — kullanıcının active_emoji_id seti
//   "Özel" sekmesinde image'larla listelenir. Seçince :shortcode: input'a düşer.
import { useEmojiConfig } from '../services/cosmeticEditorConfigs';

const { height: H } = Dimensions.get('window');

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
  /** ★ v277: Kullanıcının active_emoji_id'si — varsa "Özel" sekmesi otomatik açılır */
  customEmojiSetId?: string | null;
};

export function EmojiPicker({ visible, onClose, onEmojiSelect, customEmojiSetId }: Props) {
  const [activeCategory, setActiveCategory] = useState(0);
  const customCfg = useEmojiConfig(customEmojiSetId);
  const hasCustom = !!(customCfg && customCfg.emojis && customCfg.emojis.length > 0);

  if (!visible) return null;

  // ★ v277: Custom emoji sekmesi varsa indeks = native kategori sayısı (sona)
  const customIndex = hasCustom ? EMOJI_CATEGORIES.length : -1;
  const isCustomActive = activeCategory === customIndex;

  return (
    <View style={styles.container}>
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
        {/* Kapat butonu — sağ uçta */}
        <TouchableOpacity style={styles.closeTab} onPress={onClose}>
          <Ionicons name="close" size={16} color={Colors.text3} />
        </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bg2,
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
    maxHeight: 240,
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
  closeTab: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
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
});
