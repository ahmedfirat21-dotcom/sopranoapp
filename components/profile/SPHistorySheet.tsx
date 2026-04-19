// SopranoChat — SP Geçmişi Bottom Sheet
// - Swipe-to-dismiss (handle/header alanından aşağı çek)
// - Realtime: sp_transactions INSERT dinleyicisi açık iken canlı güncelleme
// - Altın premium tema (wallet ile tutarlı)

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, ScrollView, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../constants/supabase';
import { useAuth } from '../../app/_layout';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

// Reason → Türkçe etiket
function spReasonLabel(reason: string | undefined): string {
  const map: Record<string, string> = {
    daily_login: 'Günlük giriş',
    prime_time_return: 'Prime-time dönüş',
    stage_time: 'Sahne süresi',
    room_create: 'Oda oluşturma',
    referral_reward: 'Davet ödülü',
    gift_received: 'Hediye alındı',
    gift_sent: 'Hediye gönderildi',
    room_boost: 'Oda boost',
    profile_boost: 'Profil boost',
    store_purchase: 'Mağaza alışverişi',
    subscription_bonus: 'Abonelik bonusu',
    achievement: 'Başarım',
    admin_grant: 'Admin ödülü',
    refund: 'İade',
  };
  return map[reason || ''] || reason || 'SP işlemi';
}

function spReasonIcon(reason: string | undefined, isPositive: boolean): { name: any; color: string } {
  const map: Record<string, { name: string; color: string }> = {
    daily_login:        { name: 'sunny',        color: '#FBBF24' },
    prime_time_return:  { name: 'time',         color: '#F59E0B' },
    stage_time:         { name: 'mic',          color: '#14B8A6' },
    room_create:        { name: 'radio',        color: '#A855F7' },
    referral_reward:    { name: 'people',       color: '#A78BFA' },
    gift_received:      { name: 'gift',         color: '#22C55E' },
    gift_sent:          { name: 'gift-outline', color: '#EF4444' },
    room_boost:         { name: 'rocket',       color: '#F472B6' },
    profile_boost:      { name: 'rocket',       color: '#F472B6' },
    store_purchase:     { name: 'cart',         color: '#F59E0B' },
    subscription_bonus: { name: 'star',         color: '#D4AF37' },
    achievement:        { name: 'trophy',       color: '#FBBF24' },
    admin_grant:        { name: 'shield-checkmark', color: '#DC2626' },
    refund:             { name: 'arrow-undo',   color: '#3B82F6' },
  };
  const entry = map[reason || ''];
  if (entry) return entry;
  return isPositive
    ? { name: 'trending-up',   color: '#22C55E' }
    : { name: 'trending-down', color: '#EF4444' };
}

interface Props {
  visible: boolean;
  onClose: () => void;
  balance: number;
  history: any[];
}

export default function SPHistorySheet({ visible, onClose, balance, history: initialHistory }: Props) {
  const { firebaseUser } = useAuth();
  const [history, setHistory] = useState<any[]>(initialHistory);
  const [flashId, setFlashId] = useState<string | null>(null);

  // Props değiştiğinde local state güncelle
  useEffect(() => { setHistory(initialHistory); }, [initialHistory]);

  // ★ Realtime: modal açıkken yeni SP işlemi gelirse anında listeye ekle + flash
  useEffect(() => {
    if (!visible || !firebaseUser) return;
    const channel = supabase
      .channel(`sp_tx_sheet:${firebaseUser.uid}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'sp_transactions',
        filter: `user_id=eq.${firebaseUser.uid}`,
      }, (payload) => {
        const newTx = payload.new as any;
        setHistory(prev => {
          if (prev.some(t => t.id === newTx.id)) return prev;
          return [newTx, ...prev].slice(0, 30);
        });
        setFlashId(newTx.id);
        setTimeout(() => setFlashId(null), 1500);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [visible, firebaseUser]);

  // ★ Swipe-to-dismiss
  const { translateValue, panHandlers } = useSwipeToDismiss({
    direction: 'down',
    threshold: 90,
    onDismiss: onClose,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Animated.View
          style={[s.card, { transform: [{ translateY: translateValue }] }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Arkaplan katmanları — parlak taraf belirgin */}
          <LinearGradient
            colors={['#2a1e14', '#17100a', '#0a0604']}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['rgba(251,191,36,0.28)', 'rgba(251,191,36,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['transparent', 'rgba(251,191,36,0.9)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
          />

          {/* ★ Swipe-able başlık alanı — handle + header panHandlers aldığı alanda aşağı çekilince kapanır */}
          <View {...panHandlers}>
            <View style={s.dragHandle} />
            <View style={s.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="diamond" size={16} color="#FBBF24" style={iconShadow} />
                <View>
                  <Text style={s.title}>SP GEÇMİŞİM</Text>
                  <Text style={s.subtitle}>Son 30 işlem · Canlı</Text>
                </View>
              </View>
              <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
                <Ionicons name="close" size={18} color="rgba(251,191,36,0.8)" style={iconShadow} />
              </Pressable>
            </View>

            <View style={s.balanceStrip}>
              <Text style={s.balanceLabel}>Güncel Bakiye</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={s.balanceAmount}>{balance.toLocaleString('tr-TR')}</Text>
                <Text style={s.balanceCurrency}>SP</Text>
              </View>
            </View>
          </View>

          {/* ★ Liste — kendi scroll alanı, swipe gesture pan area'yı geçmez */}
          <ScrollView
            style={{ maxHeight: 380 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {history.length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="receipt-outline" size={44} color="rgba(251,191,36,0.25)" style={iconShadow} />
                <Text style={s.emptyText}>Henüz işlem yok</Text>
                <Text style={s.emptySub}>Oda aç, sahneye çık — kazanmaya başla</Text>
              </View>
            ) : history.map((tx: any, i: number) => {
              const isPositive = (tx.amount || 0) > 0;
              const iconDef = spReasonIcon(tx.reason, isPositive);
              const isFresh = flashId === tx.id;
              return (
                <View key={tx.id || i} style={[s.row, isFresh && s.rowFresh]}>
                  <View style={[s.iconWrap, { backgroundColor: `${iconDef.color}18`, borderColor: `${iconDef.color}33` }]}>
                    <Ionicons name={iconDef.name} size={16} color={iconDef.color} style={iconShadow} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.reason} numberOfLines={1}>{spReasonLabel(tx.reason)}</Text>
                    <Text style={s.date}>
                      {new Date(tx.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={[s.amount, { color: isPositive ? '#FFD700' : '#EF4444' }]}>
                    {isPositive ? '+' : ''}{tx.amount}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  card: {
    width: '100%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.3)',
    borderBottomWidth: 0,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24,
    maxHeight: SCREEN_HEIGHT * 0.78,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.6, shadowRadius: 20, elevation: 20,
  },
  topEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(251,191,36,0.35)',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 14,
  },
  title: {
    fontSize: 13, fontWeight: '900', color: '#FBBF24', letterSpacing: 1.2,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 10, fontWeight: '600', color: 'rgba(251,191,36,0.55)',
    marginTop: 1, letterSpacing: 0.3,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 11,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  balanceStrip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderRadius: 12,
    borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.2)',
    marginBottom: 14,
  },
  balanceLabel: {
    fontSize: 10, fontWeight: '700', color: 'rgba(251,191,36,0.55)',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  balanceAmount: {
    fontSize: 20, fontWeight: '900', color: '#FFD700',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  balanceCurrency: {
    fontSize: 11, fontWeight: '800', color: 'rgba(251,191,36,0.65)',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 11, paddingHorizontal: 2,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(251,191,36,0.08)',
  },
  rowFresh: {
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderRadius: 10,
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  reason: {
    fontSize: 13, fontWeight: '700', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  date: { fontSize: 10, color: 'rgba(148,163,184,0.65)', marginTop: 1, fontWeight: '500' },
  amount: {
    fontSize: 15, fontWeight: '900', letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  emptyWrap: {
    paddingVertical: 50, alignItems: 'center', gap: 8,
  },
  emptyText: {
    fontSize: 14, fontWeight: '700', color: 'rgba(251,191,36,0.7)',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  emptySub: {
    fontSize: 12, color: 'rgba(203,213,225,0.45)', fontWeight: '500',
  },
});
