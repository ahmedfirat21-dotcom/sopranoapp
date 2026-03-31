import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Radius } from '../../constants/theme';
import { MessageService, ProfileService, CoinService, type Message, type Profile } from '../../services/database';
import { supabase } from '../../constants/supabase';
import { CallService } from '../../services/call';
import { GiftService } from '../../services/gift';
import { GiftPanel } from '../../components/GiftPanel';
import { ReportModal } from '../../components/ReportModal';
import { showToast } from '../../components/Toast';
import { useAuth } from '../_layout';

function getChatColorStyle(colorId?: string | null) {
  switch (colorId) {
    case 'chat_ocean_blue': return { backgroundColor: '#3B82F6' };
    case 'chat_neon_green': return { backgroundColor: '#10B981', borderColor: '#34D399', borderWidth: 1 };
    case 'chat_blood_red': return { backgroundColor: '#991B1B', borderColor: '#EF4444', borderWidth: 1 };
    case 'chat_mythic_gold': return { backgroundColor: '#B45309', borderColor: '#FDE047', borderWidth: 1 };
    default: return null;
  }
}

function MessageBubble({ message, isMe }: { message: Message; isMe: boolean }) {
  const time = new Date(message.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const customStyle = getChatColorStyle(message.sender?.active_chat_color);
  const isTemp = message.id.startsWith('temp_');

  return (
    <View style={[styles.bubbleWrap, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther, customStyle]}>
        <Text style={styles.bubbleText}>{message.content}</Text>
      </View>
      <View style={[styles.timeRow, isMe && styles.timeRowRight]}>
        <Text style={styles.bubbleTime}>{time}</Text>
        {isMe && (
          <View style={styles.tickWrap}>
            {isTemp ? (
              // Gönderiliyor... (saat ikonu)
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.3)" />
            ) : message.is_read ? (
              // Okundu — çift mavi tik ✓✓
              <View style={styles.doubleTick}>
                <Ionicons name="checkmark" size={13} color="#34B7F1" style={{ marginRight: -6 }} />
                <Ionicons name="checkmark" size={13} color="#34B7F1" />
              </View>
            ) : (
              // İletildi — tek gri tik ✓
              <Ionicons name="checkmark" size={13} color="rgba(255,255,255,0.45)" />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { firebaseUser, profile, refreshProfile } = useAuth();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !firebaseUser) return;

    const loadChat = async () => {
      try {
        // Karşı kullanıcı profilini yükle
        const profile = await ProfileService.get(id);
        setOtherUser(profile);

        // Mesaj geçmişini yükle
        const history = await MessageService.getConversation(firebaseUser.uid, id);
        setMessages(history);

        // Mesajları okundu olarak işaretle
        await MessageService.markAsRead(firebaseUser.uid, id);
      } catch (err) {
        console.warn('Sohbet yüklenemedi:', err);
      } finally {
        setLoading(false);
      }
    };

    loadChat();

    // Realtime yeni mesaj dinleyici
    const channel = MessageService.onNewMessage(firebaseUser.uid, (newMsg) => {
      if (newMsg.sender_id === id) {
        setMessages(prev => {
          // Eğer optimistic message id'si varsa temizle veya direk sona ekle
          const existing = prev.find(m => m.id === newMsg.id);
          if (existing) return prev;
          return [...prev, newMsg];
        });
        // Gelen mesajı okundu olarak işaretle
        MessageService.markAsRead(firebaseUser.uid, id).catch(() => {});
        // Yeni mesaj gelince yazıyor bilgisini kapat
        setIsTyping(false);
      }
    });

    // Realtime Yazıyor... dinleyici
    let typingResetTimer: NodeJS.Timeout | null = null;
    const typingChannel = MessageService.onTypingStatus(firebaseUser.uid, (payload) => {
      if (payload.user_id === id) {
        setIsTyping(payload.is_typing);
        // Güvenlik: 5 saniye içinde güncelleme gelmezse otomatik sıfırla
        if (typingResetTimer) clearTimeout(typingResetTimer);
        if (payload.is_typing) {
          typingResetTimer = setTimeout(() => setIsTyping(false), 5000);
        }
      }
    });

    // Realtime okundu bilgisi dinleyici — tikler güncellensin (gri → mavi)
    const readChannel = supabase
      .channel(`read_status_${firebaseUser.uid}_${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${firebaseUser.uid}`,
        },
        (payload: any) => {
          if (payload.new.is_read && payload.new.receiver_id === firebaseUser.uid || payload.new.sender_id === firebaseUser.uid) {
            // Bu mesaj okundu olarak işaretlendi — state güncelle
            setMessages(prev => prev.map(m =>
              m.id === payload.new.id ? { ...m, is_read: true } : m
            ));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      typingChannel.unsubscribe();
      readChannel.unsubscribe();
      if (typingResetTimer) clearTimeout(typingResetTimer);
    };
  }, [id, firebaseUser]);

  const handleInputChange = (text: string) => {
    setInputText(text);

    if (!firebaseUser || !id) return;
    
    // Typing status gönder
    MessageService.sendTypingStatus(firebaseUser.uid, id, text.length > 0);

    // Debounce: 2 saniye kimse yazmazsa is_typing = false gönder
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (text.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        MessageService.sendTypingStatus(firebaseUser.uid, id, false);
      }, 2000);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !firebaseUser || !id) return;

    const content = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic Update: Anında ekranda göster
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      sender_id: firebaseUser.uid,
      receiver_id: id,
      content: content,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    
    // Yazıyor... bilgisini kapat
    MessageService.sendTypingStatus(firebaseUser.uid, id, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      const newMsg = await MessageService.send(firebaseUser.uid, id, content);
      // Geçici mesajı gerçek veritabanı ID'li mesaj ile değiştir
      setMessages(prev => prev.map(m => m.id === tempId ? newMsg : m));
    } catch (err) {
      console.error('Mesaj gönderilemedi:', err);
      // Hata durumunda mesajı listeden çıkar ve geri metin kutusuna koy
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInputText(content);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.teal} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Image source={{ uri: otherUser?.avatar_url || 'https://i.pravatar.cc/48?img=1' }} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{otherUser?.display_name || 'Kullanıcı'}</Text>
          <View style={styles.onlineRow}>
            {otherUser?.is_online ? (
              <>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Çevrimiçi</Text>
              </>
            ) : (
              <Text style={styles.offlineText}>Çevrimdışı</Text>
            )}
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerAction} onPress={async () => {
            if (!firebaseUser || !id) return;
            const tier = profile?.tier || 'Silver';
            try {
              const { callId } = await CallService.initiateCall(
                firebaseUser.uid,
                profile?.display_name || 'Kullanıcı',
                profile?.avatar_url || undefined,
                id, 'audio', tier as any
              );
              router.push(`/call/${id}?callId=${callId}&callType=audio&isIncoming=false` as any);
            } catch (err: any) {
              showToast({ title: 'Arama Hatası', message: err.message || 'Arama başlatılamadı', type: 'error' });
            }
          }}>
            <Ionicons name="call" size={20} color={Colors.teal} />
          </Pressable>
          <Pressable style={styles.headerAction} onPress={async () => {
            if (!firebaseUser || !id) return;
            const tier = profile?.tier || 'Silver';
            if (tier === 'Silver') {
              showToast({ title: '🔒 Görüntülü Arama', message: 'Görüntülü arama için Plus veya VIP üyelik gerekiyor.', type: 'warning' });
              return;
            }
            try {
              const { callId } = await CallService.initiateCall(
                firebaseUser.uid,
                profile?.display_name || 'Kullanıcı',
                profile?.avatar_url || undefined,
                id, 'video', tier as any
              );
              router.push(`/call/${id}?callId=${callId}&callType=video&isIncoming=false` as any);
            } catch (err: any) {
              showToast({ title: 'Arama Hatası', message: err.message || 'Arama başlatılamadı', type: 'error' });
            }
          }}>
            <Ionicons name="videocam" size={20} color={Colors.teal} />
          </Pressable>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => {
              if (item.sender_id !== firebaseUser?.uid) {
                Alert.alert('Mesaj Seçenekleri', undefined, [
                  { text: '🚩 Mesajı Rapor Et', onPress: () => {
                    setReportMessageId(item.id);
                    setShowReportModal(true);
                  }, style: 'destructive' },
                  { text: 'Vazgeç', style: 'cancel' },
                ]);
              }
            }}
            delayLongPress={500}
          >
            <MessageBubble message={item} isMe={item.sender_id === firebaseUser?.uid} />
          </Pressable>
        )}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          isTyping ? (
            <View style={styles.typingIndicatorWrap}>
              <View style={[styles.bubble, styles.bubbleOther, styles.typingBubble]}>
                <ActivityIndicator size="small" color={Colors.text2} />
                <Text style={styles.typingText}>Yazıyor...</Text>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-outline" size={40} color={Colors.text3} />
            <Text style={styles.emptyChatText}>Henüz mesaj yok. İlk mesajı sen yaz!</Text>
          </View>
        }
      />

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <Pressable style={styles.inputAction} onPress={() => setShowGiftPanel(true)}>
          <Ionicons name="gift" size={22} color={Colors.gold} />
        </Pressable>
        <TextInput
          style={styles.textInput}
          placeholder="Mesaj yaz..."
          placeholderTextColor={Colors.text3}
          value={inputText}
          onChangeText={handleInputChange}
          multiline
        />
        <Pressable style={styles.inputAction} onPress={() => {
          showToast({ title: '📎 Dosya Ekleme', message: 'Fotoğraf, video veya dosya gönderme yakında aktif olacak.', type: 'info' });
        }}>
          <Ionicons name="attach" size={22} color={Colors.text3} />
        </Pressable>
        {inputText.trim() ? (
          <Pressable style={styles.sendBtn} onPress={handleSend} disabled={sending}>
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        ) : (
          <Pressable style={styles.inputAction} onPress={() => {
            showToast({ title: '🎙️ Sesli Mesaj', message: 'Sesli mesaj gönderme yakında aktif olacak.', type: 'info' });
          }}>
            <Ionicons name="mic" size={22} color={Colors.teal} />
          </Pressable>
        )}
      </View>

      {/* Hediye Paneli */}
      <GiftPanel
        visible={showGiftPanel}
        onClose={() => setShowGiftPanel(false)}
        userCoins={profile?.coins ?? 0}
        roomUsers={otherUser ? [{ id: id!, name: otherUser.display_name || 'Kullanıcı', avatarUrl: otherUser.avatar_url, role: 'listener' }] : []}
        defaultTargetId={id}
        onSend={async (giftId, _giftPrice, _count, _targetId) => {
          if (!firebaseUser || !id) return false;
          try {
            // Use the atomic RPC call instead of client side transactions
            const result = await GiftService.sendGift(null, firebaseUser.uid, id, giftId);
            if (result.success) {
              await refreshProfile();
              return true;
            } else {
              showToast({ title: 'Hata', message: result.error, type: 'error' });
              return false;
            }
          } catch (err: any) {
            showToast({ title: 'Hediye gonderilemedi', message: err.message || '', type: 'error' });
            return false;
          }
        }}
      />

      {/* Report Modal */}
      {firebaseUser && reportMessageId && (
        <ReportModal
          visible={showReportModal}
          onClose={() => { setShowReportModal(false); setReportMessageId(null); }}
          reporterId={firebaseUser.uid}
          target={{ type: 'message', id: reportMessageId }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 54,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    backgroundColor: Colors.bg2,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, marginLeft: 4 },
  headerInfo: { flex: 1, marginLeft: 10 },
  headerName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.emerald },
  onlineText: { fontSize: 11, color: Colors.emerald },
  offlineText: { fontSize: 11, color: Colors.text3 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.glass2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Messages
  messageList: { flex: 1 },
  messageContent: { padding: 16, gap: 8, flexGrow: 1 },
  bubbleWrap: { marginBottom: 4 },
  bubbleLeft: { alignItems: 'flex-start' },
  bubbleRight: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.default,
  },
  bubbleMe: {
    backgroundColor: Colors.teal,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.bg4,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  bubbleTime: { fontSize: 9, color: Colors.text3 },
  bubbleTimeRight: { textAlign: 'right' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  timeRowRight: { justifyContent: 'flex-end' },
  tickWrap: { marginLeft: 2 },
  doubleTick: { flexDirection: 'row', alignItems: 'center' },
  typingIndicatorWrap: { marginBottom: 4, alignItems: 'flex-start' },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12 },
  typingText: { fontSize: 13, color: Colors.text2, fontStyle: 'italic' },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyChatText: { fontSize: 13, color: Colors.text3, textAlign: 'center', paddingHorizontal: 40 },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
    backgroundColor: Colors.bg2,
    gap: 6,
  },
  inputAction: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    borderRadius: Radius.default,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
