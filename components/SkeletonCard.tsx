import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';

interface SkeletonCardProps {
  style?: ViewStyle;
}

function SkeletonPulse({ style }: { style?: ViewStyle }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[style, animatedStyle]} />;
}

export default function SkeletonCard({ style }: SkeletonCardProps) {
  return (
    <View style={[styles.card, style]}>
      {/* Image placeholder */}
      <SkeletonPulse style={styles.imageSkeleton} />

      <View style={styles.info}>
        {/* Title line 1 */}
        <SkeletonPulse style={[styles.line, { width: '90%' }]} />
        {/* Title line 2 */}
        <SkeletonPulse style={[styles.line, { width: '60%', marginTop: 6 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  imageSkeleton: {
    height: 140,
    backgroundColor: Colors.muted,
  },
  info: {
    padding: 12,
  },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.muted,
  },
});
