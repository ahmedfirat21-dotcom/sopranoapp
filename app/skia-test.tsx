/**
 * Skia primitive test/showcase ekranı.
 *
 * Amaç: Skia tabanlı primitive'ler ile mevcut RN karşılıklarını yan yana göstermek.
 * Erişim: /skia-test rotası (admin ekranındaki "Skia Parite Testi" QuickAction).
 * Production'da kullanılmaz; migration tamamlanınca silinir.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { SkiaShadow, SkiaCard, SkiaButton, SkiaDivider, isSkiaAvailable } from '../components/skia';
import { shadow as rnShadow, glow as rnGlow } from '../utils/shadow';

export default function SkiaTestScreen() {
  const skiaOk = isSkiaAvailable();

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Skia Parite Testi', headerStyle: { backgroundColor: '#0A0F1A' }, headerTintColor: '#fff' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Skia vs RN — Parite Testi</Text>
        <Text style={styles.sub}>Her sıra: solda mevcut RN yaklaşımı, sağda Skia primitive. Aynı görünmeli.</Text>

        {!skiaOk && (
          <View style={styles.warnBanner}>
            <Text style={styles.warnTitle}>Skia native modül APK'da yok</Text>
            <Text style={styles.warnBody}>Sağ taraftaki Skia çıktıları şu an fallback (sade View) gösteriyor. APK'yı Skia ile rebuild ettikten sonra gerçek Skia render'ı çalışacak.</Text>
          </View>
        )}

        <SectionTitle>1. Düz kart gölgesi (12px blur, 4px down, %25 black)</SectionTitle>
        <View style={styles.row}>
          <View style={[styles.card, rnShadow({ size: 'md' })]}>
            <Text style={styles.cardLabel}>RN shadow('md')</Text>
          </View>
          <SkiaShadow shadowColor="#000" shadowOpacity={0.25} shadowBlur={12} shadowOffsetY={4} borderRadius={12}>
            <View style={styles.card}><Text style={styles.cardLabel}>SkiaShadow</Text></View>
          </SkiaShadow>
        </View>

        <SectionTitle>2. Turkuaz glow (renkli halo, 14px blur)</SectionTitle>
        <View style={styles.row}>
          <View style={[styles.card, rnGlow('#14B8A6', { intensity: 'high' })]}>
            <Text style={styles.cardLabel}>RN glow turkuaz</Text>
          </View>
          <SkiaShadow shadowColor="#14B8A6" shadowOpacity={0.6} shadowBlur={14} shadowOffsetY={0} borderRadius={12}>
            <View style={styles.card}><Text style={styles.cardLabel}>SkiaShadow</Text></View>
          </SkiaShadow>
        </View>

        <SectionTitle>3. Altın glow (premium frame)</SectionTitle>
        <View style={styles.row}>
          <View style={[styles.card, rnGlow('#FBBF24', { intensity: 'high' })]}>
            <Text style={styles.cardLabel}>RN glow gold</Text>
          </View>
          <SkiaShadow shadowColor="#FBBF24" shadowOpacity={0.8} shadowBlur={22} shadowOffsetY={0} borderRadius={12}>
            <View style={styles.card}><Text style={styles.cardLabel}>SkiaShadow</Text></View>
          </SkiaShadow>
        </View>

        <SectionTitle>4. SkiaCard — gradient kart</SectionTitle>
        <View style={styles.row}>
          <View style={[styles.card, { backgroundColor: '#A78BFA' }, rnShadow({ size: 'md' })]}>
            <Text style={styles.cardLabel}>RN solid + shadow</Text>
          </View>
          <SkiaCard
            width={140} height={90} borderRadius={12}
            gradient={{ colors: ['#A78BFA', '#7C3AED'], direction: 'diagonal' }}
            shadowColor="#7C3AED" shadowOpacity={0.5} shadowBlur={14} shadowOffsetY={6}
          >
            <View style={styles.cardCenter}><Text style={styles.cardLabel}>SkiaCard gradient</Text></View>
          </SkiaCard>
        </View>

        <SectionTitle>5. SkiaCard — border + shadow</SectionTitle>
        <View style={styles.row}>
          <View style={[styles.card, { borderColor: '#FBBF24', borderWidth: 2 }, rnGlow('#FBBF24', { intensity: 'med' })]}>
            <Text style={styles.cardLabel}>RN border + glow</Text>
          </View>
          <SkiaCard
            width={140} height={90} borderRadius={12}
            backgroundColor="#1E293B"
            borderColor="#FBBF24" borderWidth={2}
            shadowColor="#FBBF24" shadowOpacity={0.6} shadowBlur={16} shadowOffsetY={0}
          >
            <View style={styles.cardCenter}><Text style={styles.cardLabel}>SkiaCard</Text></View>
          </SkiaCard>
        </View>

        <SectionTitle>6. SkiaButton — gradient + scale</SectionTitle>
        <View style={styles.row}>
          <SkiaButton
            width={140} height={48} borderRadius={24}
            gradient={{ colors: ['#A78BFA', '#7C3AED'], direction: 'horizontal' }}
            shadowColor="#7C3AED" shadowOpacity={0.5} shadowBlur={14} shadowOffsetY={6}
            onPress={() => Alert.alert('Tıklandı', 'SkiaButton basıldı')}
          >
            <Text style={styles.buttonText}>Skia Button</Text>
          </SkiaButton>
          <SkiaButton
            width={140} height={48} borderRadius={24}
            backgroundColor="#14B8A6"
            shadowColor="#14B8A6" shadowOpacity={0.6} shadowBlur={16}
            onPress={() => Alert.alert('Tıklandı', 'Turkuaz buton')}
          >
            <Text style={styles.buttonText}>Turkuaz</Text>
          </SkiaButton>
        </View>

        <SectionTitle>7. SkiaDivider — hairline çizgi</SectionTitle>
        <View style={{ width: '100%' }}>
          <Text style={styles.smallLabel}>RN borderBottom 0.5:</Text>
          <View style={{ height: 0.5, backgroundColor: '#475569', width: '100%', marginBottom: 12 }} />
          <Text style={styles.smallLabel}>SkiaDivider hairline:</Text>
          <SkiaDivider color="#475569" length={300} style={{ marginBottom: 12 }} />
          <Text style={styles.smallLabel}>SkiaDivider thickness=1.5:</Text>
          <SkiaDivider color="#FBBF24" thickness={1.5} length={300} />
        </View>

        <Text style={styles.footer}>Platform: {Platform.OS} {Platform.Version} · Skia: {skiaOk ? 'aktif' : 'fallback'}</Text>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0F1A' },
  scroll: { padding: 16, paddingBottom: 80 },
  header: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  sub: { color: '#94A3B8', fontSize: 13, marginBottom: 16, lineHeight: 18 },
  sectionTitle: { color: '#FBBF24', fontSize: 14, fontWeight: '600', marginTop: 24, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 32, alignItems: 'center', flexWrap: 'wrap' },
  card: { width: 140, height: 90, backgroundColor: '#1E293B', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { color: '#fff', fontSize: 12, fontWeight: '500' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  smallLabel: { color: '#94A3B8', fontSize: 11, marginBottom: 6 },
  footer: { color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 24 },
  warnBanner: { backgroundColor: '#451A03', borderColor: '#F59E0B', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 12 },
  warnTitle: { color: '#F59E0B', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  warnBody: { color: '#FBBF24', fontSize: 12, lineHeight: 17 },
});
