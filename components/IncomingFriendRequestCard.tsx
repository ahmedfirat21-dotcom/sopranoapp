/**
 * SopranoChat — Inline Arkadaşlık İsteği Kartı
 * ★ 2026-04-24: Toast yerine actionable premium card.
 *   Ekranın üstünden slide-in + avatar + onayla/reddet butonları.
 *   Aynı FriendshipService API'sini kullandığı için keşfet arkadaş drawer ile senkron.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import AppLoader from './AppLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FriendshipService } from '../services/friendship';
import StatusAvatar from './StatusAvatar';
import { Colors } from '../constants/theme';
// ★ v107.32: Cycle kırma — _layout yerine direkt context dosyasından
import { useUserProfileSheet } from '../providers/UserProfileSheetContext';

export interface IncomingFriendRequest {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  /** ★ v107: Mağaza avatar çerçevesi */
  senderFrame?: string | null;
  /** ★ v283 (16 May 2026): profiles.active_badge_id — mini avatar rozeti */
  senderActiveBadgeId?: string | null;
  notificationId?: string;
  currentUserId: string;
}

interface Props {
  request: IncomingFriendRequest | null;
  onDismiss: () => void;
  /** Onay/red sonrası parent'a bildirim — pendingFollows counter güncellensin */
  onHandled?: (action: 'approved' | 'rejected') => void;
}

const AUTO_DISMISS_MS = 12000;

export default function IncomingFriendRequestCard({ request, onDismiss, onHandled }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-220)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [processing, setProcessing] = useState(false);
  const { openUserProfile } = useUserProfileSheet();
  const [result, setResult] = useState<null | 'approved' | 'rejected'>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!request) return;
    setProcessing(false);
    setResult(null);
    translateY.setValue(-220);
    opacity.setValue(0);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    });

    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => animateOut(), AUTO_DISMISS_MS);
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [request?.senderId]);

  const animateOut = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -220, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  const handleAction = async (action: 'approved' | 'rejected') => {
    if (!request || processing) return;
    setProcessing(true);
    try {
      const fn = action === 'approved' ? FriendshipService.approveRequest : FriendshipService.rejectRequest;
      const res = await fn(request.currentUserId, request.senderId);
      if (res?.success) {
        setResult(action);
        onHandled?.(action);
        // Success feedback göster, 1.2s sonra kapat
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = setTimeout(() => animateOut(), 1200);
      } else {
        setProcessing(false);
      }
    } catch {
      setProcessing(false);
    }
  };

  if (!request) return null;

  const accent = result === 'approved' ? '#22C55E' : result === 'rejected' ? '#EF4444' : '#60A5FA';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        s.wrap,
        { paddingTop: insets.top + 8, transform: [{ translateY }], opacity },
      ]}
    >
      <View style={s.card}>
        <LinearGradient
          colors={['rgba(48,65,94,0.96)', 'rgba(26,40,64,0.92)', 'rgba(12,22,40,0.88)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={[s.accentBar, { backgroundColor: accent }]} pointerEvents="none" />
        <View style={s.row}>
          {/* ★ 2026-04-26: Avatar/isim tıklanınca profil sheet — gönderen kim diye bakabilir kullanıcı */}
          <Pressable onPress={() => openUserProfile(request.senderId)} hitSlop={6}>
            <StatusAvatar uri={request.senderAvatar} size={44} frameId={request.senderFrame || null} customBadgeId={request.senderActiveBadgeId ?? null} />
          </Pressable>
          <Pressable style={s.textWrap} onPress={() => openUserProfile(request.senderId)} hitSlop={4}>
            <Text style={s.title} numberOfLines={1}>{request.senderName}</Text>
            <Text style={s.subtitle} numberOfLines={1}>
              {result === 'approved' ? '✓ Arkadaşlık onaylandı' : result === 'rejected' ? '✗ İstek reddedildi' : 'seninle arkadaş olmak istiyor'}
            </Text>
          </Pressable>
          {result ? (
            <Ionicons
              name={result === 'approved' ? 'checkmark-circle' : 'close-circle'}
              size={28}
              color={accent}
              style={s.iconShadow}
            />
          ) : processing ? (
            <AppLoader size="small" color={Colors.teal} />
          ) : (
            <View style={s.actions}>
              <Pressable style={[s.btn, s.btnReject]} onPress={() => handleAction('rejected')} hitSlop={6}>
                <Ionicons name="close" size={18} color="#FCA5A5" style={s.iconShadow} />
              </Pressable>
              <Pressable style={[s.btn, s.btnApprove]} onPress={() => handleAction('approved')} hitSlop={6}>
                <Ionicons name="checkmark" size={18} color="#FFF" style={s.iconShadow} />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 12,
    zIndex: 10000,
    elevation: 30,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
  },
  accentBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textWrap: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 14, fontWeight: '800', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 12, color: '#94A3B8', marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  actions: { flexDirection: 'row', gap: 8 },
  btn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnReject: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  btnApprove: {
    backgroundColor: '#14B8A6',
    borderColor: 'rgba(20,184,166,0.6)',
  },
  iconShadow: { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
});
