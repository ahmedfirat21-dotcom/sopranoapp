import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const BTN_SIZE = 34;
const TEAL_BTN_SIZE = 40;

// ★ Premium 3D cam butonlar — SolidCircleBtn ile aynı gradient stili, daha küçük boyut
function BarBtn({ children, onPress, badge, active, accent, label }: {
  children: React.ReactNode; onPress: () => void; badge?: number;
  active?: boolean; accent?: string; label?: string;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handleIn = () => Animated.spring(scaleAnim, { toValue: 1.12, useNativeDriver: true, damping: 8, stiffness: 300 }).start();
  const handleOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }).start();

  const baseColor = active && accent ? accent : '#3E4E5F';
  const lighten = (hex: string, pct: number) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xFF) + pct);
    const g = Math.min(255, ((num >> 8) & 0xFF) + pct);
    const b = Math.min(255, (num & 0xFF) + pct);
    return `rgb(${r},${g},${b})`;
  };
  const darken = (hex: string, pct: number) => lighten(hex, -pct);

  return (
    <Pressable onPress={onPress} onPressIn={handleIn} onPressOut={handleOut} style={{ position: 'relative' }}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }}>
      <Animated.View style={[
        s.btn, s.solidBtn3d,
        { transform: [{ scale: scaleAnim }] },
      ]}>
        <LinearGradient
          colors={[lighten(baseColor, 25), baseColor, darken(baseColor, 25)] as any}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: BTN_SIZE / 2 }}
        >
          {children}
        </LinearGradient>
        {/* ★ Glossy highlight — cam parlaklığı */}
        <View style={s.solidGlossSmall} />
      </Animated.View>
      {badge !== undefined && badge > 0 && (
        <View style={s.badge}><Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text></View>
      )}
    </Pressable>
  );
}

// ★ Premium 3D Solid butonlar (Mic / Cam / Volume / Hand) — gradient + glossy
function SolidCircleBtn({ children, onPress, active, activeColor, inactiveColor, label }: { children: React.ReactNode; onPress: () => void; active?: boolean; activeColor: string; inactiveColor: string; label?: string }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handleIn = () => Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true, damping: 8, stiffness: 300 }).start();
  const handleOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }).start();

  // Gradient renkleri: aktif rengin üç tonu
  const baseColor = active ? activeColor : inactiveColor;
  const lighten = (hex: string, pct: number) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xFF) + pct);
    const g = Math.min(255, ((num >> 8) & 0xFF) + pct);
    const b = Math.min(255, (num & 0xFF) + pct);
    return `rgb(${r},${g},${b})`;
  };
  const darken = (hex: string, pct: number) => lighten(hex, -pct);

  return (
    <Pressable onPress={onPress} onPressIn={handleIn} onPressOut={handleOut}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }}>
      <Animated.View style={[s.solidBtn, s.solidBtn3d, { transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient
          colors={[lighten(baseColor, 20), baseColor, darken(baseColor, 30)] as any}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={s.solidGradient}
        >
          {children}
        </LinearGradient>
        {/* ★ Glossy highlight — cam parlaklığı */}
        <View style={s.solidGloss} />
      </Animated.View>
    </Pressable>
  );
}

// ★ Premium 3D El Kaldırma Butonu — Listener mikrofon isteme
// stageAction:
//   'direct_join'  → Serbest mod, sahne boş → doğrudan sahneye çık (mic ikonu, teal)
//   'raise_hand'   → İzinli mod / yetkili sahnede / sahne dolu → el kaldır (amber, hand)
//   'waiting'      → Talep gönderilmiş, sıra bekleniyor (pulse + sıra no badge)
//   'locked'       → Seçilmişler modu → host'un seçmesi gerek (gri + kilit)
export type StageAction = 'direct_join' | 'raise_hand' | 'waiting' | 'locked';

function MicRequestBtn({ onPress, stageAction, queuePosition }: {
  onPress: () => void;
  stageAction: StageAction;
  queuePosition?: number;
}) {
  const isActive = stageAction === 'waiting';
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      // Pulse ring animasyonu
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        ])
      );
      // ★ Glossy shimmer — yüzeyde kayan ışık
      const shimmer = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(shimmerAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      );
      pulse.start();
      glow.start();
      shimmer.start();
      return () => { pulse.stop(); glow.stop(); shimmer.stop(); };
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
      shimmerAnim.setValue(0);
    }
  }, [isActive]);

  const handleIn = () => Animated.spring(scaleAnim, { toValue: 1.12, useNativeDriver: true, damping: 8, stiffness: 300 }).start();
  const handleOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }).start();

  const pulseOpacity = pulseAnim.interpolate({ inputRange: [1, 1.35], outputRange: [0.6, 0] });
  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.35, 0.08] });

  // Variant → ikon / renk / label eşleşmesi
  const variant = (() => {
    switch (stageAction) {
      case 'direct_join':
        // Serbest mod, sahne müsait → doğrudan sahneye CTA
        return {
          icon: 'mic' as const,
          colors: ['#34D399', '#14B8A6', '#0F766E'] as [string, string, string],
          label: 'Sahneye çık (serbest mod)',
          ringColor: '#14B8A6',
        };
      case 'waiting':
        // Talep gönderildi, onay/sıra bekleniyor
        return {
          icon: 'hand-left' as const,
          colors: ['#FBBF24', '#F59E0B', '#D97706'] as [string, string, string],
          label: queuePosition && queuePosition > 0
            ? `Sıradasın (${queuePosition}. sıra) — dokun ve iptal et`
            : 'Onay bekleniyor — dokun ve iptal et',
          ringColor: '#FBBF24',
        };
      case 'locked':
        // Seçilmişler modu — host seçer
        return {
          icon: 'lock-closed' as const,
          colors: ['#475569', '#334155', '#1E293B'] as [string, string, string],
          label: 'Sahne kilitli — sadece oda sahibi konuşmacı seçer',
          ringColor: '#475569',
        };
      case 'raise_hand':
      default:
        return {
          icon: 'hand-left' as const,
          colors: ['#64748B', '#475569', '#334155'] as [string, string, string],
          label: 'El kaldır (sahne talebi gönder)',
          ringColor: '#64748B',
        };
    }
  })();

  return (
    <Pressable onPress={onPress} onPressIn={handleIn} onPressOut={handleOut}
      accessibilityRole="button"
      accessibilityLabel={variant.label}
      accessibilityState={{ selected: isActive, disabled: stageAction === 'locked' }}>
      <View style={micS.wrap}>
        {/* Pulse ring — waiting durumunda dışa yayılan halka */}
        {isActive && (
          <Animated.View style={[micS.pulseRing, {
            borderColor: variant.ringColor,
            transform: [{ scale: pulseAnim }],
            opacity: pulseOpacity,
          }]} />
        )}
        {/* ★ Dış gölge katmanı — 3D derinlik */}
        <Animated.View style={[micS.btn, micS.btnShadow, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={variant.colors as any}
            start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
            style={micS.gradient}
          >
            <Ionicons name={variant.icon} size={20} color="#FFF" style={micS.handIcon} />
          </LinearGradient>
          {/* ★ Glossy highlight — üst yarıda beyaz parlaklık (cam efekti) */}
          <View style={micS.glossyHighlight} />
          {/* ★ Shimmer katmanı — waiting durumunda kayan ışık */}
          {isActive && (
            <Animated.View style={[micS.shimmerOverlay, { opacity: shimmerOpacity }]} />
          )}
          {/* İç glow efekti — waiting durumunda pulsing */}
          {isActive && (
            <Animated.View style={[micS.innerGlow, { opacity: glowAnim, backgroundColor: `${variant.ringColor}40` }]} />
          )}
        </Animated.View>
        {/* Sıra numarası rozeti */}
        {isActive && queuePosition && queuePosition > 0 && (
          <View style={micS.queueBadge}>
            <Text style={micS.queueBadgeText}>{queuePosition}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ★ Premium Moderasyon Kuyruk Butonu — Moderatör/Host için (BarBtn ile aynı gradient stil)
function ModQueueBtn({ onPress, count }: { onPress: () => void; count: number }) {
  const hasItems = count > 0;

  return (
    <BarBtn onPress={onPress} badge={count} active={hasItems} accent="#FBBF24" label={`Mikrofon istek kuyruğu${count > 0 ? `, ${count} bekleyen` : ''}`}>
      <Ionicons name="hand-right" size={17} color="#C8D6E0" style={s.iconDrop} />
    </BarBtn>
  );
}

interface Props {
  isMicOn: boolean; isCameraOn: boolean; showCamera: boolean;
  isHandRaised: boolean; handBadgeCount: number; canModerate: boolean;
  chatBadgeCount: number; isChatOpen: boolean;
  isListener?: boolean;
  isRoomMuted?: boolean;
  isOwnerInListenerMode?: boolean;
  isModInListenerMode?: boolean;
  /** Listener'ın sahne butonunun davranışı — parent hesaplar (speaking_mode × authorityOnStage × stageFull). */
  stageAction?: StageAction;
  /** waiting durumunda kullanıcının kuyruktaki 1-tabanlı sırası. */
  stageQueuePosition?: number;
  /** O6: Server-tarafı mute — mic toggle edilemez, kullanıcıya bildir. */
  isForcedMuted?: boolean;
  /** O6: Chat mute edilmişse input disabled. */
  isChatInputDisabled?: boolean;
  onJoinStagePress?: () => void;
  onMicPress: () => void; onCameraPress: () => void;
  onHandPress: () => void;
  onChatPress: () => void; onPlusPress: () => void;
  onMuteRoomPress?: () => void;
  // ★ Odadan ayrıl butonu
  onLeavePress?: () => void;
  // ★ DM bildirimi
  dmBadgeCount?: number;
  onDmPress?: () => void;
  isDmOpen?: boolean;
  isPlusOpen?: boolean;
}

export default function RoomControlBar({
  isMicOn, isCameraOn, showCamera, isHandRaised, isRoomMuted,
  handBadgeCount, canModerate, chatBadgeCount, isChatOpen,
  isListener, isOwnerInListenerMode, isModInListenerMode,
  isForcedMuted, isChatInputDisabled,
  stageAction, stageQueuePosition,
  onMicPress, onCameraPress,
  onHandPress, onChatPress, onPlusPress, onMuteRoomPress,
  onLeavePress, onJoinStagePress,
  dmBadgeCount, onDmPress, isDmOpen, isPlusOpen,
}: Props) {
  // Geriye uyum: parent stageAction geçmezse isHandRaised'ten türet.
  const resolvedStageAction: StageAction = stageAction ?? (isHandRaised ? 'waiting' : 'raise_hand');
  // ★ O6: Server-tarafı mute iken mic butonu pressed olsa da bilgilendir
  const handleMicPress = () => {
    if (isForcedMuted) {
      try { require('../Toast').showToast({ title: '🔇 Sessize alındınız', message: 'Moderatör tarafından sustruldunuz.', type: 'warning' }); } catch {}
      return;
    }
    onMicPress();
  };
  return (
    <View style={s.wrap}>
      {/* ★ KONTROL BARI — tek satır: [Chat Input] [Mic/Cam] [Utility] */}
      <View style={s.capsule}>

        {/* ======================= SOL: SOHBET BUTONU ======================= */}
        <View style={s.leftGroup}>
          <BarBtn onPress={onChatPress} badge={chatBadgeCount} active={isChatOpen} accent="#3B82F6" label="Sohbet">
            <Ionicons name={isChatOpen ? 'chatbubble' : 'chatbubble-outline'} size={16} color={isChatOpen ? '#FFF' : '#C8D6E0'} style={s.iconDrop} />
          </BarBtn>
        </View>

        {/* ======================= MERKEZ: MIC / CAM ======================= */}
        <View style={s.centerGroup}>
          {isListener ? (
            <>
              <SolidCircleBtn onPress={onMuteRoomPress || (() => { })} active={!isRoomMuted} activeColor="#14B8A6" inactiveColor="#3E4E5F" label={isRoomMuted ? 'Oda sesini aç' : 'Oda sesini kapat'}>
                <Ionicons name={isRoomMuted ? 'volume-mute' : 'volume-high'} size={18} color="#FFF" />
              </SolidCircleBtn>

              {isOwnerInListenerMode ? (
                <SolidCircleBtn onPress={onJoinStagePress || (() => { })} active activeColor="#D4AF37" inactiveColor="#3E4E5F" label="Sahneye geri dön">
                  <Ionicons name="mic" size={18} color="#FFF" />
                </SolidCircleBtn>
              ) : isModInListenerMode ? (
                <SolidCircleBtn onPress={onJoinStagePress || (() => { })} active activeColor="#A78BFA" inactiveColor="#3E4E5F" label="Sahneye geri dön">
                  <Ionicons name="shield-checkmark" size={17} color="#FFF" />
                </SolidCircleBtn>
              ) : (
                /* ★ Premium Mikrofon İsteme Butonu — speaking_mode'a göre ikon/renk/label değişir */
                <MicRequestBtn onPress={onHandPress} stageAction={resolvedStageAction} queuePosition={stageQueuePosition} />
              )}
            </>
          ) : (
            <>
              <SolidCircleBtn onPress={handleMicPress} active={isMicOn && !isForcedMuted} activeColor="#14B8A6" inactiveColor={isForcedMuted ? '#7F1D1D' : '#3E4E5F'} label={isForcedMuted ? 'Mikrofon kapalı (susturuldun)' : (isMicOn ? 'Mikrofonu kapat' : 'Mikrofonu aç')}>
                <Ionicons name={isForcedMuted ? 'mic-off' : (isMicOn ? 'mic' : 'mic-off')} size={20} color={isForcedMuted ? '#FCA5A5' : '#FFF'} />
              </SolidCircleBtn>

              {showCamera && (
                <SolidCircleBtn onPress={onCameraPress} active={isCameraOn} activeColor="#14B8A6" inactiveColor="#3E4E5F" label={isCameraOn ? 'Kamerayı kapat' : 'Kamerayı aç'}>
                  <Ionicons name={isCameraOn ? 'videocam' : 'videocam-off'} size={18} color="#FFF" />
                </SolidCircleBtn>
              )}
            </>
          )}
        </View>

        {/* ======================= SAĞ: UTILITY ======================= */}
        {/* ★ 2026-04-22: Emoji/GIF butonu chat drawer'ın içine taşındı (WhatsApp pattern).
             Sağ grup artık sadece mod-queue + DM + plus. */}
        <View style={s.rightGroup}>
          {canModerate && (
            <ModQueueBtn onPress={onHandPress} count={handBadgeCount} />
          )}

          {/* DM */}
          {onDmPress && (
            <BarBtn onPress={onDmPress} badge={dmBadgeCount} active={isDmOpen || (dmBadgeCount !== undefined && dmBadgeCount > 0)} accent="#8B5CF6" label="Mesajlar">
              <Ionicons name="mail-outline" size={16} color="#C8D6E0" style={s.iconDrop} />
            </BarBtn>
          )}

          <BarBtn onPress={onPlusPress} active={isPlusOpen} accent="#14B8A6" label="Daha fazla seçenek">
            <Ionicons name="add-circle-outline" size={18} color="#C8D6E0" style={s.iconDrop} />
          </BarBtn>
        </View>

      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════
// ★ 3D EL KALDIRMA BUTONU STİLLERİ
// ═══════════════════════════════════════════════════
const micS = StyleSheet.create({
  wrap: {
    width: TEAL_BTN_SIZE + 2, height: TEAL_BTN_SIZE + 2,
    alignItems: 'center', justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: TEAL_BTN_SIZE, height: TEAL_BTN_SIZE,
    borderRadius: TEAL_BTN_SIZE / 2,
    borderWidth: 2.5,
    borderColor: '#FBBF24',
  },
  btn: {
    width: TEAL_BTN_SIZE, height: TEAL_BTN_SIZE,
    borderRadius: TEAL_BTN_SIZE / 2,
    overflow: 'hidden',
  },
  // ★ 3D gölge katmanları — derinlik hissi
  btnShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  gradient: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  // ★ İkon drop-shadow — kabartma efekti
  handIcon: {
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  // ★ Glossy highlight — üst yarıda cam parlaklığı
  glossyHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TEAL_BTN_SIZE / 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'transparent',
    // Sadece üst yarıyı kaplayan beyaz geçiş
    borderBottomWidth: 0,
    opacity: 0.7,
    height: '50%',
  },
  // ★ Shimmer — kayan parlak katman
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TEAL_BTN_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TEAL_BTN_SIZE / 2,
    backgroundColor: 'rgba(251,191,36,0.25)',
  },
  queueBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#F59E0B',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: '#1E293B',
  },
  queueBadgeText: {
    color: '#FFF', fontSize: 10, fontWeight: '800',
  },
});

// ═══════════════════════════════════════════════════
// ★ MODERASYON KUYRUK BUTONU STİLLERİ
// ═══════════════════════════════════════════════════
const modS = StyleSheet.create({
  iconWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 1,
  },
  queueDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -2, marginTop: -6,
  },
  queueDotActive: {
    backgroundColor: 'rgba(251,191,36,0.3)',
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FBBF24',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#2D3740',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeText: { color: '#1E1B12', fontSize: 9, fontWeight: '800' },
});

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 10,
    paddingBottom: 4,
    alignItems: 'center',
  },
  // ★ 2026-04-22: Modernize — cam efektli capsule, daha okunur padding,
  //   sağ grupta nefes (gap: 6), merkez ayrışsın diye margin.
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 28,
    backgroundColor: 'rgba(30, 41, 59, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginRight: 10,
  },
  centerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    marginLeft: 10,
  },
  // ★ 3D Solid buton — gradient arka plan ile kullanılır
  solidBtn: {
    width: TEAL_BTN_SIZE,
    height: TEAL_BTN_SIZE,
    borderRadius: TEAL_BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  solidBtn3d: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  solidGradient: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  // ★ Glossy highlight — solid buton üst yarısı
  solidGloss: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%',
    borderTopLeftRadius: TEAL_BTN_SIZE / 2,
    borderTopRightRadius: TEAL_BTN_SIZE / 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'transparent',
  },
  // ★ BarBtn — Premium 3D cam (gradient arka plan + derinlik)
  btn: {
    width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  // ★ Glossy highlight — BarBtn için küçük cam parlaklığı (SolidCircleBtn ile aynı görünüm)
  solidGlossSmall: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%',
    borderTopLeftRadius: BTN_SIZE / 2,
    borderTopRightRadius: BTN_SIZE / 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'transparent',
  },
  // ★ İkon drop-shadow — kabartma derinliği
  iconDrop: {
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#2D3740',
  },
  badgeText: { color: '#FFF', fontSize: 8, fontWeight: '800' },
});
