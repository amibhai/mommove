import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_ACTIVE_HOURS_END,
  DEFAULT_ACTIVE_HOURS_START,
} from '../config/reminderConfig';

const KEYS = {
  activeHoursStart: '@mommove/activeHoursStart',
  activeHoursEnd: '@mommove/activeHoursEnd',
  isPausedToday: '@mommove/isPausedToday',
  pausedUntilTimestamp: '@mommove/pausedUntilTimestamp',
} as const;

export type ActiveHours = {
  start: number; // 24h, e.g. 8
  end: number; // 24h, e.g. 21
};

/**
 * No Settings UI exists yet (Phase 6), so these always resolve to the
 * defaults today — but reading/writing through storage now means Phase 6
 * can add a UI without touching any of the gating logic that reads this.
 */
export async function getActiveHours(): Promise<ActiveHours> {
  const [start, end] = await Promise.all([
    AsyncStorage.getItem(KEYS.activeHoursStart),
    AsyncStorage.getItem(KEYS.activeHoursEnd),
  ]);

  return {
    start: start !== null ? Number(start) : DEFAULT_ACTIVE_HOURS_START,
    end: end !== null ? Number(end) : DEFAULT_ACTIVE_HOURS_END,
  };
}

export async function setActiveHours(start: number, end: number): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.activeHoursStart, String(start)),
    AsyncStorage.setItem(KEYS.activeHoursEnd, String(end)),
  ]);
}

function nextMidnightTimestamp(): number {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  ).getTime();
}

/**
 * Sets or clears the "Pause today" flag. Pausing always lasts until the
 * next local midnight, regardless of when in the day it's toggled on.
 */
export async function setPauseToday(paused: boolean): Promise<void> {
  if (paused) {
    await Promise.all([
      AsyncStorage.setItem(KEYS.isPausedToday, 'true'),
      AsyncStorage.setItem(KEYS.pausedUntilTimestamp, String(nextMidnightTimestamp())),
    ]);
  } else {
    await AsyncStorage.multiRemove([KEYS.isPausedToday, KEYS.pausedUntilTimestamp]);
  }
}

/**
 * Reads the pause flag, transparently clearing it if its midnight deadline
 * has already passed. Called both by the reminder gate (every tick) and
 * explicitly on app launch/foreground, so the flag never outlives its
 * intended "just for today" scope.
 */
export async function getIsPausedToday(): Promise<boolean> {
  const [pausedStr, untilStr] = await Promise.all([
    AsyncStorage.getItem(KEYS.isPausedToday),
    AsyncStorage.getItem(KEYS.pausedUntilTimestamp),
  ]);

  if (pausedStr !== 'true') {
    return false;
  }

  const until = untilStr ? Number(untilStr) : 0;
  if (Date.now() >= until) {
    await setPauseToday(false);
    return false;
  }

  return true;
}
