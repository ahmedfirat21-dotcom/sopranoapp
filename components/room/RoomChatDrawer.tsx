import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, Pressable,
  TextInput, FlatList, Image, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';

const { width: W, height: H } = Dimensions.get('window');
const PANEL_W = W * 0.85; // Geniş panel — tüm mesajlar rahat okunur

interface ChatMsg {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles?: { display_name: string; avatar_url?: string };
  isSystem?: boolean;
}

interface Props {
  visible: boolean;
  messages: ChatMsg[];
  chatInput: string;
  onChangeInput: (t: string) => void;
  onSend: () => void;
  onClose: () => void;
  bottomInset: number;
}

export default function RoomChatDrawer({ visible, messages, chatInput, onChangeInput, onSend, onClose, bottomInset }: Props) {
  const slideAnim = useRef(new Animated.Value(PANEL_W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: PANEL_W, useNativeDriver: true, damping: 18, stiffness: 200 }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const renderMessage = ({ item }: { item: ChatMsg }) => {
    if (item.isSystem) {
      return (
        <View style={s.sysMsg}>
          <Text style={s.sysMsgText}>{item.content}</Text>
        </View>
      );
    }

    // GIF mesajı kontrolü
    const gifMatch = item.content.match(/^\[gif:(.*)\]$/);
    // Tek emoji kontrolü (1-2 emoji karakter — büyük göster)
    const emojiOnly = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F\u20E3]{1,6}$/u.test(item.content) && item.content.length <= 14;

    return (
      <View style={s.msgRow}>
        <Image source={getAvatarSource(item.profiles?.avatar_url)} style={s.msgAvatar} />
        <View style={[s.msgBubble, gifMatch && { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 4, paddingVertical: 2 }]}>
          <Text style={s.msgName}>{item.profiles?.display_name || 'Kullanıcı'}</Text>
          {gifMatch ? (
            <Image source={{ uri: gifMatch[1] }} style={{ width: 160, height: 120, borderRadius: 10 }} resizeMode="cover" />
          ) : emojiOnly ? (
            <Text style={{ fontSize: 36, lineHeight: 44 }}>{item.content}</Text>
          ) : (
            <Text style={s.msgText}>{item.content}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop — dokunulunca kapat */}
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel — sağdan kayar */}
      <Animated.View style={[s.panel, { transform: [{ translateX: slideAnim }] }]}>
        {/* Başlık */}
        <View style={s.header}>
          <View style={s.headerDot} />
          <Text style={s.headerTitle}>Oda Sohbeti</Text>
        </View>

        {/* Mesajlar — ★ UX-6 FIX: inverted FlatList ile en yeni mesaj altta */}
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          style={s.list}
          inverted
          contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 8, gap: 10 }}
          showsVerticalScrollIndicator={false}
        />

        {/* Alt input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={bottomInset + 80}
        >
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="Bir mesaj yaz..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={chatInput}
              onChangeText={onChangeInput}
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={onSend}
            />
            <Pressable
              style={[s.sendBtn, !chatInput.trim() && { opacity: 0.35 }]}
              onPress={onSend}
              disabled={!chatInput.trim()}
            >
              <Ionicons name="send" size={14} color="#FFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  panel: {
    position: 'absolute',
    right: 0,
    top: 70,
    bottom: 80,
    width: PANEL_W,
    backgroundColor: 'rgba(45,55,64,0.95)',
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#14B8A6',
  },
  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  list: { flex: 1 },

  // Mesaj satırı — mockup'taki gibi
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  msgAvatar: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.3)',
    marginTop: 2,
  },
  msgBubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  msgName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#14B8A6',
    marginBottom: 2,
  },
  msgText: {
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 16,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Sistem mesajı
  sysMsg: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sysMsgText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
    fontStyle: 'italic',
  },

  // Alt input
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  input: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#F1F5F9',
  },
  sendBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#14B8A6',
    alignItems: 'center', justifyContent: 'center',
  },
});
