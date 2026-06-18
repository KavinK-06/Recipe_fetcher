import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import {
  useCollections,
  useAddRecipeToCollection,
  useCreateCollection,
} from '../hooks/useCollections';
import { useDeleteRecipe } from '../hooks/useRecipes';
import ConfirmDialog from './ConfirmDialog';
import BottomSheet from './BottomSheet';

interface Props {
  visible: boolean;
  /** The recipe the menu acts on. `null` keeps the sheet inert (nothing rendered). */
  recipe: { id: string; title: string } | null;
  onClose: () => void;
  /**
   * Skip the action menu (and its Delete option) and open straight to the
   * collection picker. Used by the import success flow, where the recipe was
   * just saved and the only relevant action is filing it into a collection.
   */
  collectionsOnly?: boolean;
}

/**
 * Per-recipe actions, presented as a bottom sheet (mirrors PaywallSheet's chrome).
 * Two steps: the action menu (Add to collection / Delete), and a collection picker
 * that can add to an existing collection or create one inline. Delete routes through
 * the delete-recipe Edge Function (via useDeleteRecipe) behind a confirm. In
 * `collectionsOnly` mode the menu/Delete step is skipped entirely.
 */
export default function RecipeActionsSheet({
  visible,
  recipe,
  onClose,
  collectionsOnly = false,
}: Props) {
  const [step, setStep] = useState<'menu' | 'collections'>(
    collectionsOnly ? 'collections' : 'menu',
  );
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { collections, isLoading } = useCollections();
  const addToCollection = useAddRecipeToCollection();
  const createCollection = useCreateCollection();
  const deleteRecipe = useDeleteRecipe();

  // Reset the internal flow each time the sheet is dismissed so the next open
  // starts back at the menu with a clean "added" set.
  useEffect(() => {
    if (!visible) {
      setStep(collectionsOnly ? 'collections' : 'menu');
      setCreating(false);
      setNewName('');
      setAddedIds(new Set());
      setConfirmDelete(false);
    }
  }, [visible, collectionsOnly]);

  if (!recipe) return null;

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirmDelete(true);
  };

  const confirmDeleteRecipe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    deleteRecipe.mutate(recipe.id, {
      onSuccess: () => {
        setConfirmDelete(false);
        onClose();
      },
      onError: (e) => {
        setConfirmDelete(false);
        Alert.alert('Could not delete', e.message);
      },
    });
  };

  const handleAdd = (collectionId: string) => {
    if (addedIds.has(collectionId)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToCollection.mutate(
      { collectionId, recipeId: recipe.id },
      {
        onSuccess: () => setAddedIds((prev) => new Set(prev).add(collectionId)),
        onError: (e) => Alert.alert('Could not add', e.message),
      },
    );
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    createCollection.mutate(name, {
      onSuccess: (col) => {
        setNewName('');
        setCreating(false);
        handleAdd(col.id);
      },
      onError: (e) => Alert.alert('Could not create', e.message),
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      {step === 'menu' ? (
            <>
              <Text style={styles.recipeTitle} numberOfLines={1}>
                {recipe.title}
              </Text>
              <ActionRow
                icon="albums-outline"
                label="Add to collection"
                onPress={() => setStep('collections')}
              />
              <ActionRow
                icon="trash-outline"
                label="Delete recipe"
                destructive
                busy={deleteRecipe.isPending}
                onPress={handleDelete}
              />
            </>
          ) : (
            <>
              <View style={styles.headerRow}>
                {collectionsOnly ? (
                  <View style={styles.headerSpacer} />
                ) : (
                  <Pressable hitSlop={10} onPress={() => setStep('menu')}>
                    <Ionicons name="chevron-back" size={22} color={Colors.parchment} />
                  </Pressable>
                )}
                <Text style={styles.headerTitle}>Add to collection</Text>
                <Pressable hitSlop={10} onPress={onClose}>
                  <Ionicons name="close" size={22} color={Colors.muted} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* New collection: a row that expands into an inline name field. */}
                {creating ? (
                  <View style={styles.createRow}>
                    <TextInput
                      style={styles.input}
                      value={newName}
                      onChangeText={setNewName}
                      placeholder="Collection name"
                      placeholderTextColor={Colors.mutedText}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleCreate}
                    />
                    <Pressable
                      style={[
                        styles.createBtn,
                        (createCollection.isPending || !newName.trim()) && styles.createBtnDisabled,
                      ]}
                      disabled={createCollection.isPending || !newName.trim()}
                      onPress={handleCreate}
                    >
                      {createCollection.isPending ? (
                        <ActivityIndicator size="small" color={Colors.parchment} />
                      ) : (
                        <Text style={styles.createBtnText}>Create</Text>
                      )}
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={styles.newRow} onPress={() => setCreating(true)}>
                    <View style={styles.newIcon}>
                      <Ionicons name="add" size={20} color={Colors.saffron} />
                    </View>
                    <Text style={styles.newLabel}>New collection</Text>
                  </Pressable>
                )}

                {isLoading ? (
                  <ActivityIndicator style={styles.loader} color={Colors.saffron} />
                ) : collections.length === 0 && !creating ? (
                  <Text style={styles.emptyText}>
                    No collections yet — create one above to start organizing.
                  </Text>
                ) : (
                  collections.map((c) => {
                    const added = addedIds.has(c.id);
                    return (
                      <Pressable key={c.id} style={styles.collRow} onPress={() => handleAdd(c.id)}>
                        <View style={styles.collIcon}>
                          <Ionicons name="albums" size={18} color={Colors.saffron} />
                        </View>
                        <View style={styles.collText}>
                          <Text style={styles.collName} numberOfLines={1}>
                            {c.name}
                          </Text>
                          <Text style={styles.collCount}>
                            {c.recipeCount} recipe{c.recipeCount !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        <Ionicons
                          name={added ? 'checkmark-circle' : 'add-circle-outline'}
                          size={22}
                          color={added ? Colors.saffron : Colors.muted}
                        />
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </>
          )}

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete recipe?"
        message={`"${recipe.title}" will be permanently removed. This can’t be undone.`}
        confirmLabel="Delete"
        busy={deleteRecipe.isPending}
        onConfirm={confirmDeleteRecipe}
        onCancel={() => setConfirmDelete(false)}
      />
    </BottomSheet>
  );
}

function ActionRow({
  icon,
  label,
  destructive,
  busy,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  destructive?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const tint = destructive ? Colors.paprika : Colors.saffron;
  return (
    <Pressable style={styles.actionRow} disabled={busy} onPress={onPress}>
      <View style={[styles.actionIcon, destructive && styles.actionIconDanger]}>
        {busy ? (
          <ActivityIndicator size="small" color={tint} />
        ) : (
          <Ionicons name={icon} size={20} color={tint} />
        )}
      </View>
      <Text style={[styles.actionLabel, destructive && styles.actionLabelDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 20,
    maxHeight: '80%',
  },

  recipeTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 17,
    color: Colors.parchment,
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  // Action menu rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconDanger: {
    borderColor: Colors.paprika,
  },
  actionLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
    color: Colors.parchment,
  },
  actionLabelDanger: {
    color: Colors.paprika,
  },

  // Collections step
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 17,
    color: Colors.parchment,
  },
  headerSpacer: {
    width: 22,
  },
  list: {
    marginTop: 4,
  },
  loader: {
    marginTop: 20,
  },
  emptyText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.mutedText,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },

  // New collection (collapsed + inline-create)
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  newIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
    color: Colors.saffron,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Fonts.bodyRegular,
    fontSize: 15,
    color: Colors.parchment,
  },
  createBtn: {
    backgroundColor: Colors.burgundy,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.parchment,
  },

  // Existing collection rows
  collRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  collIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collText: { flex: 1, gap: 2 },
  collName: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.parchment,
  },
  collCount: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.mutedText,
  },
});
