// ★ v1.7.13.115 (20 May 2026): Yeni Üyeler carousel
// Son 7 gün kayıt olan kullanıcıları home'da gösterir. Tıkla → profil sheet.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatusAvatar from './StatusAvatar';
import { NewMembersService, type NewMember } from '../services/newMembers';

interface Props {
  onPressUser: (userId: string) => void;
}

export default function NewMembersCarousel({ onPressUser }: Props) {
  const [members, setMembers] = useState<NewMember[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await NewMembersService.getRecent(12);
      setMembers(list);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading || members.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.leafIcon}>🌱</Text>
          <Text style={styles.title}>Yeni Sopranolular</Text>
          <View style={styles.countDot} />
          <Text style={styles.countText}>{members.length}</Text>
        </View>
        <Text style={styles.subtitle}>Son 7 gün kayıt olan üyeler — selam vermek ister misin?</Text>
      </View>

      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPressUser(item.id)}
            style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            <View style={styles.avatarWrap}>
              <StatusAvatar
                uri={item.avatar_url}
                size={52}
                isOnline={item.is_online}
                tier={item.subscription_tier as any}
                frameId={item.active_frame}
                customBadgeId={item.active_badge_id}
              />
              <View style={styles.newBadge}>
                <Ionicons name="sparkles" size={8} color="#fff" />
              </View>
            </View>
            <Text style={styles.name} numberOfLines={1}>{item.display_name}</Text>
            <Text style={styles.daysOld}>
              {item.days_old === 0 ? i18n.t('notifications.today') : item.days_old === 1 ? i18n.t('notifications.yesterday') : i18n.t('notifications.days_ago', { 0: item.days_old })}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 6,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leafIcon: { fontSize: 14 },
  title: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  countDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: '#10B981',
    marginLeft: 6,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 3,
  },
  countText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginLeft: 5,
    textShadowColor: 'rgba(16,185,129,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: 72,
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  newBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0A0F1A',
  },
  name: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    maxWidth: 70,
    textAlign: 'center',
  },
  daysOld: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 1,
  },
});
