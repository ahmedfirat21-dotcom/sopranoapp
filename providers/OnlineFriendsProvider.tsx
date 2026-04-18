/**
 * SopranoChat — Online Friends Provider
 * ★ DUP-3 FIX: Online arkadaş durumunu merkezileştirir.
 * Önceden home.tsx ve messages.tsx ayrı ayrı `profiles` tablosuna Realtime kanal
 * açıyordu. Artık tek kanal burada açılır, her iki sayfa context'ten okur.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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

  // ★ Realtime: Arkadaşların online/offline durumu — TEK KANAL
  // Dep: sadece userId — allFriends değişince subscription yeniden kurulmaz (loop riski yok)
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`friends-online-status:${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
      }, (payload) => {
        const updated = payload.new as any;
        if (!updated?.id || !currentFriendIdsRef.current.includes(updated.id)) return;
        if (blockedIdsRef.current.has(updated.id)) return;

        setAllFriends(prev => prev.map(f =>
          f.id === updated.id ? { ...f, is_online: updated.is_online } : f
        ));

        setOnlineFriends(prev => {
          const wasOnline = prev.some(f => f.id === updated.id);
          if (updated.is_online && !wasOnline) {
            setAllFriends(currentFriends => {
              const friend = currentFriends.find(f => f.id === updated.id);
              if (friend) {
                setOnlineFriends(op =>
                  op.some(o => o.id === updated.id)
                    ? op
                    : [{ ...friend, is_online: true }, ...op]
                );
              }
              return currentFriends;
            });
            return prev;
          } else if (!updated.is_online && wasOnline) {
            return prev.filter(f => f.id !== updated.id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return (
    <OnlineFriendsContext.Provider value={{ allFriends, onlineFriends, friendIds, blockedIds, blockedIdsRef, refreshFriends }}>
      {children}
    </OnlineFriendsContext.Provider>
  );
}
