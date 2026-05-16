/**
 * SopranoChat — Oda Erişim Prompt'ları
 * ═══════════════════════════════════════════════════════
 * Aşağıdan-yukarı bottom sheet ile oda girişi:
 *   - PasswordPromptSheet: Şifreli oda (closed) için şifre girişi
 *   - AccessRequestSheet : Davetli oda (invite) için istek bekleme + realtime onay/red
 *
 * Tasarım notları:
 *   - Opak gradient zemin (okunabilirlik için şeffaflık yok)
 *   - Slide-up + swipe-to-dismiss
 *   - Password: secureTextEntry + reveal toggle, shake hata feedback
 *   - Access request: realtime subscribe room_access_requests → accepted ise otomatik geçer,
 *     rejected ise bilgi verip çıkar. Kullanıcı "Vazgeç" ile isteği iptal edebilir.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Animated,
  Dimensions, Platform, KeyboardAvoidingView,
  PanResponder, Image, ImageBackground,
} from 'react-native';
import AppLoader from '../AppLoader';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SkiaShadow } from '../skia';
import { supabase } from '../../constants/supabase';
import { getAvatarSource } from '../../constants/avatars';
import { i18n } from '../../services/i18n';

const { height: H } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════
// BASE BOTTOM SHEET — slide-up + swipe-to-dismiss
// ═══════════════════════════════════════════════════════
function BaseSheet({ visible, onDismiss, children, maxHeight = H * 0.55 }: {
  visible: boolean; onDismiss: () => void; children: React.ReactNode; maxHeight?: number;
}) {
  const slideY = useRef(new Animated.Value(H)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 180 }),
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: H, duration: 220, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 10 && Math.abs(gs.dx) < 20,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) slideY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          Animated.timing(slideY, { toValue: H, duration: 200, useNativeDriver: true }).start(() => onDismiss());
        } else {
          Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  return (
    // ★ zIndex 1100: AccessGate (zIndex 900) üzerinde kalır. Aksi halde opak gate
    // sheet'i kaplayıp şifre ekranı görünmüyordu.
    <View style={[StyleSheet.absoluteFill, { zIndex: 1100, elevation: 1100 }]} pointerEvents="box-none">
      <Animated.View style={[st.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>

      {/* ★ 2026-04-26 FIX: Android'de behavior=undefined NO-OP → klavye sheet'i kaplıyordu.
            iOS: padding, Android: height — her iki platformda da sheet klavyenin üstüne kayar. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <Animated.View style={[st.sheet, { transform: [{ translateY: slideY }], maxHeight }]}>
          <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} locations={[0, 0.35, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View {...panResponder.panHandlers} style={st.handleWrap}>
            <View style={st.handle} />
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// PASSWORD PROMPT SHEET
// ═══════════════════════════════════════════════════════
export function PasswordPromptSheet({
  visible, onDismiss, onSubmit, submitting, error, roomName, hostName, onViewHost,
}: {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (password: string) => void;
  submitting?: boolean;
  error?: string;
  roomName?: string;
  hostName?: string;
  /** Host profiline yönlendir — error durumunda "Oda sahibi ile iletişime geç" CTA'sı gösterilir. */
  onViewHost?: () => void;
}) {
  const [pw, setPw] = useState('');
  const [reveal, setReveal] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => { if (visible) { setPw(''); setReveal(false); setAttemptCount(0); } }, [visible]);
  useEffect(() => { if (error) setAttemptCount(c => c + 1); }, [error]);

  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  return (
    <BaseSheet visible={visible} onDismiss={onDismiss} maxHeight={H * 0.5}>
      <View style={st.body}>
        <View style={st.headerRow}>
          <View style={st.iconBig}>
            <Ionicons name="lock-closed" size={22} color="#14B8A6" style={st.iconShadow} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>{i18n.t('access.locked_room')}</Text>
            <Text style={st.subtitle} numberOfLines={1}>{roomName || i18n.t('auto.room.RoomAccessPrompts.014')}</Text>
          </View>
        </View>

        <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
          <View style={[st.inputWrap, error && { borderColor: 'rgba(239,68,68,0.5)' }]}>
            <Ionicons name="key-outline" size={16} color="#94A3B8" />
            <TextInput
              style={st.input}
              value={pw}
              onChangeText={setPw}
              placeholder={i18n.t('room.roomaccessprompts.003')}
              placeholderTextColor="#475569"
              secureTextEntry={!reveal}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={20}
              returnKeyType="go"
              onSubmitEditing={() => pw.trim() && onSubmit(pw.trim())}
            />
            <Pressable onPress={() => setReveal(r => !r)} hitSlop={8}>
              <Ionicons name={reveal ? 'eye-off-outline' : 'eye-outline'} size={16} color="#94A3B8" />
            </Pressable>
          </View>
        </Animated.View>

        {error ? (
          <View style={{ marginTop: 6, marginBottom: 8 }}>
            <Text style={st.error}>{error}</Text>
            {/* 2+ yanlış denemeden sonra host ile iletişim önerisi */}
            {attemptCount >= 2 && onViewHost && (
              <Pressable onPress={onViewHost} style={st.inlineHint} hitSlop={6}>
                <Ionicons name="person-circle-outline" size={13} color="#5EEAD4" />
                <Text style={st.inlineHintText}>
                  Şifreyi {hostName ? `${hostName}'dan` : 'oda sahibinden'} iste — profile git
                </Text>
                <Ionicons name="chevron-forward" size={11} color="#5EEAD4" />
              </Pressable>
            )}
          </View>
        ) : (
          <Text style={[st.hint, { marginTop: 2, marginBottom: 8 }]}>
            {hostName ? `${hostName}` : 'Oda sahibi'} odayı şifre ile korudu. Doğru şifreyi girersen direkt dinleyici olarak katılırsın.
          </Text>
        )}

        <View style={st.btnRow}>
          <Pressable style={st.btnSecondary} onPress={onDismiss} disabled={submitting}>
            <Text style={st.btnSecondaryText}>{i18n.t('access.cancel')}</Text>
          </Pressable>
          <SkiaShadow shadowColor="#14B8A6" shadowOpacity={pw.length > 0 && !submitting ? 0.4 : 0} shadowBlur={10} shadowOffsetY={4} borderRadius={12} style={{ flex: 1.4 }}>
            <Pressable
              style={[st.btnPrimary, (submitting || pw.length < 1) && { opacity: 0.5 }, { flex: 1 }]}
              onPress={() => pw.trim() && onSubmit(pw.trim())}
              disabled={submitting || pw.length < 1}
            >
              {submitting ? (
                <AppLoader color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={14} color="#FFF" />
                  <Text style={st.btnPrimaryText}>{i18n.t('access.enter')}</Text>
                </>
              )}
            </Pressable>
          </SkiaShadow>
        </View>
      </View>
    </BaseSheet>
  );
}

// ═══════════════════════════════════════════════════════
// ENTRY PREVIEW SHEET — Filtreli odaya girmeden önce şartları topu göster
// ★ 2026-04-27: Şifre/davet/arkadaş/yaş gibi filtreleri kullanıcıya ÖNCEDEN
//   bullet liste olarak gösterir. Devam et → normal access flow başlar.
//   Kullanıcı bilinçli karar verir, "neden bu kadar engel" sürprizi yaşamaz.
// ═══════════════════════════════════════════════════════
export type EntryPreviewFilter = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  desc: string;
};

export function RoomEntryPreviewSheet({
  visible, onContinue, onCancel, roomName, hostName, filters,
}: {
  visible: boolean;
  onContinue: () => void;
  onCancel: () => void;
  roomName?: string;
  hostName?: string;
  filters: EntryPreviewFilter[];
}) {
  return (
    <BaseSheet visible={visible} onDismiss={onCancel} maxHeight={H * 0.7}>
      <View style={st.body}>
        <View style={st.headerRow}>
          <View style={st.iconBig}>
            <Ionicons name="information-circle" size={22} color="#3B82F6" style={st.iconShadow} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>{roomName || 'Bu Oda'}</Text>
            <Text style={st.subtitle} numberOfLines={2}>
              {hostName ? i18n.t('auto.room.RoomAccessPrompts.013', { 0: hostName }) : i18n.t('auto.room.RoomAccessPrompts.012')}
            </Text>
          </View>
        </View>

        <View style={{ gap: 8, marginBottom: 14 }}>
          {filters.map((f, idx) => (
            <View key={`${f.title}-${idx}`} style={st.filterRow}>
              <View style={[st.filterIconWrap, { backgroundColor: `${f.color}1A`, borderColor: `${f.color}55` }]}>
                <Ionicons name={f.icon} size={16} color={f.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.filterTitle}>{f.title}</Text>
                <Text style={st.filterDesc} numberOfLines={2}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={st.btnRow}>
          <Pressable style={st.btnSecondary} onPress={onCancel}>
            <Text style={st.btnSecondaryText}>{i18n.t('access.cancel')}</Text>
          </Pressable>
          <SkiaShadow shadowColor="#14B8A6" shadowOpacity={0.4} shadowBlur={10} shadowOffsetY={4} borderRadius={12} style={{ flex: 1.4 }}>
            <Pressable style={[st.btnPrimary, { flex: 1 }]} onPress={onContinue}>
              <Ionicons name="arrow-forward" size={14} color="#FFF" />
              <Text style={st.btnPrimaryText}>{i18n.t('access.continue')}</Text>
            </Pressable>
          </SkiaShadow>
        </View>
      </View>
    </BaseSheet>
  );
}

// ═══════════════════════════════════════════════════════
// INVITE REQUEST PROMPT — Davetli odada "İstek gönder?" onayı
// ★ 2026-04-26: Pop alert yerine bottom-sheet — şifre sheet'i ile tutarlı dil
// ═══════════════════════════════════════════════════════
export function InviteRequestPromptSheet({
  visible, onDismiss, onConfirm, submitting, roomName, hostName,
}: {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  submitting?: boolean;
  roomName?: string;
  hostName?: string;
}) {
  return (
    <BaseSheet visible={visible} onDismiss={onDismiss} maxHeight={H * 0.5}>
      <View style={st.body}>
        <View style={st.headerRow}>
          <View style={st.iconBig}>
            <Ionicons name="mail-open-outline" size={22} color="#3B82F6" style={st.iconShadow} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>{i18n.t('access.invite_room')}</Text>
            <Text style={st.subtitle} numberOfLines={2}>
              {roomName ? i18n.t('auto.room.RoomAccessPrompts.011', { 0: roomName }) : i18n.t('auto.room.RoomAccessPrompts.010')} Katılmak için oda sahibine istek gönderebilirsin.
            </Text>
          </View>
        </View>

        <View style={st.statusCard}>
          <Ionicons name="information-circle" size={16} color="#94A3B8" />
          <Text style={st.statusText}>
            {hostName ? i18n.t('auto.room.RoomAccessPrompts.009', { 0: hostName }) : i18n.t('auto.room.RoomAccessPrompts.008')} Onaylanırsa direkt odaya alınırsın.
          </Text>
        </View>

        <View style={st.btnRow}>
          <Pressable style={st.btnSecondary} onPress={onDismiss} disabled={submitting}>
            <Text style={st.btnSecondaryText}>{i18n.t('access.cancel')}</Text>
          </Pressable>
          <SkiaShadow shadowColor="#14B8A6" shadowOpacity={submitting ? 0 : 0.4} shadowBlur={10} shadowOffsetY={4} borderRadius={12} style={{ flex: 1.4 }}>
            <Pressable
              style={[st.btnPrimary, submitting && { opacity: 0.5 }, { flex: 1 }]}
              onPress={onConfirm}
              disabled={submitting}
            >
              {submitting ? (
                <AppLoader color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={14} color="#FFF" />
                  <Text style={st.btnPrimaryText}>{i18n.t('access.send_request')}</Text>
                </>
              )}
            </Pressable>
          </SkiaShadow>
        </View>
      </View>
    </BaseSheet>
  );
}

// ═══════════════════════════════════════════════════════
// ACCESS REQUEST SHEET — Davetli oda için bekleme + realtime
// ═══════════════════════════════════════════════════════
export function AccessRequestSheet({
  visible, roomId, userId, roomName, hostName, onApproved, onRejected, onCancelled, onViewHost, onDiscoverRooms,
}: {
  visible: boolean;
  roomId: string | null;
  userId: string | null;
  roomName?: string;
  hostName?: string;
  onApproved: () => void;
  onRejected: (reason?: string) => void;
  onCancelled: () => void;
  /** Rejected durumunda "Host'u Gör" CTA'sı — verilirse sheet içinde buton gösterilir. */
  onViewHost?: () => void;
  /** Rejected durumunda "Başka Odalar" CTA'sı — verilirse sheet içinde buton gösterilir. */
  onDiscoverRooms?: () => void;
}) {
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [cancelling, setCancelling] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulse animation for waiting icon
  useEffect(() => {
    if (!visible || status !== 'pending') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, status]);

  // Realtime subscription — status değiştiğinde tepki ver
  useEffect(() => {
    if (!visible || !roomId || !userId) return;
    setStatus('pending');

    const ch = supabase
      .channel(`access_req:${roomId}:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'room_access_requests', filter: `room_id=eq.${roomId}` },
        (payload: any) => {
          const row = payload.new;
          if (row?.user_id === userId) {
            if (row.status === 'accepted') {
              setStatus('accepted');
              setTimeout(() => onApproved(), 600); // kısa gecikme — kullanıcı onayı görsün
            } else if (row.status === 'rejected') {
              setStatus('rejected');
              // Sheet'i KAPATMA — kullanıcı CTA butonuna (Host'u Gör / Başka Odalar / Kapat) bassın.
              // CTA yoksa birkaç saniye sonra geri dön.
              if (!onViewHost && !onDiscoverRooms) {
                setTimeout(() => onRejected(i18n.t('auto.room.RoomAccessPrompts.007')), 1500);
              }
            }
          }
        }
      )
      .subscribe();

    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [visible, roomId, userId, onApproved, onRejected, onViewHost, onDiscoverRooms]);

  const handleCancel = useCallback(async () => {
    if (!roomId || !userId) { onCancelled(); return; }
    setCancelling(true);
    try {
      // Pending kaydı sil (RLS: kendi isteğini silebilir — v16 access_all veya sadece user_id eşleştiren policy)
      await supabase
        .from('room_access_requests')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .eq('status', 'pending');
    } catch { /* best-effort — istek zaten işlenmiş olabilir */ }
    setCancelling(false);
    onCancelled();
  }, [roomId, userId, onCancelled]);

  return (
    <BaseSheet visible={visible} onDismiss={handleCancel} maxHeight={H * 0.5}>
      <View style={st.body}>
        <View style={st.headerRow}>
          <Animated.View
            style={[
              st.iconBig,
              { transform: [{ scale: status === 'pending' ? pulse : 1 }] },
            ]}
          >
            <Ionicons
              name={status === 'accepted' ? 'checkmark-circle' : status === 'rejected' ? 'close-circle' : 'mail-outline'}
              size={24}
              color={status === 'accepted' ? '#22C55E' : status === 'rejected' ? '#EF4444' : '#3B82F6'}
              style={st.iconShadow}
            />
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>
              {status === 'accepted' ? i18n.t('auto.room.RoomAccessPrompts.006') : status === 'rejected' ? 'Reddedildi' : i18n.t('auto.room.RoomAccessPrompts.005')}
            </Text>
            <Text style={st.subtitle} numberOfLines={2}>
              {status === 'accepted' ? i18n.t('auto.room.RoomAccessPrompts.004') : status === 'rejected' ? i18n.t('auto.room.RoomAccessPrompts.003') : i18n.t('auto.room.RoomAccessPrompts.002', { 0: roomName || 'Bu oda' })}
            </Text>
          </View>
        </View>

        {/* Durum göstergesi */}
        <View style={st.statusCard}>
          {status === 'pending' && (
            <>
              <AppLoader color="#3B82F6" size="small" />
              <Text style={st.statusText}>Onay bekleniyor…</Text>
            </>
          )}
          {status === 'accepted' && (
            <>
              <Ionicons name="arrow-forward-circle" size={16} color="#22C55E" />
              <Text style={[st.statusText, { color: '#22C55E' }]}>{i18n.t('access.joining')}</Text>
            </>
          )}
          {status === 'rejected' && (
            <>
              <Ionicons name="information-circle" size={16} color="#94A3B8" />
              <Text style={st.statusText}>{i18n.t('access.try_later')}</Text>
            </>
          )}
        </View>

        {status === 'rejected' && (
          <View style={{ gap: 8, marginBottom: 6 }}>
            {onViewHost && (
              <Pressable style={st.ctaRow} onPress={onViewHost}>
                <Ionicons name="person-circle-outline" size={16} color="#5EEAD4" />
                <Text style={st.ctaRowText}>
                  {hostName ? i18n.t('auto.room.RoomAccessPrompts.001', { 0: hostName }) : "Oda sahibini incele"}
                </Text>
                <Ionicons name="chevron-forward" size={13} color="#5EEAD4" />
              </Pressable>
            )}
            {onDiscoverRooms && (
              <Pressable style={st.ctaRow} onPress={onDiscoverRooms}>
                <Ionicons name="compass-outline" size={16} color="#5EEAD4" />
                <Text style={st.ctaRowText}>{i18n.t('access.discover_similar')}</Text>
                <Ionicons name="chevron-forward" size={13} color="#5EEAD4" />
              </Pressable>
            )}
          </View>
        )}

        <View style={st.btnRow}>
          {status === 'pending' ? (
            <Pressable style={[st.btnSecondary, { flex: 1 }]} onPress={handleCancel} disabled={cancelling}>
              {cancelling ? <AppLoader color="#94A3B8" size="small" /> : (
                <><Ionicons name="close" size={14} color="#94A3B8" /><Text style={st.btnSecondaryText}>{i18n.t('room.roomaccessprompts.001')}</Text></>
              )}
            </Pressable>
          ) : (
            <Pressable style={[st.btnSecondary, { flex: 1 }]} onPress={onCancelled}>
              <Text style={st.btnSecondaryText}>{i18n.t('common.close')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </BaseSheet>
  );
}

// ═══════════════════════════════════════════════════════
// ACCESS GATE — onaylanmadan oda içi gizli kalır
// ═══════════════════════════════════════════════════════
// Kullanım: şifreli/davetli/banlı/kilitli/yaş-filtreli odalarda access check
// tamamlanmadan oda içeriği (speaker, listener, chat) gösterilmesin diye
// opak overlay. Sheet/Alert'ler bu katmanın üstüne mount edilir.
// ★ 2026-04-20: Oda tema renk paleti — access gate oda sahibinin seçtiği BG'yi gösterir
const GATE_THEME_COLORS: Record<string, [string, string]> = {
  ocean: ['#0E4D6F', '#083344'], sunset: ['#7F1D1D', '#4C0519'],
  forest: ['#14532D', '#052E16'], galaxy: ['#312E81', '#1E1B4B'],
  aurora: ['#134E4A', '#042F2E'], cherry: ['#831843', '#500724'],
  cyber: ['#1E3A8A', '#172554'], volcano: ['#7C2D12', '#431407'],
  midnight: ['#0C0A3E', '#1B1464'], rose: ['#9F1239', '#881337'],
  arctic: ['#164E63', '#0E7490'], amber: ['#78350F', '#92400E'],
  slate: ['#1E293B', '#334155'],
};

export function AccessGate({
  visible, roomName, hostName, hostAvatarUrl, onCancel,
  themeId, bgImageUrl,
}: {
  visible: boolean;
  roomName?: string;
  hostName?: string;
  hostAvatarUrl?: string | null;
  onCancel?: () => void;
  /** ★ 2026-04-20: Oda sahibinin seçtiği tema (theme_id) */
  themeId?: string | null;
  /** ★ Oda sahibinin yüklediği BG görseli (room_image_url) */
  bgImageUrl?: string | null;
}) {
  if (!visible) return null;
  const themeColors = themeId && GATE_THEME_COLORS[themeId];
  return (
    <View style={gate.overlay} pointerEvents="auto">
      {/* ★ Oda sahibinin seçtiği BG: custom image > tema gradient > default */}
      {bgImageUrl ? (
        <ImageBackground source={{ uri: bgImageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover">
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.75)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </ImageBackground>
      ) : themeColors ? (
        <LinearGradient
          colors={[themeColors[0], themeColors[1], '#070B14']}
          start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          locations={[0, 0.35, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Üst bar — geri dönüş */}
      {onCancel && (
        <Pressable onPress={onCancel} style={gate.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color="#F1F5F9" />
          <Text style={gate.backText}>{i18n.t('common.back')}</Text>
        </Pressable>
      )}

      {/* Merkez — minimal oda kimliği */}
      <View style={gate.center}>
        {/* ★ Avatar: getAvatarSource ile fallback (URL null ise default avatar) */}
        <View style={gate.avatarRing}>
          <View style={gate.avatarInner}>
            <Image source={getAvatarSource(hostAvatarUrl)} style={gate.avatar} />
          </View>
        </View>
        {/* ★ Oda sahibi adı — @ prefix yok, sadece display_name */}
        {hostName && <Text style={gate.hostName} numberOfLines={1}>{hostName}</Text>}
        <Text style={gate.roomName} numberOfLines={2}>{roomName || 'Oda'}</Text>

        <View style={gate.statusPill}>
          <AppLoader size="small" color="#14B8A6" />
          <Text style={gate.statusText}>{i18n.t('room.roomaccessprompts.002')}</Text>
        </View>
      </View>

      {/* Alt bilgi */}
      <View style={gate.footer}>
        <Ionicons name="shield-checkmark-outline" size={12} color="#64748B" />
        <Text style={gate.footerText}>{i18n.t('access.hidden_until_approved')}</Text>
      </View>
    </View>
  );
}

const gate = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // ★ zIndex 900 + elevation 900: sheet'ler (1100+) bunun üstünde kalır.
    // Android'de zIndex tek başına yeterli değil — elevation da gerekli.
    zIndex: 900,
    elevation: 900,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  backBtn: {
    position: 'absolute', top: 50, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  backText: { fontSize: 13, color: '#F1F5F9', fontWeight: '600' },
  center: { alignItems: 'center', gap: 12 },
  avatarRing: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(20,184,166,0.35)',
    marginBottom: 4,
  },
  avatarInner: {
    width: 72, height: 72, borderRadius: 36, overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' } as any,
  roomName: {
    fontSize: 20, fontWeight: '800', color: '#F1F5F9', textAlign: 'center',
    letterSpacing: 0.3,
  },
  hostName: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(20,184,166,0.08)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    marginTop: 16,
  },
  statusText: { fontSize: 12, color: '#5EEAD4', fontWeight: '600' },
  footer: {
    position: 'absolute', bottom: 40,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  footerText: { fontSize: 10, color: '#64748B', fontWeight: '500' },
});

const st = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(20,184,166,0.15)',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 24,
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  body: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  iconBig: {
    width: 48, height: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  iconShadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  title: { fontSize: 17, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.2 },
  subtitle: { fontSize: 11, color: '#94A3B8', marginTop: 2, lineHeight: 15 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 14, height: 48,
  },
  input: {
    flex: 1, fontSize: 15, color: '#F1F5F9', fontWeight: '600', letterSpacing: 1,
  },
  error: { color: '#EF4444', fontSize: 11, fontWeight: '600' },
  hint: { color: 'rgba(203,213,225,0.65)', fontSize: 11, fontWeight: '500', lineHeight: 15 },
  inlineHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.08)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.18)',
  },
  inlineHintText: { flex: 1, color: '#5EEAD4', fontSize: 11.5, fontWeight: '600' },
  ctaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.08)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)',
  },
  ctaRowText: { flex: 1, color: '#E5E7EB', fontSize: 13, fontWeight: '700' },
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 14,
  },
  statusText: { fontSize: 12, color: '#CBD5E1', fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnSecondary: {
    flex: 1, height: 46, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnSecondaryText: { fontSize: 13, color: '#94A3B8', fontWeight: '700' },
  btnPrimary: {
    flex: 1.4, height: 46, borderRadius: 12, backgroundColor: '#14B8A6',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    // ★ v1.3.69: Skia ile cross-platform teal glow (her Pressable use site'da SkiaShadow wrap)
  },
  btnPrimaryText: { fontSize: 14, color: '#FFF', fontWeight: '800' },
  // ★ 2026-04-27: Pre-check özet sheet için filtre satırları
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
  },
  filterIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  filterTitle: {
    fontSize: 13, fontWeight: '800', color: '#F1F5F9',
    marginBottom: 1,
  },
  filterDesc: {
    fontSize: 11, color: '#94A3B8', fontWeight: '500',
  },
});
