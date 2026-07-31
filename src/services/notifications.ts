import * as Notifications from 'expo-notifications';

import type { MessageTone } from '../config/messagePool';
import {
  SNOOZE_ESCALATION_THRESHOLD,
  WARM_VARIETY_EVERY_N_TRIGGERS,
} from '../config/reminderConfig';
import { getCurrentTimeOfDay, getLastSelectedMessageId, selectMessage } from './messageSelector';
import { getNotificationStyle, getUserName } from './preferencesStore';
import { setLastShownMessageId } from './reminderTriggerState';

// Show the notification banner even while MomMove itself happens to be in
// the foreground (rare in practice, since the reminder fires while she's
// been using *other* apps, but harmless either way).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type NotificationPermissionResult = 'granted' | 'denied';

/**
 * Requests the Android 13+ runtime notification permission (POST_NOTIFICATIONS).
 * This is a normal runtime dialog — separate from, and unrelated to, the
 * Usage Access special-permission flow in PermissionOnboardingScreen.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return 'granted';
  }

  const result = await Notifications.requestPermissionsAsync();
  return result.granted ? 'granted' : 'denied';
}

export async function hasNotificationPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

// --- Action buttons ---

export const REMINDER_CATEGORY = 'reminderActions';

export const ACTION_DONE = 'done';
export const ACTION_SNOOZE_5 = 'snooze5';
export const ACTION_SNOOZE_30 = 'snooze30';
export const ACTION_SKIP = 'skip';

/**
 * Registers the four notification action buttons. Must be called once at
 * startup, before any reminder is scheduled with `categoryIdentifier:
 * REMINDER_CATEGORY` — see index.ts.
 *
 * `opensAppToForeground: false` on every action is what makes them work
 * directly from the notification shade without launching MomMove's UI.
 */
export async function configureNotificationCategoriesAsync(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
    { identifier: ACTION_DONE, buttonTitle: 'Done', options: { opensAppToForeground: false } },
    {
      identifier: ACTION_SNOOZE_5,
      buttonTitle: 'Snooze 5m',
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_SNOOZE_30,
      buttonTitle: 'Snooze 30m',
      options: { opensAppToForeground: false },
    },
    { identifier: ACTION_SKIP, buttonTitle: 'Skip', options: { opensAppToForeground: false } },
  ]);
}

// --- Sound/vibration (Android notification channel) ---

export const REMINDER_CHANNEL_ID = 'mommove-reminders';

/**
 * Android locks a channel's sound/vibration once it's created — per
 * expo-notifications' own docs, "after a channel has been created, you can
 * modify only its name and description." So the only way for the Settings
 * screen's sound/vibration toggles to actually take effect is to delete
 * and recreate this channel with the current preference each time. Called
 * once at startup (index.ts) and again whenever Settings saves a change.
 */
export async function configureReminderNotificationChannelAsync(): Promise<void> {
  const { soundEnabled, vibrationEnabled } = await getNotificationStyle();

  await Notifications.deleteNotificationChannelAsync(REMINDER_CHANNEL_ID).catch(() => {
    // No-op if it doesn't exist yet (first launch).
  });

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: soundEnabled ? 'default' : null,
    enableVibrate: vibrationEnabled,
    vibrationPattern: vibrationEnabled ? [0, 250, 250, 250] : null,
  });
}

// --- Copy: pulled from the message pool (src/config/messagePool.ts) ---
//
// These two decide *which tone* to use; messageSelector.ts then picks an
// actual message for that tone + time of day. Kept here, next to the
// firing code, since the "rules" differ for a fresh cycle vs. a snooze.

/** Fresh 30-minute-cycle trigger: mostly casual, occasionally warm. */
export function toneForFreshTrigger(triggerCount: number): MessageTone {
  return triggerCount > 0 && triggerCount % WARM_VARIETY_EVERY_N_TRIGGERS === 0
    ? 'warm'
    : 'casual';
}

/** Snooze follow-up: casual until it escalates to direct at the threshold. */
export function toneForSnooze(snoozeCount: number): MessageTone {
  return snoozeCount >= SNOOZE_ESCALATION_THRESHOLD ? 'direct' : 'casual';
}

type FireReminderOptions = {
  tone: MessageTone;
  /** Delay before showing, for snooze follow-ups. Omit to fire immediately. */
  delaySeconds?: number;
};

/**
 * Fires (or schedules) the reminder notification with the four action
 * buttons. Returns the notification's identifier so callers can track
 * whether it's still showing (see reminderActions.ts's ignored-detection).
 */
export async function fireReminderNotification(options: FireReminderOptions): Promise<string> {
  const { tone, delaySeconds } = options;
  const name = await getUserName();
  const body = selectMessage(tone, getCurrentTimeOfDay(), name);
  // Recorded regardless of fresh-fire vs. snooze, so it always reflects
  // whichever message was actually on screen at the time of resolution.
  setLastShownMessageId(getLastSelectedMessageId());

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'MomMove',
      body,
      categoryIdentifier: REMINDER_CATEGORY,
    },
    // Note: a plain `trigger: null` (immediate) does NOT carry a channelId
    // through to Android — channelId only exists on the `trigger` object
    // (see expo-notifications' ChannelAwareTriggerInput/TimeIntervalTriggerInput
    // types), never on `content`. So "immediate" here means "fire now, on
    // this channel" via `{ channelId }`, not a bare null.
    trigger: delaySeconds
      ? {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySeconds,
          repeats: false,
          channelId: REMINDER_CHANNEL_ID,
        }
      : { channelId: REMINDER_CHANNEL_ID },
  });
}
