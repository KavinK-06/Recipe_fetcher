import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';

export interface IngredientRowProps {
  quantity: string;
  unit?: string;
  name: string;
  isChecked?: boolean;
  onToggle?: () => void;
  style?: ViewStyle;
}

export default function IngredientRow({
  quantity,
  unit,
  name,
  isChecked = false,
  onToggle,
  style,
}: IngredientRowProps) {
  const checkScale = useSharedValue(1);
  const strikeWidth = useSharedValue(isChecked ? 1 : 0);
  const textOpacity = useSharedValue(isChecked ? 0.4 : 1);

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const strikeAnimStyle = useAnimatedStyle(() => ({
    width: `${strikeWidth.value * 100}%` as unknown as number,
  }));

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  // Strike-through + dim follow the checked state (owned by the parent), so the
  // row stays in sync whether it's toggled here or reset from outside.
  useEffect(() => {
    strikeWidth.value = withTiming(isChecked ? 1 : 0, {
      duration: 280,
      easing: Easing.out(Easing.quad),
    });
    textOpacity.value = withTiming(isChecked ? 0.4 : 1, { duration: 200 });
  }, [isChecked, strikeWidth, textOpacity]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // A contained press dip that settles back to exactly 1. withTiming can't
    // overshoot its target, so — unlike an underdamped spring — the box never
    // ends up larger and never wobbles/oscillates after the tap.
    checkScale.value = withSequence(
      withTiming(0.9, { duration: 80, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }),
    );
    onToggle?.();
  };

  return (
    <Pressable onPress={handlePress} style={[styles.row, style]}>
      {/* Checkbox */}
      <Animated.View
        style={[
          styles.checkbox,
          isChecked && styles.checkboxChecked,
          checkAnimStyle,
        ]}
      >
        {isChecked && (
          <Ionicons name="checkmark" size={14} color={Colors.parchment} />
        )}
      </Animated.View>

      {/* Text */}
      <Animated.View style={[styles.textBlock, textAnimStyle]}>
        <View style={styles.nameWrapper}>
          <Text style={styles.name}>{name}</Text>
          {/* Strikethrough overlay */}
          <Animated.View style={[styles.strike, strikeAnimStyle]} />
        </View>
        {quantity || unit ? (
          <Text style={styles.quantity}>
            {quantity}
            {unit ? ` ${unit}` : ''}
          </Text>
        ) : (
          // No amount given (e.g. "some onions", "a sprinkle") — show a soft,
          // muted hint instead of a blank so the column never looks empty.
          <Text style={styles.quantityNone}>as needed</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.muted,
    gap: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.muted,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.burgundy,
    borderColor: Colors.burgundy,
  },
  textBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nameWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    color: Colors.parchment,
  },
  strike: {
    position: 'absolute',
    height: 1,
    top: '50%',
    left: 0,
    backgroundColor: Colors.muted,
    borderRadius: 1,
    overflow: 'hidden',
  },
  quantity: {
    fontFamily: Fonts.monoRegular,
    fontSize: 12,
    color: Colors.saffron,
    flexShrink: 0,
  },
  quantityNone: {
    fontFamily: Fonts.monoRegular,
    fontSize: 11,
    color: Colors.mutedText,
    flexShrink: 0,
  },
});
