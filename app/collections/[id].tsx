import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import RecipeCard from '../../components/RecipeCard';
import ConfirmDialog from '../../components/ConfirmDialog';
import BottomSheet from '../../components/BottomSheet';
import { useRecipes } from '../../hooks/useRecipes';
import {
  useCollection,
  useAddRecipeToCollection,
  useRemoveRecipeFromCollection,
  useDeleteCollection,
} from '../../hooks/useCollections';
import type { RecipeRow } from '../../lib/api/import';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

const cookTimeLabel = (mins: number | null) => (mins != null ? `${mins} min` : '—');

// ── Add-recipes picker ──────────────────────────────────────────────────────────
function AddRecipesModal({
  visible,
  onClose,
  allRecipes,
  inCollection,
  onToggle,
}: {
  visible: boolean;
  onClose: () => void;
  allRecipes: RecipeRow[];
  inCollection: Set<string>;
  onToggle: (recipe: RecipeRow, isIn: boolean) => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.pickerSheet}>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>Add recipes</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={22} color={Colors.muted} />
        </Pressable>
      </View>

      {allRecipes.length === 0 ? (
        <Text style={styles.pickerEmpty}>You have no recipes to add yet.</Text>
      ) : (
        <FlatList
          data={allRecipes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.pickerList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isIn = inCollection.has(item.id);
            return (
              <Pressable
                style={styles.pickerRow}
                onPress={() => {
                  Haptics.selectionAsync();
                  onToggle(item, isIn);
                }}
              >
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} contentFit="cover" transition={200} style={styles.pickerThumb} />
                ) : (
                  <View style={[styles.pickerThumb, styles.pickerThumbEmpty]}>
                    <Ionicons name="restaurant-outline" size={18} color={Colors.muted} />
                  </View>
                )}
                <Text style={styles.pickerRowTitle} numberOfLines={2}>{item.title}</Text>
                <View style={[styles.pickerCheck, isIn && styles.pickerCheckOn]}>
                  <Ionicons
                    name={isIn ? 'checkmark' : 'add'}
                    size={16}
                    color={isIn ? Colors.noir : Colors.parchment}
                  />
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </BottomSheet>
  );
}

export default function CollectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { collection, isLoading } = useCollection(id);
  const { recipes: allRecipes } = useRecipes();
  const addRecipe = useAddRecipeToCollection();
  const removeRecipe = useRemoveRecipeFromCollection();
  const deleteCollection = useDeleteCollection();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [recipeMenu, setRecipeMenu] = useState<RecipeRow | null>(null);
  const [recipeToRemove, setRecipeToRemove] = useState<RecipeRow | null>(null);
  const [confirmDeleteCollection, setConfirmDeleteCollection] = useState(false);

  const recipes = collection?.recipes ?? [];
  const inCollection = new Set(recipes.map((r) => r.id));

  const handleToggle = (recipe: RecipeRow, isIn: boolean) => {
    if (!id) return;
    if (isIn) {
      removeRecipe.mutate({ collectionId: id, recipeId: recipe.id });
    } else {
      addRecipe.mutate({ collectionId: id, recipeId: recipe.id });
    }
  };

  const openRecipeMenu = (recipe: RecipeRow) => {
    Haptics.selectionAsync();
    setRecipeMenu(recipe);
  };

  const handleRemoveFromMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const r = recipeMenu;
    setRecipeMenu(null);
    // Let the menu slide out before the confirm dialog presents — two native
    // Modals on screen at once misbehaves on iOS (same pattern as the header menu).
    setTimeout(() => {
      if (r) setRecipeToRemove(r);
    }, 260);
  };

  const handleRemoveConfirmed = () => {
    if (!id || !recipeToRemove) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeRecipe.mutate(
      { collectionId: id, recipeId: recipeToRemove.id },
      { onSettled: () => setRecipeToRemove(null) },
    );
  };

  const openMenu = () => {
    Haptics.selectionAsync();
    setMenuVisible(true);
  };

  const handleDeleteCollectionConfirmed = () => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    deleteCollection.mutate(id, {
      onSuccess: () => {
        setConfirmDeleteCollection(false);
        router.back();
      },
      onError: (e) => {
        setConfirmDeleteCollection(false);
        Alert.alert('Could not delete', e.message);
      },
    });
  };

  const renderItem = ({ item, index }: { item: RecipeRow; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 70).duration(260).springify()}
      style={styles.cardWrap}
    >
      <RecipeCard
        id={item.id}
        title={item.title}
        imageUri={item.image_url ?? ''}
        cookTime={cookTimeLabel(item.cook_time_minutes)}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/recipe/${item.id}` as any);
        }}
        onMenuPress={() => openRecipeMenu(item)}
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
          <Text style={styles.headerTitle} numberOfLines={1}>{collection?.name ?? 'Collection'}</Text>
          <Text style={styles.headerCount}>
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
          </Text>
        </View>
        <Pressable style={styles.backButton} hitSlop={6} onPress={openMenu}>
          <Ionicons name="ellipsis-horizontal" size={20} color={Colors.muted} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Colors.saffron} />
        </View>
      ) : recipes.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="restaurant-outline" size={36} color={Colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={styles.emptySub}>Add recipes you've imported to this collection.</Text>
          <Pressable style={styles.emptyButton} onPress={() => setPickerVisible(true)}>
            <Ionicons name="add" size={16} color={Colors.parchment} />
            <Text style={styles.emptyButtonText}>Add Recipes</Text>
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
          ListFooterComponent={
            <Pressable style={styles.addMore} onPress={() => setPickerVisible(true)}>
              <Ionicons name="add" size={16} color={Colors.saffron} />
              <Text style={styles.addMoreText}>Add more recipes</Text>
            </Pressable>
          }
        />
      )}

      {/* Collection actions menu */}
      <BottomSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        sheetStyle={styles.menuSheet}
      >
        <Text style={styles.menuTitle} numberOfLines={1}>
          {collection?.name ?? 'Collection'}
        </Text>

        <Pressable
          style={styles.menuRow}
          onPress={() => {
            Haptics.selectionAsync();
            setMenuVisible(false);
            // Let the menu finish sliding out before presenting the next sheet —
            // two native Modals on screen at once misbehaves on iOS.
            setTimeout(() => setPickerVisible(true), 260);
          }}
        >
          <View style={styles.menuIcon}>
            <Ionicons name="add" size={20} color={Colors.saffron} />
          </View>
          <Text style={styles.menuLabel}>Add recipes</Text>
        </Pressable>

        <Pressable
          style={styles.menuRow}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setMenuVisible(false);
            setTimeout(() => setConfirmDeleteCollection(true), 260);
          }}
        >
          <View style={[styles.menuIcon, styles.menuIconDanger]}>
            <Ionicons name="trash-outline" size={19} color={Colors.paprika} />
          </View>
          <Text style={[styles.menuLabel, styles.menuLabelDanger]}>Delete collection</Text>
        </Pressable>
      </BottomSheet>

      {/* Per-recipe menu (3-dot on each card) */}
      <BottomSheet
        visible={recipeMenu !== null}
        onClose={() => setRecipeMenu(null)}
        sheetStyle={styles.menuSheet}
      >
        <Text style={styles.menuTitle} numberOfLines={1}>
          {recipeMenu?.title ?? 'Recipe'}
        </Text>

        <Pressable
          style={styles.menuRow}
          onPress={() => {
            Haptics.selectionAsync();
            const r = recipeMenu;
            setRecipeMenu(null);
            if (r) router.push(`/recipe/${r.id}` as any);
          }}
        >
          <View style={styles.menuIcon}>
            <Ionicons name="open-outline" size={20} color={Colors.saffron} />
          </View>
          <Text style={styles.menuLabel}>Open recipe</Text>
        </Pressable>

        <Pressable style={styles.menuRow} onPress={handleRemoveFromMenu}>
          <View style={[styles.menuIcon, styles.menuIconDanger]}>
            <Ionicons name="trash-outline" size={19} color={Colors.paprika} />
          </View>
          <Text style={[styles.menuLabel, styles.menuLabelDanger]}>
            Remove from collection
          </Text>
        </Pressable>
      </BottomSheet>

      <AddRecipesModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        allRecipes={allRecipes}
        inCollection={inCollection}
        onToggle={handleToggle}
      />

      <ConfirmDialog
        visible={recipeToRemove !== null}
        icon="bookmark-outline"
        title="Remove from collection?"
        message={
          recipeToRemove ? `"${recipeToRemove.title}" stays in your recipes.` : undefined
        }
        confirmLabel="Remove"
        busy={removeRecipe.isPending}
        onConfirm={handleRemoveConfirmed}
        onCancel={() => setRecipeToRemove(null)}
      />

      <ConfirmDialog
        visible={confirmDeleteCollection}
        icon="albums-outline"
        title="Delete collection?"
        message={`"${collection?.name ?? 'This collection'}" will be removed. Your recipes are kept.`}
        confirmLabel="Delete"
        busy={deleteCollection.isPending}
        onConfirm={handleDeleteCollectionConfirmed}
        onCancel={() => setConfirmDeleteCollection(false)}
      />
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
    color: Colors.mutedText,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  addMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.muted,
    borderStyle: 'dashed',
  },
  addMoreText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.saffron,
  },

  // Empty
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
    color: Colors.mutedText,
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

  // Actions menu
  menuSheet: {
    paddingHorizontal: 20,
  },
  menuTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    color: Colors.parchment,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconDanger: {
    borderColor: Colors.paprika,
  },
  menuLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
    color: Colors.parchment,
  },
  menuLabelDanger: {
    color: Colors.paprika,
  },

  // Picker modal
  pickerSheet: {
    maxHeight: '78%',
    backgroundColor: Colors.surface,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  pickerTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 20,
    color: Colors.parchment,
  },
  pickerEmpty: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    color: Colors.mutedText,
    textAlign: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  pickerList: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  pickerThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    flexShrink: 0,
  },
  pickerThumbEmpty: {
    backgroundColor: Colors.noir,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerRowTitle: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.parchment,
  },
  pickerCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pickerCheckOn: {
    backgroundColor: Colors.saffron,
    borderColor: Colors.saffron,
  },
});
