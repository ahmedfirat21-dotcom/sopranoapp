import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Image,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';
import { getFrameLottieSource, getFrameScale } from '../../constants/frames';
import { COLORS } from './constants';
import LottieView from 'lottie-react-native';

// VideoView — @livekit/react-native native modülü varsa gerçek VideoView kullan
let VideoView: any;
try {
  VideoView = require('@livekit/react-native').VideoView;
} catch (e) {
  VideoView = ({ style }: any) => <View style={style}><Text style={{color:'#fff',fontSize:10,textAlign:'center'}}>📷</Text></View>;
}



type SeatCardProps = {
  nick: string;
  role: string;
  speaking: boolean;
  mic: boolean;
  size: number;
  onPress: () => void;
  avatarUrl?: string;
  micRequesting?: boolean;
  audioLevel?: number;
  cameraOn?: boolean;
  videoTrack?: any;
  isLargeVideo?: boolean;
  customWidth?: number;
  customHeight?: number;
  onFlipCamera?: () => void;
  isAdmin?: boolean;
  isMuted?: boolean;
  isChatMuted?: boolean;
  activeFrame?: string | null; // ★ Mağaza çerçevesi
  seatNumber?: number; // ★ HelloTalk tarzı koltuk numarası
  isActingHost?: boolean; // ★ Vekil host badge
};

const SeatCard = React.memo(function SeatCard({
  nick, role, speaking, mic, size, onPress, avatarUrl, micRequesting,
  audioLevel = 0, cameraOn = false, videoTrack, isLargeVideo = true,
  customWidth, customHeight, onFlipCamera, isAdmin = false,
  isMuted = false, isChatMuted = false, activeFrame, seatNumber,
  isActingHost = false,
}: SeatCardProps) {
  const isHost = role === 'owner';
  const isOnStage = role === 'owner' || role === 'speaker' || role === 'moderator';
  const initials = nick.slice(0, 2).toUpperCase();

  const isVideoMode = Boolean(cameraOn);
  const currentWidth = customWidth || size;
  const currentHeight = customHeight || ((isVideoMode && isLargeVideo) ? size * 1.4 : size);
  const currentRadius = (customWidth || (isVideoMode && isLargeVideo)) ? 14 : size / 2;

  // ★ Lottie çerçeve
  const frameSrc = getFrameLottieSource(activeFrame);
  const hasFrame = !!frameSrc && !isVideoMode;

  // ★ Konuşurken glow pulse
  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (speaking && isOnStage && mic) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [speaking, isOnStage, mic]);

  const glowColor = isHost ? '#5CE1E6' : '#22C55E';
  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.06)', glowColor],
  });
  const glowShadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.05, 0.6],
  });

  // ★ Çerçeve boyut hesabı — avatar dairesine tam oturmak için
  const fScale = hasFrame ? getFrameScale(activeFrame) : 1;
  const frameContainerSize = hasFrame ? size * fScale : size;
  // ★ FIX: Çerçeve varken avatar'ı biraz küçült — iç boşluğa oturması için
  const avatarSize = hasFrame ? size * 0.78 : currentWidth;
  const avatarHeight = hasFrame ? size * 0.78 : currentHeight;
  const avatarRadius = hasFrame ? (size * 0.78) / 2 : currentRadius;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ alignItems: 'center', width: Math.max(currentWidth, frameContainerSize), marginBottom: 2 }}>

      {/* ★ Avatar + Çerçeve sarmalayıcı: çerçeve ve avatar aynı merkeze sahip */}
      <View style={{ width: frameContainerSize, height: frameContainerSize, alignItems: 'center', justifyContent: 'center' }}>
        {/* Lottie çerçeve — tam container boyutunda */}
        {hasFrame && (
          <View
            style={{
              position: 'absolute',
              width: frameContainerSize,
              height: frameContainerSize,
              zIndex: 5,
            }}
            pointerEvents="none"
          >
            <LottieView source={frameSrc} autoPlay loop style={{ width: '100%', height: '100%' }} />
          </View>
        )}

        {/* Ana kart (avatar dairesi) — container'ın tam ortasında */}
        <Animated.View
          style={[
            styles.seatGlass,
            {
              width: avatarSize,
              height: avatarHeight,
              borderRadius: avatarRadius,
              borderColor: hasFrame ? 'transparent' : borderColor,
              borderWidth: hasFrame ? 0 : 2,
              shadowColor: hasFrame ? 'transparent' : glowColor,
              shadowOpacity: hasFrame ? 0 : (glowShadowOpacity as any),
              shadowRadius: speaking && !hasFrame ? 12 : 4,
            },
          ]}
        >
          {/* Arkaplan gradient */}
          <LinearGradient
            colors={['rgba(12,18,36,0.80)', 'rgba(8,14,28,0.92)']}
            style={[StyleSheet.absoluteFill, { borderRadius: avatarRadius }]}
          />

          {/* Kamera görüntüsü */}
          {cameraOn && videoTrack ? (
            <View style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: avatarRadius }}>
              <VideoView
                videoTrack={videoTrack}
                style={{ flex: 1 }}
                objectFit="cover"
                mirror={true}
              />
              {onFlipCamera && (
                <TouchableOpacity
                  onPress={(e: any) => { e.stopPropagation?.(); onFlipCamera(); }}
                  activeOpacity={0.7}
                  style={styles.flipBtn}
                >
                  <Ionicons name="camera-reverse-outline" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

          ) : cameraOn ? (
            <LinearGradient colors={['rgba(20,30,50,0.9)', 'rgba(10,15,30,0.9)']} style={[StyleSheet.absoluteFill, { borderRadius: avatarRadius, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="videocam" size={size * 0.25} color="rgba(92,225,230,0.7)" />
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 4 }}>Yükleniyor...</Text>
            </LinearGradient>

          ) : avatarUrl ? (
            <Image source={getAvatarSource(avatarUrl)} style={{ width: '100%', height: '100%', borderRadius: avatarRadius }} />

          ) : (
            <Text style={[styles.seatInitials, { fontSize: size * 0.3 }]}>{initials}</Text>
          )}
        </Animated.View>
      </View>

      {/* Mikrofon badge */}
      {(role === 'speaker' || role === 'owner' || role === 'moderator') ? (
        <View style={[styles.micIndicator, (mic && !isMuted) ? styles.micOn : styles.micMuted, { right: -2, bottom: -2 }]}>
          <Ionicons name={(mic && !isMuted) ? 'mic' : 'mic-off'} size={9} color="#fff" />
        </View>
      ) : (
        <View style={[styles.micIndicator, styles.micOff, { right: -2, bottom: -2 }]}>
          <Ionicons name="mic-off" size={9} color="rgba(255,255,255,0.35)" />
        </View>
      )}

      {/* ★ Muted badge */}
      {isMuted && (
        <View style={styles.mutedBadge}>
          <Ionicons name="volume-mute" size={10} color="#EF4444" />
        </View>
      )}

      {/* ★ Chat muted badge */}
      {isChatMuted && (
        <View style={[styles.mutedBadge, { left: -2, right: undefined, backgroundColor: 'rgba(249,115,22,0.25)', borderColor: 'rgba(249,115,22,0.5)' }]}>
          <Ionicons name="chatbox-outline" size={9} color="#F97316" />
        </View>
      )}

      {/* ★ Koltuk numarası badge */}
      {seatNumber != null && seatNumber > 0 && (
        <View style={styles.seatNumberBadge}>
          <Text style={styles.seatNumberText}>{seatNumber}</Text>
        </View>
      )}

      <Text style={[styles.seatNick, { marginTop: 5 }, isAdmin && { color: '#F87171' }, isMuted && { color: 'rgba(239,68,68,0.6)' }]} numberOfLines={1}>{nick}</Text>

      {isAdmin && (
        <View style={[styles.hostBadge, { backgroundColor: 'rgba(220,38,38,0.25)', borderColor: 'rgba(220,38,38,0.5)' }]}>
          <Ionicons name="shield-checkmark" size={8} color="#DC2626" />
        </View>
      )}

      {isHost && !isAdmin && !isActingHost && (
        <View style={styles.hostBadge}>
          <Ionicons name="star" size={8} color={COLORS.premiumGold} />
        </View>
      )}

      {isHost && !isAdmin && isActingHost && (
        <View style={[styles.hostBadge, { backgroundColor: 'rgba(249,115,22,0.15)', borderColor: 'rgba(249,115,22,0.5)' }]}>
          <Ionicons name="shield-half" size={8} color="#F97316" />
        </View>
      )}

      {role === 'moderator' && !isAdmin && (
        <View style={[styles.hostBadge, { backgroundColor: 'rgba(139,92,246,0.25)', borderColor: 'rgba(139,92,246,0.5)' }]}>
          <Ionicons name="shield" size={8} color="#8B5CF6" />
        </View>
      )}

      {micRequesting && (
        <View style={styles.micRequestBadge}>
          <Ionicons name="mic" size={10} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>İstek</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

export default SeatCard;

const styles = StyleSheet.create({
  seatGlass: {
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    elevation: 4,
  },
  seatInitials: { color: COLORS.silver, fontWeight: '700', letterSpacing: 0.5 },
  seatNick: { color: COLORS.silverDark, fontSize: 10, fontWeight: '600', marginTop: 3, maxWidth: 76, textAlign: 'center' },
  hostBadge: {
    position: 'absolute', top: -1, right: -1,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 0.5, borderColor: COLORS.premiumGold,
    alignItems: 'center', justifyContent: 'center',
  },
  micIndicator: {
    position: 'absolute',
    width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5,
  },
  micOn: { backgroundColor: 'rgba(92,225,230,0.18)', borderColor: 'rgba(92,225,230,0.5)' },
  micMuted: { backgroundColor: 'rgba(239,68,68,0.85)', borderColor: 'rgba(239,68,68,0.6)' },
  micOff: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
  flipBtn: {
    position: 'absolute', bottom: 6, right: 6,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10, elevation: 10,
  },
  micRequestBadge: {
    position: 'absolute', top: '35%',
    elevation: 15, shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    zIndex: 100, alignSelf: 'center',
    backgroundColor: '#FF9800', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2,
    flexDirection: 'row', alignItems: 'center', gap: 2,
  },
  mutedBadge: {
    position: 'absolute', top: -2, left: undefined, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(239,68,68,0.25)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  seatNumberBadge: {
    position: 'absolute', bottom: 12, left: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(92,225,230,0.2)', borderWidth: 1, borderColor: 'rgba(92,225,230,0.4)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, zIndex: 6,
  },
  seatNumberText: {
    color: '#5CE1E6', fontSize: 8, fontWeight: '800',
  },
});
