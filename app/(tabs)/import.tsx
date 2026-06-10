import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  Clipboard,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  FadeIn,
  FadeInDown,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { RECIPES } from '../../constants/mockData';
import ImportSourceButton from '../../components/ImportSourceButton';
import { useImportRecipe } from '../../hooks/useImportRecipe';
import { FreemiumLimitError, ImportError, type RecipeRow } from '../../lib/api/import';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ImportState = 'idle' | 'loading' | 'success';

const FETCH_STAGES = [
  'Reading the page…',
  'Extracting ingredients…',
  'Parsing steps…',
  'Almost done…',
];

const SOURCE_DOMAINS = ['instagram.com', 'youtube.com', 'tiktok.com'];
const RECENT_IMPORTS = RECIPES.slice(0, 3).map((r, i) => ({
  id: r.id,
  title: r.title,
  imageUri: r.imageUri,
  cookTime: r.cookTime,
  source: SOURCE_DOMAINS[i % SOURCE_DOMAINS.length],
}));

// The shape the success sheet renders — mapped from the imported recipe row.
type PreviewRecipe = {
  id: string;
  title: string;
  imageUri?: string;
  cookTime: string;
  servings: string;
  source: string;
  tags: string[];
};

// Map a DB recipe row (snake_case, from the Edge Function) to the preview shape.
function toPreview(r: RecipeRow): PreviewRecipe {
  let source = r.source_type as string;
  try {
    if (r.source_url) source = new URL(r.source_url).hostname.replace(/^www\./, '');
  } catch {
    // keep source_type fallback
  }
  return {
    id: r.id,
    title: r.title,
    imageUri: r.image_url ?? undefined,
    cookTime: r.cook_time_minutes != null ? `${r.cook_time_minutes} min` : '—',
    servings: r.servings != null ? `${r.servings} servings` : '',
    source,
    tags: r.tags ?? [],
  };
}

// Turn a typed ImportError code into a friendly message for the alert.
function importMessage(err: ImportError): string {
  switch (err.code) {
    case 'invalid_url':
    case 'invalid_youtube_url':
      return "That doesn't look like a valid link.";
    case 'user_not_found':
      return "Your account isn't set up yet. Try signing out and back in.";
    case 'no_transcript':
      return 'This video has no captions to read the recipe from.';
    case 'extraction_failed':
      return "Couldn't read a recipe from that link. Try a different one.";
    case 'missing_supabase_url':
      return 'App is misconfigured (missing Supabase URL).';
    default:
      return `Import failed (${err.status}). Please try again.`;
  }
}

// ── URL input row ──────────────────────────────────────────────────────────────
function UrlInputRow({
  value,
  onChange,
  onSubmit,
  onPaste,
  focused,
  setFocused,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onPaste: () => void;
  focused: boolean;
  setFocused: (b: boolean) => void;
}) {
  const borderScale = useSharedValue(0);

  useEffect(() => {
    borderScale.value = withSpring(focused ? 1 : 0, { damping: 14, stiffness: 250 });
  }, [focused, borderScale]);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: focused ? Colors.burgundy : Colors.muted,
  }));

  return (
    <View style={styles.urlBlock}>
      <Animated.View style={[styles.urlInputWrap, borderStyle]}>
        <Ionicons name="link-outline" size={18} color={Colors.muted} />
        <TextInput
          style={styles.urlInput}
          placeholder="Paste a recipe URL…"
          placeholderTextColor={Colors.muted}
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {value.length > 0 ? (
          <Pressable onPress={() => onChange('')} hitSlop={6}>
            <Ionicons name="close-circle" size={18} color={Colors.muted} />
          </Pressable>
        ) : null}
      </Animated.View>

      {value.length === 0 ? (
        <Pressable style={styles.pasteButton} onPress={onPaste}>
          <Ionicons name="clipboard-outline" size={16} color={Colors.parchment} />
          <Text style={styles.pasteText}>Paste</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.fetchButton} onPress={onSubmit}>
          <Ionicons name="arrow-forward" size={16} color={Colors.parchment} />
        </Pressable>
      )}
    </View>
  );
}

// ── Loading state overlay ──────────────────────────────────────────────────────
function LoadingOverlay({ url, onCancel }: { url: string; onCancel: () => void }) {
  const [stageIndex, setStageIndex] = useState(0);
  const progress = useSharedValue(0);
  const dotScale = useSharedValue(1);

  useEffect(() => {
    // Animate progress 0 → 90% over ~2.5s, then hold while the real request finishes
    progress.value = withTiming(0.9, { duration: 2500, easing: Easing.out(Easing.cubic) });

    // Pulse dot
    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 500, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 500, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );

    // Cycle stage labels
    const id = setInterval(() => {
      setStageIndex((i) => (i + 1) % FETCH_STAGES.length);
    }, 800);
    return () => clearInterval(id);
  }, [progress, dotScale]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={styles.loadingCard}
    >
      {/* Pulsing status dot */}
      <View style={styles.loadingHeader}>
        <Animated.View style={[styles.loadingDot, dotStyle]} />
        <Text style={styles.loadingTitle}>Fetching recipe…</Text>
        <Pressable onPress={onCancel} hitSlop={6}>
          <Text style={styles.loadingCancel}>Cancel</Text>
        </Pressable>
      </View>

      {/* URL preview */}
      <Text style={styles.loadingUrl} numberOfLines={1}>
        {url}
      </Text>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>

      {/* Stage label */}
      <Animated.Text
        key={stageIndex}
        entering={FadeIn.duration(240)}
        style={styles.loadingStage}
      >
        {FETCH_STAGES[stageIndex]}
      </Animated.Text>

      {/* Animated skeleton card */}
      <View style={styles.skeletonCard}>
        <SkeletonShimmer style={styles.skeletonImage} />
        <View style={styles.skeletonBody}>
          <SkeletonShimmer style={[styles.skeletonLine, { width: '85%' }]} />
          <SkeletonShimmer style={[styles.skeletonLine, { width: '60%' }]} />
          <View style={styles.skeletonMeta}>
            <SkeletonShimmer style={styles.skeletonPill} />
            <SkeletonShimmer style={styles.skeletonPill} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// Reusable shimmer block for skeleton
function SkeletonShimmer({ style }: { style?: any }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.shimmerBase, style, animStyle]} />;
}

// ── Success sheet ──────────────────────────────────────────────────────────────
function SuccessSheet({
  visible,
  recipe,
  onSave,
  onDiscard,
  onView,
}: {
  visible: boolean;
  recipe: PreviewRecipe | null;
  onSave: () => void;
  onDiscard: () => void;
  onView: () => void;
}) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 220 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 200, mass: 0.8 });
    } else {
      overlayOpacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 240, easing: Easing.in(Easing.cubic) });
    }
  }, [visible, translateY, overlayOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  if (!visible || !recipe) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Scrim */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.sheetScrim, overlayStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onDiscard} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, sheetStyle]}>
        {/* Drag handle */}
        <View style={styles.sheetHandle} />

        {/* Success header */}
        <View style={styles.successHeader}>
          <View style={styles.successCheck}>
            <Ionicons name="checkmark" size={18} color={Colors.parchment} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>Recipe imported</Text>
            <Text style={styles.successSub} numberOfLines={1}>
              From {recipe.source}
            </Text>
          </View>
        </View>

        {/* Recipe preview card */}
        <Pressable onPress={onView} style={styles.previewCard}>
          {recipe.imageUri ? (
            <Image
              source={{ uri: recipe.imageUri }}
              contentFit="cover"
              transition={300}
              style={styles.previewImage}
            />
          ) : (
            <View style={[styles.previewImage, styles.previewImageEmpty]}>
              <Ionicons name="restaurant-outline" size={28} color={Colors.muted} />
            </View>
          )}
          {/* Cook time badge */}
          <View style={styles.previewBadge}>
            <Ionicons name="time-outline" size={11} color={Colors.noir} />
            <Text style={styles.previewBadgeText}>{recipe.cookTime}</Text>
          </View>
          {/* Title block */}
          <View style={styles.previewBody}>
            <Text style={styles.previewTitle}>{recipe.title}</Text>
            <View style={styles.previewMetaRow}>
              {recipe.servings ? (
                <>
                  <Text style={styles.previewMeta}>{recipe.servings}</Text>
                  <View style={styles.previewMetaDot} />
                </>
              ) : null}
              <Text style={styles.previewMeta}>{recipe.cookTime}</Text>
            </View>
            {recipe.tags.length > 0 ? (
              <View style={styles.previewTagRow}>
                {recipe.tags.slice(0, 4).map((t) => (
                  <View key={t} style={styles.previewTag}>
                    <Text style={styles.previewTagText}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Pressable>

        {/* Actions */}
        <View style={styles.sheetActions}>
          <Pressable style={styles.discardButton} onPress={onDiscard}>
            <Text style={styles.discardButtonText}>Discard</Text>
          </Pressable>
          <Pressable style={styles.saveButton} onPress={onSave}>
            <Ionicons name="bookmark" size={16} color={Colors.parchment} />
            <Text style={styles.saveButtonText}>Save Recipe</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Recent imports row ─────────────────────────────────────────────────────────
function RecentImportCard({
  item,
  onPress,
}: {
  item: typeof RECENT_IMPORTS[number];
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const sourceIcon: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    'instagram.com': 'logo-instagram',
    'tiktok.com': 'logo-tiktok',
    'youtube.com': 'logo-youtube',
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable
        style={styles.recentCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 14, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 300 }); }}
      >
        <Image
          source={{ uri: item.imageUri }}
          contentFit="cover"
          transition={300}
          style={styles.recentImage}
        />
        <View style={styles.recentBody}>
          <View style={styles.recentSourceRow}>
            <Ionicons
              name={sourceIcon[item.source] ?? 'link-outline'}
              size={11}
              color={Colors.saffron}
            />
            <Text style={styles.recentSource}>{item.source}</Text>
          </View>
          <Text style={styles.recentTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.recentTimePill}>
            <Ionicons name="time-outline" size={10} color={Colors.noir} />
            <Text style={styles.recentTimePillText}>{item.cookTime}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ImportScreen() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<ImportState>('idle');
  const [imported, setImported] = useState<RecipeRow | null>(null);
  const cancelledRef = useRef(false);

  const { mutateAsync } = useImportRecipe();

  const startFetch = async (sourceUrl: string) => {
    const trimmed = sourceUrl.trim();
    if (!trimmed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUrl(trimmed);
    setImported(null);
    cancelledRef.current = false;
    setState('loading');

    try {
      const recipe = await mutateAsync(trimmed);
      if (cancelledRef.current) return;
      setImported(recipe);
      setState('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      if (cancelledRef.current) return;
      setState('idle');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err instanceof FreemiumLimitError) {
        Alert.alert(
          'Free limit reached',
          "You've used all 10 free imports. Upgrade to Pro for unlimited recipes.",
        );
      } else {
        const msg =
          err instanceof ImportError
            ? importMessage(err)
            : 'Something went wrong. Please check your connection and try again.';
        Alert.alert('Import failed', msg);
      }
    }
  };

  const handlePaste = async () => {
    Haptics.selectionAsync();
    try {
      const text = await Clipboard.getString();
      if (text) {
        setUrl(text);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleSocial = (_source?: string) => {
    // Social/photo import isn't wired to the backend — guide the user to the URL box.
    // (YouTube works too: paste the video link above.)
    Haptics.selectionAsync();
    Alert.alert(
      'Paste a link',
      'Paste a recipe URL or YouTube link in the box above to import it.',
    );
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const id = imported?.id;
    setState('idle');
    setUrl('');
    if (id) router.push(`/recipe/${id}` as any);
  };

  const handleDiscard = () => {
    Haptics.selectionAsync();
    setState('idle');
    setUrl('');
    setImported(null);
  };

  const handleView = () => {
    if (imported?.id) router.push(`/recipe/${imported.id}` as any);
  };

  const handleCancel = () => {
    Haptics.selectionAsync();
    cancelledRef.current = true;
    setState('idle');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>Import</Text>
          <Text style={styles.headerTitle}>Add a recipe</Text>
          <Text style={styles.headerSub}>
            Paste a link or import from your favourite social platform.
          </Text>
        </View>

        {/* ── URL input ── */}
        <UrlInputRow
          value={url}
          onChange={setUrl}
          onSubmit={() => startFetch(url)}
          onPaste={handlePaste}
          focused={focused}
          setFocused={setFocused}
        />

        {/* Loading overlay sits below input when active */}
        {state === 'loading' && (
          <LoadingOverlay url={url} onCancel={handleCancel} />
        )}

        {/* ── OR divider ── */}
        {state !== 'loading' && (
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or import from</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        {/* ── Social sources grid ── */}
        {state !== 'loading' && (
          <View style={styles.sourcesGroup}>
            <ImportSourceButton
              label="TikTok"
              sublabel="Paste or share a video link"
              iconName="logo-tiktok"
              iconLib="ionicons"
              iconColor="#69C9D0"
              onPress={() => handleSocial('tiktok.com')}
            />
            <ImportSourceButton
              label="Instagram Reels"
              sublabel="Import from a reel or post"
              iconName="logo-instagram"
              iconLib="ionicons"
              iconColor="#E1306C"
              onPress={() => handleSocial('instagram.com')}
            />
            <ImportSourceButton
              label="YouTube"
              sublabel="Cook-along from any video"
              iconName="logo-youtube"
              iconLib="ionicons"
              iconColor="#FF0000"
              onPress={() => handleSocial('youtube.com')}
            />
            <ImportSourceButton
              label="Scan a Photo"
              sublabel="OCR a cookbook or printout"
              iconName="camera-outline"
              iconLib="ionicons"
              iconColor={Colors.saffron}
              onPress={() => handleSocial('photo.scan')}
            />
          </View>
        )}

        {/* ── Recent imports ── */}
        {state !== 'loading' && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Imports</Text>
              <Pressable hitSlop={6} onPress={() => Haptics.selectionAsync()}>
                <Text style={styles.sectionAction}>See all</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentRow}
            >
              {RECENT_IMPORTS.map((item, i) => (
                <Animated.View
                  key={item.id}
                  entering={FadeInDown.delay(i * 80).duration(280).springify()}
                >
                  <RecentImportCard
                    item={item}
                    onPress={() => router.push(`/recipe/${item.id}` as any)}
                  />
                </Animated.View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* ── Success bottom sheet ── */}
      <SuccessSheet
        visible={state === 'success'}
        recipe={imported ? toPreview(imported) : null}
        onSave={handleSave}
        onDiscard={handleDiscard}
        onView={handleView}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.noir,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 18,
  },

  // Header
  header: {
    paddingTop: 12,
    gap: 4,
  },
  headerEyebrow: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    color: Colors.saffron,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 32,
    color: Colors.parchment,
    lineHeight: 38,
  },
  headerSub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.muted,
    marginTop: 2,
  },

  // URL input row
  urlBlock: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  urlInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  urlInput: {
    flex: 1,
    fontFamily: Fonts.bodyRegular,
    fontSize: 15,
    color: Colors.parchment,
    padding: 0,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.burgundy,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  pasteText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.parchment,
  },
  fetchButton: {
    width: 52,
    backgroundColor: Colors.burgundy,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // OR divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.muted,
  },
  dividerText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Sources
  sourcesGroup: {
    gap: 10,
  },

  // Recent imports
  recentSection: {
    gap: 12,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    color: Colors.parchment,
  },
  sectionAction: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.saffron,
  },
  recentRow: {
    gap: 12,
    paddingRight: 8,
  },
  recentCard: {
    width: 200,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.muted,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  recentImage: {
    width: 72,
    height: '100%',
  },
  recentBody: {
    flex: 1,
    padding: 10,
    gap: 4,
    justifyContent: 'space-between',
  },
  recentSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recentSource: {
    fontFamily: Fonts.monoRegular,
    fontSize: 9,
    color: Colors.saffron,
    letterSpacing: 0.3,
  },
  recentTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 13,
    lineHeight: 17,
    color: Colors.parchment,
  },
  recentTimePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.saffron,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 50,
  },
  recentTimePillText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 9,
    color: Colors.noir,
  },

  // Loading card
  loadingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.burgundy,
    padding: 16,
    gap: 12,
  },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.paprika,
  },
  loadingTitle: {
    flex: 1,
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: Colors.parchment,
  },
  loadingCancel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.muted,
  },
  loadingUrl: {
    fontFamily: Fonts.monoRegular,
    fontSize: 11,
    color: Colors.saffron,
    opacity: 0.85,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.muted,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.saffron,
    borderRadius: 2,
  },
  loadingStage: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: Colors.muted,
    fontStyle: 'italic',
  },

  // Skeleton inside loading card
  shimmerBase: {
    backgroundColor: Colors.muted,
    borderRadius: 6,
  },
  skeletonCard: {
    flexDirection: 'row',
    backgroundColor: Colors.noir,
    borderRadius: 12,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.muted,
  },
  skeletonImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  skeletonBody: {
    flex: 1,
    gap: 7,
    justifyContent: 'center',
  },
  skeletonLine: {
    height: 10,
    borderRadius: 5,
  },
  skeletonMeta: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  skeletonPill: {
    width: 50,
    height: 14,
    borderRadius: 50,
  },

  // Success sheet
  sheetScrim: {
    backgroundColor: 'rgba(26,10,14,0.74)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.muted,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.muted,
    alignSelf: 'center',
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  successCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 20,
    color: Colors.parchment,
  },
  successSub: {
    fontFamily: Fonts.monoRegular,
    fontSize: 11,
    color: Colors.saffron,
    marginTop: 2,
  },

  // Preview card
  previewCard: {
    backgroundColor: Colors.noir,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.muted,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 160,
  },
  previewImageEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  previewBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.saffron,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 50,
  },
  previewBadgeText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 10,
    color: Colors.noir,
  },
  previewBody: {
    padding: 14,
    gap: 6,
  },
  previewTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 18,
    lineHeight: 22,
    color: Colors.parchment,
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewMeta: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.muted,
  },
  previewMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.muted,
  },
  previewTagRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  previewTag: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  previewTagText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Colors.parchment,
    letterSpacing: 0.3,
  },

  // Sheet actions
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  discardButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
  },
  discardButtonText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.muted,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 50,
    backgroundColor: Colors.burgundy,
  },
  saveButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: Colors.parchment,
  },
});
