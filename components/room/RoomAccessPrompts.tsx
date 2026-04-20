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
  Dimensions, Platform, KeyboardAvoidingView, ActivityIndicator,
  PanResponder, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../constants/supabase';
import { getAvatarSource } from '../../constants/avatars';

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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
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
  visible, onDismiss, onSubmit, submitting, error, roomName,
}: {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (password: string) => void;
  submitting?: boolean;
  error?: string;
  roomName?: string;
}) {
  const [pw, setPw] = useState('');
  const [reveal, setReveal] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => { if (visible) { setPw(''); setReveal(false); } }, [visible]);

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
          <View style={[st.iconBig, { backgroundColor: 'rgba(20,184,166,0.12)', borderColor: 'rgba(20,184,166,0.3)' }]}>
            <Ionicons name="lock-closed" size={22} color="#14B8A6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>Şifreli Oda</Text>
            <Text style={st.subtitle} numberOfLines={1}>{roomName || 'Bu odaya girmek için şifre gerekiyor'}</Text>
          </View>
        </View>

        <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
          <View style={[st.inputWrap, error && { borderColor: 'rgba(239,68,68,0.5)' }]}>
            <Ionicons name="key-outline" size={16} color="#94A3B8" />
            <TextInput
              style={st.input}
              value={pw}
              onChangeText={setPw}
              placeholder="Şifreyi girin..."
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

        {error ? <Text style={st.error}>{error}</Text> : <View style={{ height: 14 }} />}

        <View style={st.btnRow}>
          <Pressable style={st.btnSecondary} onPress={onDismiss} disabled={submitting}>
            <Text style={st.btnSecondaryText}>Vazgeç</Text>
          </Pressable>
          <Pressable
            style={[st.btnPrimary, (submitting || pw.length < 1) && { opacity: 0.5 }]}
            onPress={() => pw.trim() && onSubmit(pw.trim())}
            disabled={submitting || pw.length < 1}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={14} color="#FFF" />
                <Text style={st.btnPrimaryText}>Giriş</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </BaseSheet>
  );
}

// ═══════════════════════════════════════════════════════
// ACCESS REQUEST SHEET — Davetli oda için bekleme + realtime
// ═══════════════════════════════════════════════════════
export function AccessRequestSheet({
  visible, roomId, userId, roomName, onApproved, onRejected, onCancelled,
}: {
  visible: boolean;
  roomId: string | null;
  userId: string | null;
  roomName?: string;
  onApproved: () => void;
  onRejected: (reason?: string) => void;
  onCancelled: () => void;
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
              setTimeout(() => onRejected('Erişim isteğiniz reddedildi'), 1200);
            }
          }
        }
      )
      .subscribe();

    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [visible, roomId, userId, onApproved, onRejected]);

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
              {
                backgroundColor: status === 'accepted' ? 'rgba(34,197,94,0.12)' : status === 'rejected' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                borderColor: status === 'accepted' ? 'rgba(34,197,94,0.3)' : status === 'rejected' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)',
                transform: [{ scale: status === 'pending' ? pulse : 1 }],
              },
            ]}
          >
            <Ionicons
              name={status === 'accepted' ? 'checkmark-circle' : status === 'rejected' ? 'close-circle' : 'mail-outline'}
              size={24}
              color={status === 'accepted' ? '#22C55E' : status === 'rejected' ? '#EF4444' : '#3B82F6'}
            />
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>
              {status === 'accepted' ? 'Onaylandı!' : status === 'rejected' ? 'Reddedildi' : 'Katılma İsteği'}
            </Text>
            <Text style={st.subtitle} numberOfLines={2}>
              {status === 'accepted' ? 'Odaya yönlendiriliyorsun...' : status === 'rejected' ? 'Oda yöneticisi isteğini kabul etmedi' : `${roomName || 'Bu oda'} davetli bir oda. İsteğin yöneticilere iletildi.`}
            </Text>
          </View>
        </View>

        {/* Durum göstergesi */}
        <View style={st.statusCard}>
          {status === 'pending' && (
            <>
              <ActivityIndicator color="#3B82F6" size="small" />
              <Text style={st.statusText}>Onay bekleniyor…</Text>
            </>
          )}
          {status === 'accepted' && (
            <>
              <Ionicons name="arrow-forward-circle" size={16} color="#22C55E" />
              <Text style={[st.statusText, { color: '#22C55E' }]}>Odaya katılıyorsun</Text>
            </>
          )}
          {status === 'rejected' && (
            <>
              <Ionicons name="information-circle" size={16} color="#94A3B8" />
              <Text style={st.statusText}>Daha sonra tekrar deneyebilirsin</Text>
            </>
          )}
        </View>

        <View style={st.btnRow}>
          {status === 'pending' ? (
            <Pressable style={[st.btnSecondary, { flex: 1 }]} onPress={handleCancel} disabled={cancelling}>
              {cancelling ? <ActivityIndicator color="#94A3B8" size="small" /> : (
                <><Ionicons name="close" size={14} color="#94A3B8" /><Text style={st.btnSecondaryText}>Vazgeç</Text></>
              )}
            </Pressable>
          ) : (
            <Pressable style={[st.btnSecondary, { flex: 1 }]} onPress={onCancelled}>
              <Text style={st.btnSecondaryText}>Kapat</Text>
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
export function AccessGate({
  visible, roomName, hostName, hostAvatarUrl, onCancel,
}: {
  visible: boolean;
  roomName?: string;
  hostName?: string;
  hostAvatarUrl?: string | null;
  onCancel?: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={gate.overlay} pointerEvents="auto">
      <LinearGradient
        colors={['#4a5668', '#37414f', '#232a35']}
        locations={[0, 0.35, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Üst bar — geri dönüş */}
      {onCancel && (
        <Pressable onPress={onCancel} style={gate.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color="#F1F5F9" />
          <Text style={gate.backText}>Geri</Text>
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
          <ActivityIndicator size="small" color="#14B8A6" />
          <Text style={gate.statusText}>Erişim kontrol ediliyor…</Text>
        </View>
      </View>

      {/* Alt bilgi */}
      <View style={gate.footer}>
        <Ionicons name="shield-checkmark-outline" size={12} color="#64748B" />
        <Text style={gate.footerText}>Oda içeriği onaylanana kadar gizli</Text>
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
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
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
  error: { color: '#EF4444', fontSize: 11, fontWeight: '600', marginTop: 6, marginBottom: 8 },
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
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnPrimaryText: { fontSize: 14, color: '#FFF', fontWeight: '800' },
});
