import { MESSAGE_POOL, type MessageTimeOfDay, type MessageTone, type ReminderMessage } from '../config/messagePool';

const RECENT_HISTORY_SIZE = 3;

let recentlyUsedIds: string[] = [];

// [DEBUG-ONLY] So the debug panel can show what was actually picked, for
// on-device verification without waiting for a real 30-minute trigger.
let lastSelectedMessage: string | null = null;

export function getCurrentTimeOfDay(): MessageTimeOfDay {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function matchesTimeOfDay(message: ReminderMessage, timeOfDay: MessageTimeOfDay): boolean {
  return message.timeOfDay.length === 0 || message.timeOfDay.includes(timeOfDay);
}

/**
 * Picks one message for the given tone + time of day, avoiding the last 3
 * IDs used (regardless of their tone), and substitutes {name}.
 *
 * Falls back to ignoring the time-of-day restriction, and then to ignoring
 * the recent-use exclusion, rather than ever throwing — the pool always has
 * at least one match for every tone, so this only ever broadens the
 * candidate set, never narrows past empty.
 */
export function selectMessage(tone: MessageTone, timeOfDay: MessageTimeOfDay, name: string): string {
  const byToneAndTime = MESSAGE_POOL.filter(
    (m) => m.tone === tone && matchesTimeOfDay(m, timeOfDay)
  );
  const byToneOnly = MESSAGE_POOL.filter((m) => m.tone === tone);
  const candidates = byToneAndTime.length > 0 ? byToneAndTime : byToneOnly;

  const notRecentlyUsed = candidates.filter((m) => !recentlyUsedIds.includes(m.id));
  const pool = notRecentlyUsed.length > 0 ? notRecentlyUsed : candidates;

  const chosen = pool[Math.floor(Math.random() * pool.length)];

  recentlyUsedIds = [chosen.id, ...recentlyUsedIds].slice(0, RECENT_HISTORY_SIZE);

  const text = chosen.template.replace('{name}', name);
  lastSelectedMessage = text;
  return text;
}

export function getLastSelectedMessage(): string | null {
  return lastSelectedMessage;
}
