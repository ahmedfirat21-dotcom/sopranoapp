/**
 * SopranoChat — Oda Ayarları Paneli
 * Sesli sohbet odası için: Mikrofon modu, hoparlör/kulaklık, tema, odayı kapat
 */
import React from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Switch, ScrollView, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// Inline tema tanımları (storeColors.ts kaldırıldı)
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
  // Theme
  isHost?: boolean;
  currentThemeId?: string | null;
  onChangeTheme?: (themeId: string | null) => void;
  // Oda Kilidi (Silver+)
  isLocked?: boolean;
  onToggleLock?: (locked: boolean) => void;
  // Oda İsmi Düzenleme
  roomName?: string;
  onRenameRoom?: (newName: string) => void;
  // Yalnızca Takipçilere Açık (Gold+)
  followersOnly?: boolean;
  onToggleFollowersOnly?: (enabled: boolean) => void;
  // Slow Mode (Moderator+)
  slowModeSeconds?: number;
  onSlowModeChange?: (seconds: number) => void;
  // Owner tier (UI filtresi için)
  ownerTier?: string;
  // Arka Plan Resmi (Silver+)
  backgroundImage?: string | null;
  onChangeBackgroundImage?: (imageUri: string | null) => void;
  // Hoş Geldin Mesajı
  welcomeMessage?: string;
  onChangeWelcomeMessage?: (msg: string) => void;
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
// TOGGLE PILL — compact pill selector
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
  } = props;

  const [editingName, setEditingName] = React.useState(false);
  const [newName, setNewName] = React.useState(roomName || '');
  const [editingWelcome, setEditingWelcome] = React.useState(false);
  const [newWelcome, setNewWelcome] = React.useState(welcomeMessage || '');

  const themeEntries = Object.entries(ROOM_THEME_MAP);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.headerIcon}>
                <Ionicons name="settings-outline" size={18} color="#14B8A6" />
              </View>
              <Text style={s.headerTitle}>Oda Ayarları</Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.4)" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            {/* ─── SES ─── */}
            <Text style={s.sectionTitle}>🎤 Ses</Text>

            {/* Mikrofon Modu */}
            <SettingRow
              icon="mic"
              iconBg="rgba(20,184,166,0.25)"
              label="Mikrofon Modu"
              desc={micMode === 'music' ? 'Stereo ses — gürültü engelleme kapalı' : 'Mono ses — konuşma optimize'}
              right={
                <TogglePill
                  active={micMode === 'music'}
                  labelA="Konuşma"
                  labelB="Müzik"
                  onToggle={() => onMicModeChange(micMode === 'music' ? 'normal' : 'music')}
                />
              }
            />

            {/* Gürültü Engelleme */}
            <SettingRow
              icon="ear"
              iconBg="rgba(74,222,128,0.2)"
              label="Gürültü Engelleme"
              desc={micMode === 'music' ? 'Müzik modunda otomatik kapalı' : undefined}
              right={
                <Switch
                  value={micMode === 'music' ? false : noiseCancellation}
                  onValueChange={onNoiseCancellationChange}
                  disabled={micMode === 'music'}
                  trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(20,184,166,0.4)' }}
                  thumbColor={noiseCancellation && micMode !== 'music' ? '#14B8A6' : '#475569'}
                />
              }
            />

            {/* Hoparlör / Kulaklık */}
            <SettingRow
              icon={useSpeaker ? 'volume-high' : 'headset'}
              iconBg={useSpeaker ? 'rgba(245,158,11,0.2)' : 'rgba(139,92,246,0.2)'}
              label={useSpeaker ? 'Hoparlör Açık' : 'Kulaklık Modu'}
              desc="Ses çıkış kaynağını değiştir"
              right={
                <Pressable
                  style={[s.speakerBtn, useSpeaker && s.speakerBtnActive]}
                  onPress={() => onSpeakerChange(!useSpeaker)}
                >
                  <Ionicons
                    name={useSpeaker ? 'volume-high' : 'headset'}
                    size={14}
                    color={useSpeaker ? '#F59E0B' : '#A78BFA'}
                  />
                  <Text style={[s.speakerBtnText, useSpeaker && { color: '#F59E0B' }]}>
                    {useSpeaker ? 'Hoparlör' : 'Kulaklık'}
                  </Text>
                </Pressable>
              }
            />

            {/* ─── ODA TEMASI ─── */}
            {isHost && onChangeTheme && (
              <>
                <Text style={[s.sectionTitle, { marginTop: 20 }]}>🎨 Oda Teması</Text>
                <View style={s.themeGrid}>
                  {/* Varsayılan */}
                  <Pressable
                    style={[s.themeCircle, !currentThemeId && s.themeCircleActive]}
                    onPress={() => onChangeTheme(null)}
                  >
                    <LinearGradient colors={['#0E1420', '#070B14']} style={s.themeGrad}>
                      <Ionicons name="moon-outline" size={14} color="rgba(255,255,255,0.35)" />
                    </LinearGradient>
                    {!currentThemeId && (
                      <View style={s.themeCheck}>
                        <Ionicons name="checkmark" size={8} color="#FFF" />
                      </View>
                    )}
                  </Pressable>

                  {/* Mağaza temaları */}
                  {themeEntries.map(([id, theme]) => {
                    const active = currentThemeId === id;
                    return (
                      <Pressable
                        key={id}
                        style={[s.themeCircle, active && s.themeCircleActive]}
                        onPress={() => onChangeTheme(id)}
                      >
                        <LinearGradient colors={theme.colors} style={s.themeGrad}>
                          <Text style={s.themeName}>{theme.name.slice(0, 2)}</Text>
                        </LinearGradient>
                        {active && (
                          <View style={s.themeCheck}>
                            <Ionicons name="checkmark" size={8} color="#FFF" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* ─── ODA YÖNETİMİ ─── */}
            {isHost && (
              <>
                <Text style={[s.sectionTitle, { marginTop: 20 }]}>🛠️ Oda Yönetimi</Text>

                {/* Oda Kilidi */}
                {onToggleLock && (
                  <SettingRow
                    icon="lock-closed"
                    iconBg="rgba(245,158,11,0.2)"
                    label={isLocked ? 'Oda Kilitli' : 'Oda Açık'}
                    desc={isLocked ? 'Yeni girişler engellendi' : 'Herkes katılabilir'}
                    right={
                      <Switch
                        value={!!isLocked}
                        onValueChange={onToggleLock}
                        trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(245,158,11,0.4)' }}
                        thumbColor={isLocked ? '#F59E0B' : '#475569'}
                      />
                    }
                  />
                )}

                {/* Oda İsmi Düzenleme */}
                {onRenameRoom && (
                  <View>
                    {editingName ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <TextInput
                          style={s.nameInput}
                          value={newName}
                          onChangeText={setNewName}
                          placeholder="Yeni oda ismi..."
                          placeholderTextColor="#475569"
                          maxLength={50}
                          autoFocus
                        />
                        <Pressable
                          style={[s.saveNameBtn, newName.trim().length < 2 && { opacity: 0.4 }]}
                          onPress={() => { if (newName.trim().length >= 2) { onRenameRoom(newName.trim()); setEditingName(false); } }}
                          disabled={newName.trim().length < 2}
                        >
                          <Ionicons name="checkmark" size={16} color="#FFF" />
                        </Pressable>
                        <Pressable onPress={() => { setEditingName(false); setNewName(roomName || ''); }}>
                          <Ionicons name="close" size={16} color="#64748B" />
                        </Pressable>
                      </View>
                    ) : (
                      <SettingRow
                        icon="create"
                        iconBg="rgba(59,130,246,0.2)"
                        label="Oda İsmini Düzenle"
                        desc={roomName || 'Oda ismi'}
                        right={
                          <Pressable onPress={() => setEditingName(true)}>
                            <Ionicons name="chevron-forward" size={16} color="#475569" />
                          </Pressable>
                        }
                      />
                    )}
                  </View>
                )}

                {/* ★ Yalnızca Takipçilere Açık (Gold+) */}
                {onToggleFollowersOnly && (
                  <SettingRow
                    icon="people"
                    iconBg="rgba(212,175,55,0.2)"
                    label={followersOnly ? 'Takipçilere Özel' : 'Herkese Açık'}
                    desc={followersOnly ? 'Sadece takipçiler katılabilir' : 'Herkes odaya katılabilir'}
                    right={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ backgroundColor: 'rgba(212,175,55,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                          <Text style={{ fontSize: 8, fontWeight: '700', color: '#D4AF37' }}>Gold+</Text>
                        </View>
                        <Switch
                          value={!!followersOnly}
                          onValueChange={onToggleFollowersOnly}
                          trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(212,175,55,0.4)' }}
                          thumbColor={followersOnly ? '#D4AF37' : '#475569'}
                        />
                      </View>
                    }
                  />
                )}

                {/* ★ Slow Mode */}
                {onSlowModeChange && (
                  <SettingRow
                    icon="time"
                    iconBg="rgba(59,130,246,0.2)"
                    label={slowModeSeconds ? `Slow Mode: ${slowModeSeconds}sn` : 'Slow Mode Kapalı'}
                    desc="Chat mesaj aralığını sınırla"
                    right={
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {[0, 5, 15, 30].map(sec => (
                          <Pressable
                            key={sec}
                            style={[s.slowPill, slowModeSeconds === sec && s.slowPillActive]}
                            onPress={() => onSlowModeChange(sec)}
                          >
                            <Text style={[s.slowPillText, slowModeSeconds === sec && s.slowPillTextActive]}>
                              {sec === 0 ? 'Off' : `${sec}s`}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    }
                  />
                )}

                {/* ★ Hoş Geldin Mesajı */}
                {onChangeWelcomeMessage && (
                  <View>
                    {editingWelcome ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <TextInput
                          style={[s.nameInput, { fontSize: 12 }]}
                          value={newWelcome}
                          onChangeText={setNewWelcome}
                          placeholder="Hoş geldin mesajı yaz..."
                          placeholderTextColor="#475569"
                          maxLength={120}
                          autoFocus
                        />
                        <Pressable
                          style={s.saveNameBtn}
                          onPress={() => { onChangeWelcomeMessage(newWelcome.trim()); setEditingWelcome(false); }}
                        >
                          <Ionicons name="checkmark" size={16} color="#FFF" />
                        </Pressable>
                        <Pressable onPress={() => { setEditingWelcome(false); setNewWelcome(welcomeMessage || ''); }}>
                          <Ionicons name="close" size={16} color="#64748B" />
                        </Pressable>
                      </View>
                    ) : (
                      <SettingRow
                        icon="chatbubble-ellipses"
                        iconBg="rgba(20,184,166,0.2)"
                        label="Hoş Geldin Mesajı"
                        desc={welcomeMessage || 'Ayarlanmadı'}
                        right={
                          <Pressable onPress={() => setEditingWelcome(true)}>
                            <Ionicons name="chevron-forward" size={16} color="#475569" />
                          </Pressable>
                        }
                      />
                    )}
                  </View>
                )}

                {/* ★ Arka Plan Resmi (Silver+) */}
                {onChangeBackgroundImage && (
                  <SettingRow
                    icon="image"
                    iconBg="rgba(139,92,246,0.2)"
                    label="Arka Plan Resmi"
                    desc={backgroundImage ? 'Arka plan ayarlandı' : 'Üyelik statüsüne göre'}
                    right={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ backgroundColor: 'rgba(192,132,252,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                          <Text style={{ fontSize: 8, fontWeight: '700', color: '#C084FC' }}>Silver+</Text>
                        </View>
                        {backgroundImage ? (
                          <Pressable onPress={() => onChangeBackgroundImage(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                            <Ionicons name="trash-outline" size={12} color="#EF4444" />
                            <Text style={{ fontSize: 10, fontWeight: '600', color: '#EF4444' }}>Kaldır</Text>
                          </Pressable>
                        ) : (
                          <Pressable onPress={() => onChangeBackgroundImage('default')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(139,92,246,0.1)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)' }}>
                            <Ionicons name="add" size={12} color="#A78BFA" />
                            <Text style={{ fontSize: 10, fontWeight: '600', color: '#A78BFA' }}>Seç</Text>
                          </Pressable>
                        )}
                      </View>
                    }
                  />
                )}
              </>
            )}

            {/* ─── ODAYI KAPAT ─── */}
            {canCloseRoom && onCloseRoom && (
              <Pressable
                style={s.closeRoomBtn}
                onPress={() => { onClose(); onCloseRoom(); }}
              >
                <View style={s.closeRoomIcon}>
                  <Ionicons name="power" size={18} color="#EF4444" />
                </View>
                <View>
                  <Text style={s.closeRoomTitle}>Odayı Kapat</Text>
                  <Text style={s.closeRoomDesc}>Tüm kullanıcılar çıkarılır</Text>
                </View>
              </Pressable>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#2d3d4d',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 36,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.12)',
    borderBottomWidth: 0,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center', marginTop: 12, marginBottom: 10,
  },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.1)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#F1F5F9' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Section
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#F1F5F9' },
  rowDesc: { fontSize: 11, color: '#64748B', marginTop: 2 },

  // Toggle Pill
  togglePill: {
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  toggleOption: {
    paddingHorizontal: 10, paddingVertical: 6,
  },
  toggleOptionActive: {
    backgroundColor: 'rgba(20,184,166,0.2)',
  },
  toggleText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  toggleTextActive: { color: '#14B8A6' },

  // Speaker Button
  speakerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  speakerBtnActive: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.25)',
  },
  speakerBtnText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },

  // Theme
  themeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingBottom: 8,
  },
  themeCircle: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  themeCircleActive: {
    borderColor: '#14B8A6', borderWidth: 2,
  },
  themeGrad: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  } as any,
  themeName: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  themeCheck: {
    position: 'absolute' as const, bottom: -1, right: -1,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#14B8A6',
    alignItems: 'center' as any, justifyContent: 'center' as any,
  },

  // Close Room
  closeRoomBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 20, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)',
  },
  closeRoomIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeRoomTitle: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  closeRoomDesc: { fontSize: 11, color: '#64748B', marginTop: 2 },

  // Name Edit
  nameInput: {
    flex: 1, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12, color: '#F1F5F9', fontSize: 14,
  },
  saveNameBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Slow Mode Pills
  slowPill: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  slowPillActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: 'rgba(59,130,246,0.3)',
  },
  slowPillText: { fontSize: 10, fontWeight: '600', color: '#64748B' },
  slowPillTextActive: { color: '#60A5FA' },
});
