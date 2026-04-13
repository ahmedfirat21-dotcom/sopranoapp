/**
 * FollowListModal — X.com/Instagram tarzı Takipçi/Takip Edilen Listesi
 * Profil sayfasındaki Takipçi/Takip sayılarına tıklandığında açılır.
 * Her satırda: Unfollow, Çıkar (Remove), Engelle aksiyonları.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, FlatList,
  Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FriendshipService, type FollowUser } from '../services/friendship';
import { getAvatarSource } from '../constants/avatars';
import PremiumAlert, { type AlertButton } from './PremiumAlert';
import { useRouter } from 'expo-router';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;          // Profili görüntülenen kullanıcı
  currentUserId: string;   // Giriş yapan kullanıcı
  initialTab: 'followers' | 'following';
  isOwnProfile: boolean;
}

export default function FollowListModal({
  visible, onClose, userId, currentUserId, initialTab, isOwnProfile,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'followers' | 'following'>(initialTab);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cAlert, setCAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });

  useEffect(() => { setTab(initialTab); }, [initialTab]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [f1, f2] = await Promise.all([
        FriendshipService.getFollowers(userId),
        FriendshipService.getFollowing(userId),
      ]);
      setFollowers(f1);
      setFollowing(f2);
    } catch (e) {
      if (__DEV__) console.warn('[FollowList] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (visible) loadData();
  }, [visible, loadData]);

  const list = tab === 'followers' ? followers : following;

  // ★ Aksiyonlar
  const handleRemoveFollower = (targetId: string, name: string) => {
    setCAlert({
      visible: true,
      title: 'Takipçiyi Çıkar',
      message: `${name} artık seni takip etmesin mi?`,
      type: 'warning',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkar', style: 'destructive', onPress: async () => {
            setActionLoading(targetId);
            const result = await FriendshipService.removeFollower(userId, targetId);
            if (result.success) {
              setFollowers(prev => prev.filter(f => f.id !== targetId));
            }
            setActionLoading(null);
          }
        },
      ],
    });
  };

  const handleUnfollow = async (targetId: string) => {
    setActionLoading(targetId);
    // ★ BUG-F3 FIX: currentUserId kullan (profil sahibi değil, giriş yapan kullanıcı)
    const result = await FriendshipService.unfollow(currentUserId, targetId);
    if (result.success) {
      setFollowing(prev => prev.filter(f => f.id !== targetId));
    }
    setActionLoading(null);
  };

  const handleBlock = (targetId: string, name: string) => {
    setCAlert({
      visible: true,
      title: 'Engelle',
      message: `${name} engellensin mi?`,
      type: 'error',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Engelle', style: 'destructive', onPress: async () => {
            setActionLoading(targetId);
            const result = await FriendshipService.block(currentUserId, targetId);
            if (result.success) {
              setFollowers(prev => prev.filter(f => f.id !== targetId));
              setFollowing(prev => prev.filter(f => f.id !== targetId));
            }
            setActionLoading(null);
          }
        },
      ],
    });
  };

  const navigateToProfile = (targetId: string) => {
    onClose();
    setTimeout(() => router.push(`/user/${targetId}` as any), 200);
  };

  const renderItem = ({ item }: { item: FollowUser }) => {
    const isActioning = actionLoading === item.id;
    const isMe = item.id === currentUserId;

    return (
      <Pressable
        style={({ pressed }) => [st.row, pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }]}
        onPress={() => navigateToProfile(item.id)}
      >
        <Image source={getAvatarSource(item.avatar_url)} style={st.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={st.name} numberOfLines={1}>{item.display_name}</Text>
          {item.username && <Text style={st.username}>@{item.username}</Text>}
        </View>

        {/* Aksiyonlar — sadece kendi profili ve kendisi değilse */}
        {isOwnProfile && !isMe && (
          <View style={st.actions}>
            {isActioning ? (
              <ActivityIndicator size="small" color="#14B8A6" />
            ) : tab === 'followers' ? (
              <>
                <Pressable
                  style={st.removeBtn}
                  onPress={() => handleRemoveFollower(item.id, item.display_name)}
                >
                  <Text style={st.removeBtnText}>Çıkar</Text>
                </Pressable>
                <Pressable
                  style={st.blockBtn}
                  onPress={() => handleBlock(item.id, item.display_name)}
                  hitSlop={6}
                >
                  <Ionicons name="ban" size={14} color="#EF4444" />
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={st.unfollowBtn}
                  onPress={() => handleUnfollow(item.id)}
                >
                  <Text style={st.unfollowBtnText}>Takipten Çık</Text>
                </Pressable>
                <Pressable
                  style={st.blockBtn}
                  onPress={() => handleBlock(item.id, item.display_name)}
                  hitSlop={6}
                >
                  <Ionicons name="ban" size={14} color="#EF4444" />
                </Pressable>
              </>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={st.overlay}>
        <View style={st.sheet}>
          {/* Header */}
          <View style={st.header}>
            <View style={{ width: 28 }} />
            <View style={st.tabs}>
              <Pressable
                style={[st.tab, tab === 'followers' && st.tabActive]}
                onPress={() => setTab('followers')}
              >
                <Text style={[st.tabText, tab === 'followers' && st.tabTextActive]}>
                  Takipçiler ({followers.length})
                </Text>
              </Pressable>
              <Pressable
                style={[st.tab, tab === 'following' && st.tabActive]}
                onPress={() => setTab('following')}
              >
                <Text style={[st.tabText, tab === 'following' && st.tabTextActive]}>
                  Takip ({following.length})
                </Text>
              </Pressable>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Liste */}
          {loading ? (
            <View style={st.loading}>
              <ActivityIndicator size="large" color="#14B8A6" />
            </View>
          ) : list.length === 0 ? (
            <View style={st.empty}>
              <Ionicons name="people-outline" size={36} color="rgba(255,255,255,0.1)" />
              <Text style={st.emptyText}>
                {tab === 'followers' ? 'Henüz takipçi yok' : 'Henüz kimse takip edilmiyor'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={list}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
      <PremiumAlert {...cAlert} onDismiss={() => setCAlert(prev => ({ ...prev, visible: false }))} />
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '75%',
    minHeight: '50%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
    justifyContent: 'center',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: 'rgba(20,184,166,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.3)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#14B8A6',
  },
  loading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  username: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  removeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  unfollowBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(20,184,166,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.2)',
  },
  unfollowBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#14B8A6',
  },
  blockBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
