// SopranoChat — SP Geçmişi Bottom Sheet
// - Swipe-to-dismiss (handle/header alanından aşağı çek)
// - Realtime: sp_transactions INSERT dinleyicisi açık iken canlı güncelleme
// - Altın premium tema (wallet ile tutarlı)

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, ScrollView, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { supabase } from '../../constants/supabase';
import { useAuth } from '../../app/_layout';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

// Reason → Türkçe etiket
// ★ 2026-04-21: donation_sent/received, referral_bonus_* eklendi (gerçek DB type'ları).
function spReasonLabel(reason: string | undefined): string {
  const map: Record<string, string> = {
    daily_login: 'Günlük giriş',
    prime_time_return: 'Prime-time dönüş',
    stage_time: 'Sahne süresi',
    room_create: 'Oda oluşturma',
    referral_reward: 'Davet ödülü',
    referral_bonus: 'Davet bonusu',
    referral_bonus_owner: 'Davet bonusu (sen davet ettin)',
    referral_bonus_referred: 'Davet bonusu (seni davet eden)',
    gift_received: 'Hediye alındı',
    gift_sent: 'Hediye gönderildi',
    donation_sent: 'SP gönderdin',
    donation_received: 'SP aldın',
    donation_refund: 'SP iadesi (alıcı alamadı)',
    room_boost: 'Oda boost',
    profile_boost: 'Profil boost',
    store_purchase: 'Mağaza alışverişi',
    subscription_bonus: 'Abonelik bonusu',
    achievement: 'Başarım',
    admin_grant: 'Admin ödülü',
    refund: 'İade',
  };
  if (!reason) return 'SP işlemi';
  // Admin bypass etiketleri (örn. "store_purchase [ADMIN]")
  const clean = reason.replace(/\s*\[ADMIN.*\]\s*/, '').trim();
  return map[clean] || clean || 'SP işlemi';
}

function spReasonIcon(reason: string | undefined, isPositive: boolean): { name: any; color: string } {
  const map: Record<string, { name: string; color: string }> = {
    daily_login:        { name: 'sunny',        color: '#FBBF24' },
    prime_time_return:  { name: 'time',         color: '#F59E0B' },
    stage_time:         { name: 'mic',          color: '#14B8A6' },
    room_create:        { name: 'radio',        color: '#A855F7' },
    referral_reward:    { name: 'people',       color: '#A78BFA' },
    referral_bonus:          { name: 'people', color: '#A78BFA' },
    referral_bonus_owner:    { name: 'people', color: '#A78BFA' },
    referral_bonus_referred: { name: 'people', color: '#A78BFA' },
    gift_received:      { name: 'gift',         color: '#22C55E' },
    gift_sent:          { name: 'gift-outline', color: '#EF4444' },
    donation_received:  { name: 'diamond',      color: '#22C55E' },
    donation_sent:      { name: 'diamond-outline', color: '#EF4444' },
    donation_refund:    { name: 'arrow-undo',   color: '#3B82F6' },
    room_boost:         { name: 'rocket',       color: '#F472B6' },
    profile_boost:      { name: 'rocket',       color: '#F472B6' },
    store_purchase:     { name: 'cart',         color: '#F59E0B' },
    subscription_bonus: { name: 'star',         color: '#D4AF37' },
    achievement:        { name: 'trophy',       color: '#FBBF24' },
    admin_grant:        { name: 'shield-checkmark', color: '#DC2626' },
    refund:             { name: 'arrow-undo',   color: '#3B82F6' },
  };
  if (!reason) return isPositive ? { name: 'trending-up', color: '#22C55E' } : { name: 'trending-down', color: '#EF4444' };
  const clean = reason.replace(/\s*\[ADMIN.*\]\s*/, '').trim();
  const entry = map[clean];
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

  // ★ Swipe-to-dismiss — Reanimated useSharedValue + GestureDetector
  const translateY = useSharedValue(0);

  // Modal açılınca pozisyonu sıfırla
  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(10)           // aşağı 10px+ hareket edince aktif olur
    .failOffsetX([-30, 30])      // yatay hareket 30px+ ise gesture iptal
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      const shouldDismiss = e.translationY > 80 || e.velocityY > 800;
      if (shouldDismiss) {
        translateY.value = withTiming(600, { duration: 200 }, () => {
          runOnJS(handleDismiss)();
          translateY.value = 0;
        });
      } else {
        translateY.value = withSpring(0, { damping: 14, stiffness: 120 });
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[s.card, animatedCardStyle]}
          collapsable={false}
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

          {/* ★ Gesture tüm kartta aktif — GestureDetector parent'te */}
          <View>
            <View style={s.handleWrap}>
              <View style={s.handle} />
            </View>
            <View style={s.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="diamond" size={16} color="#FBBF24" style={iconShadow} />
                <View>
                  <Text style={s.title}>SP GEÇMİŞİM</Text>
                  <Text style={s.subtitle}>Son 30 işlem · Canlı</Text>
                </View>
              </View>
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
              // ★ 2026-04-21: DB column'u `type` (önceden `tx.reason` yazılıyordu → undefined → kategoriler kırıktı)
              const txType = tx.type || tx.reason; // backward compat
              const iconDef = spReasonIcon(txType, isPositive);
              const isFresh = flashId === tx.id;
              // Description enrichment — örn. "Mağaza: 100 SP Paketi" veya "Ayşe'den" (v51 counterparty)
              const rawDesc = typeof tx.description === 'string' ? tx.description.trim() : '';
              // "SP kazanıldı: xxx" / "SP harcandı: xxx" prefix'ini ayıkla (generic log)
              const cleanDesc = rawDesc.replace(/^SP (kazan[ıi]ld[ıi]|harcand[ıi]|):\s*/i, '').replace(/^SP:\s*/i, '').trim();
              const isGenericDesc = !cleanDesc || cleanDesc === txType || cleanDesc === 'donation_sent' || cleanDesc === 'donation_received';
              // Counterparty adı (v51 sonrası tx.counterparty_name dolabilir)
              const counterpartyName = tx.counterparty_name || tx.partner?.display_name;
              const subline = isGenericDesc
                ? (counterpartyName ? (isPositive ? `${counterpartyName} gönderdi` : `${counterpartyName}'e gönderdin`) : '')
                : cleanDesc;
              return (
                <View key={tx.id || i} style={[s.row, isFresh && s.rowFresh]}>
                  <View style={[s.iconWrap, { backgroundColor: `${iconDef.color}18`, borderColor: `${iconDef.color}33` }]}>
                    <Ionicons name={iconDef.name} size={16} color={iconDef.color} style={iconShadow} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.reason} numberOfLines={1}>{spReasonLabel(txType)}</Text>
                    {!!subline && (
                      <Text style={s.subline} numberOfLines={1}>{subline}</Text>
                    )}
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
        </GestureDetector>
      </View>
      </GestureHandlerRootView>
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
  // ★ Swipe handle — kapatma için üst çubuk (geniş dokunma alanı)
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: -4,
    marginBottom: -6,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(251,191,36,0.5)',
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
  subline: { fontSize: 11, color: 'rgba(226,232,240,0.75)', marginTop: 2, fontWeight: '500' },
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
