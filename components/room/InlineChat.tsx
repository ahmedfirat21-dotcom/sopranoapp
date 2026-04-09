import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

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

export default function InlineChat({ messages, maxLines = 5 }: Props) {
  if (messages.length === 0) return null;
  const visible = messages.slice(0, maxLines).reverse();

  return (
    <View style={s.wrap}>
      {visible.map((msg, idx) => {
        const opacity = 0.2 + (idx / (visible.length - 1 || 1)) * 0.8;
        if (msg.isSystem) {
          return (
            <Text key={msg.id} style={[s.sysLine, { opacity }]} numberOfLines={2}>
              {msg.content}
            </Text>
          );
        }
        return (
          <Text key={msg.id} style={[s.msgLine, { opacity }]} numberOfLines={1}>
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
    paddingHorizontal: 16,
    marginTop: 12,
    marginHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(10,18,30,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  msgLine: {
    paddingVertical: 2.5,
  },
  msgName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14B8A6',
  },
  msgText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  sysLine: {
    paddingVertical: 2,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
  },
});
