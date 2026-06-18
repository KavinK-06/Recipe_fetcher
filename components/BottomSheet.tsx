import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
  type LayoutChangeEvent,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra styles for the sheet container (background, maxHeight, padding overrides). */
  sheetStyle?: StyleProp<ViewStyle>;
  /** Wrap the sheet in a KeyboardAvoidingView so it rides above the keyboard. */
  avoidKeyboard?: boolean;
}

// Drag further than this fraction of the sheet's height (or flick fast enough)
// to dismiss; anything less springs back to open.
const DISMISS_FRACTION = 0.25;
const DISMISS_VELOCITY = 800;

// Gentle, barely-overshooting spring for open + spring-back (high damping = calm
// settle, not a bouncy one). Used for every sheet entrance.
const OPEN_SPRING = { damping: 26, stiffness: 240 } as const;
// Where the sheet parks before its real height is known (any value off the bottom
// of the tallest phone works — it's never animated from here, only snapped).
const OFFSCREEN = 1200;

/**
 * A themed bottom sheet with a grab handle that can be tapped or swiped down to
 * dismiss. Owns its own slide-in/out animation (so the gesture and the open/close
 * share one translateY) and a fading scrim. The pan gesture lives on the handle
 * zone only, so inner ScrollViews / FlatLists scroll normally.
 */
export default function BottomSheet({
  visible,
  onClose,
  children,
  sheetStyle,
  avoidKeyboard,
}: Props) {
  const [rendered, setRendered] = useState(visible);
  const translateY = useSharedValue(OFFSCREEN);
  const scrim = useSharedValue(0);
  // Sheet height, measured on layout — the real slide distance + drag threshold.
  const sheetH = useSharedValue(OFFSCREEN);
  // Whether the entrance slide has fired for the current open. The first open
  // must wait for onLayout (real height) before springing — springing from the
  // fallback height is a much bigger distance and visibly over-bounces.
  const hasOpened = useRef(false);

  useEffect(() => {
    if (visible) {
      if (rendered) {
        // Re-opening mid-close: height is already known, spring up from here.
        hasOpened.current = true;
        translateY.value = withSpring(0, OPEN_SPRING);
        scrim.value = withTiming(1, { duration: 200 });
      } else {
        // Fresh open: mount now, let onLayout fire the slide with the real height.
        hasOpened.current = false;
        setRendered(true);
      }
    } else if (rendered) {
      scrim.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(sheetH.value, { duration: 240 }, (finished) => {
        if (finished) runOnJS(setRendered)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) return;
    sheetH.value = h;
    if (visible && !hasOpened.current) {
      hasOpened.current = true;
      translateY.value = h; // snap just below the screen, then slide up the real distance
      translateY.value = withSpring(0, OPEN_SPRING);
      scrim.value = withTiming(1, { duration: 200 });
    }
  };

  const dismiss = () => {
    Haptics.selectionAsync();
    onClose();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
      scrim.value = interpolate(
        translateY.value,
        [0, sheetH.value],
        [1, 0.15],
        Extrapolation.CLAMP,
      );
    })
    .onEnd((e) => {
      const shouldDismiss =
        e.translationY > sheetH.value * DISMISS_FRACTION || e.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        runOnJS(dismiss)();
      } else {
        translateY.value = withSpring(0, OPEN_SPRING);
        scrim.value = withTiming(1, { duration: 160 });
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(dismiss)();
  });

  const handleGesture = Gesture.Race(panGesture, tapGesture);

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const scrimAnimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  if (!rendered) return null;

  const Container = avoidKeyboard ? KeyboardAvoidingView : View;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* Modal content renders outside the app's root GestureHandlerRootView, so
          gestures inside it need their own root (required on Android). */}
      <GestureHandlerRootView style={styles.root}>
        <Container
          style={styles.root}
          {...(avoidKeyboard
            ? { behavior: Platform.OS === 'ios' ? ('padding' as const) : ('height' as const) }
            : {})}
        >
          <Animated.View style={[styles.scrim, scrimAnimStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
          </Animated.View>

          <Animated.View style={[styles.sheet, sheetStyle, sheetAnimStyle]} onLayout={onLayout}>
            <GestureDetector gesture={handleGesture}>
              <View style={styles.handleZone}>
                <View style={styles.handle} />
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </Container>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000A8',
  },
  sheet: {
    backgroundColor: Colors.noir,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.muted,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  // Generous grab/tap target around the dash.
  handleZone: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.muted,
  },
});
