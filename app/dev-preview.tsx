/**
 * ★ 2026-04-19: Oda UI scalability dev preview — yoğun kullanıcı senaryolarını
 * gözle görmek için. Mock data ile SpeakerSection + ListenerGrid render edilir.
 * Gerçek component'ler + fix'ler aktif, DB'ye yazmaz.
 * Route: /dev-preview
 *
 * 2026-04-19 update: ScrollView kaldırıldı — senaryolarda tek viewport fit
 * hedeflendi, scroll varsa UI'da bir sorun var demektir.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SpeakerSection from '../components/room/SpeakerSection';
import ListenerGrid from '../components/room/ListenerGrid';
import { AVATAR_OPTIONS } from '../constants/avatars';
import type { RoomParticipant } from '../types';

const { width: W } = Dimensions.get('window');

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
    stage.push(makeParticipant(idx++, 'owner'));
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

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#F1F5F9" />
        </Pressable>
        <Text style={s.title}>Room UI Preview</Text>
        <Text style={s.screenInfo}>{W}dp</Text>
      </View>

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
          Stage: {scenario.speakers} | Listener: {scenario.listeners} | Seyirci: {scenario.spectators}
        </Text>
      </View>

      {/* ★ Odanın asıl gövdesi — flex:1 ile tek viewport içinde kalacak.
          Eğer içerik sığmazsa bir senaryo bozuk demektir: UI'da fix gerekir. */}
      <View style={s.roomBody}>
        {/* Stage — shrinkable, gerektiği kadar yer alır */}
        <View style={s.stageWrap}>
          <SpeakerSection
            stageUsers={stageUsers}
            getMicStatus={mockMicStatus}
            onSelectUser={() => {}}
            currentUserId="mock_user_0"
          />
        </View>

        {/* Listener grid — sabit yükseklik cap'i, aşarsa "Tümü" drawer'a düşer */}
        {(scenario.listeners > 0 || scenario.spectators > 0) && (
          <View style={s.listenerWrap}>
            <ListenerGrid
              listeners={listeners}
              onSelectUser={() => {}}
              maxListeners={scenario.maxListeners}
              spectatorCount={scenario.spectators}
              roomOwnerId="mock_user_0"
              onShowAllUsers={() => {}}
            />
          </View>
        )}

        {/* Sahte bottom control bar (gerçek odadaki gibi görsel ipucu) */}
        <View style={[s.fakeControls, { paddingBottom: insets.bottom + 8 }]}>
          <View style={s.fakeBtn}><Ionicons name="mic" size={18} color="#fff" /></View>
          <View style={s.fakeBtn}><Ionicons name="chatbubble" size={18} color="#fff" /></View>
          <View style={s.fakeBtn}><Ionicons name="hand-right" size={18} color="#fff" /></View>
          <View style={s.fakeBtn}><Ionicons name="gift" size={18} color="#fff" /></View>
          <View style={[s.fakeBtn, { backgroundColor: '#EF4444' }]}><Ionicons name="exit" size={18} color="#fff" /></View>
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
  tabs: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  tabsInner: { paddingHorizontal: 12, alignItems: 'center', gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tabActive: { backgroundColor: 'rgba(20,184,166,0.15)', borderColor: '#14B8A6' },
  tabText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  tabTextActive: { color: '#14B8A6', fontWeight: '700' },
  scenarioInfo: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(20,184,166,0.04)' },
  scenarioLabel: { fontSize: 12, color: '#E2E8F0', fontWeight: '600' },
  scenarioStats: { fontSize: 10, color: '#64748B', marginTop: 1, fontFamily: 'monospace' },

  roomBody: { flex: 1, overflow: 'hidden' },
  stageWrap: { paddingTop: 8, paddingHorizontal: 4 },
  listenerWrap: { flex: 1, marginTop: 4, paddingHorizontal: 4, overflow: 'hidden' },
  fakeControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(15,25,38,0.95)',
  },
  fakeBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#3E4E5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
