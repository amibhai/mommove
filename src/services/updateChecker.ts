import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

const KEYS = {
  latestKnownVersion: '@mommove/updateChecker/latestKnownVersion',
  latestKnownApkUrl: '@mommove/updateChecker/latestKnownApkUrl',
  latestKnownChangelog: '@mommove/updateChecker/latestKnownChangelog',
  dismissedVersion: '@mommove/updateChecker/dismissedVersion',
} as const;

// Raw GitHub URL for the manifest at the repo root, main branch. If this
// file ever moves, this is the one line that needs to change.
const MANIFEST_URL = 'https://raw.githubusercontent.com/amibhai/mommove/main/manifest.json';

const FETCH_TIMEOUT_MS = 8000;

type Manifest = {
  latest_version: string;
  apk_url: string;
  changelog: string;
  min_supported_version: string;
};

export type UpdateCheckResult =
  | { status: 'update-available'; latestVersion: string; apkUrl: string; changelog: string }
  | { status: 'up-to-date' }
  | { status: 'check-failed' };

export type PendingUpdate = {
  latestVersion: string;
  apkUrl: string;
  changelog: string;
};

function isManifest(value: unknown): value is Manifest {
  const v = value as Partial<Manifest> | null;
  return (
    !!v &&
    typeof v.latest_version === 'string' &&
    typeof v.apk_url === 'string' &&
    typeof v.changelog === 'string' &&
    typeof v.min_supported_version === 'string'
  );
}

/**
 * Compares two dot-separated version strings. Positive if `a` > `b`, zero if
 * equal, negative if `a` < `b`. Missing/non-numeric segments count as 0, so
 * "1.2" vs "1.2.0" compares equal.
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.');
  const partsB = b.split('.');
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const numA = parseInt(partsA[i] ?? '0', 10) || 0;
    const numB = parseInt(partsB[i] ?? '0', 10) || 0;
    if (numA !== numB) {
      return numA - numB;
    }
  }
  return 0;
}

async function fetchManifest(): Promise<Manifest | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(MANIFEST_URL, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    const json = await response.json();
    return isManifest(json) ? json : null;
  } catch {
    // No internet, GitHub unreachable, request timed out, malformed JSON —
    // all treated the same: silently skip, try again next launch.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getCurrentNativeVersion(): string {
  return Application.nativeApplicationVersion ?? '0.0.0';
}

/**
 * Fetches the hosted manifest and compares it against the running native
 * build's version. Never throws — a failed/unreachable fetch resolves to
 * `check-failed` rather than rejecting, so callers never need a try/catch
 * to stay silent. Caches the result to AsyncStorage on success so
 * `getPendingUpdateForBanner` can render instantly without refetching.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const manifest = await fetchManifest();
  if (!manifest) {
    return { status: 'check-failed' };
  }

  await AsyncStorage.multiSet([
    [KEYS.latestKnownVersion, manifest.latest_version],
    [KEYS.latestKnownApkUrl, manifest.apk_url],
    [KEYS.latestKnownChangelog, manifest.changelog],
  ]);

  const currentVersion = getCurrentNativeVersion();
  if (compareVersions(manifest.latest_version, currentVersion) > 0) {
    return {
      status: 'update-available',
      latestVersion: manifest.latest_version,
      apkUrl: manifest.apk_url,
      changelog: manifest.changelog,
    };
  }
  return { status: 'up-to-date' };
}

/**
 * Reads the last-cached check result (no network call) and decides whether
 * the Home screen banner should render: there must be a known newer
 * version, and it must not be the version she already dismissed.
 */
export async function getPendingUpdateForBanner(): Promise<PendingUpdate | null> {
  const [[, latestVersion], [, apkUrl], [, changelog], [, dismissedVersion]] =
    await AsyncStorage.multiGet([
      KEYS.latestKnownVersion,
      KEYS.latestKnownApkUrl,
      KEYS.latestKnownChangelog,
      KEYS.dismissedVersion,
    ]);

  if (!latestVersion || !apkUrl) {
    return null;
  }
  if (compareVersions(latestVersion, getCurrentNativeVersion()) <= 0) {
    return null;
  }
  if (dismissedVersion === latestVersion) {
    return null;
  }

  return { latestVersion, apkUrl, changelog: changelog ?? '' };
}

/** Persists that she's dismissed the banner for this specific version. */
export async function dismissUpdateBanner(version: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.dismissedVersion, version);
}
