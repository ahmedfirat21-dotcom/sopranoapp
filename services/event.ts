import { supabase } from '../constants/supabase';
import { Profile, RoomService } from './database';

export type EventCategory = 'Sohbet' | 'Müzik' | 'Tartışma' | 'Oyun' | 'Eğitim' | 'Diğer';
export type RsvpStatus = 'going' | 'interested' | 'declined';

export type EventModel = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  category: string;
  scheduled_at: string;
  duration_minutes: number;
  max_participants: number | null;
  cover_image_url: string | null;
  room_id: string | null;
  is_cancelled: boolean;
  ticket_price_coins: number;
  is_paid: boolean;
  max_attendees: number | null;
  created_at: string;
  host?: Profile;
};

export type EventRsvp = {
  id: string;
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  created_at: string;
  user?: Profile;
};

export const EventService = {
  /** Yeni etkinlik oluştur */
  async create(data: Partial<EventModel>) {
    const { data: event, error } = await supabase
      .from('events')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return event as EventModel;
  },

  /** Yaklaşan etkinlikleri getir */
  async getUpcoming(limit: number = 10) {
    const { data, error } = await supabase
      .from('events')
      .select('*, host:profiles!host_id(*)')
      .gte('scheduled_at', new Date().toISOString())
      .eq('is_cancelled', false)
      .order('scheduled_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data as EventModel[];
  },

  /** Kullanıcının katıldığı veya düzenlediği etkinlikleri getir */
  async getMyEvents(userId: string) {
    // Katılımcısı olduğu etkinlikler
    const { data: rsvps, error: rsvpError } = await supabase
      .from('event_rsvps')
      .select('event_id')
      .eq('user_id', userId)
      .in('status', ['going', 'interested']);
    
    if (rsvpError) throw rsvpError;
    const eventIds = rsvps?.map(r => r.event_id) || [];

    // Kendi düzenledikleri VEYA katıldıkları
    const { data, error } = await supabase
      .from('events')
      .select('*, host:profiles!host_id(*)')
      .or(`host_id.eq.${userId},id.in.(${eventIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)
      .order('scheduled_at', { ascending: true });
    
    if (error) throw error;
    return data as EventModel[];
  },

  /** Etkinlik detayını getir */
  async getById(eventId: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*, host:profiles!host_id(*)')
      .eq('id', eventId)
      .single();
    if (error) throw error;
    return data as EventModel;
  },

  /** Toplam Katılımcı Sayısı Geitir (getRsvpCount) */
  async getRsvpCount(eventId: string, status: RsvpStatus = 'going'): Promise<number> {
    const { count, error } = await supabase
      .from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', status);
    if (error) throw error;
    return count || 0;
  },

  /** Tüm LCV (RSVP) listesini getir */
  async getEventRsvps(eventId: string) {
    const { data, error } = await supabase
      .from('event_rsvps')
      .select('*, user:profiles!user_id(*)')
      .eq('event_id', eventId);
    if (error) throw error;
    return data as EventRsvp[];
  },

  /** LCV Durumunu güncelle (Katıl, İlgileniyorum, İptal) */
  async rsvp(eventId: string, userId: string, status: RsvpStatus) {
    // Upsert mantığı kullanacağız
    const { data, error } = await supabase
      .from('event_rsvps')
      .upsert(
        { event_id: eventId, user_id: userId, status },
        { onConflict: 'event_id,user_id' }
      )
      .select()
      .single();
    if (error) throw error;
    return data as EventRsvp;
  },

  /** Kullanıcının katılım durumunu çek (Mevcut etkinliğe daha önce rsvp yaptı mı) */
  async getUserRsvp(eventId: string, userId: string): Promise<RsvpStatus | null> {
    const { data, error } = await supabase
      .from('event_rsvps')
      .select('status')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();
    
    // PGRST116 is "Results contain 0 rows, single() expects 1" -> Ignore for this check
    if (error && error.code !== 'PGRST116') throw error;
    return data?.status as RsvpStatus | null;
  },

  /** İptal et (Sil) */
  async cancelRsvp(eventId: string, userId: string) {
    const { error } = await supabase
      .from('event_rsvps')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  },

  /** Saati geldiğinde odayı otomatik yaratma mantığı */
  async startEventRoom(eventId: string, userId: string) {
    const event = await this.getById(eventId);
    if (!event) throw new Error("Etkinlik bulunamadı.");

    // Zaten oda açıldıysa direkt room_id dön
    if (event.room_id) {
       return event.room_id;
    }

    // Room kategori mapping
    const categoryMap: Record<string, string> = {
      'Sohbet': 'chat',
      'Müzik': 'music',
      'Oyun': 'game',
      // diğerleri için genel fallback
      'Tartışma': 'chat',
      'Eğitim': 'tech',
      'Diğer': 'chat'
    };

    const roomCategory = categoryMap[event.category] || 'chat';

    // Oda oluştur
    const newRoom = await RoomService.create(userId, {
      name: event.title,
      description: event.description || `${event.category} etkinliği`,
      category: roomCategory,
      type: 'open'
    });

    // Etkinliğin room_id'sini güncelle
    const { error } = await supabase
      .from('events')
      .update({ room_id: newRoom.id })
      .eq('id', eventId);

    if (error) {
      console.error("Etkinlik güncellenirken hata oluştu:", error);
    }

    return newRoom.id;
  }
};
