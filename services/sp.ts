/**
 * SopranoChat — Sistem Puanları (SP) Servisi
 * ═══════════════════════════════════════════════════
 * SP bakiye, işlem, geçmiş.
 * database.ts monolitinden ayrıştırıldı.
 */
import { supabase } from '../constants/supabase';
import { ProfileService } from './profile';

// ============================================
// SİSTEM PUANLARI (SP) İŞLEMLERİ
// ============================================
export const SPService = {
  /** SP bakiyesi getir */
  async getBalance(userId: string) {
    const profile = await ProfileService.get(userId);
    return profile?.system_points ?? 0;
  },

  /** SP ekle/çıkar + işlem kaydı — ★ Atomik güvenlikli (3 katman + retry) */
  async transaction(userId: string, amount: number, type: string, description: string) {
    // 1. Önce RPC ile atomik işlem dene (en güvenli)
    try {
      const { error: rpcError } = await supabase.rpc('grant_system_points', {
        p_user_id: userId,
        p_amount: amount,
        p_action: type,
      });
      if (!rpcError) return { success: true };
    } catch {}

    // 2. Fallback: Atomik increment RPC
    // Negatif bakiye koruması: SP düşüyorsa (amount < 0) önce yeterli bakiye var mı kontrol et
    if (amount < 0) {
      const profile = await ProfileService.get(userId);
      if (!profile) throw new Error('Profil bulunamadı');
      if ((profile.system_points || 0) + amount < 0) throw new Error('Yetersiz SP');
    }

    // ★ Atomik güncelleme: system_points = system_points + amount
    const { error: updateErr } = await supabase.rpc('increment_profile_sp', {
      p_user_id: userId,
      p_amount: amount,
    });

    if (updateErr) {
      // 3. Son çare: Optimistic lock + retry — concurrent update'i yakalar
      const MAX_RETRIES = 2;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const profile = await ProfileService.get(userId);
        if (!profile) throw new Error('Profil bulunamadı');
        const oldSP = profile.system_points || 0;
        const newTotal = oldSP + amount;
        if (newTotal < 0) throw new Error('Yetersiz SP');

        // ★ Optimistic lock: sadece SP değişmemişse güncelle
        const { data, error: lockErr } = await supabase
          .from('profiles')
          .update({ system_points: newTotal })
          .eq('id', userId)
          .eq('system_points', oldSP)  // concurrent update varsa 0 row affected
          .select('id');
        
        if (!lockErr && data && data.length > 0) break; // Başarılı
        if (attempt === MAX_RETRIES - 1) throw new Error('SP güncelleme başarısız (concurrent conflict)');
        // Kısa bekleme sonrası retry
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // İşlem kaydı (opsiyonel — başarısız olursa sessiz)
    try {
      await supabase.from('sp_transactions').insert({
        user_id: userId, amount, type, description: description || null,
      });
    } catch {}

    return { success: true };
  },

  /** SP işlem geçmişi */
  async getHistory(userId: string, limit = 20) {
    const { data, error } = await supabase
      .from('sp_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};
