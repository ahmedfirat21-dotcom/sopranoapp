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
import { COLORS } from './constants';

// Safe lazy VideoView
let _VideoViewComponent: any = null;
try { _VideoViewComponent = require('@livekit/react-native').VideoView; } catch(e) { console.warn('[VideoView] Native module not available:', e); }
const VideoView = _VideoViewComponent || (({ style }: any) => <View style={style}><Text style={{color:'#fff',fontSize:10,textAlign:'center'}}>📷</Text></View>);

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
};

const SeatCard = React.memo(function SeatCard({
  nick, role, speaking, mic, size, onPress, avatarUrl, micRequesting,
  audioLevel = 0, cameraOn = false, videoTrack, isLargeVideo = true,
  customWidth, customHeight, onFlipCamera, isAdmin = false,
}: SeatCardProps) {
  const isHost = role === 'host';
  const isOnStage = role === 'host' || role === 'speaker' || role === 'moderator';
  const initials = nick.slice(0, 2).toUpperCase();

  const isVideoMode = Boolean(cameraOn);
  const currentWidth = customWidth || size;
  const currentHeight = customHeight || ((isVideoMode && isLargeVideo) ? size * 1.4 : size);
  const currentRadius = (customWidth || (isVideoMode && isLargeVideo)) ? 16 : size / 2;

  // ★ FEAT-2: Ses dalgası efekti — audioLevel'e duyarlı animasyonlu çerçeve
  const waveAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (speaking && isOnStage && mic) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(waveAnim, { toValue: 0.3, duration: 400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    } else {
      waveAnim.stopAnimation();
      waveAnim.setValue(0);
    }
  }, [speaking, isOnStage, mic]);

  // audioLevel bazlı dinamik border genişliği (0→1.5, 1→3.5)
  const borderScale = speaking ? Math.max(1, 1 + audioLevel * 2.5) : 1;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={{ alignItems: 'center', marginHorizontal: 6, marginBottom: 8, width: customWidth ? customWidth + 12 : size * 1.25, paddingTop: 0 }}
    >
      <View style={{ width: currentWidth, height: currentHeight, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[
          styles.seatGlass,
          { width: currentWidth, height: currentHeight, borderRadius: currentRadius },
          isAdmin && { borderWidth: 2, borderColor: '#DC2626', shadowColor: '#DC2626', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 8 },
        ]}>
          <LinearGradient
            colors={['rgba(12,18,36,0.80)', 'rgba(8,14,28,0.92)']}
            style={[StyleSheet.absoluteFill, { borderRadius: currentRadius }]}
          />
          <View style={[styles.innerShadow, { borderRadius: currentRadius }]} />
          {cameraOn && videoTrack ? (
            <View style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: currentRadius }}>
              {/* ★ mirror={false} — kamera ters görüntü sorunu düzeltildi */}
              <VideoView videoTrack={videoTrack} style={{ flex: 1 }} objectFit="cover" mirror={false} />
              <View style={{ position: 'absolute', top: 4, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 4, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 2, zIndex: 2, elevation: 2 }}>
                <Ionicons name="videocam" size={9} color={COLORS.primary} />
                <Text style={{ color: COLORS.primary, fontSize: 7, fontWeight: '700' }}>CANLI</Text>
              </View>
              {onFlipCamera && (
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation?.(); onFlipCamera(); }}
                  activeOpacity={0.7}
                  style={{ position: 'absolute', bottom: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 10, elevation: 10 }}
                >
                  <Ionicons name="camera-reverse" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ) : cameraOn ? (
            <LinearGradient colors={['rgba(20,30,50,0.9)', 'rgba(10,15,30,0.9)']} style={[StyleSheet.absoluteFill, { borderRadius: currentRadius, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="videocam" size={size * 0.25} color="rgba(92,225,230,0.7)" />
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>Yükleniyor...</Text>
            </LinearGradient>
          ) : avatarUrl ? (
            <Image source={getAvatarSource(avatarUrl)} style={{ width: '100%', height: '100%', borderRadius: currentRadius }} />
          ) : (
             <Text style={[styles.seatInitials, { fontSize: size * 0.3 }]}>{initials}</Text>
          )}
        </View>

        {/* ★ FEAT-2: Konuşma Ses Dalgası Çerçevesi — tüm sahnedekiler için (sadece host değil) */}
        {isOnStage && mic && !cameraOn && (
          <Animated.View
            style={{
              position: 'absolute',
              top: -4, left: -4, right: -4, bottom: -4,
              borderRadius: currentRadius + 4,
              borderWidth: speaking ? Math.min(3.5, 1.5 * borderScale) : 1,
              borderColor: speaking
                ? isHost ? '#5CE1E6' : '#22C55E'  // Host: cyan, Speaker: yeşil
                : 'rgba(92,225,230,0.2)',
              shadowColor: speaking
                ? isHost ? '#5CE1E6' : '#22C55E'
                : 'transparent',
              shadowOpacity: speaking ? 0.6 + audioLevel * 0.4 : 0,
              shadowRadius: speaking ? 8 + audioLevel * 12 : 0,
              shadowOffset: { width: 0, height: 0 },
              elevation: speaking ? 6 + Math.round(audioLevel * 6) : 0,
              opacity: speaking ? waveAnim : 0.5,
            }}
          />
        )}

        {/* Mikrofon badge */}
        {(role === 'speaker' || role === 'host' || role === 'moderator') ? (
          <View style={[styles.micIndicator, mic ? styles.micOn : { backgroundColor: 'rgba(239,68,68,0.85)', borderColor: 'rgba(239,68,68,0.6)' }, { right: -2, bottom: -2 }]}>
            <Ionicons name={mic ? 'mic' : 'mic-off'} size={9} color="#fff" />
          </View>
        ) : (
          <View style={[styles.micIndicator, styles.micOff, { right: -2, bottom: -2 }]}>
            <Ionicons name="mic-off" size={9} color="rgba(255,255,255,0.35)" />
          </View>
        )}

        {/* Kamera badge */}
        {cameraOn && (
          <View style={{ position: 'absolute', left: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(92,225,230,0.25)', borderWidth: 1, borderColor: 'rgba(92,225,230,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="videocam" size={9} color={COLORS.primary} />
          </View>
        )}
      </View>

      <Text style={[styles.seatNick, { marginTop: 6 }, isAdmin && { color: '#F87171' }]} numberOfLines={1}>{nick}</Text>

      {isAdmin && (
        <View style={[styles.hostBadge, { backgroundColor: 'rgba(220,38,38,0.25)', borderColor: 'rgba(220,38,38,0.5)' }]}>
          <Ionicons name="shield-checkmark" size={8} color="#DC2626" />
        </View>
      )}

      {isHost && !isAdmin && (
        <View style={styles.hostBadge}>
          <Ionicons name="star" size={8} color={COLORS.vipGold} />
        </View>
      )}

      {role === 'moderator' && !isAdmin && (
        <View style={[styles.hostBadge, { backgroundColor: 'rgba(139,92,246,0.25)', borderColor: 'rgba(139,92,246,0.5)' }]}>
          <Ionicons name="shield" size={8} color="#8B5CF6" />
        </View>
      )}

      {/* Mikrofon isteği badge */}
      {micRequesting && (
        <View style={{ position: 'absolute', top: '35%', elevation: 15, shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: {width:0, height:3}, zIndex: 100, alignSelf: 'center', backgroundColor: '#FF9800', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
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
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  innerShadow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2.5,
    borderColor: 'rgba(0,0,0,0.2)',
    opacity: 0.4,
  },
  seatInitials: { color: COLORS.silver, fontWeight: '700', letterSpacing: 0.5 },
  seatNick: { color: COLORS.silverDark, fontSize: 10, fontWeight: '500', marginTop: 3, maxWidth: 60, textAlign: 'center' },
  hostBadge: {
    position: 'absolute', top: -1, right: -1,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 0.5, borderColor: COLORS.vipGold,
    alignItems: 'center', justifyContent: 'center',
  },
  micIndicator: {
    position: 'absolute',
    width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5,
  },
  micOn: { backgroundColor: 'rgba(92,225,230,0.18)', borderColor: 'rgba(92,225,230,0.5)' },
  micOff: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
});
