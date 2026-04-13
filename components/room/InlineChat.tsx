import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

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
            <Text key={msg.id} style={[s.sysLine, { opacity }]} numberOfLines={2}>
              {msg.content}
            </Text>
          );
        }

        // GIF mesajı kontrolü
        const gifMatch = msg.content.match(/^\[gif:(.*)\]$/);
        // Tek emoji kontrolü
        const emojiOnly = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F\u20E3]{1,6}$/u.test(msg.content) && msg.content.length <= 14;

        if (gifMatch) {
          return (
            <View key={msg.id} style={[s.gifRow, { opacity }]}>
              <Text style={s.msgName}>{msg.profiles?.display_name || 'Kullanıcı'}  </Text>
              <Image source={{ uri: gifMatch[1] }} style={s.gifThumb} resizeMode="cover" />
            </View>
          );
        }

        if (emojiOnly) {
          return (
            <Text key={msg.id} style={[s.msgLine, { opacity }]} numberOfLines={1}>
              <Text style={s.msgName}>{msg.profiles?.display_name || 'Kullanıcı'}  </Text>
              <Text style={{ fontSize: 22 }}>{msg.content}</Text>
            </Text>
          );
        }

        return (
          <Text key={msg.id} style={[s.msgLine, { opacity }]} numberOfLines={2}>
            <Text style={s.msgName}>{msg.profiles?.display_name || 'Kullanıcı'}  </Text>
            <Text style={s.msgText}>{msg.content}</Text>
          </Text>
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
    width: 48,
    height: 36,
    borderRadius: 6,
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
