import { AppRegistry } from 'react-native';

import ScreenTracker from '../../modules/screen-tracker';
import {
  BREAK_RESET_GAP_MIN,
  CONTINUOUS_TIME_THRESHOLD_MIN,
  TRACKING_TICK_INTERVAL_SEC,
} from '../config/reminderConfig';
import { fireReminderNotification, toneForFreshTrigger } from './notifications';
import { getReminderTiming } from './preferencesStore';
import { checkForIgnoredReminder } from './reminderActions';
import { checkReminderGate } from './reminderGating';
import { incrementTriggerCount, markTriggerFired, resetSnoozeCount } from './reminderTriggerState';

const HEADLESS_TASK_NAME = 'ScreenTimeTrackerTask';

// [DEV LOG] Prefixed so it's easy to grep via `adb logcat | grep MomMove`.
const LOG_PREFIX = '[MomMove:tracker]';

// Persists across repeated Headless task invocations because the JS engine
// itself stays resident (only reset by a real app/process restart). Also
// mirrored into native memory (see below) so it's robust either way.
let continuousTimeSec = 0;
let lastTickAtMs: number | null = null;

// Cached copies of the (now user-adjustable, Phase 6) threshold/gap. tick()
// only ever reads these two vars — never AsyncStorage directly — so the 15s
// hot loop never waits on storage I/O. They're refreshed in exactly two
// places: when tracking (re)starts, and when Settings explicitly saves a
// change (see refreshTrackerConfig()). See README for the reliability
// tradeoff this implies.
let cachedThresholdMin = CONTINUOUS_TIME_THRESHOLD_MIN;
let cachedGapMin = BREAK_RESET_GAP_MIN;

async function loadTrackerConfig(): Promise<void> {
  const { thresholdMin, gapMin } = await getReminderTiming();
  cachedThresholdMin = thresholdMin;
  cachedGapMin = gapMin;
  console.log(
    `${LOG_PREFIX} config loaded: threshold=${cachedThresholdMin}min gap=${cachedGapMin}min`
  );
}

/** Called by the Settings screen right after saving a new threshold/gap,
 * so the change is picked up on the very next tick instead of waiting for
 * the next app/service restart. */
export async function refreshTrackerConfig(): Promise<void> {
  await loadTrackerConfig();
}

/**
 * One evaluation of the reminder state machine. Invoked repeatedly by the
 * native ScreenTrackerService on a fixed schedule (see
 * modules/screen-tracker's ScreenTrackerService.kt) — this is intentionally
 * a single short tick, not a long-running loop, so it fits the Headless JS
 * task model cleanly.
 */
async function tick(): Promise<void> {
  await checkForIgnoredReminder();

  const now = Date.now();
  const elapsedSec = lastTickAtMs ? (now - lastTickAtMs) / 1000 : 0;
  lastTickAtMs = now;

  const { isScreenOn, msSinceTransition } = ScreenTracker.getScreenState();

  if (isScreenOn) {
    continuousTimeSec += elapsedSec;
    console.log(
      `${LOG_PREFIX} screen ON (+${elapsedSec.toFixed(1)}s) -> continuousTime=${continuousTimeSec.toFixed(1)}s`
    );
  } else {
    const offMinutes = msSinceTransition / 60_000;
    if (offMinutes >= cachedGapMin) {
      if (continuousTimeSec > 0) {
        console.log(
          `${LOG_PREFIX} real break detected (screen off ${offMinutes.toFixed(1)}min >= ${cachedGapMin}min gap) -> reset continuousTime to 0`
        );
      }
      continuousTimeSec = 0;
    } else {
      console.log(
        `${LOG_PREFIX} screen off, only ${offMinutes.toFixed(1)}min (< ${cachedGapMin}min reset gap) -> not a break yet, continuousTime holds at ${continuousTimeSec.toFixed(1)}s`
      );
    }
  }

  ScreenTracker.setDebugContinuousTimeSec(Math.round(continuousTimeSec));

  const thresholdSec = cachedThresholdMin * 60;
  if (continuousTimeSec >= thresholdSec) {
    const gate = await checkReminderGate();
    if (gate.suppressed) {
      console.log(
        `${LOG_PREFIX} threshold reached but suppressed (${gate.reason}) -> not firing, continuousTime holds at ${continuousTimeSec.toFixed(1)}s`
      );
    } else {
      console.log(
        `${LOG_PREFIX} continuousTime reached ${cachedThresholdMin}min threshold -> firing reminder notification`
      );
      // A fresh cycle begins: wipe any leftover snooze count from a
      // previous, never-resolved trigger. (The fired notification's
      // identifier is captured by the "received" listener in
      // reminderActions.ts once it's actually presented.)
      resetSnoozeCount();
      const triggerCount = incrementTriggerCount();
      // Captured once, here, for the eventual log row — session_duration_min
      // describes what caused this trigger, so it must be read before the
      // reset below, and shouldn't change across any later snoozes.
      markTriggerFired(Math.round(continuousTimeSec / 60));
      await fireReminderNotification({ tone: toneForFreshTrigger(triggerCount) });
      continuousTimeSec = 0;
      ScreenTracker.setDebugContinuousTimeSec(0);
    }
  }
}

/**
 * Must be called exactly once, at JS bundle load (see index.ts) — before
 * any component renders — so the task is registered whether the process was
 * started headlessly (by the foreground service) or normally (by opening
 * the app).
 */
export function registerScreenTimeTrackerHeadlessTask(): void {
  AppRegistry.registerHeadlessTask(HEADLESS_TASK_NAME, () => tick);
}

/** Starts the native foreground service that ticks the task above. */
export function startScreenTimeTracking(): void {
  lastTickAtMs = null;
  continuousTimeSec = 0;
  ScreenTracker.setDebugContinuousTimeSec(0);
  // Fire-and-forget: picks up whatever was last saved. There's a brief
  // (sub-second, one-time) window where the very first tick or two could
  // still see the previous cached/default values while this resolves —
  // harmless, and far simpler than making startup itself async just to
  // avoid it. See README for the full reliability tradeoff.
  void loadTrackerConfig();
  ScreenTracker.startTracking(TRACKING_TICK_INTERVAL_SEC);
}

export function stopScreenTimeTracking(): void {
  ScreenTracker.stopTracking();
}

/**
 * [DEBUG-ONLY] Read the live continuousTime value for the Home screen's
 * temporary on-screen counter. Reads from native memory (mirrored every
 * tick) rather than the module-local variable above, since the Headless
 * task and the visible app UI are not guaranteed to share the same JS
 * context. Remove alongside the debug readout once a real UI replaces it.
 */
export function getDebugContinuousTimeSec(): number {
  return ScreenTracker.getDebugContinuousTimeSec();
}
