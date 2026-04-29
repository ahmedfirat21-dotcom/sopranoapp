/**
 * SopranoChat — Oda Kayıtları Sheet (Faz 6.2 — Replay UI)
 * ═══════════════════════════════════════════════════════════
 * RoomManageSheet veya profil sayfasından açılır.
 * Kayıt listesi + inline audio player + public/private toggle.
 *
 * NOT: Expo AV (Audio.Sound) ile çalar. expo-av zaten projede
 *   voice reactions (VoiceReactionStrip) için kurulu.
 *
 * Props:
 *   visible, roomId (oda bazlı), hostId (opsiyonel — sahibiyse)
 *   onClose
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, Animated, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { RecordingService, type RoomRecording } from '../../services/recordings';
import { showToast } from '../Toast';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';

interface Props {
  visible: boolean;
  roomId: string;
  hostId?: string; // Eğer mevcut kullanıcı host ise: delete/toggle imkânı
  onClose: () => void;
}

/** Süreyi MM:SS formatına çevir */
function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Tarih → "2 saat önce" / "3 gün önce" */
function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins}dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa önce`;
  const days = Math.floor(hours / 24);
  return `${days}g önce`;
}

export default function RoomRecordingsSheet({ visible, roomId, hostId, onClose }: Props) {
  const [recordings, setRecordings] = useState<RoomRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0-1
  const soundRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { translateValue, panHandlers } = useSwipeToDismiss({
    direction: 'down',
    threshold: 80,
    onDismiss: onClose,
  });

  // Load recordings
  useEffect(() => {
    if (!visible || !roomId) return;
    setLoading(true);
    RecordingService.listForRoom(roomId, 30)
      .then(setRecordings)
      .catch(() => setRecordings([]))
      .finally(() => setLoading(false));
    return () => { stopAudio(); };
  }, [visible, roomId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopAudio(); };
  }, []);

  const stopAudio = useCallback(async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    setPlayingId(null);
    setProgress(0);
  }, []);

  const playRecording = useCallback(async (rec: RoomRecording) => {
    if (playingId === rec.id) { await stopAudio(); return; } // Toggle off
    await stopAudio();
    try {
      const { Audio } = require('expo-av');
      const { sound } = await Audio.Sound.createAsync(
        { uri: rec.audio_url },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      setPlayingId(rec.id);

      // Dinleme sayacını artır (fire-and-forget)
      RecordingService.incrementListen(rec.id).catch(() => {});

      // Progress güncelleme — 500ms interval
      intervalRef.current = setInterval(async () => {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.durationMillis) {
            setProgress(status.positionMillis / status.durationMillis);
            if (status.didJustFinish) { await stopAudio(); }
          }
        } catch {}
      }, 500);

      // Bittiğinde temizle
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) { stopAudio(); }
      });
    } catch (e: any) {
      showToast({ title: 'Kaydı Oynatılamadı', message: e?.message || 'Ses dosyası yüklenemedi.', type: 'error' });
      setPlayingId(null);
    }
  }, [playingId, stopAudio]);

  const togglePublic = useCallback(async (rec: RoomRecording) => {
    const next = !rec.is_public;
    setRecordings(prev => prev.map(r => r.id === rec.id ? { ...r, is_public: next } : r));
    const result = await RecordingService.setPublic(rec.id, next);
    if (!result.success) {
      setRecordings(prev => prev.map(r => r.id === rec.id ? { ...r, is_public: !next } : r));
      showToast({ title: 'Ayar Kaydedilemedi', message: result.error || '', type: 'error' });
    }
  }, []);

  const deleteRecording = useCallback(async (rec: RoomRecording) => {
    if (playingId === rec.id) await stopAudio();
    setRecordings(prev => prev.filter(r => r.id !== rec.id));
    const result = await RecordingService.deleteRecording(rec.id);
    if (!result.success) {
      showToast({ title: 'Silinemedi', message: result.error || '', type: 'error' });
      // Rollback: tekrar yükle
      RecordingService.listForRoom(roomId, 30).then(setRecordings).catch(() => {});
    }
  }, [playingId, roomId, stopAudio]);

  const renderItem = ({ item }: { item: RoomRecording }) => {
    const isPlaying = playingId === item.id;
    const expiresIn = Math.max(0, Math.floor((new Date(item.expires_at).getTime() - Date.now()) / 86400_000));
    return (
      <Pressable
        style={[st.recordRow, isPlaying && st.recordRowActive]}
        onPress={() => playRecording(item)}
      >
        {/* Play/Pause */}
        <View style={[st.playBtn, isPlaying && st.playBtnActive]}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color={isPlaying ? '#14B8A6' : '#94A3B8'} />
        </View>

        {/* Info */}
        <View style={st.recordInfo}>
          <View style={st.recordTitleRow}>
            <Text style={st.recordDuration}>{fmtDuration(item.duration_seconds)}</Text>
            <Text style={st.recordDate}>{fmtRelative(item.created_at)}</Text>
          </View>
          {/* Progress bar */}
          {isPlaying && (
            <View style={st.progressTrack}>
              <View style={[st.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          )}
          <View style={st.recordMeta}>
            <Ionicons name="headset-outline" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={st.recordListens}>{item.listen_count} dinleme</Text>
            {expiresIn <= 3 && (
              <Text style={st.recordExpiry}>⏳ {expiresIn}g kaldı</Text>
            )}
            {!item.is_public && (
              <View style={st.privateBadge}>
                <Ionicons name="lock-closed" size={8} color="#F59E0B" />
                <Text style={st.privateText}>Gizli</Text>
              </View>
            )}
          </View>
        </View>

        {/* Host actions */}
        {hostId && (
          <View style={st.hostActions}>
            <Pressable
              style={st.actionBtn}
              onPress={(e) => { e.stopPropagation(); togglePublic(item); }}
              hitSlop={6}
            >
              <Ionicons name={item.is_public ? 'eye' : 'eye-off'} size={14} color={item.is_public ? '#14B8A6' : '#64748B'} />
            </Pressable>
            <Pressable
              style={st.actionBtn}
              onPress={(e) => { e.stopPropagation(); deleteRecording(item); }}
              hitSlop={6}
            >
              <Ionicons name="trash-outline" size={14} color="#EF4444" />
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <View style={st.overlay}>
        <Pressable style={st.overlayBg} onPress={() => { stopAudio(); onClose(); }} />
        <Animated.View style={[st.container, { transform: [{ translateY: translateValue }] }]} {...panHandlers}>
          <LinearGradient
            colors={['#4a5668', '#37414f', '#232a35']}
            locations={[0, 0.35, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* ★ 2026-04-28: Handle artık görsel — pan tüm sheet'te (Clubhouse). */}
          <View style={st.handleWrap}>
            <View style={st.handle} />
          </View>
          {/* Header */}
          <View style={st.header}>
            <View style={st.headerLeft}>
              <Ionicons name="recording" size={18} color="#EF4444" />
              <Text style={st.headerTitle}>Oda Kayıtları</Text>
              <View style={st.countBadge}>
                <Text style={st.countText}>{recordings.length}</Text>
              </View>
            </View>
            <Pressable style={st.closeBtn} onPress={() => { stopAudio(); onClose(); }}>
              <Ionicons name="close" size={20} color={Colors.text2} />
            </Pressable>
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator size="large" color="#14B8A6" style={{ marginTop: 60 }} />
          ) : recordings.length === 0 ? (
            <View style={st.emptyState}>
              <Ionicons name="mic-off-outline" size={44} color="rgba(92,225,230,0.15)" />
              <Text style={st.emptyTitle}>Henüz kayıt yok</Text>
              <Text style={st.emptyDesc}>
                Oda yönetim panelinden "Kaydı Başlat" ile sesli sohbeti kaydedin.
              </Text>
            </View>
          ) : (
            <FlatList
              data={recordings}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// STILLER
// ═══════════════════════════════════════════════════════════
const st = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  container: {
    height: '65%',
    backgroundColor: '#232a35',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 24,
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 48, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, letterSpacing: 0.2 },
  countBadge: {
    backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
  },
  countText: { fontSize: 10, fontWeight: '800', color: '#EF4444' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Empty state
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text2 },
  emptyDesc: { fontSize: 12, color: Colors.text3, textAlign: 'center', lineHeight: 18 },

  // Recording row
  recordRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 14, marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  recordRowActive: {
    backgroundColor: 'rgba(20,184,166,0.08)',
    borderColor: 'rgba(20,184,166,0.2)',
  },
  playBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  playBtnActive: {
    backgroundColor: 'rgba(20,184,166,0.15)',
  },
  recordInfo: { flex: 1 },
  recordTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordDuration: { fontSize: 14, fontWeight: '700', color: '#F1F5F9' },
  recordDate: { fontSize: 10, color: 'rgba(148,163,184,0.7)' },
  progressTrack: {
    height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 6, marginBottom: 4, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 1.5, backgroundColor: '#14B8A6',
  },
  recordMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  recordListens: { fontSize: 9, color: 'rgba(255,255,255,0.35)' },
  recordExpiry: { fontSize: 9, fontWeight: '600', color: '#F59E0B' },
  privateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  privateText: { fontSize: 8, fontWeight: '700', color: '#F59E0B' },

  // Host actions
  hostActions: { flexDirection: 'column', gap: 6 },
  actionBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
});
