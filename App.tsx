import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { pruneOldLogs } from './src/db/database';
import ScreenTracker from './modules/screen-tracker';
import HomeScreen from './src/screens/HomeScreen';
import PermissionOnboardingScreen from './src/screens/PermissionOnboardingScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import { requestNotificationPermission } from './src/services/notifications';
import { getIsPausedToday } from './src/services/preferencesStore';
import { startScreenTimeTracking, stopScreenTimeTracking } from './src/services/screenTimeTracker';
import { checkForUpdate } from './src/services/updateChecker';

type Stage = 'onboarding' | 'ready';

const Tab = createBottomTabNavigator();

function tabIcon(emoji: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>
  );
}

export default function App() {
  // Usage Access can be checked synchronously, so the initial stage is
  // known before the first render — no flash of the wrong screen.
  const [stage, setStage] = useState<Stage>(() =>
    ScreenTracker.hasUsageAccessPermission() ? 'ready' : 'onboarding'
  );

  // Guards requestNotificationPermission() to fire exactly once per app
  // session, from whichever path reaches 'ready' first — see the effect
  // below. Without this, denying the dialog once during normal onboarding
  // could immediately re-trigger it a second time back-to-back (Android
  // only stops re-prompting after a *second* denial), which reads as a
  // broken double-prompt rather than the intended single ask.
  const notificationPermissionHandledRef = useRef(false);

  useEffect(() => {
    if (stage === 'ready') {
      startScreenTimeTracking();
      // Covers the case where the app starts *directly* in 'ready' — Usage
      // Access can already be granted at cold start (e.g. it can survive an
      // uninstall/reinstall on some Android versions), which would skip
      // PermissionOnboardingScreen's "Continue" handler entirely and, before
      // this, meant notification permission was never requested at all.
      if (!notificationPermissionHandledRef.current) {
        notificationPermissionHandledRef.current = true;
        requestNotificationPermission();
      }
    }
  }, [stage]);

  useEffect(() => {
    // Usage Access can be revoked without her ever opening MomMove — Android
    // sometimes does this on its own after long inactivity, or she could
    // turn it off by accident while poking around Settings. There's no
    // push notification for that, so the only reliable place to notice is
    // right when the app comes back to the foreground. If it's gone, drop
    // back to the same onboarding screen used on first launch — a calm,
    // already-built re-prompt — rather than continuing to "track" nothing.
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && stage === 'ready' && !ScreenTracker.hasUsageAccessPermission()) {
        stopScreenTimeTracking();
        setStage('onboarding');
      }
    });
    return () => subscription.remove();
  }, [stage]);

  useEffect(() => {
    // getIsPausedToday() clears the flag as a side effect once its midnight
    // deadline has passed — the reminder gate already calls this every
    // tick, but checking explicitly on launch/foreground means a stale
    // "paused" state never lingers in Settings either.
    getIsPausedToday();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        getIsPausedToday();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Fire-and-forget: a lightweight check that should never block/delay
    // startup. Most launches find nothing older than 90 days and no-op.
    pruneOldLogs()
      .then(({ prunedCount, rolledUpWeeks }) => {
        if (prunedCount > 0) {
          console.log(
            `[MomMove:db] pruned ${prunedCount} old log row(s) into ${rolledUpWeeks} weekly rollup(s)`
          );
        }
      })
      .catch((err) => {
        console.log(`[MomMove:db] prune check failed: ${err}`);
      });
  }, []);

  useEffect(() => {
    // Also fire-and-forget: checkForUpdate() never throws (see
    // updateChecker.ts), so no .catch is needed here — a failed/offline
    // fetch just resolves to 'check-failed' and the launch continues
    // exactly as if this effect didn't run.
    checkForUpdate().then((result) => {
      if (result.status === 'update-available') {
        console.log(`[MomMove:updateChecker] update available: v${result.latestVersion}`);
      }
    });
  }, []);

  const handlePermissionGranted = useCallback(async () => {
    notificationPermissionHandledRef.current = true;
    await requestNotificationPermission();
    setStage('ready');
  }, []);

  if (stage === 'onboarding') {
    return <PermissionOnboardingScreen onGranted={handlePermissionGranted} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#FFFFFF',
            tabBarInactiveTintColor: '#9E92C4',
            tabBarStyle: { backgroundColor: '#241D45', borderTopColor: '#3A2E70' },
            tabBarLabelStyle: { fontSize: 16, fontWeight: '700' },
          }}
        >
          <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: tabIcon('🏠') }} />
          <Tab.Screen
            name="Summary"
            component={SummaryScreen}
            options={{ tabBarIcon: tabIcon('📊') }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ tabBarIcon: tabIcon('⚙️') }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
