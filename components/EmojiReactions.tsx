/**
 * SopranoChat — Floating Emoji Reactions (Performant)
 * Kendi state'ini yönetir — üst bileşeni re-render etmez.
 * ref.current.spawn(emoji) ile tetiklenir.
 */
import React, { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions } from 'react-native';

const { height: H, width: W } = Dimensions.get('window');

const REACTIONS = [
  { emoji: '❤️', label: 'Kalp' },
  { emoji: '🔥', label: 'Ateş' },
  { emoji: '👏', label: 'Alkış' },
  { emoji: '😂', label: 'Güldü' },
  { emoji: '🎉', label: 'Kutlama' },
  { emoji: '💎', label: 'Elmas' },
];

interface FloatingEmoji {
  id: number;
  emoji: string;
  startX: number;
  anim: Animated.Value;
  drift: number;
}

let emojiCounter = 0;

// ─── Reaction Bar ───
export function EmojiReactionBar({ onReaction }: { onReaction: (emoji: string) => void }) {
  return (
    <View style={styles.barContainer}>
      {REACTIONS.map((r, i) => (
        <TouchableOpacity
          key={i}
          activeOpacity={0.6}
          onPress={() => onReaction(r.emoji)}
          style={styles.reactionButton}
        >
          <Text style={styles.reactionEmoji}>{r.emoji}</Text>
        </TouchableOpacity>
      ))}
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
    const id = ++emojiCounter;
    const anim = new Animated.Value(0);
    const startX = W * 0.3 + Math.random() * W * 0.4; // pixel-based (native driver uyumlu)
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

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(20,27,45,0.85)',
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(92,225,230,0.12)',
  },
  reactionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  reactionEmoji: {
    fontSize: 20,
  },
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
