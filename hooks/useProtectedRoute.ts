import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

const PUBLIC_SEGMENTS = new Set(['(auth)', '(onboarding)']);

/**
 * Redirects between authenticated and unauthenticated route groups
 * based on Clerk's session state.
 *
 * - While Clerk is still loading, does nothing (splash should still cover the UI).
 * - Signed-in users sitting on the auth group are bounced to the tabs.
 * - Signed-out users hitting any non-public segment are bounced to sign-in.
 */
export function useProtectedRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const firstSegment = segments[0] as string | undefined;

    // The "/" entry gate (app/index.tsx) has no first segment and owns the
    // initial redirect — stay out of its way so we don't race it elsewhere.
    if (!firstSegment) return;

    const inPublicGroup = PUBLIC_SEGMENTS.has(firstSegment);

    // A signed-in user has no business on the auth or onboarding screens.
    if (isSignedIn && inPublicGroup) {
      router.replace('/(tabs)');
      return;
    }

    if (!isSignedIn && !inPublicGroup) {
      router.replace('/(auth)/sign-in');
    }
  }, [isLoaded, isSignedIn, segments, router]);
}
