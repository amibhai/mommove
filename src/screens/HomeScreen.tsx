import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

import ReinforcementBanner from '../components/ReinforcementBanner';
import UpdateBanner from '../components/UpdateBanner';
import { hasNotificationPermission } from '../services/notifications';
import { consumePendingReinforcement } from '../services/streakTracker';
import {
  dismissUpdateBanner,
  getPendingUpdateForBanner,
  type PendingUpdate,
} from '../services/updateChecker';

export default function HomeScreen() {
  const [reinforcementMessage, setReinforcementMessage] = useState<string | null>(null);
  const [notificationsGranted, setNotificationsGranted] = useState(true);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);

  useFocusEffect(
    useCallback(() => {
      hasNotificationPermission().then(setNotificationsGranted);
      // Re-reads the cached check result (no network call) every time Home
      // gains focus, so a check triggered from Settings' manual button is
      // reflected here without a duplicate fetch.
      getPendingUpdateForBanner().then(setPendingUpdate);
    }, [])
  );

  const handleDismissUpdate = useCallback(() => {
    if (!pendingUpdate) {
      return;
    }
    dismissUpdateBanner(pendingUpdate.latestVersion);
    setPendingUpdate(null);
  }, [pendingUpdate]);

  React.useEffect(() => {
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
        {pendingUpdate ? (
          <UpdateBanner
            latestVersion={pendingUpdate.latestVersion}
            apkUrl={pendingUpdate.apkUrl}
            onDismiss={handleDismissUpdate}
          />
        ) : null}

        {reinforcementMessage ? (
          <ReinforcementBanner
            message={reinforcementMessage}
            onHide={() => setReinforcementMessage(null)}
          />
        ) : null}

        <Text style={styles.title}>MomMove</Text>

        {notificationsGranted ? (
          <View style={[styles.statusPill, styles.statusPillActive]}>
            <Text style={styles.statusText}>Tracking active</Text>
          </View>
        ) : (
          <View style={[styles.statusPill, styles.statusPillWarning]}>
            <Text style={styles.statusText}>
              Notifications are off — turn them on in Android Settings to see reminders.
            </Text>
          </View>
        )}
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
    marginBottom: 24,
  },
  statusPill: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    maxWidth: 320,
  },
  statusPillActive: {
    backgroundColor: '#2E7D32',
  },
  statusPillWarning: {
    backgroundColor: '#5A3E1B',
  },
  statusText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
