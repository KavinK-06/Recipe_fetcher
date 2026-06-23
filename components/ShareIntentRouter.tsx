import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useShareIntentContext } from 'expo-share-intent';

// Pulls the first http(s) URL out of shared free text ("Check this out
// https://youtu.be/…"), for the case where the native module hands us `text`
// rather than a clean `webUrl`.
function extractUrl(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

/**
 * Bridges an incoming Android share (YouTube "Share → Rasoi", or any app sharing
 * a recipe link) into the existing import flow. When a link is shared and the
 * user is signed in, it routes to the Import tab with the URL as a param — the
 * Import screen auto-starts the import — then clears the share so it fires once.
 * Renders nothing.
 *
 * A share that arrives while signed out is held by ShareIntentProvider until
 * Clerk resolves to signed-in, so the link survives the sign-in detour.
 */
export default function ShareIntentRouter() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent || !isSignedIn) return;
    const sharedUrl = shareIntent?.webUrl ?? extractUrl(shareIntent?.text);
    if (sharedUrl) {
      router.push({
        pathname: '/(tabs)/import',
        params: { sharedUrl, sharedAt: String(Date.now()) },
      } as never);
    }
    // Clear even when there's no usable URL, so a junk share doesn't get stuck
    // re-firing this effect.
    resetShareIntent();
  }, [hasShareIntent, isSignedIn, shareIntent, resetShareIntent, router]);

  return null;
}
