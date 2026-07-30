package expo.modules.screentracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter

/**
 * Listens for the system's real screen on/off/unlock broadcasts. These are
 * "protected broadcasts" any app may receive without a special permission —
 * no Usage Access grant is required for this signal.
 */
class ScreenStateReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_SCREEN_ON -> ScreenStateHolder.setScreenOn(true)
      Intent.ACTION_USER_PRESENT -> ScreenStateHolder.setScreenOn(true)
      Intent.ACTION_SCREEN_OFF -> ScreenStateHolder.setScreenOn(false)
    }
  }

  companion object {
    fun intentFilter(): IntentFilter = IntentFilter().apply {
      addAction(Intent.ACTION_SCREEN_ON)
      addAction(Intent.ACTION_SCREEN_OFF)
      addAction(Intent.ACTION_USER_PRESENT)
    }
  }
}
