import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Radius, Spacing } from '../constants/theme';
import { EventService, type EventCategory } from '../services/event';
import { useAuth } from './_layout';
import { showToast } from '../components/Toast';

const CATEGORIES: EventCategory[] = ['Sohbet', 'Müzik', 'Tartışma', 'Oyun', 'Eğitim', 'Diğer'];

export default function CreateEventScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('Sohbet');
  const [date, setDate] = useState(new Date(Date.now() + 86400000)); // Default: tomorrow
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [duration, setDuration] = useState('60'); // Minutes
  const [ticketPrice, setTicketPrice] = useState(0); // 0 = ücretsiz
  const [loading, setLoading] = useState(false);

  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      // Keep existing time, update date
      const newDate = new Date(date);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDate(newDate);
    }
  };

  const onChangeTime = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDate = new Date(date);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setDate(newDate);
    }
  };

  const handleCreate = async () => {
    if (!profile) return;
    if (!title.trim()) {
      showToast({ title: 'Hata', message: 'Etkinlik başlığı zorunludur.', type: 'error' });
      return;
    }
    if (date.getTime() < Date.now()) {
      showToast({ title: 'Hata', message: 'Geçmiş bir tarihe etkinlik planlayamazsınız.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const result = await EventService.create({
        host_id: profile.id,
        title,
        description,
        category,
        scheduled_at: date.toISOString(),
        duration_minutes: parseInt(duration) || 60,
        ticket_price_coins: ticketPrice,
        is_paid: ticketPrice > 0,
      });

      showToast({ title: 'Başarılı', message: 'Etkinlik başarıyla oluşturuldu!', type: 'success' });
      router.replace(`/event/${result.id}` as any);
    } catch (error) {
      console.warn('Etkinlik oluşturma hatası:', error);
      showToast({ title: 'Hata', message: 'Etkinlik oluşturulamadı.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Yeni Etkinlik</Text>
        <Pressable onPress={handleCreate} disabled={loading} style={[styles.createBtn, loading && { opacity: 0.5 }]}>
          {loading ? <ActivityIndicator size="small" color={Colors.teal} /> : <Text style={styles.createBtnText}>Oluştur</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Etkinlik Başlığı</Text>
          <TextInput
            style={styles.input}
            placeholder="Ne yapıyoruz?"
            placeholderTextColor={Colors.text3}
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />
        </View>

        {/* Category */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Kategori</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {CATEGORIES.map(c => (
              <Pressable 
                key={c}
                style={[styles.categoryBadge, category === c && styles.categoryActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.categoryText, category === c && styles.categoryActiveText]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Date & Time */}
        <View style={styles.dateTimeContainer}>
          <View style={[styles.inputGroup, { flex: 1, paddingRight: 8 }]}>
            <Text style={styles.label}>Tarih</Text>
            <Pressable style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar" size={18} color={Colors.teal} />
              <Text style={styles.dateText}>{date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</Text>
            </Pressable>
          </View>
          
          <View style={[styles.inputGroup, { flex: 1, paddingLeft: 8 }]}>
            <Text style={styles.label}>Saat</Text>
            <Pressable style={styles.datePickerBtn} onPress={() => setShowTimePicker(true)}>
              <Ionicons name="time" size={18} color={Colors.teal} />
              <Text style={styles.dateText}>{date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </Pressable>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker value={date} mode="date" display="default" onChange={onChangeDate} minimumDate={new Date()} />
        )}
        {showTimePicker && (
          <DateTimePicker value={date} mode="time" display="default" onChange={onChangeTime} />
        )}

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Açıklama (Opsiyonel)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Etkinlik hakkında bilgi ver..."
            placeholderTextColor={Colors.text3}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Duration */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Süre (Dakika)</Text>
          <TextInput
            style={styles.input}
            placeholder="60"
            placeholderTextColor={Colors.text3}
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>

        {/* Bilet Bedeli */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Giriş Ücreti (Soprano Coin)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {[0, 5, 10, 25, 50].map(price => (
              <Pressable
                key={price}
                style={[styles.categoryBadge, ticketPrice === price && styles.categoryActive]}
                onPress={() => setTicketPrice(price)}
              >
                <Text style={[styles.categoryText, ticketPrice === price && styles.categoryActiveText]}>
                  {price === 0 ? 'Ücretsiz' : `${price} SC`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {ticketPrice > 0 && (
            <Text style={{ color: Colors.text3, fontSize: 11, marginTop: 6, marginLeft: 4 }}>
              Katılımcılar giriş için {ticketPrice} Soprano Coin ödeyecek
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.glassBorder
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  createBtn: { backgroundColor: Colors.teal, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  
  content: { padding: 20 },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text2, marginBottom: 8, marginLeft: 4 },
  input: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.glassBorder,
    borderRadius: Radius.default, paddingHorizontal: 16, paddingVertical: 14,
    color: Colors.text, fontSize: 16
  },
  textArea: { height: 100 },
  
  categoryScroll: { flexDirection: 'row', overflow: 'visible' },
  categoryBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.glassBorder, marginRight: 8 },
  categoryActive: { backgroundColor: Colors.teal + '20', borderColor: Colors.teal },
  categoryText: { color: Colors.text, fontSize: 13, fontWeight: '500' },
  categoryActiveText: { color: Colors.teal, fontWeight: '700' },
  
  dateTimeContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  datePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.glassBorder,
    borderRadius: Radius.default, paddingHorizontal: 16, paddingVertical: 14,
  },
  dateText: { color: Colors.text, fontSize: 15, fontWeight: '500' }
});
