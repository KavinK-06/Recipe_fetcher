import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { getCollectionById, getRecipesForCollection, COLLECTIONS } from '../../constants/mockData';
import RecipeCard from '../../components/RecipeCard';
import SkeletonCard from '../../components/SkeletonCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

export default function CollectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const collection = getCollectionById(id) ?? COLLECTIONS[0];
  const recipes = getRecipesForCollection(collection);

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const toggleSave = (recipeId: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.has(recipeId) ? next.delete(recipeId) : next.add(recipeId);
      return next;
    });
  };

  const renderItem = ({ item, index }: { item: typeof recipes[number]; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 70).duration(260).springify()}
      style={styles.cardWrap}
    >
      <RecipeCard
        id={item.id}
        title={item.title}
        imageUri={item.imageUri}
        cookTime={item.cookTime}
        isSaved={savedIds.has(item.id)}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/recipe/${item.id}` as any);
        }}
        onSavePress={toggleSave}
      />
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
          hitSlop={6}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.parchment} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{collection.name}</Text>
          <Text style={styles.headerCount}>
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
          </Text>
        </View>
        <Pressable style={styles.backButton} hitSlop={6}>
          <Ionicons name="ellipsis-horizontal" size={20} color={Colors.muted} />
        </Pressable>
      </View>

      {recipes.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="restaurant-outline" size={36} color={Colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={styles.emptySub}>Import a recipe and add it to this collection.</Text>
          <Pressable
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/import' as any)}
          >
            <Ionicons name="add" size={16} color={Colors.parchment} />
            <Text style={styles.emptyButtonText}>Import a Recipe</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.noir,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 22,
    color: Colors.parchment,
  },
  headerCount: {
    fontFamily: Fonts.monoRegular,
    fontSize: 11,
    color: Colors.muted,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  row: {
    gap: 12,
    justifyContent: 'space-between',
  },
  cardWrap: {
    width: CARD_WIDTH,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 22,
    color: Colors.parchment,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.muted,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.burgundy,
    borderRadius: 50,
    paddingVertical: 13,
    paddingHorizontal: 22,
    marginTop: 4,
  },
  emptyButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.parchment,
  },
});
