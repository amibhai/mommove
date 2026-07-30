package expo.modules.screentracker

import android.os.SystemClock

/**
 * In-memory, process-wide record of the device's screen on/off state.
 *
 * Updated exclusively by [ScreenStateReceiver] (which reacts to the real
 * ACTION_SCREEN_ON / ACTION_SCREEN_OFF / ACTION_USER_PRESENT broadcasts) and
 * read by both the JS tracking loop and the debug UI. Kept in native memory
 * rather than JS so it survives JS engine / Headless task restarts as long
 * as the foreground service process itself is alive.
 */
object ScreenStateHolder {
  @Volatile
  var isScreenOn: Boolean = true
    private set

  @Volatile
  private var lastTransitionAtElapsedMs: Long = SystemClock.elapsedRealtime()

  // Mirrors the JS-computed continuous-time value purely for the on-screen
  // debug readout (Phase 2 dev tool). Not used in any tracking decision.
  @Volatile
  var debugContinuousTimeSec: Int = 0

  fun setScreenOn(screenOn: Boolean) {
    if (isScreenOn == screenOn) return
    isScreenOn = screenOn
    lastTransitionAtElapsedMs = SystemClock.elapsedRealtime()
  }

  /** Milliseconds since the current on/off state began. */
  fun msSinceLastTransition(): Long =
    SystemClock.elapsedRealtime() - lastTransitionAtElapsedMs
}
