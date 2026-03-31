/**
 * SopranoChat — Gelen Arama Overlay
 * DM üzerinden gelen arama bildirimi — kabul/red
 */
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';
import type { CallType } from '../services/call';

const { width: W } = Dimensions.get('window');

type Props = {
  visible: boolean;
  callerName: string;
  callerAvatar?: string;
  callType: CallType;
  onAccept: () => void;
  onReject: () => void;
};

export function IncomingCallOverlay({ visible, callerName, callerAvatar, callType, onAccept, onReject }: Props) {
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }).start();

      // Pulse animasyonu
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient
        colors={['rgba(10,10,18,0.98)', 'rgba(18,18,37,0.98)']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Avatar + bilgi */}
          <View style={styles.callerInfo}>
            <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulseAnim }] }]}>
              <Image
                source={{ uri: callerAvatar || 'https://i.pravatar.cc/80?img=5' }}
                style={styles.avatar}
              />
            </Animated.View>
            <View style={styles.textWrap}>
              <Text style={styles.callerName} numberOfLines={1}>{callerName}</Text>
              <Text style={styles.callTypeText}>
                {callType === 'video' ? '📹 Görüntülü Arama' : '📞 Sesli Arama'}
              </Text>
            </View>
          </View>

          {/* Butonlar */}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.7}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.7}>
              <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 9999,
    elevation: 999,
  },
  gradient: {
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(92,225,230,0.2)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatarWrap: {
    width: 54, height: 54, borderRadius: 27,
    borderWidth: 2, borderColor: Colors.teal,
    justifyContent: 'center', alignItems: 'center',
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  textWrap: { flex: 1 },
  callerName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  callTypeText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center',
  },
  acceptBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#22C55E',
    justifyContent: 'center', alignItems: 'center',
  },
});
