import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';

export interface CollectionCardProps {
  name: string;
  recipeCount: number;
  // Up to 4 image URIs for the collage; missing slots show a muted placeholder
  imageUris: [string?, string?, string?, string?];
  blurhashes?: [string?, string?, string?, string?];
  onPress?: () => void;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function CollageSlot({
  uri,
  blurhash,
  style,
}: {
  uri?: string;
  blurhash?: string;
  style?: ViewStyle;
}) {
  if (!uri) {
    return <View style={[style, styles.slotEmpty]} />;
  }
  return (
    <Image
      source={{ uri }}
      placeholder={blurhash}
      contentFit="cover"
      transition={300}
      style={style}
    />
  );
}

export default function CollectionCard({
  name,
  recipeCount,
  imageUris,
  blurhashes = [],
  onPress,
  style,
}: CollectionCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
    >
      <View style={styles.card}>
        {/* 2×2 image collage */}
        <View style={styles.collage}>
          <View style={styles.collageRow}>
            <CollageSlot uri={imageUris[0]} blurhash={blurhashes[0]} style={styles.slot} />
            <CollageSlot uri={imageUris[1]} blurhash={blurhashes[1]} style={styles.slot} />
          </View>
          <View style={styles.collageRow}>
            <CollageSlot uri={imageUris[2]} blurhash={blurhashes[2]} style={styles.slot} />
            <CollageSlot uri={imageUris[3]} blurhash={blurhashes[3]} style={styles.slot} />
          </View>
          {/* Gradient scrim so text stays legible over any image combo */}
          <View style={styles.scrim} />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.count}>
            {recipeCount} {recipeCount === 1 ? 'recipe' : 'recipes'}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  collage: {
    height: 150,
    position: 'relative',
  },
  collageRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 1.5,
  },
  slot: {
    flex: 1,
  },
  slotEmpty: {
    flex: 1,
    backgroundColor: Colors.muted,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    // Manual dark gradient approximation via a semi-transparent layer at the bottom
    backgroundColor: 'transparent',
    // React Native doesn't support gradient in StyleSheet natively;
    // the scrim is kept subtle — screens can layer expo-linear-gradient if needed.
  },
  footer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  name: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    color: Colors.parchment,
  },
  count: {
    fontFamily: Fonts.monoRegular,
    fontSize: 11,
    color: Colors.saffron,
    letterSpacing: 0.4,
  },
});
