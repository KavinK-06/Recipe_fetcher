import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
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

import { Colors } from '../constants/colors';

SplashScreen.preventAutoHideAsync();

// Stub flags — flip to false to walk through onboarding/auth flows
const useIsAuthenticated = (): boolean => true;
const useHasCompletedOnboarding = (): boolean => true;

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useIsAuthenticated();
  const hasOnboarded = useHasCompletedOnboarding();

  useEffect(() => {
    const firstSegment = segments[0] as string | undefined;
    const inOnboarding = firstSegment === '(onboarding)';
    const inAuth = firstSegment === '(auth)';
    const inProtected = firstSegment === '(tabs)' || firstSegment === 'recipe' || firstSegment === 'cook' || firstSegment === 'shopping';

    if (!hasOnboarded && !inOnboarding) {
      router.replace('/(onboarding)');
      return;
    }

    if (hasOnboarded && !isAuthenticated && inProtected) {
      router.replace('/(auth)');
      return;
    }

    if (hasOnboarded && isAuthenticated && (inOnboarding || inAuth)) {
      router.replace('/(tabs)');
    }
  }, [segments, isAuthenticated, hasOnboarded, router]);

  return null;
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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: Colors.noir }}>
        <StatusBar style="light" />
        <AuthGate />
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
    </SafeAreaProvider>
  );
}
