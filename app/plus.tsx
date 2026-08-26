import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBackground from '../components/AppBackground';
import { safeGoBack } from '../constants/navigation';
import { Colors } from '../constants/theme';

/**
 * Plus/Pro abonelik satışı kaldırıldı. Eski sürümlerde kaydedilmiş /plus
 * bağlantıları kullanıcıyı güvenli biçimde SP mağazasına taşımaya devam eder.
 * RevenueCat uygulamada yalnızca tek seferlik SP paketleri için kullanılır.
 */
export default function SPAndGiftsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <AppBackground radialGlow>
      <View style={[s.container, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={s.header}>
          <Pressable onPress={() => safeGoBack(router)} style={s.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </Pressable>
          <Text style={s.headerTitle}>SP & Hediyeler</Text>
          <Ionicons name="gift-outline" size={22} color={Colors.gold} />
        </View>

        <View style={[s.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <LinearGradient
            colors={['rgba(20,184,166,0.22)', 'rgba(15,23,42,0.96)']}
            style={s.card}
          >
            <View style={s.iconWrap}>
              <Ionicons name="gift" size={32} color="#2DD4BF" />
            </View>
            <Text style={s.title}>Ücretli üyelik yok</Text>
            <Text style={s.description}>
              Oda açma, konuşma, moderasyon, yayın ve temel özellikler herkes için açık. SopranoChat yalnızca SP satın alımlarından ve gönderilen hediyelerden gelir elde eder.
            </Text>
            <Pressable onPress={() => router.replace('/store' as any)} style={s.storeButton}>
              <LinearGradient colors={['#14B8A6', '#0F766E']} style={s.storeButtonGradient}>
                <Ionicons name="sparkles" size={19} color="#FFF" />
                <Text style={s.storeButtonText}>SP Mağazasına Git</Text>
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
    </AppBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.35)',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,184,166,0.18)',
    marginBottom: 18,
  },
  title: { color: '#F8FAFC', fontSize: 23, fontWeight: '800', textAlign: 'center' },
  description: { color: '#94A3B8', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  storeButton: { marginTop: 24, borderRadius: 16, overflow: 'hidden' },
  storeButtonGradient: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  storeButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
