/**
 * SopranoChat — Bildirim Tercihleri Sheet (Faz 5.1)
 * ═══════════════════════════════════════════════════
 * Settings'ten açılan sürüklenebilir bottom-sheet.
 * notification_preferences tablosuyla iki yönlü bağlı.
 *
 * - DND penceresi (başlangıç + bitiş saati)
 * - friends_only toggle
 * - Per-kategori toggle: room_invites, dm_messages, stage_invites,
 *   sp_received, friend_online
 *
 * Tasarım: profil sayfası diline uygun gradient + section header.
 *          Draggable; X butonu YOK (memory: feedback_no_x_on_draggable).
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Switch, ScrollView,
  Animated, PanResponder,
} from 'react-native';
import AppLoader from './AppLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../constants/theme';
import { showToast } from './Toast';
import {
  NotifPrefsService,
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
} from '../services/notifPrefs';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

export default function NotifPreferencesSheet({ visible, onClose, userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    user_id: userId,
    ...DEFAULT_PREFERENCES,
  });

  // ★ 2026-04-28: Clubhouse pattern — pan tüm sheet'e bağlı, ScrollView ile koordineli.
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const scrollOffsetRef = useRef(0);
  const handleScroll = useCallback((e: any) => {
    scrollOffsetRef.current = e?.nativeEvent?.contentOffset?.y ?? 0;
  }, []);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) && scrollOffsetRef.current <= 0,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        g.dy > 25 && Math.abs(g.dy) > Math.abs(g.dx) * 2 && scrollOffsetRef.current <= 0,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(translateY, { toValue: 600, duration: 200, useNativeDriver: true })
            .start(() => { translateY.setValue(0); onCloseRef.current(); });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    NotifPrefsService.getPreferences(userId)
      .then(setPrefs)
      .finally(() => setLoading(false));
  }, [visible, userId]);

  const update = async (partial: Partial<Omit<NotificationPreferences, 'user_id'>>) => {
    setPrefs(p => ({ ...p, ...partial }));
    setSaving(true);
    const r = await NotifPrefsService.updatePreferences(userId, partial);
    setSaving(false);
    if (!r.success) {
      showToast({ title: 'Kaydedilemedi', message: r.error || '', type: 'error' });
    }
  };

  // ★ DND: 24 saatlik picker yerine 4 quick-pick (gece, sabah, iş saati, kapalı)
  const dndPresets: { label: string; start: number | null; end: number | null }[] = [
    { label: 'Kapalı',         start: null, end: null },
    { label: 'Gece (22→07)',   start: 22,   end: 7 },
    { label: 'İş (09→18)',     start: 9,    end: 18 },
    { label: 'Akşam (19→23)',  start: 19,   end: 23 },
  ];

  const isPresetActive = (s: number | null, e: number | null) =>
    prefs.dnd_start_hour === s && prefs.dnd_end_hour === e;

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={st.overlay}>
        {/* Backdrop tap to close */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <Animated.View
          style={[st.sheet, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          {/* Diagonal gradient — profil dili */}
          <LinearGradient
            colors={['#4a5668', '#37414f', '#232a35']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(20,184,166,0.55)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={st.topEdge}
            pointerEvents="none"
          />

          {/* ★ 2026-04-28: Drag handle/header artık görsel — pan tüm sheet'te (Clubhouse). */}
          <View>
          <View style={st.handleWrap}>
            <View style={st.handle} />
          </View>
          <View style={st.header}>
            <View style={st.sectionAccent} />
            <Ionicons name="notifications" size={14} color={Colors.teal} style={iconShadow} />
            <Text style={st.headerTitle}>BİLDİRİM TERCİHLERİ</Text>
            {saving && <AppLoader size="small" color="#14B8A6" />}
          </View>
          </View>

          {loading ? (
            <View style={st.loading}>
              <AppLoader size="large" color="#14B8A6" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {/* ── DND Penceresi ── */}
              <Text style={st.sectionLabel}>RAHATSIZ ETMEME</Text>
              <Text style={st.sectionHint}>
                Belirttiğin saatlerde bildirim almazsın (acil çağrılar hariç).
              </Text>
              <View style={st.presetRow}>
                {dndPresets.map(p => {
                  const active = isPresetActive(p.start, p.end);
                  return (
                    <Pressable
                      key={p.label}
                      style={[st.presetChip, active && st.presetChipActive]}
                      onPress={() => update({ dnd_start_hour: p.start, dnd_end_hour: p.end })}
                    >
                      <Text style={[st.presetChipText, active && st.presetChipTextActive]}>{p.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* ── Filtre ── */}
              <Text style={st.sectionLabel}>FİLTRELEME</Text>
              <ToggleRow
                icon="people"
                label="Sadece arkadaşlardan"
                desc="Sadece arkadaşların gönderdiği bildirimleri al"
                value={prefs.friends_only}
                onChange={v => update({ friends_only: v })}
              />

              {/* ── Kategoriler ── */}
              <Text style={st.sectionLabel}>KATEGORİLER</Text>
              <ToggleRow
                icon="megaphone"
                label="Oda davetleri"
                desc="Birinin seni odaya davet etmesi"
                value={prefs.room_invites}
                onChange={v => update({ room_invites: v })}
              />
              <ToggleRow
                icon="chatbubble"
                label="DM mesajları"
                desc="Yeni özel mesaj geldiğinde"
                value={prefs.dm_messages}
                onChange={v => update({ dm_messages: v })}
              />
              <ToggleRow
                icon="mic"
                label="Sahne davetleri"
                desc="Bir odada sahneye çağrıldığında"
                value={prefs.stage_invites}
                onChange={v => update({ stage_invites: v })}
              />
              <ToggleRow
                icon="gift"
                label="SP / Hediye"
                desc="Sana SP gönderildiğinde"
                value={prefs.sp_received}
                onChange={v => update({ sp_received: v })}
              />
              <ToggleRow
                icon="ellipse"
                label="Arkadaş çevrimiçi"
                desc="Arkadaşın yeni oda açtığında"
                value={prefs.friend_online}
                onChange={v => update({ friend_online: v })}
              />

              <Text style={st.footerNote}>
                Acil çağrılar ve arkadaşlık istekleri her zaman ulaşır.
              </Text>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ icon, label, desc, value, onChange }: RowProps) {
  return (
    <View style={st.row}>
      <View style={st.rowIcon}>
        <Ionicons name={icon} size={14} color={Colors.teal} style={iconShadow} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.rowLabel}>{label}</Text>
        <Text style={st.rowDesc} numberOfLines={2}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(20,184,166,0.5)' }}
        thumbColor={value ? '#14B8A6' : '#94A3B8'}
      />
    </View>
  );
}

const st = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: '88%', minHeight: '60%',
    borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.cardBorder,
    overflow: 'hidden',
    ...Shadows.card,
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 1 },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.teal },
  headerTitle: {
    flex: 1,
    fontSize: 12, fontWeight: '900', color: '#CBD5E1',
    letterSpacing: 1.2, textTransform: 'uppercase', ...Shadows.text,
  },
  loading: { paddingVertical: 80, alignItems: 'center' },
  sectionLabel: {
    fontSize: 10, fontWeight: '900', color: '#5CBFB5',
    letterSpacing: 1.2, textTransform: 'uppercase',
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4,
  },
  sectionHint: {
    fontSize: 11, color: 'rgba(148,163,184,0.7)',
    paddingHorizontal: 16, paddingBottom: 8, lineHeight: 15,
  },
  presetRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 16, paddingBottom: 6,
  },
  presetChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  presetChipActive: {
    backgroundColor: 'rgba(20,184,166,0.18)',
    borderColor: 'rgba(20,184,166,0.5)',
  },
  presetChipText: { fontSize: 11, fontWeight: '700', color: 'rgba(203,213,225,0.7)' },
  presetChipTextActive: { color: '#F1F5F9' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 12.5, fontWeight: '700', color: '#F1F5F9', ...Shadows.textLight },
  rowDesc: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  footerNote: {
    fontSize: 10.5, color: 'rgba(148,163,184,0.6)',
    paddingHorizontal: 16, paddingTop: 16, lineHeight: 14,
    fontStyle: 'italic', textAlign: 'center',
  },
});
