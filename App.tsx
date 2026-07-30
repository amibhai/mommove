import React, { useCallback, useEffect, useState } from 'react';

import ScreenTracker from './modules/screen-tracker';
import HomeScreen from './src/screens/HomeScreen';
import PermissionOnboardingScreen from './src/screens/PermissionOnboardingScreen';
import { requestNotificationPermission } from './src/services/notifications';
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

  const handlePermissionGranted = useCallback(async () => {
    await requestNotificationPermission();
    setStage('ready');
  }, []);

  if (stage === 'onboarding') {
    return <PermissionOnboardingScreen onGranted={handlePermissionGranted} />;
  }

  return <HomeScreen />;
}
