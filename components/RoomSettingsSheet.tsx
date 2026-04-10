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
  ocean:   { name: 'Okyanus',  colors: ['#0E4D6F', '#083344'] },
  sunset:  { name: 'Gün Batımı', colors: ['#7F1D1D', '#4C0519'] },
  forest:  { name: 'Orman',    colors: ['#14532D', '#052E16'] },
  galaxy:  { name: 'Galaksi',  colors: ['#312E81', '#1E1B4B'] },
  aurora:  { name: 'Aurora',   colors: ['#134E4A', '#042F2E'] },
  cherry:  { name: 'Kiraz',    colors: ['#831843', '#500724'] },
  cyber:   { name: 'Cyber',    colors: ['#1E3A8A', '#172554'] },
  volcano: { name: 'Volkan',   colors: ['#7C2D12', '#431407'] },
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
  // Room close
  canCloseRoom?: boolean;
  onCloseRoom?: () => void;
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
  { id: 'general',        label: 'Genel',        icon: 'settings-outline' },
  { id: 'speaking',       label: 'Konuşma',      icon: 'mic-outline' },
  { id: 'moderation',     label: 'Moderasyon',   icon: 'shield-outline' },
  { id: 'visual',         label: 'Görsellik',    icon: 'color-palette-outline' },
  { id: 'monetization',   label: 'Monetizasyon', icon: 'cash-outline' },
  { id: 'advanced',       label: 'Gelişmiş',     icon: 'rocket-outline' },
];

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
export default function RoomSettingsSheet(props: RoomSettingsProps) {
  const {
    visible, onClose,
    micMode, onMicModeChange, noiseCancellation, onNoiseCancellationChange,
    useSpeaker, onSpeakerChange,
    canCloseRoom, onCloseRoom,
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

      {/* Odayı Kapat */}
      {canCloseRoom && onCloseRoom && (
        <Pressable style={s.closeRoomBtn} onPress={() => { onClose(); onCloseRoom(); }}>
          <View style={s.closeRoomIcon}><Ionicons name="power" size={18} color="#EF4444" /></View>
          <View><Text style={s.closeRoomTitle}>Odayı Kapat</Text><Text style={s.closeRoomDesc}>Tüm kullanıcılar çıkarılır</Text></View>
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

      {/* Stereo Ses — VIP */}
      {can('VIP') ? (
        <SettingRow icon="headset" iconBg="rgba(255,107,53,0.2)" label="Stereo Ses" desc="48kHz yüksek kalite audio aktif"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,107,53,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#FF6B35' }}>48kHz</Text></View>}
        />
      ) : <LockedRow icon="headset" label="Stereo Ses / Yüksek Kalite Audio" requiredTier="VIP" />}
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

      {/* Moderatör Atama — Bronze+ */}
      {can('Bronze') ? (
        <SettingRow icon="person-add" iconBg="rgba(205,127,50,0.2)" label="Moderatör Atama" desc={`Limit: ${can('VIP') ? '5' : can('Gold') ? '3' : can('Silver') ? '2' : '1'} kişi`}
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(205,127,50,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#CD7F32' }}>Bronze+</Text></View>}
        />
      ) : <LockedRow icon="person-add-outline" label="Moderatör Atama" requiredTier="Bronze" />}

      {/* Geri Sayımlı Kapatma — Bronze+ */}
      {can('Bronze') ? (
        <SettingRow icon="timer" iconBg="rgba(205,127,50,0.2)" label="Geri Sayımlı Kapatma" desc="Host ayrıldığında 60sn geri sayım"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(205,127,50,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#CD7F32' }}>Aktif</Text></View>}
        />
      ) : <LockedRow icon="timer-outline" label="Geri Sayımlı Kapatma" requiredTier="Bronze" />}

      {/* Dil Filtresi — Silver+ */}
      {can('Silver') ? (
        <SettingRow icon="globe" iconBg="rgba(192,192,192,0.2)" label="Dil Filtresi" desc="Oda dil tercihini belirle"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(192,192,192,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#C0C0C0' }}>Silver+</Text></View>}
        />
      ) : <LockedRow icon="globe-outline" label="Dil Filtresi" requiredTier="Silver" />}

      {/* Yaş Filtresi — Silver+ */}
      {can('Silver') ? (
        <SettingRow icon="calendar" iconBg="rgba(192,192,192,0.2)" label="Yaş Filtresi" desc="Yaş aralığı seçerek katılımcıları filtrele"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(192,192,192,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#C0C0C0' }}>Silver+</Text></View>}
        />
      ) : <LockedRow icon="calendar-outline" label="Yaş Filtresi" requiredTier="Silver" />}

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

      {/* Toplu Kontrol — VIP */}
      {!can('VIP') && <LockedRow icon="people-circle-outline" label="Toplu Kontrol" requiredTier="VIP" />}

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
      {can('Gold') ? (
        <SettingRow icon="albums" iconBg="rgba(255,215,0,0.2)" label="Oda Kapak Görseli" desc="Keşfet akışında görünen banner"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,215,0,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#FFD700' }}>Gold+</Text></View>}
        />
      ) : <LockedRow icon="albums-outline" label="Oda Kapak Görseli (Banner)" requiredTier="Gold" />}

      {/* Oda Müziği — Gold+ */}
      {can('Gold') ? (
        <SettingRow icon="musical-notes" iconBg="rgba(255,215,0,0.2)" label="Oda Arka Plan Müziği" desc="Lofi, jazz, ambient ses döngüsü"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,215,0,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#FFD700' }}>Gold+</Text></View>}
        />
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

      {/* Oda Boost — VIP */}
      {can('VIP') ? (
        <SettingRow icon="rocket" iconBg="rgba(255,107,53,0.2)" label="Odayı Öne Çıkar" desc="Keşfet akışında üst sıralarda göster"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,107,53,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#FF6B35' }}>VIP</Text></View>}
        />
      ) : <LockedRow icon="rocket-outline" label="Odayı Öne Çıkarma / Boost" requiredTier="VIP" />}
    </View>
  );

  // ═══ GELİŞMİŞ ═══
  const renderAdvanced = () => (
    <View>
      {/* Ghost Mode — VIP */}
      {can('VIP') ? (
        <SettingRow icon="eye-off" iconBg="rgba(139,92,246,0.2)" label="Ghost Mode" desc="Oda sahibi olarak gizlenebilirsin"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(139,92,246,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#A78BFA' }}>VIP</Text></View>}
        />
      ) : <LockedRow icon="eye-off-outline" label="Ghost Mode (Gizlenme)" requiredTier="VIP" />}

      {/* Kılık Değiştirme — VIP */}
      {can('VIP') ? (
        <SettingRow icon="glasses" iconBg="rgba(139,92,246,0.2)" label="Kılık Değiştirme" desc="Farklı isim/ikon ile görün"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(139,92,246,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#A78BFA' }}>VIP</Text></View>}
        />
      ) : <LockedRow icon="glasses-outline" label="Kılık Değiştirme" requiredTier="VIP" />}

      {/* 13 Kişi Sahne — VIP */}
      {can('VIP') ? (
        <SettingRow icon="people" iconBg="rgba(255,107,53,0.2)" label="13 Kişilik Sahne" desc="Genişletilmiş sahne kapasitesi"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,107,53,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#FF6B35' }}>13 kişi</Text></View>}
        />
      ) : <LockedRow icon="people-outline" label="13 Kişilik Sahne" requiredTier="VIP" />}

      {/* Oda Kaydı — VIP */}
      {can('VIP') ? (
        <SettingRow icon="radio" iconBg="rgba(239,68,68,0.2)" label="Oda Kaydı" desc="Sohbeti kaydet, daha sonra dinle"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(239,68,68,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#EF4444' }}>VIP</Text></View>}
        />
      ) : <LockedRow icon="radio-outline" label="Oda Kaydı (Recording)" requiredTier="VIP" />}

      {/* Canlı İstatistik — VIP */}
      {can('VIP') ? (
        <SettingRow icon="stats-chart" iconBg="rgba(59,130,246,0.2)" label="Canlı İstatistik Paneli" desc="CCU, süre, etkileşim"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(59,130,246,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#3B82F6' }}>VIP</Text></View>}
        />
      ) : <LockedRow icon="stats-chart-outline" label="Canlı İstatistik Paneli" requiredTier="VIP" />}
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
// STYLES
// ═══════════════════════════════════════════════════
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#2d3d4d',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 36,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.12)', borderBottomWidth: 0,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', marginTop: 12, marginBottom: 10 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(20,184,166,0.1)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#F1F5F9' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },

  // Tab Bar
  tabBar: { flexDirection: 'row', maxHeight: 36 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  tabActive: { backgroundColor: 'rgba(20,184,166,0.1)', borderColor: 'rgba(20,184,166,0.25)' },
  tabText: { fontSize: 10, fontWeight: '600', color: '#475569' },
  tabTextActive: { color: '#14B8A6' },

  // Section
  sectionTitle: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#F1F5F9' },
  rowDesc: { fontSize: 11, color: '#64748B', marginTop: 2 },

  // Toggle Pill
  togglePill: { flexDirection: 'row', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  toggleOption: { paddingHorizontal: 10, paddingVertical: 6 },
  toggleOptionActive: { backgroundColor: 'rgba(20,184,166,0.2)' },
  toggleText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  toggleTextActive: { color: '#14B8A6' },

  // Speaker Button
  speakerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  speakerBtnActive: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.25)' },
  speakerBtnText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },

  // Theme
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 8 },
  themeCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  themeCircleActive: { borderColor: '#14B8A6', borderWidth: 2 },
  themeGrad: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' } as any,
  themeName: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  themeCheck: { position: 'absolute' as const, bottom: -1, right: -1, width: 14, height: 14, borderRadius: 7, backgroundColor: '#14B8A6', alignItems: 'center' as any, justifyContent: 'center' as any },

  // Close Room
  closeRoomBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, padding: 14, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)' },
  closeRoomIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center' },
  closeRoomTitle: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  closeRoomDesc: { fontSize: 11, color: '#64748B', marginTop: 2 },

  // Name Edit
  nameInput: { flex: 1, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, color: '#F1F5F9', fontSize: 14 },
  saveNameBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(20,184,166,0.25)', alignItems: 'center', justifyContent: 'center' },

  // Slow Mode Pills
  slowPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  slowPillActive: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.3)' },
  slowPillText: { fontSize: 10, fontWeight: '600', color: '#64748B' },
  slowPillTextActive: { color: '#60A5FA' },
});
