/**
 * SopranoChat — Emoji Picker (DM Sohbet İçi)
 * ★ WhatsApp tarzı kompakt inline klavye boyutu
 */
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '../constants/theme';

const { height: H } = Dimensions.get('window');

const EMOJI_CATEGORIES = [
  {
    name: 'Sık Kullanılan',
    icon: 'time-outline' as const,
    emojis: ['😀', '😂', '❤️', '🔥', '👍', '😍', '🥺', '😎', '🤣', '💪', '🎉', '😊', '🥰', '😘', '💕', '✨', '🙏', '😭'],
  },
  {
    name: 'Yüzler',
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
};

export function EmojiPicker({ visible, onClose, onEmojiSelect }: Props) {
  const [activeCategory, setActiveCategory] = useState(0);

  if (!visible) return null;

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
        {/* Kapat butonu — sağ uçta */}
        <TouchableOpacity style={styles.closeTab} onPress={onClose}>
          <Ionicons name="close" size={16} color={Colors.text3} />
        </TouchableOpacity>
      </View>

      {/* Emoji grid — kompakt */}
      <ScrollView style={styles.emojiScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.emojiGrid}>
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
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
