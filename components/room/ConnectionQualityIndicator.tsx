/**
 * SopranoChat — Bağlantı Kalitesi Göstergesi
 * ═══════════════════════════════════════════════════
 * Oda üst banner'a yerleştirilen mini 3-bar wifi-vari indicator.
 * LiveKit'in localParticipant.connectionQuality event'inden beslenir.
 *
 * Quality → renk + bar sayısı:
 *   excellent: 3 bar yeşil
 *   good:      2 bar sarı
 *   poor:      1 bar kırmızı
 *   unknown:   3 bar gri (henüz bağlanmadı)
 */
import React from 'react';
import { i18n } from '../../services/i18n';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { showToast } from '../Toast';

export type Quality = 'excellent' | 'good' | 'poor' | 'unknown';

const QUALITY_META: Record<Quality, { color: string; bars: number; label: string; tooltip: string; toastType: 'success' | 'info' | 'warning' | 'error' }> = {
  excellent: { color: '#22C55E', bars: 3, label: i18n.t('room.connectionqualityindicator.001'), tooltip: i18n.t('auto.room.ConnectionQualityIndicator.005'), toastType: 'success' },
  good:      { color: '#FBBF24', bars: 2, label: i18n.t('room.connectionqualityindicator.002'),       tooltip: i18n.t('auto.room.ConnectionQualityIndicator.004'),       toastType: 'info' },
  poor:      { color: '#EF4444', bars: 1, label: i18n.t('room.connectionqualityindicator.003'),      tooltip: i18n.t('auto.room.ConnectionQualityIndicator.003'), toastType: 'warning' },
  unknown:   { color: '#94A3B8', bars: 3, label: 'Bilinmiyor', tooltip: i18n.t('auto.room.ConnectionQualityIndicator.002'),                toastType: 'info' },
};

interface Props {
  quality: Quality;
  /** Etiket metnini de göster (sadece icon yerine) */
  showLabel?: boolean;
  /** Boyut — default 14px bars */
  size?: number;
}

// ★ 2026-04-28: Eski absolute tooltip kaldırıldı — header altında sahne kartlarının üstüne biniyordu.
//   Tap edince Toast olarak gösteriliyor (üst overlay, çakışma yok).
export default function ConnectionQualityIndicator({ quality, showLabel = false, size = 14 }: Props) {
  const meta = QUALITY_META[quality] || QUALITY_META.unknown;

  return (
    <Pressable
      onPress={() => showToast({ title: i18n.t('auto.room.ConnectionQualityIndicator.001', { 0: meta.label }), message: meta.tooltip, type: meta.toastType })}
      hitSlop={8}
      style={s.touchable}
    >
      <View style={[s.barsRow, { height: size }]}>
        {[0, 1, 2].map((i) => {
          const filled = i < meta.bars;
          const heightRatio = (i + 1) / 3;
          return (
            <View
              key={i}
              style={[
                s.bar,
                {
                  height: size * heightRatio,
                  width: Math.max(2, size / 5),
                  backgroundColor: filled ? meta.color : 'rgba(255,255,255,0.15)',
                },
              ]}
            />
          );
        })}
      </View>
      {showLabel && (
        <Text style={[s.label, { color: meta.color }]}>{meta.label}</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'relative', alignItems: 'center' },
  touchable: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4, paddingVertical: 2 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: {
    borderRadius: 1,
  },
  label: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tooltip: {
    position: 'absolute',
    top: 24,
    right: 0,
    minWidth: 180,
    maxWidth: 240,
    backgroundColor: 'rgba(15,25,41,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  tooltipText: {
    fontSize: 11,
    color: '#E2E8F0',
    lineHeight: 15,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
