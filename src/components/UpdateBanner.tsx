import React, { useCallback } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  latestVersion: string;
  apkUrl: string;
  onDismiss: () => void;
};

/**
 * Unlike ReinforcementBanner, this one doesn't auto-hide — it stays until
 * she taps the download link or dismisses it, and (per updateChecker)
 * won't reappear for the same version once dismissed.
 */
export default function UpdateBanner({ latestVersion, apkUrl, onDismiss }: Props) {
  const handlePress = useCallback(() => {
    Linking.openURL(apkUrl).catch(() => {
      // Silent by design — same policy as the background check itself.
    });
  }, [apkUrl]);

  return (
    <View style={styles.banner}>
      <TouchableOpacity style={styles.tapArea} onPress={handlePress} accessibilityRole="button">
        <Text style={styles.text}>Update available — tap to download</Text>
        <Text style={styles.subtext}>Version {latestVersion}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss update notice"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C5CFC',
    borderRadius: 12,
    paddingVertical: 14,
    paddingLeft: 20,
    paddingRight: 12,
    marginBottom: 24,
    maxWidth: 320,
    minHeight: 44,
  },
  tapArea: {
    flex: 1,
    paddingVertical: 4,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  subtext: {
    color: '#E6E1FF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  dismissButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
