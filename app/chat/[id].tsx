import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Pressable, TextInput, FlatList, Platform, ActivityIndicator, Animated, Easing, NativeScrollEvent, NativeSyntheticEvent, Modal, Keyboard, Dimensions, KeyboardAvoidingView } from 'react-native';
import PremiumAlert, { type AlertButton } from '../../components/PremiumAlert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Radius } from '../../constants/theme';
import { safeGoBack } from '../../constants/navigation';
import { MessageService, ProfileService, type Message, type Profile } from '../../services/database';
import { supabase } from '../../constants/supabase';
import { CallService } from '../../services/call';
import { FriendshipService } from '../../services/friendship';
import { ModerationService } from '../../services/moderation';
import { EmojiPicker } from '../../components/EmojiPicker';
import { ReportModal } from '../../components/ReportModal';
import { showToast } from '../../components/Toast';
import { useAuth, useBadges, useUserProfileSheet } from '../_layout';
import StatusAvatar from '../../components/StatusAvatar';
import { StorageService } from '../../services/storage';
import * as ImagePicker from 'expo-image-picker';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import AppBackground from '../../components/AppBackground';
import PremiumLoader from '../../components/PremiumLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ★ SEC-MSG: Mesaj sanitizasyonu + flood koruması
const MSG_MAX_LENGTH = 2000;
const MSG_THROTTLE_MS = 500;
const UNICODE_JUNK = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
function sanitizeMessage(text: string): string {
  return text.replace(UNICODE_JUNK, '').substring(0, MSG_MAX_LENGTH);
}



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
      // ★ 2026-04-24 FIX: Playback öncesi audio session'ı playback moduna al.
      //   Kayıt (recording) modundan kaldığında cızırtı/statik ses çıkabiliyor.
      //   playThroughEarpieceAndroid:false → hoparlörden çıkar (earpiece tinny sound fix).
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
        shouldDuckAndroid: true,
      }).catch(() => {});

      if (isPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        return;
      }
      if (soundRef.current) {
        await soundRef.current.playFromPositionAsync(0);
        setIsPlaying(true);
        return;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: voiceUrl },
        { shouldPlay: true, isLooping: false },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          if (status.durationMillis) setTotalDur(Math.round(status.durationMillis / 1000));
          if (status.positionMillis && status.durationMillis) {
            setProgress(status.positionMillis / status.durationMillis);
          }
          if (status.didJustFinish) {
            // ★ 2026-04-24 FIX: Önce explicit pause + position reset — aksi halde bazı
            //   Android cihazlarda tekrar baştan playback tetikleniyor ("reels gibi loop").
            setIsPlaying(false);
            setProgress(0);
            soundRef.current?.pauseAsync()
              .then(() => soundRef.current?.setPositionAsync(0))
              .catch(() => {});
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

// ★ 2026-04-24: Medya + bağlantılar modalı — mesajlardan çıkarılan görsel/ses/URL listesi
function MediaLinksModal({ visible, messages, onClose, onImagePress }: {
  visible: boolean; messages: any[]; onClose: () => void; onImagePress: (uri: string) => void;
}) {
  const [tab, setTab] = useState<'media' | 'voice' | 'links'>('media');
  const URL_RE = /https?:\/\/[^\s]+/g;
  const images = messages.flatMap(m => {
    const arr: string[] = [];
    if (m.image_url) arr.push(m.image_url);
    if (m.content) {
      const match = m.content.match(/^📷\s+(https?:\/\/\S+)$/);
      if (match) arr.push(match[1]);
    }
    return arr;
  });
  const voices = messages.filter(m => m.voice_url).map(m => ({ url: m.voice_url!, duration: m.voice_duration, time: m.created_at }));
  const links: string[] = [];
  messages.forEach(m => {
    if (!m.content || m.voice_url || m.image_url) return;
    const matches = m.content.match(URL_RE);
    if (matches) links.push(...matches);
  });
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.mediaOverlay} onPress={onClose}>
        <Pressable style={styles.mediaSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.mediaHeader}>
            <Text style={styles.mediaTitle}>Medya ve Bağlantılar</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.text3} />
            </Pressable>
          </View>
          <View style={styles.mediaTabRow}>
            <Pressable style={[styles.mediaTab, tab === 'media' && styles.mediaTabActive]} onPress={() => setTab('media')}>
              <Text style={[styles.mediaTabText, tab === 'media' && styles.mediaTabTextActive]}>Medya ({images.length})</Text>
            </Pressable>
            <Pressable style={[styles.mediaTab, tab === 'voice' && styles.mediaTabActive]} onPress={() => setTab('voice')}>
              <Text style={[styles.mediaTabText, tab === 'voice' && styles.mediaTabTextActive]}>Ses ({voices.length})</Text>
            </Pressable>
            <Pressable style={[styles.mediaTab, tab === 'links' && styles.mediaTabActive]} onPress={() => setTab('links')}>
              <Text style={[styles.mediaTabText, tab === 'links' && styles.mediaTabTextActive]}>Linkler ({links.length})</Text>
            </Pressable>
          </View>
          {tab === 'media' && (
            images.length === 0 ? (
              <View style={styles.mediaEmpty}><Ionicons name="images-outline" size={32} color={Colors.text3} /><Text style={styles.mediaEmptyText}>Görsel yok</Text></View>
            ) : (
              <FlatList
                data={images}
                keyExtractor={(u, i) => `${i}-${u}`}
                numColumns={3}
                contentContainerStyle={styles.mediaGrid}
                renderItem={({ item }) => (
                  <Pressable onPress={() => onImagePress(item)}>
                    <Image source={{ uri: item }} style={styles.mediaGridImage} resizeMode="cover" />
                  </Pressable>
                )}
              />
            )
          )}
          {tab === 'voice' && (
            voices.length === 0 ? (
              <View style={styles.mediaEmpty}><Ionicons name="mic-outline" size={32} color={Colors.text3} /><Text style={styles.mediaEmptyText}>Ses kaydı yok</Text></View>
            ) : (
              <FlatList
                data={voices}
                keyExtractor={(v, i) => `${i}-${v.url}`}
                renderItem={({ item }) => (
                  <View style={styles.mediaListItem}>
                    <Ionicons name="mic" size={18} color={Colors.teal} />
                    <Text style={styles.mediaListText} numberOfLines={1}>{new Date(item.time).toLocaleString('tr-TR')}</Text>
                    <Text style={{ fontSize: 11, color: Colors.text3 }}>{item.duration ? `${item.duration}s` : ''}</Text>
                  </View>
                )}
              />
            )
          )}
          {tab === 'links' && (
            links.length === 0 ? (
              <View style={styles.mediaEmpty}><Ionicons name="link-outline" size={32} color={Colors.text3} /><Text style={styles.mediaEmptyText}>Bağlantı yok</Text></View>
            ) : (
              <FlatList
                data={links}
                keyExtractor={(u, i) => `${i}-${u}`}
                renderItem={({ item }) => (
                  <Pressable style={styles.mediaListItem} onPress={() => { try { require('expo-linking').openURL(item); } catch {} }}>
                    <Ionicons name="link" size={18} color={Colors.teal} />
                    <Text style={styles.mediaListText} numberOfLines={1}>{item}</Text>
                  </Pressable>
                )}
              />
            )
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ★ 2026-04-24 v2: Kebab dropdown — üstten aşağıya akıcı slide-down.
//   translateY -32 → 0 + opacity 0 → 1. setValue + requestAnimationFrame ile
//   ilk paint'te offscreen garanti edilir.
function KebabDropdown({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(-32)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      translateY.setValue(-32);
      opacity.setValue(0);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
      });
    }
  }, [visible]);
  return (
    <Animated.View style={[styles.kebabDropdown, { transform: [{ translateY }], opacity }]}>
      {children}
    </Animated.View>
  );
}

function MessageBubble({ message, isMe, senderAvatar, senderName, myAvatar, onDelete, onReport, onAction, onReaction, isReactionActive, onToggleReaction, onImagePress, onAvatarPress }: { message: Message; isMe: boolean; senderAvatar?: string; senderName?: string; myAvatar?: string; onDelete?: (msgId: string) => void; onReport?: (msgId: string) => void; onAction?: (buttons: any[]) => void; onReaction?: (msgId: string, emoji: string) => void; isReactionActive?: boolean; onToggleReaction?: (msgId: string | null) => void; onImagePress?: (uri: string) => void; onAvatarPress?: () => void }) {
  const time = new Date(message.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const customStyle = getChatColorStyle(message.sender?.active_chat_color);
  const isTemp = message.id.startsWith('temp_');
  const hasVoice = !!message.voice_url;
  const isDeleted = !!(message as any).is_deleted;
  const imageUrlFromContent = (() => {
    if (hasVoice || !message.content) return null;
    const match = message.content.match(/^📷\s+(https?:\/\/\S+)$/);
    return match ? match[1] : null;
  })();
  const hasImage = !!message.image_url || !!imageUrlFromContent;
  const imageUri = message.image_url || imageUrlFromContent;

  // ★ 2026-04-21: WhatsApp-tarzı emoji-only render — sadece emojilerden oluşan kısa mesajlar
  //   balonsuz ve büyük tipoda görünür. 1 emoji → 60px, 2-3 → 46px, 4+ → normal balon.
  const emojiOnlyMatch = !hasImage && !hasVoice && message.content
    ? message.content.trim().match(/^(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F\u20E3]){1,6}$/u)
    : null;
  const emojiCount = emojiOnlyMatch ? Array.from(message.content.trim()).filter(c => /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(c)).length : 0;
  const isEmojiOnly = !!emojiOnlyMatch && emojiCount >= 1 && emojiCount <= 3;
  const emojiFontSize = emojiCount === 1 ? 60 : emojiCount === 2 ? 50 : 42;

  // ★ Emoji tepkileri parse et
  const reactions: Record<string, string[]> = (message as any).reactions ? JSON.parse((message as any).reactions) : {};
  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  // ★ 2026-04-24: Daha kibar pop-in — overshoot yok, timing cubic ease-out.
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isReactionActive) {
      scaleAnim.setValue(0);
      Animated.timing(scaleAnim, { toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [isReactionActive]);

  // ★ 2026-04-24: Tap → sadece açık reaction barını kapat; long-press → reaction barını aç
  const handleTap = () => {
    if (isReactionActive) onToggleReaction?.(null);
  };

  const handleLongPress = () => {
    if (isTemp || isDeleted) return;
    onToggleReaction?.(message.id);
  };

  if (isDeleted) {
    return (
      <View style={[styles.bubbleWrap, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
        <View style={[styles.bubble, { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }]}>
          <Text style={[styles.bubbleText, { color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }]}>🚫 Bu mesaj silindi</Text>
        </View>
        <View style={[styles.timeRow, isMe && styles.timeRowRight]}>
          <Text style={styles.bubbleTime}>{time}</Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable onPress={handleTap} onLongPress={handleLongPress} delayLongPress={400}>
    <View style={[styles.bubbleWrap, isMe ? styles.bubbleRight : styles.bubbleLeft, Object.keys(reactions).length > 0 && { marginBottom: 10 }]}>
      {/* ★ Emoji Reaction Bar — tek seferde sadece 1 mesajda, animasyonlu */}
      {isReactionActive && (
        <Animated.View style={[
          styles.reactionBar,
          isMe ? styles.reactionBarRight : styles.reactionBarLeft,
          { transform: [{ scale: scaleAnim }], opacity: scaleAnim },
        ]}>
          {QUICK_EMOJIS.map((emoji, idx) => (
            <Pressable
              key={emoji}
              style={styles.reactionEmoji}
              onPress={() => {
                onReaction?.(message.id, emoji);
                onToggleReaction?.(null);
              }}
            >
              <Text style={styles.reactionEmojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </Animated.View>
      )}
      {/* ★ 2026-04-26: Avatar tıklanınca profil sheet — diğer platformlardaki gibi standart davranış. */}
      <Pressable
        style={styles.bubbleAvatarRow}
        onPress={() => { if (!isMe && onAvatarPress) onAvatarPress(); }}
        hitSlop={6}
      >
        <StatusAvatar uri={isMe ? myAvatar : senderAvatar} size={34} />
      </Pressable>
      {isEmojiOnly ? (
        <View style={{ paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: emojiFontSize, lineHeight: emojiFontSize * 1.1, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 }}>
            {message.content}
          </Text>
        </View>
      ) : (
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther, customStyle]}>
          {hasImage && !hasVoice ? (
            <Pressable onPress={() => onImagePress?.(imageUri!)}>
              <Image source={{ uri: imageUri! }} style={styles.chatImage} resizeMode="cover" />
            </Pressable>
          ) : null}
          {hasVoice ? (
            <VoiceMessagePlayer voiceUrl={message.voice_url!} duration={message.voice_duration || undefined} isMe={isMe} />
          ) : !hasImage && message.content ? (
            <Text style={styles.bubbleText}>{message.content}</Text>
          ) : null}
        </View>
      )}
      {/* ★ Emoji tepkileri göster — balon stilinde */}
      {Object.keys(reactions).length > 0 && (
        <View style={[styles.reactionDisplay, isMe ? styles.reactionDisplayRight : styles.reactionDisplayLeft]}>
          {Object.entries(reactions).map(([emoji, users]) => (
            <Pressable
              key={emoji}
              style={styles.reactionPill}
              onPress={() => onReaction?.(message.id, emoji)}
            >
              <Text style={styles.reactionPillEmoji}>{emoji}</Text>
              {users.length > 1 && <Text style={styles.reactionPillCount}>{users.length}</Text>}
            </Pressable>
          ))}
        </View>
      )}
      <View style={[styles.timeRow, isMe && styles.timeRowRight]}>
        <Text style={styles.bubbleTime}>{time}</Text>
        {isMe && (
          <View style={styles.tickWrap}>
            {isTemp ? (
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.3)" style={styles.iconShadow} />
            ) : message.is_read ? (
              <View style={styles.doubleTick}>
                <Ionicons name="checkmark" size={13} color="#34B7F1" style={[styles.iconShadow, { marginRight: -6 }]} />
                <Ionicons name="checkmark" size={13} color="#34B7F1" style={styles.iconShadow} />
              </View>
            ) : (
              <Ionicons name="checkmark" size={13} color="rgba(255,255,255,0.45)" style={styles.iconShadow} />
            )}
          </View>
        )}
      </View>
    </View>
    </Pressable>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { firebaseUser, profile, refreshProfile, minimizedRoom } = useAuth();
  const { openUserProfile } = useUserProfileSheet();
  const insets = useSafeAreaInsets();
  // ★ 2026-04-24 v2: Chat mount+loaded slide-down — loading bitince içerik üstten akarak iner.
  const contentTranslateY = useRef(new Animated.Value(-80)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const { refreshBadges } = useBadges();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isCallingInProgress, setIsCallingInProgress] = useState(false); // ★ CALL-4: Çift tıklama koruması
  // ★ 2026-04-27: isFriend (one-way takip) kaldırıldı — call button artık isMutualFollow kullanıyor.
  const [isMutualFollow, setIsMutualFollow] = useState(false); // ★ DM-8: Karşılıklı takip kontrolü
  const [isMessageRequest, setIsMessageRequest] = useState(false); // ★ DM-8: Mesaj isteği modu
  // ★ 2026-04-22: Instagram-style message request durumu (friendship accepted DEĞİLKEN kullanılır)
  const [msgRequestInfoRaw, setMsgRequestInfoRaw] = useState<{ status: 'none' | 'pending_incoming' | 'pending_outgoing' | 'accepted' | 'rejected' }>({ status: 'none' });
  // ★ 2026-04-27: Effective status — mutual arkadaşsa eski pending/rejected kayıt UI'da yok sayılır.
  //   Service tarafı zaten mutual'da request akışını atlıyor (services/messages.ts), ama eskiden
  //   pending kalmış bir kayıt UI'da hâlâ "Onay bekleniyor" banner'ı çıkartıyordu — tutarsızlık.
  const msgRequestInfo = isMutualFollow ? { status: 'accepted' as const } : msgRequestInfoRaw;
  const setMsgRequestInfo = setMsgRequestInfoRaw;
  const [respondingRequest, setRespondingRequest] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // ★ 2026-04-23: RoomChatDrawer pattern — input bar'ı klavyenin üstüne sabitle (Clubhouse).
  // MiniRoomCard global overlay (z:999) DM üstünde durduğu için, oda minimize iken
  // input bar'ı MiniRoomCard'ın da üstüne çıkar (aksi halde oda çubuğu input'u örter).
  // ★ 2026-04-24: Mini card chat UI'sini etkilemez — sadece overlay pop olarak durur.
  //   Input bar her zaman ekranın altında kalır; mini card gerekirse üstüne biner.
  const miniRoomOffset = 0;
  const inputBottomAnim = useRef(new Animated.Value(miniRoomOffset)).current;
  // ★ 2026-04-24: kbHeight state — FlatList paddingBottom klavyeye göre artar → scroll alanı açılır.
  const [kbHeight, setKbHeight] = useState(0);
  // ★ 2026-04-27: FlatList marginBottom yaklaşımına geçildi (input bar ile çakışma yok).
  //   Default 90 — gerçek input bar'a yakın (gesture nav telefonda ~80-100px). onLayout ile güncellenir.
  //   İlk render'da çok büyük (150) → re-layout sırasında scroll pozisyonu kaymasına yol açıyordu.
  const [inputBarHeight, setInputBarHeight] = useState(90);
  useEffect(() => {
    inputBottomAnim.setValue(miniRoomOffset);
  }, [miniRoomOffset]);
  // ★ 2026-04-27: inputBar yüksekliği değişince (multi-line yazma vb.) en alttaysa scroll'u eşitle.
  useEffect(() => {
    if (isAtBottomRef.current) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 30);
    }
  }, [inputBarHeight]);
  useEffect(() => {
    // ★ 2026-04-27 FIX: Android'de AndroidManifest.xml'de windowSoftInputMode="adjustResize"
    //   zaten aktif — sistem klavye açılınca pencereyi küçültür, input bar otomatik kayar.
    //   Manuel offset uygulamak ÇİFT kayma yapar (klavyeden uzak gap görünür).
    // ★ 2026-04-28 FIX: Android'de keyboardDidShow listener ile sadece scrollToEnd tetikleniyor —
    //   adjustResize FlatList viewport'unu küçültüyor ama scroll pozisyonu eski kalıyor,
    //   son mesaj input bar'ın altında gizli kalıyordu. Manuel paddingBottom yine yok (adjustResize hallediyor).
    if (Platform.OS === 'android') {
      const showAndroid = Keyboard.addListener('keyboardDidShow', () => {
        // Viewport küçüldü, en alta kay — son mesaj input bar üstünde görünür
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
      });
      const hideAndroid = Keyboard.addListener('keyboardDidHide', () => {
        // Klavye kapandı, viewport büyüdü — yine en alta kay (kullanıcı isAtBottom ise)
        if (isAtBottomRef.current) {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
        }
      });
      return () => { showAndroid.remove(); hideAndroid.remove(); };
    }
    // iOS: Sistem resize yapmaz, manuel offset gerekli.
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      setKbHeight(e.endCoordinates.height);
      Animated.timing(inputBottomAnim, { toValue: e.endCoordinates.height, duration: 250, useNativeDriver: false }).start();
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setKbHeight(0);
      Animated.timing(inputBottomAnim, { toValue: miniRoomOffset, duration: 200, useNativeDriver: false }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [miniRoomOffset]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const isAtBottomRef = useRef(true); // ★ BUG-6 FIX: Kullanıcı en altta mı?
  // ★ 2026-04-26: İlk açılışta otomatik en alta scroll (son mesaj görünür) — bir kez tetiklenir.
  const initialScrolledRef = useRef(false);
  // ★ 2026-04-24: Kendi gönderdiğim mesajdan sonra onContentSizeChange'de
  //   isAtBottomRef'i bypass edip daima en alta kayacağını işaret eder.
  const justSentRef = useRef(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [cAlert, setCAlert] = useState<{visible:boolean;title:string;message:string;type?:any;buttons?:AlertButton[]}>({visible:false,title:'',message:''});
  const [activeRoom, setActiveRoom] = useState<{id: string; name: string} | null>(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null); // ★ Tek seferde tek emoji bar
  const [showKebabMenu, setShowKebabMenu] = useState(false); // ★ Kebab menü
  const [showMessageSearch, setShowMessageSearch] = useState(false); // ★ Sohbet içi arama
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [showMediaDrawer, setShowMediaDrawer] = useState(false); // ★ Medya + bağlantılar
  const [isMuted, setIsMuted] = useState(false); // ★ Sessize al
  const [isBlocked, setIsBlocked] = useState(false); // ★ Engel durumu
  const [viewerImage, setViewerImage] = useState<string | null>(null); // ★ Tam ekran görsel

  // ★ Cevapsız Arama State (WhatsApp tarzı)
  type MissedCall = { id: string; callType: 'audio'; time: string; callerName: string };
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);

  // ─── Ses Notu ────────────────────────────────────────
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]); // ★ MSG-5: Dalga formu verisi
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const recordingRef = useRef<Audio.Recording | null>(null); // ★ Ref to track recording outside stale closures

  const startRecording = async () => {
    try {
      // ★ FIX: İzni tekrar sormak yerine mevcut durumu kontrol et — izin zaten _layout.tsx'te istendi
      const perm = await Audio.getPermissionsAsync();
      if (!perm.granted) {
        showToast({ title: 'Mikrofon izni gerekli', message: 'Ayarlar → Uygulamalar → SopranoChat → İzinler\'den mikrofonu açın', type: 'warning' });
        return;
      }

      // ★ Agresif cleanup — önceki recording'i tamamen temizle
      const prev = recordingRef.current || recording;
      if (prev) {
        try { await prev.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
        setRecording(null);
      }
      // Audio modunu sıfırla — "Only one Recording" hatasını kesinlikle önler
      try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}
      await new Promise(r => setTimeout(r, 100));

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      await new Promise(r => setTimeout(r, 150));

      const recordingOptions = Audio.RecordingOptionsPresets.HIGH_QUALITY;
      const { recording: rec } = await Audio.Recording.createAsync(
        recordingOptions,
        (status) => {
          if (status.isRecording && status.metering !== undefined) {
            const normalized = Math.min(1, Math.max(0, (status.metering + 50) / 50));
            setWaveformData(prev => [...prev.slice(-40), normalized]);
          }
        },
        100
      );
      recordingRef.current = rec;
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
      if (__DEV__) console.error('Recording error:', err);
      setIsRecording(false);
      setRecording(null);
      recordingRef.current = null;
    }
  };

  const cancelRecording = async () => {
    if (voiceTimerRef.current) { clearInterval(voiceTimerRef.current); voiceTimerRef.current = null; }
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    const rec = recordingRef.current || recording;
    if (rec) {
      try { await rec.stopAndUnloadAsync(); } catch {}
    }
    recordingRef.current = null;
    setRecording(null);
    setIsRecording(false);
    setVoiceDuration(0);
    setWaveformData([]);
    try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}
  };

  const stopAndSendRecording = async () => {
    const currentRecording = recordingRef.current || recording;
    if (!currentRecording || !firebaseUser || !id) return;
    if (voiceTimerRef.current) { clearInterval(voiceTimerRef.current); voiceTimerRef.current = null; }
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);

    const currentDuration = voiceDuration;
    recordingRef.current = null;
    setRecording(null);
    setIsRecording(false);
    setSendingVoice(true);

    try {
      await currentRecording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = currentRecording.getURI();

      if (!uri) { showToast({ title: 'Ses kaydı alınamadı', type: 'error' }); return; }

      const voiceUrl = await StorageService.uploadVoiceNote(firebaseUser.uid, uri);
      const newMsg = await MessageService.send(firebaseUser.uid, id, '🎙️ Sesli mesaj', isMessageRequest ? true : undefined, voiceUrl, currentDuration);
      setMessages(prev => [...prev, newMsg]);
      setWaveformData([]);
    } catch (err: any) {
      if (__DEV__) console.error('Voice send error:', err);
      showToast({ title: 'Sesli mesaj gönderilemedi', message: err?.message || '', type: 'error' });
    } finally {
      setSendingVoice(false);
      setVoiceDuration(0);
    }
  };

  // ★ Cleanup recording + timer on unmount — "Only one Recording" hatasını önler
  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      const rec = recordingRef.current;
      if (rec) {
        rec.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
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
      // ★ 2026-04-28: 2 aşamalı yükleme — kritik (blok+profil+mesajlar+cleared) ÖNCE paralel,
      //   spinner kalkar. Detaylar (oda/takip/istek/markRead/missed/mute) arka planda paralel.
      //   Eski sıralı 11 await ~1-3sn sürerken artık ~300-500ms (en yavaş kritik sorgunun süresi).
      try {
        // ── Aşama 1: KRİTİK paralel — UI gözükmeden zorunlu ──
        const [isBlockedByMe, isBlockedByThem, profile, history, clearedMap] = await Promise.all([
          ModerationService.isBlocked(firebaseUser.uid, id).catch(() => false),
          ModerationService.isBlocked(id, firebaseUser.uid).catch(() => false),
          ProfileService.get(id).catch(() => null),
          MessageService.getConversation(firebaseUser.uid, id, 50).catch(() => [] as Message[]),
          MessageService.getClearedBefore(firebaseUser.uid).catch(() => ({} as Record<string, string>)),
        ]);

        if (isBlockedByMe || isBlockedByThem) {
          showToast({ title: '⛔ Erişim Engellendi', message: 'Bu kullanıcıyla mesajlaşamazsınız.', type: 'error' });
          router.back();
          return;
        }

        setOtherUser(profile);

        const clearedBefore = clearedMap[id];
        const filteredHistory = clearedBefore
          ? history.filter(m => new Date(m.created_at) > new Date(clearedBefore))
          : history;
        setMessages(filteredHistory);

        // İlk yüklemede en alta scroll — multiple attempts (FlatList content size birden fazla kez değişir)
        if (!initialScrolledRef.current) {
          initialScrolledRef.current = true;
          requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: false }));
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 500);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 900);
        }

        setLoading(false); // ★ Spinner KAPANIR — UI dolar, detaylar arka planda gelir.

        // ── Aşama 2: DETAYLAR paralel arka plan — UI zaten render ──
        Promise.all([
          // Aktif odadaysa davet butonu göster
          supabase
            .from('room_participants')
            .select('room_id, rooms!inner(id, name)')
            .eq('user_id', firebaseUser.uid)
            .limit(1)
            .single()
            .then(({ data }) => {
              if (data?.rooms) setActiveRoom({ id: (data.rooms as any).id, name: (data.rooms as any).name });
            })
            .catch(() => {}),

          // CALL-1 + DM-8: Takipçi kontrolü
          FriendshipService.getDetailedStatus(firebaseUser.uid, id)
            .then(detailed => {
              const meFollowsThem = detailed.outgoing === 'accepted';
              const theyFollowMe = detailed.incoming === 'accepted';
              // ★ 2026-04-27 KRİTİK FIX: friendships TEK YÖNLÜ kayıt — A→B accepted yeterli (resmi
              // FriendshipService.isFriend() OR kullanıyor). Eski AND her gerçek arkadaşı "değil"
              // sayıp mesaj request bariyerine takıyordu. Şimdi: ikisinden biri accepted → arkadaş.
              const friend = meFollowsThem || theyFollowMe;
              setIsMutualFollow(friend);
              setIsMessageRequest(!friend);
            })
            .catch(() => { setIsMutualFollow(false); setIsMessageRequest(true); }),

          // message_requests durumu (Instagram flow)
          MessageService.getMessageRequest(firebaseUser.uid, id)
            .then(req => {
              if (!req) setMsgRequestInfo({ status: 'none' });
              else if (req.status === 'accepted') setMsgRequestInfo({ status: 'accepted' });
              else if (req.status === 'rejected') setMsgRequestInfo({ status: 'rejected' });
              else if (req.status === 'pending') setMsgRequestInfo({ status: req.receiver_id === firebaseUser.uid ? 'pending_incoming' : 'pending_outgoing' });
            })
            .catch(() => setMsgRequestInfo({ status: 'none' })),

          // markAsRead + cevapsız arama notifications okundu + missed calls list
          (async () => {
            await MessageService.markAsRead(firebaseUser.uid, id).catch(() => {});
            await supabase
              .from('notifications')
              .update({ is_read: true })
              .eq('user_id', firebaseUser.uid)
              .eq('sender_id', id)
              .eq('type', 'missed_call')
              .eq('is_read', false)
              .then(() => {}, () => {});
            refreshBadges();
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
                callType: 'audio' as const,
                time: mc.created_at,
                callerName: mc.sender?.display_name || 'Kullanıcı',
              })));
            }
          })().catch(() => {}),

          // Mute durumu
          AsyncStorage.getItem(`mute_chat_${firebaseUser.uid}_${id}`)
            .then(val => setIsMuted(val === 'true'))
            .catch(() => {}),
        ]);
      } catch (err) {
        if (__DEV__) console.warn('Sohbet yüklenemedi:', err);
        setLoading(false);
      }
    };

    loadChat();

    // Realtime yeni mesaj dinleyici
    const channel = MessageService.onNewMessage(firebaseUser.uid, `chat_${id}`, (newMsg) => {
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
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
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

    // ★ 2026-04-24 FIX: message_requests realtime — karşı taraf accept/reject ettiğinde
    //   sayfa yenilenmeden anında banner güncellensin.
    const msgReqChannelName = `msg_req_${firebaseUser.uid}_${id}`;
    const msgReqChannel = supabase
      .channel(msgReqChannelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_requests',
        },
        (payload: any) => {
          const row = payload.new;
          // Bu sohbet ile ilgili mi kontrol et
          const isRelevant =
            (row.sender_id === firebaseUser.uid && row.receiver_id === id) ||
            (row.sender_id === id && row.receiver_id === firebaseUser.uid);
          if (!isRelevant) return;

          if (row.status === 'accepted') {
            setMsgRequestInfo({ status: 'accepted' });
          } else if (row.status === 'rejected') {
            setMsgRequestInfo({ status: 'rejected' });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      typingChannel.unsubscribe();
      supabase.removeChannel(readChannel); // ★ BUG-8 FIX: removeChannel ile tam temizlik
      supabase.removeChannel(msgReqChannel); // ★ message_requests realtime cleanup
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

  // ★ SEC-FLOOD: Son gönderim zamanı — throttle için
  const lastSendRef = useRef(0);

  const handleSend = async () => {
    if (!inputText.trim() || !firebaseUser || !id) return;

    // ★ SEC-FLOOD: 500ms throttle — flood engeli
    const now = Date.now();
    if (now - lastSendRef.current < MSG_THROTTLE_MS) {
      return;
    }
    lastSendRef.current = now;

    // ★ SEC-MSG: Sanitize + trim
    const content = sanitizeMessage(inputText.trim());
    if (!content) return;
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
    // ★ 2026-04-24: Gönderdikten sonra daima en alta kay — onContentSizeChange
    //   tick'inde justSent flag'ı isAtBottomRef'i bypass ediyor, böylece kullanıcı
    //   üste kaydırmış olsa bile kendi mesajı görünür.
    justSentRef.current = true;
    isAtBottomRef.current = true;
    requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }));
    
    // Yazıyor... bilgisini kapat
    MessageService.sendTypingStatus(firebaseUser.uid, id, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      const newMsg = await MessageService.send(firebaseUser.uid, id, content);
      // Geçici mesajı gerçek veritabanı ID'li mesaj ile değiştir
      setMessages(prev => prev.map(m => m.id === tempId ? newMsg : m));
      // ★ 2026-04-22: İlk mesaj atılınca request pending_outgoing olur (mutual follow yoksa)
      if (!isMutualFollow && msgRequestInfo.status === 'none') {
        setMsgRequestInfo({ status: 'pending_outgoing' });
      }
      // ★ 2026-04-22 FIX: Kullanıcı yeni mesaj gönderdi → hidden entry temizle (inbox'ta
      //   sohbet tekrar görünür olsun). Sadece ekran açılırken temizleme YOK — oraya girmek
      //   silinmişi geri getirmemeli.
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const key = `hidden_conversations_${firebaseUser.uid}`;
        const raw = await AsyncStorage.getItem(key);
        const map: Record<string, string> = raw ? JSON.parse(raw) : {};
        if (map[id]) {
          delete map[id];
          await AsyncStorage.setItem(key, JSON.stringify(map));
        }
      } catch {}
    } catch (err: any) {
      if (__DEV__) console.error('Mesaj gönderilemedi:', err);
      // Hata durumunda mesajı listeden çıkar ve geri metin kutusuna koy
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInputText(content);
      const msg = err?.message || 'Mesaj gönderilemedi';
      showToast({ title: 'Gönderilemedi', message: msg, type: 'warning' });
    } finally {
      setSending(false);
    }
  };

  // ★ 2026-04-24 v2: Loading bitince slide-down tetikle
  useEffect(() => {
    if (!loading) {
      contentTranslateY.setValue(-80);
      contentOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(contentTranslateY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    }
  }, [loading]);

  if (loading) {
    return (
      <AppBackground radialGlow>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <PremiumLoader size={56} />
        </View>
      </AppBackground>
    );
  }


  return (
    <AppBackground radialGlow>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
    <Animated.View style={[styles.container, { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }]}>

      {/* Header — Ana sayfadaki banner ile aynı (bombe gradient + teal separator) */}
      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['rgba(48,65,94,0.92)', 'rgba(26,40,64,0.82)', 'rgba(12,22,40,0.6)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack(router)} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} style={styles.iconShadow} />
        </Pressable>
        {/* ★ UX-NAV: Avatar + isim alanına basınca profil sayfasına git */}
        <Pressable onPress={() => openUserProfile(id as string)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <StatusAvatar uri={otherUser?.avatar_url} size={36} isOnline={otherUser?.is_online} tier={otherUser?.subscription_tier} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{otherUser?.display_name || 'Kullanıcı'}</Text>
          <View style={styles.onlineRow}>
            {isTyping ? (
              <>
                <Text style={styles.typingHeaderText}>yazıyor</Text>
                <Text style={styles.typingDots}>…</Text>
              </>
            ) : otherUser?.is_online ? (
              <>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Çevrimiçi</Text>
              </>
            ) : (
              <Text style={styles.offlineText}>
                {otherUser?.last_seen
                  ? `Son görülme: ${new Date(otherUser.last_seen).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Çevrimdışı'}
              </Text>
            )}
          </View>
          </View>
        </Pressable>
        {/* ★ 2026-04-27: Arama butonu yeniden kurgulandı.
              Eski: isFriend (tek yönlü takip yeterliydi → mesaj request pending iken bile arama açılıyordu, BUG)
              Yeni: canCall = karşılıklı takip + mesajlaşma kabul/none. Şartlar yoksa BUTON GİZLİ (sadece dim değil).
              Mantık: Yazı için onay/red akışı varken sesli/görüntülü arama açık olamaz — tezat yaratıyor. */}
        {!loading && otherUser && (() => {
          const canCall = isMutualFollow
            && (msgRequestInfo.status === 'accepted' || msgRequestInfo.status === 'none');
          return (
          <View style={styles.headerActions}>
            {canCall && (
            <Pressable
              style={[styles.headerAction, isCallingInProgress && { opacity: 0.35 }]}
              disabled={isCallingInProgress}
              onPress={async () => {
                if (!firebaseUser || !id || isCallingInProgress) return;
                setIsCallingInProgress(true);
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
              <Ionicons name="call" size={20} color={Colors.teal} style={styles.iconShadow} />
            </Pressable>
            )}
            {/* ★ Kebab menü butonu — her zaman görünür */}
            <Pressable
              style={styles.kebabBtn}
              onPress={() => setShowKebabMenu(true)}
              hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={Colors.text} style={styles.iconShadow} />
            </Pressable>
          </View>
          );
        })()}
      </View>
        <LinearGradient
          colors={['transparent', 'rgba(20,184,166,0.55)', 'rgba(20,184,166,0.55)', 'transparent']}
          locations={[0, 0.25, 0.75, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.headerSeparator}
        />
      </View>

      {/* ★ 2026-04-24: Sohbet içi arama bar */}
      {showMessageSearch && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={Colors.text3} />
          <TextInput
            style={styles.searchInput}
            placeholder="Mesajlarda ara..."
            placeholderTextColor={Colors.text3}
            value={messageSearchQuery}
            onChangeText={setMessageSearchQuery}
            autoFocus
          />
          <Pressable onPress={() => { setShowMessageSearch(false); setMessageSearchQuery(''); }} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.text3} />
          </Pressable>
        </View>
      )}

      {/* ★ 2026-04-27: Strict policy — eski mesaj isteği banner'ları (pending_incoming/outgoing/rejected)
            kaldırıldı. Yabancılara mesajlaşma kapalı; tek banner var: "Önce arkadaş ol" (aşağıda). */}

      {/* ★ 2026-04-27 STRICT: Arkadaş değilse mesajlaşma kapalı — net uyarı banner */}
      {!loading && !isMutualFollow && (
        <View style={[styles.msgRequestBanner, { backgroundColor: 'rgba(251,191,36,0.10)' }]}>
          <View style={styles.msgRequestBannerInner}>
            <Ionicons name="lock-closed-outline" size={16} color="#FBBF24" />
            <Text style={[styles.msgRequestDesc, { color: '#FCD34D' }]}>
              {otherUser?.display_name || 'Bu kullanıcı'} ile arkadaş olmadığın için mesajlaşamazsın. Profilinden arkadaş ekle.
            </Text>
          </View>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={showMessageSearch && messageSearchQuery.trim() ? messages.filter(m => (m.content || '').toLowerCase().includes(messageSearchQuery.trim().toLowerCase())) : messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isMe={item.sender_id === firebaseUser?.uid}
            senderAvatar={item.sender_id !== firebaseUser?.uid ? otherUser?.avatar_url || '' : undefined}
            senderName={item.sender_id !== firebaseUser?.uid ? otherUser?.display_name || '' : undefined}
            myAvatar={profile?.avatar_url || ''}
            isReactionActive={activeReactionMsgId === item.id}
            onToggleReaction={setActiveReactionMsgId}
            onAvatarPress={() => { if (id) openUserProfile(id as string); }}
            onDelete={async (msgId) => {
              try {
                await MessageService.deleteMessage(msgId, firebaseUser!.uid);
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true } as any : m));
              } catch {
                showToast({ title: 'Mesaj silinemedi', type: 'error' });
              }
            }}
            onReport={(msgId) => {
              setReportMessageId(msgId);
              setShowReportModal(true);
            }}
            onAction={(buttons) => {
              setCAlert({ visible: true, title: 'Mesaj Seçenekleri', message: '', type: 'info', buttons });
            }}
            onReaction={async (msgId, emoji) => {
              if (!firebaseUser) return;
              try {
                const msg = messages.find(m => m.id === msgId);
                const existing: Record<string, string[]> = (msg as any)?.reactions ? JSON.parse((msg as any).reactions) : {};
                
                const myId = firebaseUser.uid;
                if (existing[emoji]?.includes(myId)) {
                  existing[emoji] = existing[emoji].filter(id => id !== myId);
                  if (existing[emoji].length === 0) delete existing[emoji];
                } else {
                  if (!existing[emoji]) existing[emoji] = [];
                  existing[emoji].push(myId);
                }
                
                const reactionsJson = JSON.stringify(existing);
                await MessageService.updateReaction(msgId, reactionsJson);
                setMessages(prev => prev.map(m =>
                  m.id === msgId ? { ...m, reactions: reactionsJson } as any : m
                ));
              } catch (err) {
                if (__DEV__) console.warn('[Chat] Emoji tepki hatası:', err);
              }
            }}
            onImagePress={(uri) => setViewerImage(uri)}
          />
        )}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => {
          // ★ Kendi gönderdiğimde (justSent) daima en alta — aksi halde sadece zaten altta iken.
          if (justSentRef.current || isAtBottomRef.current) {
            justSentRef.current = false;
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
          }
        }}
        onLayout={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100)}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          // ★ 2026-04-26: Eşik 40 → 200 (yumuşak otomatik scroll). Kullanıcı son ~3 mesaj görece altta ise yeni mesajda alta kayar.
          const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
          isAtBottomRef.current = isBottom;
          // ★ Scroll edince emoji bar'ı kapat
          if (activeReactionMsgId) setActiveReactionMsgId(null);
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
                        name="call"
                        size={16}
                        color="#EF4444"
                      />
                    </View>
                    <View style={styles.missedCallInfo}>
                      <Text style={styles.missedCallTitle}>
                        Cevapsız sesli arama
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
                      <Ionicons name="call" size={16} color="#fff" />
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

      {/* ★ 2026-04-27: Input Bar artık normal flex flow'da (absolute KALDIRILDI).
          Eski absolute + paddingBottom hack yaklaşımı son mesajın altta kalmasına sebep oluyordu.
          Yeni: container column flex, input bar doğal yüksekliği kadar yer kaplar; FlatList flex:1 ile
          KENDİLİĞİNDEN üstünde kalır. Android adjustResize klavye için yeterli. iOS için Animated bottom
          gerekiyor ama Android'de kullanıcı, iOS sonra. */}
      <Animated.View
        style={{ backgroundColor: '#0F172A', zIndex: 10 }}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - inputBarHeight) > 2) setInputBarHeight(h);
        }}
      >
      {/* ★ 2026-04-24: Input bar banner — üst headar ile tutarlı (teal separator üstte, bombe gradient) */}
      <LinearGradient
        colors={['rgba(12,22,40,0.95)', 'rgba(26,40,64,0.98)', 'rgba(48,65,94,1)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(20,184,166,0.55)', 'rgba(20,184,166,0.55)', 'transparent']}
        locations={[0, 0.25, 0.75, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 }}
        pointerEvents="none"
      />
      {isRecording ? (
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom + 6, 20)}]}>
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
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom + 6, 20)}, !isMutualFollow && { opacity: 0.4 }]} pointerEvents={!isMutualFollow ? 'none' : 'auto'}>
          <Pressable style={styles.inputAction} onPress={() => setShowEmojiPicker(v => !v)}>
            <Ionicons name={showEmojiPicker ? 'close-circle' : 'happy-outline'} size={22} color={Colors.teal} style={styles.iconShadow} />
          </Pressable>
          <TextInput
            style={styles.textInput}
            placeholder={!isMutualFollow ? 'Önce arkadaş olmalısın' : 'Mesaj yaz...'}
            placeholderTextColor={Colors.text3}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={MSG_MAX_LENGTH}
            onFocus={() => setShowEmojiPicker(false)}
            editable={isMutualFollow}
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
            } catch (err: any) {
              showToast({ title: 'Fotoğraf gönderilemedi', message: err.message || '', type: 'error' });
            }
          }}>
            <Ionicons name="attach" size={22} color={Colors.text3} style={styles.iconShadow} />
          </Pressable>
          {/* 🎙️ Gel Odama Daveti */}
          {activeRoom && (
            <Pressable style={[styles.inputAction, { backgroundColor: 'rgba(20,184,166,0.1)', borderRadius: 20 }]} onPress={async () => {
              if (!firebaseUser || !id || !activeRoom) return;
              const inviteContent = `🎙️ Şu an "${activeRoom.name}" odasındayım! Gel katıl \u2192 soprano://room/${activeRoom.id}`;
              try {
                const newMsg = await MessageService.send(firebaseUser.uid, id, inviteContent);
                setMessages(prev => [...prev, newMsg]);
              } catch {
                showToast({ title: 'Davet gönderilemedi', type: 'error' });
              }
            }}>
              <Ionicons name="radio" size={20} color={Colors.teal} style={styles.iconShadow} />
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
                <Ionicons name="mic" size={22} color={Colors.teal} style={styles.iconShadow} />
              )}
            </Pressable>
          )}
        </View>
      )}

      {/* ★ Emoji Picker — input bar wrapper'ının içinde (bar'ın altında) inline panel */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={(emoji) => {
          setInputText(prev => prev + emoji);
        }}
      />
      </Animated.View>

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

      {/* ★ Kebab Menü Modal */}
      <Modal
        visible={showKebabMenu}
        transparent
        animationType="none"
        onRequestClose={() => setShowKebabMenu(false)}
      >
        <Pressable style={[styles.kebabOverlay, { paddingTop: insets.top + 44 }]} onPress={() => setShowKebabMenu(false)}>
          <KebabDropdown visible={showKebabMenu}>
            {/* ★ 2026-04-24: Kişiyi görüntüle */}
            <Pressable
              style={styles.kebabItem}
              onPress={() => {
                setShowKebabMenu(false);
                openUserProfile(id as string);
              }}
            >
              <Ionicons name="person-outline" size={20} color={Colors.text2} />
              <Text style={styles.kebabItemText}>Kişiyi Görüntüle</Text>
            </Pressable>
            {/* ★ Ara */}
            <Pressable
              style={styles.kebabItem}
              onPress={() => {
                setShowKebabMenu(false);
                setShowMessageSearch(true);
              }}
            >
              <Ionicons name="search-outline" size={20} color={Colors.text2} />
              <Text style={styles.kebabItemText}>Ara</Text>
            </Pressable>
            {/* ★ Medya ve bağlantılar */}
            <Pressable
              style={styles.kebabItem}
              onPress={() => {
                setShowKebabMenu(false);
                setShowMediaDrawer(true);
              }}
            >
              <Ionicons name="images-outline" size={20} color={Colors.text2} />
              <Text style={styles.kebabItemText}>Medya ve Bağlantılar</Text>
            </Pressable>
            {/* Sohbeti Sil */}
            <Pressable
              style={styles.kebabItem}
              onPress={async () => {
                setShowKebabMenu(false);
                setCAlert({
                  visible: true,
                  title: 'Sohbeti Sil',
                  message: 'Bu sohbet geçmişi silinecek. Bu işlem geri alınamaz.',
                  type: 'warning',
                  buttons: [
                    {
                      text: 'Sil',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await MessageService.deleteConversation(firebaseUser!.uid, id);
                          setMessages([]);
                        } catch {}
                      },
                    },
                    { text: 'Vazgeç', style: 'cancel' },
                  ],
                });
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.kebabItemText, { color: '#EF4444' }]}>Sohbeti Sil</Text>
            </Pressable>

            {/* Sessize Al / Sesini Aç */}
            <Pressable
              style={styles.kebabItem}
              onPress={async () => {
                setShowKebabMenu(false);
                try {
                  const muteKey = `mute_chat_${firebaseUser!.uid}_${id}`;
                  const newVal = !isMuted;
                  await AsyncStorage.setItem(muteKey, newVal ? 'true' : 'false');
                  setIsMuted(newVal);
                } catch {}
              }}
            >
              <Ionicons name={isMuted ? 'notifications-outline' : 'notifications-off-outline'} size={20} color={Colors.text2} />
              <Text style={styles.kebabItemText}>{isMuted ? 'Sesi Aç' : 'Sessize Al'}</Text>
            </Pressable>

            {/* Engelle / Engeli Kaldır */}
            <Pressable
              style={styles.kebabItem}
              onPress={async () => {
                setShowKebabMenu(false);
                if (isBlocked) {
                  // Engeli kaldır
                  setCAlert({
                    visible: true,
                    title: 'Engeli Kaldır',
                    message: `${otherUser?.display_name || 'Bu kullanıcı'} engelden çıkarılacak.`,
                    type: 'info',
                    buttons: [
                      {
                        text: 'Kaldır',
                        onPress: async () => {
                          try {
                            await ModerationService.unblockUser(firebaseUser!.uid, id);
                            setIsBlocked(false);
                          } catch {}
                        },
                      },
                      { text: 'Vazgeç', style: 'cancel' },
                    ],
                  });
                } else {
                  // Engelle
                  setCAlert({
                    visible: true,
                    title: 'Kullanıcıyı Engelle',
                    message: `${otherUser?.display_name || 'Bu kullanıcı'} engellenecek ve mesaj gönderemeyecek.`,
                    type: 'warning',
                    buttons: [
                      {
                        text: 'Engelle',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await ModerationService.blockUser(firebaseUser!.uid, id);
                            setIsBlocked(true);
                          } catch {}
                        },
                      },
                      { text: 'Vazgeç', style: 'cancel' },
                    ],
                  });
                }
              }}
            >
              <Ionicons name={isBlocked ? 'person-add-outline' : 'ban-outline'} size={20} color={isBlocked ? Colors.teal : '#F59E0B'} />
              <Text style={[styles.kebabItemText, { color: isBlocked ? Colors.teal : '#F59E0B' }]}>
                {isBlocked ? 'Engeli Kaldır' : 'Engelle'}
              </Text>
            </Pressable>

            {/* Bildir */}
            <Pressable
              style={[styles.kebabItem, { borderBottomWidth: 0 }]}
              onPress={() => {
                setShowKebabMenu(false);
                setReportMessageId(id); // set target to user id for report
                setShowReportModal(true);
              }}
            >
              <Ionicons name="flag-outline" size={20} color={Colors.text3} />
              <Text style={[styles.kebabItemText, { color: Colors.text3 }]}>Bildir</Text>
            </Pressable>
          </KebabDropdown>
        </Pressable>
      </Modal>

      {/* ★ 2026-04-24: Medya ve Bağlantılar Modal */}
      <MediaLinksModal
        visible={showMediaDrawer}
        messages={messages}
        onClose={() => setShowMediaDrawer(false)}
        onImagePress={(uri) => { setShowMediaDrawer(false); setViewerImage(uri); }}
      />


      {/* ★ Tam Ekran Görsel Görüntüleyici */}
      <Modal
        visible={!!viewerImage}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerImage(null)}
      >
        <View style={styles.imageViewerOverlay}>
          <Pressable style={styles.imageViewerClose} onPress={() => setViewerImage(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          {viewerImage && (
            <Image
              source={{ uri: viewerImage }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </Animated.View>
    </KeyboardAvoidingView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  // Header
  headerWrap: {
    position: 'relative',
    marginBottom: 14,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  headerSeparator: {
    height: 1.5,
    width: '100%',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, marginLeft: 4 },
  headerInfo: { flex: 1, marginLeft: 10 },
  headerName: { fontSize: 15, fontWeight: '700', color: Colors.text, textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.emerald, shadowColor: Colors.emerald, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 3, elevation: 3 },
  onlineText: { fontSize: 11, color: Colors.emerald, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  offlineText: { fontSize: 11, color: Colors.text3, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  typingHeaderText: { fontSize: 11, color: Colors.teal, fontWeight: '600' as const, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  typingDots: { fontSize: 11, color: Colors.teal, fontWeight: '600' as const, marginLeft: 1, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.glass2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kebabBtn: {
    width: 32,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20,184,166,0.25)',
    zIndex: 5,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaSheet: {
    width: '90%',
    maxHeight: '75%',
    backgroundColor: '#17202E',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 14,
  },
  mediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  mediaTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  mediaTabRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingVertical: 8 },
  mediaTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  mediaTabActive: { backgroundColor: 'rgba(20,184,166,0.15)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.35)' },
  mediaTabText: { fontSize: 12, fontWeight: '600', color: Colors.text3 },
  mediaTabTextActive: { color: Colors.teal },
  mediaEmpty: { padding: 30, alignItems: 'center', gap: 8 },
  mediaEmptyText: { fontSize: 13, color: Colors.text3 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 6 },
  mediaGridImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  mediaListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  mediaListText: { fontSize: 13, color: Colors.text2, flex: 1 },
  kebabOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  kebabDropdown: {
    backgroundColor: 'rgba(15, 23, 42, 0.97)',
    borderRadius: 14,
    minWidth: 200,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  kebabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  kebabItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text2,
  },
  // ★ Image Viewer
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: '92%',
    height: '75%',
  },

  // Messages
  messageList: { flex: 1 },
  messageContent: { padding: 16, gap: 8, flexGrow: 1 },
  bubbleWrap: { marginBottom: 4 },
  bubbleLeft: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  bubbleRight: { alignItems: 'flex-end', flexDirection: 'row-reverse', gap: 8 },
  bubbleAvatarRow: {
    paddingTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.default,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
  },
  bubbleMe: {
    backgroundColor: Colors.teal,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.bg4,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, color: Colors.text, lineHeight: 20, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  chatImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },
  bubbleTime: { fontSize: 9, color: Colors.text3, textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  iconShadow: { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
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

  // ★ DM-8: Mesaj İsteği Banner — koyu tema uyumlu
  msgRequestBanner: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  msgRequestBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  msgRequestDesc: {
    fontSize: 11, color: '#94A3B8', lineHeight: 15, flex: 1,
  },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 10,
  },
  inputAction: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  // ★ Emoji Tepki Stiller — WhatsApp tarzı
  reactionBar: {
    position: 'absolute',
    top: -48,
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 30, 48, 0.92)',
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 5,
    gap: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 16,
    zIndex: 999,
  },
  reactionBarLeft: {
    left: 0,
  },
  reactionBarRight: {
    right: 0,
  },
  reactionEmoji: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmojiText: {
    fontSize: 17,
  },
  reactionDisplay: {
    position: 'absolute',
    bottom: -4,
    flexDirection: 'row',
    gap: 3,
    zIndex: 10,
  },
  reactionDisplayLeft: {
    left: 36,
  },
  reactionDisplayRight: {
    right: 36,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingHorizontal: 1,
    paddingVertical: 0,
    gap: 1,
  },
  reactionPillEmoji: {
    fontSize: 16,
  },
  reactionPillCount: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
});

// ★ MSG-6: Ses mesajı oynatıcı stilleri
const voiceStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
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
