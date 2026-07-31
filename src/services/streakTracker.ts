import AsyncStorage from '@react-native-async-storage/async-storage';

import { STREAK_REINFORCEMENT_MILESTONES } from '../config/reminderConfig';

const KEYS = {
  // Holds the milestone number once it's been hit but not yet shown to
  // her — cleared the next time the app is opened and consumes it.
  pendingReinforcement: '@mommove/pendingReinforcementStreak',
} as const;

/**
 * The streak *count* itself is no longer stored here — as of Phase 5 it's
 * computed on demand from reminder_logs (see database.ts's
 * getCurrentDoneStreak). This module only queues the one-time "show a
 * banner" flag once a milestone is reached, since that's a UI concern, not
 * data the database needs to own.
 */
export async function maybeQueueReinforcement(streak: number): Promise<void> {
  if (STREAK_REINFORCEMENT_MILESTONES.includes(streak)) {
    await AsyncStorage.setItem(KEYS.pendingReinforcement, String(streak));
  }
}

/**
 * Reads and clears any milestone reached since the last time the app was
 * opened, so the in-app reinforcement banner shows at most once per
 * milestone. Returns null if no milestone is pending.
 */
export async function consumePendingReinforcement(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(KEYS.pendingReinforcement);
  if (!raw) {
    return null;
  }
  await AsyncStorage.removeItem(KEYS.pendingReinforcement);
  return Number(raw);
}
