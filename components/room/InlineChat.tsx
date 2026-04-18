import React, { useRef, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing } from 'react-native';

interface ChatMsg {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles?: { display_name: string };
  isSystem?: boolean;
}

interface Props {
  messages: ChatMsg[];
  maxLines?: number;
}

// ★ Animated message wrapper — her yeni mesaj yumuşak fade+slide-up ile girer
function AnimatedMsg({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 350, delay,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0, duration: 350, delay,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {children}
    </Animated.View>
  );
}

export default function InlineChat({ messages, maxLines = 6 }: Props) {
  if (messages.length === 0) return null;
  // ★ UX-2 FIX: En yeni mesaj en altta, en parlak — eski mesajlar üstte, solgun
  const visible = messages.slice(0, maxLines);

  return (
    <View style={s.wrap} pointerEvents="none">
      {visible.map((msg, idx) => {
        // idx=0 en yeni, idx=last en eski → eski mesajlar daha soluk
        const opacity = 1 - (idx / (visible.length || 1)) * 0.7;

        if (msg.isSystem) {
          return (
            <AnimatedMsg key={msg.id} delay={idx === 0 ? 0 : 30}>
              <Text style={[s.sysLine, { opacity }]} numberOfLines={2}>
                {msg.content}
              </Text>
            </AnimatedMsg>
          );
        }

        // GIF mesajı kontrolü — ★ SEC: URL whitelist doğrulaması
        const gifMatch = msg.content.match(/^\[gif:(.*)\]$/);
        const isGifSafe = gifMatch?.[1] && /^https:\/\/(media\.tenor\.com|media[0-9]*\.giphy\.com|i\.giphy\.com)\//i.test(gifMatch[1]);
        // Tek emoji kontrolü
        const emojiOnly = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F\u20E3]{1,6}$/u.test(msg.content) && msg.content.length <= 14;

        if (isGifSafe) {
          return (
            <AnimatedMsg key={msg.id} delay={idx === 0 ? 0 : 30}>
              <View style={[s.gifRow, { opacity }]}>
                <Text style={s.msgName}>{msg.profiles?.display_name || 'Kullanıcı'}  </Text>
                <Image source={{ uri: gifMatch![1] }} style={s.gifThumb} resizeMode="cover" />
              </View>
            </AnimatedMsg>
          );
        }

        if (emojiOnly) {
          return (
            <AnimatedMsg key={msg.id} delay={idx === 0 ? 0 : 30}>
              <Text style={[s.msgLine, { opacity }]} numberOfLines={1}>
                <Text style={s.msgName}>{msg.profiles?.display_name || 'Kullanıcı'}  </Text>
                <Text style={{ fontSize: 22 }}>{msg.content}</Text>
              </Text>
            </AnimatedMsg>
          );
        }

        return (
          <AnimatedMsg key={msg.id} delay={idx === 0 ? 0 : 30}>
            <Text style={[s.msgLine, { opacity }]} numberOfLines={2}>
              <Text style={s.msgName}>{msg.profiles?.display_name || 'Kullanıcı'}  </Text>
              <Text style={s.msgText}>{msg.content}</Text>
            </Text>
          </AnimatedMsg>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  msgLine: {
    paddingVertical: 2,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  msgName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5EEAD4',
  },
  msgText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  gifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 6,
  },
  gifThumb: {
    width: 80,
    height: 60,
    borderRadius: 8,
  },
  sysLine: {
    paddingVertical: 1.5,
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
