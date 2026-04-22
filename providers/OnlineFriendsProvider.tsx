/**
 * SopranoChat — Online Friends Provider
 * ★ DUP-3 FIX: Online arkadaş durumunu merkezileştirir.
 * Önceden home.tsx ve messages.tsx ayrı ayrı `profiles` tablosuna Realtime kanal
 * açıyordu. Artık tek kanal burada açılır, her iki sayfa context'ten okur.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { FriendshipService, type FollowUser } from '../services/friendship';
import { ModerationService } from '../services/moderation';
import { supabase } from '../constants/supabase';

type OnlineFriendsContextType = {
  /** Tüm takip ettiklerim (accepted) */
  allFriends: FollowUser[];
  /** Sadece online olanlar */
  onlineFriends: FollowUser[];
  /** Takip ettiğim kişilerin ID set'i (arama butonu vs. için) */
  friendIds: Set<string>;
  /** Engellenen kullanıcı ID set'i */
  blockedIds: Set<string>;
  /** Engellenen ref (realtime closure için) */
  blockedIdsRef: React.MutableRefObject<Set<string>>;
  /** Manuel yenileme */
  refreshFriends: () => Promise<void>;
};

const OnlineFriendsContext = createContext<OnlineFriendsContextType>({
  allFriends: [],
  onlineFriends: [],
  friendIds: new Set(),
  blockedIds: new Set(),
  blockedIdsRef: { current: new Set() },
  refreshFriends: async () => {},
});

export function useOnlineFriends() {
  return useContext(OnlineFriendsContext);
}

export function OnlineFriendsProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const [allFriends, setAllFriends] = useState<FollowUser[]>([]);
  const [onlineFriends, setOnlineFriends] = useState<FollowUser[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const blockedIdsRef = useRef<Set<string>>(new Set());

  const refreshFriends = useCallback(async () => {
    if (!userId) return;
    try {
      // ★ Facebook tarzı arkadaşlık refactor: getFriends() bidirectional accepted
      // union döner; eski getFollowing + getFollowers birleştirme silindi.
      const [friends, blocked] = await Promise.all([
        FriendshipService.getFriends(userId),
        ModerationService.getBlockedUsers(userId),
      ]);
      const blockedSet = new Set(blocked);
      setBlockedIds(blockedSet);
      blockedIdsRef.current = blockedSet;

      const filtered: FollowUser[] = friends.filter((f: FollowUser) => f.id !== userId && !blockedSet.has(f.id));
      // Online olanlar en üste
      filtered.sort((a, b) => (b.is_online ? 1 : 0) - (a.is_online ? 1 : 0));

      setAllFriends(filtered);
      setOnlineFriends(filtered.filter((f: FollowUser) => f.is_online));
      setFriendIds(new Set(filtered.map((f: FollowUser) => f.id)));
    } catch (e) {
      if (__DEV__) console.warn('[OnlineFriends] Load error:', e);
    }
  }, [userId]);

  // İlk yükleme
  useEffect(() => {
    if (!userId) {
      setAllFriends([]);
      setOnlineFriends([]);
      setFriendIds(new Set());
      setBlockedIds(new Set());
      blockedIdsRef.current = new Set();
      return;
    }
    refreshFriends();
  }, [userId, refreshFriends]);

  // Ref ile güncel friend ID listesi — subscription closure'ını yeniden oluşturmadan güncellenir
  const currentFriendIdsRef = useRef<string[]>([]);
  useEffect(() => {
    currentFriendIdsRef.current = allFriends.map(f => f.id);
  }, [allFriends]);

  // ★ 2026-04-20 FIX: Bidirectional friendship realtime — karşı taraf unfriend
  //   yaptığında (veya kabul ettiğinde) senin listende de anında yansısın.
  //   Iki ayrı subscription: user_id=me ve friend_id=me. Herhangi bir değişim
  //   refreshFriends'i tetikler → liste yeniden DB'den çekilir.
  useEffect(() => {
    if (!userId) return;
    const outSub = supabase
      .channel(`friendships-out:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `user_id=eq.${userId}`,
      }, () => { refreshFriends().catch(() => {}); })
      .subscribe();
    const inSub = supabase
      .channel(`friendships-in:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `friend_id=eq.${userId}`,
      }, () => { refreshFriends().catch(() => {}); })
      .subscribe();
    return () => {
      supabase.removeChannel(outSub);
      supabase.removeChannel(inSub);
    };
  }, [userId, refreshFriends]);

  // ★ Supabase Presence: Gerçek zamanlı online durumu.
  //   profiles.is_online kolonu casual browsing'de güncellenmiyordu (yalnızca
  //   oda/arama event'lerinde). Presence her app foreground olan kullanıcıyı
  //   anında online işaretler; arkadaş listesiyle kesişim online listesini verir.
  //   postgres_changes fallback olarak kalıyor (is_online=true'nun DB'de kalıcı
  //   olarak işaretli olduğu durumlar için — ör. başka cihazda hâlâ açık).
  const onlinePresenceIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!userId) return;

    // Global shared presence channel — tüm kullanıcılar burada kendilerini track eder.
    // Kanal anahtarı userId; presence event'leri join/leave'de tetiklenir.
    const presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: userId } },
    });

    const recomputeOnline = () => {
      const state = presenceChannel.presenceState();
      const ids = new Set<string>();
      Object.keys(state).forEach(k => ids.add(k));
      onlinePresenceIdsRef.current = ids;

      setAllFriends(prev => {
        const next = prev.map(f => {
          const isLiveOnline = ids.has(f.id) || f.is_online;
          return f.is_online === isLiveOnline ? f : { ...f, is_online: isLiveOnline };
        });
        // Online friends listesi — tıklı olan sona, online olan başa
        const onlines = next.filter(f => ids.has(f.id) || f.is_online);
        onlines.sort((a, b) => (ids.has(b.id) ? 1 : 0) - (ids.has(a.id) ? 1 : 0));
        setOnlineFriends(onlines);
        return next;
      });
    };

    presenceChannel
      .on('presence', { event: 'sync' }, recomputeOnline)
      .on('presence', { event: 'join' }, recomputeOnline)
      .on('presence', { event: 'leave' }, recomputeOnline)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
      }, (payload) => {
        const updated = payload.new as any;
        const old = payload.old as any;
        if (!updated?.id || !currentFriendIdsRef.current.includes(updated.id)) return;
        if (blockedIdsRef.current.has(updated.id)) return;
        // ★ 2026-04-20 OPT: is_online gerçekten değişmedi ise render atla — avatar_url vb.
        //   update'leri boşuna friend list re-render tetiklemesin.
        if (old && old.is_online === updated.is_online && old.avatar_url === updated.avatar_url && old.display_name === updated.display_name) return;
        setAllFriends(prev => prev.map(f =>
          f.id === updated.id ? { ...f, is_online: updated.is_online || onlinePresenceIdsRef.current.has(f.id), avatar_url: updated.avatar_url ?? f.avatar_url, display_name: updated.display_name ?? f.display_name } : f
        ));
        recomputeOnline();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await presenceChannel.track({ userId, online_at: new Date().toISOString() });
          } catch (e) {
            if (__DEV__) console.warn('[Presence] track error:', e);
          }
        }
      });

    // AppState: uygulama background'a gidince untrack, foreground olunca tekrar track.
    const appStateSub = AppState.addEventListener('change', async (next) => {
      try {
        if (next === 'active') {
          await presenceChannel.track({ userId, online_at: new Date().toISOString() });
        } else if (next === 'background' || next === 'inactive') {
          await presenceChannel.untrack();
        }
      } catch {/* silent */}
    });

    return () => {
      appStateSub.remove();
      try { presenceChannel.untrack(); } catch {}
      supabase.removeChannel(presenceChannel);
    };
  }, [userId]);

  return (
    <OnlineFriendsContext.Provider value={{ allFriends, onlineFriends, friendIds, blockedIds, blockedIdsRef, refreshFriends }}>
      {children}
    </OnlineFriendsContext.Provider>
  );
}
