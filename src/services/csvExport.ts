import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getAllLogsForExport, type ReminderLogRow } from '../db/database';

const CSV_HEADER = [
  'id',
  'timestamp',
  'trigger_type',
  'action_taken',
  'snooze_count',
  'response_time_sec',
  'session_duration_min',
  'message_id',
];

function csvEscape(value: string | number | null): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function rowToCsvLine(row: ReminderLogRow): string {
  return [
    row.id,
    row.timestamp,
    row.triggerType,
    row.actionTaken,
    row.snoozeCount,
    row.responseTimeSec,
    row.sessionDurationMin,
    row.messageId,
  ]
    .map(csvEscape)
    .join(',');
}

function buildCsv(rows: ReminderLogRow[]): string {
  return [CSV_HEADER.join(','), ...rows.map(rowToCsvLine)].join('\n');
}

/**
 * Exports every reminder_logs row as a CSV file and opens the native share
 * sheet so it can be saved or sent elsewhere. This is a utility for your
 * own review, not something she needs — kept simple/unpolished on purpose.
 */
export async function exportLogsAsCsv(): Promise<void> {
  const rows = await getAllLogsForExport();
  const csv = buildCsv(rows);

  const file = new File(Paths.cache, `mommove-logs-${Date.now()}.csv`);
  file.create({ overwrite: true });
  file.write(csv);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export MomMove logs',
  });
}
