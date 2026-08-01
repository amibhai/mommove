import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const BAR_MAX_HEIGHT = 90;

/** Parses a "YYYY-MM-DD" label as a local date. `new Date("YYYY-MM-DD")`
 * parses as UTC midnight per spec, which can roll .getDay()/.getDate() etc.
 * back a calendar day in any timezone behind UTC — the 3-arg constructor
 * below is always local, avoiding that entirely. */
function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** "2026-07-21" -> "Jul 21, 2026" — friendlier than a raw ISO date for her. */
function formatWeekOf(isoDate: string): string {
  const d = parseLocalDate(isoDate);
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function SummaryScreen() {
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<DailyCounts | null>(null);
  const [week, setWeek] = useState<DayDoneCount[]>([]);
  const [olderWeeks, setOlderWeeks] = useState<WeeklyRollupRow[]>([]);

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
                  const weekday = WEEKDAY_LABELS[parseLocalDate(day.date).getDay()];
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
                <Text style={styles.sectionLabel}>Older weeks</Text>
                {olderWeeks.map((w) => (
                  <Text key={w.weekStartDate} style={styles.rollupLine}>
                    Week of {formatWeekOf(w.weekStartDate)}: {w.doneCount} done,{' '}
                    {w.snoozedCount} snoozed, {w.skippedCount} skipped, {w.ignoredCount} ignored
                  </Text>
                ))}
              </View>
            ) : null}
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
    fontSize: 16,
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
    width: 44,
  },
  dayCount: {
    fontSize: 16,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#B7A9FF',
    marginTop: 6,
  },
  rollupLine: {
    fontSize: 16,
    fontWeight: '500',
    color: '#E6E1FF',
    marginBottom: 6,
  },
});
