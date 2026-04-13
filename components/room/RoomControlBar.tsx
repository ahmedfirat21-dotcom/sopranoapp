import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BTN_SIZE = 42;
const TEAL_BTN_SIZE = 48;

// Şeffaf arka planlı yan ikonlar
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

// Solid renkli yuvarlak butonlar (Mic / Cam / Volume / Hand)
function SolidCircleBtn({ children, onPress, active, activeColor, inactiveColor }: { children: React.ReactNode; onPress: () => void; active?: boolean; activeColor: string; inactiveColor: string }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handleIn = () => Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true, damping: 8, stiffness: 300 }).start();
  const handleOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={handleIn} onPressOut={handleOut}>
      <Animated.View style={[s.solidBtn, { backgroundColor: active ? activeColor : inactiveColor, transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
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
  onLeavePress?: () => void;
  onMuteRoomPress?: () => void;
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
  onHandPress, onChatPress, onPlusPress, onLeavePress, onMuteRoomPress,
  onJoinStagePress,
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
                <SolidCircleBtn onPress={onHandPress} active={isHandRaised} activeColor="#FBBF24" inactiveColor="#334155">
                  <Ionicons name={isHandRaised ? 'hand-right' : 'hand-right-outline'} size={22} color="#FFF" />
                </SolidCircleBtn>
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
            <BarBtn onPress={onHandPress} badge={handBadgeCount} active={handBadgeCount > 0} glow={handBadgeCount > 0}>
              <Ionicons name={handBadgeCount > 0 ? 'hand-right' : 'hand-right-outline'} size={24} color={handBadgeCount > 0 ? '#D4C8B2' : '#94A3B8'} />
            </BarBtn>
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

          {/* ★ K2 FIX: Çıkış butonu — odadan ayrılma */}
          {onLeavePress && (
            <Pressable onPress={onLeavePress} style={{ position: 'relative' }}>
              <View style={s.leaveBtn}>
                <Ionicons name="exit-outline" size={20} color="#FFF" />
              </View>
            </Pressable>
          )}
        </View>

      </View>
    </View>
  );
}

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
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(45, 55, 64, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    gap: 6,
  },
  chatInput: {
    flex: 1,
    fontSize: 12,
    color: '#F1F5F9',
    paddingVertical: 0,
  },
  // Pill bar
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: 6,
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
  solidBtn: {
    width: TEAL_BTN_SIZE,
    height: TEAL_BTN_SIZE,
    borderRadius: TEAL_BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
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
  // ★ K2 FIX: Çıkış butonu stili
  leaveBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
