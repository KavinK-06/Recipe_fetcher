import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import CollectionCard from '../../components/CollectionCard';
import ConfirmDialog from '../../components/ConfirmDialog';
import BottomSheet from '../../components/BottomSheet';
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  type CollectionWithMeta,
} from '../../hooks/useCollections';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

const pad4 = (urls: string[]): [string?, string?, string?, string?] =>
  [urls[0], urls[1], urls[2], urls[3]];

// ── New-collection modal ───────────────────────────────────────────────────────
function NewCollectionModal({
  visible,
  saving,
  onClose,
  onCreate,
}: {
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  React.useEffect(() => {
    if (!visible) setName('');
  }, [visible]);

  const handleCreate = () => {
    if (!name.trim() || saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCreate(name.trim());
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard sheetStyle={styles.sheet}>
      <Text style={styles.sheetTitle}>New Collection</Text>
      <Text style={styles.sheetSub}>Give your collection a name</Text>

      <View style={styles.sheetInput}>
        <Ionicons name="albums-outline" size={16} color={Colors.muted} />
        <TextInput
          style={styles.sheetTextInput}
          placeholder="e.g. Sunday Roasts"
          placeholderTextColor={Colors.mutedText}
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleCreate}
          autoCapitalize="words"
          editable={!saving}
        />
      </View>

      <View style={styles.sheetButtons}>
        <Pressable
          style={styles.sheetCancel}
          onPress={() => {
            Haptics.selectionAsync();
            onClose();
          }}
        >
          <Text style={styles.sheetCancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.sheetCreate, (!name.trim() || saving) && styles.sheetCreateDisabled]}
          onPress={handleCreate}
        >
          {saving ? (
            <ActivityIndicator color={Colors.parchment} size="small" />
          ) : (
            <Text style={styles.sheetCreateText}>Create</Text>
          )}
        </Pressable>
      </View>
    </BottomSheet>
  );
}

// ── FAB ───────────────────────────────────────────────────────────────────────
function FAB({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.fab, animStyle]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        onPressIn={() => {
          scale.value = withSpring(0.9, { damping: 12, stiffness: 320 });
          rotate.value = withSpring(45, { damping: 12, stiffness: 280 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 320 });
          rotate.value = withSpring(0, { damping: 12, stiffness: 280 });
        }}
        style={styles.fabInner}
      >
        <Ionicons name="add" size={28} color={Colors.parchment} />
      </Pressable>
    </Animated.View>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name="albums-outline" size={42} color={Colors.muted} />
      </View>
      <Text style={styles.emptyHeadline}>No collections yet</Text>
      <Text style={styles.emptySub}>
        Organise your recipes into collections like "Weeknight Dinners" or "Baking".
      </Text>
      <Pressable
        style={styles.emptyButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onCreate();
        }}
      >
        <Ionicons name="add" size={16} color={Colors.parchment} />
        <Text style={styles.emptyButtonText}>Create your first collection</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function CollectionsScreen() {
  const router = useRouter();
  const { collections, isLoading } = useCollections();
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CollectionWithMeta | null>(null);

  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);

  const handleCreate = (name: string) => {
    createCollection.mutate(name, {
      onSuccess: () => closeModal(),
      onError: (e) => Alert.alert('Could not create', e.message),
    });
  };

  const confirmDelete = (item: CollectionWithMeta) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingDelete(item);
  };

  const handleDeleteConfirmed = () => {
    if (!pendingDelete) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    deleteCollection.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
      onError: (e) => {
        setPendingDelete(null);
        Alert.alert('Could not delete', e.message);
      },
    });
  };

  const renderItem = ({ item, index }: { item: CollectionWithMeta; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(280).springify()}
      style={styles.cardWrap}
    >
      <CollectionCard
        name={item.name}
        recipeCount={item.recipeCount}
        imageUris={pad4(item.coverImages)}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/collections/${item.id}` as any);
        }}
        onLongPress={() => confirmDelete(item)}
      />
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Collections</Text>
        <Text style={styles.headerCount}>
          {collections.length} {collections.length === 1 ? 'collection' : 'collections'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Colors.saffron} />
        </View>
      ) : collections.length === 0 ? (
        <EmptyState onCreate={openModal} />
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {!isLoading && collections.length > 0 && <FAB onPress={openModal} />}

      <NewCollectionModal
        visible={modalVisible}
        saving={createCollection.isPending}
        onClose={closeModal}
        onCreate={handleCreate}
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        icon="albums-outline"
        title="Delete collection?"
        message={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed. Your recipes are kept.`
            : undefined
        }
        confirmLabel="Delete"
        busy={deleteCollection.isPending}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setPendingDelete(null)}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 30,
    color: Colors.parchment,
  },
  headerCount: {
    fontFamily: Fonts.monoRegular,
    fontSize: 12,
    color: Colors.mutedText,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 14,
  },
  row: {
    gap: 14,
    justifyContent: 'space-between',
  },
  cardWrap: {
    width: CARD_WIDTH,
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
  },
  fabInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.paprika,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  sheet: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 28,
    gap: 14,
  },
  sheetTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 24,
    color: Colors.parchment,
  },
  sheetSub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    color: Colors.mutedText,
    marginTop: -6,
  },
  sheetInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.noir,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sheetTextInput: {
    flex: 1,
    fontFamily: Fonts.bodyRegular,
    fontSize: 15,
    color: Colors.parchment,
    padding: 0,
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  sheetCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.mutedText,
  },
  sheetCreate: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 50,
    backgroundColor: Colors.burgundy,
    alignItems: 'center',
  },
  sheetCreateDisabled: {
    opacity: 0.45,
  },
  sheetCreateText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: Colors.parchment,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyHeadline: {
    fontFamily: Fonts.displayBold,
    fontSize: 24,
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
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 6,
  },
  emptyButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: Colors.parchment,
  },
});
