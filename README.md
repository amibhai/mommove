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

Scan the QR code with the Expo Go app on your phone, or press `a` to open in
an Android emulator, to see the app running.

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
- `eas build --platform android --profile preview` — kicks off a cloud build. When it finishes, EAS will give you a URL to download the `.apk` file.

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

## Project structure

```
App.tsx           - app entry point
src/
  screens/        - top-level screens
  components/     - shared/reusable UI components
  services/       - business logic, background tasks, integrations
  config/         - app-wide configuration and constants
  db/             - local storage / database layer
```

## Project Status

**Phase 1 — Scaffold only.** This phase verifies the full pipeline (code →
GitHub → EAS build → APK → installs on phone) with a single placeholder
screen. No app features are implemented yet.

Planned next (later phases):

- Screen-time tracking
- Local notifications / reminders
- Local logging (SQLite)
- Personalization / settings
- An update mechanism (since the app isn't distributed via the Play Store)
