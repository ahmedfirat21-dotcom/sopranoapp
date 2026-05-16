/**
 * SopranoChat — Mesaj Aksiyon Menüsü (v109)
 * ═══════════════════════════════════════════════════════════════════
 * Long-press ile açılan bottom sheet — WhatsApp/Telegram pattern.
 * Üstte hızlı reaction emoji satırı, altında aksiyon listesi.
 *
 * Aksiyonlar (kendine veya karşıya göre dinamik filtrelenir):
 *  • Yanıtla        — her zaman
 *  • İlet           — her zaman
 *  • Kopyala        — her zaman (text varsa)
 *  • Kaydet         — her zaman (saved_messages)
 *  • Düzenle        — kendi mesajım + text + < 24h
 *  • Herkes İçin Sil— kendi mesajım + < 1h
 *  • Sohbetten Sil  — her zaman (kendine soft delete)
 *  • Bildir         — başkasının mesajı için
 */

import React, { useEffect, useRef } from 'react';
import { i18n } from '../services/i18n';
import { View, Text, StyleSheet, Pressable, Animated, Modal, Easing, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { Message } from '../types';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export interface MessageAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  message: Message | null;
  isMe: boolean;
  onClose: () => void;
  onReply?: (msg: Message) => void;
  onForward?: (msg: Message) => void;
  onCopy?: (msg: Message) => void;
  onSave?: (msg: Message) => void;
  onEdit?: (msg: Message) => void;
  onDeleteForEveryone?: (msg: Message) => void;
  onDeleteFromChat?: (msg: Message) => void;
  onReport?: (msg: Message) => void;
  onReact?: (msg: Message, emoji: string) => void;
  isSaved?: boolean;
  /** ★ v109: embedded — Modal yerine inline render. Oda içi DmPanel gibi
   *  zaten kendisi panel olan parent'larda kullanılır. Backdrop sadece
   *  parent container'ı kaplar, ekran tamamına yayılmaz. Tasarım kompakt. */
  embedded?: boolean;
}

export default function MessageActionMenu({
  visible, message, isMe, onClose,
  onReply, onForward, onCopy, onSave, onEdit, onDeleteForEveryone, onDeleteFromChat, onReport, onReact,
  isSaved, embedded = false,
}: Props) {
  const slideY = useRef(new Animated.Value(400)).current;
  const fadeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      Animated.parallel([
        Animated.timing(slideY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      slideY.setValue(400);
      fadeOpacity.setValue(0);
    }
  }, [visible]);

  // ★ 2026-05-05: Sürüklenerek kapatma — aşağı swipe ile kapan (Clubhouse/Telegram pattern)
  const closeWithAnim = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: 400, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => { if (g.dy > 0) slideY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.parallel([
            Animated.timing(slideY, { toValue: 400, duration: 200, useNativeDriver: true }),
            Animated.timing(fadeOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          ]).start(() => onClose());
        } else {
          Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
      },
    })
  ).current;

  if (!visible || !message) return null;

  const isText = !message.voice_url && !message.image_url;
  const ageMs = Date.now() - new Date(message.created_at).getTime();
  const canEdit = isMe && isText && ageMs < 24 * 60 * 60 * 1000 && !message.deleted_for_everyone;
  const canDeleteForEveryone = isMe && ageMs < 60 * 60 * 1000 && !message.deleted_for_everyone;

  const actions: MessageAction[] = [];
  if (onReply) actions.push({
    id: 'reply', label: i18n.t('messageactionmenu.001'), icon: 'arrow-undo-outline',
    onPress: () => { onReply(message); onClose(); },
  });
  if (onForward) actions.push({
    id: 'forward', label: i18n.t('messageactionmenu.002'), icon: 'arrow-redo-outline',
    onPress: () => { onForward(message); onClose(); },
  });
  if (onCopy && isText && message.content) actions.push({
    id: 'copy', label: 'Kopyala', icon: 'copy-outline',
    onPress: () => { onCopy(message); onClose(); },
  });
  if (onSave) actions.push({
    id: 'save', label: isSaved ? 'Kaydedilenden Çıkar' : 'Kaydet',
    icon: isSaved ? 'bookmark' : 'bookmark-outline',
    color: isSaved ? '#FBBF24' : undefined,
    onPress: () => { onSave(message); onClose(); },
  });
  if (canEdit && onEdit) actions.push({
    id: 'edit', label: i18n.t('messageactionmenu.003'), icon: 'create-outline',
    onPress: () => { onEdit(message); onClose(); },
  });
  if (canDeleteForEveryone && onDeleteForEveryone) actions.push({
    id: 'delete-everyone', label: i18n.t('messageactionmenu.004'),
    icon: 'trash-outline', destructive: true,
    onPress: () => { onDeleteForEveryone(message); onClose(); },
  });
  if (onDeleteFromChat) actions.push({
    id: 'delete-self', label: 'Sohbetten Sil',
    icon: 'close-circle-outline', destructive: true,
    onPress: () => { onDeleteFromChat(message); onClose(); },
  });
  if (!isMe && onReport) actions.push({
    id: 'report', label: 'Bildir',
    icon: 'flag-outline', destructive: true,
    onPress: () => { onReport(message); onClose(); },
  });

  // ★ İçerik (modal/embedded ortak)
  const sheetSize = embedded ? sCompact : s;
  const Body = (
    <>
      {/* Drag handle */}
      <View style={sheetSize.handle} />

      {/* Quick reactions row */}
      {onReact && !message.deleted_for_everyone && (
        <View style={sheetSize.reactionRow}>
          {QUICK_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              style={sheetSize.reactionBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onReact(message, emoji);
                onClose();
              }}
            >
              <Text style={sheetSize.reactionEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Action list */}
      <View style={sheetSize.actionList}>
        {actions.map((a, i) => (
          <Pressable
            key={a.id}
            onPress={a.onPress}
            style={({ pressed }) => [
              sheetSize.actionRow,
              i < actions.length - 1 && sheetSize.actionRowDivider,
              pressed && { backgroundColor: 'rgba(255,255,255,0.05)' },
            ]}
          >
            <Ionicons
              name={a.icon}
              size={embedded ? 17 : 20}
              color={a.destructive ? '#F87171' : (a.color || '#F1F5F9')}
            />
            <Text style={[
              sheetSize.actionLabel,
              a.destructive && { color: '#F87171' },
              a.color && !a.destructive && { color: a.color },
            ]}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  // ★ v109: Embedded mode — Modal yerine inline render. Parent pozisyonu yönetir.
  //   Backdrop sadece parent container'a sığar, ekranın tamamını koyulaştırmaz.
  // ★ 2026-05-05: NotificationDrawer dili (bildirim modalı ailesi) — 3 katman gradient
  //   (slate diagonal + teal halo + soft glow) + sürüklenerek kapatma + backdrop tap.
  if (embedded) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Backdrop — boş yere tıklayınca kapanır */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeOpacity }]}>
          <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(8,12,22,0.45)' }]} onPress={closeWithAnim} />
        </Animated.View>
        {/* Sheet — pan ile aşağı sürüklenerek kapanır */}
        <Animated.View
          style={[sCompact.sheet, { transform: [{ translateY: slideY }] }]}
          {...panResponder.panHandlers}
        >
          <LinearGradient
            colors={['#3a4658', '#2a3344', '#1a2030']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(20,184,166,0.20)', 'rgba(20,184,166,0.05)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(20,184,166,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {Body}
        </Animated.View>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeOpacity }]}>
        <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(8,12,22,0.45)' }]} onPress={closeWithAnim} />
      </Animated.View>

      <Animated.View
        style={[s.sheet, { transform: [{ translateY: slideY }] }]}
        {...panResponder.panHandlers}
      >
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(20,184,166,0.20)', 'rgba(20,184,166,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(20,184,166,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {Body}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    overflow: 'hidden',
    paddingBottom: 24, paddingTop: 10,
    backgroundColor: '#1a2030',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
  },
  handle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center', marginBottom: 12, marginTop: 4,
  },
  reactionRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
    marginHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  reactionBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 22 },
  actionList: {
    marginHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  actionRowDivider: {
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  actionLabel: { fontSize: 14, fontWeight: '600', color: '#F1F5F9' },
});

// ★ v109: Embedded (oda içi DmPanel) için kompakt stiller — RoomChatDrawer paletiyle uyumlu
//   Daha küçük padding, tipografi, daha kompakt reactions row.
const sCompact = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    overflow: 'hidden',
    paddingBottom: 14, paddingTop: 6,
    backgroundColor: '#1a2030',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  handle: {
    width: 36, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'center', marginBottom: 8, marginTop: 4,
  },
  reactionRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 8, paddingVertical: 6, marginBottom: 8,
    marginHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 0.5, borderColor: 'rgba(20,184,166,0.18)',
  },
  reactionBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 18 },
  actionList: {
    marginHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  actionRowDivider: {
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  actionLabel: { fontSize: 13, fontWeight: '600', color: '#F1F5F9' },
});
