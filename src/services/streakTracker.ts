import AsyncStorage from '@react-native-async-storage/async-storage';

import { STREAK_REINFORCEMENT_MILESTONES } from '../config/reminderConfig';

const KEYS = {
  streak: '@mommove/doneStreak',
  // Holds the milestone number once it's been hit but not yet shown to
  // her — cleared the next time the app is opened and consumes it.
  pendingReinforcement: '@mommove/pendingReinforcementStreak',
} as const;

/**
 * [PLACEHOLDER] AsyncStorage is a stand-in for Phase 5's real SQLite-backed
 * streak query — this module is the one place that logic will move to, so
 * nothing else needs to change when it does.
 */
export async function getStreak(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEYS.streak);
  return raw ? Number(raw) : 0;
}

/** Call from onReminderResolved('done'). */
export async function recordDone(): Promise<void> {
  const next = (await getStreak()) + 1;
  await AsyncStorage.setItem(KEYS.streak, String(next));

  if (STREAK_REINFORCEMENT_MILESTONES.includes(next)) {
    await AsyncStorage.setItem(KEYS.pendingReinforcement, String(next));
  }
}

/** Call from onReminderResolved('skip' | 'ignored'). */
export async function resetStreak(): Promise<void> {
  await AsyncStorage.setItem(KEYS.streak, '0');
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
