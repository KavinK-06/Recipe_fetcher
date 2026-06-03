import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
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

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const next = !isChecked;
    checkScale.value = withSpring(0.7, { damping: 10, stiffness: 400 }, () => {
      checkScale.value = withSpring(1, { damping: 12, stiffness: 300 });
    });
    strikeWidth.value = withTiming(next ? 1 : 0, {
      duration: 280,
      easing: Easing.out(Easing.quad),
    });
    textOpacity.value = withTiming(next ? 0.4 : 1, { duration: 200 });

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
          <View style={styles.checkmark}>
            <View style={styles.checkmarkShort} />
            <View style={styles.checkmarkLong} />
          </View>
        )}
      </Animated.View>

      {/* Text */}
      <Animated.View style={[styles.textBlock, textAnimStyle]}>
        <View style={styles.nameWrapper}>
          <Text style={styles.name}>{name}</Text>
          {/* Strikethrough overlay */}
          <Animated.View style={[styles.strike, strikeAnimStyle]} />
        </View>
        <Text style={styles.quantity}>
          {quantity}
          {unit ? ` ${unit}` : ''}
        </Text>
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
  checkmark: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkShort: {
    position: 'absolute',
    left: 0,
    bottom: 3,
    width: 4,
    height: 1.5,
    backgroundColor: Colors.parchment,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  checkmarkLong: {
    position: 'absolute',
    right: 0,
    bottom: 1,
    width: 7,
    height: 1.5,
    backgroundColor: Colors.parchment,
    borderRadius: 1,
    transform: [{ rotate: '-50deg' }],
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
});
