import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';

export interface RecipeCardProps {
  id: string;
  title: string;
  imageUri: string;
  blurhash?: string;
  cookTime: string;
  isSaved?: boolean;
  onPress?: () => void;
  onSavePress?: (id: string) => void;
  /** When provided, the corner shows a 3-dot menu button instead of the bookmark. */
  onMenuPress?: (id: string) => void;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function RecipeCard({
  id,
  title,
  imageUri,
  blurhash,
  cookTime,
  isSaved = false,
  onPress,
  onSavePress,
  onMenuPress,
  style,
}: RecipeCardProps) {
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

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSavePress?.(id);
  };

  const handleMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onMenuPress?.(id);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
    >
      <View style={styles.card}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUri }}
            placeholder={blurhash}
            contentFit="cover"
            transition={300}
            // memory-disk caching avoids re-decoding the same image on scroll/
            // re-render; recyclingKey tells expo-image to swap the bitmap (not
            // reuse a stale one) when a virtualized row is recycled for a new card.
            cachePolicy="memory-disk"
            recyclingKey={id}
            style={styles.image}
          />
          {/* Cook time badge */}
          <View style={styles.timeBadge}>
            <Ionicons name="time-outline" size={11} color={Colors.noir} />
            <Text style={styles.timeBadgeText}>{cookTime}</Text>
          </View>
          {/* Corner action: 3-dot menu when onMenuPress is set, otherwise the
              save/remove bookmark (the collection screen still uses the bookmark). */}
          {onMenuPress ? (
            <Pressable onPress={handleMenu} hitSlop={8} style={styles.saveButton}>
              <Ionicons name="ellipsis-horizontal" size={18} color={Colors.parchment} />
            </Pressable>
          ) : onSavePress ? (
            <Pressable onPress={handleSave} hitSlop={8} style={styles.saveButton}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isSaved ? Colors.saffron : Colors.parchment}
              />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
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
  imageContainer: {
    position: 'relative',
    height: 140,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  timeBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.saffron,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 50,
  },
  timeBadgeText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 10,
    color: Colors.noir,
  },
  saveButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(26,10,14,0.55)',
    borderRadius: 20,
    padding: 6,
  },
  info: {
    padding: 12,
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.parchment,
  },
});
