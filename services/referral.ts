import { logger } from '../utils/logger';
import { supabase } from '../constants/supabase';
import { i18n } from './i18n';

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
        return { success: false, message: i18n.t('auto.referral.010') };
      }
      const { error } = await supabase.rpc('apply_referral_code', {
        p_code: referralCode.trim().toUpperCase(),
        p_referred_id: referredUserId,
        p_is_onboarding: isOnboarding,
      });
      if (error) return { success: false, message: error.message || i18n.t('auto.referral.003') };
      return { success: true, message: i18n.t('auto.referral.001') };
    } catch (e: any) {
      logger.error('Error applying code:', e.message);
      return { success: false, message: e.message };
    }
  },
  
  // Bu kullanıcı daha önce bir davet kodu kullandı mı?
  hasUsedReferral: async (userId: string): Promise<{ used: boolean; code?: string; usedAt?: string }> => {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('referral_code, created_at')
        .eq('referred_id', userId)
        .maybeSingle();
      if (error) return { used: false };
      if (!data) return { used: false };
      return { used: true, code: (data as any).referral_code, usedAt: (data as any).created_at };
    } catch { return { used: false }; }
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
