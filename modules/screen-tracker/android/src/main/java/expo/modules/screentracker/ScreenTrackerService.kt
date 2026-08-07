package expo.modules.screentracker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext

/**
 * Foreground service that keeps MomMove's process (and its JS engine) alive
 * while the user is in other apps, which is required for continuous
 * screen-on tracking — Android otherwise suspends/kills background JS work
 * within seconds to minutes.
 *
 * It does two things and nothing else:
 *  1. Shows a persistent, low-priority notification (a legal requirement
 *     for foreground services, and a transparency courtesy to the user).
 *  2. On a fixed schedule, invokes the "ScreenTimeTrackerTask" Headless JS
 *     task (registered in screenTimeTracker.ts), which owns all of the
 *     actual continuous-time/break/threshold logic.
 *
 * The real screen on/off signal comes from [ScreenStateReceiver], which
 * this service registers for as long as it's alive.
 */
class ScreenTrackerService : HeadlessJsTaskService() {
  private val screenStateReceiver = ScreenStateReceiver()
  private val tickHandler = Handler(Looper.getMainLooper())
  private var tickIntervalMs: Long = DEFAULT_TICK_INTERVAL_MS

  private val tickRunnable = object : Runnable {
    override fun run() {
      try {
        startTrackerTask()
      } catch (err: Exception) {
        // A single bad tick must never take the whole loop down with it —
        // an exception escaping onto the main looper crashes the process,
        // and tracking (so every future reminder) along with it. Logged
        // rather than swallowed: `adb logcat -s MomMove:*` will show it.
        Log.w(TAG, "tick failed, skipping this one", err)
      }
      tickHandler.postDelayed(this, tickIntervalMs)
    }
  }

  override fun onCreate() {
    super.onCreate()
    // RECEIVER_NOT_EXPORTED: these are system broadcasts only, so no other
    // app has any business reaching this receiver. Required (rather than
    // merely tidy) for context-registered receivers once targetSdk >= 34.
    ContextCompat.registerReceiver(
      this,
      screenStateReceiver,
      ScreenStateReceiver.intentFilter(),
      ContextCompat.RECEIVER_NOT_EXPORTED
    )
    startForeground(NOTIFICATION_ID, buildPersistentNotification())
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    tickIntervalMs = intent
      ?.getIntExtra(EXTRA_TICK_INTERVAL_SEC, DEFAULT_TICK_INTERVAL_SEC)
      ?.times(1000L)
      ?: DEFAULT_TICK_INTERVAL_MS

    tickHandler.removeCallbacks(tickRunnable)
    tickHandler.post(tickRunnable)
    return START_STICKY
  }

  override fun onDestroy() {
    tickHandler.removeCallbacks(tickRunnable)
    try {
      unregisterReceiver(screenStateReceiver)
    } catch (_: IllegalArgumentException) {
      // already unregistered
    }
    super.onDestroy()
  }

  override fun onBind(intent: Intent): IBinder? = null

  /**
   * [HeadlessJsTaskService]'s own implementation calls `stopSelf()` as soon
   * as the last task it started finishes. That's right for the usual
   * "one service start = one short task" pattern it's written for, but here
   * the service *is* the tracker: it owns the persistent notification, the
   * screen-state receiver and the repeating tick. Letting a 15-second tick
   * tear all of that down means tracking stops dead right after the very
   * first tick — and with it, every reminder that would ever have fired.
   *
   * So this deliberately does not call super, and never stops the service.
   * Its lifetime is owned by startTracking()/stopTracking() instead.
   */
  override fun onHeadlessJsTaskFinish(taskId: Int): Unit = Unit

  private fun startTrackerTask() {
    val taskConfig = HeadlessJsTaskConfig(
      HEADLESS_TASK_NAME,
      Arguments.createMap(),
      TASK_TIMEOUT_MS,
      /* allowedInForeground = */ true
    )

    val context = reactContext
    if (context == null) {
      // No React context yet — the process was restarted by the system
      // (START_STICKY) rather than by the app itself. The base class knows
      // how to boot one up and run the task once it's ready.
      startTask(taskConfig)
      return
    }

    // Steady state. Deliberately *not* via HeadlessJsTaskService.startTask(),
    // which acquires a partial wake lock it only ever releases in onDestroy()
    // — and this service, per the override above, is never destroyed between
    // ticks. Holding the CPU awake around the clock is exactly the kind of
    // battery drain that gets an app like this uninstalled; the ticks that
    // matter happen while the screen (and therefore the CPU) is already on.
    HeadlessJsTaskContext.getInstance(context).startTask(taskConfig)
  }

  private fun buildPersistentNotification(): android.app.Notification {
    val channelId = ensureNotificationChannel()
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_IMMUTABLE
      )
    }

    return NotificationCompat.Builder(this, channelId)
      .setContentTitle("MomMove is watching your screen time")
      .setContentText("Tracking continuous screen time in the background.")
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setOngoing(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setContentIntent(contentIntent)
      .build()
  }

  private fun ensureNotificationChannel(): String {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val channel = NotificationChannel(
        FOREGROUND_CHANNEL_ID,
        "Screen time tracking",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Persistent notification shown while MomMove tracks continuous screen time."
        setShowBadge(false)
      }
      manager.createNotificationChannel(channel)
    }
    return FOREGROUND_CHANNEL_ID
  }

  companion object {
    private const val TAG = "MomMove:service"
    private const val NOTIFICATION_ID = 4471
    private const val FOREGROUND_CHANNEL_ID = "mommove-screen-tracking"
    private const val HEADLESS_TASK_NAME = "ScreenTimeTrackerTask"
    private const val TASK_TIMEOUT_MS: Long = 10_000
    private const val DEFAULT_TICK_INTERVAL_SEC = 15
    private const val DEFAULT_TICK_INTERVAL_MS: Long = DEFAULT_TICK_INTERVAL_SEC * 1000L

    const val EXTRA_TICK_INTERVAL_SEC = "tickIntervalSec"

    fun start(context: Context, tickIntervalSec: Int) {
      val intent = Intent(context, ScreenTrackerService::class.java)
        .putExtra(EXTRA_TICK_INTERVAL_SEC, tickIntervalSec)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, ScreenTrackerService::class.java))
    }
  }
}
