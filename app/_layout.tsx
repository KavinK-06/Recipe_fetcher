import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Colors } from '../constants/colors';
import { tokenCache } from '../lib/auth/tokenCache';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { PaywallProvider } from '../components/PaywallProvider';

SplashScreen.preventAutoHideAsync();

// One client for the app's lifetime; drives TanStack Query caching/mutations.
const queryClient = new QueryClient();

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { isLoaded: clerkLoaded } = useAuth();

  useProtectedRoute();

  useEffect(() => {
    if (fontsReady && clerkLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady, clerkLoaded]);

  // Hold the tree until fonts AND Clerk are both ready so we never flash a
  // wrong-state screen before the redirect hook fires.
  if (!fontsReady || !clerkLoaded) {
    return null;
  }

  return (
    // GestureHandlerRootView must wrap the whole app or any GestureDetector
    // (e.g. cook mode's swipe-between-steps) throws at render time.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaywallProvider>
          <View style={{ flex: 1, backgroundColor: Colors.noir }}>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.noir },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="recipe/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="cook/[id]" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="shopping" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="collections/[id]" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </View>
        </PaywallProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  const fontsReady = fontsLoaded || !!fontError;

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <QueryClientProvider client={queryClient}>
        <RootNavigator fontsReady={fontsReady} />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
