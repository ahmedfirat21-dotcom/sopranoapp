/**
 * ★ 2026-04-20: Oda UI scalability dev preview — yoğun kullanıcı senaryolarını
 * gözle görmek için. Mock data ile SpeakerSection + ListenerGrid render edilir.
 * Gerçek component'ler + fix'ler aktif, DB'ye yazmaz.
 * ★ Yeni layout: Clubhouse/Spaces pattern — sahne sabit üstte, dinleyiciler scroll.
 * Route: /dev-preview
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SpeakerSection from '../components/room/SpeakerSection';
import ListenerGrid from '../components/room/ListenerGrid';
import { AVATAR_OPTIONS } from '../constants/avatars';
import type { RoomParticipant } from '../types';

const { width: W, height: H } = Dimensions.get('window');

type Scenario = {
  id: string;
  label: string;
  speakers: number;
  listeners: number;
  spectators: number;
  maxListeners: number;
  description: string;
};

const SCENARIOS: Scenario[] = [
  { id: 'empty', label: 'Boş', speakers: 1, listeners: 0, spectators: 0, maxListeners: 10, description: 'Sadece host' },
  { id: 'light', label: 'Az', speakers: 3, listeners: 3, spectators: 0, maxListeners: 10, description: 'Host + 2 speaker + 3 listener' },
  { id: 'free_stage', label: 'Free Stage', speakers: 4, listeners: 5, spectators: 0, maxListeners: 10, description: 'Free tier stage dolu' },
  { id: 'plus_stage', label: 'Plus Stage', speakers: 8, listeners: 10, spectators: 0, maxListeners: 25, description: 'Plus tier stage dolu' },
  { id: 'pro_stage', label: 'Pro Stage', speakers: 13, listeners: 15, spectators: 0, maxListeners: 25, description: 'Pro tier stage dolu (13 speaker)' },
  { id: 'free_listener', label: 'Free Listener', speakers: 2, listeners: 10, spectators: 0, maxListeners: 10, description: 'Free listener dolu' },
  { id: 'plus_listener', label: 'Plus Listener', speakers: 4, listeners: 25, spectators: 50, maxListeners: 25, description: 'Plus: 25 listener + 50 spectator' },
  { id: 'pro_full', label: 'Pro TAM', speakers: 13, listeners: 60, spectators: 200, maxListeners: 999, description: 'Pro: 13 speaker + 60 listener + 200 spec' },
  { id: 'viral', label: 'Viral 500+', speakers: 13, listeners: 100, spectators: 450, maxListeners: 999, description: 'Viral oda: toplam 563 kişi' },
];

function makeParticipant(idx: number, role: RoomParticipant['role'], isMuted: boolean = false): RoomParticipant {
  const names = ['Firat', 'Elif', 'Ahmet', 'Zeynep', 'Can', 'Ayşe', 'Mehmet', 'Fatma', 'Ali', 'Selin', 'Burak', 'Deniz', 'Ece', 'Kaan', 'Leyla'];
  const avatarKey = AVATAR_OPTIONS[idx % AVATAR_OPTIONS.length];
  const name = names[idx % names.length] + (idx >= names.length ? ` ${Math.floor(idx / names.length) + 1}` : '');
  return {
    id: `mock_${idx}`,
    room_id: 'mock_room',
    user_id: `mock_user_${idx}`,
    role,
    is_muted: isMuted,
    is_chat_muted: false,
    joined_at: new Date().toISOString(),
    user: {
      id: `mock_user_${idx}`,
      display_name: name,
      avatar_url: avatarKey,
      email: '',
      created_at: new Date().toISOString(),
      subscription_tier: 'Free',
    } as any,
  } as RoomParticipant;
}

export default function DevPreview() {
  const insets = useSafeAreaInsets();
  const [scenarioId, setScenarioId] = useState<string>('pro_full');
  const scenario = SCENARIOS.find(s => s.id === scenarioId) || SCENARIOS[0];

  const { stageUsers, listeners } = useMemo(() => {
    let idx = 0;
    const stage: RoomParticipant[] = [];
    // 1 host
    stage.push(makeParticipant(idx++, 'owner'));
    // Speakers (speakers - 1 because host counts)
    for (let i = 1; i < scenario.speakers; i++) {
      const role = i === 1 && scenario.speakers > 3 ? 'moderator' : 'speaker';
      stage.push(makeParticipant(idx++, role, i % 4 === 0));
    }
    const list: RoomParticipant[] = [];
    for (let i = 0; i < scenario.listeners; i++) {
      list.push(makeParticipant(idx++, 'listener'));
    }
    return { stageUsers: stage, listeners: list };
  }, [scenario]);

  const mockMicStatus = () => ({ mic: Math.random() > 0.5, speaking: false, audioLevel: 0, cameraOn: false, videoTrack: null });

  const totalAudience = scenario.listeners + scenario.spectators;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ═══ HEADER ═══ */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#F1F5F9" />
        </Pressable>
        <Text style={s.title}>Room UI Preview</Text>
        <Text style={s.screenInfo}>{W}×{Math.round(H)}dp</Text>
      </View>

      {/* ═══ SENARYO SEÇİCİ ═══ */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs} contentContainerStyle={s.tabsInner}>
        {SCENARIOS.map(sc => (
          <Pressable
            key={sc.id}
            style={[s.tab, scenarioId === sc.id && s.tabActive]}
            onPress={() => setScenarioId(sc.id)}
          >
            <Text style={[s.tabText, scenarioId === sc.id && s.tabTextActive]}>{sc.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={s.scenarioInfo}>
        <Text style={s.scenarioLabel}>{scenario.description}</Text>
        <Text style={s.scenarioStats}>
          Stage: {scenario.speakers} | Listener: {scenario.listeners} | Seyirci: {scenario.spectators} | Max: {scenario.maxListeners}
        </Text>
      </View>

      {/* ════════════════════════════════════════════════════
          ★ YENİ ODA LAYOUT — Clubhouse/Spaces Pattern
          Sahne sabit üstte, ayırıcı, dinleyiciler scroll
          ════════════════════════════════════════════════════ */}

      {/* ★ SAHNE — Sabit üst bölge (scroll etmez) */}
      <View style={s.stageFixed}>
        <SpeakerSection
          stageUsers={stageUsers}
          getMicStatus={mockMicStatus}
          onSelectUser={() => {}}
          currentUserId="mock_user_0"
        />
      </View>

      {/* ★ SAHNE ↔ DİNLEYİCİ AYIRICI — Gradient çizgi + dinleyici sayısı */}
      {totalAudience > 0 && (
        <View style={s.dividerWrap}>
          <LinearGradient
            colors={['transparent', 'rgba(20,184,166,0.2)', 'transparent']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={s.dividerLine}
          />
          <View style={s.dividerCenter}>
            <View style={s.dividerPill}>
              <Ionicons name="headset-outline" size={10} color="rgba(20,184,166,0.6)" />
              <Text style={s.dividerPillText}>{totalAudience} Dinleyici</Text>
            </View>
          </View>
        </View>
      )}

      {/* ★ 2026-04-20: SCROLL YOK — Listener flex:1 overflow:hidden.
          Chat ABSOLUTE overlay — control bar üstünde semi-transparent, avatarlar
          arkada hafifçe görünür (Yalla/IMO pattern). */}
      {scenario.listeners > 0 || scenario.spectators > 0 ? (
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <ListenerGrid
            listeners={listeners}
            onSelectUser={() => {}}
            maxListeners={scenario.maxListeners}
            spectatorCount={scenario.spectators}
            roomOwnerId="mock_user_0"
            onShowAllUsers={() => {}}
          />

          {/* ★ Mock InlineChat — absolute overlay, control bar'ın üstünde */}
          <View style={[s.mockChatArea, { position: 'absolute', left: 8, right: 8, bottom: 8, backgroundColor: 'rgba(10,16,28,0.55)' }]}>
            <View style={s.mockChatHeader}>
              <Ionicons name="chatbubble-outline" size={12} color="rgba(20,184,166,0.4)" />
              <Text style={s.mockChatHeaderText}>Chat (tap → drawer)</Text>
            </View>
            {[
              { name: 'Elif', msg: 'Harika sohbet! 🎉' },
              { name: 'Ahmet', msg: 'Katılmak istiyorum 🙋‍♂️' },
              { name: 'Zeynep', msg: 'Tam vaktinde geldim' },
            ].map((m, i) => (
              <Text key={i} style={[s.mockChatLine, { opacity: 1 - i * 0.2 }]} numberOfLines={1}>
                <Text style={s.mockChatName}>{m.name}  </Text>
                <Text style={s.mockChatText}>{m.msg}</Text>
              </Text>
            ))}
          </View>
        </View>
      ) : (
        <View style={s.emptyAudience}>
          <Ionicons name="people-outline" size={32} color="rgba(255,255,255,0.1)" />
          <Text style={s.emptyAudienceText}>Henüz dinleyici yok</Text>
        </View>
      )}

      {/* ★ Mock Control Bar — gerçek odadaki alt barı simüle eder */}
      <View style={s.mockControlBar}>
        <View style={s.mockBarPill}>
          <Ionicons name="chatbubble-outline" size={14} color="#64748B" />
          <Text style={s.mockBarInput}>Mesaj yaz...</Text>
        </View>
        <View style={s.mockBarBtns}>
          <View style={s.mockBarBtn}><Ionicons name="mic" size={18} color="#14B8A6" /></View>
          <View style={s.mockBarBtn}><Ionicons name="happy-outline" size={16} color="#94A3B8" /></View>
          <View style={s.mockBarBtn}><Ionicons name="add-circle-outline" size={16} color="#94A3B8" /></View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1926' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: '#F1F5F9', textAlign: 'center' },
  screenInfo: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  tabs: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  tabsInner: { paddingHorizontal: 12, alignItems: 'center', gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tabActive: { backgroundColor: 'rgba(20,184,166,0.15)', borderColor: '#14B8A6' },
  tabText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  tabTextActive: { color: '#14B8A6', fontWeight: '700' },
  scenarioInfo: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(20,184,166,0.04)' },
  scenarioLabel: { fontSize: 13, color: '#E2E8F0', fontWeight: '600' },
  scenarioStats: { fontSize: 11, color: '#64748B', marginTop: 2, fontFamily: 'monospace' },

  // ★ SAHNE — Sabit üst bölge
  stageFixed: {
    maxHeight: H * 0.38,
    overflow: 'hidden',
    paddingTop: 8,
  },

  // ★ AYIRICI — Gradient çizgi + pill
  dividerWrap: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  dividerLine: {
    height: 1,
  },
  dividerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  dividerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(20,184,166,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(20,184,166,0.12)',
  },
  dividerPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(20,184,166,0.5)',
    letterSpacing: 0.3,
  },

  // ★ ALT BÖLGE — Scroll edilebilir dinleyici + chat
  audienceScroll: {
    flex: 1,
  },

  // ★ Boş audience
  emptyAudience: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyAudienceText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
    fontWeight: '500',
  },

  // ★ Mock Chat Area — gerçek odadaki InlineChat simülasyonu
  mockChatArea: {
    marginTop: 12,
    marginHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.3)',
    borderWidth: 0.5,
    borderColor: 'rgba(20,184,166,0.06)',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  mockChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  mockChatHeaderText: {
    fontSize: 10,
    color: 'rgba(20,184,166,0.4)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  mockChatLine: {
    paddingVertical: 2,
  },
  mockChatName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5EEAD4',
  },
  mockChatText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },

  // ★ Mock Control Bar
  mockControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(45,55,64,0.95)',
    gap: 4,
  },
  mockBarPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
  },
  mockBarInput: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.18)',
  },
  mockBarBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  mockBarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
