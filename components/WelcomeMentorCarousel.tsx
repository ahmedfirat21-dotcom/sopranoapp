// ★ v1.7.13.112 (20 May 2026): Karşılama Pilotları carousel
// Yeni kullanıcı (kayıt < 24h) home'da görür — gönüllü mentor host'ları tanıt.
// Tek tıkla "Hepsini Takip Et" → ilk gün toplu mentor bağlantısı.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import StatusAvatar from './StatusAvatar';
import { WelcomeHostService, type WelcomeHost } from '../services/welcomeHost';
import { FollowService } from '../services/follows';
import { showToast } from './Toast';
import { i18n } from '../services/i18n';

interface Props {
  currentUserId: string;
  onPressUser?: (userId: string) => void;
}

const STORAGE_KEY = '@welcome_mentors_dismissed';

export default function WelcomeMentorCarousel({ currentUserId, onPressUser }: Props) {
  const [hosts, setHosts] = useState<WelcomeHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingAll, setFollowingAll] = useState(false);
  const [followedSet, setFollowedSet] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);

  // Mount: hostları çek + dismiss state'ini kontrol et
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const wasDismissed = await AsyncStorage.getItem(STORAGE_KEY);
        if (wasDismissed === '1') {
          if (!cancelled) { setDismissed(true); setLoading(false); }
          return;
        }
        const result = await WelcomeHostService.getWelcomeHosts(5);
        if (!cancelled) {
          setHosts(result.filter(h => h.id !== currentUserId));
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUserId]);

  const handleFollowOne = useCallback(async (hostId: string) => {
    setFollowedSet(prev => new Set(prev).add(hostId));
    try {
      const r = await FollowService.addFollow(currentUserId, hostId);
      if (!r.success) {
        showToast({ title: i18n.t('mentor.follow_error'), message: r.error || 'Tekrar dene', type: 'error' });
        setFollowedSet(prev => { const s = new Set(prev); s.delete(hostId); return s; });
      }
    } catch (e: any) {
      showToast({ title: 'Hata', message: e?.message || 'Tekrar dene', type: 'error' });
      setFollowedSet(prev => { const s = new Set(prev); s.delete(hostId); return s; });
    }
  }, [currentUserId]);

  const handleFollowAll = useCallback(async () => {
    if (followingAll) return;
    setFollowingAll(true);
    try {
      const results = await Promise.allSettled(
        hosts
          .filter(h => !followedSet.has(h.id))
          .map(h => FollowService.addFollow(currentUserId, h.id))
      );
      const ok = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.success).length;
      setFollowedSet(new Set(hosts.map(h => h.id)));
      showToast({
        title: i18n.t('mentor.completed'),
        message: ok > 0 ? `${ok} pilot takip edildi — odalarına davet alacaksın!` : 'Zaten hepsini takip ediyorsun',
        type: 'success',
      });
    } catch (e: any) {
      showToast({ title: 'Hata', message: e?.message || 'Tekrar dene', type: 'error' });
    } finally {
      setFollowingAll(false);
    }
  }, [hosts, currentUserId, followedSet, followingAll]);

  const handleDismiss = useCallback(async () => {
    setDismissed(true);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem(STORAGE_KEY, '1');
    } catch {}
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#5EEAD4" />
      </View>
    );
  }

  if (dismissed || hosts.length === 0) return null;

  const allFollowed = hosts.every(h => followedSet.has(h.id));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(94,234,212,0.10)', 'rgba(13,148,136,0.04)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="rocket" size={16} color="#5EEAD4" />
            <Text style={styles.title}>Karşılama Pilotları</Text>
            <View style={styles.newBadge}><Text style={styles.newBadgeText}>YENİ</Text></View>
          </View>
          <Pressable onPress={handleDismiss} hitSlop={10}>
            <Ionicons name="close" size={18} color="#64748B" />
          </Pressable>
        </View>

        <Text style={styles.subtitle}>
          Sopranochat'e yeni katıldın — deneyimli host'ları takip ederek aralarına karış.
        </Text>

        <FlatList
          data={hosts}
          keyExtractor={(h) => h.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.hostCard}>
              <Pressable onPress={() => onPressUser?.(item.id)} hitSlop={4}>
                <StatusAvatar
                  uri={item.avatar_url}
                  size={56}
                  isOnline={item.is_online}
                  tier={item.subscription_tier as any}
                  frameId={item.active_frame}
                  customBadgeId={item.active_badge_id}
                />
              </Pressable>
              <Text style={styles.hostName} numberOfLines={1}>{item.display_name}</Text>
              {item.streak_days >= 3 && (
                <Text style={styles.streakLine}>🔥 {item.streak_days} gün</Text>
              )}
              <Pressable
                onPress={() => !followedSet.has(item.id) && handleFollowOne(item.id)}
                style={[
                  styles.followBtn,
                  followedSet.has(item.id) && styles.followBtnDone,
                ]}
              >
                {followedSet.has(item.id) ? (
                  <>
                    <Ionicons name="checkmark" size={12} color="#5EEAD4" />
                    <Text style={[styles.followBtnText, { color: '#5EEAD4' }]}>Takipte</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="add" size={12} color="#fff" />
                    <Text style={styles.followBtnText}>Takip Et</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        />

        {!allFollowed && (
          <Pressable
            onPress={handleFollowAll}
            disabled={followingAll}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            <LinearGradient
              colors={['#0D9488', '#0F766E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              {followingAll ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="people" size={14} color="#fff" />
                  <Text style={styles.ctaText}>Hepsini Takip Et</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.20)',
  },
  center: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  gradient: { padding: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  newBadge: {
    backgroundColor: 'rgba(94,234,212,0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 2,
  },
  newBadgeText: {
    color: '#5EEAD4',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  listContent: {
    paddingVertical: 4,
    gap: 14,
  },
  hostCard: {
    alignItems: 'center',
    width: 80,
  },
  hostName: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    maxWidth: 76,
    textAlign: 'center',
  },
  streakLine: {
    color: '#FCD34D',
    fontSize: 10,
    marginTop: 2,
  },
  followBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(13,148,136,0.8)',
  },
  followBtnDone: {
    backgroundColor: 'rgba(94,234,212,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.35)',
  },
  followBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  cta: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  ctaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
