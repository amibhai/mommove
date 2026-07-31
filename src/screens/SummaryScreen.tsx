import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  type DailyCounts,
  type DayDoneCount,
  type WeeklyRollupRow,
  getLast7DaysDoneCounts,
  getTodayCounts,
  getWeeklyRollups,
} from '../db/database';
import { exportLogsAsCsv } from '../services/csvExport';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BAR_MAX_HEIGHT = 90;

export default function SummaryScreen() {
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<DailyCounts | null>(null);
  const [week, setWeek] = useState<DayDoneCount[]>([]);
  const [olderWeeks, setOlderWeeks] = useState<WeeklyRollupRow[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [todayCounts, weekCounts, rollups] = await Promise.all([
      getTodayCounts(),
      getLast7DaysDoneCounts(),
      getWeeklyRollups(),
    ]);
    setToday(todayCounts);
    setWeek(weekCounts);
    setOlderWeeks(rollups);
    setLoading(false);
  }, []);

  // Refetches every time this tab gains focus, so numbers stay current
  // after e.g. firing a test notification from Developer Tools and
  // switching back over.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      await exportLogsAsCsv();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }, []);

  const maxDoneInWeek = Math.max(1, ...week.map((d) => d.doneCount));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Summary</Text>

        {loading || !today ? (
          <ActivityIndicator color="#FFFFFF" style={styles.loadingIndicator} />
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Today</Text>
              <Text style={styles.todayLine}>
                {today.total} reminders • {today.done} done • {today.snoozed} snoozed •{' '}
                {today.skipped} skipped
              </Text>
              {today.ignored > 0 ? (
                <Text style={styles.todaySubLine}>{today.ignored} ignored</Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>This week</Text>
              <View style={styles.weekRow}>
                {week.map((day) => {
                  const barHeight =
                    day.doneCount === 0 ? 4 : (day.doneCount / maxDoneInWeek) * BAR_MAX_HEIGHT;
                  const weekday = WEEKDAY_LABELS[new Date(day.date).getDay()];
                  return (
                    <View key={day.date} style={styles.dayColumn}>
                      <Text style={styles.dayCount}>{day.doneCount}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.bar, { height: barHeight }]} />
                      </View>
                      <Text style={styles.dayLabel}>{weekday}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {olderWeeks.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Older weeks (rolled up)</Text>
                {olderWeeks.map((w) => (
                  <Text key={w.weekStartDate} style={styles.rollupLine}>
                    Week of {w.weekStartDate}: {w.doneCount} done, {w.snoozedCount} snoozed,{' '}
                    {w.skippedCount} skipped, {w.ignoredCount} ignored
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={handleExport}
                disabled={exporting}
                accessibilityRole="button"
              >
                <Text style={styles.exportButtonText}>
                  {exporting ? 'Exporting…' : 'Export Logs (CSV)'}
                </Text>
              </TouchableOpacity>
              {exportError ? <Text style={styles.exportError}>{exportError}</Text> : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A1533',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  loadingIndicator: {
    marginTop: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B7A9FF',
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  todayLine: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  todaySubLine: {
    fontSize: 16,
    fontWeight: '500',
    color: '#E6E1FF',
    marginTop: 6,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dayColumn: {
    alignItems: 'center',
    width: 40,
  },
  dayCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  barTrack: {
    height: 90,
    width: 20,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 20,
    borderRadius: 6,
    backgroundColor: '#7C5CFC',
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B7A9FF',
    marginTop: 6,
  },
  rollupLine: {
    fontSize: 15,
    fontWeight: '500',
    color: '#E6E1FF',
    marginBottom: 6,
  },
  exportButton: {
    backgroundColor: '#3A2E70',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  exportButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  exportError: {
    marginTop: 8,
    fontSize: 13,
    color: '#FF8080',
  },
});
