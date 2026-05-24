/**
 * SopranoChat — Destek & İletişim Ekranı (v300)
 * ═══════════════════════════════════════════════════════════════════
 * Kullanıcı uygulama içinden destek talebi gönderir: kategori seçer,
 * konu + mesaj yazar, Gönder'e basar. DB'ye düşer, web admin paneline
 * gerçek zamanlı yansır.
 *
 * Tasarım: NotificationDrawer aile dili (slate diagonal + teal halo +
 * soft glow), modal/sheet ile tutarlı.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeGoBack } from '../constants/navigation';
import { Colors } from '../constants/theme';
import AppBackground from '../components/AppBackground';
import { showToast } from '../components/Toast';
import PurchaseSuccessModal from '../components/PurchaseSuccessModal';
import { useAuth } from './_layout';
import { SupportService, type SupportCategory, type SupportTicket } from '../services/support';
import { useTranslation } from '../services/i18n';

const CATEGORIES: { key: SupportCategory; icon: string; labelTr: string; descTr: string; color: string }[] = [
  { key: 'bug',        icon: 'bug',                  labelTr: 'Hata Bildir',     descTr: 'Uygulamada bir sorunla karşılaştın',      color: '#EF4444' },
  { key: 'suggestion', icon: 'lightbulb-on',         labelTr: 'Öneri',           descTr: 'Eklenmesini istediğin bir özellik',       color: '#FBBF24' },
  { key: 'complaint',  icon: 'alert-octagon',        labelTr: 'Şikayet',         descTr: 'Hoşuna gitmeyen bir durum',               color: '#F472B6' },
  { key: 'question',   icon: 'help-circle',          labelTr: 'Soru',            descTr: 'Sormak istediğin bir şey',                color: '#14B8A6' },
  { key: 'other',      icon: 'message-text',         labelTr: 'Diğer',           descTr: 'Yukarıdakilerden hiçbiri uymadıysa',      color: '#A78BFA' },
];

export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, firebaseUser } = useAuth();
  const { t: _t } = useTranslation();

  const [category, setCategory] = useState<SupportCategory>('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  // ★ v1.7.13.69 (20 May 2026): Geçmiş taleplerim — kullanıcı önceki taleplerinin durumunu görür.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Sheet açılışta talep sayısını öğrenmek için lazy fetch (toggle açılınca yapılır)
  const loadHistory = useCallback(async () => {
    if (!firebaseUser?.uid || historyLoaded) return;
    setHistoryLoading(true);
    try {
      const list = await SupportService.getMyTickets(firebaseUser.uid);
      setTickets(list);
      setHistoryLoaded(true);
    } catch {
      // sessiz
    } finally {
      setHistoryLoading(false);
    }
  }, [firebaseUser?.uid, historyLoaded]);

  // Yeni talep gönderildikten sonra history cache'ini invalidate et
  useEffect(() => {
    if (success) setHistoryLoaded(false);
  }, [success]);

  const selectedCat = CATEGORIES.find(c => c.key === category) || CATEGORIES[0];

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!firebaseUser?.uid) {
      showToast({ title: 'Giriş Gerekli', message: 'Önce hesabına gir.', type: 'error' });
      return;
    }
    const sub = subject.trim();
    const msg = message.trim();
    if (sub.length < 3) {
      showToast({ title: 'Konu Eksik', message: 'En az 3 karakter konu yaz.', type: 'warning' });
      return;
    }
    if (msg.length < 10) {
      showToast({ title: 'Mesaj Eksik', message: 'Sorunu / öneriyi en az 10 karakterle anlat.', type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await SupportService.submitTicket({
        userId: firebaseUser.uid,
        displayName: profile?.display_name || profile?.username || null,
        email: (firebaseUser as any).email || null,
        category,
        subject: sub,
        message: msg,
      });
      if (!result.success) {
        showToast({ title: 'Gönderilemedi', message: result.error || 'Bilinmeyen hata', type: 'error' });
        return;
      }
      // Başarılı — kutlama modali aç, alanları temizle, kısa süre sonra geri dön
      setSuccess(true);
      setSubject('');
      setMessage('');
    } catch (e: any) {
      showToast({ title: 'Hata', message: e?.message || 'Beklenmedik hata', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [submitting, firebaseUser, profile, category, subject, message]);

  return (
    <AppBackground variant="profile" radialGlow>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => safeGoBack(router)} style={s.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#F1F5F9" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Destek & İletişim</Text>
            <Text style={s.headerSub}>Bize yaz — okuyup yanıtlıyoruz</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ★ v1.7.13.69 (20 May 2026): Geçmiş Taleplerim — kapalı durumda toggle header,
              açılınca getMyTickets + liste. */}
          <Pressable
            style={historyStyles.headerRow}
            onPress={() => {
              const next = !historyOpen;
              setHistoryOpen(next);
              if (next) loadHistory();
            }}
          >
            <Ionicons name="archive-outline" size={16} color={Colors.teal} />
            <Text style={historyStyles.headerText}>Geçmiş Taleplerim</Text>
            {historyLoaded && tickets.length > 0 && (
              <View style={historyStyles.countPill}>
                <Text style={historyStyles.countText}>{tickets.length}</Text>
              </View>
            )}
            <Ionicons name={historyOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
          </Pressable>

          {historyOpen && (
            <View style={historyStyles.listBox}>
              {historyLoading ? (
                <Text style={historyStyles.muted}>Yükleniyor…</Text>
              ) : tickets.length === 0 ? (
                <Text style={historyStyles.muted}>Henüz talebin yok.</Text>
              ) : (
                tickets.slice(0, 10).map((t) => {
                  const cat = CATEGORIES.find(c => c.key === t.category);
                  const statusMap: Record<string, { label: string; color: string }> = {
                    new: { label: 'Yeni', color: '#94A3B8' },
                    read: { label: 'Okundu', color: '#3B82F6' },
                    in_progress: { label: 'İşleniyor', color: '#FBBF24' },
                    resolved: { label: 'Çözüldü', color: '#22C55E' },
                    closed: { label: 'Kapatıldı', color: '#64748B' },
                  };
                  const st = statusMap[t.status] || statusMap.new;
                  return (
                    <View key={t.id} style={historyStyles.ticket}>
                      <View style={historyStyles.ticketHead}>
                        <MaterialCommunityIcons
                          name={(cat?.icon as any) || 'message-text'}
                          size={14}
                          color={cat?.color || '#94A3B8'}
                        />
                        <Text style={historyStyles.ticketSubject} numberOfLines={1}>{t.subject}</Text>
                        <View style={[historyStyles.statusPill, { borderColor: st.color + '66', backgroundColor: st.color + '22' }]}>
                          <Text style={[historyStyles.statusText, { color: st.color }]}>{st.label}</Text>
                        </View>
                      </View>
                      <Text style={historyStyles.ticketDate}>
                        {new Date(t.created_at).toLocaleDateString(i18n.locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                      {t.admin_response && (
                        <View style={historyStyles.responseBox}>
                          <Ionicons name="chatbubble-ellipses-outline" size={12} color="#5EEAD4" />
                          <Text style={historyStyles.responseText}>{t.admin_response}</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
              {tickets.length > 10 && (
                <Text style={historyStyles.muted}>+{tickets.length - 10} daha eski talep</Text>
              )}
            </View>
          )}

          {/* Kategori seçici */}
          <Text style={s.sectionLabel}>Konu Tipi</Text>
          <View style={s.categoryGrid}>
            {CATEGORIES.map((c) => {
              const active = c.key === category;
              return (
                <Pressable
                  key={c.key}
                  style={[s.categoryCard, active && { borderColor: c.color + 'aa' }]}
                  onPress={() => setCategory(c.key)}
                  hitSlop={4}
                >
                  <LinearGradient
                    colors={active
                      ? [c.color + '33', c.color + '0a']
                      : ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <MaterialCommunityIcons name={c.icon as any} size={22} color={active ? c.color : 'rgba(241,245,249,0.55)'} />
                  <Text style={[s.categoryLabel, active && { color: c.color }]} numberOfLines={1}>
                    {c.labelTr}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Aktif kategori açıklaması */}
          <View style={s.descBox}>
            <Ionicons name="information-circle" size={14} color={selectedCat.color} />
            <Text style={s.descText}>{selectedCat.descTr}</Text>
          </View>

          {/* Konu input */}
          <Text style={s.sectionLabel}>Konu</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="Kısa başlık (en az 3, en fazla 120 karakter)"
              placeholderTextColor="rgba(148,163,184,0.6)"
              value={subject}
              onChangeText={setSubject}
              maxLength={120}
              returnKeyType="next"
            />
            <Text style={s.charCount}>{subject.length}/120</Text>
          </View>

          {/* Mesaj textarea */}
          <Text style={s.sectionLabel}>Mesajın</Text>
          <View style={[s.inputWrap, { minHeight: 160 }]}>
            <TextInput
              style={[s.input, s.textarea]}
              placeholder="Detayları yazabildiğin kadar yaz — ekran görüntüsü/durum/cihaz bilgisi faydalı olur."
              placeholderTextColor="rgba(148,163,184,0.6)"
              value={message}
              onChangeText={setMessage}
              maxLength={2000}
              multiline
              textAlignVertical="top"
            />
            <Text style={s.charCount}>{message.length}/2000</Text>
          </View>

          {/* Privacy not */}
          <View style={s.privacyNote}>
            <Ionicons name="shield-checkmark" size={12} color="rgba(94,234,212,0.7)" />
            <Text style={s.privacyText}>
              Mesajın sadece SopranoChat destek ekibine iletilir. Hesap bilgilerin
              (kullanıcı adı, sürüm) otomatik eklenir.
            </Text>
          </View>

          {/* Gönder butonu */}
          <Pressable
            style={[s.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <LinearGradient
              colors={['#14B8A6', '#0E7490']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name={submitting ? 'hourglass' : 'send'} size={16} color="#F0FDFA" />
            <Text style={s.submitText}>{submitting ? 'Gönderiliyor…' : 'Gönder'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Başarılı modali — Plus/Pro ile aynı dil */}
      <PurchaseSuccessModal
        visible={success}
        title="Talebin Alındı"
        subtitle="Destek ekibimiz en kısa sürede dönüş yapacak."
        accent={['#14B8A6', '#0E7490']}
        autoHideMs={2800}
        onClose={() => {
          setSuccess(false);
          safeGoBack(router);
        }}
      />
    </AppBackground>
  );
}

// ★ v1.7.13.69 (20 May 2026): Geçmiş Taleplerim stilleri
const historyStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.06)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.18)',
  },
  headerText: {
    flex: 1,
    fontSize: 13, fontWeight: '700', color: '#E2E8F0',
    letterSpacing: 0.2,
  },
  countPill: {
    paddingHorizontal: 7, paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(94,234,212,0.18)',
    borderWidth: 1, borderColor: 'rgba(94,234,212,0.35)',
  },
  countText: {
    fontSize: 10, fontWeight: '800', color: '#5EEAD4', letterSpacing: 0.4,
  },
  listBox: {
    marginTop: 6, gap: 8,
  },
  muted: {
    fontSize: 11, color: 'rgba(148,163,184,0.7)',
    textAlign: 'center', paddingVertical: 14,
  },
  ticket: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  ticketHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  ticketSubject: {
    flex: 1,
    fontSize: 12, fontWeight: '700', color: '#F1F5F9',
  },
  statusPill: {
    paddingHorizontal: 7, paddingVertical: 1.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 9, fontWeight: '800', letterSpacing: 0.4,
  },
  ticketDate: {
    fontSize: 10, color: 'rgba(148,163,184,0.7)',
  },
  responseBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: 4,
    paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(94,234,212,0.06)',
    borderWidth: 1, borderColor: 'rgba(94,234,212,0.15)',
  },
  responseText: {
    flex: 1,
    fontSize: 11, color: '#CBD5E1', lineHeight: 16, fontStyle: 'italic',
  },
});

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    gap: 10,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  headerSub: {
    fontSize: 11, color: 'rgba(148,163,184,0.85)', marginTop: 1,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: 'rgba(94,234,212,0.85)',
    letterSpacing: 1.5, marginTop: 16, marginBottom: 8,
    textTransform: 'uppercase',
  },
  categoryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  categoryCard: {
    flexBasis: '48%',
    height: 72,
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  categoryLabel: {
    fontSize: 12, fontWeight: '700', color: 'rgba(241,245,249,0.85)',
  },
  descBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingHorizontal: 4,
  },
  descText: {
    flex: 1,
    fontSize: 11, color: 'rgba(148,163,184,0.85)', fontStyle: 'italic',
  },
  inputWrap: {
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12, paddingVertical: 10,
    position: 'relative',
  },
  input: {
    fontSize: 13, color: '#F1F5F9',
    paddingVertical: 4,
  },
  textarea: {
    minHeight: 130,
    paddingTop: 4,
  },
  charCount: {
    position: 'absolute',
    right: 8, bottom: 4,
    fontSize: 9, color: 'rgba(148,163,184,0.55)',
    fontWeight: '600',
  },
  privacyNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: 16, paddingHorizontal: 4,
  },
  privacyText: {
    flex: 1,
    fontSize: 10.5, color: 'rgba(148,163,184,0.75)', lineHeight: 14,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    height: 48, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.55)',
    overflow: 'hidden',
  },
  submitText: {
    fontSize: 14, fontWeight: '800', color: '#F0FDFA', letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
});
