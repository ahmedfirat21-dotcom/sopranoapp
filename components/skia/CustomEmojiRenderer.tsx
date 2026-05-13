/**
 * CustomEmojiRenderer — Kullanıcı active_emoji_id'sinden custom emoji set'i çeker
 * ════════════════════════════════════════════════════════════════════
 * v117 — Web admin "Özel Emojiler" editöründen gelen emoji_config.emojis array'i
 * (id, shortcode, image_url, alt_text) listelenir. Shortcode → image mapping.
 *
 * Kullanım:
 *   <EmojiPickerGrid emojiSetId={user.active_emoji_id} onPick={(sc) => ...} />
 *   <InlineEmoji text="Selam :sopranolove: nasılsın?" emojiSetId={...} />
 *
 * Skia gerekmez — RN Image yeterli. Yine de animasyon için Reanimated kullanır.
 */
import React, { useMemo } from 'react';
import { View, Image, Pressable, ScrollView, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useEmojiConfig, type EmojiConfig } from '../../services/cosmeticEditorConfigs';

interface PickerProps {
  emojiSetId: string | null | undefined;
  onPick: (shortcode: string, imageUrl: string) => void;
  style?: ViewStyle;
}

/** Emoji picker grid — verilen set'i picker'da gösterir */
export function CustomEmojiPicker({ emojiSetId, onPick, style }: PickerProps) {
  const cfg = useEmojiConfig(emojiSetId);
  if (!cfg || cfg.emojis.length === 0) {
    return (
      <View style={[styles.empty, style]}>
        <Text style={styles.emptyText}>
          {emojiSetId ? 'Bu sette emoji yok' : 'Önce bir emoji seti seç'}
        </Text>
      </View>
    );
  }

  const size = cfg.display_size;
  const padding = cfg.padding;

  return (
    <View style={[styles.wrap, style]}>
      {/* Tab başlığı */}
      <View style={[styles.tabHeader, { borderBottomColor: cfg.set_color + '33' }]}>
        <Text style={[styles.tabBadge, { backgroundColor: cfg.set_color + '22', color: cfg.set_color, borderColor: cfg.set_color + '55' }]}>
          {cfg.set_icon} {cfg.set_short_name}
        </Text>
        <Text style={styles.tabCount}>{cfg.emojis.length} emoji</Text>
        {cfg.is_featured && cfg.badge_text && (
          <View style={[styles.featured, { backgroundColor: cfg.badge_color }]}>
            <Text style={styles.featuredText}>{cfg.badge_text}</Text>
          </View>
        )}
      </View>

      {/* Grid */}
      <ScrollView contentContainerStyle={[styles.grid, { padding: 12 }]}>
        {cfg.emojis.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => onPick(e.shortcode, e.image_url)}
            style={[styles.cell, { width: size + padding * 2, height: size + padding * 2, margin: 2 }]}
          >
            {e.image_url ? (
              <Image
                source={{ uri: e.image_url }}
                style={{ width: size, height: size, resizeMode: cfg.preserve_aspect ? 'contain' : 'cover' }}
                accessibilityLabel={e.alt_text}
              />
            ) : (
              <Text style={{ fontSize: size * 0.7, color: '#94A3B8' }}>?</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * InlineEmoji — Yazı içindeki :shortcode: kalıplarını custom emoji image'larıyla değiştirir.
 * Konuşma balonu/mesaj metin render'ında kullanılır.
 */
interface InlineProps {
  text: string;
  emojiSetId: string | null | undefined;
  inlineSize?: number;
  textStyle?: any;
}

export function InlineEmoji({ text, emojiSetId, inlineSize, textStyle }: InlineProps) {
  const cfg = useEmojiConfig(emojiSetId);

  // Shortcode → image lookup tablo
  const lookup = useMemo<Record<string, string>>(() => {
    if (!cfg) return {};
    const m: Record<string, string> = {};
    for (const e of cfg.emojis) {
      if (e.shortcode && e.image_url) m[e.shortcode] = e.image_url;
    }
    return m;
  }, [cfg]);

  // Eğer emoji set yoksa düz text
  if (!cfg || Object.keys(lookup).length === 0) {
    return <Text style={textStyle}>{text}</Text>;
  }

  // :xxx: pattern'ini bul, parçala
  const parts: Array<{ type: 'text' | 'emoji'; value: string }> = [];
  const re = /(:[a-z0-9_-]+:)/gi;
  let lastIdx = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push({ type: 'text', value: text.slice(lastIdx, match.index) });
    if (lookup[match[1]]) {
      parts.push({ type: 'emoji', value: match[1] });
    } else {
      parts.push({ type: 'text', value: match[1] });
    }
    lastIdx = match.index + match[1].length;
  }
  if (lastIdx < text.length) parts.push({ type: 'text', value: text.slice(lastIdx) });

  const size = inlineSize ?? cfg.inline_size;

  return (
    <Text style={textStyle}>
      {parts.map((p, i) => {
        if (p.type === 'text') return <Text key={i}>{p.value}</Text>;
        const url = lookup[p.value];
        return (
          <Image key={i} source={{ uri: url }}
            style={{ width: size, height: size, marginHorizontal: 2 }}
            accessibilityLabel={p.value}
          />
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(15,25,38,1)', borderRadius: 12 },
  tabHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1 },
  tabBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, fontSize: 11, fontWeight: '700', borderWidth: 1, overflow: 'hidden' },
  tabCount: { fontSize: 10, color: '#64748B', marginLeft: 8 },
  featured: { marginLeft: 'auto', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  featuredText: { fontSize: 9, fontWeight: '900', color: '#0F172A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  empty: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#64748B', fontSize: 12 },
});
