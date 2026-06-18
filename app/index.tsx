import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

import { hasCompletedOnboarding } from '../lib/onboarding';

/**
 * Entry gate — the app's single `/` route. It owns the very first redirect so
 * onboarding shows *exactly once* and returning users skip straight in:
 *
 *   - signed in              → tabs
 *   - never onboarded         → onboarding slides
 *   - onboarded but signed out → sign-in
 *
 * Renders null (the splash stays up) until BOTH Clerk's session state and the
 * stored onboarding flag have resolved, so we never flash the wrong screen.
 * `useProtectedRoute` deliberately no-ops while we're on this route so it
 * doesn't race us to a different destination.
 */
export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    hasCompletedOnboarding().then(setOnboarded);
  }, []);

  if (!isLoaded || onboarded === null) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }
  if (!onboarded) {
    return <Redirect href="/(onboarding)/welcome" />;
  }
  return <Redirect href="/(auth)/sign-in" />;
}
