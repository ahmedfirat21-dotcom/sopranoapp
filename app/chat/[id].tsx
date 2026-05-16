import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Image, Pressable, TextInput, FlatList, Platform, Animated, Easing, NativeScrollEvent, NativeSyntheticEvent, Modal, Keyboard, Dimensions, Alert, KeyboardAvoidingView } from 'react-native';

// ★ v92.16: react-native-keyboard-controller kaldırıldı — native modül linked değildi.
//   RN built-in KeyboardAvoidingView kullanılıyor (RN import'undaki mevcut).
//   Samsung cihazlarda sorun olursa: behavior="height" + keyboardVerticalOffset ile ayarla.

import PremiumAlert, { type AlertButton } from '../../components/PremiumAlert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SkiaShadow, GlowMessageBubble } from '../../components/skia';
import { Colors, Radius } from '../../constants/theme';
import { safeGoBack } from '../../constants/navigation';
import { MessageService, ProfileService, type Message, type Profile } from '../../services/database';
import { DMCacheService } from '../../services/dmCache';
import { supabase } from '../../constants/supabase';
import { CallService } from '../../services/call';
import { FriendshipService } from '../../services/friendship';
import { ModerationService } from '../../services/moderation';
import { EmojiPicker } from '../../components/EmojiPicker';
import { ReportModal } from '../../components/ReportModal';
import { showToast } from '../../components/Toast';
import { useAuth, useBadges, useUserProfileSheet } from '../_layout';
import { i18n, useTranslation } from '../../services/i18n';
import { useOnlineFriends } from '../../providers/OnlineFriendsProvider';
import { useDMNotif } from '../../providers/DMNotifProvider';
import StatusAvatar from '../../components/StatusAvatar';
import MessageActionMenu from '../../components/MessageActionMenu';
import LinkifiedText from '../../components/LinkifiedText';
// ★ v270 (14 May 2026): Custom emoji shortcode → image render
import { InlineEmoji } from '../../components/skia/CustomEmojiRenderer';
import LinkPreviewCard from '../../components/LinkPreviewCard';
import { useUserSearchSheet } from '../_layout';
import * as Clipboard from 'expo-clipboard';
import { StorageService } from '../../services/storage';
import * as ImagePicker from 'expo-image-picker';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import AppBackground from '../../components/AppBackground';
import AppLoader from '../../components/AppLoader';
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
            <Text style={styles.mediaTitle}>{i18n.t('messages.media_links')}</Text>
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
              <View style={styles.mediaEmpty}><Ionicons name="images-outline" size={32} color={Colors.text3} /><Text style={styles.mediaEmptyText}>{i18n.t('messages.no_images')}</Text></View>
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
              <View style={styles.mediaEmpty}><Ionicons name="mic-outline" size={32} color={Colors.text3} /><Text style={styles.mediaEmptyText}>{i18n.t('messages.no_voice')}</Text></View>
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
              <View style={styles.mediaEmpty}><Ionicons name="link-outline" size={32} color={Colors.text3} /><Text style={styles.mediaEmptyText}>{i18n.t('messages.no_links')}</Text></View>
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

function MessageBubble({ message, isMe, senderAvatar, senderName, myAvatar, onDelete, onReport, onAction, onReaction, isReactionActive, onToggleReaction, onImagePress, onAvatarPress, replyToMessage, onOpenActions, onJumpTo }: { message: Message; isMe: boolean; senderAvatar?: string; senderName?: string; myAvatar?: string; onDelete?: (msgId: string) => void; onReport?: (msgId: string) => void; onAction?: (buttons: any[]) => void; onReaction?: (msgId: string, emoji: string) => void; isReactionActive?: boolean; onToggleReaction?: (msgId: string | null) => void; onImagePress?: (uri: string) => void; onAvatarPress?: () => void; replyToMessage?: Message | null; onOpenActions?: (msg: Message) => void; onJumpTo?: (msgId: string) => void }) {
  const time = new Date(message.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const customStyle = getChatColorStyle(message.sender?.active_chat_color);
  const isTemp = message.id.startsWith('temp_');
  const hasVoice = !!message.voice_url;
  const isDeleted = !!(message as any).is_deleted;
  const isDeletedForEveryone = !!message.deleted_for_everyone;
  const isEdited = !!message.edited_at;
  const isForwarded = !!message.forwarded_from_id;
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
    if (isTemp || isDeleted || isDeletedForEveryone) return;
    // ★ v109: WhatsApp action menu — eski reaction bar yerine geniş bottom sheet.
    if (onOpenActions) {
      onOpenActions(message);
    } else {
      onToggleReaction?.(message.id);
    }
  };

  if (isDeleted || isDeletedForEveryone) {
    return (
      <View style={[styles.bubbleWrap, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
        <View style={[styles.bubble, { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }]}>
          <Text style={[styles.bubbleText, { color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }]}>
            🚫 {isDeletedForEveryone ? 'Bu mesaj herkes için silindi' : 'Bu mesaj silindi'}
          </Text>
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
        <GlowMessageBubble glowItemId={(message.sender as any)?.active_glow_id} context="dm" style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther, customStyle] as any}>
          {/* ★ v117: GlowMessageBubble — sender'ın active_glow_id'sine göre Skia glow + animasyon
             Eğer glow_id yoksa düz View wrapper olarak davranır (no-op). */}
          {/* ★ v109: Forwarded rozeti — bubble üstünde "İletildi" göstergesi */}
          {isForwarded ? (
            <View style={styles.forwardedRow}>
              <Ionicons name="arrow-redo" size={11} color="rgba(255,255,255,0.55)" />
              <Text style={styles.forwardedText}>{i18n.t('messages.forwarded')}</Text>
            </View>
          ) : null}
          {/* ★ v109: Reply preview — bubble içinde sol-bordered alıntı kartı, tıklanınca scroll */}
          {message.reply_to_id && replyToMessage ? (
            <Pressable onPress={() => onJumpTo?.(message.reply_to_id!)} style={styles.replyPreviewInBubble}>
              <View style={styles.replyAccent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.replyAuthor} numberOfLines={1}>
                  {replyToMessage.sender_id === message.sender_id ? 'Kendine' : (replyToMessage.sender?.display_name || 'Kullanıcı')}
                </Text>
                <Text style={styles.replyContent} numberOfLines={1}>
                  {replyToMessage.deleted_for_everyone ? '🚫 Bu mesaj silindi'
                    : replyToMessage.voice_url ? '🎙️ Sesli mesaj'
                    : replyToMessage.image_url ? '📷 Fotoğraf'
                    : (replyToMessage.content || '...')}
                </Text>
              </View>
            </Pressable>
          ) : null}
          {hasImage && !hasVoice ? (
            <Pressable onPress={() => onImagePress?.(imageUri!)}>
              <Image source={{ uri: imageUri! }} style={styles.chatImage} resizeMode="cover" />
            </Pressable>
          ) : null}
          {hasVoice ? (
            <VoiceMessagePlayer voiceUrl={message.voice_url!} duration={message.voice_duration || undefined} isMe={isMe} />
          ) : !hasImage && message.content ? (
            <>
              {/* ★ v270: Custom emoji shortcode varsa InlineEmoji ile image render et,
                   yoksa standart LinkifiedText (link parsing + tıklanabilir). */}
              {(() => {
                const senderEmojiId = (message.sender as any)?.active_emoji_id || null;
                const hasShortcode = /:[a-z0-9_-]+:/i.test(message.content);
                if (hasShortcode && senderEmojiId) {
                  return <InlineEmoji text={message.content} emojiSetId={senderEmojiId} textStyle={styles.bubbleText as any} />;
                }
                return <LinkifiedText text={message.content} style={styles.bubbleText} />;
              })()}
              {/* ★ v109: Link preview kartı — content'te URL varsa OG metadata göster */}
              <LinkPreviewCard text={message.content} isMe={isMe} />
            </>
          ) : null}
          {/* ★ v109: Düzenlendi rozeti — sağ alt köşe küçük italik */}
          {isEdited ? (
            <Text style={styles.editedBadge}>düzenlendi</Text>
          ) : null}
        </GlowMessageBubble>
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
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { firebaseUser, profile, refreshProfile, minimizedRoom } = useAuth();
  const { openUserProfile } = useUserProfileSheet();
  // ★ 2026-04-30 FIX: Presence-based online status — stale DB flag yerine canlı websocket durumu.
  const { onlineFriends } = useOnlineFriends();
  const onlinePresenceIds = useMemo(() => new Set(onlineFriends.map(f => f.id)), [onlineFriends]);
  // ★ v86: DM broadcast — yeni mesaj/kabul/red anlık (postgres_changes anon'da çalışmıyor)
  const dmNotif = useDMNotif();
  const insets = useSafeAreaInsets();
  // ★ 2026-04-24 v2: Chat mount+loaded slide-down — loading bitince içerik üstten akarak iner.
  const contentTranslateY = useRef(new Animated.Value(-80)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const { refreshBadges } = useBadges();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // ★ v110.5.18: Block durumu — chat ekranı kapanmaz, banner + input disable
  const [isBlockedState, setIsBlockedState] = useState<{ byMe: boolean; byThem: boolean }>({ byMe: false, byThem: false });
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
  // ★ v109: Mesaj action menüsü + reply + edit + saved
  const [actionMenuMsg, setActionMenuMsg] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [draftLoaded, setDraftLoaded] = useState(false);
  // ★ v109: Disappearing messages timer
  const [disappearingSeconds, setDisappearingSeconds] = useState(0);
  const [showDisappearingPicker, setShowDisappearingPicker] = useState(false);
  const [chatSearchVisible, setChatSearchVisible] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatSearchResults, setChatSearchResults] = useState<Message[]>([]);
  const { openSearch: openUserSearch } = useUserSearchSheet();
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
    // ★ v108.31: KAV kaldırıldı — adjustResize + flex yeterli.
    //   Listener sadece scrollToEnd ve kbHeight flag için (input bar paddingBottom).
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKbHeight(e.endCoordinates.height);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 80);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKbHeight(0);
      if (isAtBottomRef.current) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 80);
      }
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);
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
      // ★ v110.5.15: Cache'e ekle
      if (firebaseUser?.uid && id) DMCacheService.append(firebaseUser.uid, id, newMsg).catch(() => {});
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

    // ★ v110.5.15: WhatsApp/Telegram pattern — CACHE HIT → INSTANT render.
    //   Network fetch arka planda. Loading flash yok, layout shift yok.
    //   ★ v110.5.19: Boş cache → cache GEÇERSİZ kabul (eski block fix öncesi
    //   yanlışlıkla [] yazılmış olabilir). Sadece dolu cache hidrasyon yapar.
    DMCacheService.load(firebaseUser.uid, id).then(cached => {
      if (cached && cached.length > 0) {
        setMessages(cached as any);
        setLoading(false); // Spinner anında kapansın
        // İlk yüklemede en alta scroll (cache mesajları görünsün)
        if (!initialScrolledRef.current) {
          initialScrolledRef.current = true;
          requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: false }));
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
        }
      } else if (cached && cached.length === 0) {
        // Boş cache silinsin → bir sonraki açılışta fresh fetch
        DMCacheService.clear(firebaseUser.uid, id).catch(() => {});
      }
    }).catch(() => {});

    const loadChat = async () => {
      // ★ 2026-04-28: 2 aşamalı yükleme — kritik (blok+profil+mesajlar+cleared) ÖNCE paralel,
      //   spinner kalkar. Detaylar (oda/takip/istek/markRead/missed/mute) arka planda paralel.
      //   Eski sıralı 11 await ~1-3sn sürerken artık ~300-500ms (en yavaş kritik sorgunun süresi).
      try {
        // ── Aşama 1: KRİTİK paralel — UI gözükmeden zorunlu ──
        const [isBlockedByMe, isBlockedByThem, profile, history, clearedMap, mreq] = await Promise.all([
          ModerationService.isBlocked(firebaseUser.uid, id).catch(() => false),
          ModerationService.isBlocked(id, firebaseUser.uid).catch(() => false),
          ProfileService.get(id).catch(() => null),
          MessageService.getConversation(firebaseUser.uid, id, 50).catch(() => [] as Message[]),
          MessageService.getClearedBefore(firebaseUser.uid).catch(() => ({} as Record<string, string>)),
          MessageService.getMessageRequest(firebaseUser.uid, id).catch(() => null),
        ]);
        // ★ v85: Mesaj İsteği durumu — mevcut msgRequestInfoRaw state'ine yansıt
        if (mreq) {
          if (mreq.status === 'pending') {
            const isOutgoing = mreq.sender_id === firebaseUser.uid;
            setMsgRequestInfo({ status: isOutgoing ? 'pending_outgoing' : 'pending_incoming' });
          } else if (mreq.status === 'accepted') {
            setMsgRequestInfo({ status: 'accepted' });
          } else if (mreq.status === 'rejected') {
            setMsgRequestInfo({ status: 'rejected' });
          }
        } else {
          setMsgRequestInfo({ status: 'none' });
        }

        // ★ v110.5.18 (6 May 2026): Block sonrası chat ekranı KAPATILMIYOR.
        //   Eski: router.back() → kullanıcı eski mesajları göremiyor, "silinmiş" hissi.
        //   Yeni: WhatsApp pattern — chat görünür, mesajlar erişilebilir, input devre dışı +
        //   "Engellediğiniz kullanıcı" banner. Mesajlar DB'de duruyor (RLS sender/receiver izinli).
        setIsBlockedState({ byMe: isBlockedByMe, byThem: isBlockedByThem });
        setOtherUser(profile);

        const clearedBefore = clearedMap[id];
        const filteredHistory = clearedBefore
          ? history.filter(m => new Date(m.created_at) > new Date(clearedBefore))
          : history;
        setMessages(filteredHistory);
        // ★ v110.5.15: Cache'i fresh data ile güncelle (sonraki açılışlar instant)
        DMCacheService.save(firebaseUser.uid, id, filteredHistory).catch(() => {});

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
            }, () => {}),

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

          // ★ v85: message_requests durumu Aşama 1'de yüklendi (mreq) — burada tekrar çağırma.

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
        // ★ v110.5.15: Cache'e ekle (realtime'dan gelen mesaj)
        DMCacheService.append(firebaseUser.uid, id, newMsg).catch(() => {});
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
    // ★ 2026-04-29 v85: INSERT event de eklendi — yabancı chat'i açıkken karşı taraf
    //   ilk mesajı atınca anında "Mesaj İsteği — Kabul/Red" banner görünsün.
    const msgReqChannelName = `msg_req_${firebaseUser.uid}_${id}`;
    const msgReqChannel = supabase
      .channel(msgReqChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_requests',
        },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row) return;
          // Bu sohbet ile ilgili mi kontrol et
          const isRelevant =
            (row.sender_id === firebaseUser.uid && row.receiver_id === id) ||
            (row.sender_id === id && row.receiver_id === firebaseUser.uid);
          if (!isRelevant) return;

          if (row.status === 'accepted') {
            setMsgRequestInfo({ status: 'accepted' });
          } else if (row.status === 'rejected') {
            setMsgRequestInfo({ status: 'rejected' });
          } else if (row.status === 'pending') {
            // ★ INSERT/UPDATE — pending durumda yön: ben sender mıyım, receiver mı?
            const isOutgoing = row.sender_id === firebaseUser.uid;
            setMsgRequestInfo({ status: isOutgoing ? 'pending_outgoing' : 'pending_incoming' });
          }
        }
      )
      .subscribe();

    // ★ v86: DMNotifProvider broadcast subscribe — anon Realtime postgres_changes
    //   DM tablolarını alamıyor, broadcast bunu kapatıyor.
    const unsubDmSignal = dmNotif.onSignal((signal) => {
      if (signal.event === 'dm_new' && signal.sender_id === id) {
        // Karşı taraftan yeni mesaj geldi — listeyi tazele + okundu işaretle
        MessageService.getConversation(firebaseUser.uid, id, 50)
          .then(history => setMessages(history))
          .catch(() => {});
        MessageService.markAsRead(firebaseUser.uid, id).catch(() => {});
        // Chat ekranı açık → unread sıfırla
        dmNotif.markRead(id);
      } else if (signal.event === 'dm_accepted') {
        // Karşı taraf isteği kabul etti → input açılır
        if (signal.sender_id === firebaseUser.uid && signal.receiver_id === id) {
          setMsgRequestInfo({ status: 'accepted' });
        } else if (signal.receiver_id === firebaseUser.uid && signal.sender_id === id) {
          setMsgRequestInfo({ status: 'accepted' });
        }
      } else if (signal.event === 'dm_rejected') {
        if (signal.sender_id === firebaseUser.uid && signal.receiver_id === id) {
          setMsgRequestInfo({ status: 'rejected' });
        }
      }
    });

    // Chat ekranı açıldığında bu user için unread sıfırla
    dmNotif.markRead(id);

    return () => {
      channel.unsubscribe();
      typingChannel.unsubscribe();
      supabase.removeChannel(readChannel); // ★ BUG-8 FIX: removeChannel ile tam temizlik
      supabase.removeChannel(msgReqChannel); // ★ message_requests realtime cleanup
      unsubDmSignal();
      if (typingResetTimer) clearTimeout(typingResetTimer);
      // ★ BUG-2 FIX: Typing kanalını temizle
      MessageService.cleanupTypingChannel(id);
    };
  }, [id, firebaseUser, dmNotif]);

  // ★ v109: Taslak — chat açıldığında DB'den oku (varsa input'a doldur)
  useEffect(() => {
    if (!firebaseUser?.uid || !id || draftLoaded) return;
    let cancelled = false;
    MessageService.getDraft(firebaseUser.uid, id as string).then((d) => {
      if (cancelled) return;
      if (d?.content) setInputText(d.content);
      setDraftLoaded(true);
    });
    return () => { cancelled = true; };
  }, [firebaseUser?.uid, id, draftLoaded]);

  // ★ v109: Taslak — unmount sırasında SADECE BİR KEZ kaydet.
  //   inputText'i ref ile takip ederek dep listesini sade tut, her tuş basışında
  //   cleanup tetiklenmesin. Effect sadece firebaseUser/id değişince çalışır.
  const draftStateRef = useRef<{ text: string; reply: string | null; editing: boolean }>({ text: '', reply: null, editing: false });
  useEffect(() => {
    draftStateRef.current = {
      text: inputText,
      reply: replyingTo?.id || null,
      editing: !!editingMessageId,
    };
  }, [inputText, replyingTo, editingMessageId]);

  useEffect(() => {
    return () => {
      if (firebaseUser?.uid && id) {
        const st = draftStateRef.current;
        MessageService.saveDraft(
          firebaseUser.uid, id as string,
          st.editing ? '' : st.text,
          st.reply,
        );
      }
    };
  }, [firebaseUser?.uid, id]);

  // ★ v109: Saved messages — chat açıldığında kayıtlı id'leri yükle
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    MessageService.getSavedMessageIds(firebaseUser.uid).then(setSavedIds);
  }, [firebaseUser?.uid]);

  // ★ v109: Disappearing TTL — sohbet için ayar varsa yükle
  useEffect(() => {
    if (!firebaseUser?.uid || !id) return;
    MessageService.getDisappearingTimer(firebaseUser.uid, id as string).then(setDisappearingSeconds);
  }, [firebaseUser?.uid, id]);

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

  // ★ v109: Mesaj aksiyon callback'leri — Reply, Edit, Delete, Forward, Save, Copy, Report
  const handleReplyTo = useCallback((msg: Message) => {
    setReplyingTo(msg);
    setEditingMessageId(null);
  }, []);

  const handleStartEdit = useCallback((msg: Message) => {
    setEditingMessageId(msg.id);
    setReplyingTo(null);
    setInputText(msg.content);
  }, []);

  const handleCancelComposeMode = useCallback(() => {
    setReplyingTo(null);
    if (editingMessageId) {
      setEditingMessageId(null);
      setInputText('');
    }
  }, [editingMessageId]);

  const handleDeleteForEveryone = useCallback(async (msg: Message) => {
    if (!firebaseUser) return;
    const r = await MessageService.deleteForEveryone(firebaseUser.uid, msg.id);
    if (r.success) {
      setMessages(prev => prev.map(m => m.id === msg.id
        ? { ...m, deleted_for_everyone: true, content: '', voice_url: null, image_url: null }
        : m));
    } else {
      showToast({ title: 'Silinemedi', message: r.error || 'Tekrar dene.', type: 'error' });
    }
  }, [firebaseUser]);

  const handleDeleteFromChat = useCallback(async (msg: Message) => {
    if (!firebaseUser) return;
    try {
      await MessageService.deleteMessage(msg.id, firebaseUser.uid);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_deleted: true } : m));
    } catch {
      showToast({ title: 'Silinemedi', message: 'Tekrar dene.', type: 'error' });
    }
  }, [firebaseUser]);

  const handleCopyMessage = useCallback(async (msg: Message) => {
    if (!msg.content) return;
    await Clipboard.setStringAsync(msg.content);
    showToast({ title: '✓ Kopyalandı', type: 'success' });
  }, []);

  const handleSaveMessage = useCallback(async (msg: Message) => {
    if (!firebaseUser) return;
    const wasSaved = savedIds.has(msg.id);
    setSavedIds(prev => {
      const next = new Set(prev);
      if (wasSaved) next.delete(msg.id); else next.add(msg.id);
      return next;
    });
    try {
      await MessageService.toggleSavedMessage(firebaseUser.uid, msg.id);
      showToast({
        title: wasSaved ? 'Kaydedilenden çıkarıldı' : '🔖 Kaydedildi',
        type: 'success',
      });
    } catch {
      setSavedIds(prev => {
        const next = new Set(prev);
        if (wasSaved) next.add(msg.id); else next.delete(msg.id);
        return next;
      });
    }
  }, [firebaseUser, savedIds]);

  const handleForwardMessage = useCallback((msg: Message) => {
    // Hedef kullanıcı seçici aç → seçince forward RPC
    openUserSearch({
      mode: 'compose',
      onSelectUser: async (targetUserId: string) => {
        if (!firebaseUser || targetUserId === firebaseUser.uid) {
          showToast({ title: 'Geçersiz hedef', type: 'error' });
          return;
        }
        const r = await MessageService.forwardMessage(firebaseUser.uid, msg.id, targetUserId);
        if (r.success) {
          showToast({ title: '✓ İletildi', type: 'success' });
        } else {
          showToast({ title: 'İletilemedi', message: r.error || 'Tekrar dene.', type: 'error' });
        }
      },
    });
  }, [firebaseUser, openUserSearch]);

  const handleReportMessage = useCallback((_msg: Message) => {
    // Mevcut report flow'una bağla — basitçe toast (placeholder, asıl modal başka yerde)
    showToast({ title: 'Mesaj bildirildi', message: 'İncelemeye alındı.', type: 'info' });
  }, []);

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

    // ★ v109: Edit modu — yeni mesaj göndermek yerine RPC ile düzenle
    if (editingMessageId) {
      const r = await MessageService.editMessage(firebaseUser.uid, editingMessageId, content);
      if (r.success) {
        setMessages(prev => prev.map(m => m.id === editingMessageId
          ? { ...m, content, edited_at: r.edited_at || new Date().toISOString() }
          : m));
        setEditingMessageId(null);
        setInputText('');
      } else {
        showToast({ title: 'Düzenlenemedi', message: r.error || 'Tekrar dene.', type: 'error' });
      }
      return;
    }

    // ★ v109: Reply modunda gönderim — reply_to_id ile send
    const replyId = replyingTo?.id || null;
    setReplyingTo(null);

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
      reply_to_id: replyId,
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
      // ★ v109: replyId varsa sendReply, yoksa normal send
      const newMsg = replyId
        ? await MessageService.sendReply(firebaseUser.uid, id, content, replyId)
        : await MessageService.send(firebaseUser.uid, id, content);
      if (!newMsg) throw new Error('send failed');
      // Geçici mesajı gerçek veritabanı ID'li mesaj ile değiştir
      setMessages(prev => prev.map(m => m.id === tempId ? newMsg : m));
      // ★ v110.5.15: Cache'e ekle (server mesajı, optimistic değil)
      DMCacheService.append(firebaseUser.uid, id, newMsg).catch(() => {});
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
      const msg = err?.message || err?.error_description || err?.toString() || 'Mesaj gönderilemedi';
      // ★ v85i: Toast yetersiz kaldığı durumlarda kullanıcı kaçırıyor;
      //   Alert kullanıcı dismiss etmeden ekrandan çıkmaz → debug + UX hatası net.
      Alert.alert(
        'Mesaj Gönderilemedi',
        msg.slice(0, 500),
        [{ text: 'Tamam', style: 'default' }],
        { cancelable: true },
      );
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

  // ★ v110.5.8: Full-screen loading KALDIRILDI — layout shift yapıyordu (input
  //   yükleme bitince yeniden konumlanıyor). Şimdi header+input baştan render,
  //   sadece mesaj listesi alanı skeleton'la dolu (loading) veya FlatList (loaded).
  //   WhatsApp/Instagram pattern: chat shell instant + mesajlar yerine skeleton.


  return (
    <AppBackground radialGlow>
    {/* ★ v110.5.23 (6 May 2026): KAV KALDIRILDI — manuel kbHeight ile container paddingBottom.
         Eski sorun: KAV padding animation timing klavye animation ile farklı → klavye
         kapanınca input bar'ın altında geçici boşluk kalıyordu.
         Yeni: kbHeight state setKbHeight ile (keyboardDidHide=0 anlık) → paddingBottom
         instant 0 → input bar tam yere oturur, geçiş boşluğu yok. */}
    <Animated.View style={[styles.container, { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }], paddingBottom: kbHeight }]}>

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
          <StatusAvatar uri={otherUser?.avatar_url} size={36} isOnline={onlinePresenceIds.has(id as string)} tier={otherUser?.subscription_tier} frameId={(otherUser as any)?.active_frame || null} customBadgeId={(otherUser as any)?.active_badge_id ?? null} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{otherUser?.display_name || ' '}</Text>
          <View style={styles.onlineRow}>
            {isTyping ? (
              <>
                <Text style={styles.typingHeaderText}>yazıyor</Text>
                <Text style={styles.typingDots}>…</Text>
              </>
            ) : onlinePresenceIds.has(id as string) ? (
              <>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>{t('messages.online')}</Text>
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

      {/* ★ 2026-04-29 v85: Yabancılar arası ilk mesaj artık "İstek" olarak gönderilir.
          Eski "kapalı" banner'ı kaldırıldı; yerine v85 banner'ları (Kabul/Red, cevap bekleniyor, reddedildi). */}

      {/* ★ Yabancıya ilk mesaj — istek modunda olduğunu bildiren info banner */}
      {!loading && !isMutualFollow && msgRequestInfo.status === 'none' && (
        <View style={[msgReqBannerStyles.banner, { backgroundColor: 'rgba(251,191,36,0.10)', borderColor: 'rgba(251,191,36,0.40)' }]}>
          <View style={[msgReqBannerStyles.iconWrap, { backgroundColor: 'rgba(251,191,36,0.20)' }]}>
            <Ionicons name="paper-plane-outline" size={22} color="#FBBF24" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[msgReqBannerStyles.title, { color: '#FCD34D' }]}>📨 Mesaj isteği</Text>
            <Text style={msgReqBannerStyles.subtitle}>
              İlk mesajın istek olarak gönderilir. Karşı taraf onaylarsa mesajlaşabilirsiniz.
            </Text>
          </View>
        </View>
      )}

      {/* ★ Reddedilmiş istek — sender bilgi banner */}
      {msgRequestInfo.status === 'rejected' && (
        <View style={[msgReqBannerStyles.banner, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.45)' }]}>
          <View style={[msgReqBannerStyles.iconWrap, { backgroundColor: 'rgba(239,68,68,0.22)' }]}>
            <Ionicons name="ban-outline" size={22} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[msgReqBannerStyles.title, { color: '#F87171' }]}>{t('messages.request_rejected')}</Text>
            <Text style={msgReqBannerStyles.subtitle}>
              Bu kullanıcı seninle mesajlaşmak istemiyor.
            </Text>
          </View>
        </View>
      )}

      {/* ★ 2026-04-29 v85: Mesaj İsteği — receiver pending durumda Kabul/Red banner */}
      {msgRequestInfo.status === 'pending_incoming' && (
        <View style={[msgReqBannerStyles.banner, { flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <View style={msgReqBannerStyles.iconWrap}>
              <Ionicons name="mail-unread" size={22} color="#FBBF24" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={msgReqBannerStyles.title}>📨 Mesaj İsteği</Text>
              <Text style={msgReqBannerStyles.subtitle}>
                {otherUser?.display_name || 'Bu kullanıcı'} sana ilk kez yazıyor. Kabul edersen mesajlaşabilirsiniz.
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={[msgReqBannerStyles.btnFull, msgReqBannerStyles.btnRejectFull]}
              disabled={respondingRequest}
              onPress={async () => {
                if (!firebaseUser?.uid || !id || respondingRequest) return;
                setRespondingRequest(true);
                try {
                  await MessageService.rejectMessageRequest(firebaseUser.uid, id);
                  showToast({ title: '✕ Reddedildi', message: 'Mesaj isteği reddedildi.', type: 'info' });
                  router.back();
                } catch (e: any) {
                  showToast({ title: 'Hata', message: e?.message || 'İşlem başarısız', type: 'error' });
                } finally { setRespondingRequest(false); }
              }}
            >
              <Ionicons name="close-circle" size={18} color="#F87171" />
              <Text style={msgReqBannerStyles.btnRejectText}>{t('common.delete')}</Text>
            </Pressable>
            <SkiaShadow shadowColor="#14B8A6" shadowOpacity={0.55} shadowBlur={10} shadowOffsetY={3} borderRadius={10} style={{ flex: 1 }}>
            <Pressable
              style={[msgReqBannerStyles.btnFull, msgReqBannerStyles.btnAcceptFull]}
              disabled={respondingRequest}
              onPress={async () => {
                if (!firebaseUser?.uid || !id || respondingRequest) return;
                setRespondingRequest(true);
                try {
                  await MessageService.acceptMessageRequest(firebaseUser.uid, id);
                  setMsgRequestInfo({ status: 'accepted' });
                  showToast({ title: '✓ Kabul edildi', message: 'Artık mesajlaşabilirsiniz.', type: 'success' });
                } catch (e: any) {
                  showToast({ title: 'Hata', message: e?.message || 'İşlem başarısız', type: 'error' });
                } finally { setRespondingRequest(false); }
              }}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={msgReqBannerStyles.btnAcceptText}>{t('common.accept')}</Text>
            </Pressable>
            </SkiaShadow>
          </View>
        </View>
      )}

      {/* ★ Sender pending banner — cevap bekleniyor bilgilendirme */}
      {msgRequestInfo.status === 'pending_outgoing' && (
        <View style={[msgReqBannerStyles.banner, { backgroundColor: 'rgba(20,184,166,0.12)', borderColor: 'rgba(20,184,166,0.45)' }]}>
          <View style={[msgReqBannerStyles.iconWrap, { backgroundColor: 'rgba(20,184,166,0.22)' }]}>
            <Ionicons name="time-outline" size={22} color={Colors.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[msgReqBannerStyles.title, { color: Colors.teal }]}>⏳ İstek gönderildi</Text>
            <Text style={msgReqBannerStyles.subtitle}>
              Karşı taraf onaylayana kadar yeni mesaj atamazsın.
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
            replyToMessage={item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) || null : null}
            onOpenActions={setActionMenuMsg}
            onJumpTo={(targetId: string) => {
              const idx = messages.findIndex(m => m.id === targetId);
              if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
            }}
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
                      <Text style={styles.missedCallBackText}>{t('messages.call_back')}</Text>
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
                <AppLoader size="small" color={Colors.text2} />
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
        // ★ v284 (16 May 2026): DM mesaj listesi performans config
        initialNumToRender={20}
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={50}
        windowSize={11}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* ★ 2026-04-30 FIX v7: Normal flex flow — KAV container'ı küçültünce
          FlatList flex:1 küçülür, input bar doğal yerinde kalır. */}
      <View
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
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom + 6, 20) }]}>
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
              <AppLoader size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFF" />
            )}
          </Pressable>
        </View>
      ) : (
        // ★ v85: Input enable kuralı: arkadaş/accepted/none → açık; pending/rejected → kapalı
        <View style={{ flexDirection: 'column' }}>
        {/* ★ v109: Reply / Edit compose banner — input üstünde ya yanıt önizleme ya da düzenleme uyarısı */}
        {(replyingTo || editingMessageId) && (
          <View style={styles.composeBanner}>
            <View style={styles.composeBannerAccent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.composeBannerLabel}>
                {editingMessageId ? '✎ Düzenleniyor'
                  : `↩︎ Yanıt: ${replyingTo?.sender_id === firebaseUser?.uid ? 'Kendine' : (otherUser?.display_name || 'Kullanıcı')}`}
              </Text>
              <Text style={styles.composeBannerSnippet} numberOfLines={1}>
                {editingMessageId
                  ? 'Mevcut metni değiştir, gönder'
                  : (replyingTo?.voice_url ? '🎙️ Sesli mesaj'
                     : replyingTo?.image_url ? '📷 Fotoğraf'
                     : (replyingTo?.content || '...'))}
              </Text>
            </View>
            <Pressable onPress={handleCancelComposeMode} hitSlop={8} style={styles.composeBannerClose}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
        )}
        {/* ★ v110.5.22 (6 May 2026): Block banner — SADECE engelleyen tarafa göster.
             Engellenen taraf engellendiğini bilmemeli (Instagram pattern).
             byThem durumunda input açık görünür, mesaj gönderme sessiz fail —
             karşı taraf zaten getInbox filter ile mesajları görmez. */}
        {isBlockedState.byMe && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingHorizontal: 16, paddingVertical: 10,
            backgroundColor: 'rgba(239,68,68,0.10)',
            borderTopWidth: 1, borderBottomWidth: 1,
            borderColor: 'rgba(239,68,68,0.25)',
          }}>
            <Ionicons name="ban" size={16} color="#EF4444" />
            <Text style={{ flex: 1, color: '#FCA5A5', fontSize: 12, fontWeight: '600' }}>
              Bu kullanıcıyı engellediniz. Mesajlaşmak için engeli kaldırın.
            </Text>
          </View>
        )}
        <View
          style={[
            styles.inputBar,
            { paddingBottom: Math.max(insets.bottom + 6, 20) },
            // Sadece engelleyen tarafta input disable. byThem'de görünüş normal (engellendiğini bilmesin).
            (!(isMutualFollow || msgRequestInfo.status === 'accepted' || msgRequestInfo.status === 'none') || isBlockedState.byMe) && { opacity: 0.4 },
          ]}
          pointerEvents={(!(isMutualFollow || msgRequestInfo.status === 'accepted' || msgRequestInfo.status === 'none') || isBlockedState.byMe) ? 'none' : 'auto'}
        >
          <Pressable style={styles.inputAction} onPress={() => setShowEmojiPicker(v => !v)}>
            <Ionicons name={showEmojiPicker ? 'close-circle' : 'happy-outline'} size={22} color={Colors.teal} style={styles.iconShadow} />
          </Pressable>
          <TextInput
            style={styles.textInput}
            placeholder={
              msgRequestInfo.status === 'pending_outgoing' ? 'Cevap bekleniyor...'
              : msgRequestInfo.status === 'pending_incoming' ? 'Önce isteği kabul et'
              : msgRequestInfo.status === 'rejected' ? 'Mesaj atılamaz'
              : (!isMutualFollow && msgRequestInfo.status === 'none') ? 'İlk mesajını yaz...'
              : 'Mesaj yaz...'
            }
            placeholderTextColor={Colors.text3}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={MSG_MAX_LENGTH}
            onFocus={() => setShowEmojiPicker(false)}
            editable={isMutualFollow || msgRequestInfo.status === 'accepted' || msgRequestInfo.status === 'none'}
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
                // ★ v110.5.15: Cache'e ekle
                DMCacheService.append(firebaseUser.uid, id, newMsg).catch(() => {});
              } catch {
                showToast({ title: 'Davet gönderilemedi', type: 'error' });
              }
            }}>
              <Ionicons name="radio" size={20} color={Colors.teal} style={styles.iconShadow} />
            </Pressable>
          )}
          {inputText.trim() ? (
            <Pressable style={styles.sendBtn} onPress={handleSend} disabled={sending}>
              <Ionicons name={editingMessageId ? 'checkmark' : 'send'} size={18} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              style={styles.inputAction}
              onPress={startRecording}
              disabled={sendingVoice}
            >
              {sendingVoice ? (
                <AppLoader size="small" color={Colors.teal} />
              ) : (
                <Ionicons name="mic" size={22} color={Colors.teal} style={styles.iconShadow} />
              )}
            </Pressable>
          )}
        </View>
        </View>
      )}

      {/* ★ v109: Disappearing messages picker — kaybolan mesaj süresi seçici */}
      <Modal visible={showDisappearingPicker} transparent animationType="fade" onRequestClose={() => setShowDisappearingPicker(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 24 }}
          onPress={() => setShowDisappearingPicker(false)}
        >
          <Pressable style={{
            backgroundColor: '#1a2433',
            borderRadius: 18, padding: 18,
            borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
          }}>
            <Text style={{ color: '#F1F5F9', fontSize: 16, fontWeight: '800', marginBottom: 4 }}>
              Kaybolan Mesaj Süresi
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 14 }}>
              Bu süre sonra mesajlar otomatik silinir (her iki tarafta).
            </Text>
            {[
              { sec: 0, label: 'Kapalı (sınırsız)' },
              { sec: 3600, label: '1 saat' },
              { sec: 86400, label: '24 saat' },
              { sec: 604800, label: '7 gün' },
              { sec: 2592000, label: '30 gün' },
            ].map(opt => (
              <Pressable
                key={opt.sec}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 12, paddingHorizontal: 12, marginVertical: 2,
                  backgroundColor: opt.sec === disappearingSeconds ? 'rgba(20,184,166,0.18)' : 'transparent',
                  borderRadius: 10,
                  borderWidth: opt.sec === disappearingSeconds ? 1 : 0,
                  borderColor: 'rgba(20,184,166,0.4)',
                }}
                onPress={async () => {
                  if (!firebaseUser?.uid || !id) return;
                  const r = await MessageService.setDisappearingTimer(firebaseUser.uid, id as string, opt.sec);
                  if (r.success) {
                    setDisappearingSeconds(opt.sec);
                    showToast({
                      title: opt.sec === 0 ? '✓ Kapatıldı' : `⏱ ${opt.label}`,
                      message: opt.sec === 0 ? 'Mesajlar artık sınırsız.' : 'Yeni mesajlar bu süre sonra silinecek.',
                      type: 'success',
                    });
                  } else {
                    showToast({ title: 'Hata', message: r.error || 'Tekrar dene.', type: 'error' });
                  }
                  setShowDisappearingPicker(false);
                }}
              >
                <Ionicons
                  name={opt.sec === disappearingSeconds ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={opt.sec === disappearingSeconds ? Colors.teal : 'rgba(255,255,255,0.4)'}
                />
                <Text style={{ color: '#F1F5F9', fontSize: 14, fontWeight: '600' }}>{opt.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ★ v109: Mesaj aksiyon menüsü — long press → bottom sheet */}
      <MessageActionMenu
        visible={!!actionMenuMsg}
        message={actionMenuMsg}
        isMe={!!actionMenuMsg && actionMenuMsg.sender_id === firebaseUser?.uid}
        onClose={() => setActionMenuMsg(null)}
        isSaved={actionMenuMsg ? savedIds.has(actionMenuMsg.id) : false}
        onReply={handleReplyTo}
        onForward={handleForwardMessage}
        onCopy={handleCopyMessage}
        onSave={handleSaveMessage}
        onEdit={handleStartEdit}
        onDeleteForEveryone={handleDeleteForEveryone}
        onDeleteFromChat={handleDeleteFromChat}
        onReport={handleReportMessage}
        onReact={async (msg, emoji) => {
          if (!firebaseUser) return;
          const existing: Record<string, string[]> = (msg as any)?.reactions ? JSON.parse((msg as any).reactions) : {};
          const myId = firebaseUser.uid;
          if (existing[emoji]?.includes(myId)) {
            existing[emoji] = existing[emoji].filter(uid => uid !== myId);
            if (existing[emoji].length === 0) delete existing[emoji];
          } else {
            if (!existing[emoji]) existing[emoji] = [];
            existing[emoji].push(myId);
          }
          const reactionsJson = JSON.stringify(existing);
          await MessageService.updateReaction(msg.id, reactionsJson, firebaseUser.uid);
          setMessages(prev => prev.map(m =>
            m.id === msg.id ? { ...m, reactions: reactionsJson } as any : m
          ));
        }}
      />

      {/* ★ Emoji Picker — input bar wrapper'ının içinde (bar'ın altında) inline panel */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        customEmojiSetId={(profile as any)?.active_emoji_id || null}
        onEmojiSelect={(emoji) => {
          setInputText(prev => prev + emoji);
        }}
      />
      </View>

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
              <Text style={styles.kebabItemText}>{t('messages.view_profile')}</Text>
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
              <Text style={styles.kebabItemText}>{t('messages.call')}</Text>
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
              <Text style={styles.kebabItemText}>{t('messages.media_links')}</Text>
            </Pressable>
            {/* ★ v109: Kaybolan Mesaj Süresi (disappearing) */}
            <Pressable
              style={styles.kebabItem}
              onPress={() => {
                setShowKebabMenu(false);
                setShowDisappearingPicker(true);
              }}
            >
              <Ionicons
                name={disappearingSeconds > 0 ? 'time' : 'time-outline'}
                size={20}
                color={disappearingSeconds > 0 ? Colors.teal : Colors.text2}
              />
              <Text style={styles.kebabItemText}>
                {disappearingSeconds > 0
                  ? `Kaybolan Mesaj: ${disappearingSeconds === 3600 ? '1 saat' : disappearingSeconds === 86400 ? '24 saat' : disappearingSeconds === 604800 ? '7 gün' : disappearingSeconds === 2592000 ? '30 gün' : 'Açık'}`
                  : 'Kaybolan Mesaj Süresi'}
              </Text>
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
              <Text style={[styles.kebabItemText, { color: '#EF4444' }]}>{t('messages.delete_chat')}</Text>
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
              <Text style={[styles.kebabItemText, { color: Colors.text3 }]}>{t('common.report')}</Text>
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
    </AppBackground>
  );
}

const msgReqBannerStyles = StyleSheet.create({
  // ★ 2026-04-29 v3: elevation kaldırıldı — Android'de gri gölge oluşturuyordu.
  //   shadow sadece iOS, Android'de border + bg yeterli.
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 12, marginTop: 10, marginBottom: 6,
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.45)',
    borderRadius: 14,
    ...Platform.select({
      ios: { shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6 },
      android: { elevation: 0 },
    }),
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '900', color: '#FBBF24', letterSpacing: 0.3 },
  subtitle: { fontSize: 12.5, fontWeight: '500', color: '#E2E8F0', marginTop: 3, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  btnReject: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.50)',
  },
  btnAccept: {
    backgroundColor: '#14B8A6',
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.55, shadowRadius: 8, elevation: 6,
  },
  // ★ 2026-04-29 v2: Instagram tarzı tam-genişlik buton (icon + label)
  btnFull: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, paddingHorizontal: 14,
    borderRadius: 12,
  },
  btnRejectFull: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.45)',
  },
  btnAcceptFull: {
    backgroundColor: '#14B8A6',
    ...Platform.select({
      ios: { shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.55, shadowRadius: 8 },
      android: {},
    }),
  },
  btnRejectText: { fontSize: 14, fontWeight: '800', color: '#F87171', letterSpacing: 0.3 },
  btnAcceptText: { fontSize: 14, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
});

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
  // ★ 2026-04-30 FIX: flexShrink:1 — adjustResize pencereyi küçülttüğünde FlatList
  //   tüm alanı alıp inputBar'ı ekran dışına itiyordu. flexShrink:1 ile FlatList
  //   inputBar'a yer bırakır.
  messageList: { flex: 1, flexShrink: 1 },
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
    // ★ 2026-05-05: Solid #37414f — yarı-saydam Colors.bg4 + elevation Android'de
    //   gölge sızdırıyordu (reaction pill arkası siyah leke). DmPanelDrawer ile aynı fix.
    backgroundColor: '#37414f',
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

  // ★ v109: Reply / Edit compose banner (input üstünde önizleme)
  composeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginTop: 4,
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: 'rgba(20,184,166,0.10)',
    borderRadius: 14,
    borderWidth: 0.5, borderColor: 'rgba(20,184,166,0.25)',
  },
  composeBannerAccent: {
    width: 3, alignSelf: 'stretch', borderRadius: 2,
    backgroundColor: '#14B8A6',
  },
  composeBannerLabel: {
    fontSize: 11, fontWeight: '800', color: '#14B8A6', letterSpacing: 0.3,
  },
  composeBannerSnippet: {
    fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1,
  },
  composeBannerClose: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  // ★ v109: Reply preview kartı (bubble içinde, alıntı görünümü)
  replyPreviewInBubble: {
    flexDirection: 'row', alignItems: 'stretch', gap: 8,
    marginBottom: 6,
    paddingVertical: 6, paddingRight: 8, paddingLeft: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 8, overflow: 'hidden',
  },
  replyAccent: {
    width: 3, backgroundColor: '#14B8A6',
  },
  replyAuthor: {
    fontSize: 11, fontWeight: '800', color: '#5EEAD4',
  },
  replyContent: {
    fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 1,
  },
  // ★ v109: Forwarded rozeti (bubble üstünde "İletildi")
  forwardedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: 4,
  },
  forwardedText: {
    fontSize: 10, fontStyle: 'italic', color: 'rgba(255,255,255,0.55)',
  },
  // ★ v109: Düzenlendi rozeti (bubble içinde sağ alt küçük)
  editedBadge: {
    fontSize: 9, fontStyle: 'italic',
    color: 'rgba(255,255,255,0.5)',
    alignSelf: 'flex-end', marginTop: 2,
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
