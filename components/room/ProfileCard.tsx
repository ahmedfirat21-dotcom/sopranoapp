import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';
import { COLORS, W } from './constants';

type ProfileCardProps = {
  nick: string;
  role: string;
  avatarUrl?: string;
  isOwnProfile?: boolean;
  isChatMuted?: boolean;
  onClose: () => void;
  onMute?: () => void;
  onKick?: () => void;
  onRemoveFromStage?: () => void;
  onPromoteToStage?: () => void;
  onChatMute?: () => void;
  onMakeModerator?: () => void;
  onReport?: () => void;
  onBlock?: () => void;
  onViewProfile?: () => void;
  onFollow?: () => void;
  onDM?: () => void;
};

export default function ProfileCard({
  nick, role, avatarUrl, isOwnProfile, isChatMuted,
  onClose, onMute, onKick, onRemoveFromStage, onPromoteToStage,
  onChatMute, onMakeModerator, onReport, onBlock,
  onViewProfile, onFollow, onDM,
}: ProfileCardProps) {
  const roleLabel = role === 'host' ? 'Oda Sahibi' : role === 'moderator' ? 'Moderatör' : role === 'speaker' ? 'Konuşmacı' : 'Dinleyici';
  return (
    <View style={styles.profileOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={[styles.profileAvatar, role === 'host' && { borderColor: COLORS.vipGold }, role === 'moderator' && { borderColor: '#8B5CF6' }]}>
            {avatarUrl ? (
              <Image source={getAvatarSource(avatarUrl)} style={{ width: '100%', height: '100%', borderRadius: 23 }} />
            ) : (
              <Text style={styles.profileInitials}>{nick.slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.profileNick}>{nick}</Text>
            <Text style={styles.profileRole}>{roleLabel}</Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        </View>

        {isOwnProfile ? (
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(92,225,230,0.1)', borderWidth: 1, borderColor: 'rgba(92,225,230,0.2)' }}
              onPress={onViewProfile}
            >
              <Ionicons name="person-circle-outline" size={18} color={COLORS.primary} />
              <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '700' }}>Profili Görüntüle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(92,225,230,0.1)', borderWidth: 1, borderColor: 'rgba(92,225,230,0.2)' }}
                onPress={onFollow}
              >
                <Ionicons name="person-add" size={14} color={COLORS.primary} />
                <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '600' }}>Takip Et</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                onPress={onDM}
              >
                <Ionicons name="chatbubble-ellipses" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' }}>DM Gönder</Text>
              </TouchableOpacity>
            </View>

            {/* Sahne Yönetimi */}
            {(onPromoteToStage || onRemoveFromStage) && (
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                {onPromoteToStage && (
                  <TouchableOpacity style={[styles.profileBtn, { flex: 1, backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)' }]} onPress={onPromoteToStage}>
                    <Ionicons name="arrow-up-circle" size={16} color="#10B981" />
                    <Text style={[styles.profileBtnText, { color: '#10B981' }]}>Sahneye Al</Text>
                  </TouchableOpacity>
                )}
                {onRemoveFromStage && (
                  <TouchableOpacity style={[styles.profileBtn, { flex: 1 }]} onPress={onRemoveFromStage}>
                    <Ionicons name="arrow-down-circle" size={16} color="#FBBF24" />
                    <Text style={styles.profileBtnText}>İndir</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Host/Mod Moderasyon İşlemleri */}
            <View style={styles.profileActions}>
              {onMute && (
                <TouchableOpacity style={styles.profileBtn} onPress={onMute}>
                  <Ionicons name="volume-mute" size={16} color="#F59E0B" />
                  <Text style={[styles.profileBtnText, { color: '#F59E0B' }]}>Ses Sustur</Text>
                </TouchableOpacity>
              )}
              {onChatMute && (
                <TouchableOpacity style={[styles.profileBtn, { borderColor: isChatMuted ? 'rgba(16,185,129,0.2)' : 'rgba(249,115,22,0.2)' }]} onPress={onChatMute}>
                  <Ionicons name={isChatMuted ? 'chatbox' : 'chatbox-outline'} size={16} color={isChatMuted ? '#10B981' : '#F97316'} />
                  <Text style={[styles.profileBtnText, { color: isChatMuted ? '#10B981' : '#F97316' }]}>{isChatMuted ? 'Yazı Aç' : 'Yazı Kapat'}</Text>
                </TouchableOpacity>
              )}
              {onKick && (
                <TouchableOpacity style={[styles.profileBtn, { borderColor: 'rgba(239,68,68,0.2)' }]} onPress={onKick}>
                  <Ionicons name="exit" size={16} color={COLORS.error} />
                  <Text style={[styles.profileBtnText, { color: COLORS.error }]}>Çıkar</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Moderatör Yap/Kaldır */}
            {onMakeModerator && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingVertical: 8, borderRadius: 10, backgroundColor: role === 'moderator' ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.04)', borderWidth: 1, borderColor: role === 'moderator' ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.1)' }}
                onPress={onMakeModerator}
              >
                <Ionicons name="shield" size={14} color="#8B5CF6" />
                <Text style={{ color: '#8B5CF6', fontSize: 11, fontWeight: '700' }}>{role === 'moderator' ? 'Moderatörlüğü Kaldır' : 'Moderatör Yap'}</Text>
              </TouchableOpacity>
            )}

            {/* Şikayet Et & Engelle */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              {onReport && (
                <TouchableOpacity 
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
                  onPress={onReport}
                >
                  <Ionicons name="flag" size={13} color="#94A3B8" />
                  <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '600' }}>Şikayet Et</Text>
                </TouchableOpacity>
              )}
              {onBlock && (
                <TouchableOpacity 
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.04)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.1)' }}
                  onPress={onBlock}
                >
                  <Ionicons name="ban" size={13} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '600' }}>Engelle</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', zIndex: 200,
  },
  profileCard: {
    width: W * 0.82, backgroundColor: 'rgba(16,24,42,0.95)',
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  profileAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  profileInitials: { color: '#fff', fontSize: 16, fontWeight: '700' },
  profileNick: { color: '#fff', fontSize: 15, fontWeight: '700' },
  profileRole: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  profileActions: { flexDirection: 'row', gap: 8 },
  profileBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  profileBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
});
