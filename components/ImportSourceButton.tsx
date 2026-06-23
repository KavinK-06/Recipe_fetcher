import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';

type IconLib = 'ionicons' | 'material';

export interface ImportSourceButtonProps {
  label: string;
  sublabel?: string;
  iconName: string;
  iconLib?: IconLib;
  iconColor?: string;
  // Optional usage pill shown on the right (e.g. "5 credits" remaining).
  badge?: string;
  badgeMuted?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ImportSourceButton({
  label,
  sublabel,
  iconName,
  iconLib = 'ionicons',
  iconColor = Colors.saffron,
  badge,
  badgeMuted = false,
  onPress,
  style,
}: ImportSourceButtonProps) {
  const scale = useSharedValue(1);
  const borderOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(107,26,42,${borderOpacity.value})`,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 14, stiffness: 300 });
    borderOpacity.value = withSpring(1, { damping: 14, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 300 });
    borderOpacity.value = withSpring(0, { damping: 14, stiffness: 300 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };

  const Icon =
    iconLib === 'material' ? (
      <MaterialCommunityIcons name={iconName as any} size={26} color={iconColor} />
    ) : (
      <Ionicons name={iconName as any} size={26} color={iconColor} />
    );

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
    >
      <Animated.View style={[styles.card, borderStyle]}>
        <View style={styles.iconWrap}>{Icon}</View>
        <View style={styles.textBlock}>
          <Text style={styles.label}>{label}</Text>
          {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
        </View>
        {badge ? (
          <View style={[styles.badge, badgeMuted && styles.badgeMuted]}>
            <Text style={[styles.badgeText, badgeMuted && styles.badgeTextMuted]}>{badge}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.noir,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.parchment,
  },
  sublabel: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.mutedText,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 50,
    backgroundColor: Colors.saffron,
    flexShrink: 0,
  },
  badgeMuted: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.muted,
  },
  badgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    color: Colors.noir,
    letterSpacing: 0.3,
  },
  badgeTextMuted: {
    color: Colors.mutedText,
  },
});
