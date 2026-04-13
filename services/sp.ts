/**
 * SopranoChat — Sistem Puanları (SP) Servisi
 * ═══════════════════════════════════════════════════
 * ★ Delegasyon katmanı — tüm SP işlemleri GamificationService'e yönlendirilir.
 * Bu dosya geriye dönük uyumluluk için korunur.
 * Yeni kod doğrudan GamificationService kullanmalıdır.
 */
import { GamificationService } from './gamification';

export const SPService = {
  /** SP bakiyesi getir */
  async getBalance(userId: string) {
    return GamificationService.getBalance(userId);
  },

  /** SP ekle/çıkar + işlem kaydı — GamificationService'e delege */
  async transaction(userId: string, amount: number, type: string, _description: string) {
    if (amount >= 0) {
      const earned = await GamificationService.earn(userId, amount, type);
      return { success: earned > 0 };
    } else {
      return GamificationService.spend(userId, Math.abs(amount), type);
    }
  },

  /** SP işlem geçmişi */
  async getHistory(userId: string, limit = 20) {
    return GamificationService.getTransactionHistory(userId, limit);
  },
};
