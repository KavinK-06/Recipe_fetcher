import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { getRecipeById } from '../../constants/mockData';
import { useRecipe } from '../../hooks/useRecipe';
import { rowToUiRecipe, mockToUiRecipe } from '../../lib/recipes/uiRecipe';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Large cook-mode timer ──────────────────────────────────────────────────────
const TIMER_SIZE = 200;
const TIMER_STROKE = 8;
const TIMER_RADIUS = (TIMER_SIZE - TIMER_STROKE) / 2;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;

function CookTimer({
  totalSeconds,
  remaining,
  isRunning,
  onToggle,
  onReset,
}: {
  totalSeconds: number;
  remaining: number;
  isRunning: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  const progress = useSharedValue(remaining / totalSeconds);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(remaining / totalSeconds, {
      duration: 900,
      easing: Easing.out(Easing.quad),
    });
  }, [remaining, totalSeconds, progress]);

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: TIMER_CIRCUMFERENCE * (1 - progress.value),
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const isFinished = remaining === 0;

  return (
    <View style={cookTimerStyles.wrap}>
      <Svg width={TIMER_SIZE} height={TIMER_SIZE}>
        {/* Track */}
        <Circle
          cx={TIMER_SIZE / 2}
          cy={TIMER_SIZE / 2}
          r={TIMER_RADIUS}
          stroke={Colors.muted}
          strokeWidth={TIMER_STROKE}
          fill="none"
        />
        {/* Progress arc */}
        <AnimatedCircle
          cx={TIMER_SIZE / 2}
          cy={TIMER_SIZE / 2}
          r={TIMER_RADIUS}
          stroke={isFinished ? Colors.paprika : Colors.saffron}
          strokeWidth={TIMER_STROKE}
          fill="none"
          strokeDasharray={TIMER_CIRCUMFERENCE}
          strokeLinecap="round"
          rotation="-90"
          origin={`${TIMER_SIZE / 2}, ${TIMER_SIZE / 2}`}
          animatedProps={animatedCircleProps}
        />
      </Svg>

      {/* Centre content */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={cookTimerStyles.centre} pointerEvents="box-none">
          <Text style={[cookTimerStyles.time, isFinished && cookTimerStyles.timeDone]}>
            {formatTime(remaining)}
          </Text>
          <Text style={cookTimerStyles.label}>
            {isFinished ? 'Time’s up!' : isRunning ? 'Cooking…' : 'Paused'}
          </Text>
        </View>
      </View>

      {/* Controls below the ring */}
      <View style={cookTimerStyles.controls}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onReset();
          }}
          style={cookTimerStyles.secondaryBtn}
          hitSlop={6}
        >
          <Ionicons name="refresh" size={18} color={Colors.parchment} />
        </Pressable>

        <Animated.View style={buttonAnimStyle}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              buttonScale.value = withSpring(0.88, { damping: 10, stiffness: 400 }, () => {
                buttonScale.value = withSpring(1, { damping: 12, stiffness: 280 });
              });
              onToggle();
            }}
            style={cookTimerStyles.primaryBtn}
          >
            <Ionicons
              name={isFinished ? 'refresh' : isRunning ? 'pause' : 'play'}
              size={28}
              color={Colors.parchment}
              style={{ marginLeft: isRunning || isFinished ? 0 : 2 }}
            />
          </Pressable>
        </Animated.View>

        <View style={cookTimerStyles.secondaryBtn} />
      </View>
    </View>
  );
}

const cookTimerStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 18,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontFamily: Fonts.monoBold,
    fontSize: 44,
    color: Colors.parchment,
    letterSpacing: 2,
  },
  timeDone: {
    color: Colors.paprika,
  },
  label: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.muted,
    marginTop: 4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  primaryBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.paprika,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  secondaryBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Ingredient callout ─────────────────────────────────────────────────────────
function IngredientCallout({ items }: { items: string[] }) {
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={ingredientStyles.card}
    >
      <View style={ingredientStyles.header}>
        <Ionicons name="leaf-outline" size={13} color={Colors.saffron} />
        <Text style={ingredientStyles.headerText}>For this step</Text>
      </View>
      <View style={ingredientStyles.itemsRow}>
        {items.map((item) => (
          <View key={item} style={ingredientStyles.pill}>
            <Text style={ingredientStyles.pillText}>{item}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const ingredientStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.muted,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Colors.saffron,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  itemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    backgroundColor: Colors.noir,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.parchment,
    letterSpacing: 0.2,
  },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function CookModeScreen() {
  useKeepAwake();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  // Real recipe (UUID) via RLS; otherwise fall back to mock so ids from the
  // still-mock search/collections screens keep working.
  const { recipe: row, isLoading } = useRecipe(id);
  const recipe = useMemo(() => {
    if (row) return rowToUiRecipe(row);
    const mock = getRecipeById(id);
    return mock ? mockToUiRecipe(mock) : null;
  }, [row, id]);
  const COOK_STEPS = recipe?.steps ?? [];
  const recipeTitle = recipe?.title ?? '';

  const [stepIndex, setStepIndex] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentStep = COOK_STEPS[stepIndex];
  const totalSteps = COOK_STEPS.length;
  const isLast = stepIndex === totalSteps - 1;

  // Reset timer state when step changes
  useEffect(() => {
    setTimerRemaining(currentStep?.timerSeconds ?? 0);
    setTimerRunning(false);
  }, [stepIndex, currentStep?.timerSeconds]);

  // Tick timer
  useEffect(() => {
    if (!timerRunning || timerRemaining <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimerRemaining((r) => {
        const next = Math.max(0, r - 1);
        if (next === 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimerRunning(false);
        }
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning, timerRemaining]);

  // ── Gesture state ──
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const goToStep = useCallback((next: number) => {
    if (next < 0 || next >= totalSteps) return;
    setStepIndex(next);
  }, [totalSteps]);

  const triggerSwipe = useCallback((direction: 'next' | 'prev') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (direction === 'next') {
      goToStep(stepIndex + 1);
    } else {
      goToStep(stepIndex - 1);
    }
  }, [goToStep, stepIndex]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      // Resist if at the edge
      const canSwipeLeft = stepIndex < totalSteps - 1;
      const canSwipeRight = stepIndex > 0;
      const resistance =
        (e.translationX < 0 && !canSwipeLeft) ||
        (e.translationX > 0 && !canSwipeRight)
          ? 0.3 : 1;
      translateX.value = e.translationX * resistance;
      opacity.value = interpolate(
        Math.abs(translateX.value),
        [0, SCREEN_WIDTH * 0.5],
        [1, 0.4],
        Extrapolation.CLAMP,
      );
    })
    .onEnd((e) => {
      const shouldNext =
        e.translationX < -SWIPE_THRESHOLD && stepIndex < totalSteps - 1;
      const shouldPrev =
        e.translationX > SWIPE_THRESHOLD && stepIndex > 0;

      if (shouldNext) {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 220 }, () => {
          runOnJS(triggerSwipe)('next');
          translateX.value = SCREEN_WIDTH;
          translateX.value = withSpring(0, { damping: 18, stiffness: 200 });
        });
      } else if (shouldPrev) {
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 220 }, () => {
          runOnJS(triggerSwipe)('prev');
          translateX.value = -SCREEN_WIDTH;
          translateX.value = withSpring(0, { damping: 18, stiffness: 200 });
        });
      } else {
        translateX.value = withSpring(0, { damping: 16, stiffness: 220 });
      }
      opacity.value = withTiming(1, { duration: 220 });
    });

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${interpolate(translateX.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-4, 0, 4])}deg` },
    ],
    opacity: opacity.value,
  }));

  // ── Progress bar ──
  const progressPct = (stepIndex + (doneSteps.has(stepIndex) ? 1 : 0.5)) / totalSteps;
  const progressWidth = useSharedValue(progressPct);
  useEffect(() => {
    progressWidth.value = withTiming(progressPct, { duration: 400 });
  }, [progressPct, progressWidth]);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  // ── Handlers ──
  const handleToggleTimer = () => {
    if (timerRemaining === 0) {
      setTimerRemaining(currentStep?.timerSeconds ?? 0);
      setTimerRunning(true);
      return;
    }
    setTimerRunning((r) => !r);
  };

  const handleResetTimer = () => {
    setTimerRunning(false);
    setTimerRemaining(currentStep?.timerSeconds ?? 0);
  };

  const handleMarkDone = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDoneSteps((prev) => new Set(prev).add(stepIndex));

    if (isLast) {
      // Could navigate to a completion screen
      router.back();
    } else {
      goToStep(stepIndex + 1);
    }
  };

  const handleExit = () => {
    Haptics.selectionAsync();
    router.back();
  };

  // ── All hooks are declared above this line ──
  if (isLoading && !recipe) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]} edges={['top']}>
        <ActivityIndicator color={Colors.saffron} />
      </SafeAreaView>
    );
  }
  if (!recipe || totalSteps === 0) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]} edges={['top']}>
        <Ionicons name="sad-outline" size={40} color={Colors.muted} />
        <Text style={styles.notFoundTitle}>Nothing to cook</Text>
        <Text style={styles.notFoundSub}>This recipe has no steps to follow.</Text>
        <Pressable style={styles.notFoundButton} onPress={() => router.back()}>
          <Text style={styles.notFoundButtonText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleExit}
          style={styles.topBarButton}
          hitSlop={6}
        >
          <Ionicons name="close" size={22} color={Colors.parchment} />
        </Pressable>
        <View style={styles.topBarCentre}>
          <Text style={styles.topBarEyebrow}>Cook Mode</Text>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {recipeTitle}
          </Text>
        </View>
        <View style={styles.stepCount}>
          <Text style={styles.stepCountText}>
            {stepIndex + 1}<Text style={styles.stepCountTotal}> / {totalSteps}</Text>
          </Text>
        </View>
      </View>

      {/* ── Progress bar ── */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>

      {/* ── Step pip row ── */}
      <View style={styles.pipRow}>
        {COOK_STEPS.map((_, i) => (
          <Pressable
            key={i}
            onPress={() => {
              Haptics.selectionAsync();
              goToStep(i);
            }}
            style={styles.pipHit}
            hitSlop={4}
          >
            <View
              style={[
                styles.pip,
                i === stepIndex && styles.pipActive,
                doneSteps.has(i) && styles.pipDone,
              ]}
            />
          </Pressable>
        ))}
      </View>

      {/* ── Swipeable step body ── */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.cardWrap, cardAnimStyle]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{stepIndex + 1}</Text>
            </View>
            <Text style={styles.stepMeta}>Step {stepIndex + 1}</Text>
          </View>

          <Text style={styles.instruction}>{currentStep.text}</Text>

          {/* Ingredient callout (mock recipes only carry per-step ingredients) */}
          {currentStep.ingredients.length > 0 && (
            <IngredientCallout items={currentStep.ingredients} />
          )}

          {/* Timer (if any) */}
          {currentStep.timerSeconds != null && currentStep.timerSeconds > 0 && (
            <View style={styles.timerWrap}>
              <CookTimer
                totalSeconds={currentStep.timerSeconds}
                remaining={timerRemaining}
                isRunning={timerRunning}
                onToggle={handleToggleTimer}
                onReset={handleResetTimer}
              />
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* ── Bottom controls ── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={[styles.navButton, stepIndex === 0 && styles.navButtonDisabled]}
          onPress={() => triggerSwipe('prev')}
          disabled={stepIndex === 0}
          hitSlop={4}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={stepIndex === 0 ? Colors.muted : Colors.parchment}
          />
        </Pressable>

        <Pressable
          style={[styles.markDoneButton, isLast && styles.markDoneFinish]}
          onPress={handleMarkDone}
        >
          <Ionicons
            name={isLast ? 'checkmark-done' : 'checkmark'}
            size={18}
            color={Colors.parchment}
          />
          <Text style={styles.markDoneText}>
            {isLast ? 'Finish Cooking' : 'Mark Done'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.navButton, isLast && styles.navButtonDisabled]}
          onPress={() => triggerSwipe('next')}
          disabled={isLast}
          hitSlop={4}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={isLast ? Colors.muted : Colors.parchment}
          />
        </Pressable>
      </View>

      {/* Swipe hint (first step only) */}
      {stepIndex === 0 && (
        <Animated.View
          entering={FadeIn.delay(800).duration(400)}
          exiting={FadeOut.duration(200)}
          style={[styles.swipeHint, { bottom: insets.bottom + 88 }]}
          pointerEvents="none"
        >
          <Ionicons name="swap-horizontal-outline" size={12} color={Colors.muted} />
          <Text style={styles.swipeHintText}>Swipe to navigate</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.noir,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCentre: {
    flex: 1,
    gap: 2,
  },
  topBarEyebrow: {
    fontFamily: Fonts.monoMedium,
    fontSize: 9,
    color: Colors.saffron,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  topBarTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 15,
    color: Colors.parchment,
  },
  stepCount: {
    backgroundColor: Colors.surface,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepCountText: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: Colors.parchment,
  },
  stepCountTotal: {
    color: Colors.muted,
    fontFamily: Fonts.monoRegular,
  },

  // Progress
  progressTrack: {
    height: 3,
    marginHorizontal: 16,
    backgroundColor: Colors.muted,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.saffron,
    borderRadius: 2,
  },

  // Pips
  pipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    paddingBottom: 8,
  },
  pipHit: {
    paddingVertical: 4,
  },
  pip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.muted,
  },
  pipActive: {
    backgroundColor: Colors.paprika,
    width: 18,
  },
  pipDone: {
    backgroundColor: Colors.saffron,
  },

  // Step card
  cardWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 20,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 16,
    color: Colors.parchment,
  },
  stepMeta: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  instruction: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 20,
    lineHeight: 30,
    color: Colors.parchment,
  },
  timerWrap: {
    alignItems: 'center',
    marginTop: 12,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.muted,
  },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.45,
  },
  markDoneButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.burgundy,
    borderRadius: 50,
    paddingVertical: 15,
  },
  markDoneFinish: {
    backgroundColor: Colors.paprika,
  },
  markDoneText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: Colors.parchment,
    letterSpacing: 0.3,
  },

  // Swipe hint
  swipeHint: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  swipeHintText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 0.4,
  },

  // Loading / not-found
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  notFoundTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    color: Colors.parchment,
    marginTop: 4,
  },
  notFoundSub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
  },
  notFoundButton: {
    marginTop: 10,
    backgroundColor: Colors.burgundy,
    borderRadius: 50,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  notFoundButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.parchment,
  },
});
