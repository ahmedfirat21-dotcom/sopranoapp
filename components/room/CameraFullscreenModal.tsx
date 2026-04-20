// SopranoChat — Kamera Fullscreen Modal
// Speaker'ın kamerasını büyük göster. X ile kapatılır, swipe-down ile de kapatılır.
// 2026-04-20: Yeni eklendi — avatar kamera rozeti tap → bu modal.

import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Dimensions, Animated, PanResponder, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAvatarSource } from '../../constants/avatars';
import type { RoomParticipant } from '../../types';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  user: RoomParticipant | null;
  videoTrack: any;
  VideoView?: any;
  isMe?: boolean;
  onClose: () => void;
}

export default function CameraFullscreenModal({ visible, user, videoTrack, VideoView, isMe, onClose }: Props) {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 120) {
          Animated.timing(translateY, { toValue: H, duration: 200, useNativeDriver: true }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }).start();
        }
      },
    }),
  ).current;

  if (!visible || !user) return null;

  const displayName = (user as any).disguise?.display_name || user.user?.display_name || 'Kullanıcı';
  const avatarUrl = (user as any).disguise?.avatar_url || user.user?.avatar_url;
  const role = user.role;
  const roleLabel = role === 'owner' ? 'Host' : role === 'moderator' ? 'Moderatör' : 'Konuşmacı';

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        {/* Video — tam ekran */}
        {VideoView && videoTrack ? (
          <VideoView videoTrack={videoTrack} style={StyleSheet.absoluteFill} objectFit="cover" mirror={!!isMe} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallback]}>
            <Image source={getAvatarSource(avatarUrl)} style={styles.fallbackAvatar} />
            <Text style={styles.fallbackText}>Kamera yayını bekleniyor…</Text>
          </View>
        )}

        {/* Üst gradient + close */}
        <LinearGradient
          colors={['rgba(0,0,0,0.65)', 'transparent']}
          style={styles.topGradient}
          pointerEvents="none"
        />
        <View style={styles.topRow}>
          <View style={styles.userPill}>
            <Image source={getAvatarSource(avatarUrl)} style={styles.pillAvatar} />
            <View>
              <Text style={styles.pillName}>{displayName}</Text>
              <Text style={styles.pillRole}>{roleLabel}</Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Alt ipucu — swipe to dismiss */}
        <View style={styles.bottomHint}>
          <View style={styles.hintBar} />
          <Text style={styles.hintText}>Aşağı kaydır ya da ✕ ile kapat</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1926',
  },
  fallbackAvatar: {
    width: 120, height: 120, borderRadius: 60,
    opacity: 0.6,
  },
  fallbackText: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  topGradient: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 120,
  },
  topRow: {
    position: 'absolute',
    top: 48,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillAvatar: { width: 32, height: 32, borderRadius: 16 },
  pillName: { color: '#F1F5F9', fontSize: 13, fontWeight: '700' },
  pillRole: { color: '#14B8A6', fontSize: 10, fontWeight: '600', marginTop: 1 },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  bottomHint: {
    position: 'absolute',
    bottom: 36,
    left: 0, right: 0,
    alignItems: 'center',
    gap: 8,
  },
  hintBar: {
    width: 40, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  hintText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '500',
  },
});
