import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const BTN_SIZE = 34;
const TEAL_BTN_SIZE = 40;

// ★ Premium 3D cam butonlar — SolidCircleBtn ile aynı gradient stili, daha küçük boyut
function BarBtn({ children, onPress, badge, active, accent }: {
  children: React.ReactNode; onPress: () => void; badge?: number;
  active?: boolean; accent?: string;
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
    <Pressable onPress={onPress} onPressIn={handleIn} onPressOut={handleOut} style={{ position: 'relative' }}>
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
function SolidCircleBtn({ children, onPress, active, activeColor, inactiveColor }: { children: React.ReactNode; onPress: () => void; active?: boolean; activeColor: string; inactiveColor: string }) {
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
    <Pressable onPress={onPress} onPressIn={handleIn} onPressOut={handleOut}>
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
function MicRequestBtn({ onPress, isActive }: { onPress: () => void; isActive: boolean }) {
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

  return (
    <Pressable onPress={onPress} onPressIn={handleIn} onPressOut={handleOut}>
      <View style={micS.wrap}>
        {/* Pulse ring — aktifken dışa yayılan halka */}
        {isActive && (
          <Animated.View style={[micS.pulseRing, {
            transform: [{ scale: pulseAnim }],
            opacity: pulseOpacity,
          }]} />
        )}
        {/* ★ Dış gölge katmanı — 3D derinlik */}
        <Animated.View style={[micS.btn, micS.btnShadow, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={isActive ? ['#FBBF24', '#F59E0B', '#D97706'] : ['#64748B', '#475569', '#334155']}
            start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
            style={micS.gradient}
          >
            {/* ★ Modern hand-left ikonu — vektör, temiz, premium */}
            <Ionicons name="hand-left" size={20} color="#FFF" style={micS.handIcon} />
          </LinearGradient>
          {/* ★ Glossy highlight — üst yarıda beyaz parlaklık (cam efekti) */}
          <View style={micS.glossyHighlight} />
          {/* ★ Shimmer katmanı — aktifken kayan ışık */}
          {isActive && (
            <Animated.View style={[micS.shimmerOverlay, { opacity: shimmerOpacity }]} />
          )}
          {/* İç glow efekti — aktifken pulsing */}
          {isActive && (
            <Animated.View style={[micS.innerGlow, { opacity: glowAnim }]} />
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
}

// ★ Premium Moderasyon Kuyruk Butonu — Moderatör/Host için (BarBtn ile aynı gradient stil)
function ModQueueBtn({ onPress, count }: { onPress: () => void; count: number }) {
  const hasItems = count > 0;

  return (
    <BarBtn onPress={onPress} badge={count} active={hasItems} accent="#FBBF24">
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
  isEmojiOpen?: boolean;
  isOwnerInListenerMode?: boolean;
  isModInListenerMode?: boolean;
  /** O6: Server-tarafı mute — mic toggle edilemez, kullanıcıya bildir. */
  isForcedMuted?: boolean;
  /** O6: Chat mute edilmişse input disabled. */
  isChatInputDisabled?: boolean;
  onJoinStagePress?: () => void;
  onMicPress: () => void; onCameraPress: () => void;
  onEmojiPress: () => void; onHandPress: () => void;
  onChatPress: () => void; onPlusPress: () => void;
  onMuteRoomPress?: () => void;
  // ★ Odadan ayrıl butonu
  onLeavePress?: () => void;
  // ★ Gömülü chat input
  chatInput?: string;
  onChatInputChange?: (t: string) => void;
  onChatSend?: () => void;
  chatInputRef?: React.RefObject<TextInput>;
  // ★ DM bildirimi
  dmBadgeCount?: number;
  onDmPress?: () => void;
  isDmOpen?: boolean;
  isPlusOpen?: boolean;
}

export default function RoomControlBar({
  isMicOn, isCameraOn, showCamera, isHandRaised, isRoomMuted,
  handBadgeCount, canModerate, chatBadgeCount, isChatOpen,
  isListener, isOwnerInListenerMode, isModInListenerMode, isEmojiOpen,
  isForcedMuted, isChatInputDisabled,
  onMicPress, onCameraPress, onEmojiPress,
  onHandPress, onChatPress, onPlusPress, onMuteRoomPress,
  onLeavePress, onJoinStagePress,
  chatInput, onChatInputChange, onChatSend, chatInputRef,
  dmBadgeCount, onDmPress, isDmOpen, isPlusOpen,
}: Props) {
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

        {/* ======================= SOL: MESAJ INPUT ======================= */}
        <View style={s.leftGroup}>
          {onChatInputChange ? (
            <View style={[s.chatInputWrap, isChatInputDisabled && { opacity: 0.4 }]}>
              <TextInput
                ref={chatInputRef}
                style={s.chatInput}
                placeholder={isChatInputDisabled ? '🔇 Metin sohbeti susturuldu' : 'Mesaj yaz...'}
                placeholderTextColor="rgba(255,255,255,0.18)"
                value={chatInput}
                onChangeText={onChatInputChange}
                maxLength={300}
                returnKeyType="send"
                onSubmitEditing={onChatSend}
                editable={!isChatInputDisabled}
              />
              {chatInput && chatInput.trim() ? (
                <Pressable onPress={onChatSend} hitSlop={6}>
                  <Ionicons name="send" size={11} color="#14B8A6" />
                </Pressable>
              ) : (
                <Pressable onPress={onChatPress} hitSlop={6}>
                  <Ionicons name="expand-outline" size={11} color="rgba(255,255,255,0.18)" />
                </Pressable>
              )}
            </View>
          ) : (
            <BarBtn onPress={onChatPress} badge={chatBadgeCount} active={isChatOpen} accent="#3B82F6">
              <Ionicons name={isChatOpen ? 'chatbubble' : 'chatbubble-outline'} size={16} color={isChatOpen ? '#FFF' : '#C8D6E0'} style={s.iconDrop} />
            </BarBtn>
          )}
        </View>

        {/* ======================= MERKEZ: MIC / CAM ======================= */}
        <View style={s.centerGroup}>
          {isListener ? (
            <>
              <SolidCircleBtn onPress={onMuteRoomPress || (() => { })} active={!isRoomMuted} activeColor="#14B8A6" inactiveColor="#3E4E5F">
                <Ionicons name={isRoomMuted ? 'volume-mute' : 'volume-high'} size={18} color="#FFF" />
              </SolidCircleBtn>

              <SolidCircleBtn onPress={onChatPress} active={isChatOpen} activeColor="#3B82F6" inactiveColor="#3E4E5F">
                <Ionicons name={isChatOpen ? 'chatbubble' : 'chatbubble-outline'} size={17} color="#FFF" />
              </SolidCircleBtn>

              {isOwnerInListenerMode ? (
                <SolidCircleBtn onPress={onJoinStagePress || (() => { })} active activeColor="#D4AF37" inactiveColor="#3E4E5F">
                  <Ionicons name="mic" size={18} color="#FFF" />
                </SolidCircleBtn>
              ) : isModInListenerMode ? (
                <SolidCircleBtn onPress={onJoinStagePress || (() => { })} active activeColor="#A78BFA" inactiveColor="#3E4E5F">
                  <Ionicons name="shield-checkmark" size={17} color="#FFF" />
                </SolidCircleBtn>
              ) : (
                /* ★ Premium Mikrofon İsteme Butonu */
                <MicRequestBtn onPress={onHandPress} isActive={isHandRaised} />
              )}
            </>
          ) : (
            <>
              <SolidCircleBtn onPress={handleMicPress} active={isMicOn && !isForcedMuted} activeColor="#14B8A6" inactiveColor={isForcedMuted ? '#7F1D1D' : '#3E4E5F'}>
                <Ionicons name={isForcedMuted ? 'mic-off' : (isMicOn ? 'mic' : 'mic-off')} size={20} color={isForcedMuted ? '#FCA5A5' : '#FFF'} />
              </SolidCircleBtn>

              {showCamera && (
                <SolidCircleBtn onPress={onCameraPress} active={isCameraOn} activeColor="#14B8A6" inactiveColor="#3E4E5F">
                  <Ionicons name={isCameraOn ? 'videocam' : 'videocam-off'} size={18} color="#FFF" />
                </SolidCircleBtn>
              )}
            </>
          )}
        </View>

        {/* ======================= SAĞ: UTILITY ======================= */}
        <View style={s.rightGroup}>
          <BarBtn onPress={onEmojiPress} active={isEmojiOpen} accent="#D4A853">
            <Ionicons name="happy-outline" size={18} color="#C8D6E0" style={s.iconDrop} />
          </BarBtn>

          {canModerate && !isListener && (
            <ModQueueBtn onPress={onHandPress} count={handBadgeCount} />
          )}

          {/* DM */}
          {onDmPress && (
            <BarBtn onPress={onDmPress} badge={dmBadgeCount} active={isDmOpen || (dmBadgeCount !== undefined && dmBadgeCount > 0)} accent="#8B5CF6">
              <Ionicons name="mail-outline" size={16} color="#C8D6E0" style={s.iconDrop} />
            </BarBtn>
          )}

          <BarBtn onPress={onPlusPress} active={isPlusOpen} accent="#14B8A6">
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
    paddingHorizontal: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  // ★ Chat input — capsule içinde sol tarafta, kompakt pill
  chatInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    gap: 6,
  },
  chatInput: {
    flex: 1,
    fontSize: 13,
    color: '#F1F5F9',
    paddingVertical: 0,
  },
  // Pill bar
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 30,
    backgroundColor: 'rgba(45, 55, 64, 0.95)',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 2,
    flex: 1,
    marginRight: 4,
  },
  centerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    paddingRight: 1,
    flexShrink: 0,
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
