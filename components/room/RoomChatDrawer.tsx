import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, Pressable,
  TextInput, FlatList, Image, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAvatarSource } from '../../constants/avatars';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';

const { width: W, height: H } = Dimensions.get('window');
// ★ Responsive: küçük ekranlarda (320dp civarı) chat drawer daha geniş olmalı ki input kullanılabilir olsun
const PANEL_W = W < 360 ? Math.floor(W * 0.9) : Math.floor(W * 0.72);

interface ChatMsg {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles?: { display_name: string; avatar_url?: string; subscription_tier?: string };
  isSystem?: boolean;
  role?: string; // owner | moderator | speaker | listener
}

// ★ Kullanıcı isim renkleri — rol/tier tabanlı + fallback hash renkleri
const ROLE_NAME_COLORS: Record<string, string> = {
  owner: '#D4AF37',      // Altın
  host: '#D4AF37',
  moderator: '#A78BFA',  // Mor
  admin: '#EF4444',      // Kırmızı
};

const TIER_NAME_COLORS: Record<string, string> = {
  Pro: '#FBBF24',        // Amber
  Plus: '#14B8A6',       // Teal
};

// Hash tabanlı rastgele ama tutarlı renk (aynı kullanıcı hep aynı renk alır)
const HASH_COLORS = ['#38BDF8', '#FB923C', '#A78BFA', '#34D399', '#F472B6', '#FBBF24', '#818CF8', '#22D3EE', '#F87171', '#4ADE80'];
function getUserColor(userId: string, role?: string, tier?: string): string {
  if (role && ROLE_NAME_COLORS[role]) return ROLE_NAME_COLORS[role];
  if (tier && TIER_NAME_COLORS[tier]) return TIER_NAME_COLORS[tier];
  // Hash-based color
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = ((hash << 5) - hash) + userId.charCodeAt(i);
  return HASH_COLORS[Math.abs(hash) % HASH_COLORS.length];
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
  const inputRef = useRef<TextInput>(null);

  // ★ Swipe-to-dismiss — sağa sürükle
  const { translateValue: swipeX, panHandlers } = useSwipeToDismiss({
    direction: 'right',
    threshold: 60,
    onDismiss: onClose,
  });

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
    if (!item) return null;
    if (item.isSystem) {
      return (
        <View style={s.sysMsg}>
          <Text style={s.sysMsgText}>{item.content}</Text>
        </View>
      );
    }

    const content = item.content || '';
    // GIF mesajı kontrolü — ★ SEC: URL whitelist doğrulaması
    const gifMatch = content.match(/^\[gif:(.*)\]$/);
    // ★ GIF URL whitelist — sadece güvenilir kaynaklar kabul edilir
    const isGifSafe = gifMatch?.[1] && /^https:\/\/(media\.tenor\.com|media[0-9]*\.giphy\.com|i\.giphy\.com)\//i.test(gifMatch[1]);
    // Tek emoji kontrolü (1-2 emoji karakter — büyük göster)
    const emojiOnly = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F\u20E3]{1,6}$/u.test(content) && content.length <= 14;
    // user_id undefined olabilir (malformed mesaj) — getUserColor'a boş string geç
    const nameColor = getUserColor(item.user_id || '', item.role, item.profiles?.subscription_tier);

    return (
      <View style={s.msgRow}>
        <Image source={getAvatarSource(item.profiles?.avatar_url)} style={[s.msgAvatar, { borderColor: nameColor + '40' }]} />
        <View style={[s.msgBubble, isGifSafe && { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 4, paddingVertical: 2 }]}>
          <Text style={[s.msgName, { color: nameColor }]}>{item.profiles?.display_name || 'Kullanıcı'}</Text>
          {isGifSafe ? (
            <Image source={{ uri: gifMatch![1] }} style={{ width: 220, height: 165, borderRadius: 12 }} resizeMode="cover" />
          ) : emojiOnly ? (
            <Text style={{ fontSize: 36, lineHeight: 44 }}>{content}</Text>
          ) : (
            <Text style={s.msgText}>{content}</Text>
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

      {/* Panel — sağdan kayar + tüm alandan sürüklenebilir */}
      <Animated.View {...panHandlers} style={[s.panel, { transform: [{ translateX: Animated.add(slideAnim, swipeX) }] }]}>
        <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} locations={[0, 0.35, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
        {/* Başlık */}
        <View collapsable={false} style={s.header}>
          <View style={s.headerDot} />
          <Text style={s.headerTitle}>Oda Sohbeti</Text>
        </View>

        {/* Mesajlar — ★ UX-6 FIX: inverted FlatList ile en yeni mesaj altta */}
        <FlatList
          data={messages}
          keyExtractor={(m, i) => m?.id || `msg_${i}`}
          renderItem={renderMessage}
          style={s.list}
          inverted
          contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 8, gap: 10 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        />

        {/* Alt input — Y15 FIX: Android Expo adjustResize ile native çalışır; sadece iOS'ta padding */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? bottomInset + 10 : 0}
        >
          <View style={s.inputWrap}>
            <TextInput
              ref={inputRef}
              style={s.input}
              placeholder="Bir mesaj yaz..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={chatInput}
              onChangeText={onChangeInput}
              maxLength={300}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                onSend();
                // Klavyeyi kapat/aç döngüsünü önle — focus'u koru
                inputRef.current?.focus();
              }}
            />
            <Pressable
              style={[s.sendBtn, !chatInput.trim() && { opacity: 0.35 }]}
              onPress={() => {
                onSend();
                inputRef.current?.focus();
              }}
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
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: '#95a1ae',
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

  // Mesaj satırı — premium tasarım
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  msgAvatar: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5, borderColor: 'rgba(20,184,166,0.3)',
    marginTop: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 2,
  },
  msgBubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderTopLeftRadius: 4,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 1,
  },
  msgName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#14B8A6', // fallback — overridden per-render
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  msgText: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.25)',
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
