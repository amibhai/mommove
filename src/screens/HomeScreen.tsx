import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

import { getDebugContinuousTimeSec } from '../services/screenTimeTracker';

// [DEBUG-ONLY, TEMPORARY] Live readout of the tracker's continuousTime, so
// correctness can be verified on-device without needing `adb logcat` for
// every check. Remove this block (and the import above) before Phase 3 if
// it's no longer needed.
function DebugCounter() {
  const [seconds, setSeconds] = useState(getDebugContinuousTimeSec());

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(getDebugContinuousTimeSec());
    }, 1000);
    return () => clearInterval(interval);
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
        {__DEV__ ? <DebugCounter /> : null}
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
    paddingVertical: 12,
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
  debugValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
});
