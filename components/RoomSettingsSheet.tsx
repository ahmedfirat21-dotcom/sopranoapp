/**
 * SopranoChat — Oda İçi Ayarlar Paneli (Bottom Sheet)
 * Mikrofon modu, kamera yönü, hoparlör, gürültü engelleme vb.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable,
  Dimensions, Switch, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W } = Dimensions.get('window');

const COLORS = {
  primary: '#5CE1E6',
  bg: '#0A0E1A',
  card: 'rgba(18,22,38,0.98)',
  border: 'rgba(92,225,230,0.12)',
  text: '#F8FAFC',
  text2: '#94A3B8',
  text3: '#64748B',
  gold: '#D4AF37',
};

export type MicMode = 'normal' | 'music';
export type CameraFacing = 'front' | 'back';

interface RoomSettingsProps {
  visible: boolean;
  onClose: () => void;
  // Mic
  micMode: MicMode;
  onMicModeChange: (mode: MicMode) => void;
  noiseCancellation: boolean;
  onNoiseCancellationChange: (enabled: boolean) => void;
  // Camera
  cameraFacing: CameraFacing;
  onCameraFacingChange: (facing: CameraFacing) => void;
  // Speaker
  useSpeaker: boolean;
  onSpeakerChange: (speaker: boolean) => void;
  // Status
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  // Room close
  canCloseRoom?: boolean;
  onCloseRoom?: () => void;
}

function SettingRow({ 
  icon, iconColor, label, description, right 
}: { 
  icon: string; iconColor: string; label: string; description?: string; right: React.ReactNode 
}) {
  return (
    <View style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: `${iconColor}15` }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={s.rowInfo}>
        <Text style={s.rowLabel}>{label}</Text>
        {description && <Text style={s.rowDesc}>{description}</Text>}
      </View>
      {right}
    </View>
  );
}

function PillSelector({ options, selected, onChange }: { 
  options: { key: string; label: string; icon?: string }[]; 
  selected: string; 
  onChange: (key: string) => void 
}) {
  return (
    <View style={s.pillRow}>
      {options.map(opt => {
        const active = selected === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[s.pill, active && s.pillActive]}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.7}
          >
            {opt.icon && <Ionicons name={opt.icon as any} size={12} color={active ? '#fff' : COLORS.text3} />}
            <Text style={[s.pillText, active && s.pillTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function RoomSettingsSheet(props: RoomSettingsProps) {
  const { 
    visible, onClose,
    micMode, onMicModeChange, noiseCancellation, onNoiseCancellationChange,
    cameraFacing, onCameraFacingChange,
    useSpeaker, onSpeakerChange,
    isMicEnabled, isCameraEnabled,
    canCloseRoom, onCloseRoom,
  } = props;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          {/* Handle Bar */}
          <View style={s.handleBar} />
          
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Oda Ayarları</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.text2} />
            </TouchableOpacity>
          </View>

          {/* ─── SES AYARLARI ─── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>🎤 Ses Ayarları</Text>

            {/* Mikrofon Modu */}
            <SettingRow
              icon="mic"
              iconColor={COLORS.primary}
              label="Mikrofon Modu"
              description={micMode === 'music' ? 'Müzik yayını için optimize edildi' : 'Normal konuşma modu'}
              right={
                <PillSelector
                  options={[
                    { key: 'normal', label: 'Normal', icon: 'chatbubble-outline' },
                    { key: 'music', label: 'Müzik', icon: 'musical-notes' },
                  ]}
                  selected={micMode}
                  onChange={(key) => onMicModeChange(key as MicMode)}
                />
              }
            />

            {/* Gürültü Engelleme */}
            <SettingRow
              icon="shield-checkmark"
              iconColor="#4ADE80"
              label="Gürültü Engelleme"
              description={micMode === 'music' ? 'Müzik modunda otomatik kapalı' : undefined}
              right={
                <Switch
                  value={micMode === 'music' ? false : noiseCancellation}
                  onValueChange={onNoiseCancellationChange}
                  disabled={micMode === 'music'}
                  trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(92,225,230,0.3)' }}
                  thumbColor={noiseCancellation && micMode !== 'music' ? COLORS.primary : '#64748B'}
                />
              }
            />

            {/* Hoparlör */}
            <SettingRow
              icon={useSpeaker ? 'volume-high' : 'ear'}
              iconColor="#F59E0B"
              label={useSpeaker ? 'Hoparlör' : 'Kulaklık'}
              description="Ses çıkış kaynağını değiştir"
              right={
                <TouchableOpacity
                  style={[s.toggleBtn, useSpeaker && s.toggleBtnActive]}
                  onPress={() => onSpeakerChange(!useSpeaker)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={useSpeaker ? 'volume-high' : 'ear'} size={14} color={useSpeaker ? '#fff' : COLORS.text3} />
                  <Text style={[s.toggleBtnText, useSpeaker && { color: '#fff' }]}>
                    {useSpeaker ? 'Hoparlör' : 'Kulaklık'}
                  </Text>
                </TouchableOpacity>
              }
            />
          </View>

          {/* ─── MÜZİK PAYLAŞIMI ─── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>🎵 Müzik Paylaşımı</Text>
            
            <TouchableOpacity style={s.musicShareBtn} activeOpacity={0.7}>
              <LinearGradient
                colors={['rgba(168,85,247,0.15)', 'rgba(92,225,230,0.08)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.musicShareGrad}
              >
                <View style={s.musicShareLeft}>
                  <View style={s.musicShareIcon}>
                    <Ionicons name="musical-notes" size={20} color="#A78BFA" />
                  </View>
                  <View>
                    <Text style={s.musicShareTitle}>Telefondan Müzik Paylaş</Text>
                    <Text style={s.musicShareDesc}>Sistem sesini odaya yayınla</Text>
                  </View>
                </View>
                <View style={s.comingSoonBadge}>
                  <Text style={s.comingSoonText}>Yakında</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Status indicators */}
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: isMicEnabled ? '#4ADE80' : '#EF4444' }]} />
            <Text style={s.statusText}>Mikrofon {isMicEnabled ? 'Açık' : 'Kapalı'}</Text>
            <View style={{ width: 12 }} />
            <View style={[s.statusDot, { backgroundColor: isCameraEnabled ? '#4ADE80' : '#EF4444' }]} />
            <Text style={s.statusText}>Kamera {isCameraEnabled ? 'Açık' : 'Kapalı'}</Text>
          </View>

          {/* ─── ODAYI KAPAT ─── */}
          {canCloseRoom && onCloseRoom && (
            <TouchableOpacity
              style={s.closeRoomBtn}
              activeOpacity={0.7}
              onPress={() => { onClose(); onCloseRoom(); }}
            >
              <View style={s.closeRoomIcon}>
                <Ionicons name="power" size={18} color="#EF4444" />
              </View>
              <Text style={s.closeRoomText}>Odayı Kapat</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 34,
    borderWidth: 1, borderColor: COLORS.border,
    borderBottomWidth: 0,
    maxHeight: '85%',
  },
  handleBar: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18, fontWeight: '700', color: COLORS.text, letterSpacing: 0.3,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Section
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: COLORS.text2,
    marginBottom: 10, letterSpacing: 0.5,
  },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  rowDesc: { fontSize: 11, color: COLORS.text3, marginTop: 1 },

  // Pill Selector
  pillRow: { flexDirection: 'row', gap: 4 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  pillActive: {
    backgroundColor: 'rgba(92,225,230,0.2)',
    borderColor: 'rgba(92,225,230,0.4)',
  },
  pillText: { fontSize: 11, fontWeight: '600', color: COLORS.text3 },
  pillTextActive: { color: '#fff' },

  // Toggle Button
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  toggleBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.text3 },

  // Music Share
  musicShareBtn: { borderRadius: 16, overflow: 'hidden' },
  musicShareGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)',
  },
  musicShareLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  musicShareIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(167,139,250,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  musicShareTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  musicShareDesc: { fontSize: 11, color: COLORS.text3, marginTop: 1 },
  comingSoonBadge: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  comingSoonText: { fontSize: 10, fontWeight: '700', color: '#A78BFA' },

  // Status
  statusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingTop: 12, gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, color: COLORS.text3 },

  // Close Room
  closeRoomBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 16, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  closeRoomIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeRoomText: {
    fontSize: 14, fontWeight: '700', color: '#EF4444',
  },
});
