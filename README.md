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

## Project structure

```
App.tsx                        - app entry point, onboarding/home routing
index.ts                       - registers the Headless JS tracking task
modules/screen-tracker/        - local native module: screen on/off signal,
                                  foreground service, Usage Access helpers
src/
  screens/                    - top-level screens (Home, PermissionOnboarding)
  components/                 - shared/reusable UI components
  services/                   - screenTimeTracker, notifications
  config/                     - reminderConfig.ts and other constants
  db/                         - local storage / database layer (not yet used)
```

## Project Status

**Phase 2 — Core reminder engine.** Continuous screen-time tracking, the
Usage Access onboarding flow, and a single plain "Time to move" notification
at the 30-minute threshold. A temporary on-screen debug counter is included
for on-device verification.

Explicitly not in this phase: notification action buttons, message variety,
SQLite logging, a Settings UI, quiet hours, or an update mechanism.

Planned next (later phases):

- Notification actions (Done / Snooze / Skip)
- Message variety and personalization
- Local logging (SQLite)
- Settings screen with adjustable thresholds
- Quiet hours / active window logic
- An update mechanism (since the app isn't distributed via the Play Store)
