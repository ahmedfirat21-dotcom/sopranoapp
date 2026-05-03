/**
 * SopranoChat — User Profile Sheet Context
 * ═══════════════════════════════════════════════════════════════════
 * v107.32 (2 May 2026) — Eskiden app/_layout.tsx içinde tanımlıydı,
 * cycle'a sebep oluyordu (FollowListModal, IncomingFriendRequestCard,
 * NotificationDrawer vs. _layout'tan import edince → _layout bu komponenleri
 * render ettiği için cycle).
 *
 * Şimdi ayrı dosyada — alt komponenler buradan import eder, _layout sadece
 * Provider'ı sarmalar.
 */

import React, { createContext, useContext } from 'react';

export type UserProfileSheetContextType = {
  openUserProfile: (userId: string) => void;
  closeUserProfile: () => void;
};

export const UserProfileSheetContext = createContext<UserProfileSheetContextType>({
  openUserProfile: () => {},
  closeUserProfile: () => {},
});

export function useUserProfileSheet() {
  return useContext(UserProfileSheetContext);
}
