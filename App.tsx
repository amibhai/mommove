import React, { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import ScreenTracker from './modules/screen-tracker';
import HomeScreen from './src/screens/HomeScreen';
import PermissionOnboardingScreen from './src/screens/PermissionOnboardingScreen';
import { requestNotificationPermission } from './src/services/notifications';
import { getIsPausedToday } from './src/services/preferencesStore';
import { startScreenTimeTracking } from './src/services/screenTimeTracker';

type Stage = 'onboarding' | 'ready';

export default function App() {
  // Usage Access can be checked synchronously, so the initial stage is
  // known before the first render — no flash of the wrong screen.
  const [stage, setStage] = useState<Stage>(() =>
    ScreenTracker.hasUsageAccessPermission() ? 'ready' : 'onboarding'
  );

  useEffect(() => {
    if (stage === 'ready') {
      startScreenTimeTracking();
    }
  }, [stage]);

  useEffect(() => {
    // getIsPausedToday() clears the flag as a side effect once its midnight
    // deadline has passed — the reminder gate already calls this every
    // tick, but checking explicitly on launch/foreground means a stale
    // "paused" state never lingers in the debug UI either.
    getIsPausedToday();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        getIsPausedToday();
      }
    });
    return () => subscription.remove();
  }, []);

  const handlePermissionGranted = useCallback(async () => {
    await requestNotificationPermission();
    setStage('ready');
  }, []);

  if (stage === 'onboarding') {
    return <PermissionOnboardingScreen onGranted={handlePermissionGranted} />;
  }

  return <HomeScreen />;
}
