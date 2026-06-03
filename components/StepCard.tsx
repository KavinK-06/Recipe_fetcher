import React, { useState } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import TimerWidget from './TimerWidget';

export interface StepCardProps {
  stepNumber: number;
  totalSteps: number;
  instruction: string;
  timerSeconds?: number;
  isActive?: boolean;
  style?: ViewStyle;
}

export default function StepCard({
  stepNumber,
  totalSteps,
  instruction,
  timerSeconds,
  isActive = false,
  style,
}: StepCardProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [remaining, setRemaining] = useState(timerSeconds ?? 0);

  // Tick the timer down when running
  React.useEffect(() => {
    if (!isRunning || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, remaining]);

  // Reset remaining when timerSeconds prop changes (new step)
  React.useEffect(() => {
    setRemaining(timerSeconds ?? 0);
    setIsRunning(false);
  }, [timerSeconds]);

  const cardScale = useSharedValue(isActive ? 1 : 0.97);
  const cardOpacity = useSharedValue(isActive ? 1 : 0.55);

  React.useEffect(() => {
    cardScale.value = withSpring(isActive ? 1 : 0.97, { damping: 14, stiffness: 200 });
    cardOpacity.value = withTiming(isActive ? 1 : 0.55, { duration: 250 });
  }, [isActive, cardScale, cardOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const handleTimerToggle = () => {
    if (remaining === 0) {
      setRemaining(timerSeconds ?? 0);
      setIsRunning(true);
    } else {
      setIsRunning((r) => !r);
    }
  };

  return (
    <Animated.View style={[styles.card, isActive && styles.cardActive, animatedStyle, style]}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepNumber}>{stepNumber}</Text>
        </View>
        <Text style={styles.stepMeta}>
          Step {stepNumber} of {totalSteps}
        </Text>
        {isActive && <View style={styles.activeDot} />}
      </View>

      {/* Instruction */}
      <Text style={styles.instruction}>{instruction}</Text>

      {/* Timer (only if step has one) */}
      {timerSeconds != null && timerSeconds > 0 && (
        <View style={styles.timerRow}>
          <TimerWidget
            totalSeconds={timerSeconds}
            remainingSeconds={remaining}
            isRunning={isRunning}
            onToggle={handleTimerToggle}
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.muted,
  },
  cardActive: {
    borderColor: Colors.burgundy,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  stepBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: Colors.parchment,
  },
  stepMeta: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.paprika,
  },
  instruction: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.parchment,
  },
  timerRow: {
    marginTop: 20,
    alignItems: 'center',
  },
});
