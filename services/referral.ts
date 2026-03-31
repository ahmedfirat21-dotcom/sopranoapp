import { supabase } from '../constants/supabase';

export const ReferralService = {
  // Kullanıcının kendi davet kodunu getir
  getMyCode: async (userId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data?.referral_code || null;
    } catch (e: any) {
      console.error('Error fetching referral code:', e.message);
      return null;
    }
  },
  
  // Davet kodunu kullan (onboarding'de çağrılacak)
  applyCode: async (referralCode: string, referredUserId: string): Promise<{ success: boolean; message: string }> => {
    try {
      if (!referralCode || referralCode.trim().length === 0) {
        return { success: false, message: 'Geçersiz davet kodu' };
      }

      const { data, error } = await supabase.rpc('process_referral_reward', {
        p_referral_code: referralCode.trim().toUpperCase(),
        p_referred_id: referredUserId
      });

      if (error) {
        console.error('Error applying referral RPC:', error.message);
        return { success: false, message: 'İşlem sırasında sunucu hatası oluştu.' };
      }

      return { success: data.success, message: data.message || (data.success ? 'Yüklendi' : 'Başarısız') };
    } catch (e: any) {
      console.error('Error applying code:', e.message);
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
      console.error('Error fetching referral count:', e.message);
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
      console.error('Error fetching referral list:', e.message);
      return [];
    }
  }
};
