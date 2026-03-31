/**
 * SopranoChat — İlk Giriş Hoşgeldin Akışı
 * Kullanıcı ilk kez Home'a düştüğünde gösterilir.
 * 3 adım: Hoşgeldin → İlgi Alanları → Popüler Odalar
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Animated, Dimensions, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { getAvatarSource } from '../constants/avatars';

const { width: W } = Dimensions.get('window');

const INTEREST_OPTIONS = [
  { id: 'chat', icon: '💬', label: 'Sohbet' },
  { id: 'music', icon: '🎵', label: 'Müzik' },
  { id: 'game', icon: '🎮', label: 'Oyun' },
  { id: 'tech', icon: '💻', label: 'Teknoloji' },
  { id: 'book', icon: '📚', label: 'Kitap' },
  { id: 'film', icon: '🎬', label: 'Film & Dizi' },
  { id: 'sports', icon: '⚽', label: 'Spor' },
  { id: 'art', icon: '🎨', label: 'Sanat' },
  { id: 'travel', icon: '✈️', label: 'Seyahat' },
  { id: 'food', icon: '🍽️', label: 'Yemek' },
  { id: 'crypto', icon: '₿', label: 'Kripto' },
  { id: 'fitness', icon: '💪', label: 'Fitness' },
];

interface Props {
  visible: boolean;
  displayName: string;
  avatarUrl?: string;
  onComplete: (interests: string[]) => void;
}

export default function WelcomeFlowModal({ visible, displayName, avatarUrl, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 1, friction: 7, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const nextStep = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(s => s + 1);
      Animated.spring(slideAnim, { toValue: 1, friction: 7, useNativeDriver: true }).start();
    });
  };

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
          <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[Colors.teal, Colors.cyan, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.accentLine}
          />

          {/* Step Indicator */}
          <View style={styles.stepRow}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.stepDot, i <= step && styles.stepDotActive]} />
            ))}
          </View>

          {/* Step 0: Hoşgeldin */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <Image source={getAvatarSource(avatarUrl)} style={styles.welcomeAvatar} />
              <Text style={styles.welcomeTitle}>Hoş geldin, {displayName}! 🎉</Text>
              <Text style={styles.welcomeDesc}>
                SopranoChat'e katıldığın için harika! Burada canlı sesli odalar oluşturabilir, arkadaş edinebilir ve Soprano Coin kazanabilirsin.
              </Text>
              <View style={styles.featureRow}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🎙️</Text>
                  <Text style={styles.featureLabel}>Sesli Odalar</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>💰</Text>
                  <Text style={styles.featureLabel}>Coin Kazan</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🎁</Text>
                  <Text style={styles.featureLabel}>Hediye Gönder</Text>
                </View>
              </View>
              <Pressable style={styles.nextBtn} onPress={nextStep}>
                <LinearGradient colors={[Colors.teal, Colors.cyan]} style={styles.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.nextBtnText}>Başlayalım</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {/* Step 1: İlgi Alanları */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>🎯 İlgi Alanlarını Seç</Text>
              <Text style={styles.stepDesc}>Sana uygun odaları ve içerikleri önermemize yardımcı ol</Text>
              <View style={styles.interestGrid}>
                {INTEREST_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.id}
                    style={[styles.interestChip, selectedInterests.includes(opt.id) && styles.interestChipActive]}
                    onPress={() => toggleInterest(opt.id)}
                  >
                    <Text style={styles.interestIcon}>{opt.icon}</Text>
                    <Text style={[styles.interestLabel, selectedInterests.includes(opt.id) && styles.interestLabelActive]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.nextBtn} onPress={nextStep}>
                <LinearGradient colors={[Colors.teal, Colors.cyan]} style={styles.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.nextBtnText}>{selectedInterests.length > 0 ? 'Devam Et' : 'Atla'}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {/* Step 2: Hazırsın */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>🚀</Text>
              <Text style={styles.stepTitle}>Hazırsın!</Text>
              <Text style={styles.stepDesc}>
                Her gün giriş yaparak Soprano Coin kazanabilirsin.{'\n'}
                Şimdi canlı odalara göz at veya ilk gönderini paylaş!
              </Text>
              <View style={styles.tipBox}>
                <Ionicons name="bulb-outline" size={18} color={Colors.gold} />
                <Text style={styles.tipText}>İpucu: Her gün giriş yapan kullanıcılar seri bonusu ile daha fazla coin kazanır!</Text>
              </View>
              <Pressable style={styles.nextBtn} onPress={() => onComplete(selectedInterests)}>
                <LinearGradient colors={[Colors.teal, Colors.cyan]} style={styles.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.nextBtnText}>Keşfetmeye Başla</Text>
                  <Ionicons name="rocket" size={18} color="#FFF" />
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: W - 40, maxWidth: 400, borderRadius: 24, overflow: 'hidden', padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  accentLine: { position: 'absolute', top: 0, left: 20, right: 20, height: 2, borderRadius: 1 },
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20, marginTop: 8 },
  stepDot: { width: 24, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  stepDotActive: { backgroundColor: Colors.teal, width: 32 },
  stepContent: { alignItems: 'center' },
  welcomeAvatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: Colors.teal, marginBottom: 16 },
  welcomeTitle: { fontSize: 22, fontWeight: '800', color: '#F1F5F9', textAlign: 'center', marginBottom: 8 },
  welcomeDesc: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  featureRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  featureItem: { alignItems: 'center', gap: 6 },
  featureIcon: { fontSize: 28 },
  featureLabel: { fontSize: 12, color: '#CBD5E1', fontWeight: '600' },
  stepTitle: { fontSize: 20, fontWeight: '800', color: '#F1F5F9', textAlign: 'center', marginBottom: 6 },
  stepDesc: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 20 },
  interestChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  interestChipActive: { backgroundColor: 'rgba(20,184,166,0.2)', borderColor: Colors.teal },
  interestIcon: { fontSize: 16 },
  interestLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  interestLabelActive: { color: Colors.teal },
  tipBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,193,7,0.08)', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)' },
  tipText: { flex: 1, fontSize: 13, color: '#CBD5E1', lineHeight: 19 },
  nextBtn: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  nextBtnGrad: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 14 },
  nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
