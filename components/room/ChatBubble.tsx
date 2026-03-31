import React from 'react';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from './constants';
import { getAvatarSource } from '../../constants/avatars';

const ChatBubble = React.memo(function ChatBubble({ message, index = 0, total = 1 }: { message: any, index?: number, total?: number }) {
  // Sistem mesajları (sahneye çıktı, susturuldu, kick vb.)
  if (message.isSystem) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3, gap: 5 }}>
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontStyle: 'italic' }}>
          {message.profiles?.display_name || 'Sistem'} {message.content}
        </Text>
      </View>
    );
  }

  if (message.isJoin) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3, gap: 5 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(92,225,230,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="enter-outline" size={7} color={COLORS.primary} />
        </View>
        <Text style={{ color: COLORS.primary, fontSize: 11, fontStyle: 'italic' }}>
          {message.profiles?.display_name || 'Biri'} odaya katıldı
        </Text>
      </View>
    );
  }

  const senderName = message.profiles?.display_name || 'Kullanıcı';
  const avatarUrl = message.profiles?.avatar_url;
  const cols = ['#5CE1E6', '#FF6B8A', '#FFD700', '#FF9800', '#A855F7', '#4ADE80'];
  const color = cols[senderName.length % cols.length];
  const initials = senderName.slice(0, 1).toUpperCase();

  return (
    <View style={{ flexDirection: 'row', marginBottom: 5, alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.05)', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 5, borderRadius: 14, gap: 6, maxWidth: '85%' }}>
      {avatarUrl ? (
        <Image
          source={getAvatarSource(avatarUrl)}
          style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', marginTop: 1 }}
        />
      ) : (
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color + '20', borderWidth: 0.5, borderColor: color + '40', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
          <Text style={{ color, fontSize: 9, fontWeight: '700' }}>{initials}</Text>
        </View>
      )}
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 17, flexShrink: 1 }}>{message.content}</Text>
    </View>
  );
});

export default ChatBubble;
