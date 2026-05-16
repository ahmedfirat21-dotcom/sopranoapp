/**
 * SopranoChat — Bildirim Tercihleri Sheet
 * ═══════════════════════════════════════════════════
 * ★ v110 (6 May 2026): BlockedUsersSheet pattern'ına geçildi —
 *   önceki RN Modal sarmalı Android'de drag-to-dismiss'i engelliyordu.
 *   Artık absolute-positioned Animated.View + backdrop pattern.
 *
 * - DND penceresi (4 quick-pick preset)
 * - friends_only toggle
 * - Per-kategori toggle: room_invites, dm_messages, stage_invites,
 *   sp_received, friend_online
 *
 * Tasarım: BlockedUsersSheet ile aynı gradient + handle + header dili.
 *          Draggable; X butonu YOK (memory: feedback_no_x_on_draggable).
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Switch, ScrollView,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import AppLoader from './AppLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Shadows } from '../constants/theme';
import { showToast } from './Toast';
import { i18n } from '../services/i18n';
import {
  NotifPrefsService,
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
} from '../services/notifPrefs';

const { height: SCREEN_H } = Dimensions.get('window');
const PANEL_HEIGHT = Math.min(SCREEN_H * 0.78, 620);

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
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 14);
  const CLOSED_Y = PANEL_HEIGHT + bottomInset + 50;

  const translateY = useRef(new Animated.Value(CLOSED_Y)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    user_id: userId,
    ...DEFAULT_PREFERENCES,
  });

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ─── Açılış / Kapanış animasyonu (BlockedUsersSheet ile birebir) ───
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: CLOSED_Y, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  // ─── Veri yükleme ───
  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    NotifPrefsService.getPreferences(userId)
      .then(setPrefs)
      .finally(() => setLoading(false));
  }, [visible, userId]);

  // ─── Pan: tüm sheet'e bağlı + ScrollView ile koordineli (BlockedUsersSheet pattern) ───
  const scrollOffsetRef = useRef(0);
  const handleScroll = useCallback((e: any) => {
    scrollOffsetRef.current = e?.nativeEvent?.contentOffset?.y ?? 0;
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) && scrollOffsetRef.current <= 0,
      onMoveShouldSetPanResponderCapture: (_, gs) =>
        gs.dy > 25 && Math.abs(gs.dy) > Math.abs(gs.dx) * 2 && scrollOffsetRef.current <= 0,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => {
        translateY.setValue(Math.max(0, gs.dy));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.4) {
          Animated.timing(translateY, { toValue: CLOSED_Y, duration: 180, useNativeDriver: true })
            .start(() => onCloseRef.current());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220 }).start();
        }
      },
    })
  ).current;

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
    { label: i18n.t('notifpreferencessheet.003'),         start: null, end: null },
    { label: 'Gece (22→07)',   start: 22,   end: 7 },
    { label: i18n.t('notifpreferencessheet.004'),     start: 9,    end: 18 },
    { label: i18n.t('notifpreferencessheet.005'),  start: 19,   end: 23 },
  ];

  const isPresetActive = (s: number | null, e: number | null) =>
    prefs.dnd_start_hour === s && prefs.dnd_end_hour === e;

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop — tap to close */}
      <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 100, opacity: backdropOpacity }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} onPress={onClose} />
      </Animated.View>

      {/* Panel — absolute + draggable (BlockedUsersSheet pattern) */}
      <Animated.View
        style={[
          st.panel,
          {
            bottom: 0,
            paddingBottom: bottomInset + 14,
            height: PANEL_HEIGHT + bottomInset + 14,
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          locations={[0, 0.35, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 20, borderTopRightRadius: 20 }]}
        />
        {/* Top edge teal highlight (aile dili) */}
        <LinearGradient
          colors={['transparent', 'rgba(20,184,166,0.55)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={st.topEdge}
          pointerEvents="none"
        />

        {/* Handle + Header */}
        <View>
          <View style={st.handle}>
            <View style={st.handleBar} />
          </View>
          <View style={st.header}>
            <View style={st.sectionAccent} />
            <Ionicons name="notifications" size={16} color={Colors.teal} style={iconShadow} />
            <Text style={st.headerTitle}>{i18n.t('notif_prefs.title')}</Text>
            {saving && <AppLoader size="small" color="#14B8A6" />}
          </View>
        </View>

        {loading ? (
          <View style={st.loading}>
            <AppLoader size="large" color="#14B8A6" />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {/* ── DND Penceresi ── */}
            <Text style={st.sectionLabel}>{i18n.t('notif_prefs.dnd')}</Text>
            <Text style={st.sectionHint}>{i18n.t('notifpreferencessheet.001')}</Text>
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
            <Text style={st.sectionLabel}>{i18n.t('notif_prefs.filter')}</Text>
            <ToggleRow
              icon="people"
              label={i18n.t('notifpreferencessheet.006')}
              desc={i18n.t('notifpreferencessheet.007')}
              value={prefs.friends_only}
              onChange={v => update({ friends_only: v })}
            />

            {/* ── Kategoriler ── */}
            <Text style={st.sectionLabel}>{i18n.t('notif_prefs.categories')}</Text>
            <ToggleRow
              icon="megaphone"
              label="Oda davetleri"
              desc="Birinin seni odaya davet etmesi"
              value={prefs.room_invites}
              onChange={v => update({ room_invites: v })}
            />
            <ToggleRow
              icon="chatbubble"
              label={i18n.t('notifpreferencessheet.008')}
              desc={i18n.t('notifpreferencessheet.009')}
              value={prefs.dm_messages}
              onChange={v => update({ dm_messages: v })}
            />
            <ToggleRow
              icon="mic"
              label="Sahne davetleri"
              desc={i18n.t('notifpreferencessheet.010')}
              value={prefs.stage_invites}
              onChange={v => update({ stage_invites: v })}
            />
            <ToggleRow
              icon="gift"
              label="SP / Hediye"
              desc={i18n.t('notifpreferencessheet.011')}
              value={prefs.sp_received}
              onChange={v => update({ sp_received: v })}
            />
            <ToggleRow
              icon="ellipse"
              label={i18n.t('notifpreferencessheet.012')}
              desc={i18n.t('notifpreferencessheet.013')}
              value={prefs.friend_online}
              onChange={v => update({ friend_online: v })}
            />

            <Text style={st.footerNote}>{i18n.t('notifpreferencessheet.002')}</Text>
          </ScrollView>
        )}
      </Animated.View>
    </>
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
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 101,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#95a1ae',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 1 },
  handle: { alignItems: 'center', paddingVertical: 8 },
  handleBar: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.20)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(20,184,166,0.05)',
  },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.teal },
  headerTitle: {
    flex: 1,
    fontSize: 15, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.15,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
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
