import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const BTN_SIZE = 42;
const TEAL_BTN_SIZE = 48;

// ★ Yan ikon butonları — temiz, minimal, transparan
function BarBtn({ children, onPress, badge, active, glow }: {
  children: React.ReactNode; onPress: () => void; badge?: number;
  active?: boolean; glow?: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handleIn = () => Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true, damping: 8, stiffness: 300 }).start();
  const handleOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={handleIn} onPressOut={handleOut} style={{ position: 'relative' }}>
      <Animated.View style={[
        s.btn,
        active && s.btnActive,
        glow && s.btnGlow,
        { transform: [{ scale: scaleAnim }] },
      ]}>
        {children}
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
            <Ionicons name="hand-left" size={24} color="#FFF" style={micS.handIcon} />
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

// ★ Premium Moderasyon Kuyruk Butonu — Moderatör/Host için
function ModQueueBtn({ onPress, count }: { onPress: () => void; count: number }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const hasItems = count > 0;

  useEffect(() => {
    if (hasItems) {
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -3, duration: 150, useNativeDriver: true }),
        Animated.spring(bounceAnim, { toValue: 0, useNativeDriver: true, damping: 5, stiffness: 300 }),
      ]).start();
    }
  }, [count]);

  const handleIn = () => Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true, damping: 8, stiffness: 300 }).start();
  const handleOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={handleIn} onPressOut={handleOut} style={{ position: 'relative' }}>
      <Animated.View style={[
        s.btn,
        hasItems && { backgroundColor: 'rgba(251,191,36,0.12)' },
        { transform: [{ scale: scaleAnim }, { translateY: bounceAnim }] },
      ]}>
        <View style={modS.iconWrap}>
          <Ionicons name="mic" size={16} color={hasItems ? '#FBBF24' : '#94A3B8'} />
          <View style={[modS.queueDot, hasItems && modS.queueDotActive]}>
            <Ionicons name="arrow-up" size={8} color={hasItems ? '#FFF' : '#94A3B8'} />
          </View>
        </View>
      </Animated.View>
      {count > 0 && (
        <View style={modS.badge}>
          <Text style={modS.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </Pressable>
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
}

export default function RoomControlBar({
  isMicOn, isCameraOn, showCamera, isHandRaised, isRoomMuted,
  handBadgeCount, canModerate, chatBadgeCount, isChatOpen,
  isListener, isOwnerInListenerMode, isModInListenerMode,
  onMicPress, onCameraPress, onEmojiPress,
  onHandPress, onChatPress, onPlusPress, onMuteRoomPress,
  onLeavePress, onJoinStagePress,
  chatInput, onChatInputChange, onChatSend, chatInputRef,
  dmBadgeCount, onDmPress,
}: Props) {
  return (
    <View style={s.wrap}>
      {/* ★ MESAJ INPUT — pill barın hemen üstünde, kompakt */}
      {onChatInputChange && (
        <View style={s.chatRow}>
          <View style={s.chatInputWrap}>
            <Ionicons name="chatbubble-outline" size={13} color="rgba(255,255,255,0.25)" />
            <TextInput
              ref={chatInputRef}
              style={s.chatInput}
              placeholder="Mesaj yaz..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={chatInput}
              onChangeText={onChatInputChange}
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={onChatSend}
            />
            {chatInput && chatInput.trim() ? (
              <Pressable onPress={onChatSend} hitSlop={6}>
                <Ionicons name="send" size={14} color="#14B8A6" />
              </Pressable>
            ) : (
              <Pressable onPress={onChatPress} hitSlop={6}>
                <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.2)" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* ★ KONTROL BARI */}
      <View style={s.capsule}>

        {/* ======================= SOL GRUP (TEAL BUTONLAR) ======================= */}
        <View style={s.leftGroup}>
          {isListener ? (
            <>
              <SolidCircleBtn onPress={onMuteRoomPress || (() => { })} active={!isRoomMuted} activeColor="#14B8A6" inactiveColor="#334155">
                <Ionicons name={isRoomMuted ? 'volume-mute' : 'volume-high'} size={22} color="#FFF" />
              </SolidCircleBtn>

              {isOwnerInListenerMode ? (
                <SolidCircleBtn onPress={onJoinStagePress || (() => { })} active activeColor="#D4AF37" inactiveColor="#334155">
                  <Ionicons name="mic" size={22} color="#FFF" />
                </SolidCircleBtn>
              ) : isModInListenerMode ? (
                <SolidCircleBtn onPress={onJoinStagePress || (() => { })} active activeColor="#A78BFA" inactiveColor="#334155">
                  <Ionicons name="shield-checkmark" size={20} color="#FFF" />
                </SolidCircleBtn>
              ) : (
                /* ★ Premium Mikrofon İsteme Butonu */
                <MicRequestBtn onPress={onHandPress} isActive={isHandRaised} />
              )}
            </>
          ) : (
            <>
              <SolidCircleBtn onPress={onMicPress} active={isMicOn} activeColor="#14B8A6" inactiveColor="#334155">
                <Ionicons name={isMicOn ? 'mic' : 'mic-off'} size={24} color="#FFF" />
              </SolidCircleBtn>

              {showCamera && (
                <SolidCircleBtn onPress={onCameraPress} active={isCameraOn} activeColor="#14B8A6" inactiveColor="#334155">
                  <Ionicons name={isCameraOn ? 'videocam' : 'videocam-off'} size={22} color="#FFF" />
                </SolidCircleBtn>
              )}
            </>
          )}
        </View>

        {/* ======================= SAĞ GRUP ======================= */}
        <View style={s.rightGroup}>
          <BarBtn onPress={onEmojiPress}>
            <Ionicons name="happy-outline" size={24} color="#D4C8B2" />
          </BarBtn>

          {canModerate && !isListener && (
            /* ★ Premium Moderasyon Kuyruk Butonu */
            <ModQueueBtn onPress={onHandPress} count={handBadgeCount} />
          )}

          {/* Oda Sohbeti — drawer açar */}
          <BarBtn onPress={onChatPress} badge={chatBadgeCount} active={isChatOpen}>
            <Ionicons name={isChatOpen ? 'chatbubble' : 'chatbubble-outline'} size={21} color={isChatOpen ? '#FFF' : '#B4BDC4'} />
          </BarBtn>

          {/* DM Mesajlar — kişisel mesajlar sayfasına git */}
          {onDmPress && (
            <BarBtn onPress={onDmPress} badge={dmBadgeCount}>
              <Ionicons name="mail-outline" size={21} color={dmBadgeCount && dmBadgeCount > 0 ? '#5EEAD4' : '#94A3B8'} />
            </BarBtn>
          )}

          <BarBtn onPress={onPlusPress}>
            <Ionicons name="add-circle-outline" size={26} color="#B4BDC4" />
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
    width: TEAL_BTN_SIZE + 8, height: TEAL_BTN_SIZE + 8,
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
    paddingHorizontal: 12,
    paddingBottom: 6,
    alignItems: 'center',
  },
  // ★ Chat input row — bar'ın hemen üstünde, aynı genişlikte, minimal
  chatRow: {
    width: '100%',
    marginBottom: 5,
  },
  chatInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(45, 55, 64, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    gap: 5,
  },
  chatInput: {
    flex: 1,
    fontSize: 11,
    color: '#F1F5F9',
    paddingVertical: 0,
  },
  // Pill bar
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 40,
    backgroundColor: 'rgba(45, 55, 64, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 2,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: 2,
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
  // ★ BarBtn — temiz transparan ikon
  btn: {
    width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  btnGlow: {
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  badge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#2D3740',
  },
  badgeText: { color: '#FFF', fontSize: 8, fontWeight: '800' },
});
