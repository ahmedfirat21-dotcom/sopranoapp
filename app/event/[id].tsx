import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Spacing, Gradients } from '../../constants/theme';
import { EventService, type EventModel, type EventRsvp, type RsvpStatus } from '../../services/event';
import { useAuth } from '../_layout';
import { showToast } from '../../components/Toast';

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const [event, setEvent] = useState<EventModel | null>(null);
  const [rsvps, setRsvps] = useState<EventRsvp[]>([]);
  const [myRsvp, setMyRsvp] = useState<RsvpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id, profile]);

  const loadData = async () => {
    if (!id || !profile) return;
    try {
      const e = await EventService.getById(id);
      const rList = await EventService.getEventRsvps(id);
      const myStatus = await EventService.getUserRsvp(id, profile.id);
      setEvent(e);
      setRsvps(rList);
      setMyRsvp(myStatus);
    } catch (err) {
      console.warn("Etkinlik detayı getirilemedi:", err);
      showToast({ title: 'Hata', message: 'Etkinlik bilgileri yüklenemedi.', type: 'error' });
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleRsvp = async (status: RsvpStatus) => {
    if (!id || !profile) return;
    setProcessing(true);
    try {
      if (myRsvp === status) {
        // Zaten aynısıysa iptal et
        await EventService.cancelRsvp(id, profile.id);
        setMyRsvp(null);
        showToast({ title: 'İptal Edildi', message: 'Katılım durumunuz kaldırıldı.', type: 'info' });
      } else {
        await EventService.rsvp(id, profile.id, status);
        setMyRsvp(status);
        showToast({ title: 'Başarılı', message: status === 'going' ? 'Etkinliğe katılıyorsunuz!' : 'Etkinlik için ilgileniyorum dediniz.', type: 'success' });
      }
      
      // RSVP listesini tazeleyelim
      const rList = await EventService.getEventRsvps(id);
      setRsvps(rList);
    } catch (err) {
      showToast({ title: 'Hata', message: 'İşlem gerçekleştirilemedi.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleJoinAutoRoom = async () => {
    if (!event || !profile) return;
    setProcessing(true);
    try {
      const roomId = await EventService.startEventRoom(event.id, profile.id);
      showToast({ title: 'Bağlanılıyor', message: 'Etkinlik odasına giriliyor.', type: 'success' });
      router.push(`/room/${roomId}`);
    } catch (err: any) {
      showToast({ title: 'Hata', message: err.message || 'Odaya bağlanılamadı.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !event) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.teal} />
      </View>
    );
  }

  const isHost = profile?.id === event.host_id;
  const evDate = new Date(event.scheduled_at);
  const now = new Date();
  
  // Etkinlik vaktine geldi mi veya geçti mi? (Şu anki zamandan 5-10 dk önce bile izin verebiliriz ama basit tutalım)
  const isTimeArrived = now.getTime() >= evDate.getTime() - (5 * 60 * 1000); // 5 dk tolerans

  const goingRsvps = rsvps.filter(r => r.status === 'going');

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Cover Image */}
        <View style={styles.coverWrap}>
          <Image 
            source={{ uri: event.cover_image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80' }} 
            style={styles.coverImage} 
          />
          <LinearGradient colors={['transparent', Colors.bg]} style={styles.coverGradient} />
          
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>

          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeMonth}>{evDate.toLocaleString('tr-TR', { month: 'short' }).toUpperCase()}</Text>
            <Text style={styles.dateBadgeDay}>{evDate.getDate()}</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Category */}
          <Text style={styles.categoryText}>{event.category.toUpperCase()}</Text>

          {/* Title */}
          <Text style={styles.title}>{event.title}</Text>

          {/* Time & Duration Info */}
          <View style={styles.timeRow}>
            <Ionicons name="time" size={20} color={Colors.teal} />
            <Text style={styles.timeText}>
              {evDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} • {event.duration_minutes} Dakika
            </Text>
          </View>

          {/* Host Info */}
          <Pressable style={styles.hostCard} onPress={() => router.push(`/user/${event.host_id}`)}>
            <Image source={{ uri: event.host?.avatar_url || 'https://i.pravatar.cc/100?img=1' }} style={styles.hostAvatar} />
            <View style={styles.hostInfo}>
              <Text style={styles.hostLabel}>Düzenleyen (Host)</Text>
              <Text style={styles.hostName}>{event.host?.display_name || 'Gizli Kullanıcı'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text3} />
          </Pressable>

          {/* Description */}
          {event.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hakkında</Text>
              <Text style={styles.descText}>{event.description}</Text>
            </View>
          ) : null}

          {/* Attendees */}
          <View style={styles.section}>
            <View style={styles.attendeeHeader}>
              <Text style={styles.sectionTitle}>Katılımcılar</Text>
              <Text style={styles.attendeeCount}>{goingRsvps.length} Kişi Gidiyor</Text>
            </View>
            {goingRsvps.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attendeeScroll}>
                {goingRsvps.map((rsvp) => (
                  <View key={rsvp.id} style={styles.attendeeAvatarWrap}>
                    <Image source={{ uri: rsvp.user?.avatar_url || 'https://i.pravatar.cc/80' }} style={styles.attendeeAvatar} />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>Henüz kimse katılmıyor. İlk sen ol!</Text>
            )}
          </View>

        </View>
      </ScrollView>

      {/* Floating Action Bar */}
      <View style={styles.bottomBar}>
        {isTimeArrived ? (
          <Pressable 
            style={[styles.joinBtn, processing && { opacity: 0.7 }]} 
            onPress={handleJoinAutoRoom}
            disabled={processing}
          >
            {processing ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name={event.room_id ? "log-in" : "play"} size={22} color="#fff" />
                <Text style={styles.joinBtnText}>{event.room_id ? 'Odaya Katıl' : 'Odayı Başlat'}</Text>
              </>
            )}
          </Pressable>
        ) : (
          <View style={styles.rsvpRow}>
            {/* TODO: PushNotificationService.scheduleLocalNotification(event.id, evDate.getTime() - 15*60000, "Yaklaşan Etkinlik!") */}
            <Pressable 
              style={[styles.rsvpBtn, myRsvp === 'going' && styles.rsvpBtnActiveG]} 
              onPress={() => handleRsvp('going')}
              disabled={processing}
            >
              <Ionicons name="checkmark-circle" size={20} color={myRsvp === 'going' ? '#fff' : Colors.teal} />
              <Text style={[styles.rsvpBtnText, myRsvp === 'going' && { color: '#fff' }]}>Katılacağım</Text>
            </Pressable>

            <Pressable 
              style={[styles.rsvpBtnOutline, myRsvp === 'interested' && styles.rsvpBtnActiveI]} 
              onPress={() => handleRsvp('interested')}
              disabled={processing}
            >
              <Ionicons name="star" size={20} color={myRsvp === 'interested' ? '#fff' : Colors.amber} />
              <Text style={[styles.rsvpBtnTextOutline, myRsvp === 'interested' && { color: '#fff' }]}>İlgileniyorum</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  
  coverWrap: { width: '100%', height: 300, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverGradient: { position: 'absolute', bottom: 0, width: '100%', height: 150 },
  
  backBtn: { position: 'absolute', top: 50, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  
  dateBadge: { position: 'absolute', right: 20, bottom: 20, backgroundColor: 'rgba(20,184,166,0.9)', borderRadius: Radius.default, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.teal },
  dateBadgeMonth: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  dateBadgeDay: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: -2 },

  content: { padding: 20 },
  categoryText: { fontSize: 13, fontWeight: '700', color: Colors.teal, letterSpacing: 1, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  timeText: { fontSize: 16, fontWeight: '600', color: Colors.text },

  hostCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg3, padding: 12, borderRadius: Radius.default, marginBottom: 24, borderWidth: 1, borderColor: Colors.glassBorder },
  hostAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  hostInfo: { flex: 1 },
  hostLabel: { fontSize: 12, color: Colors.text3, marginBottom: 2 },
  hostName: { fontSize: 15, fontWeight: '700', color: Colors.text },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  descText: { fontSize: 15, color: Colors.text2, lineHeight: 24 },
  
  attendeeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  attendeeCount: { fontSize: 13, fontWeight: '600', color: Colors.teal },
  attendeeScroll: { flexDirection: 'row' },
  attendeeAvatarWrap: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: Colors.bg, marginLeft: -15, backgroundColor: Colors.bg4, overflow: 'hidden' },
  attendeeAvatar: { width: '100%', height: '100%' },
  emptyText: { color: Colors.text3, fontSize: 14, fontStyle: 'italic' },

  bottomBar: { position: 'absolute', bottom: 0, width: '100%', padding: 20, paddingTop: 16, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.glassBorder },
  
  joinBtn: { flexDirection: 'row', backgroundColor: Colors.teal, paddingVertical: 16, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', gap: 8 },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  rsvpRow: { flexDirection: 'row', gap: 12 },
  rsvpBtn: { flex: 1, flexDirection: 'row', backgroundColor: Colors.teal + '20', borderWidth: 1, borderColor: Colors.teal + '50', paddingVertical: 14, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', gap: 6 },
  rsvpBtnActiveG: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  rsvpBtnText: { color: Colors.teal, fontSize: 14, fontWeight: '700' },

  rsvpBtnOutline: { flex: 1, flexDirection: 'row', backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.amber + '50', paddingVertical: 14, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', gap: 6 },
  rsvpBtnActiveI: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  rsvpBtnTextOutline: { color: Colors.amber, fontSize: 14, fontWeight: '700' },
});
