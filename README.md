# MomMove

MomMove is a personal Android app for parents to gently manage their family's
screen time — built as a standalone installable APK (no Play Store dependency)
so it can be side-loaded directly onto a household device. This repository is
the app's React Native / Expo / TypeScript codebase.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS, 18+)
- npm (comes with Node.js)
- An [Expo account](https://expo.dev/signup) (free)
- EAS CLI (installed globally, see below)
- An Android phone with "Install from unknown sources" enabled (for sideloading the built APK)

## Running the project locally

```bash
npm install
npx expo start
```

> **Note (from Phase 2 onward):** this project now contains a custom native
> Android module (`modules/screen-tracker`), so it **cannot run in Expo Go**.
> `npx expo start` is still useful for fast iteration on pure-JS/UI changes
> using a [development build](https://docs.expo.dev/develop/development-builds/introduction/),
> but the only way to test the actual screen-tracking + notification behavior
> is to install a real build on-device (see below).

## Building an installable APK with EAS

This project is configured with an EAS `preview` build profile that outputs a
directly installable `.apk` file (not an `.aab`), since there is no Play
Store distribution involved.

Run the following commands, in order:

```bash
npm install -g eas-cli
eas login
eas whoami
eas init
eas build --platform android --profile preview
```

- `eas login` — authenticate with your Expo account.
- `eas whoami` — confirm you're logged in as the right account.
- `eas init` — link this local project to a project on your Expo account (creates/reads the project ID).
- `eas build --platform android --profile preview` — kicks off a cloud build (this compiles the native module too). When it finishes, EAS will give you a URL to download the `.apk` file.

## Installing the APK on your Android phone

1. On your phone, go to **Settings → Security** (or **Apps → Special access**)
   and enable **Install unknown apps** for the browser or file manager you'll
   use to open the file.
2. Transfer the `.apk` file to your phone — download it directly from the EAS
   build URL on the phone's browser, or copy it over via USB/cloud storage.
3. Open the `.apk` file from your phone's file manager or Downloads app and
   tap **Install**.
4. Once installed, open the **MomMove** app from your app drawer to confirm
   it launches.

## Permissions you'll be asked for

MomMove asks for two separate permissions, at two separate moments, for two
different reasons:

1. **Usage Access** (a "special app access", not a normal permission dialog)
   — requested by the app's own onboarding screen on first launch. Tapping
   **Open Settings** deep-links you to Android's Usage Access settings page;
   find **MomMove** in the list and turn it on, then return to the app. The
   onboarding screen automatically re-checks and shows **"All set ✅"** once
   granted, or a gentle retry hint if it doesn't detect the change yet.
2. **Notifications** (the standard Android 13+ runtime permission dialog) —
   requested automatically right after Usage Access is confirmed, so the
   reminder notification can actually display.

If you deny notifications, the app will keep tracking but the 30-minute
reminder won't visibly appear — you can re-enable it later from Android's
app-info screen for MomMove.

## The reminder notification (Phase 3)

The "Time to move" notification now has four buttons, all usable directly
from the notification shade without opening the app:

- **Done** — clears the reminder, resets the snooze count, marks it resolved.
- **Snooze 5m** / **Snooze 30m** — clears it and reschedules a follow-up
  after the chosen delay, incrementing an in-memory snooze count for this
  trigger cycle.
- **Skip** — clears it, resets the snooze count, marks it resolved.

Snooze the same trigger 3 times in a row and the copy shifts from casual to
a firmer "direct" tone (see Phase 4 below for what that actually says). The
snooze count resets on Done/Skip, or whenever a fresh 30-minute cycle
begins.

Two things can silently suppress the reminder without resetting the
continuous-time counter, so exactly one reminder fires the moment the
suppression lifts instead of a pile of overdue ones:

- **Quiet hours** — defaults to 8:00–21:00 local time (`DEFAULT_ACTIVE_HOURS_START`/`_END`
  in `src/config/reminderConfig.ts`), persisted via AsyncStorage so a future
  Settings screen (Phase 6) can make it user-adjustable.
- **Pause Today** — a manual override that lasts until local midnight. No
  real toggle exists yet (Phase 6), but there's a temporary **Pause Today**
  button in the Phase 2/3 debug panel on the home screen for testing.

## Message pool and personalization (Phase 4)

Every notification now comes from a pool of 34 hand-written messages in
`src/config/messagePool.ts` — a mix of English and Hindi (both Devanagari
and Roman script), the way a family actually texts, always addressing her
as "{name}" (resolves to **"Mummy"** by default — see below).

`src/services/messageSelector.ts` picks one:

- Filtered by **tone** (`casual` / `warm` / `direct`) and **time of day**
  (`morning` before 12:00, `afternoon` 12:00–17:00, `evening` after 17:00 —
  messages not tagged for a specific time of day match any time).
- Never repeats one of the last 3 message IDs shown, regardless of tone.
- `{name}` is substituted with the stored user name.

Which tone gets used, and where:

- **Normal 30-minute trigger:** `casual`, except every 4th trigger in a row
  pulls `warm` instead, for variety (`WARM_VARIETY_EVERY_N_TRIGGERS` in
  `reminderConfig.ts`).
- **Snoozes 1–2:** stay `casual`.
- **3rd consecutive snooze (escalation):** switches to `direct` — firmer,
  never scolding (e.g. "थोड़ा तो उठिए {name}, फोन कहीं नहीं जा रहा।").

**Name personalization:** `getUserName()` / `setUserName()` in
`src/services/preferencesStore.ts` (same AsyncStorage pattern as Phase 3's
quiet-hours values), defaulting to `"Mummy"` if never set. No Settings UI
exists yet to change it (Phase 6) — the debug panel has a temporary
"Name: … · tap to switch" button that toggles a test name, to confirm
substitution works without needing that UI.

## In-app streak reinforcement (Phase 4)

A consecutive-"Done" streak is tracked in AsyncStorage
(`src/services/streakTracker.ts` — a placeholder Phase 5 will migrate to a
real query against logged actions). It increments on `onReminderResolved('done')`
and resets to 0 on `'skip'` or `'ignored'`.

Hitting 3, 5, or 10 in a row queues a small **in-app** banner (never a push
notification) — shown once, the next time the app is opened, via
`ReinforcementBanner` on the home screen, then auto-hides after a few
seconds.

## On-device test protocol (Phase 2)

Do this after installing the APK, ideally with the phone plugged in and
`adb logcat` running on a computer (`adb logcat | grep MomMove` — every
tracker log line is prefixed `[MomMove:tracker]`, and Headless JS
`console.log` output shows up here even while you're in a different app):

1. **Onboarding:** open MomMove. You should land on the "One quick step"
   screen (not the home screen) since Usage Access isn't granted yet. Tap
   **Open Settings**, enable Usage Access for MomMove, and go back. Confirm
   the screen now shows **"All set ✅"**, then tap **Continue**.
2. **Notification permission:** confirm the standard Android "Allow MomMove
   to send you notifications?" dialog appears, and tap **Allow**.
3. **Counter increments:** on the home screen, you should see a small
   **DEBUG · continuous time** box counting up in `MM:SS`. Use your phone
   normally (any app) for a minute or two and confirm it climbs roughly in
   real time. In `adb logcat` you should see lines like
   `screen ON (+15.0s) -> continuousTime=45.0s` every ~15 seconds.
4. **Break resets the counter:** lock the screen and leave it off for
   **3+ minutes**, then unlock. Confirm the debug counter (and the logcat
   output) shows it reset to `00:00` — logcat should show a line like
   `real break detected (screen off 3.1min >= 2min gap) -> reset continuousTime to 0`.
5. **Brief lock does *not* reset it:** lock the screen for a few seconds
   only (well under 2 minutes), unlock, and confirm the counter continued
   from roughly where it left off instead of resetting.
6. **Notification fires at 30 minutes:** use the phone continuously (don't
   let the screen go off for 2+ minutes) until the debug counter reaches
   `30:00`. Confirm a **"Time to move"** notification appears, and that the
   debug counter drops back to `00:00` right after.

If anything doesn't match, the `adb logcat` output is the fastest way to see
exactly which branch of the state machine ran and why.

## On-device test protocol (Phase 3)

Continue from step 6 above — you should have a "Time to move" notification
with four buttons: **Done**, **Snooze 5m**, **Snooze 30m**, **Skip**.
`adb logcat | grep MomMove` will also show `[MomMove:actions]`-prefixed
lines for everything below.

1. **All four buttons, from the shade:** trigger a reminder, then, without
   opening the app, pull down the notification shade and confirm all four
   buttons are visible and tappable:
   - **Done** — the notification clears; logcat shows
     `onReminderResolved('done')`.
   - **Skip** — same, but `onReminderResolved('skip')`.
   - **Snooze 5m** / **Snooze 30m** — the notification clears immediately,
     and a new one with the same buttons appears after the chosen delay.
     Check the home screen's **DEBUG · snooze count** — it should read `1`
     after one snooze.
2. **Escalation on the 3rd snooze:** trigger a reminder and tap **Snooze
   5m** three times in a row (waiting for each follow-up to reappear).
   Confirm the 3rd notification's text reads noticeably firmer than the
   first two (e.g. "थोड़ा तो उठिए {name}, फोन कहीं नहीं जा रहा।" instead of
   something casual) — see Phase 4 below for exactly where this copy comes
   from — and the debug snooze count reads `3`.
3. **Swipe-dismiss without tapping anything:** trigger a reminder, then
   swipe it away from the shade instead of tapping a button. Within about
   15 seconds (the tracker's tick interval), logcat should show
   `reminder dismissed without an action -> ignored` and
   `onReminderResolved('ignored')`.
4. **Quiet hours suppress firing:** there's no settings UI yet, so simulate
   this by checking the debug panel's **DEBUG · suppression** row — it
   reads `none` inside the default 8:00–21:00 window. Testing the
   suppressed case for real requires either waiting until outside that
   window, or temporarily changing `DEFAULT_ACTIVE_HOURS_START`/`_END` in
   `src/config/reminderConfig.ts` to bracket the current time and
   reinstalling. Either way: confirm that once the debug counter reaches
   `30:00`, **no notification appears**, logcat shows
   `threshold reached but suppressed (quiet-hours) -> not firing`, and the
   debug counter keeps counting up past `30:00` instead of resetting.
5. **Pause Today suppresses firing:** on the home screen's debug panel, tap
   **Pause Today**. Confirm **DEBUG · suppression** switches to
   `paused-today`, and that no notification fires even once the counter
   passes `30:00` (logcat: `threshold reached but suppressed (paused-today)`).
   Tap the button again (now labeled "Paused today · tap to resume") to
   turn it back off, and confirm the next threshold crossing fires
   normally.

## On-device test protocol (Phase 4)

1. **Message variety:** on the home screen's debug panel, tap **Fire test
   notification** 10+ times in a row (each one fires immediately with
   `tone: 'casual'`). Confirm the notification body varies each time — a mix
   of English and Hindi/Hinglish — and doesn't repeat the same message
   within 3 taps. The **DEBUG · last message** row mirrors whatever was just
   selected, so you don't have to keep swiping the shade open.
2. **Name personalization:** with no Settings UI yet, the name defaults to
   **"Mummy"** — confirm that's what appears in the fired messages. Then tap
   the debug panel's **"Name: … · tap to switch"** button (toggles to a test
   name and back) and fire another test notification to confirm the new
   name is substituted correctly.
3. **Escalation pulls from the direct pool:** snooze the same trigger 3
   times in a row (Phase 3 protocol, step 2). Confirm the 3rd notification's
   text is one of the firmer `direct`-tone messages, not the old fixed
   string, and that it's still recognizably not scolding.
4. **Streak reinforcement banner:** on the debug panel, tap **Simulate
   Done** three times in a row (each call runs the real
   `onReminderResolved('done')` path, so it also exercises the streak
   storage). Fully close and reopen the app (swipe it away from Recents,
   then relaunch) — confirm a green banner reading **"Nice — that's 3 in a
   row today 💪"** appears briefly on the home screen. Tap **Simulate
   Skip** and confirm **DEBUG · streak** drops back to `0`.

## Technical approach: why a custom native module

Android will suspend or kill ordinary background JS within seconds to
minutes, so reliably tracking *continuous* screen-on time — regardless of
which app is in the foreground — needs to survive as a genuine foreground
service, not a periodically-woken JS callback. `expo-task-manager` /
`expo-background-fetch` are built around the OS's periodic scheduler
(minimum ~15 minute intervals, no guaranteed cadence), which can't give the
tick-by-tick resolution or immediacy this feature needs. So `modules/screen-tracker`
is a small local Expo module with real Android code:

- A `BroadcastReceiver` for `ACTION_SCREEN_ON` / `ACTION_SCREEN_OFF` /
  `ACTION_USER_PRESENT` — the actual, reliable, no-special-permission signal
  for screen state.
- A foreground `Service` (with the required persistent low-priority
  notification) that keeps the process alive and, on a fixed schedule,
  triggers a **Headless JS task** — React Native's built-in mechanism for
  running JS while the app has no active UI. All of the actual
  continuous-time/break/threshold logic (`src/services/screenTimeTracker.ts`)
  lives in this JS task, referencing the constants in
  `src/config/reminderConfig.ts` — the native side only reports raw
  screen-on/off signals and keeps the process alive.

One deliberate nuance: the Usage Access permission is wired up exactly as
specified (its own onboarding screen, deep link, verify-on-return flow), but
the tracking mechanism above doesn't actually *require* it — screen on/off
broadcasts need no special permission. It's included because later phases
may want per-app usage breakdowns (which *do* require Usage Access via
`UsageStatsManager`), and because it's the permission most people
associate with "screen time" apps. Flagging this so it's a known tradeoff,
not a hidden one.

## Notification actions: surviving a backgrounded or killed app

This is the easy-to-get-wrong part of Phase 3, so here's exactly how it's
wired (all in `src/services/reminderActions.ts`, registered once,
unconditionally, in `index.ts` — never inside a component's `useEffect`,
for the same reason `registerScreenTimeTrackerHeadlessTask` isn't: a button
tap can cold-start the JS bundle with no `App` component ever mounting):

1. All four actions are registered with `opensAppToForeground: false`, so
   tapping one doesn't visibly launch MomMove. **Important nuance:**
   expo-notifications' own docs note that with `opensAppToForeground: false`,
   the plain `addNotificationResponseReceivedListener` event **will not
   fire if the app process has actually been killed** — only when it's
   alive (foregrounded or merely backgrounded). Missing this distinction is
   the classic way to get this subtly wrong.
2. Because `ScreenTrackerService` (Phase 2) keeps MomMove's process alive
   as a foreground service for as long as tracking is on, the app is, in
   practice, essentially never fully killed — so path 1 alone handles the
   overwhelming majority of real taps.
3. As a safety net for the cases where Android kills the process anyway
   (some OEM battery managers override foreground services regardless), a
   second path uses `expo-notifications`' `registerTaskAsync` +
   `expo-task-manager`'s `defineTask` — this runs the JS bundle headlessly,
   independent of any Activity, specifically to handle notification
   responses when the app is otherwise fully terminated.

Both paths call the same `processResponse()` function, de-duplicated via a
`notificationId:actionIdentifier` key so a tap handled by both isn't
processed twice.

One more limitation worth stating plainly: expo-notifications doesn't wire
up Android's `setDeleteIntent`, so there's no direct "user swiped this
away" event from the library. Instead, `checkForIgnoredReminder()` (called
every tracker tick) asks the native module whether the last-presented
reminder's notification ID is still active (`NotificationManager
.getActiveNotifications()`, no special permission required); if it's gone
and nothing resolved it via an action, that's treated as `'ignored'`. This
means ignored-detection has up to one tick's latency (~15s) rather than
being instantaneous — an accepted tradeoff over the alternatives (forking
expo-notifications' native code, or requesting the much heavier
`NotificationListenerService` permission just to observe our own
notification).

## Where Phase 5 hooks in

`onReminderResolved(resolution)` in `src/services/reminderActions.ts` is
called for every `'done'`, `'skip'`, and `'ignored'` resolution — it logs,
and (as of Phase 4) updates the AsyncStorage-backed streak in
`src/services/streakTracker.ts`. Phase 5 replaces the streak's storage with
a real SQLite write/query; `onReminderResolved`'s call sites don't need to
change. Similarly, `getUserName`/`setUserName` and `getActiveHours`/
`setActiveHours` (`src/services/preferencesStore.ts`) are exactly where
Phase 6's Settings screen should read from and write to.

## Project structure

```
App.tsx                        - app entry point, onboarding/home routing
index.ts                       - registers headless task + notification handling
modules/screen-tracker/        - local native module: screen on/off signal,
                                  foreground service, Usage Access helpers,
                                  notification-presence check
src/
  screens/                    - top-level screens (Home, PermissionOnboarding)
  components/                 - ReinforcementBanner and other shared UI
  services/                   - screenTimeTracker, notifications, reminderActions,
                                  reminderGating, reminderTriggerState,
                                  preferencesStore, messageSelector, streakTracker
  config/                     - reminderConfig.ts, messagePool.ts
  db/                         - local storage / database layer (not yet used)
```

## Project Status

**Phase 4 — Message pool and personalization.** Notifications now pull from
a 34-message pool (English + Hindi/Hinglish, mixed Devanagari and Roman
script) instead of one static line, filtered by tone and time of day,
never immediately repeating, personalized with a name that defaults to
"Mummy". The Phase 3 snooze-escalation path now pulls from the pool's
`direct` tone instead of a hardcoded string. A small in-app (not push)
banner celebrates 3/5/10-in-a-row "Done" streaks. The debug panel gained a
last-selected-message readout, streak count, a manual test-notification
button, and Simulate Done/Skip buttons.

Explicitly not in this phase: SQLite logging (the streak counter is an
AsyncStorage placeholder Phase 5 will migrate), a real Settings screen UI,
and update mechanism changes.

Planned next (later phases):

- Local logging (SQLite) — wired into `onReminderResolved` and the streak counter
- Settings screen UI (name, active hours, thresholds — logic/storage already in place)
- An update mechanism (since the app isn't distributed via the Play Store)
