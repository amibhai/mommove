package expo.modules.screentracker

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ScreenTrackerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScreenTracker")

    // --- Usage Access (special permission, no runtime dialog) ---

    Function("hasUsageAccessPermission") {
      hasUsageAccessPermission()
    }

    Function("openUsageAccessSettings") {
      appContext.reactContext?.let { context ->
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
          data = Uri.parse("package:${context.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
      }
    }

    // --- Foreground tracking service lifecycle ---

    Function("startTracking") { tickIntervalSec: Int ->
      appContext.reactContext?.let { context ->
        ScreenTrackerService.start(context, tickIntervalSec)
      }
    }

    Function("stopTracking") {
      appContext.reactContext?.let { context ->
        ScreenTrackerService.stop(context)
      }
    }

    // --- Real screen on/off signal, read by the JS tick loop ---

    Function("getScreenState") {
      mapOf(
        "isScreenOn" to ScreenStateHolder.isScreenOn,
        "msSinceTransition" to ScreenStateHolder.msSinceLastTransition()
      )
    }

    // --- Debug-only mirror of the JS-computed continuous time, so the ---
    // --- Home screen readout works regardless of which JS context the ---
    // --- Headless task happens to be running in. ---

    Function("setDebugContinuousTimeSec") { seconds: Int ->
      ScreenStateHolder.debugContinuousTimeSec = seconds
    }

    Function("getDebugContinuousTimeSec") {
      ScreenStateHolder.debugContinuousTimeSec
    }
  }

  private fun hasUsageAccessPermission(): Boolean {
    val context = appContext.reactContext ?: return false
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }
}
