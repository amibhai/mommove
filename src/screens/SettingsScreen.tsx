import Constants from 'expo-constants';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import DeveloperToolsPanel from '../components/DeveloperToolsPanel';
import Stepper from '../components/Stepper';
import {
  BREAK_RESET_GAP_RANGE,
  CONTINUOUS_TIME_THRESHOLD_RANGE,
} from '../config/reminderConfig';
import { configureReminderNotificationChannelAsync } from '../services/notifications';
import {
  getActiveHours,
  getIsPausedToday,
  getNotificationStyle,
  getReminderTiming,
  getUserName,
  setActiveHours,
  setNotificationStyle,
  setPauseToday,
  setReminderTiming,
  setUserName,
} from '../services/preferencesStore';
import { refreshTrackerConfig } from '../services/screenTimeTracker';

const VERSION_TAPS_TO_UNLOCK = 5;
const VERSION_TAP_RESET_MS = 2000;

function formatMinutes(value: number): string {
  return `${value} min`;
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const [loaded, setLoaded] = useState(false);

  const [thresholdMin, setThresholdMin] = useState(30);
  const [gapMin, setGapMin] = useState(2);
  const [activeStart, setActiveStart] = useState(8);
  const [activeEnd, setActiveEnd] = useState(21);
  const [paused, setPaused] = useState(false);
  const [name, setName] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [devToolsUnlocked, setDevToolsUnlocked] = useState(false);

  const tapCountRef = useRef(0);
  const tapResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const [timing, hours, isPaused, userName, style] = await Promise.all([
        getReminderTiming(),
        getActiveHours(),
        getIsPausedToday(),
        getUserName(),
        getNotificationStyle(),
      ]);
      setThresholdMin(timing.thresholdMin);
      setGapMin(timing.gapMin);
      setActiveStart(hours.start);
      setActiveEnd(hours.end);
      setPaused(isPaused);
      setName(userName);
      setSoundEnabled(style.soundEnabled);
      setVibrationEnabled(style.vibrationEnabled);
      setLoaded(true);
    })();
  }, []);

  const handleThresholdChange = useCallback(
    async (value: number) => {
      setThresholdMin(value);
      await setReminderTiming(value, gapMin);
      await refreshTrackerConfig();
    },
    [gapMin]
  );

  const handleGapChange = useCallback(
    async (value: number) => {
      setGapMin(value);
      await setReminderTiming(thresholdMin, value);
      await refreshTrackerConfig();
    },
    [thresholdMin]
  );

  const handleActiveStartChange = useCallback(
    async (value: number) => {
      setActiveStart(value);
      await setActiveHours(value, activeEnd);
    },
    [activeEnd]
  );

  const handleActiveEndChange = useCallback(
    async (value: number) => {
      setActiveEnd(value);
      await setActiveHours(activeStart, value);
    },
    [activeStart]
  );

  const handleTogglePause = useCallback(async (value: boolean) => {
    setPaused(value);
    await setPauseToday(value);
  }, []);

  const handleNameBlur = useCallback(async () => {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      await setUserName(trimmed);
    }
  }, [name]);

  const handleToggleSound = useCallback(
    async (value: boolean) => {
      setSoundEnabled(value);
      await setNotificationStyle(value, vibrationEnabled);
      await configureReminderNotificationChannelAsync();
    },
    [vibrationEnabled]
  );

  const handleToggleVibration = useCallback(
    async (value: boolean) => {
      setVibrationEnabled(value);
      await setNotificationStyle(soundEnabled, value);
      await configureReminderNotificationChannelAsync();
    },
    [soundEnabled]
  );

  const handleVersionTap = useCallback(() => {
    tapCountRef.current += 1;
    if (tapResetTimer.current) {
      clearTimeout(tapResetTimer.current);
    }
    if (tapCountRef.current >= VERSION_TAPS_TO_UNLOCK) {
      setDevToolsUnlocked(true);
      tapCountRef.current = 0;
      return;
    }
    tapResetTimer.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, VERSION_TAP_RESET_MS);
  }, []);

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <SectionCard title="Reminder timing">
          <Stepper
            label="Remind me after"
            value={thresholdMin}
            min={CONTINUOUS_TIME_THRESHOLD_RANGE.min}
            max={CONTINUOUS_TIME_THRESHOLD_RANGE.max}
            step={CONTINUOUS_TIME_THRESHOLD_RANGE.step}
            format={formatMinutes}
            onChange={handleThresholdChange}
          />
          <Stepper
            label="Break needs to last at least"
            value={gapMin}
            min={BREAK_RESET_GAP_RANGE.min}
            max={BREAK_RESET_GAP_RANGE.max}
            step={BREAK_RESET_GAP_RANGE.step}
            format={formatMinutes}
            onChange={handleGapChange}
          />
        </SectionCard>

        <SectionCard title="Active hours">
          <Stepper
            label="Start"
            value={activeStart}
            min={0}
            max={23}
            step={1}
            format={formatHour}
            wrap
            onChange={handleActiveStartChange}
          />
          <Stepper
            label="End"
            value={activeEnd}
            min={0}
            max={23}
            step={1}
            format={formatHour}
            wrap
            onChange={handleActiveEndChange}
          />
        </SectionCard>

        <SectionCard title="Pause today">
          <View style={styles.switchRow}>
            <View style={styles.switchLabelBlock}>
              <Text style={styles.switchLabel}>Pause reminders for today</Text>
              <Text style={styles.switchState}>
                {paused ? 'Paused until midnight' : 'Active'}
              </Text>
            </View>
            <Switch value={paused} onValueChange={handleTogglePause} />
          </View>
        </SectionCard>

        <SectionCard title="Personalization">
          <Text style={styles.fieldLabel}>Display name</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            onBlur={handleNameBlur}
            onSubmitEditing={handleNameBlur}
            placeholder="Mummy"
            placeholderTextColor="#7A6FB0"
            returnKeyType="done"
          />
        </SectionCard>

        <SectionCard title="Notification style">
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Notification sound</Text>
            <Switch value={soundEnabled} onValueChange={handleToggleSound} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Vibration</Text>
            <Switch value={vibrationEnabled} onValueChange={handleToggleVibration} />
          </View>
        </SectionCard>

        <TouchableOpacity onPress={handleVersionTap} accessibilityRole="button">
          <Text style={styles.versionText}>
            MomMove v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </TouchableOpacity>

        {devToolsUnlocked ? <DeveloperToolsPanel /> : null}
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
  card: {
    backgroundColor: '#241D45',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: 8,
  },
  switchLabelBlock: {
    flex: 1,
    paddingRight: 12,
  },
  switchLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  switchState: {
    fontSize: 16,
    fontWeight: '500',
    color: '#B7A9FF',
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E6E1FF',
    marginBottom: 10,
  },
  textInput: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#1A1533',
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3A2E70',
  },
  versionText: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
    color: '#7A6FB0',
    minHeight: 44,
    paddingVertical: 12,
  },
});
