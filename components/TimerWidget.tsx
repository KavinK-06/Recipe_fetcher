import React, { useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 96;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface TimerWidgetProps {
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  onToggle: () => void;
  onComplete?: () => void;
  style?: ViewStyle;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TimerWidget({
  totalSeconds,
  remainingSeconds,
  isRunning,
  onToggle,
  onComplete,
  style,
}: TimerWidgetProps) {
  const progress = useSharedValue(
    totalSeconds > 0 ? remainingSeconds / totalSeconds : 0,
  );
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    const target = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
    progress.value = withTiming(target, {
      duration: 800,
      easing: Easing.out(Easing.quad),
    });

    if (remainingSeconds === 0 && onComplete) {
      runOnJS(onComplete)();
    }
  }, [remainingSeconds, totalSeconds, progress, onComplete]);

  const strokeDashoffset = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    buttonScale.value = withSpring(0.88, { damping: 10, stiffness: 400 }, () => {
      buttonScale.value = withSpring(1, { damping: 12, stiffness: 280 });
    });
    onToggle();
  }, [onToggle, buttonScale]);

  const isFinished = remainingSeconds === 0;

  return (
    <View style={[styles.container, style]}>
      <Pressable onPress={handleToggle} hitSlop={10}>
        <Animated.View style={[styles.buttonWrapper, buttonAnimStyle]}>
          {/* Track ring */}
          <Svg width={SIZE} height={SIZE} style={styles.svg}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={Colors.muted}
              strokeWidth={STROKE}
              fill="none"
            />
            {/* Progress ring */}
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={isFinished ? Colors.paprika : Colors.saffron}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={strokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
          </Svg>

          {/* Centre content */}
          <View style={styles.centre}>
            <Text style={[styles.time, isFinished && styles.timeDone]}>
              {formatTime(remainingSeconds)}
            </Text>
            <Text style={styles.label}>
              {isFinished ? 'done' : isRunning ? 'tap to pause' : 'tap to start'}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWrapper: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontFamily: Fonts.monoBold,
    fontSize: 18,
    color: Colors.parchment,
    letterSpacing: 1,
  },
  timeDone: {
    color: Colors.paprika,
  },
  label: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 9,
    color: Colors.mutedText,
    marginTop: 2,
    textAlign: 'center',
  },
});
