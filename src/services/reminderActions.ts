import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import ScreenTracker from '../../modules/screen-tracker';
import {
  getCurrentDoneStreak,
  insertReminderLog,
  TRIGGER_TYPE_30MIN_CONTINUOUS_USE,
  type ReminderActionTaken,
} from '../db/database';
import { SNOOZE_5_MIN, SNOOZE_30_MIN } from '../config/reminderConfig';
import {
  ACTION_DONE,
  ACTION_SKIP,
  ACTION_SNOOZE_30,
  ACTION_SNOOZE_5,
  configureNotificationCategoriesAsync,
  fireReminderNotification,
  toneForSnooze,
} from './notifications';
import {
  clearTriggerFiredState,
  getLastShownMessageId,
  getPendingNotificationId,
  getSnoozeCount,
  getTriggerFiredAtMs,
  getTriggerSessionDurationMin,
  incrementSnoozeCount,
  resetSnoozeCount,
  setPendingNotificationId,
} from './reminderTriggerState';
import { maybeQueueReinforcement } from './streakTracker';

const LOG_PREFIX = '[MomMove:actions]';

const BACKGROUND_NOTIFICATION_TASK = 'MOMMOVE_BACKGROUND_NOTIFICATION_TASK';

export type ReminderResolution = 'done' | 'skip' | 'ignored';

const ACTION_TAKEN_BY_RESOLUTION: Record<ReminderResolution, ReminderActionTaken> = {
  done: 'done',
  skip: 'skipped',
  ignored: 'ignored',
};

/**
 * Called once per trigger, on its *final* resolution (done/skip/ignored —
 * never for individual snooze taps, which just reschedule the same
 * trigger). Writes one row to reminder_logs, then checks whether the
 * fresh streak (computed from the database, not a separately-maintained
 * counter) just crossed a reinforcement milestone.
 *
 * `isDebug` (default false) is for Developer Tools' "Simulate Done"/
 * "Simulate Skip" only — real notification-action resolutions never pass
 * it, so they always land as real rows. See database.ts's is_debug column.
 */
export async function onReminderResolved(
  resolution: ReminderResolution,
  options?: { isDebug?: boolean }
): Promise<void> {
  const isDebug = options?.isDebug ?? false;
  console.log(`${LOG_PREFIX} onReminderResolved('${resolution}'${isDebug ? ', isDebug' : ''})`);

  const firedAtMs = getTriggerFiredAtMs();
  const resolvedAtMs = Date.now();

  await insertReminderLog({
    timestamp: new Date(resolvedAtMs).toISOString(),
    triggerType: TRIGGER_TYPE_30MIN_CONTINUOUS_USE,
    actionTaken: ACTION_TAKEN_BY_RESOLUTION[resolution],
    snoozeCount: getSnoozeCount(),
    responseTimeSec: firedAtMs !== null ? Math.round((resolvedAtMs - firedAtMs) / 1000) : null,
    sessionDurationMin: getTriggerSessionDurationMin(),
    messageId: getLastShownMessageId(),
    isDebug,
  });
  clearTriggerFiredState();

  const streak = await getCurrentDoneStreak();
  await maybeQueueReinforcement(streak);
}

async function handleSnooze(minutes: number): Promise<void> {
  const count = incrementSnoozeCount();
  console.log(`${LOG_PREFIX} snoozed ${minutes}m (snoozeCount=${count})`);
  const id = await fireReminderNotification({
    delaySeconds: minutes * 60,
    tone: toneForSnooze(count),
  });
  // The follow-up notification isn't visible yet (it's delayed) — the
  // "received" listener below marks it pending once it's actually shown.
  setPendingNotificationId(id);
}

// Guards against the same tap being processed twice, since both the
// foreground listener and the background task can independently observe it
// depending on whether the app process happened to be alive when it fired.
let lastHandledResponseKey: string | null = null;

async function processResponse(
  actionIdentifier: string,
  notificationId: string
): Promise<void> {
  const key = `${notificationId}:${actionIdentifier}`;
  if (lastHandledResponseKey === key) {
    return;
  }
  lastHandledResponseKey = key;

  if (getPendingNotificationId() === notificationId) {
    setPendingNotificationId(null);
  }

  switch (actionIdentifier) {
    case ACTION_DONE:
      resetSnoozeCount();
      await onReminderResolved('done');
      break;
    case ACTION_SNOOZE_5:
      await handleSnooze(SNOOZE_5_MIN);
      break;
    case ACTION_SNOOZE_30:
      await handleSnooze(SNOOZE_30_MIN);
      break;
    case ACTION_SKIP:
      resetSnoozeCount();
      await onReminderResolved('skip');
      break;
    default:
      // Notifications.DEFAULT_ACTION_IDENTIFIER (the notification body was
      // tapped, not one of our 4 buttons) — nothing to do here.
      break;
  }
}

/**
 * Registers everything notification-action-related. Must be called once,
 * unconditionally, at JS bundle load (see index.ts) — same reasoning as
 * registerScreenTimeTrackerHeadlessTask: a button tap can cold-start the JS
 * bundle with no App.tsx ever mounting, so nothing here can live inside a
 * component's useEffect.
 */
export function registerNotificationHandling(): void {
  configureNotificationCategoriesAsync().catch((err) => {
    console.log(`${LOG_PREFIX} failed to configure notification categories: ${err}`);
  });

  // 1) Foreground/alive-process path. Fires whenever the JS engine is
  // running — which, thanks to ScreenTrackerService, is effectively always
  // true while tracking is on, whether or not the app UI is open.
  Notifications.addNotificationResponseReceivedListener((response) => {
    void processResponse(
      response.actionIdentifier,
      response.notification.request.identifier
    );
  });

  // Marks the most recently *presented* reminder notification, so the
  // ignored-detection poll in screenTimeTracker.ts knows what to look for
  // once it's actually visible (as opposed to a snooze follow-up that's
  // merely scheduled but not shown yet).
  Notifications.addNotificationReceivedListener((notification) => {
    setPendingNotificationId(notification.request.identifier);
  });

  // 2) Killed-process safety net. Android can kill our foreground-service
  // process despite everything (some OEM battery managers do this
  // regardless), so this TaskManager-backed background task is what
  // guarantees the four actions still work even then — it wakes the JS
  // bundle headlessly, independent of any Activity/App component.
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    BACKGROUND_NOTIFICATION_TASK,
    async ({ data, error }) => {
      if (error) {
        console.log(`${LOG_PREFIX} background notification task error: ${error.message}`);
        return;
      }
      if (data && 'actionIdentifier' in data) {
        const response = data as Notifications.NotificationResponse;
        await processResponse(
          response.actionIdentifier,
          response.notification.request.identifier
        );
      }
    }
  );

  Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((err) => {
    console.log(`${LOG_PREFIX} failed to register background notification task: ${err}`);
  });
}

/**
 * Called every tick from screenTimeTracker.ts. If the last-presented
 * reminder notification is no longer showing and nothing resolved it via
 * an action, treat it as swiped away / auto-cleared -> 'ignored'.
 */
export async function checkForIgnoredReminder(): Promise<void> {
  const pendingId = getPendingNotificationId();
  if (!pendingId) {
    return;
  }

  const stillPresented = ScreenTracker.isNotificationPresented(pendingId);
  if (!stillPresented) {
    setPendingNotificationId(null);
    console.log(`${LOG_PREFIX} reminder dismissed without an action -> ignored`);
    await onReminderResolved('ignored');
  }
}
