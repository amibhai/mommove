import * as Notifications from 'expo-notifications';

// Show the notification banner even while MomMove itself happens to be in
// the foreground (rare in practice, since the reminder fires while she's
// been using *other* apps, but harmless either way).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type NotificationPermissionResult = 'granted' | 'denied';

/**
 * Requests the Android 13+ runtime notification permission (POST_NOTIFICATIONS).
 * This is a normal runtime dialog — separate from, and unrelated to, the
 * Usage Access special-permission flow in PermissionOnboardingScreen.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return 'granted';
  }

  const result = await Notifications.requestPermissionsAsync();
  return result.granted ? 'granted' : 'denied';
}

export async function hasNotificationPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/**
 * Fires the single, plain reminder notification. No action buttons, no
 * variety — that's later phases.
 */
export async function fireReminderNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to move',
      body: "You've been on your phone a while — stand up, check your posture, and do a quick neck stretch.",
    },
    trigger: null,
  });
}
