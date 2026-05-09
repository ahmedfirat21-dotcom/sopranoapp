/**
 * SopranoChat — Sahneye Çık / Sahneden İn Pill (kontrol bar üstü)
 * ═══════════════════════════════════════════════════════════════════
 * v107.28 (2 May 2026) — Mevcut SpeakerSection içinde "Sahneye Çık" ghostSeat
 * vardı, kullanıcı bu butonu kontrol bar'ın hemen üstüne taşımayı talep etti.
 *
 * Davranış:
 *   - role === 'speaker'    → "Sahneden İn" (kırmızı pill)
 *   - role === 'listener'   → "Sahneye Çık" (teal pill)
 *   - role === 'spectator'  → görünmez (kapasite dolu, tıklayamaz)
 *   - amIHost                → görünmez (host zaten sahnede, demote yok)
 *
 * Tasarım:
 *   - 44px yükseklik pill, ortalanmış
 *   - iOS shadow + Android temiz (border accent)
 *   - Pulse animasyon yok — sade ve okunaklı
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  /** Kullanıcının mevcut rolü */
  role: 'owner' | 'speaker' | 'listener' | 'spectator' | 'moderator' | undefined;
  /** Host'un kendisiyse buton gösterilmesin (host her zaman sahnede) */
  isHost?: boolean;
  /** "Sahneye Çık" basıldı */
  onClaimStage: () => void;
  /** "Sahneden İn" basıldı */
  onSelfDemote: () => void;
  /** Sahne dolu mu? — listener iken full ise spectator olur, buton sönük */
  stageFull?: boolean;
  /** Cooldown aktif mi? */
  cooldownSeconds?: number;
}

export default function StageActionPill({
  role, isHost, onClaimStage, onSelfDemote, stageFull, cooldownSeconds,
}: Props) {
  // ★ v108.20: Listener için pill geri açıldı — sahne BOŞ veya yer varsa çıkabilir.
  //   stageFull → buton disabled (zaten mevcut). spectator → gizli.
  if (role === 'spectator' || !role) return null;

  const isSpeaker = role === 'speaker' || role === 'moderator' || role === 'owner';
  const onCooldown = (cooldownSeconds ?? 0) > 0;

  if (isSpeaker) {
    // SAHNEDEN İN — kırmızı
    return (
      <View style={styles.wrap} pointerEvents="box-none">
        <Pressable
          onPress={onSelfDemote}
          style={({ pressed }) => [styles.pill, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          <LinearGradient
            colors={['#F87171', '#EF4444', '#B91C1C']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.pillGrad}
          >
            <Ionicons name="mic-off" size={13} color="#FFF" style={styles.iconShadow} />
            <Text style={styles.pillText}>Sahneden İn</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  // SAHNEYE ÇIK — teal (listener)
  const disabled = stageFull || onCooldown;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={disabled ? undefined : onClaimStage}
        disabled={disabled}
        style={({ pressed }) => [
          styles.pill,
          disabled && { opacity: 0.5 },
          pressed && !disabled && { transform: [{ scale: 0.96 }] },
        ]}
      >
        <LinearGradient
          colors={
            disabled
              ? ['#64748B', '#475569', '#334155']
              : ['#5EEAD4', '#14B8A6', '#0F766E']
          }
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.pillGrad}
        >
          <Ionicons
            name={onCooldown ? 'time-outline' : stageFull ? 'lock-closed' : 'mic'}
            size={13}
            color="#FFF"
            style={styles.iconShadow}
          />
          <Text style={styles.pillText}>
            {onCooldown
              ? `${cooldownSeconds}sn bekle`
              : stageFull
              ? 'Sahne Dolu'
              : 'Sahneye Çık'}
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  pill: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: Platform.OS === 'android' ? 1.5 : 1,
    borderColor: 'rgba(255,255,255,0.18)',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
        }
      : {
          elevation: 4,
        }),
  },
  // ★ v107.42: Kompakt boyut (kullanıcı talebi)
  pillGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 130,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
