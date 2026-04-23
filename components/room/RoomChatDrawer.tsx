/**
 * SopranoChat — Room Chat Drawer
 * Clubhouse-style chat overlay. Full-screen modal, native keyboard handling.
 * react-native-keyboard-controller KeyboardAvoidingView used for input lift.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, Pressable, TextInput,
  FlatList, Image, Platform, PanResponder,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAvatarSource } from '../../constants/avatars';
import { EmojiReactionBar } from '../EmojiReactions';

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
  onSendRaw?: (content: string) => void;
}

export default function RoomChatDrawer({
  visible, messages, chatInput, onChangeInput, onSend, onClose, onSendRaw,
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ── Mount + slide-in animation ──────────────────────────────
  const [mounted, setMounted] = useState(visible);
  const slideY = useRef(new Animated.Value(1000)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 1000, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]);

  useEffect(() => { if (!visible) setShowEmojiPicker(false); }, [visible]);

  // ── Swipe down to close (only from header area) ────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 10 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) slideY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          Animated.timing(slideY, { toValue: 1000, duration: 200, useNativeDriver: true })
            .start(() => onClose());
        } else {
          Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
      },
    })
  ).current;

  const renderMessage = useCallback(({ item }: { item: ChatMsg }) => {
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
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { zIndex: 48, opacity: backdropOpacity }]}
        pointerEvents="box-none"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Full-screen chat panel — Clubhouse pattern */}
      <Animated.View
        style={[
          s.panel,
          {
            paddingTop: insets.top,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        <LinearGradient
          colors={['#1a2332', '#0f1824', '#0a111c']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* KAV — library, handles IME animation natively */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header with swipe-to-close — fixed at top */}
          <View {...panResponder.panHandlers} collapsable={false}>
            <View style={s.handle}>
              <View style={s.handleBar} />
            </View>
            <View style={s.header}>
              <Pressable onPress={onClose} style={s.headerBtn} hitSlop={12}>
                <Ionicons name="chevron-down" size={22} color="#F1F5F9" />
              </Pressable>
              <View style={s.headerTitleWrap}>
                <Ionicons name="chatbubble-ellipses" size={16} color="#14B8A6" />
                <Text style={s.headerTitle}>Oda Sohbeti</Text>
              </View>
              <View style={s.headerBtn} />
            </View>
          </View>

          {/* Messages — inverted so new at bottom */}
          <FlatList
            data={messages}
            keyExtractor={(m, i) => m?.id || `msg_${i}`}
            renderItem={renderMessage}
            style={s.list}
            inverted
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          />

          {/* Emoji picker (conditional) */}
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

          {/* Input bar — bottom, keyboard-aware via KAV */}
          <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <Pressable
              onPress={() => {
                if (!showEmojiPicker) {
                  inputRef.current?.blur();
                }
                setShowEmojiPicker(v => !v);
              }}
              style={s.iconBtn}
              hitSlop={6}
            >
              <Ionicons
                name={showEmojiPicker ? 'close-outline' : 'happy-outline'}
                size={24}
                color={showEmojiPicker ? '#5CE1E6' : 'rgba(255,255,255,0.55)'}
              />
            </Pressable>
            <TextInput
              ref={inputRef}
              style={s.input}
              placeholder="Bir mesaj yaz..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={chatInput}
              onChangeText={onChangeInput}
              onFocus={() => setShowEmojiPicker(false)}
              maxLength={300}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={() => { onSend(); inputRef.current?.focus(); }}
            />
            <Pressable
              style={[s.sendBtn, !chatInput.trim() && { opacity: 0.35 }]}
              onPress={() => { onSend(); inputRef.current?.focus(); }}
              disabled={!chatInput.trim()}
              hitSlop={6}
            >
              <Ionicons name="send" size={18} color="#FFF" />
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
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 50,
    overflow: 'hidden',
  },

  handle: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.2 },

  list: { flex: 1 },
  listContent: { paddingVertical: 12, paddingHorizontal: 12, gap: 10 },

  pickerWrap: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#F1F5F9',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#14B8A6',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Messages ──
  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  msgAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5 },
  msgBubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  msgName: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  msgText: { fontSize: 14, color: '#E2E8F0', lineHeight: 19 },
  sysMsg: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12,
  },
  sysMsgText: { fontSize: 11, color: '#94A3B8', textAlign: 'center' },
});
