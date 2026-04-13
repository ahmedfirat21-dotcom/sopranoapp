import { supabase } from '../constants/supabase';

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
        if (__DEV__) console.warn('Referral code oluşturulamadı:', updateErr.message);
        return null;
      }
      return newCode;
    } catch (e: any) {
      console.error('Error fetching referral code:', e.message);
      return null;
    }
  },
  
  // Davet kodunu kullan
  applyCode: async (referralCode: string, referredUserId: string): Promise<{ success: boolean; message: string }> => {
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
        if (__DEV__) console.warn('Referral insert error:', insertErr.message);
        return { success: false, message: 'İşlem sırasında hata oluştu.' };
      }

      // 4. Her iki tarafa 50 SP ver — doğrudan atomik güncelleme
      // NOT: GamificationService.earn() cooldown engeline takılıyor, bu yüzden direkt güncelliyoruz
      const giveReferralSP = async (uid: string, amount: number) => {
        // Önce RPC dene (atomik)
        const { error: rpcErr } = await supabase.rpc('grant_system_points', {
          p_user_id: uid,
          p_amount: amount,
          p_action: 'referral_bonus',
        });
        if (!rpcErr) {
          // Transaction kaydı
          await supabase.from('sp_transactions').insert({
            user_id: uid,
            amount,
            type: 'referral_bonus',
            description: `Davet bonusu: +${amount} SP`,
          }).catch(() => {});
          return;
        }

        // RPC yoksa fallback: optimistic lock
        const { data: p } = await supabase.from('profiles').select('system_points').eq('id', uid).single();
        if (p) {
          const oldSP = p.system_points || 0;
          await supabase.from('profiles')
            .update({ system_points: oldSP + amount })
            .eq('id', uid)
            .eq('system_points', oldSP); // optimistic lock
          await supabase.from('sp_transactions').insert({
            user_id: uid,
            amount,
            type: 'referral_bonus',
            description: `Davet bonusu: +${amount} SP`,
          }).catch(() => {});
        }
      };

      await giveReferralSP(owner.id, 50);       // Davet eden
      await giveReferralSP(referredUserId, 50);  // Davet edilen

      return { success: true, message: 'Tebrikler! Her ikiniz de 50 SP kazandınız.' };
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
