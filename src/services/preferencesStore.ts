import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BREAK_RESET_GAP_MIN,
  CONTINUOUS_TIME_THRESHOLD_MIN,
  DEFAULT_ACTIVE_HOURS_END,
  DEFAULT_ACTIVE_HOURS_START,
} from '../config/reminderConfig';

const KEYS = {
  activeHoursStart: '@mommove/activeHoursStart',
  activeHoursEnd: '@mommove/activeHoursEnd',
  isPausedToday: '@mommove/isPausedToday',
  pausedUntilTimestamp: '@mommove/pausedUntilTimestamp',
  userName: '@mommove/userName',
  continuousTimeThresholdMin: '@mommove/continuousTimeThresholdMin',
  breakResetGapMin: '@mommove/breakResetGapMin',
  notificationSoundEnabled: '@mommove/notificationSoundEnabled',
  notificationVibrationEnabled: '@mommove/notificationVibrationEnabled',
} as const;

export const DEFAULT_USER_NAME = 'Mummy';

export type ActiveHours = {
  start: number; // 24h, e.g. 8
  end: number; // 24h, e.g. 21
};

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

export async function getUserName(): Promise<string> {
  const name = await AsyncStorage.getItem(KEYS.userName);
  return name && name.trim().length > 0 ? name : DEFAULT_USER_NAME;
}

export async function setUserName(name: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.userName, name);
}

export type ReminderTiming = {
  thresholdMin: number;
  gapMin: number;
};

/**
 * The Phase 2 constants are only the *default* — screenTimeTracker.ts reads
 * the current value through here (cached, refreshed on save — see its
 * refreshTrackerConfig()) rather than importing the constants directly.
 */
export async function getReminderTiming(): Promise<ReminderTiming> {
  const [thresholdStr, gapStr] = await Promise.all([
    AsyncStorage.getItem(KEYS.continuousTimeThresholdMin),
    AsyncStorage.getItem(KEYS.breakResetGapMin),
  ]);

  return {
    thresholdMin: thresholdStr !== null ? Number(thresholdStr) : CONTINUOUS_TIME_THRESHOLD_MIN,
    gapMin: gapStr !== null ? Number(gapStr) : BREAK_RESET_GAP_MIN,
  };
}

export async function setReminderTiming(thresholdMin: number, gapMin: number): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.continuousTimeThresholdMin, String(thresholdMin)),
    AsyncStorage.setItem(KEYS.breakResetGapMin, String(gapMin)),
  ]);
}

export type NotificationStyle = {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
};

export async function getNotificationStyle(): Promise<NotificationStyle> {
  const [soundStr, vibrationStr] = await Promise.all([
    AsyncStorage.getItem(KEYS.notificationSoundEnabled),
    AsyncStorage.getItem(KEYS.notificationVibrationEnabled),
  ]);

  return {
    soundEnabled: soundStr !== null ? soundStr === 'true' : true,
    vibrationEnabled: vibrationStr !== null ? vibrationStr === 'true' : true,
  };
}

export async function setNotificationStyle(
  soundEnabled: boolean,
  vibrationEnabled: boolean
): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.notificationSoundEnabled, String(soundEnabled)),
    AsyncStorage.setItem(KEYS.notificationVibrationEnabled, String(vibrationEnabled)),
  ]);
}
