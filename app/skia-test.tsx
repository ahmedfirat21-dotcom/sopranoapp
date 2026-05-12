/**
 * Skia primitive test/showcase ekranı.
 *
 * Amaç: Skia tabanlı SkiaShadow ile RN tabanlı shadow()/elevation çıktısını
 * yan yana gösterip parite doğrulaması yapmak.
 *
 * Erişim: /skia-test rotası (admin ekranından buton veya doğrudan deep link).
 * Production'da kullanılmaz; AvatarFrame/TierBadge Skia geçişi tamamlanınca silinir.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { SkiaShadow, isSkiaAvailable } from '../components/skia';
import { shadow as rnShadow, glow as rnGlow } from '../utils/shadow';

export default function SkiaTestScreen() {
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Skia Parity Test', headerStyle: { backgroundColor: '#0A0F1A' }, headerTintColor: '#fff' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Skia vs RN — Gölge Paritesi</Text>
        <Text style={styles.sub}>Her sıra: solda mevcut RN shadow(), sağda yeni SkiaShadow. iOS ve Android'de bakıp aynı görünmeli.</Text>

        {!isSkiaAvailable() && (
          <View style={styles.warnBanner}>
            <Text style={styles.warnTitle}>Skia native modül APK'da yok</Text>
            <Text style={styles.warnBody}>Sağ taraftaki gölgeler şu an boş görünecek (fallback aktif). APK'yı Skia ile rebuild ettikten sonra Skia gölgeleri çalışacak.</Text>
          </View>
        )}

        <Section title="1. Düz kart (4px down, 12px blur, %25 black)">
          <View style={styles.row}>
            <View style={[styles.card, rnShadow({ size: 'md' })]}>
              <Text style={styles.cardLabel}>RN shadow('md')</Text>
            </View>
            <SkiaShadow shadowColor="#000" shadowOpacity={0.25} shadowBlur={12} shadowOffsetY={4} borderRadius={12}>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>SkiaShadow</Text>
              </View>
            </SkiaShadow>
          </View>
        </Section>

        <Section title="2. Renkli glow (turkuaz, 14px blur, %60 opacity)">
          <View style={styles.row}>
            <View style={[styles.card, rnGlow('#14B8A6', { intensity: 'high' })]}>
              <Text style={styles.cardLabel}>RN glow('#14B8A6')</Text>
            </View>
            <SkiaShadow shadowColor="#14B8A6" shadowOpacity={0.6} shadowBlur={14} shadowOffsetY={0} borderRadius={12}>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>SkiaShadow turkuaz</Text>
              </View>
            </SkiaShadow>
          </View>
        </Section>

        <Section title="3. Altın glow (premium frame örneği)">
          <View style={styles.row}>
            <View style={[styles.card, rnGlow('#FBBF24', { intensity: 'high' })]}>
              <Text style={styles.cardLabel}>RN glow gold</Text>
            </View>
            <SkiaShadow shadowColor="#FBBF24" shadowOpacity={0.8} shadowBlur={22} shadowOffsetY={0} borderRadius={12}>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>SkiaShadow gold</Text>
              </View>
            </SkiaShadow>
          </View>
        </Section>

        <Section title="4. Yuvarlak avatar gölgesi (60dp circle)">
          <View style={styles.row}>
            <View style={[styles.avatar, rnShadow({ size: 'lg', color: '#000' })]}>
              <Text style={styles.cardLabel}>RN</Text>
            </View>
            <SkiaShadow shadowColor="#000" shadowOpacity={0.4} shadowBlur={14} shadowOffsetY={5} borderRadius={30}>
              <View style={styles.avatar}>
                <Text style={styles.cardLabel}>Skia</Text>
              </View>
            </SkiaShadow>
          </View>
        </Section>

        <Section title="5. Büyük dramatic shadow (modal/sheet)">
          <View style={styles.row}>
            <View style={[styles.bigCard, rnShadow({ size: 'xl' })]}>
              <Text style={styles.cardLabel}>RN xl</Text>
            </View>
            <SkiaShadow shadowColor="#000" shadowOpacity={0.5} shadowBlur={30} shadowOffsetY={12} borderRadius={20}>
              <View style={styles.bigCard}>
                <Text style={styles.cardLabel}>Skia</Text>
              </View>
            </SkiaShadow>
          </View>
        </Section>

        <Text style={styles.footer}>Platform: {Platform.OS} {Platform.Version}</Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0F1A' },
  scroll: { padding: 16, paddingBottom: 80 },
  header: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  sub: { color: '#94A3B8', fontSize: 13, marginBottom: 24, lineHeight: 18 },
  section: { marginBottom: 32 },
  sectionTitle: { color: '#FBBF24', fontSize: 14, fontWeight: '600', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 32, alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap' },
  card: { width: 140, height: 90, backgroundColor: '#1E293B', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bigCard: { width: 160, height: 110, backgroundColor: '#1E293B', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 60, height: 60, backgroundColor: '#1E293B', borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { color: '#fff', fontSize: 12, fontWeight: '500' },
  footer: { color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 16 },
  warnBanner: { backgroundColor: '#451A03', borderColor: '#F59E0B', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 20 },
  warnTitle: { color: '#F59E0B', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  warnBody: { color: '#FBBF24', fontSize: 12, lineHeight: 17 },
});
