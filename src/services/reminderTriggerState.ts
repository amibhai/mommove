/**
 * In-memory bookkeeping for the *current, still-unresolved* reminder
 * trigger cycle. This is intentionally never persisted — once a trigger
 * resolves (done/skip/ignored), reminderActions.ts reads these values to
 * write one permanent row to SQLite (src/db/database.ts), then clears
 * them. Living only in memory is fine per the Phase 3 brief, since
 * MomMove's own foreground service (ScreenTrackerService) keeps the
 * process — and this module — alive for as long as tracking is active.
 * The only way this resets unexpectedly is if Android kills the process
 * despite the foreground service (rare, but some OEM battery managers do
 * it anyway) — in that case the in-flight trigger's log row is simply
 * never written, a known, accepted gap.
 */

let snoozeCount = 0;

export function getSnoozeCount(): number {
  return snoozeCount;
}

export function incrementSnoozeCount(): number {
  snoozeCount += 1;
  return snoozeCount;
}

/** Reset on Done/Skip, and whenever a fresh 30-minute cycle begins. */
export function resetSnoozeCount(): void {
  snoozeCount = 0;
}

// --- Trigger counting (for occasional tone variety) ---
//
// Counts fresh 30-minute-cycle notifications (not snooze follow-ups), so
// notifications.ts can pull a 'warm' message every Nth trigger instead of
// always 'casual'. In-memory only, same rationale as snoozeCount above.

let triggerCount = 0;

export function incrementTriggerCount(): number {
  triggerCount += 1;
  return triggerCount;
}

export function getTriggerCount(): number {
  return triggerCount;
}

// --- "Ignored" detection bookkeeping ---
//
// expo-notifications doesn't expose Android's swipe-to-dismiss signal (it
// never wires up `setDeleteIntent`), so we can't be told directly that a
// notification was swiped away. Instead, screenTimeTracker's tick polls
// whether the last-presented reminder notification is still in the shade
// (via the native isNotificationPresented check) and treats "gone, but
// never resolved by an action" as ignored. See reminderActions.ts.

let pendingNotificationId: string | null = null;

export function setPendingNotificationId(id: string | null): void {
  pendingNotificationId = id;
}

export function getPendingNotificationId(): string | null {
  return pendingNotificationId;
}

// --- Fields captured for the eventual reminder_logs row (Phase 5) ---
//
// - triggerFiredAtMs / triggerSessionDurationMin are set exactly once per
//   trigger cycle, at the *original* fresh 30-minute fire (see
//   screenTimeTracker.ts) — they don't change across subsequent snoozes,
//   since response_time_sec should measure the whole cycle, and
//   session_duration_min describes what caused the trigger in the first
//   place.
// - lastShownMessageId updates on *every* fire for this trigger (fresh or
//   snoozed — see notifications.ts), since it should reflect whichever
//   message was actually on screen when she finally resolved it.

let triggerFiredAtMs: number | null = null;
let triggerSessionDurationMin: number | null = null;
let lastShownMessageId: string | null = null;

export function markTriggerFired(sessionDurationMin: number): void {
  triggerFiredAtMs = Date.now();
  triggerSessionDurationMin = sessionDurationMin;
}

export function getTriggerFiredAtMs(): number | null {
  return triggerFiredAtMs;
}

export function getTriggerSessionDurationMin(): number | null {
  return triggerSessionDurationMin;
}

export function setLastShownMessageId(id: string | null): void {
  lastShownMessageId = id;
}

export function getLastShownMessageId(): string | null {
  return lastShownMessageId;
}

/** Called once a trigger has resolved and its log row has been written. */
export function clearTriggerFiredState(): void {
  triggerFiredAtMs = null;
  triggerSessionDurationMin = null;
  lastShownMessageId = null;
}
