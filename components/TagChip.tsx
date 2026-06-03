import React from 'react';
import { Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';

type ChipVariant = 'default' | 'active' | 'dietary' | 'cuisine';

interface TagChipProps {
  label: string;
  variant?: ChipVariant;
  onPress?: () => void;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const variantStyles: Record<ChipVariant, { bg: string; text: string; border: string }> = {
  default: { bg: Colors.surface, text: Colors.parchment, border: Colors.muted },
  active: { bg: Colors.burgundy, text: Colors.parchment, border: Colors.burgundy },
  dietary: { bg: 'transparent', text: Colors.saffron, border: Colors.saffron },
  cuisine: { bg: 'transparent', text: Colors.paprika, border: Colors.paprika },
};

export default function TagChip({
  label,
  variant = 'default',
  onPress,
  style,
}: TagChipProps) {
  const scale = useSharedValue(1);
  const v = variantStyles[variant];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.93, { damping: 15, stiffness: 350 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 350 });
  };

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress?.();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        animatedStyle,
        styles.chip,
        { backgroundColor: v.bg, borderColor: v.border },
        style,
      ]}
    >
      <Text style={[styles.label, { color: v.text }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
