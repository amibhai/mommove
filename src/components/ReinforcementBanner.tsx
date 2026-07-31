import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  message: string;
  /** Called after the auto-hide delay elapses. */
  onHide: () => void;
};

const AUTO_HIDE_MS = 6000;

/**
 * A small in-app (never a push notification) positive-reinforcement toast,
 * shown once per streak milestone the next time the app is opened. No
 * animation polish yet — appears, stays for a few seconds, disappears.
 */
export default function ReinforcementBanner({ message, onHide }: Props) {
  useEffect(() => {
    const timeout = setTimeout(onHide, AUTO_HIDE_MS);
    return () => clearTimeout(timeout);
  }, [onHide]);

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 24,
    maxWidth: 320,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
