import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import ScreenTracker from '../../modules/screen-tracker';

type Props = {
  /** Called once the user has granted Usage Access and tapped Continue. */
  onGranted: () => void;
};

export default function PermissionOnboardingScreen({ onGranted }: Props) {
  const [granted, setGranted] = useState(false);
  const [hasOpenedSettings, setHasOpenedSettings] = useState(false);
  const appState = useRef(AppState.currentState);

  const checkPermission = useCallback(() => {
    setGranted(ScreenTracker.hasUsageAccessPermission());
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Usage Access can only be granted by leaving the app (into Settings) and
  // coming back — so re-check whenever we return to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        checkPermission();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [checkPermission]);

  const handleOpenSettings = () => {
    setHasOpenedSettings(true);
    ScreenTracker.openUsageAccessSettings();
  };

  if (granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.container}>
          <Text style={styles.title}>All set ✅</Text>
          <Text style={styles.body}>
            MomMove can now keep an eye on your screen time and remind you to
            take a stretch break.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={onGranted}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <Text style={styles.title}>One quick step</Text>
        <Text style={styles.body}>
          MomMove needs permission to notice how long you've been sitting
          with your phone on, so it can remind you to get up and stretch.
        </Text>
        <Text style={styles.body}>
          This stays entirely on your phone. Nothing is ever sent anywhere.
        </Text>
        {hasOpenedSettings && !granted ? (
          <Text style={styles.retryText}>
            Didn't see it change? Find "MomMove" in the list, turn it on, then
            come back here.
          </Text>
        ) : null}
        <TouchableOpacity
          style={styles.button}
          onPress={handleOpenSettings}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Open Settings</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  body: {
    fontSize: 20,
    fontWeight: '500',
    color: '#E6E1FF',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFD479',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#7C5CFC',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    minWidth: 260,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
