import * as Notifications from 'expo-notifications';

import { SNOOZE_ESCALATION_THRESHOLD } from '../config/reminderConfig';

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

// --- Copy ---
//
// Structured as a single lookup keyed by snooze count so Phase 4's message
// pool/personalization can replace just this function without touching any
// call site.
function getReminderCopy(snoozeCount: number): { title: string; body: string } {
  if (snoozeCount >= SNOOZE_ESCALATION_THRESHOLD) {
    return {
      title: 'Still there?',
      body: "Still haven't moved — even 30 seconds helps. Stand up and stretch.",
    };
  }

  return {
    title: 'Time to move',
    body: "You've been on your phone a while — stand up, check your posture, and do a quick neck stretch.",
  };
}

type FireReminderOptions = {
  /** Consecutive snoozes for the current trigger cycle; selects copy. */
  snoozeCount?: number;
  /** Delay before showing, for snooze follow-ups. Omit to fire immediately. */
  delaySeconds?: number;
};

/**
 * Fires (or schedules) the reminder notification with the four action
 * buttons. Returns the notification's identifier so callers can track
 * whether it's still showing (see reminderActions.ts's ignored-detection).
 */
export async function fireReminderNotification(
  options: FireReminderOptions = {}
): Promise<string> {
  const { snoozeCount = 0, delaySeconds } = options;
  const { title, body } = getReminderCopy(snoozeCount);

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      categoryIdentifier: REMINDER_CATEGORY,
    },
    trigger: delaySeconds
      ? {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySeconds,
          repeats: false,
        }
      : null,
  });
}
