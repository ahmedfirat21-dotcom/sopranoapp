/**
 * SopranoChat — Merkezi Yetki Motoru
 * ═══════════════════════════════════════════════════
 * Yetki Zinciri: Owner > Moderator > Speaker > Listener > Spectator > Guest > Banned
 * 7 katmanlı rol hiyerarşisi, 35 permission tanımı.
 */
import { supabase } from '../constants/supabase';
import { isTierAtLeast } from '../constants/tiers';
import type {
  ParticipantRole,
  OwnerPermission,
  PermissionDefinition,
  SubscriptionTier,
  RoomParticipant,
} from '../types';
import { ALL_PERMISSIONS, ROLE_LEVEL, normalizeRole, migrateLegacyTier } from '../types';

// ════════════════════════════════════════════════════════════
// YETKİ KONTROL FONKSİYONLARI
// ════════════════════════════════════════════════════════════

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Verilen aktörün, hedef üzerinde belirli bir aksiyonu yapıp yapamayacağını kontrol eder.
 *
 * @param actorRole  - Aksiyonu yapan kişinin oda içi rolü
 * @param targetRole - Hedef kişinin oda içi rolü (yoksa null)
 * @param permission - Yapılmak istenen aksiyon
 * @param actorTier  - Aktörün abonelik tier'ı (owner-only aksiyonlarda kontrol edilir)
 * @param isSelf     - Aktör kendi üzerine mi uyguluyor?
 */
export function checkPermission(
  actorRole: ParticipantRole,
  targetRole: ParticipantRole | null,
  permission: OwnerPermission,
  actorTier: SubscriptionTier = 'Free',
  isSelf: boolean = false,
): PermissionCheckResult {
  const def = ALL_PERMISSIONS[permission];
  if (!def) {
    return { allowed: false, reason: 'Tanımsız yetki.' };
  }

  // 1. Self-check: Bu aksiyon kendine uygulanamaz
  if (isSelf && def.hiddenOnSelf) {
    return { allowed: false, reason: 'Bu aksiyonu kendinize uygulayamazsınız.' };
  }

  // 2. Minimum rol seviyesi kontrolü
  const actorLevel = ROLE_LEVEL[actorRole] ?? 0;
  const requiredLevel = ROLE_LEVEL[def.minRole] ?? 0;
  if (actorLevel < requiredLevel) {
    return { allowed: false, reason: `Bu aksiyon için minimum "${def.minRole}" rolü gerekli.` };
  }

  // 3. Hedef kullanıcı gerekli mi?
  if (def.requiresTarget && targetRole === null) {
    return { allowed: false, reason: 'Hedef kullanıcı belirtilmeli.' };
  }

  // 4. Hedef kullanıcının rolü aktörden düşük mü olmalı?
  if (def.requiresLowerTarget && targetRole !== null) {
    const targetLevel = ROLE_LEVEL[targetRole] ?? 0;
    if (targetLevel >= actorLevel) {
      return { allowed: false, reason: 'Kendinizle aynı veya daha yüksek roldeki kişileri yönetemezsiniz.' };
    }
  }

  // 5. Tier gereksinimi
  if (def.minTier && !isTierAtLeast(actorTier, def.minTier)) {
    return { allowed: false, reason: `Bu özellik ${def.minTier}+ abonelik gerektirir.` };
  }

  return { allowed: true };
}

/**
 * Aktörün, hedef kullanıcı üzerinde yapabileceği tüm aksiyonları döndürür.
 * UI context menüsü oluşturmak için kullanılır.
 */
export function getAvailableActions(
  actorRole: ParticipantRole,
  targetRole: ParticipantRole,
  actorTier: SubscriptionTier = 'Free',
  isSelf: boolean = false,
): OwnerPermission[] {
  const available: OwnerPermission[] = [];
  for (const [perm, _def] of Object.entries(ALL_PERMISSIONS)) {
    const result = checkPermission(actorRole, targetRole, perm as OwnerPermission, actorTier, isSelf);
    if (result.allowed) {
      available.push(perm as OwnerPermission);
    }
  }
  return available;
}

/**
 * Rol karşılaştırma: roleA, roleB'den yüksek mi?
 */
export function isRoleHigher(roleA: ParticipantRole, roleB: ParticipantRole): boolean {
  return (ROLE_LEVEL[roleA] ?? 0) > (ROLE_LEVEL[roleB] ?? 0);
}

/**
 * Rol karşılaştırma: roleA, roleB'den yüksek veya eşit mi?
 */
export function isRoleAtLeast(role: ParticipantRole, requiredRole: ParticipantRole): boolean {
  return (ROLE_LEVEL[role] ?? 0) >= (ROLE_LEVEL[requiredRole] ?? 0);
}

// ════════════════════════════════════════════════════════════
// VERİTABANI ENTEGRASYONLU YETKİ KONTROL
// ════════════════════════════════════════════════════════════

export const PermissionService = {
  /**
   * Tam yetki kontrolü — DB'den rol + tier bilgisini çekerek kontrol eder.
   * Backend guard olarak kullanılır.
   */
  async check(
    roomId: string,
    actorUserId: string,
    targetUserId: string | null,
    permission: OwnerPermission,
  ): Promise<PermissionCheckResult> {
    // Aktörün oda içi rolünü ve profilini al
    const { data: actorParticipant } = await supabase
      .from('room_participants')
      .select('role, user:profiles!user_id(subscription_tier)')
      .eq('room_id', roomId)
      .eq('user_id', actorUserId)
      .single();

    if (!actorParticipant) {
      return { allowed: false, reason: 'Odada aktif bir katılımcı değilsiniz.' };
    }

    // Rol normalizasyonu
    const actorRole = normalizeRole(actorParticipant.role as string);
    const rawTier = (actorParticipant as any).user?.subscription_tier || 'Free';
    const actorTier = migrateLegacyTier(rawTier);

    // Hedef kullanıcının rolünü al
    let targetRole: ParticipantRole | null = null;
    if (targetUserId) {
      const { data: targetParticipant } = await supabase
        .from('room_participants')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', targetUserId)
        .single();

      if (targetParticipant) {
        targetRole = normalizeRole(targetParticipant.role as string);
      }
    }

    const isSelf = actorUserId === targetUserId;
    return checkPermission(actorRole, targetRole, permission, actorTier, isSelf);
  },

  /**
   * Aktörün, hedef üzerinde yapabileceği tüm aksiyonları DB'den kontrol ederek döndürür.
   */
  async getAvailable(
    roomId: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<OwnerPermission[]> {
    const { data: actorP } = await supabase
      .from('room_participants')
      .select('role, user:profiles!user_id(subscription_tier)')
      .eq('room_id', roomId)
      .eq('user_id', actorUserId)
      .single();

    const { data: targetP } = await supabase
      .from('room_participants')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', targetUserId)
      .single();

    if (!actorP || !targetP) return [];

    const actorRole = normalizeRole(actorP.role as string);
    const targetRole = normalizeRole(targetP.role as string);
    const rawTier = (actorP as any).user?.subscription_tier || 'Free';
    const actorTier = migrateLegacyTier(rawTier);
    const isSelf = actorUserId === targetUserId;

    return getAvailableActions(actorRole, targetRole, actorTier, isSelf);
  },
};
