/**
 * SopranoChat — Günlük Check-in Modal
 * Her gün giriş yapınca coin kazan + seri göster
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { DailyCheckInService, type CheckInResult } from '../services/engagement';

const { width: W } = Dimensions.get('window');
const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const REWARDS = [5, 10, 15, 20, 25, 35, 50];

interface Props {
  visible: boolean;
  userId: string;
  onDismiss: () => void;
  onCoinsEarned?: (coins: number) => void;
}

export default function DailyCheckInModal({ visible, userId, onDismiss, onCoinsEarned }: Props) {
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [loading, setLoading] = useState(true);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const coinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && userId) {
      setLoading(true);
      DailyCheckInService.checkIn(userId).then(r => {
        setResult(r);
        setLoading(false);
        if (r.coinsEarned > 0) {
          onCoinsEarned?.(r.coinsEarned);
        }
      });

      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
      Animated.sequence([
        Animated.delay(300),
        Animated.spring(coinAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      coinAnim.setValue(0);
    }
  }, [visible, userId]);

  if (!visible) return null;

  const streak = result?.streak || 0;

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          
          {/* Accent line */}
          <LinearGradient
            colors={[Colors.teal, Colors.cyan, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.accentLine}
          />

          {/* Başlık */}
          <Text style={styles.title}>🔥 Günlük Giriş</Text>
          <Text style={styles.subtitle}>
            {result?.alreadyCheckedIn 
              ? 'Bugün zaten giriş yaptın!'
              : loading ? 'Yükleniyor...' : `+${result?.coinsEarned || 0} Soprano Coin kazandın!`}
          </Text>

          {/* Seri sayacı */}
          <View style={styles.streakRow}>
            {DAYS.map((day, i) => {
              const dayNum = i + 1;
              const isCompleted = dayNum <= streak;
              const isCurrent = dayNum === streak;
              return (
                <View key={day} style={[styles.dayBox, isCompleted && styles.dayBoxCompleted, isCurrent && styles.dayBoxCurrent]}>
                  <Text style={[styles.dayLabel, isCompleted && styles.dayLabelCompleted]}>{day}</Text>
                  <Animated.Text style={[
                    styles.dayReward,
                    isCompleted && styles.dayRewardCompleted,
                    isCurrent && { transform: [{ scale: coinAnim }] }
                  ]}>
                    {isCompleted ? '✅' : `${REWARDS[i]}`}
                  </Animated.Text>
                </View>
              );
            })}
          </View>

          {/* Seri bilgisi */}
          <View style={styles.streakInfo}>
            <Text style={styles.streakText}>🔥 {streak} gün seri</Text>
            {streak >= 7 && <Text style={styles.streakBonus}>🏆 Rozet kazandın!</Text>}
          </View>

          {/* Kapat */}
          <Pressable style={styles.closeBtn} onPress={onDismiss}>
            <LinearGradient colors={[Colors.teal, Colors.cyan]} style={styles.closeBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.closeBtnText}>Harika!</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: W - 48,
    maxWidth: 380,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 2,
    borderRadius: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F1F5F9',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.teal,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 16,
  },
  dayBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dayBoxCompleted: {
    backgroundColor: 'rgba(20,184,166,0.15)',
    borderColor: 'rgba(20,184,166,0.3)',
  },
  dayBoxCurrent: {
    backgroundColor: 'rgba(20,184,166,0.25)',
    borderColor: Colors.teal,
    borderWidth: 1.5,
  },
  dayLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
    marginBottom: 4,
  },
  dayLabelCompleted: {
    color: Colors.teal,
  },
  dayReward: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '700',
  },
  dayRewardCompleted: {
    fontSize: 16,
  },
  streakInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  streakText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '700',
  },
  streakBonus: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: '600',
  },
  closeBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  closeBtnGrad: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
