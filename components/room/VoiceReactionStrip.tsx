/**
 * SopranoChat — Voice Reaction Strip (Faz 3.2)
 * ═══════════════════════════════════════════════════
 * Oda utility row'una eklenen 8-butonlu reaksiyon şeridi.
 * Tek dokunuşla LiveKit data channel'a broadcast.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { VOICE_REACTIONS, VoiceReactionService } from '../../services/voiceReactions';
import { Shadows } from '../../constants/theme';

interface Props {
  senderId: string;
  senderName?: string;
  /** Strip kompakt mu (utility row inline) yoksa expanded sheet mi. */
  compact?: boolean;
  onSent?: (reactionId: string) => void;
}

export default function VoiceReactionStrip({ senderId, senderName, compact, onSent }: Props) {
  const handlePress = (reactionId: string) => {
    const ok = VoiceReactionService.send(reactionId, senderId, senderName);
    if (ok) {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      onSent?.(reactionId);
    }
  };

  const Container: any = compact ? ScrollView : View;
  const containerProps = compact
    ? { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: s.compactRow }
    : { style: s.gridRow };

  return (
    <Container {...containerProps}>
      {VOICE_REACTIONS.map(r => (
        <Pressable
          key={r.id}
          onPress={() => handlePress(r.id)}
          style={({ pressed }) => [
            compact ? s.compactBtn : s.gridBtn,
            { borderColor: `${r.color}44`, backgroundColor: `${r.color}1A` },
            pressed && { transform: [{ scale: 0.88 }] },
          ]}
          hitSlop={4}
          accessibilityLabel={r.label}
        >
          <Text style={compact ? s.compactEmoji : s.gridEmoji}>{r.emoji}</Text>
          {!compact && <Text style={s.gridLabel} numberOfLines={1}>{r.label}</Text>}
        </Pressable>
      ))}
    </Container>
  );
}

const s = StyleSheet.create({
  // ★ 2026-04-26: Premium görünüm — daha büyük buton, gölge, geniş emoji.
  compactRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 8,
    alignItems: 'center',
  },
  compactBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  compactEmoji: { fontSize: 22, ...Shadows.text },
  gridRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  gridBtn: {
    width: 76, height: 76, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1,
  },
  gridEmoji: { fontSize: 30, ...Shadows.text },
  gridLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(241,245,249,0.85)', letterSpacing: 0.2 },
});
