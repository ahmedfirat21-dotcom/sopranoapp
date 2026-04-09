import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Easing, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import PremiumAlert, { type AlertButton } from '../../components/PremiumAlert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Radius } from '../../constants/theme';
import { MessageService, ProfileService, type Message, type Profile } from '../../services/database';
import { supabase } from '../../constants/supabase';
import { CallService } from '../../services/call';
import { FriendshipService } from '../../services/friendship';
import { EmojiPicker } from '../../components/EmojiPicker';
import { ReportModal } from '../../components/ReportModal';
import { showToast } from '../../components/Toast';
import { useAuth, useBadges } from '../_layout';
import { getAvatarSource } from '../../constants/avatars';
import { StorageService } from '../../services/storage';
import * as ImagePicker from 'expo-image-picker';
import { Audio, type AVPlaybackStatus } from 'expo-av';


function getChatColorStyle(colorId?: string | null) {
  switch (colorId) {
    case 'chat_ocean_blue': return { backgroundColor: '#3B82F6' };
    case 'chat_neon_green': return { backgroundColor: '#10B981', borderColor: '#34D399', borderWidth: 1 };
    case 'chat_blood_red': return { backgroundColor: '#991B1B', borderColor: '#EF4444', borderWidth: 1 };
    case 'chat_mythic_gold': return { backgroundColor: '#B45309', borderColor: '#FDE047', borderWidth: 1 };
    default: return null;
  }
}

// ★ MSG-6: Ses mesajı oynatıcı bileşeni
function VoiceMessagePlayer({ voiceUrl, duration, isMe }: { voiceUrl: string; duration?: number; isMe: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalDur, setTotalDur] = useState(duration || 0);
  const soundRef = useRef<Audio.Sound | null>(null);

  const togglePlay = async () => {
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        return;
      }
      if (soundRef.current) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        return;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: voiceUrl },
        { shouldPlay: true },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          if (status.durationMillis) setTotalDur(Math.round(status.durationMillis / 1000));
          if (status.positionMillis && status.durationMillis) {
            setProgress(status.positionMillis / status.durationMillis);
          }
          if (status.didJustFinish) {
            setIsPlaying(false);
            setProgress(0);
            soundRef.current?.setPositionAsync(0).catch(() => {});
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (e) {
      if (__DEV__) console.warn('[VoicePlayer] Oynatma hatası:', e);
      showToast({ title: 'Ses oynatılamadı', type: 'error' });
    }
  };

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <View style={voiceStyles.container}>
      <Pressable onPress={togglePlay} style={[voiceStyles.playBtn, isMe && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#FFF" />
      </Pressable>
      <View style={voiceStyles.waveContainer}>
        {Array.from({ length: 24 }).map((_, i) => {
          const filled = i / 24 <= progress;
          const h = 4 + Math.sin(i * 0.7 + 2) * 8 + Math.cos(i * 1.3) * 4;
          return (
            <View
              key={i}
              style={[
                voiceStyles.waveBar,
                { height: h },
                filled ? { backgroundColor: isMe ? '#FFF' : Colors.teal } : { backgroundColor: isMe ? 'rgba(255,255,255,0.3)' : 'rgba(92,225,230,0.25)' },
              ]}
            />
          );
        })}
      </View>
      <Text style={[voiceStyles.duration, isMe && { color: 'rgba(255,255,255,0.7)' }]}>
        {fmtTime(totalDur)}
      </Text>
    </View>
  );
}

function MessageBubble({ message, isMe }: { message: Message; isMe: boolean }) {
  const time = new Date(message.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const customStyle = getChatColorStyle(message.sender?.active_chat_color);
  const isTemp = message.id.startsWith('temp_');
  const hasVoice = !!message.voice_url;
  // ★ FIX: image_url sütunu olmadığı için content'ten URL çıkar
  const imageUrlFromContent = !hasVoice && message.content?.startsWith('📷 http') ? message.content.replace('📷 ', '') : null;
  const hasImage = !!message.image_url || !!imageUrlFromContent;
  const imageUri = message.image_url || imageUrlFromContent;

  return (
    <View style={[styles.bubbleWrap, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther, customStyle]}>
        {hasImage && !hasVoice ? (
          <Image source={{ uri: imageUri! }} style={styles.chatImage} resizeMode="cover" />
        ) : null}
        {/* ★ MSG-6: Ses mesajı oynatıcı */}
        {hasVoice ? (
          <VoiceMessagePlayer voiceUrl={message.voice_url!} duration={message.voice_duration || undefined} isMe={isMe} />
        ) : !hasImage && message.content ? (
          <Text style={styles.bubbleText}>{message.content}</Text>
        ) : null}
      </View>
      <View style={[styles.timeRow, isMe && styles.timeRowRight]}>
        <Text style={styles.bubbleTime}>{time}</Text>
        {isMe && (
          <View style={styles.tickWrap}>
            {isTemp ? (
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.3)" />
            ) : message.is_read ? (
              <View style={styles.doubleTick}>
                <Ionicons name="checkmark" size={13} color="#34B7F1" style={{ marginRight: -6 }} />
                <Ionicons name="checkmark" size={13} color="#34B7F1" />
              </View>
            ) : (
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
  const { refreshBadges } = useBadges();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isCallingInProgress, setIsCallingInProgress] = useState(false); // ★ CALL-4: Çift tıklama koruması
  const [isFriend, setIsFriend] = useState(false); // ★ CALL-1: Takipçi kontrolü
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const isAtBottomRef = useRef(true); // ★ BUG-6 FIX: Kullanıcı en altta mı?
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [cAlert, setCAlert] = useState<{visible:boolean;title:string;message:string;type?:any;buttons?:AlertButton[]}>({visible:false,title:'',message:''});
  const [activeRoom, setActiveRoom] = useState<{id: string; name: string} | null>(null);

  // ★ Cevapsız Arama State (WhatsApp tarzı)
  type MissedCall = { id: string; callType: 'audio' | 'video'; time: string; callerName: string };
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);

  // ─── Ses Notu ────────────────────────────────────────
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]); // ★ MSG-5: Dalga formu verisi
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        showToast({ title: 'Mikrofon izni gerekli', message: 'Ayarlardan mikrofon iznini açın', type: 'warning' });
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      await new Promise(r => setTimeout(r, 100));

      const recordingOptions = Audio.RecordingOptionsPresets.HIGH_QUALITY;
      // Android'de isMeteringEnabled ayrı set edilmeli
      const { recording: rec } = await Audio.Recording.createAsync(
        recordingOptions,
        (status) => {
          // ★ MSG-5: Metering callback — ses seviyesini oku
          if (status.isRecording && status.metering !== undefined) {
            const normalized = Math.min(1, Math.max(0, (status.metering + 50) / 50));
            setWaveformData(prev => [...prev.slice(-40), normalized]);
          }
        },
        100 // 100ms interval
      );
      setRecording(rec);
      setIsRecording(true);
      setVoiceDuration(0);
      setWaveformData([]);

      voiceTimerRef.current = setInterval(() => setVoiceDuration(d => d + 1), 1000);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.ease, useNativeDriver: true }),
        ])
      ).start();
    } catch (err: any) {
      console.error('Recording error:', err);
      showToast({ title: 'Kayıt başlatılamadı', message: err?.message || 'Mikrofon hatası', type: 'error' });
      setIsRecording(false);
      setRecording(null);
    }
  };

  const cancelRecording = async () => {
    if (voiceTimerRef.current) { clearInterval(voiceTimerRef.current); voiceTimerRef.current = null; }
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    if (recording) {
      try { await recording.stopAndUnloadAsync(); } catch {}
      setRecording(null);
    }
    setIsRecording(false);
    setVoiceDuration(0);
    setWaveformData([]); // ★ MSG-5
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  };

  const stopAndSendRecording = async () => {
    if (!recording || !firebaseUser || !id) return;
    if (voiceTimerRef.current) { clearInterval(voiceTimerRef.current); voiceTimerRef.current = null; }
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);

    setSendingVoice(true);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);

      if (!uri) { showToast({ title: 'Ses kaydı alınamadı', type: 'error' }); return; }

      // ★ MSG-3 FIX: uploadVoiceNote kullan (uploadChatImage ses dosyasında crash yapıyor)
      const voiceUrl = await StorageService.uploadVoiceNote(firebaseUser.uid, uri);

      // ★ MSG-4: voice_url ve voice_duration ile gönder
      const newMsg = await MessageService.send(firebaseUser.uid, id, '🎙️ Sesli mesaj', undefined, voiceUrl, voiceDuration);
      setMessages(prev => [...prev, newMsg]);
      setWaveformData([]); // ★ MSG-5
      showToast({ title: '🎙️ Sesli mesaj gönderildi', type: 'success' });
    } catch (err: any) {
      console.error('Voice send error:', err);
      showToast({ title: 'Sesli mesaj gönderilemedi', message: err?.message || '', type: 'error' });
    } finally {
      setSendingVoice(false);
      setVoiceDuration(0);
    }
  };

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    };
  }, []);

  const formatVoiceTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!id || !firebaseUser) return;

    const loadChat = async () => {
      try {
        // Karşı kullanıcı profilini yükle
        const profile = await ProfileService.get(id);
        setOtherUser(profile);

        // Aktif odadaysa davet butonu göster
        try {
          const { data: activeP } = await supabase
            .from('room_participants')
            .select('room_id, rooms!inner(id, name)')
            .eq('user_id', firebaseUser.uid)
            .limit(1)
            .single();
          if (activeP?.rooms) {
            setActiveRoom({ id: (activeP.rooms as any).id, name: (activeP.rooms as any).name });
          }
        } catch { setActiveRoom(null); }

        // ★ CALL-1: Takipçi kontrolü — arama butonları sadece arkadaşlara gösterilir
        try {
          const status = await FriendshipService.getStatus(firebaseUser.uid, id);
          const reverseStatus = await FriendshipService.getStatus(id, firebaseUser.uid);
          setIsFriend(status === 'accepted' || reverseStatus === 'accepted');
        } catch { setIsFriend(false); }

        // Mesaj geçmişini yükle
        const history = await MessageService.getConversation(firebaseUser.uid, id);
        setMessages(history);

        // Mesajları okundu olarak işaretle + badge güncelle
        await MessageService.markAsRead(firebaseUser.uid, id);
        refreshBadges();

        // ★ Cevapsız aramaları yükle (bu sohbet partneri ile)
        try {
          const { data: missedData } = await supabase
            .from('notifications')
            .select('id, type, body, created_at, sender_id, sender:profiles!sender_id(display_name)')
            .eq('user_id', firebaseUser.uid)
            .eq('sender_id', id)
            .eq('type', 'missed_call')
            .order('created_at', { ascending: false })
            .limit(5);
          if (missedData && missedData.length > 0) {
            setMissedCalls(missedData.map((mc: any) => ({
              id: mc.id,
              callType: mc.body?.includes('görüntülü') ? 'video' : 'audio',
              time: mc.created_at,
              callerName: mc.sender?.display_name || 'Kullanıcı',
            })));
          }
        } catch { /* silent */ }
      } catch (err) {
        if (__DEV__) console.warn('Sohbet yüklenemedi:', err);
      } finally {
        setLoading(false);
      }
    };

    loadChat();

    // Realtime yeni mesaj dinleyici
    const channel = MessageService.onNewMessage(firebaseUser.uid, (newMsg) => {
      if (newMsg.sender_id === id) {
        // Yeni mesaj gelince HEMEN yazıyor bilgisini kapat
        setIsTyping(false);
        if (typingResetTimer) { clearTimeout(typingResetTimer); typingResetTimer = null; }
        
        setMessages(prev => {
          const existing = prev.find(m => m.id === newMsg.id);
          if (existing) return prev;
          return [...prev, newMsg];
        });
        // ★ BUG-6 FIX: Yeni mesaj geldiğinde sadece en alttaysa scroll yap
        if (isAtBottomRef.current) {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
        // Gelen mesajı okundu olarak işaretle + badge güncelle
        MessageService.markAsRead(firebaseUser.uid, id).then(() => refreshBadges()).catch(() => {});
      }
    });

    // Realtime Yazıyor... dinleyici
    let typingResetTimer: NodeJS.Timeout | null = null;
    const typingChannel = MessageService.onTypingStatus(firebaseUser.uid, (payload) => {
      if (payload.user_id === id) {
        setIsTyping(payload.is_typing);
        // Güvenlik: 3 saniye içinde güncelleme gelmezse otomatik sıfırla
        if (typingResetTimer) clearTimeout(typingResetTimer);
        if (payload.is_typing) {
          typingResetTimer = setTimeout(() => setIsTyping(false), 3000);
        }
      }
    });

    // ★ BUG-8 FIX: readChannel — daha spesifik filtre + removeChannel ile temizlik
    const readChannelName = `read_status_${firebaseUser.uid}_${id}`;
    const readChannel = supabase
      .channel(readChannelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${firebaseUser.uid}`,
        },
        (payload: any) => {
          if (payload.new.is_read && payload.new.receiver_id === id) {
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
      supabase.removeChannel(readChannel); // ★ BUG-8 FIX: removeChannel ile tam temizlik
      if (typingResetTimer) clearTimeout(typingResetTimer);
      // ★ BUG-2 FIX: Typing kanalını temizle
      MessageService.cleanupTypingChannel(id);
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
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/home')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Image source={getAvatarSource(otherUser?.avatar_url)} style={styles.headerAvatar} />
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
        {/* ★ CALL-1: Arama butonları sadece arkadaşlara gösterilir */}
        {isFriend && (
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.headerAction, isCallingInProgress && { opacity: 0.4 }]}
              disabled={isCallingInProgress}
              onPress={async () => {
                if (!firebaseUser || !id || isCallingInProgress) return;
                setIsCallingInProgress(true); // ★ CALL-4: Çift tıklama koruması
                const tier = profile?.subscription_tier || 'Free';
                try {
                  const { callId, receiverIsOnline } = await CallService.initiateCall(
                    firebaseUser.uid,
                    profile?.display_name || 'Kullanıcı',
                    profile?.avatar_url || undefined,
                    id, 'audio', tier as any
                  );
                  router.push(`/call/${id}?callId=${callId}&callType=audio&isIncoming=false&receiverOnline=${receiverIsOnline}` as any);
                } catch (err: any) {
                  showToast({ title: 'Arama Hatası', message: err.message || 'Arama başlatılamadı', type: 'error' });
                } finally {
                  setTimeout(() => setIsCallingInProgress(false), 2000);
                }
              }}
            >
              <Ionicons name="call" size={20} color={Colors.teal} />
            </Pressable>
            <Pressable
              style={[styles.headerAction, isCallingInProgress && { opacity: 0.4 }]}
              disabled={isCallingInProgress}
              onPress={async () => {
                if (!firebaseUser || !id || isCallingInProgress) return;
                const tier = profile?.subscription_tier || 'Free';
                // Tüm tier'lar görüntülü arama yapabilir
                setIsCallingInProgress(true); // ★ CALL-4: Çift tıklama koruması
                try {
                  const { callId, receiverIsOnline } = await CallService.initiateCall(
                    firebaseUser.uid,
                    profile?.display_name || 'Kullanıcı',
                    profile?.avatar_url || undefined,
                    id, 'video', tier as any
                  );
                  router.push(`/call/${id}?callId=${callId}&callType=video&isIncoming=false&receiverOnline=${receiverIsOnline}` as any);
                } catch (err: any) {
                  showToast({ title: 'Arama Hatası', message: err.message || 'Arama başlatılamadı', type: 'error' });
                } finally {
                  setTimeout(() => setIsCallingInProgress(false), 2000);
                }
              }}
            >
              <Ionicons name="videocam" size={20} color={Colors.teal} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => {
              const isOwn = item.sender_id === firebaseUser?.uid;
              setCAlert({visible:true,title:'Mesaj Seçenekleri',message:'Ne yapmak istersin?',type:'info',buttons:[
                ...(isOwn ? [{ text: '🗑️ Mesajı Sil', onPress: async () => {
                  try {
                    await MessageService.deleteMessage(item.id, firebaseUser!.uid);
                    setMessages(prev => prev.filter(m => m.id !== item.id));
                    showToast({ title: 'Mesaj silindi', type: 'success' });
                  } catch {
                    showToast({ title: 'Mesaj silinemedi', message: 'Lütfen tekrar deneyin', type: 'error' });
                  }
                }, style: 'destructive' as const }] : []),
                ...(!isOwn ? [{ text: '🚩 Mesajı Rapor Et', onPress: () => {
                  setReportMessageId(item.id);
                  setShowReportModal(true);
                }, style: 'destructive' as const }] : []),
                { text: 'Vazgeç', style: 'cancel' as const },
              ]});
            }}
            delayLongPress={500}
          >
            <MessageBubble message={item} isMe={item.sender_id === firebaseUser?.uid} />
          </Pressable>
        )}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
          isAtBottomRef.current = isBottom;
        }}
        scrollEventThrottle={200}
        ListHeaderComponent={
          missedCalls.length > 0 ? (
            <View style={styles.missedCallSection}>
              {missedCalls.map((mc) => {
                const time = new Date(mc.time);
                const timeStr = time.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                return (
                  <View key={mc.id} style={styles.missedCallCard}>
                    <View style={styles.missedCallIcon}>
                      <Ionicons
                        name={mc.callType === 'video' ? 'videocam' : 'call'}
                        size={16}
                        color="#EF4444"
                      />
                    </View>
                    <View style={styles.missedCallInfo}>
                      <Text style={styles.missedCallTitle}>
                        Cevapsız {mc.callType === 'video' ? 'görüntülü' : 'sesli'} arama
                      </Text>
                      <Text style={styles.missedCallTime}>{timeStr}</Text>
                    </View>
                    <Pressable
                      style={styles.missedCallBackBtn}
                      onPress={async () => {
                        if (!firebaseUser || !id) return;
                        const tier = profile?.subscription_tier || 'Free';
                        try {
                          const { callId, receiverIsOnline } = await CallService.initiateCall(
                            firebaseUser.uid,
                            profile?.display_name || 'Kullanıcı',
                            profile?.avatar_url || undefined,
                            id,
                            mc.callType,
                            tier as any
                          );
                          // Cevapsız arama bildirimini sil
                          supabase.from('notifications').delete().eq('id', mc.id).then(() => {
                            setMissedCalls(prev => prev.filter(c => c.id !== mc.id));
                          });
                          router.push(`/call/${id}?callId=${callId}&callType=${mc.callType}&isIncoming=false&receiverOnline=${receiverIsOnline}` as any);
                        } catch (err: any) {
                          showToast({ title: 'Arama Hatası', message: err.message || '', type: 'error' });
                        }
                      }}
                    >
                      <Ionicons name={mc.callType === 'video' ? 'videocam' : 'call'} size={16} color="#fff" />
                      <Text style={styles.missedCallBackText}>Geri Ara</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null
        }
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

      {/* ★ Input Bar — WhatsApp tarzı: kayıt sırasında inline dönüşüm */}
      {isRecording ? (
        <View style={styles.inputBar}>
          {/* Kayıt modunda: inline waveform bar */}
          <Pressable style={styles.recCancelBtn} onPress={cancelRecording}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </Pressable>
          <View style={styles.recInlineCenter}>
            <Animated.View style={[styles.recDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.recTime}>{formatVoiceTime(voiceDuration)}</Text>
            <View style={styles.recWaveWrap}>
              {waveformData.length > 0 ? (
                waveformData.slice(-25).map((level, i) => (
                  <View
                    key={i}
                    style={[
                      styles.recWaveBar,
                      { height: Math.max(3, level * 24) },
                    ]}
                  />
                ))
              ) : (
                Array.from({ length: 25 }).map((_, i) => (
                  <View key={i} style={[styles.recWaveBar, { height: 3, opacity: 0.3 }]} />
                ))
              )}
            </View>
          </View>
          <Pressable
            style={styles.recSendBtn}
            onPress={stopAndSendRecording}
            disabled={sendingVoice}
          >
            {sendingVoice ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFF" />
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.inputBar}>
          <Pressable style={styles.inputAction} onPress={() => setShowEmojiPicker(v => !v)}>
            <Ionicons name={showEmojiPicker ? 'close-circle' : 'happy-outline'} size={22} color={Colors.teal} />
          </Pressable>
          <TextInput
            style={styles.textInput}
            placeholder="Mesaj yaz..."
            placeholderTextColor={Colors.text3}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            onFocus={() => setShowEmojiPicker(false)}
          />
          <Pressable style={styles.inputAction} onPress={async () => {
            try {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.7,
                allowsEditing: true,
              });
              if (result.canceled || !result.assets?.[0]) return;
              if (!firebaseUser || !id) return;

              const tempId = `temp_img_${Date.now()}`;
              const optimisticMsg: Message = {
                id: tempId, sender_id: firebaseUser.uid, receiver_id: id,
                content: '📷 Fotoğraf',
                is_read: false, created_at: new Date().toISOString(),
              };
              setMessages(prev => [...prev, optimisticMsg]);

              const imageUrl = await StorageService.uploadChatImage(firebaseUser.uid, result.assets[0].uri);
              // ★ FIX: image_url sütunu yok — URL'yi content içine göm
              const newMsg = await MessageService.send(firebaseUser.uid, id, `📷 ${imageUrl}`);
              setMessages(prev => prev.map(m => m.id === tempId ? newMsg : m));
              showToast({ title: '📷 Gönderildi', type: 'success' });
            } catch (err: any) {
              showToast({ title: 'Fotoğraf gönderilemedi', message: err.message || '', type: 'error' });
            }
          }}>
            <Ionicons name="attach" size={22} color={Colors.text3} />
          </Pressable>
          {/* 🎙️ Gel Odama Daveti */}
          {activeRoom && (
            <Pressable style={[styles.inputAction, { backgroundColor: 'rgba(20,184,166,0.1)', borderRadius: 20 }]} onPress={async () => {
              if (!firebaseUser || !id || !activeRoom) return;
              const inviteContent = `🎙️ Şu an "${activeRoom.name}" odasındayım! Gel katıl \u2192 soprano://room/${activeRoom.id}`;
              try {
                const newMsg = await MessageService.send(firebaseUser.uid, id, inviteContent);
                setMessages(prev => [...prev, newMsg]);
                showToast({ title: '🎙️ Davet gönderildi!', message: `${otherUser?.display_name || 'Kullanıcı'} odaya davet edildi`, type: 'success' });
              } catch {
                showToast({ title: 'Davet gönderilemedi', type: 'error' });
              }
            }}>
              <Ionicons name="radio" size={20} color={Colors.teal} />
            </Pressable>
          )}
          {inputText.trim() ? (
            <Pressable style={styles.sendBtn} onPress={handleSend} disabled={sending}>
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              style={styles.inputAction}
              onPress={startRecording}
              disabled={sendingVoice}
            >
              {sendingVoice ? (
                <ActivityIndicator size="small" color={Colors.teal} />
              ) : (
                <Ionicons name="mic" size={22} color={Colors.teal} />
              )}
            </Pressable>
          )}
        </View>
      )}

      {/* ★ Emoji Picker — inline keyboard-height panel */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={(emoji) => {
          setInputText(prev => prev + emoji);
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
      <PremiumAlert visible={cAlert.visible} title={cAlert.title} message={cAlert.message} type={cAlert.type||'info'} buttons={cAlert.buttons} onDismiss={()=>setCAlert(p=>({...p,visible:false}))} />
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
  chatImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },
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

  // ★ WhatsApp Tarzı Inline Ses Kaydı
  recCancelBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  recInlineCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 8,
  },
  recDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recTime: {
    fontSize: 14, fontWeight: '700', color: '#EF4444',
    fontVariant: ['tabular-nums'],
    minWidth: 36,
  },
  recWaveWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    gap: 2, height: 28,
  },
  recWaveBar: {
    width: 2.5, borderRadius: 1.5,
    backgroundColor: '#EF4444', minHeight: 3,
  },
  recSendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.teal,
    justifyContent: 'center', alignItems: 'center',
  },

  // ★ WhatsApp tarzı Cevapsız Arama Kartları
  missedCallSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  missedCallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  missedCallIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  missedCallInfo: {
    flex: 1,
  },
  missedCallTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  missedCallTime: {
    fontSize: 11,
    color: Colors.text3,
    marginTop: 2,
  },
  missedCallBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#22C55E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  missedCallBackText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});

// ★ MSG-6: Ses mesajı oynatıcı stilleri
const voiceStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 200,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 28,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(92,225,230,0.25)',
    minHeight: 3,
  },
  duration: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text3,
    fontVariant: ['tabular-nums'],
  },
});
