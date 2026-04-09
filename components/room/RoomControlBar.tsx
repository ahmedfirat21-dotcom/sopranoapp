import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BTN_SIZE = 50;

function BarBtn({ children, onPress, badge, active, glow, destructive }: {
  children: React.ReactNode; onPress: () => void; badge?: number;
  active?: boolean; glow?: boolean; destructive?: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handleIn = () => Animated.spring(scaleAnim, { toValue: 1.12, useNativeDriver: true, damping: 8, stiffness: 300 }).start();
  const handleOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={handleIn} onPressOut={handleOut}>
      <Animated.View style={[
        s.btn,
        active && s.btnActive,
        glow && s.btnGlow,
        destructive && s.btnDestructive,
        { transform: [{ scale: scaleAnim }] },
      ]}>
        {children}
        {badge !== undefined && badge > 0 && (
          <View style={s.badge}><Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text></View>
        )}
      </Animated.View>
    </Pressable>
  );
}

interface Props {
  isMicOn: boolean; isCameraOn: boolean; showCamera: boolean;
  isHandRaised: boolean; handBadgeCount: number; canModerate: boolean;
  chatBadgeCount: number; isChatOpen: boolean;
  /** Kullanıcı dinleyici mi? true = sahnede değil */
  isListener?: boolean;
  /** Oda sesini kıs/aç (dinleyici modu) */
  isRoomMuted?: boolean;
  onMicPress: () => void; onCameraPress: () => void;
  onEmojiPress: () => void; onHandPress: () => void;
  onChatPress: () => void; onPlusPress: () => void;
  /** Oda sesini kıs/aç handler (dinleyici modu) */
  onMuteRoomPress?: () => void;
}

/**
 * ═══════════════════════════════════════════════════════════
 * Alt Kontrol Çubuğu — Profesyonel Voice Chat Mantığı
 * ═══════════════════════════════════════════════════════════
 * 
 * Clubhouse / Twitter Spaces / HelloTalk referans:
 * 
 * DİNLEYİCİ:  🔊 Ses  |  😊 Emoji  |  ✋ Sahne Talebi  |  💬 Chat  |  +
 * SAHNEDE:     🎤 Mic  |  📹 Cam    |  😊 Emoji          |  💬 Chat  |  +
 * HOST/MOD:    🎤 Mic  |  📹 Cam    |  😊 Emoji  |  👥 Kuyruk(badge)  |  💬 Chat  |  +
 */
export default function RoomControlBar({
  isMicOn, isCameraOn, showCamera, isHandRaised, isRoomMuted,
  handBadgeCount, canModerate, chatBadgeCount, isChatOpen,
  isListener,
  onMicPress, onCameraPress, onEmojiPress,
  onHandPress, onChatPress, onPlusPress, onMuteRoomPress,
}: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.container}>

        {/* ═══ SLOT 1: Ses Kontrolü (rol bazlı) ═══ */}
        {isListener ? (
          /* Dinleyici → 🔊/🔇 Oda sesini kıs/aç */
          <BarBtn onPress={onMuteRoomPress || (() => { })} active={!isRoomMuted}>
            <Ionicons
              name={isRoomMuted ? 'volume-mute' : 'volume-high'}
              size={21}
              color={isRoomMuted ? '#EF4444' : '#94A3B8'}
            />
          </BarBtn>
        ) : (
          /* Sahnedeki → 🎤 Mikrofon toggle */
          <BarBtn onPress={onMicPress} active={isMicOn}>
            <Ionicons
              name={isMicOn ? 'mic' : 'mic-off'}
              size={21}
              color={isMicOn ? '#5CE6E6' : '#7AACAE'}
            />
          </BarBtn>
        )}

        {/* ═══ SLOT 2: Kamera (sadece sahnedekiler) ═══ */}
        {showCamera && (
          <BarBtn onPress={onCameraPress} active={isCameraOn}>
            <Ionicons
              name={isCameraOn ? 'videocam' : 'videocam-off'}
              size={20}
              color={isCameraOn ? '#5CE6E6' : '#7AACAE'}
            />
          </BarBtn>
        )}

        {/* ═══ 😊 Emoji ═══ */}
        <BarBtn onPress={onEmojiPress}>
          <Text style={{ fontSize: 20 }}>😊</Text>
        </BarBtn>

        {/* ═══ ✋ El Kaldır — sadece DİNLEYİCİLER (sahne talebi) ═══ */}
        {isListener && (
          <BarBtn
            onPress={onHandPress}
            active={isHandRaised}
            glow={isHandRaised}
          >
            <Ionicons
              name={isHandRaised ? 'hand-left' : 'hand-left-outline'}
              size={20}
              color={isHandRaised ? '#FBBF24' : '#94A3B8'}
            />
          </BarBtn>
        )}

        {/* ═══ 👥 Sahne Talebi Kuyruğu — sadece HOST/MOD ═══ */}
        {canModerate && !isListener && (
          <BarBtn
            onPress={onHandPress}
            badge={handBadgeCount}
            active={handBadgeCount > 0}
            glow={handBadgeCount > 0}
          >
            <Ionicons
              name="people-outline"
              size={20}
              color={handBadgeCount > 0 ? '#FBBF24' : '#94A3B8'}
            />
          </BarBtn>
        )}

        {/* ═══ 💬 Sohbet ═══ */}
        <BarBtn onPress={onChatPress} badge={chatBadgeCount} active={isChatOpen}>
          <Ionicons name="chatbubble-outline" size={20} color={isChatOpen ? '#5CE6E6' : '#94A3B8'} />
        </BarBtn>

        {/* ═══ ➕ Plus ═══ */}
        <BarBtn onPress={onPlusPress}>
          <Text style={{ fontSize: 22, color: '#94A3B8', fontWeight: '300' }}>+</Text>
        </BarBtn>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 2, alignItems: 'center' },
  container: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 6, paddingVertical: 5,
    borderRadius: 30,
    backgroundColor: 'rgba(45,61,77,0.85)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  btn: {
    width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2,
    backgroundColor: '#2d3d4d',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  btnActive: {
    borderColor: 'rgba(20,184,166,0.5)',
    backgroundColor: 'rgba(20,184,166,0.12)',
  },
  btnGlow: {
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDestructive: {
    borderColor: 'rgba(239,68,68,0.4)',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#14B8A6',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 8, fontWeight: '800' },
});
