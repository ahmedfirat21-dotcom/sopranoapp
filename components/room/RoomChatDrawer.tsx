/**
 * SopranoChat — Room Chat Drawer (bottom sheet)
 * Clubhouse backchannel pattern: alt barın arkasından yukarı kayar,
 * swipe-down ile kapanır. Sadece mesajlar — emoji/GIF ayrı EmojiDrawer'da.
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder, Pressable,
  TextInput, FlatList, Image, Dimensions, Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAvatarSource } from '../../constants/avatars';
import { EmojiReactionBar } from '../EmojiReactions';

const { height: SCREEN_H } = Dimensions.get('window');
// ★ 2026-04-22: Instagram yorumları pattern'i — iki snap point.
//   HALF: varsayılan açılış, ekranın yarısından biraz fazlası.
//   FULL: yukarı swipe ile ekrana yayılır (status bar'a yakın).
const PANEL_HEIGHT_HALF = Math.min(520, Math.floor(SCREEN_H * 0.72));
const PANEL_HEIGHT_FULL = Math.floor(SCREEN_H * 0.92);

interface ChatMsg {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles?: { display_name: string; avatar_url?: string; subscription_tier?: string };
  isSystem?: boolean;
  role?: string;
}

const ROLE_NAME_COLORS: Record<string, string> = {
  owner: '#D4AF37', host: '#D4AF37',
  moderator: '#A78BFA', admin: '#EF4444',
};
const TIER_NAME_COLORS: Record<string, string> = {
  Pro: '#FBBF24', Plus: '#14B8A6',
};
const HASH_COLORS = ['#38BDF8', '#FB923C', '#A78BFA', '#34D399', '#F472B6', '#FBBF24', '#818CF8', '#22D3EE', '#F87171', '#4ADE80'];
function getUserColor(userId: string, role?: string, tier?: string): string {
  if (role && ROLE_NAME_COLORS[role]) return ROLE_NAME_COLORS[role];
  if (tier && TIER_NAME_COLORS[tier]) return TIER_NAME_COLORS[tier];
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
  /** Raw içerik gönder (input'u bypass). GIF'ler ve emoji reaksiyonlar için. */
  onSendRaw?: (content: string) => void;
}

export default function RoomChatDrawer({
  visible, messages, chatInput, onChangeInput, onSend, onClose, bottomInset, onSendRaw,
}: Props) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // ★ 2026-04-23 (v11): react-native-keyboard-controller entegre edildi.
  //   Tüm kendi hack'lerim (kbHeight state, auto-expand, Keyboard.addListener)
  //   kaldırıldı. Library'nin KeyboardAvoidingView'ı input'u klavye üstüne kaldırır.
  const BAR_OFFSET = bottomInset + 76;
  const HALF_TOTAL = PANEL_HEIGHT_HALF + BAR_OFFSET;
  const FULL_TOTAL = PANEL_HEIGHT_FULL + BAR_OFFSET;
  const CLOSED_Y = FULL_TOTAL;

  // ★ Snap point state — 'half' varsayılan, 'full' yukarı swipe ile
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  useEffect(() => { expandedRef.current = expanded; }, [expanded]);

  // ★ 2026-04-23 (v8 — SIMPLE): bottom + height, position:absolute.
  //   Klavye shift'i `bottom: kbHeight` ile. topAnim yok — height fixed.
  //   Input'un pozisyonu artık sadece bottom:kbHeight'e bağlı, layout hesabı
  //   otomatik: panel bottom klavye üstünde, height sabit, input panel dibinde.
  const heightAnim = useRef(new Animated.Value(HALF_TOTAL)).current;
  useEffect(() => {
    Animated.spring(heightAnim, {
      toValue: expanded ? FULL_TOTAL : HALF_TOTAL,
      useNativeDriver: false,
      damping: 22,
      stiffness: 220,
    }).start();
  }, [expanded, HALF_TOTAL, FULL_TOTAL]);

  const translateY = useRef(new Animated.Value(FULL_TOTAL + 200)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  // ★ 2026-04-23: Internal mount state — parent visible=false olunca hemen unmount
  //   yerine, kapanış animasyonu bitince unmount. Aksi halde modal kesik görünür.
  const [mounted, setMounted] = useState(visible);

  // Drawer kapanırken snap'i half'e sıfırla ki tekrar açılışta half başlasın
  useEffect(() => {
    if (!visible) setExpanded(false);
  }, [visible]);

  // Drawer kapanınca emoji picker'ı da sıfırla
  useEffect(() => {
    if (!visible) setShowEmojiPicker(false);
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: false, damping: 20, stiffness: 200 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: CLOSED_Y, duration: 220, useNativeDriver: false }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Hem yukarı hem aşağı swipe'ı yakala
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        // Sadece aşağı drag sırasında translateY ile görsel feedback (kapatma önizlemesi);
        // yukarı drag'de state/height animasyonu release'te karar verir, drag sırasında hareketsiz.
        if (gs.dy > 0 && !expandedRef.current) {
          translateY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        const isUp = gs.dy < -30 || gs.vy < -0.5;
        const isDown = gs.dy > 60 || gs.vy > 0.5;

        if (isUp && !expandedRef.current) {
          // Yukarı swipe + half → full
          setExpanded(true);
          Animated.spring(translateY, { toValue: 0, useNativeDriver: false, damping: 20, stiffness: 200 }).start();
        } else if (isDown && expandedRef.current) {
          // Aşağı swipe + full → half
          setExpanded(false);
          Animated.spring(translateY, { toValue: 0, useNativeDriver: false, damping: 20, stiffness: 200 }).start();
        } else if (isDown && !expandedRef.current) {
          // Aşağı swipe + half → kapat
          Animated.timing(translateY, { toValue: CLOSED_Y, duration: 200, useNativeDriver: false }).start(() => {
            onClose();
          });
        } else {
          // Eşik altı — mevcut state'e snap
          Animated.spring(translateY, { toValue: 0, useNativeDriver: false, damping: 20, stiffness: 200 }).start();
        }
      },
    })
  ).current;

  if (!mounted) return null;

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
    const gifMatch = content.match(/^\[gif:(.*)\]$/);
    const isGifSafe = gifMatch?.[1] && /^https:\/\/(media\.tenor\.com|media[0-9]*\.giphy\.com|i\.giphy\.com)\//i.test(gifMatch[1]);
    const emojiOnly = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}‍️⃣]{1,6}$/u.test(content) && content.length <= 14;
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
    <>
      <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 48 }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]} />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          s.panel,
          {
            // ★ 2026-04-23 (v9 — CLEAN): adjustResize'a güven. bottom:0, height:heightAnim.
            // Input KAV ile klavye üstünde sabitlenir (absolute overlay).
            bottom: 0,
            height: heightAnim,
            paddingBottom: BAR_OFFSET,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* ★ DM panel paleti — aynı görsel dil */}
        <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} locations={[0, 0.35, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 20, borderTopRightRadius: 20 }]} />

        <View {...panResponder.panHandlers}>
          <View style={s.handle}>
            <View style={s.handleBar} />
          </View>

          <View style={s.header}>
            <Ionicons name="chatbubble-ellipses" size={18} color="#14B8A6" style={s.headerIconShadow} />
            <Text style={s.headerTitle}>Oda Sohbeti</Text>
          </View>
        </View>

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

        {/* ★ 2026-04-23 (v11 — KEYBOARD-CONTROLLER): react-native-keyboard-controller'ın
             KeyboardAvoidingView'ı ile input klavye üstüne otomatik taşınır.
             Native IME animation tracking, Samsung quirks handled. */}
        <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={bottomInset}>
        {showEmojiPicker && (
          <View style={s.pickerWrap}>
            <EmojiReactionBar
              onReaction={(content: string) => {
                if (content.startsWith('[gif:')) {
                  onSendRaw?.(content);
                  setShowEmojiPicker(false);
                } else {
                  onChangeInput((chatInput || '') + content);
                }
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          </View>
        )}
        <View style={s.inputWrap}>
          <Pressable
            onPress={() => {
              if (!showEmojiPicker) Keyboard.dismiss();
              setShowEmojiPicker(v => !v);
            }}
            style={s.emojiToggle}
            hitSlop={6}
            accessibilityLabel="Emoji ve GIF"
          >
            <Ionicons
              name={showEmojiPicker ? 'close-outline' : 'happy-outline'}
              size={22}
              color={showEmojiPicker ? '#5CE1E6' : 'rgba(255,255,255,0.55)'}
            />
          </Pressable>
          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder="Bir mesaj yaz..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={chatInput}
            onChangeText={onChangeInput}
            onFocus={() => setShowEmojiPicker(false)}
            maxLength={300}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              onSend();
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
    </>
  );
}

const s = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#95a1ae',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(20,184,166,0.06)',
  },
  headerIconShadow: {},
  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  list: { flex: 1 },

  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  msgAvatar: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5, borderColor: 'rgba(20,184,166,0.3)',
    marginTop: 2,
  },
  msgBubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderTopLeftRadius: 4,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  msgName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#14B8A6',
    marginBottom: 2,
  },
  msgText: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
  },

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

  pickerWrap: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  emojiToggle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
