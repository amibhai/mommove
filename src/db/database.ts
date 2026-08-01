import * as SQLite from 'expo-sqlite';

/**
 * All SQL for the app lives here — nothing else should import
 * `expo-sqlite` directly. Every exported function opens (and, on first
 * call, creates) the database lazily via getDb(), so there's no separate
 * "did you call initDatabase() before this?" ordering requirement: the
 * very first query from *any* caller (headless tick, UI, debug button)
 * safely creates the schema if needed.
 */

const DATABASE_NAME = 'mommove.db';
const RETENTION_DAYS = 90;

export type ReminderActionTaken = 'done' | 'snoozed' | 'skipped' | 'ignored';

export interface ReminderLogEntry {
  timestamp: string; // ISO 8601
  triggerType: string;
  actionTaken: ReminderActionTaken;
  snoozeCount: number;
  responseTimeSec: number | null;
  sessionDurationMin: number | null;
  messageId: string | null;
  /** Synthetic row from a Developer Tools action, e.g. "Log 10 fake
   * entries" — never set by real reminder resolution. Defaults to false. */
  isDebug?: boolean;
}

export interface ReminderLogRow extends ReminderLogEntry {
  id: number;
}

export interface DailyCounts {
  total: number;
  done: number;
  snoozed: number;
  skipped: number;
  ignored: number;
}

export interface WeeklyRollupRow {
  weekStartDate: string;
  doneCount: number;
  snoozedCount: number;
  skippedCount: number;
  ignoredCount: number;
}

export const TRIGGER_TYPE_30MIN_CONTINUOUS_USE = '30min_continuous_use';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS reminder_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          trigger_type TEXT NOT NULL,
          action_taken TEXT NOT NULL,
          snooze_count INTEGER DEFAULT 0,
          response_time_sec INTEGER,
          session_duration_min INTEGER,
          message_id TEXT,
          is_debug INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS reminder_logs_weekly_rollup (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          week_start_date TEXT NOT NULL,
          done_count INTEGER DEFAULT 0,
          snoozed_count INTEGER DEFAULT 0,
          skipped_count INTEGER DEFAULT 0,
          ignored_count INTEGER DEFAULT 0
        );
      `);
      // CREATE TABLE IF NOT EXISTS only handles brand-new installs — this
      // covers any install created before is_debug existed. Swallows the
      // "duplicate column" error on every run after the first.
      await db.execAsync('ALTER TABLE reminder_logs ADD COLUMN is_debug INTEGER NOT NULL DEFAULT 0').catch(() => {});
      return db;
    })();
  }
  return dbPromise;
}

/** Optional explicit warm-up so the one-time schema creation doesn't delay
 * the very first real query. Not required for correctness — see getDb(). */
export async function initDatabase(): Promise<void> {
  await getDb();
}

function rowToEntry(row: {
  id: number;
  timestamp: string;
  trigger_type: string;
  action_taken: string;
  snooze_count: number;
  response_time_sec: number | null;
  session_duration_min: number | null;
  message_id: string | null;
  is_debug: number;
}): ReminderLogRow {
  return {
    id: row.id,
    timestamp: row.timestamp,
    triggerType: row.trigger_type,
    actionTaken: row.action_taken as ReminderActionTaken,
    snoozeCount: row.snooze_count,
    responseTimeSec: row.response_time_sec,
    sessionDurationMin: row.session_duration_min,
    messageId: row.message_id,
    isDebug: row.is_debug === 1,
  };
}

export async function insertReminderLog(entry: ReminderLogEntry): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO reminder_logs
       (timestamp, trigger_type, action_taken, snooze_count, response_time_sec, session_duration_min, message_id, is_debug)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.timestamp,
      entry.triggerType,
      entry.actionTaken,
      entry.snoozeCount,
      entry.responseTimeSec,
      entry.sessionDurationMin,
      entry.messageId,
      entry.isDebug ? 1 : 0,
    ]
  );
}

/**
 * Counts consecutive most-recent rows (ordered by timestamp desc) whose
 * action_taken is 'done', stopping at the first row that isn't. Reads the
 * last 200 rows and counts in JS rather than a single SQL window-function
 * query — simpler to reason about and plenty fast for realistic streak
 * lengths.
 */
export async function getCurrentDoneStreak(): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ action_taken: string }>(
    'SELECT action_taken FROM reminder_logs WHERE is_debug = 0 ORDER BY timestamp DESC, id DESC LIMIT 200'
  );

  let streak = 0;
  for (const row of rows) {
    if (row.action_taken !== 'done') {
      break;
    }
    streak += 1;
  }
  return streak;
}

function startOfTodayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
}

/**
 * Formats a Date as its *local* YYYY-MM-DD, unlike `date.toISOString().slice(0, 10)`
 * — which silently shifts to the UTC calendar date instead, off by a day for
 * any timezone ahead of UTC (including IST). Used wherever a Date needs to
 * become a display/grouping label rather than a query-bound instant.
 */
function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * "snoozed" here means "this resolved reminder was snoozed at least once
 * before it resolved" (snooze_count > 0) — not a separate terminal action,
 * since only done/skipped/ignored are ever written as action_taken today.
 * A row can count toward both e.g. done *and* snoozed.
 */
export async function getTodayCounts(): Promise<DailyCounts> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    total: number;
    done: number;
    skipped: number;
    ignored: number;
    snoozed: number;
  }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN action_taken = 'done' THEN 1 ELSE 0 END) as done,
       SUM(CASE WHEN action_taken = 'skipped' THEN 1 ELSE 0 END) as skipped,
       SUM(CASE WHEN action_taken = 'ignored' THEN 1 ELSE 0 END) as ignored,
       SUM(CASE WHEN snooze_count > 0 THEN 1 ELSE 0 END) as snoozed
     FROM reminder_logs
     WHERE timestamp >= ? AND is_debug = 0`,
    [startOfTodayIso()]
  );

  return {
    total: row?.total ?? 0,
    done: row?.done ?? 0,
    snoozed: row?.snoozed ?? 0,
    skipped: row?.skipped ?? 0,
    ignored: row?.ignored ?? 0,
  };
}

export interface DayDoneCount {
  /** ISO date, YYYY-MM-DD, local. */
  date: string;
  doneCount: number;
}

/** Done-count per day for the last 7 days (today inclusive), oldest first. */
export async function getLast7DaysDoneCounts(): Promise<DayDoneCount[]> {
  const db = await getDb();
  const today = new Date();
  const days: DayDoneCount[] = [];

  for (let i = 6; i >= 0; i--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0, 0);

    const row = await db.getFirstAsync<{ doneCount: number }>(
      `SELECT COUNT(*) as doneCount FROM reminder_logs
       WHERE action_taken = 'done' AND timestamp >= ? AND timestamp < ? AND is_debug = 0`,
      [dayStart.toISOString(), dayEnd.toISOString()]
    );

    days.push({
      date: toLocalDateString(dayStart),
      doneCount: row?.doneCount ?? 0,
    });
  }

  return days;
}

/**
 * Rolled-up weeks (from reminder_logs_weekly_rollup) so the Summary screen
 * can still show something for weeks whose raw rows have been pruned.
 * Most recent first.
 */
export async function getWeeklyRollups(limit = 8): Promise<WeeklyRollupRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    week_start_date: string;
    done_count: number;
    snoozed_count: number;
    skipped_count: number;
    ignored_count: number;
  }>(
    'SELECT * FROM reminder_logs_weekly_rollup ORDER BY week_start_date DESC LIMIT ?',
    [limit]
  );

  return rows.map((row) => ({
    weekStartDate: row.week_start_date,
    doneCount: row.done_count,
    snoozedCount: row.snoozed_count,
    skippedCount: row.skipped_count,
    ignoredCount: row.ignored_count,
  }));
}

/** Real rows only — this feeds the CSV export, which is her data, not test data. */
export async function getAllLogsForExport(): Promise<ReminderLogRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    timestamp: string;
    trigger_type: string;
    action_taken: string;
    snooze_count: number;
    response_time_sec: number | null;
    session_duration_min: number | null;
    message_id: string | null;
    is_debug: number;
  }>('SELECT * FROM reminder_logs WHERE is_debug = 0 ORDER BY timestamp ASC');

  return rows.map(rowToEntry);
}

/** [DEBUG-ONLY] Most recent N rows (including synthetic ones, so you can
 * confirm they were actually flagged), for the "Dump recent logs" button. */
export async function getRecentLogs(limit = 5): Promise<ReminderLogRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    timestamp: string;
    trigger_type: string;
    action_taken: string;
    snooze_count: number;
    response_time_sec: number | null;
    session_duration_min: number | null;
    message_id: string | null;
    is_debug: number;
  }>('SELECT * FROM reminder_logs ORDER BY timestamp DESC, id DESC LIMIT ?', [limit]);

  return rows.map(rowToEntry);
}

/** Monday (ISO date, local) of the week containing the given timestamp. */
function mondayOfWeek(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  return toLocalDateString(monday);
}

export interface PruneResult {
  prunedCount: number;
  rolledUpWeeks: number;
}

/**
 * Aggregates any reminder_logs rows older than 90 days into
 * reminder_logs_weekly_rollup (accumulating into an existing week's row if
 * one already exists), then deletes those raw rows. Rows are only ever
 * read and deleted once, so accumulating into an existing rollup row is
 * always safe (no double-counting).
 */
export async function pruneOldLogs(): Promise<PruneResult> {
  const db = await getDb();
  const cutoffIso = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const oldRows = await db.getAllAsync<{
    timestamp: string;
    action_taken: string;
    snooze_count: number;
    is_debug: number;
  }>(
    'SELECT timestamp, action_taken, snooze_count, is_debug FROM reminder_logs WHERE timestamp < ? ORDER BY timestamp ASC',
    [cutoffIso]
  );

  if (oldRows.length === 0) {
    return { prunedCount: 0, rolledUpWeeks: 0 };
  }

  const byWeek = new Map<
    string,
    { done: number; snoozed: number; skipped: number; ignored: number }
  >();

  for (const row of oldRows) {
    // Synthetic rows are purged along with everything else past retention,
    // but never rolled into the real weekly totals — see is_debug above.
    if (row.is_debug) {
      continue;
    }
    const weekStart = mondayOfWeek(row.timestamp);
    const bucket = byWeek.get(weekStart) ?? { done: 0, snoozed: 0, skipped: 0, ignored: 0 };
    if (row.action_taken === 'done') bucket.done += 1;
    else if (row.action_taken === 'skipped') bucket.skipped += 1;
    else if (row.action_taken === 'ignored') bucket.ignored += 1;
    if (row.snooze_count > 0) bucket.snoozed += 1;
    byWeek.set(weekStart, bucket);
  }

  for (const [weekStart, counts] of byWeek) {
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM reminder_logs_weekly_rollup WHERE week_start_date = ?',
      [weekStart]
    );

    if (existing) {
      await db.runAsync(
        `UPDATE reminder_logs_weekly_rollup
         SET done_count = done_count + ?,
             snoozed_count = snoozed_count + ?,
             skipped_count = skipped_count + ?,
             ignored_count = ignored_count + ?
         WHERE id = ?`,
        [counts.done, counts.snoozed, counts.skipped, counts.ignored, existing.id]
      );
    } else {
      await db.runAsync(
        `INSERT INTO reminder_logs_weekly_rollup
           (week_start_date, done_count, snoozed_count, skipped_count, ignored_count)
         VALUES (?, ?, ?, ?, ?)`,
        [weekStart, counts.done, counts.snoozed, counts.skipped, counts.ignored]
      );
    }
  }

  await db.runAsync('DELETE FROM reminder_logs WHERE timestamp < ?', [cutoffIso]);

  return { prunedCount: oldRows.length, rolledUpWeeks: byWeek.size };
}

const FAKE_ACTIONS: ReminderActionTaken[] = ['done', 'done', 'skipped', 'ignored', 'done'];

/** [DEBUG-ONLY] Inserts synthetic rows (flagged is_debug=1) spread over the
 * last few days, for exercising the Summary screen's rendering without
 * waiting for real 30-minute cycles. Flagged rows are excluded from every
 * real-facing query (today/week counts, streak, CSV export) — see is_debug
 * filters above — so this can never inflate what she actually sees. Logs a
 * summary of what it inserted to the console so
 * the result is predictable to check against. */
export async function insertFakeLogEntries(count: number): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const action = FAKE_ACTIONS[Math.floor(Math.random() * FAKE_ACTIONS.length)];
    const daysAgo = Math.floor(Math.random() * 6);
    const timestamp = new Date(now - daysAgo * 24 * 60 * 60 * 1000 - i * 60_000).toISOString();
    const snoozeCount = action === 'done' ? Math.floor(Math.random() * 3) : 0;

    await db.runAsync(
      `INSERT INTO reminder_logs
         (timestamp, trigger_type, action_taken, snooze_count, response_time_sec, session_duration_min, message_id, is_debug)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        timestamp,
        TRIGGER_TYPE_30MIN_CONTINUOUS_USE,
        action,
        snoozeCount,
        60 + Math.floor(Math.random() * 300),
        30,
        `fake-${action}-${i}`,
      ]
    );
  }

  console.log(`[MomMove:db] inserted ${count} fake log entries (flagged is_debug, excluded from her real Summary/streak/export)`);
}
