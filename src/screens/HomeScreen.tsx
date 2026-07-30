import React, { useCallback, useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getIsPausedToday, setPauseToday } from '../services/preferencesStore';
import { checkReminderGate, type ReminderGateResult } from '../services/reminderGating';
import { getSnoozeCount } from '../services/reminderTriggerState';
import { getDebugContinuousTimeSec } from '../services/screenTimeTracker';

// [DEBUG-ONLY, TEMPORARY] Live readout of tracker/reminder-engine state, so
// correctness can be verified on-device without needing `adb logcat` for
// every check. Remove this block (and the imports above) once the real
// Settings screen (Phase 6) replaces the Pause Today toggle below.
function DebugPanel() {
  const [seconds, setSeconds] = useState(getDebugContinuousTimeSec());
  const [snoozeCount, setSnoozeCount] = useState(getSnoozeCount());
  const [gate, setGate] = useState<ReminderGateResult>({ suppressed: false });
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(getDebugContinuousTimeSec());
      setSnoozeCount(getSnoozeCount());
      checkReminderGate().then(setGate);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    getIsPausedToday().then(setPaused);
  }, []);

  const togglePause = useCallback(async () => {
    const next = !paused;
    await setPauseToday(next);
    setPaused(next);
  }, [paused]);

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
      <Text style={styles.debugValue}>
        {gate.suppressed ? gate.reason : 'none'}
      </Text>

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

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <Text style={styles.title}>MomMove</Text>
        <Text style={styles.subtitle}>
          Setup complete — reminder features coming soon
        </Text>
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
  debugBox: {
    marginTop: 40,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7C5CFC',
    alignItems: 'center',
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
