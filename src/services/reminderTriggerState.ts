/**
 * In-memory bookkeeping for the *current* reminder trigger cycle. No
 * persistence yet (Phase 5 adds real logging) — per the Phase 3 brief this
 * is fine as module state, since MomMove's own foreground service
 * (ScreenTrackerService) keeps the process — and this module — alive for
 * as long as tracking is active. The only way this resets unexpectedly is
 * if Android kills the process despite the foreground service (rare, but
 * some OEM battery managers do it anyway) — a known, accepted limitation
 * until Phase 5's persistence lands.
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
