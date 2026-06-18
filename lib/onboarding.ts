import * as SecureStore from 'expo-secure-store';

// Whether the user has already seen the intro slides. Persisted with
// expo-secure-store (same primitive the Clerk token cache uses — no extra
// dependency). The value is a device-level flag, so it survives sign-out and
// only resets on reinstall.
const ONBOARDED_KEY = 'rasoi.hasOnboarded';

/** True once the user has finished (or skipped) the onboarding slides. */
export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(ONBOARDED_KEY)) === '1';
  } catch {
    // If storage is unavailable, fail open to "not onboarded" — the worst case
    // is the user sees the slides again, never a broken launch.
    return false;
  }
}

/** Records that onboarding is done so it never shows again on this install. */
export async function markOnboardingComplete(): Promise<void> {
  try {
    await SecureStore.setItemAsync(ONBOARDED_KEY, '1');
  } catch {
    // Non-fatal: at worst the slides reappear next launch.
  }
}
