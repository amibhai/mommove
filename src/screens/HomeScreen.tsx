import React, { useCallback, useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import ReinforcementBanner from '../components/ReinforcementBanner';
import { getCurrentDoneStreak, insertFakeLogEntries, getRecentLogs, pruneOldLogs } from '../db/database';
import { getLastSelectedMessage } from '../services/messageSelector';
import { fireReminderNotification } from '../services/notifications';
import {
  DEFAULT_USER_NAME,
  getIsPausedToday,
  getUserName,
  setPauseToday,
  setUserName,
} from '../services/preferencesStore';
import { onReminderResolved } from '../services/reminderActions';
import { checkReminderGate, type ReminderGateResult } from '../services/reminderGating';
import { getSnoozeCount } from '../services/reminderTriggerState';
import { getDebugContinuousTimeSec } from '../services/screenTimeTracker';
import { consumePendingReinforcement } from '../services/streakTracker';

const TEST_NAME = 'Anita';

// [DEBUG-ONLY, TEMPORARY] Live readout of tracker/reminder-engine state, so
// correctness can be verified on-device without needing `adb logcat` for
// every check. Remove this block (and the imports above) once the real
// Settings screen (Phase 6) replaces the Pause Today/name-testing buttons.
function DebugPanel() {
  const [seconds, setSeconds] = useState(getDebugContinuousTimeSec());
  const [snoozeCount, setSnoozeCount] = useState(getSnoozeCount());
  const [gate, setGate] = useState<ReminderGateResult>({ suppressed: false });
  const [paused, setPaused] = useState(false);
  const [lastMessage, setLastMessage] = useState(getLastSelectedMessage());
  const [streak, setStreak] = useState(0);
  const [userName, setUserNameState] = useState(DEFAULT_USER_NAME);

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

  useEffect(() => {
    getIsPausedToday().then(setPaused);
    getUserName().then(setUserNameState);
  }, []);

  const togglePause = useCallback(async () => {
    const next = !paused;
    await setPauseToday(next);
    setPaused(next);
  }, [paused]);

  const toggleTestName = useCallback(async () => {
    const next = userName === DEFAULT_USER_NAME ? TEST_NAME : DEFAULT_USER_NAME;
    await setUserName(next);
    setUserNameState(next);
  }, [userName]);

  const fireTestNotification = useCallback(() => {
    void fireReminderNotification({ tone: 'casual' });
  }, []);

  const simulateDone = useCallback(() => {
    void onReminderResolved('done');
  }, []);

  const simulateSkip = useCallback(() => {
    void onReminderResolved('skip');
  }, []);

  const logFakeEntries = useCallback(() => {
    void insertFakeLogEntries(10);
  }, []);

  const forcePruneCheck = useCallback(() => {
    pruneOldLogs().then(({ prunedCount, rolledUpWeeks }) => {
      console.log(
        `[MomMove:db] force prune check: pruned=${prunedCount} rolledUpWeeks=${rolledUpWeeks}`
      );
    });
  }, []);

  const dumpRecentLogs = useCallback(() => {
    getRecentLogs(5).then((rows) => {
      console.log('[MomMove:db] most recent log rows:', JSON.stringify(rows, null, 2));
    });
  }, []);

  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');

  return (
    <View style={styles.debugBox}>
      <Text style={styles.debugLabel}>DEBUG · continuous time</Text>
      <Text style={styles.debugValue}>
        {mm}:{ss}
      </Text>

      <Text style={[styles.debugLabel, styles.debugLabelSpaced]}>DEBUG · snooze count</Text>
      <Text style={styles.debugValue}>{snoozeCount}</Text>

      <Text style={[styles.debugLabel, styles.debugLabelSpaced]}>DEBUG · suppression</Text>
      <Text style={styles.debugValue}>{gate.suppressed ? gate.reason : 'none'}</Text>

      <Text style={[styles.debugLabel, styles.debugLabelSpaced]}>DEBUG · streak (Done in a row)</Text>
      <Text style={styles.debugValue}>{streak}</Text>

      <Text style={[styles.debugLabel, styles.debugLabelSpaced]}>DEBUG · last message ({userName})</Text>
      <Text style={styles.debugMessage}>{lastMessage ?? '(none yet)'}</Text>

      <TouchableOpacity style={styles.debugActionButton} onPress={fireTestNotification} accessibilityRole="button">
        <Text style={styles.debugActionButtonText}>Fire test notification</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.debugActionButton} onPress={toggleTestName} accessibilityRole="button">
        <Text style={styles.debugActionButtonText}>
          Name: {userName} · tap to switch
        </Text>
      </TouchableOpacity>

      <View style={styles.debugRow}>
        <TouchableOpacity style={styles.debugSmallButton} onPress={simulateDone} accessibilityRole="button">
          <Text style={styles.debugActionButtonText}>Simulate Done</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.debugSmallButton} onPress={simulateSkip} accessibilityRole="button">
          <Text style={styles.debugActionButtonText}>Simulate Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.debugRow}>
        <TouchableOpacity style={styles.debugSmallButton} onPress={logFakeEntries} accessibilityRole="button">
          <Text style={styles.debugActionButtonText}>Log 10 fake entries</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.debugSmallButton} onPress={forcePruneCheck} accessibilityRole="button">
          <Text style={styles.debugActionButtonText}>Force prune check</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.debugActionButton} onPress={dumpRecentLogs} accessibilityRole="button">
        <Text style={styles.debugActionButtonText}>Dump recent logs (console)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.pauseButton, paused && styles.pauseButtonActive]}
        onPress={togglePause}
        accessibilityRole="button"
      >
        <Text style={[styles.pauseButtonText, paused && styles.pauseButtonTextActive]}>
          {paused ? 'Paused today · tap to resume' : 'Pause Today'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

type Props = {
  onOpenSummary: () => void;
};

export default function HomeScreen({ onOpenSummary }: Props) {
  const [reinforcementMessage, setReinforcementMessage] = useState<string | null>(null);

  useEffect(() => {
    consumePendingReinforcement().then((milestone) => {
      if (milestone !== null) {
        setReinforcementMessage(`Nice — that's ${milestone} in a row today 💪`);
      }
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {reinforcementMessage ? (
          <ReinforcementBanner
            message={reinforcementMessage}
            onHide={() => setReinforcementMessage(null)}
          />
        ) : null}
        <Text style={styles.title}>MomMove</Text>
        <Text style={styles.subtitle}>
          Setup complete — reminder features coming soon
        </Text>

        <TouchableOpacity
          style={styles.summaryButton}
          onPress={onOpenSummary}
          accessibilityRole="button"
        >
          <Text style={styles.summaryButtonText}>View Summary</Text>
        </TouchableOpacity>

        {__DEV__ ? <DebugPanel /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A1533',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#E6E1FF',
    textAlign: 'center',
  },
  summaryButton: {
    marginTop: 28,
    backgroundColor: '#7C5CFC',
    paddingVertical: 18,
    paddingHorizontal: 36,
    borderRadius: 14,
    minWidth: 240,
    alignItems: 'center',
  },
  summaryButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  debugBox: {
    marginTop: 40,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7C5CFC',
    alignItems: 'center',
    maxWidth: 340,
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B7A9FF',
    letterSpacing: 1,
  },
  debugLabelSpaced: {
    marginTop: 12,
  },
  debugValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  debugMessage: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'center',
  },
  debugActionButton: {
    marginTop: 12,
    backgroundColor: '#3A2E70',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  debugActionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  debugRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  debugSmallButton: {
    backgroundColor: '#3A2E70',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  pauseButton: {
    marginTop: 16,
    backgroundColor: '#7C5CFC',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  pauseButtonActive: {
    backgroundColor: '#FFD479',
  },
  pauseButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pauseButtonTextActive: {
    color: '#1A1533',
  },
});
