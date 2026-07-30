import { getActiveHours, getIsPausedToday } from './preferencesStore';

export type ReminderGateResult =
  | { suppressed: false }
  | { suppressed: true; reason: 'paused-today' | 'quiet-hours' };

/**
 * Checked right before firing a reminder. Suppressing here never touches
 * the continuous-time counter — that's the caller's job — so exactly one
 * reminder fires as soon as the suppression lifts, instead of a pile of
 * overdue ones.
 */
export async function checkReminderGate(): Promise<ReminderGateResult> {
  if (await getIsPausedToday()) {
    return { suppressed: true, reason: 'paused-today' };
  }

  const { start, end } = await getActiveHours();
  const hour = new Date().getHours();
  const withinActiveHours =
    start <= end
      ? hour >= start && hour < end
      : hour >= start || hour < end; // overnight window, e.g. 22 -> 6

  if (!withinActiveHours) {
    return { suppressed: true, reason: 'quiet-hours' };
  }

  return { suppressed: false };
}
