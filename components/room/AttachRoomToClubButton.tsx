/**
 * SopranoChat — Odayı Korosuna Ekle Butonu
 * ═══════════════════════════════════════════════════
 * Kullanıcının owner/moderator olduğu korolardan birini seçip oda bağlar.
 * Eligible Koro yoksa hiç render etmez (sessiz). Tek tıkla picker modal açar.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Image } from 'react-native';
import AppLoader from '../AppLoader';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows } from '../../constants/theme';
import { ClubService, type Club } from '../../services/clubs';
import { showToast } from '../Toast';

interface Props {
  roomId: string;
  userId: string;
}

export default function AttachRoomToClubButton({ roomId, userId }: Props) {
  const [eligibleClubs, setEligibleClubs] = useState<Club[]>([]);
  const [attachedClubIds, setAttachedClubIds] = useState<Set<string>>(new Set());
  const [showPicker, setShowPicker] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busyClubId, setBusyClubId] = useState<string | null>(null);

  const loadClubs = useCallback(async () => {
    if (!userId) return;
    const myClubs = await ClubService.listMyClubs(userId);
    // Sadece owner veya moderator olduğu korolar
    const eligible: Club[] = [];
    for (const c of myClubs) {
      const m = await ClubService.getMyMembership(c.id, userId);
      if (m && (m.role === 'owner' || m.role === 'moderator')) {
        eligible.push(c);
      }
    }
    setEligibleClubs(eligible);
    // Bu odanın bağlı olduğu koroları tespit et
    const attached = new Set<string>();
    for (const c of eligible) {
      const rooms = await ClubService.listClubRooms(c.id);
      if (rooms.some(r => r.room_id === roomId)) attached.add(c.id);
    }
    setAttachedClubIds(attached);
    setLoaded(true);
  }, [userId, roomId]);

  useEffect(() => { loadClubs(); }, [loadClubs]);

  const handleToggle = async (club: Club) => {
    setBusyClubId(club.id);
    const isAttached = attachedClubIds.has(club.id);
    const r = isAttached
      ? await ClubService.detachRoom(club.id, roomId, userId)
      : await ClubService.attachRoom(club.id, roomId, userId);
    setBusyClubId(null);
    if (!r.success) {
      showToast({ title: 'İşlem Başarısız', message: r.error || '', type: 'error' });
      return;
    }
    const next = new Set(attachedClubIds);
    if (isAttached) next.delete(club.id);
    else next.add(club.id);
    setAttachedClubIds(next);
    showToast({
      title: isAttached ? 'Bağlantı Kaldırıldı' : '🎉 Koroya Eklendi',
      message: `"${club.name}"`,
      type: 'success',
    });
  };

  if (!loaded || eligibleClubs.length === 0) return null;

  return (
    <>
      <Pressable
        style={s.cta}
        onPress={() => setShowPicker(true)}
      >
        <LinearGradient
          colors={['#A855F7', '#7E22CE', '#581C87']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.ctaGrad}
        >
          <View style={s.ctaIcon}><Ionicons name="planet" size={20} color="#FFF" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.ctaTitle}>Koroya Ekle / Çıkar</Text>
            <Text style={s.ctaSub}>
              {attachedClubIds.size > 0
                ? `${attachedClubIds.size} Koroya bağlı`
                : `${eligibleClubs.length} Korondan birine ekleyebilirsin`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
        </LinearGradient>
      </Pressable>

      <Modal visible={showPicker} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowPicker(false)}>
        <Pressable style={s.overlay} onPress={() => setShowPicker(false)}>
          <Pressable style={s.dialog} onPress={() => {}}>
            <LinearGradient
              colors={['#4a5668', '#37414f', '#232a35']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={s.dialogHeader}>
              <View style={s.headerAccent} />
              <Ionicons name="planet" size={14} color={Colors.teal} />
              <Text style={s.headerTitle}>KULÜBE EKLE</Text>
              <Pressable onPress={() => setShowPicker(false)} hitSlop={8}>
                <Text style={s.cancel}>Kapat</Text>
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingVertical: 8 }}>
              {eligibleClubs.map(c => {
                const isAttached = attachedClubIds.has(c.id);
                const busy = busyClubId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => handleToggle(c)}
                    disabled={busy}
                    style={({ pressed }) => [s.row, pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }]}
                  >
                    {c.avatar_url ? (
                      <Image source={{ uri: c.avatar_url }} style={s.avatar} />
                    ) : (
                      <View style={[s.avatar, s.avatarFallback]}>
                        <Ionicons name="planet" size={18} color="#14B8A6" />
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.name} numberOfLines={1}>{c.name}</Text>
                      <Text style={s.slug}>@{c.slug} • {c.member_count} üye</Text>
                    </View>
                    {busy ? (
                      <AppLoader size="small" color="#14B8A6" />
                    ) : isAttached ? (
                      <View style={s.attachedBadge}>
                        <Ionicons name="checkmark" size={12} color="#14B8A6" />
                        <Text style={s.attachedText}>Eklendi</Text>
                      </View>
                    ) : (
                      <View style={s.addBadge}>
                        <Ionicons name="add" size={14} color="#FFF" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={s.hint}>
              ℹ️ Ekleyince bu oda Koronun ana sayfasında ve üyelere keşfette öne çıkar.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  cta: { borderRadius: 14, overflow: 'hidden' },
  ctaGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  ctaIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaTitle: { fontSize: 14, fontWeight: '900', color: '#FFF', letterSpacing: 0.3, ...Shadows.text },
  ctaSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  dialog: {
    width: '88%', maxWidth: 380,
    borderRadius: 18, overflow: 'hidden',
    paddingBottom: 12,
    borderWidth: 1, borderColor: Colors.cardBorder,
    ...Shadows.card,
  },
  dialogHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.teal },
  headerTitle: { flex: 1, fontSize: 12, fontWeight: '900', color: '#CBD5E1', letterSpacing: 1.2, textTransform: 'uppercase' },
  cancel: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 9, paddingHorizontal: 14,
  },
  avatar: { width: 36, height: 36, borderRadius: 10 },
  avatarFallback: {
    backgroundColor: 'rgba(20,184,166,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: 13, fontWeight: '800', color: '#F1F5F9', ...Shadows.textLight },
  slug: { fontSize: 10.5, color: '#94A3B8', marginTop: 1 },
  attachedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(20,184,166,0.15)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.4)',
  },
  attachedText: { fontSize: 10, fontWeight: '900', color: '#14B8A6', letterSpacing: 0.3 },
  addBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#14B8A6',
    alignItems: 'center', justifyContent: 'center',
  },
  hint: {
    fontSize: 10.5, color: '#94A3B8',
    paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4,
    lineHeight: 15,
  },
});
