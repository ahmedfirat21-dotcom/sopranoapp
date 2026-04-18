import { logger } from '../utils/logger';
import { supabase } from '../constants/supabase';
import { GamificationService } from './gamification';

export const ReferralService = {
  // Rastgele 6 haneli büyük harf+rakam kodu üret
  _generateCode: (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışıklık yaratabilecek 0/O/1/I hariç
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  // Kullanıcının kendi davet kodunu getir (yoksa oluştur)
  getMyCode: async (userId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      
      // Kod varsa döndür
      if (data?.referral_code) return data.referral_code;
      
      // Yoksa otomatik oluştur
      const newCode = ReferralService._generateCode();
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ referral_code: newCode })
        .eq('id', userId);
      
      if (updateErr) {
        if (__DEV__) logger.warn('Referral code oluşturulamadı:', updateErr.message);
        return null;
      }
      return newCode;
    } catch (e: any) {
      logger.error('Error fetching referral code:', e.message);
      return null;
    }
  },
  
  // Davet kodunu kullan
  // ★ SEC-REF: isOnboarding=true ise 24 saat kuralını bypass et (onboarding sırasında hesap yeni oluşturulmuş)
  applyCode: async (referralCode: string, referredUserId: string, isOnboarding: boolean = false): Promise<{ success: boolean; message: string }> => {
    try {
      if (!referralCode || referralCode.trim().length === 0) {
        return { success: false, message: 'Geçersiz davet kodu' };
      }

      const code = referralCode.trim().toUpperCase();

      // 1. Kod sahibini bul
      const { data: owner, error: ownerErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', code)
        .maybeSingle();

      if (ownerErr || !owner) {
        return { success: false, message: 'Bu davet kodu bulunamadı.' };
      }

      // Kendi kodunu kullanmasın
      if (owner.id === referredUserId) {
        return { success: false, message: 'Kendi davet kodunuzu kullanamazsınız.' };
      }

      // ★ SEC-REF1: Max 20 referral limiti — SP farming engeli
      const { count: ownerRefCount } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', owner.id);
      if ((ownerRefCount || 0) >= 20) {
        return { success: false, message: 'Bu davet kodunun limiti dolmuş.' };
      }

      // ★ SEC-REF2: 24 saat bekleme süresi — yeni hesabın referral kullanma engeli
      // Onboarding sırasında bypass edilir (hesap tam o anda oluşturulmuş)
      if (!isOnboarding) {
        const { data: referredProfile } = await supabase
          .from('profiles')
          .select('created_at')
          .eq('id', referredUserId)
          .single();
        if (referredProfile?.created_at) {
          const accountAge = Date.now() - new Date(referredProfile.created_at).getTime();
          const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
          if (accountAge < TWENTY_FOUR_HOURS) {
            return { success: false, message: 'Davet kodunu kullanmak için hesabınızın en az 24 saat eski olması gerekir.' };
          }
        }
      }

      // 2. Daha önce bu kişi başka bir kod kullanmış mı?
      const { data: existing } = await supabase
        .from('referrals')
        .select('id')
        .eq('referred_id', referredUserId)
        .maybeSingle();

      if (existing) {
        return { success: false, message: 'Zaten bir davet kodu kullanmışsınız.' };
      }

      // 3. Referral kaydı oluştur
      const { error: insertErr } = await supabase.from('referrals').insert({
        referrer_id: owner.id,
        referred_id: referredUserId,
        referral_code: code,
      });

      if (insertErr) {
        if (__DEV__) logger.warn('Referral insert error:', insertErr.message);
        return { success: false, message: 'İşlem sırasında hata oluştu.' };
      }

      // 4. ★ SP-1 FIX: GamificationService üzerinden git — cooldown, cap, transaction kaydı otomatik
      // Referral bonus özel action: cooldown yok, günlük cap GamificationService'te yönetilir
      await GamificationService.earn(owner.id, 50, 'referral_bonus');       // Davet eden
      await GamificationService.earn(referredUserId, 50, 'referral_bonus');  // Davet edilen

      return { success: true, message: 'Tebrikler! Her ikiniz de 50 SP kazandınız.' };
    } catch (e: any) {
      logger.error('Error applying code:', e.message);
      return { success: false, message: e.message };
    }
  },
  
  // Kaç kişi davet ettiğini getir
  getReferralCount: async (userId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', userId);
        
      if (error) throw error;
      return count || 0;
    } catch (e: any) {
      logger.error('Error fetching referral count:', e.message);
      return 0;
    }
  },
  
  // Davet ettiği kişilerin listesi
  getReferralList: async (userId: string): Promise<any> => {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          created_at,
          referred:profiles!referrals_referred_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data) return [];

      return data.map((item: any) => ({
        id: item.referred?.id,
        username: item.referred?.username,
        display_name: item.referred?.display_name,
        avatar_url: item.referred?.avatar_url,
        created_at: item.created_at
      }));
    } catch (e: any) {
      logger.error('Error fetching referral list:', e.message);
      return [];
    }
  }
};
