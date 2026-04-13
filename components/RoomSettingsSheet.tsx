/**
 * SopranoChat — Oda Ayarları Paneli v2
 * ═══════════════════════════════════════════════════
 * 6 sekmeli tek panel, tier-bazlı kilit/açık mantığı.
 *
 * Sekmeler: Genel | Konuşma | Moderasyon | Görsellik | Monetizasyon | Gelişmiş
 *
 * Kilitli özellikler gri ama görünür.
 * Tıklayınca → "VIP ile açılır" toast.
 */
import React from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Switch, ScrollView, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { isTierAtLeast, TIER_DEFINITIONS } from '../constants/tiers';
import { showToast } from './Toast';
import type { SubscriptionTier } from '../types';

// Inline tema tanımları
const ROOM_THEME_MAP: Record<string, { name: string; colors: [string, string]; }> = {
  ocean: { name: 'Okyanus', colors: ['#0E4D6F', '#083344'] },
  sunset: { name: 'Gün Batımı', colors: ['#7F1D1D', '#4C0519'] },
  forest: { name: 'Orman', colors: ['#14532D', '#052E16'] },
  galaxy: { name: 'Galaksi', colors: ['#312E81', '#1E1B4B'] },
  aurora: { name: 'Aurora', colors: ['#134E4A', '#042F2E'] },
  cherry: { name: 'Kiraz', colors: ['#831843', '#500724'] },
  cyber: { name: 'Cyber', colors: ['#1E3A8A', '#172554'] },
  volcano: { name: 'Volkan', colors: ['#7C2D12', '#431407'] },
  midnight: { name: 'Gece', colors: ['#0C0A3E', '#1B1464'] },
  rose: { name: 'Gül', colors: ['#9F1239', '#881337'] },
  arctic: { name: 'Kutup', colors: ['#164E63', '#0E7490'] },
  amber: { name: 'Kehribar', colors: ['#78350F', '#92400E'] },
  slate: { name: 'Arduvaz', colors: ['#1E293B', '#334155'] },
};

export type MicMode = 'normal' | 'music';
export type CameraFacing = 'front' | 'back';

// ═══════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════
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
  // Theme (Silver+)
  isHost?: boolean;
  currentThemeId?: string | null;
  onChangeTheme?: (themeId: string | null) => void;
  // Oda Kilidi (Silver+)
  isLocked?: boolean;
  onToggleLock?: (locked: boolean) => void;
  // Oda İsmi Düzenleme (Free)
  roomName?: string;
  onRenameRoom?: (newName: string) => void;
  // Takipçilere Özel (Gold+)
  followersOnly?: boolean;
  onToggleFollowersOnly?: (enabled: boolean) => void;
  // Slow Mode
  slowModeSeconds?: number;
  onSlowModeChange?: (seconds: number) => void;
  // Owner tier
  ownerTier?: string;
  // Arka Plan Resmi (Silver+)
  backgroundImage?: string | null;
  onChangeBackgroundImage?: (imageUri: string | null) => void;
  // Hoş Geldin Mesajı
  welcomeMessage?: string;
  onChangeWelcomeMessage?: (msg: string) => void;
  // Konuşma Modu
  speakingMode?: 'free_for_all' | 'permission_only' | 'selected_only';
  onSpeakingModeChange?: (mode: 'free_for_all' | 'permission_only' | 'selected_only') => void;
  // VIP
  roomType?: 'open' | 'closed' | 'invite';
  onRoomTypeChange?: (type: 'open' | 'closed' | 'invite') => void;
  entryFeeSp?: number;
  onEntryFeeChange?: (fee: number) => void;
  donationsEnabled?: boolean;
  onDonationsToggle?: (enabled: boolean) => void;
  roomRules?: string;
  onRulesChange?: (rules: string) => void;
  // Manuel Oda Dondurma (Bronze+)
  canFreezeRoom?: boolean;
  onFreezeRoom?: () => void;
  // Dil Filtresi (Silver+)
  roomLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  // Yaş Filtresi (Silver+)
  ageRestricted?: boolean;
  onAgeRestrictedChange?: (enabled: boolean) => void;
  // Oda Kapak Görseli (Gold+)
  onChangeCoverImage?: (imageUri: string | null) => void;
  coverImage?: string | null;
  // Oda Müziği (Gold+)
  musicTrack?: string | null;
  onMusicChange?: (track: string | null) => void;
  // ★ Odadan Ayrıl (Settings üzerinden)
  onLeaveRoom?: () => void;
  // ★ Oda Silme (Owner-only)
  canDeleteRoom?: boolean;
  onDeleteRoom?: () => void;
}

// ═══════════════════════════════════════════════════
// LOCKED ROW — kilitli feature hint satırı
// ═══════════════════════════════════════════════════
function LockedRow({ icon, label, requiredTier }: { icon: string; label: string; requiredTier: SubscriptionTier }) {
  const tierDef = TIER_DEFINITIONS[requiredTier];
  return (
    <Pressable
      style={[s.row, { opacity: 0.35 }]}
      onPress={() => showToast({ title: `🔒 ${requiredTier}+ ile açılır`, message: `"${label}" özelliği ${requiredTier} ve üzeri üyeliklerde kullanılabilir.`, type: 'info' })}
    >
      <View style={[s.rowIcon, { backgroundColor: `${tierDef.color}15` }]}>
        <Ionicons name={icon as any} size={17} color={tierDef.color} />
      </View>
      <View style={s.rowInfo}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowDesc}>🔒 {requiredTier}+ ile açılır</Text>
      </View>
      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: `${tierDef.color}12`, borderWidth: 1, borderColor: `${tierDef.color}30` }}>
        <Text style={{ fontSize: 8, fontWeight: '700', color: tierDef.color }}>{tierDef.emoji} {requiredTier}</Text>
      </View>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════
// SETTING ROW — glassmorphic row component
// ═══════════════════════════════════════════════════
function SettingRow({ icon, iconBg, label, desc, right }: {
  icon: string; iconBg: string; label: string; desc?: string; right: React.ReactNode;
}) {
  return (
    <View style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={17} color="#FFF" />
      </View>
      <View style={s.rowInfo}>
        <Text style={s.rowLabel}>{label}</Text>
        {desc && <Text style={s.rowDesc}>{desc}</Text>}
      </View>
      {right}
    </View>
  );
}

// ═══════════════════════════════════════════════════
// TOGGLE PILL
// ═══════════════════════════════════════════════════
function TogglePill({ active, labelA, labelB, onToggle }: {
  active: boolean; labelA: string; labelB: string; onToggle: () => void;
}) {
  return (
    <Pressable style={s.togglePill} onPress={onToggle}>
      <View style={[s.toggleOption, !active && s.toggleOptionActive]}>
        <Text style={[s.toggleText, !active && s.toggleTextActive]}>{labelA}</Text>
      </View>
      <View style={[s.toggleOption, active && s.toggleOptionActive]}>
        <Text style={[s.toggleText, active && s.toggleTextActive]}>{labelB}</Text>
      </View>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════
// TAB definitions
// ═══════════════════════════════════════════════════
type TabId = 'general' | 'speaking' | 'moderation' | 'visual' | 'monetization' | 'advanced';
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'general', label: 'Genel', icon: 'settings-outline' },
  { id: 'speaking', label: 'Konuşma', icon: 'mic-outline' },
  { id: 'moderation', label: 'Moderasyon', icon: 'shield-outline' },
  { id: 'visual', label: 'Görsellik', icon: 'color-palette-outline' },
  { id: 'monetization', label: 'Monetizasyon', icon: 'cash-outline' },
  { id: 'advanced', label: 'Gelişmiş', icon: 'rocket-outline' },
];

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
export default function RoomSettingsSheet(props: RoomSettingsProps) {
  const {
    visible, onClose,
    micMode, onMicModeChange, noiseCancellation, onNoiseCancellationChange,
    useSpeaker, onSpeakerChange,
    isHost, currentThemeId, onChangeTheme,
    isLocked, onToggleLock,
    roomName, onRenameRoom,
    followersOnly, onToggleFollowersOnly,
    slowModeSeconds, onSlowModeChange,
    ownerTier,
    backgroundImage, onChangeBackgroundImage,
    welcomeMessage, onChangeWelcomeMessage,
    speakingMode, onSpeakingModeChange,
    roomType, onRoomTypeChange,
    entryFeeSp, onEntryFeeChange,
    donationsEnabled, onDonationsToggle,
    roomRules, onRulesChange,
    canFreezeRoom, onFreezeRoom,
    roomLanguage, onLanguageChange,
    ageRestricted, onAgeRestrictedChange,
    onChangeCoverImage, coverImage,
    musicTrack, onMusicChange,
    onLeaveRoom,
    canDeleteRoom, onDeleteRoom,
  } = props;

  const [activeTab, setActiveTab] = React.useState<TabId>('general');
  const [editingName, setEditingName] = React.useState(false);
  const [newName, setNewName] = React.useState(roomName || '');
  const [editingWelcome, setEditingWelcome] = React.useState(false);
  const [newWelcome, setNewWelcome] = React.useState(welcomeMessage || '');
  const [editingRules, setEditingRules] = React.useState(false);
  const [newRules, setNewRules] = React.useState(roomRules || '');

  const tier = (ownerTier || 'Free') as SubscriptionTier;
  const can = (req: SubscriptionTier) => isTierAtLeast(tier, req);
  const themeEntries = Object.entries(ROOM_THEME_MAP);

  // ── Tab bar (horizontal scrollable) ──
  const renderTabBar = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ gap: 4, paddingHorizontal: 2 }}>
      {TABS.map(tab => {
        const active = activeTab === tab.id;
        return (
          <Pressable key={tab.id} style={[s.tab, active && s.tabActive]} onPress={() => setActiveTab(tab.id)}>
            <Ionicons name={tab.icon as any} size={13} color={active ? '#14B8A6' : '#475569'} />
            <Text style={[s.tabText, active && s.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  // ═══ GENEL ═══
  const renderGeneral = () => (
    <View>
      {/* Oda İsmi — Free */}
      {isHost && onRenameRoom && (
        <View>
          {editingName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
              <TextInput style={s.nameInput} value={newName} onChangeText={setNewName} placeholder="Yeni oda ismi..." placeholderTextColor="#475569" maxLength={50} autoFocus />
              <Pressable style={[s.saveNameBtn, newName.trim().length < 2 && { opacity: 0.4 }]} onPress={() => { if (newName.trim().length >= 2) { onRenameRoom(newName.trim()); setEditingName(false); } }} disabled={newName.trim().length < 2}>
                <Ionicons name="checkmark" size={16} color="#FFF" />
              </Pressable>
              <Pressable onPress={() => { setEditingName(false); setNewName(roomName || ''); }}><Ionicons name="close" size={16} color="#64748B" /></Pressable>
            </View>
          ) : (
            <SettingRow icon="create" iconBg="rgba(59,130,246,0.2)" label="Oda İsmi" desc={roomName || 'Oda ismi'} right={<Pressable onPress={() => setEditingName(true)}><Ionicons name="chevron-forward" size={16} color="#475569" /></Pressable>} />
          )}
        </View>
      )}

      {/* Hoş Geldin Mesajı — Free */}
      {isHost && onChangeWelcomeMessage && (
        <View>
          {editingWelcome ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
              <TextInput style={[s.nameInput, { fontSize: 12 }]} value={newWelcome} onChangeText={setNewWelcome} placeholder="Hoş geldin mesajı yaz..." placeholderTextColor="#475569" maxLength={120} autoFocus />
              <Pressable style={s.saveNameBtn} onPress={() => { onChangeWelcomeMessage(newWelcome.trim()); setEditingWelcome(false); }}><Ionicons name="checkmark" size={16} color="#FFF" /></Pressable>
              <Pressable onPress={() => { setEditingWelcome(false); setNewWelcome(welcomeMessage || ''); }}><Ionicons name="close" size={16} color="#64748B" /></Pressable>
            </View>
          ) : (
            <SettingRow icon="chatbubble-ellipses" iconBg="rgba(20,184,166,0.2)" label="Hoş Geldin Mesajı" desc={welcomeMessage || 'Ayarlanmadı'} right={<Pressable onPress={() => setEditingWelcome(true)}><Ionicons name="chevron-forward" size={16} color="#475569" /></Pressable>} />
          )}
        </View>
      )}

      {/* Kurallar — Free */}
      {isHost && onRulesChange && (
        <View>
          {editingRules ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
              <TextInput style={[s.nameInput, { fontSize: 12, height: 60, textAlignVertical: 'top', paddingTop: 10 }]} value={newRules} onChangeText={setNewRules} placeholder="Oda kurallarını yaz..." placeholderTextColor="#475569" maxLength={300} multiline autoFocus />
              <Pressable style={s.saveNameBtn} onPress={() => { onRulesChange(newRules.trim()); setEditingRules(false); }}><Ionicons name="checkmark" size={16} color="#FFF" /></Pressable>
              <Pressable onPress={() => { setEditingRules(false); setNewRules(roomRules || ''); }}><Ionicons name="close" size={16} color="#64748B" /></Pressable>
            </View>
          ) : (
            <SettingRow icon="document-text" iconBg="rgba(245,158,11,0.2)" label="Oda Kuralları" desc={roomRules || 'Ayarlanmadı'} right={<Pressable onPress={() => setEditingRules(true)}><Ionicons name="chevron-forward" size={16} color="#475569" /></Pressable>} />
          )}
        </View>
      )}

      {/* Oda Tipi — Bronze+ (şifreli oda) */}
      {isHost && (can('Bronze') ? (
        onRoomTypeChange && (
          <SettingRow icon="globe" iconBg="rgba(59,130,246,0.2)" label={roomType === 'open' ? 'Herkese Açık' : roomType === 'closed' ? 'Şifreli Oda' : 'Davetiye ile'} desc="Oda erişim tipini değiştir"
            right={
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {(['open', 'closed', 'invite'] as const).map(t => (
                  <Pressable key={t} style={[s.slowPill, roomType === t && s.slowPillActive]} onPress={() => onRoomTypeChange(t)}>
                    <Text style={[s.slowPillText, roomType === t && s.slowPillTextActive]}>{t === 'open' ? 'Açık' : t === 'closed' ? 'Şifreli' : 'Davet'}</Text>
                  </Pressable>
                ))}
              </View>
            }
          />
        )
      ) : <LockedRow icon="key-outline" label="Şifreli Oda Oluşturma" requiredTier="Bronze" />)}

      {/* Oda Kilidi — Silver+ */}
      {isHost && (can('Silver') ? (
        onToggleLock && (
          <SettingRow icon="lock-closed" iconBg="rgba(245,158,11,0.2)" label={isLocked ? 'Oda Kilitli' : 'Oda Açık'} desc={isLocked ? 'Yeni girişler engellendi' : 'Herkes katılabilir'}
            right={<Switch value={!!isLocked} onValueChange={onToggleLock} trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(245,158,11,0.4)' }} thumbColor={isLocked ? '#F59E0B' : '#475569'} />}
          />
        )
      ) : <LockedRow icon="lock-closed" label="Oda Kilitleme" requiredTier="Silver" />)}

      {/* Odayı Dondur — Bronze+ */}
      {canFreezeRoom && onFreezeRoom && (
        <Pressable style={[s.closeRoomBtn, { borderColor: 'rgba(59,130,246,0.2)', backgroundColor: 'rgba(59,130,246,0.06)' }]} onPress={() => { onClose(); onFreezeRoom(); }}>
          <View style={[s.closeRoomIcon, { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.25)' }]}><Ionicons name="snow" size={20} color="#3B82F6" /></View>
          <View style={{ flex: 1 }}>
            <Text style={[s.closeRoomTitle, { color: '#3B82F6' }]}>Odayı Dondur</Text>
            <Text style={s.closeRoomDesc}>Oda dondurulur, dilediğinde tekrar aktifleştir</Text>
          </View>
        </Pressable>
      )}

      {/* Odayı Sil — Owner-only */}
      {canDeleteRoom && onDeleteRoom && (
        <Pressable style={[s.closeRoomBtn, { marginTop: 10 }]} onPress={() => { onClose(); onDeleteRoom(); }}>
          <View style={s.closeRoomIcon}><Ionicons name="trash" size={20} color="#EF4444" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.closeRoomTitle}>Odayı Sil</Text>
            <Text style={s.closeRoomDesc}>Oda kalıcı olarak silinir, geri alınamaz</Text>
          </View>
        </Pressable>
      )}

      {/* Odadan Ayrıl */}
      {onLeaveRoom && (
        <Pressable style={[s.closeRoomBtn, { borderColor: 'rgba(245,158,11,0.2)', backgroundColor: 'rgba(245,158,11,0.06)', marginTop: 10 }]} onPress={() => { onClose(); onLeaveRoom(); }}>
          <View style={[s.closeRoomIcon, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)' }]}><Ionicons name="exit" size={20} color="#F59E0B" /></View>
          <View style={{ flex: 1 }}>
            <Text style={[s.closeRoomTitle, { color: '#F59E0B' }]}>Odadan Ayrıl</Text>
            <Text style={s.closeRoomDesc}>Odadan çık ve ana sayfaya dön</Text>
          </View>
        </Pressable>
      )}
    </View>
  );

  // ═══ KONUŞMA ═══
  const renderSpeaking = () => (
    <View>
      {/* Mikrofon Modu — Free */}
      <SettingRow icon="mic" iconBg="rgba(20,184,166,0.25)" label="Mikrofon Modu" desc={micMode === 'music' ? 'Stereo ses — gürültü engelleme kapalı' : 'Mono ses — konuşma optimize'}
        right={<TogglePill active={micMode === 'music'} labelA="Konuşma" labelB="Müzik" onToggle={() => onMicModeChange(micMode === 'music' ? 'normal' : 'music')} />}
      />

      {/* Gürültü Engelleme — Free */}
      <SettingRow icon="ear" iconBg="rgba(74,222,128,0.2)" label="Gürültü Engelleme" desc={micMode === 'music' ? 'Müzik modunda otomatik kapalı' : undefined}
        right={<Switch value={micMode === 'music' ? false : noiseCancellation} onValueChange={onNoiseCancellationChange} disabled={micMode === 'music'} trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(20,184,166,0.4)' }} thumbColor={noiseCancellation && micMode !== 'music' ? '#14B8A6' : '#475569'} />}
      />

      {/* Hoparlör — Free */}
      <SettingRow icon={useSpeaker ? 'volume-high' : 'headset'} iconBg={useSpeaker ? 'rgba(245,158,11,0.2)' : 'rgba(139,92,246,0.2)'} label={useSpeaker ? 'Hoparlör Açık' : 'Kulaklık Modu'} desc="Ses çıkış kaynağını değiştir"
        right={
          <Pressable style={[s.speakerBtn, useSpeaker && s.speakerBtnActive]} onPress={() => onSpeakerChange(!useSpeaker)}>
            <Ionicons name={useSpeaker ? 'volume-high' : 'headset'} size={14} color={useSpeaker ? '#F59E0B' : '#A78BFA'} />
            <Text style={[s.speakerBtnText, useSpeaker && { color: '#F59E0B' }]}>{useSpeaker ? 'Hoparlör' : 'Kulaklık'}</Text>
          </Pressable>
        }
      />

      {/* Konuşma Modu — Free (2 mod) / VIP (3 mod) */}
      {isHost && onSpeakingModeChange && (
        <SettingRow icon="mic-circle" iconBg="rgba(20,184,166,0.25)" label={speakingMode === 'free_for_all' ? 'Herkes Konuşabilir' : speakingMode === 'selected_only' ? 'Sadece Seçilmişler' : 'Sadece İzinli'} desc={speakingMode === 'free_for_all' ? 'Dinleyiciler doğrudan sahneye çıkabilir' : speakingMode === 'selected_only' ? 'Sadece owner tarafından seçilen kişiler' : 'Dinleyiciler el kaldırarak söz ister'}
          right={
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {(['free_for_all', 'permission_only', 'selected_only'] as const).map(m => {
                const isVIPOnly = m === 'selected_only';
                const locked = isVIPOnly && !can('VIP');
                const labels: Record<string, string> = { free_for_all: 'Serbest', permission_only: 'İzinli', selected_only: 'Seçili' };
                return (
                  <Pressable key={m} style={[s.slowPill, speakingMode === m && s.slowPillActive, locked && { opacity: 0.35 }]}
                    onPress={() => { if (locked) showToast({ title: '🔒 VIP+ ile açılır', type: 'info' }); else onSpeakingModeChange(m); }}>
                    <Text style={[s.slowPillText, speakingMode === m && s.slowPillTextActive]}>{locked ? '🔒' : ''}{labels[m]}</Text>
                  </Pressable>
                );
              })}
            </View>
          }
        />
      )}

      {/* Sahne Düzeni — Silver+ */}
      {isHost && !can('Silver') && <LockedRow icon="grid-outline" label="Sahne Düzeni (Kaç kişi konuşabilir)" requiredTier="Silver" />}
    </View>
  );

  // ═══ MODERASYON ═══
  const renderModeration = () => (
    <View>
      {/* Slow Mode — Free */}
      {isHost && onSlowModeChange && (
        <SettingRow icon="time" iconBg="rgba(59,130,246,0.2)" label={slowModeSeconds ? `Slow Mode: ${slowModeSeconds}sn` : 'Slow Mode Kapalı'} desc="Chat mesaj aralığını sınırla"
          right={
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[0, 5, 15, 30].map(sec => (
                <Pressable key={sec} style={[s.slowPill, slowModeSeconds === sec && s.slowPillActive]} onPress={() => onSlowModeChange(sec)}>
                  <Text style={[s.slowPillText, slowModeSeconds === sec && s.slowPillTextActive]}>{sec === 0 ? 'Off' : `${sec}s`}</Text>
                </Pressable>
              ))}
            </View>
          }
        />
      )}

      {/* Dil Filtresi — Silver+ */}
      {isHost && (can('Silver') ? (
        onLanguageChange && (
          <SettingRow icon="globe" iconBg="rgba(192,192,192,0.2)" label={`Oda Dili: ${({ 'tr': 'Türkçe', 'en': 'English', 'de': 'Deutsch', 'ar': 'العربية' })[roomLanguage || 'tr'] || roomLanguage || 'Türkçe'}`} desc="Oda dil tercihini belirle"
            right={
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {['tr', 'en', 'de', 'ar'].map(lang => (
                  <Pressable key={lang} style={[s.slowPill, roomLanguage === lang && s.slowPillActive]} onPress={() => onLanguageChange(lang)}>
                    <Text style={[s.slowPillText, roomLanguage === lang && s.slowPillTextActive]}>{({ 'tr': '🇹🇷', 'en': '🇬🇧', 'de': '🇩🇪', 'ar': '🇸🇦' })[lang]}</Text>
                  </Pressable>
                ))}
              </View>
            }
          />
        )
      ) : <LockedRow icon="globe-outline" label="Dil Filtresi" requiredTier="Silver" />)}

      {/* Yaş Filtresi (+18) — Silver+ */}
      {isHost && (can('Silver') ? (
        onAgeRestrictedChange && (
          <SettingRow icon="warning" iconBg={ageRestricted ? 'rgba(239,68,68,0.2)' : 'rgba(192,192,192,0.2)'} label={ageRestricted ? '+18 İçerik Aktif' : 'Yaş Sınırı Yok'} desc={ageRestricted ? 'Sadece 18 yaş üstü katılabilir' : 'Tüm yaş gruplarına açık'}
            right={<Switch value={!!ageRestricted} onValueChange={onAgeRestrictedChange} trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(239,68,68,0.4)' }} thumbColor={ageRestricted ? '#EF4444' : '#475569'} />}
          />
        )
      ) : <LockedRow icon="calendar-outline" label="Yaş Filtresi (+18)" requiredTier="Silver" />)}

      {/* Takipçilere Özel — Gold+ */}
      {can('Gold') ? (
        onToggleFollowersOnly && (
          <SettingRow icon="people" iconBg="rgba(212,175,55,0.2)" label={followersOnly ? 'Takipçilere Özel' : 'Herkese Açık'} desc={followersOnly ? 'Sadece takipçiler katılabilir' : 'Herkes odaya katılabilir'}
            right={<Switch value={!!followersOnly} onValueChange={onToggleFollowersOnly} trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(212,175,55,0.4)' }} thumbColor={followersOnly ? '#D4AF37' : '#475569'} />}
          />
        )
      ) : <LockedRow icon="people-outline" label="Sadece Takipçiler Girebilir" requiredTier="Gold" />}

      {/* Tümünü Sustur — VIP */}
      {!can('VIP') && <LockedRow icon="volume-mute-outline" label="Tümünü Sustur (Cooldown ile)" requiredTier="VIP" />}

      {/* Gelişmiş Ban — VIP */}
      {!can('VIP') && <LockedRow icon="ban-outline" label="Gelişmiş Ban Seçenekleri" requiredTier="VIP" />}
    </View>
  );

  // ═══ GÖRSELLİK ═══
  const renderVisual = () => (
    <View>
      {/* Oda Teması — Silver+ */}
      {can('Silver') ? (
        isHost && onChangeTheme && (
          <View>
            <Text style={[s.sectionTitle, { marginBottom: 8 }]}>🎨 Oda Teması</Text>
            <View style={s.themeGrid}>
              <Pressable style={[s.themeCircle, !currentThemeId && s.themeCircleActive]} onPress={() => onChangeTheme(null)}>
                <LinearGradient colors={['#0E1420', '#070B14']} style={s.themeGrad}><Ionicons name="moon-outline" size={14} color="rgba(255,255,255,0.35)" /></LinearGradient>
                {!currentThemeId && <View style={s.themeCheck}><Ionicons name="checkmark" size={8} color="#FFF" /></View>}
              </Pressable>
              {themeEntries.map(([id, theme]) => {
                const active = currentThemeId === id;
                return (
                  <Pressable key={id} style={[s.themeCircle, active && s.themeCircleActive]} onPress={() => onChangeTheme(id)}>
                    <LinearGradient colors={theme.colors} style={s.themeGrad}><Text style={s.themeName}>{theme.name.slice(0, 2)}</Text></LinearGradient>
                    {active && <View style={s.themeCheck}><Ionicons name="checkmark" size={8} color="#FFF" /></View>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )
      ) : <LockedRow icon="color-palette-outline" label="Oda Teması" requiredTier="Silver" />}

      {/* Arka Plan Resmi — Silver+ */}
      {can('Silver') ? (
        isHost && onChangeBackgroundImage && (
          <SettingRow icon="image" iconBg="rgba(139,92,246,0.2)" label="Arka Plan Resmi" desc={backgroundImage ? 'Arka plan ayarlandı' : 'Üyelik statüsüne göre'}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {backgroundImage ? (
                  <Pressable onPress={() => onChangeBackgroundImage(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                    <Ionicons name="trash-outline" size={12} color="#EF4444" /><Text style={{ fontSize: 10, fontWeight: '600', color: '#EF4444' }}>Kaldır</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => onChangeBackgroundImage('default')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(139,92,246,0.1)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)' }}>
                    <Ionicons name="add" size={12} color="#A78BFA" /><Text style={{ fontSize: 10, fontWeight: '600', color: '#A78BFA' }}>Seç</Text>
                  </Pressable>
                )}
              </View>
            }
          />
        )
      ) : <LockedRow icon="image-outline" label="Arka Plan Resmi" requiredTier="Silver" />}

      {/* Oda Kapak Görseli — Gold+ */}
      {isHost && (can('Gold') ? (
        onChangeCoverImage && (
          <SettingRow icon="albums" iconBg="rgba(255,215,0,0.2)" label="Oda Kapak Görseli" desc={coverImage ? 'Banner ayarlandı' : 'Keşfet akışında görünen banner'}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {coverImage ? (
                  <Pressable onPress={() => onChangeCoverImage(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                    <Ionicons name="trash-outline" size={12} color="#EF4444" /><Text style={{ fontSize: 10, fontWeight: '600', color: '#EF4444' }}>Kaldır</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => onChangeCoverImage('pick')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' }}>
                    <Ionicons name="add" size={12} color="#FFD700" /><Text style={{ fontSize: 10, fontWeight: '600', color: '#FFD700' }}>Seç</Text>
                  </Pressable>
                )}
              </View>
            }
          />
        )
      ) : <LockedRow icon="albums-outline" label="Oda Kapak Görseli (Banner)" requiredTier="Gold" />)}

      {/* Oda Müziği — Gold+ */}
      {can('Gold') ? (
        isHost && onMusicChange && (
          <SettingRow icon="musical-notes" iconBg="rgba(255,215,0,0.2)" label={musicTrack ? `Müzik: ${({ 'lofi': 'Lofi', 'ambient': 'Ambient', 'jazz': 'Jazz' })[musicTrack] || musicTrack}` : 'Oda Müziği Kapalı'} desc="Arka planda ambient ses döngüsü"
            right={
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {([null, 'lofi', 'ambient', 'jazz'] as const).map(track => (
                  <Pressable key={track || 'off'} style={[s.slowPill, musicTrack === track && s.slowPillActive]} onPress={() => onMusicChange(track)}>
                    <Text style={[s.slowPillText, musicTrack === track && s.slowPillTextActive]}>{track === null ? '🔇' : track === 'lofi' ? '🎵' : track === 'ambient' ? '🌊' : '🎷'}</Text>
                  </Pressable>
                ))}
              </View>
            }
          />
        )
      ) : <LockedRow icon="musical-notes-outline" label="Oda Arka Plan Müziği" requiredTier="Gold" />}
    </View>
  );

  // ═══ MONETİZASYON ═══
  const renderMonetization = () => (
    <View>
      {/* Bağış Toggle — Gold+ */}
      {can('Gold') ? (
        onDonationsToggle && (
          <SettingRow icon="heart" iconBg="rgba(239,68,68,0.2)" label={donationsEnabled ? 'Bağış Açık' : 'Bağış Kapalı'} desc="Dinleyicilerden SP bağışı kabul et"
            right={<Switch value={!!donationsEnabled} onValueChange={onDonationsToggle} trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(239,68,68,0.4)' }} thumbColor={donationsEnabled ? '#EF4444' : '#475569'} />}
          />
        )
      ) : <LockedRow icon="heart-outline" label="Bağış (Tip) Aç/Kapat" requiredTier="Gold" />}

      {/* Giriş Ücreti — VIP */}
      {can('VIP') ? (
        onEntryFeeChange && (
          <SettingRow icon="cash" iconBg="rgba(212,175,55,0.2)" label={entryFeeSp ? `Giriş: ${entryFeeSp} SP` : 'Giriş Ücretsiz'} desc="SP cinsinden oda giriş ücreti"
            right={
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[0, 10, 50, 100].map(fee => (
                  <Pressable key={fee} style={[s.slowPill, entryFeeSp === fee && s.slowPillActive]} onPress={() => onEntryFeeChange(fee)}>
                    <Text style={[s.slowPillText, entryFeeSp === fee && s.slowPillTextActive]}>{fee === 0 ? 'Free' : `${fee}`}</Text>
                  </Pressable>
                ))}
              </View>
            }
          />
        )
      ) : <LockedRow icon="cash-outline" label="Giriş Ücreti Belirleme (SP)" requiredTier="VIP" />}

      {/* Oda Boost — VIP (PlusMenu'dan yapılır) */}
      {can('VIP') ? (
        <Pressable onPress={() => { onClose(); showToast({ title: '🚀 Boost', message: '+ menüsünden "Odayı Öne Çıkar" ile boost aktifleştir.', type: 'info' }); }}>
          <SettingRow icon="rocket" iconBg="rgba(255,107,53,0.2)" label="Odayı Öne Çıkar" desc="+ menüsünden boost aktifleştir"
            right={<View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(255,107,53,0.12)', borderWidth: 1, borderColor: 'rgba(255,107,53,0.2)' }}><Text style={{ fontSize: 9, fontWeight: '700', color: '#FF6B35' }}>+ Menü</Text></View>}
          />
        </Pressable>
      ) : <LockedRow icon="rocket-outline" label="Odayı Öne Çıkarma / Boost" requiredTier="VIP" />}
    </View>
  );

  // ═══ GELİŞMİŞ ═══
  const renderAdvanced = () => (
    <View>
      {/* 13 Kişi Sahne — VIP */}
      {can('VIP') ? (
        <SettingRow icon="people" iconBg="rgba(255,107,53,0.2)" label="13 Kişilik Sahne" desc="Genişletilmiş sahne kapasitesi aktif"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,107,53,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#FF6B35' }}>13 kişi</Text></View>}
        />
      ) : <LockedRow icon="people-outline" label="13 Kişilik Sahne" requiredTier="VIP" />}
    </View>
  );

  // ═══ RENDER ═══
  const renderContent = () => {
    switch (activeTab) {
      case 'general': return renderGeneral();
      case 'speaking': return renderSpeaking();
      case 'moderation': return renderModeration();
      case 'visual': return renderVisual();
      case 'monetization': return renderMonetization();
      case 'advanced': return renderAdvanced();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.headerIcon}><Ionicons name="settings-outline" size={18} color="#14B8A6" /></View>
              <Text style={s.headerTitle}>Oda Ayarları</Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn}><Ionicons name="close" size={18} color="rgba(255,255,255,0.4)" /></Pressable>
          </View>

          {/* Tab Bar */}
          {renderTabBar()}

          {/* Content */}
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420, marginTop: 12 }}>
            {renderContent()}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════
// STYLES — Premium Glassmorphism
// ═══════════════════════════════════════════════════
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 36,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.15)', borderBottomWidth: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'center', marginTop: 12, marginBottom: 10 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.12)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  headerTitle: {
    fontSize: 17, fontWeight: '700', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Tab Bar
  tabBar: { flexDirection: 'row', maxHeight: 38 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tabActive: {
    backgroundColor: 'rgba(20,184,166,0.12)', borderColor: 'rgba(20,184,166,0.3)',
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2,
  },
  tabText: {
    fontSize: 10, fontWeight: '600', color: '#64748B',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  tabTextActive: { color: '#5EEAD4' },

  // Section
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowIcon: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  rowInfo: { flex: 1 },
  rowLabel: {
    fontSize: 14, fontWeight: '600', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  rowDesc: {
    fontSize: 11, color: '#94A3B8', marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  // Toggle Pill
  togglePill: {
    flexDirection: 'row', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  toggleOption: { paddingHorizontal: 12, paddingVertical: 7 },
  toggleOptionActive: {
    backgroundColor: 'rgba(20,184,166,0.2)',
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  toggleText: {
    fontSize: 11, fontWeight: '600', color: '#64748B',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  toggleTextActive: { color: '#5EEAD4' },

  // Speaker Button
  speakerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  speakerBtnActive: {
    backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)',
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  speakerBtnText: {
    fontSize: 11, fontWeight: '600', color: '#94A3B8',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  // Theme
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  themeCircle: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  themeCircleActive: {
    borderColor: '#14B8A6', borderWidth: 2.5,
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  themeGrad: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' } as any,
  themeName: {
    fontSize: 9, fontWeight: '700', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  themeCheck: {
    position: 'absolute' as const, bottom: -1, right: -1, width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#14B8A6', alignItems: 'center' as any, justifyContent: 'center' as any,
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 4,
  },

  // Close Room / Delete / Leave
  closeRoomBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  closeRoomIcon: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  closeRoomTitle: {
    fontSize: 14, fontWeight: '700', color: '#EF4444',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  closeRoomDesc: {
    fontSize: 11, color: '#94A3B8', marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  // Name Edit
  nameInput: {
    flex: 1, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, color: '#F1F5F9', fontSize: 14,
  },
  saveNameBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.25)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.35)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 6,
  },

  // Slow Mode / Option Pills
  slowPill: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  slowPillActive: {
    backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.35)',
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  slowPillText: {
    fontSize: 10, fontWeight: '600', color: '#94A3B8',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  slowPillTextActive: { color: '#93C5FD' },
});
