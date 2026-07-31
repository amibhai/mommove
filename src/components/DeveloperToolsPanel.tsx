import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  getCurrentDoneStreak,
  getRecentLogs,
  insertFakeLogEntries,
  pruneOldLogs,
} from '../db/database';
import { getLastSelectedMessage } from '../services/messageSelector';
import { fireReminderNotification } from '../services/notifications';
import { onReminderResolved } from '../services/reminderActions';
import { checkReminderGate, type ReminderGateResult } from '../services/reminderGating';
import { getSnoozeCount } from '../services/reminderTriggerState';
import { getDebugContinuousTimeSec } from '../services/screenTimeTracker';

/**
 * Every debug-only tool built across Phases 2–5, consolidated here behind
 * the hidden "tap the version number 5×" gesture on the Settings screen
 * (see SettingsScreen.tsx). Kept as a superset of what later phases will
 * still need for testing — not trimmed down, just moved out of the way of
 * the real, user-facing settings.
 */
export default function DeveloperToolsPanel() {
  const [seconds, setSeconds] = useState(getDebugContinuousTimeSec());
  const [snoozeCount, setSnoozeCount] = useState(getSnoozeCount());
  const [gate, setGate] = useState<ReminderGateResult>({ suppressed: false });
  const [lastMessage, setLastMessage] = useState(getLastSelectedMessage());
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(getDebugContinuousTimeSec());
      setSnoozeCount(getSnoozeCount());
      setLastMessage(getLastSelectedMessage());
      checkReminderGate().then(setGate);
      getCurrentDoneStreak().then(setStreak);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');

  const fireTestNotification = () => void fireReminderNotification({ tone: 'casual' });
  const simulateDone = () => void onReminderResolved('done');
  const simulateSkip = () => void onReminderResolved('skip');
  const logFakeEntries = () => void insertFakeLogEntries(10);

  const forcePruneCheck = () => {
    pruneOldLogs().then(({ prunedCount, rolledUpWeeks }) => {
      console.log(
        `[MomMove:db] force prune check: pruned=${prunedCount} rolledUpWeeks=${rolledUpWeeks}`
      );
    });
  };

  const dumpRecentLogs = () => {
    getRecentLogs(5).then((rows) => {
      console.log('[MomMove:db] most recent log rows:', JSON.stringify(rows, null, 2));
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Developer Tools</Text>
      <Text style={styles.subheading}>Not visible to her — testing only.</Text>

      <View style={styles.readouts}>
        <ReadoutRow label="Continuous time" value={`${mm}:${ss}`} />
        <ReadoutRow label="Snooze count" value={String(snoozeCount)} />
        <ReadoutRow label="Suppression" value={gate.suppressed ? gate.reason : 'none'} />
        <ReadoutRow label="Streak" value={String(streak)} />
      </View>

      <Text style={styles.lastMessageLabel}>Last message shown</Text>
      <Text style={styles.lastMessageValue}>{lastMessage ?? '(none yet)'}</Text>

      <View style={styles.buttonGrid}>
        <DevButton label="Fire test notification" onPress={fireTestNotification} />
        <DevButton label="Simulate Done" onPress={simulateDone} />
        <DevButton label="Simulate Skip" onPress={simulateSkip} />
        <DevButton label="Log 10 fake entries" onPress={logFakeEntries} />
        <DevButton label="Force prune check" onPress={forcePruneCheck} />
        <DevButton label="Dump recent logs (console)" onPress={dumpRecentLogs} />
      </View>
    </View>
  );
}

function ReadoutRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.readoutRow}>
      <Text style={styles.readoutLabel}>{label}</Text>
      <Text style={styles.readoutValue}>{value}</Text>
    </View>
  );
}

function DevButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} accessibilityRole="button">
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#5A4E8A',
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFD479',
  },
  subheading: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9E92C4',
    marginTop: 2,
    marginBottom: 16,
  },
  readouts: {
    marginBottom: 16,
  },
  readoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  readoutLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#B7A9FF',
  },
  readoutValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  lastMessageLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B7A9FF',
    marginBottom: 4,
  },
  lastMessageValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  buttonGrid: {
    gap: 10,
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#3A2E70',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
