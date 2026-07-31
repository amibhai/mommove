import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Formats the raw number for display, e.g. "30 min" or "8:00 AM". */
  format?: (value: number) => string;
  /** If true, going past max wraps to min and vice versa (used for hours). */
  wrap?: boolean;
  onChange: (value: number) => void;
};

/**
 * A large, minimal −/+ control used for every adjustable number in
 * Settings. Chosen over a slider or native date/time picker on purpose:
 * no new native dependency, and big discrete tap targets are easier for
 * a 60-year-old user than dragging a thumb precisely.
 */
export default function Stepper({ label, value, min, max, step, format, wrap, onChange }: Props) {
  const displayValue = format ? format(value) : String(value);
  const atMin = value <= min;
  const atMax = value >= max;

  const decrement = useCallback(() => {
    let next = value - step;
    if (next < min) {
      if (!wrap) return;
      next = max;
    }
    onChange(next);
  }, [value, step, min, max, wrap, onChange]);

  const increment = useCallback(() => {
    let next = value + step;
    if (next > max) {
      if (!wrap) return;
      next = min;
    }
    onChange(next);
  }, [value, step, min, max, wrap, onChange]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.button, !wrap && atMin && styles.buttonDisabled]}
          onPress={decrement}
          disabled={!wrap && atMin}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
        >
          <Text style={styles.buttonText}>−</Text>
        </TouchableOpacity>

        <Text style={styles.value}>{displayValue}</Text>

        <TouchableOpacity
          style={[styles.button, !wrap && atMax && styles.buttonDisabled]}
          onPress={increment}
          disabled={!wrap && atMax}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
        >
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E6E1FF',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#241D45',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#7C5CFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#3A2E70',
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  value: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
});
