import { NativeModule, requireNativeModule } from 'expo';

import type { ScreenState } from './ScreenTracker.types';

declare class ScreenTrackerModule extends NativeModule<{}> {
  hasUsageAccessPermission(): boolean;
  openUsageAccessSettings(): void;

  startTracking(tickIntervalSec: number): void;
  stopTracking(): void;

  getScreenState(): ScreenState;

  setDebugContinuousTimeSec(seconds: number): void;
  getDebugContinuousTimeSec(): number;

  isNotificationPresented(identifier: string): boolean;
}

export default requireNativeModule<ScreenTrackerModule>('ScreenTracker');
