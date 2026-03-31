import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

let VideoView: any = null;
try {
  const livekit = require('@livekit/react-native');
  VideoView = livekit.VideoView;
} catch (e) {
  console.warn('[LiveKit] VideoView yüklenemedi, Expo Go kullanılıyor olabilir.');
}
import type { Participant, Track, VideoTrack } from 'livekit-client';
import { Colors, Radius } from '../constants/theme';
import { getAvatarSource } from '../constants/avatars';
import { type ParticipantUpdate } from '../services/livekit';

interface VideoTileProps {
  participant?: Participant;
  participantUpdate?: ParticipantUpdate; // From livekitService events
  displayName: string;
  avatarUrl?: string;
  isHost?: boolean;
  style?: any;
  isScreenShare?: boolean;
}

export default function VideoTile({ participant, participantUpdate, displayName, avatarUrl, isHost, style, isScreenShare }: VideoTileProps) {
  const isSpeaking = participantUpdate?.isSpeaking ?? false;
  const isMuted = participantUpdate?.isMuted ?? true;
  const isCameraEnabled = participantUpdate?.isCameraEnabled ?? false;

  // TrackPublication'dan Track referansını al
  const source = isScreenShare ? 'screen_share' : 'camera';
  const pub = participant?.getTrackPublication(source as any);
  const track = pub?.track as VideoTrack | undefined;

  return (
    <View style={[styles.container, style, isSpeaking && !isMuted && styles.speakingGlow]}>
      {/* Görüntü Var Mı? */}
      {VideoView && track && (isCameraEnabled || isScreenShare) ? (
        <VideoView videoTrack={track} style={styles.video} objectFit={isScreenShare ? "contain" : "cover"} />
      ) : (
        // Kamera Kapalıysa / Yükleniyorsa Siyah Zemin üzerine Avatar
        <View style={styles.noVideoContainer}>
          <Image source={getAvatarSource(avatarUrl)} style={styles.avatar} />
        </View>
      )}

      {/* İndikatörler */}
      <View style={styles.overlays}>
        <View style={styles.bottomInfo}>
          <View style={styles.nameBadge}>
            {isHost && <Ionicons name="star" size={10} color={Colors.gold} style={{ marginRight: 4 }} />}
            <Text style={styles.nameText} numberOfLines={1}>{displayName}</Text>
          </View>
          <View style={[styles.micBadge, { backgroundColor: isMuted ? 'rgba(239,68,68,0.8)' : 'rgba(20,184,166,0.8)' }]}>
            <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={12} color="#fff" />
          </View>
        </View>
        
        {isScreenShare && (
          <View style={styles.topBadge}>
            <Text style={styles.topBadgeText}>Ekran Paylaşıyor</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bg2,
    borderRadius: Radius.default,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  speakingGlow: {
    borderColor: Colors.teal,
    shadowColor: Colors.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  noVideoContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: Colors.glassBorder,
  },
  overlays: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'space-between',
    padding: 8,
  },
  topBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139,92,246,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  topBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  bottomInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
    marginTop: 'auto',
  },
  nameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    maxWidth: '75%',
  },
  nameText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  micBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
