import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_BAR_HEIGHT = 64;
const IMPORT_BUTTON_SIZE = 62;

// ── Raised centre Import button ────────────────────────────────────────────────
function ImportTabButton({
  onPress,
  accessibilityState,
}: {
  onPress?: () => void;
  accessibilityState?: { selected?: boolean };
}) {
  const focused = accessibilityState?.selected ?? false;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 12, stiffness: 320 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 320 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };

  return (
    <View style={styles.importContainer} pointerEvents="box-none">
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={8}
      >
        <Animated.View
          style={[
            styles.importButton,
            focused && styles.importButtonFocused,
            animatedStyle,
          ]}
        >
          {/* Inner glow ring */}
          <View style={styles.importInnerRing} />
          <Ionicons
            name={focused ? 'sparkles' : 'add'}
            size={focused ? 26 : 30}
            color={Colors.parchment}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

// ── Standard tab icon wrapper ──────────────────────────────────────────────────
function TabIcon({
  name,
  focused,
}: {
  name: IoniconName;
  focused: boolean;
}) {
  const dotOpacity = useSharedValue(focused ? 1 : 0);
  const iconScale = useSharedValue(focused ? 1.08 : 1);

  React.useEffect(() => {
    dotOpacity.value = withSpring(focused ? 1 : 0, { damping: 14, stiffness: 250 });
    iconScale.value = withSpring(focused ? 1.08 : 1, { damping: 14, stiffness: 250 });
  }, [focused, dotOpacity, iconScale]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const dotAnimStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ scale: dotOpacity.value }],
  }));

  return (
    <View style={styles.tabIconWrap}>
      <Animated.View style={iconAnimStyle}>
        <Ionicons
          name={name}
          size={23}
          color={focused ? Colors.burgundy : Colors.muted}
        />
      </Animated.View>
      <Animated.View style={[styles.activeDot, dotAnimStyle]} />
    </View>
  );
}

// ── Tabs layout ────────────────────────────────────────────────────────────────
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();

  // Defense in depth: even if the redirect hook in the root layout hasn't
  // fired yet, never render tabs UI for a signed-out user.
  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.burgundy,
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: {
          fontFamily: Fonts.bodyMedium,
          fontSize: 10,
          letterSpacing: 0.4,
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: Colors.noir,
          borderTopColor: Colors.muted,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
          elevation: 0,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
            },
          }),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'search' : 'search-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <ImportTabButton
              onPress={props.onPress as () => void}
              accessibilityState={props.accessibilityState}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="collections"
        options={{
          title: 'Saved',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'bookmark' : 'bookmark-outline'}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'person' : 'person-outline'}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Standard tab icon
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.paprika,
    marginTop: 4,
  },

  // Raised Import button
  importContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  importButton: {
    width: IMPORT_BUTTON_SIZE,
    height: IMPORT_BUTTON_SIZE,
    borderRadius: IMPORT_BUTTON_SIZE / 2,
    backgroundColor: Colors.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22, // raise above tab bar
    borderWidth: 4,
    borderColor: Colors.noir,
    ...Platform.select({
      ios: {
        shadowColor: Colors.paprika,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  importButtonFocused: {
    backgroundColor: Colors.paprika,
  },
  importInnerRing: {
    ...StyleSheet.absoluteFillObject,
    margin: 4,
    borderRadius: (IMPORT_BUTTON_SIZE - 8) / 2,
    borderWidth: 1,
    borderColor: 'rgba(247,240,230,0.18)',
  },
});
