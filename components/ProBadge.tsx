import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';

type BadgeVariant =
  | 'inline'   // small pill beside a feature label
  | 'banner'   // full-width upgrade CTA card
  | 'lock';    // icon-only lock overlay for gated content

export interface ProBadgeProps {
  variant?: BadgeVariant;
  onPress?: () => void;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Inline pill ────────────────────────────────────────────────────────────────
function InlinePill({ onPress, style }: { onPress?: () => void; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, style]}>
      <Ionicons name="lock-closed" size={9} color={Colors.noir} />
      <Text style={styles.pillText}>PRO</Text>
    </Pressable>
  );
}

// ── Lock overlay ───────────────────────────────────────────────────────────────
function LockOverlay({ onPress, style }: { onPress?: () => void; style?: ViewStyle }) {
  const shake = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const handlePress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    shake.value = withSequence(
      withTiming(-6, { duration: 60 }),
      withTiming(6, { duration: 60 }),
      withTiming(-4, { duration: 60 }),
      withTiming(4, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
    onPress?.();
  };

  return (
    <Animated.View style={[styles.lockOverlay, style, animatedStyle]}>
      <Pressable onPress={handlePress} style={styles.lockContent}>
        <View style={styles.lockIconWrap}>
          <Ionicons name="lock-closed" size={22} color={Colors.parchment} />
        </View>
        <Text style={styles.lockLabel}>Pro Feature</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Banner CTA ─────────────────────────────────────────────────────────────────
function BannerCTA({ onPress, style }: { onPress?: () => void; style?: ViewStyle }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 14, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 300 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
    >
      <View style={styles.banner}>
        {/* Decorative background circles */}
        <View style={styles.bannerCircle1} />
        <View style={styles.bannerCircle2} />

        <View style={styles.bannerContent}>
          <View style={styles.bannerLeft}>
            <View style={styles.bannerBadge}>
              <Ionicons name="star" size={11} color={Colors.noir} />
              <Text style={styles.bannerBadgeText}>PRO</Text>
            </View>
            <Text style={styles.bannerTitle}>Go Pro</Text>
            <Text style={styles.bannerSubtitle}>Unlimited recipes & AI features</Text>
          </View>
          <View style={styles.bannerArrow}>
            <Ionicons name="arrow-forward" size={18} color={Colors.parchment} />
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

// ── Public component ───────────────────────────────────────────────────────────
export default function ProBadge({
  variant = 'inline',
  onPress,
  style,
}: ProBadgeProps) {
  if (variant === 'lock') return <LockOverlay onPress={onPress} style={style} />;
  if (variant === 'banner') return <BannerCTA onPress={onPress} style={style} />;
  return <InlinePill onPress={onPress} style={style} />;
}

const styles = StyleSheet.create({
  // Inline pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.saffron,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 50,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontFamily: Fonts.monoBold,
    fontSize: 9,
    color: Colors.noir,
    letterSpacing: 0.8,
  },

  // Lock overlay
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,10,14,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  lockContent: {
    alignItems: 'center',
    gap: 8,
  },
  lockIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.parchment,
    letterSpacing: 0.4,
  },

  // Banner CTA
  banner: {
    backgroundColor: Colors.burgundy,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
  },
  bannerCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(196,69,42,0.25)',
    top: -30,
    right: -20,
  },
  bannerCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(232,184,122,0.12)',
    bottom: -20,
    right: 40,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    gap: 4,
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.saffron,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 50,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  bannerBadgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 9,
    color: Colors.noir,
    letterSpacing: 0.8,
  },
  bannerTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 22,
    color: Colors.parchment,
  },
  bannerSubtitle: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: 'rgba(247,240,230,0.7)',
  },
  bannerArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(247,240,230,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
