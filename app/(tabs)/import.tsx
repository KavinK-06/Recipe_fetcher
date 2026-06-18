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
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import ImportSourceButton from '../../components/ImportSourceButton';
import RecipeActionsSheet from '../../components/RecipeActionsSheet';
import { useImportRecipe, useImportPhoto } from '../../hooks/useImportRecipe';
import { useRecipes } from '../../hooks/useRecipes';
import { useEntitlements } from '../../hooks/useEntitlements';
import {
  FreemiumLimitError,
  ImportError,
  isYouTubeUrl,
  unsupportedSource,
  type RecipeRow,
} from '../../lib/api/import';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ImportState = 'idle' | 'loading' | 'success';

const FETCH_STAGES = [
  'Reading the page…',
  'Extracting ingredients…',
  'Parsing steps…',
  'Almost done…',
];

const SCAN_STAGES = [
  'Reading the photo…',
  'Recognising the text…',
  'Extracting ingredients…',
  'Structuring the recipe…',
];

const YT_STAGES = [
  'Fetching the video…',
  'Reading the captions…',
  'Finding the ingredients…',
  'Writing out the steps…',
  'Plating it up…',
];

// Short cooking tips that rotate through the loading card — an import takes ~15s,
// so this keeps the wait feeling alive, not stuck.
const TIPS = [
  'Salt your pasta water until it tastes like the sea.',
  'Let meat rest after cooking so the juices stay put.',
  'Toast whole spices before grinding for deeper flavour.',
  'A sharp knife is safer than a dull one.',
  'Pat proteins dry for a proper golden sear.',
  'Taste as you go — season in layers.',
  'Save a splash of pasta water to bring sauces together.',
  'A squeeze of acid wakes up almost any dish.',
  'Mise en place — prep everything before the heat goes on.',
  'Room-temperature eggs whip up fluffier.',
];

// Which kind of import is loading — drives the title, stage copy, how long the
// progress curve expects to run (`tau`), and whether to show the "this is normal,
// it can take a minute" reassurance for the slow (transcript/scrape-backed) sources.
type LoadingKind = 'website' | 'youtube' | 'photo';

const LOADING_CONFIG: Record<
  LoadingKind,
  { title: string; stages: string[]; tau: number; slow: boolean }
> = {
  // tau = the progress curve's time constant: at t=tau the bar is ~63%, at ~2·tau
  // ~86%. Tuned to the real ~15s import so the bar is well-progressed (not stuck at
  // 40%) by the time the import finishes. Bump if typical import times grow.
  website: { title: 'Fetching recipe…', stages: FETCH_STAGES, tau: 7, slow: false },
  youtube: { title: 'Importing from YouTube…', stages: YT_STAGES, tau: 9, slow: true },
  photo: { title: 'Reading photo…', stages: SCAN_STAGES, tau: 12, slow: false },
};

// The link-based import sources. Each opens the same branded "how to import"
// sheet (SourceHintSheet) with copy + an example link + a paste-and-go button.
type SourceKey = 'website' | 'youtube';

const SOURCE_HINTS: Record<
  SourceKey,
  {
    title: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    iconColor: string;
    description: string;
    example: string;
    cost?: string;
  }
> = {
  website: {
    title: 'Paste a website link',
    icon: 'globe-outline',
    iconColor: Colors.saffron,
    description:
      'Copy the link to any recipe page — a food blog, a magazine, anywhere — and we’ll pull the full recipe out for you.',
    example: 'https://example.com/recipes/pasta',
  },
  youtube: {
    title: 'Import from YouTube',
    icon: 'logo-youtube',
    iconColor: '#FF0000',
    description:
      'Copy a video link from YouTube and paste it here. We read the captions to build a cook-along recipe.',
    example: 'https://youtube.com/watch?v=…',
    cost: 'Uses 1 import credit',
  },
};

// A recent import card mapped from a real recipe row.
type RecentItem = {
  id: string;
  title: string;
  imageUri?: string;
  cookTime: string;
  source: string;
};

// A photo-scanned recipe has source_type 'manual' and no URL — label it clearly.
function sourceLabel(r: RecipeRow): string {
  if (r.source_type === 'manual') return 'Scanned photo';
  try {
    if (r.source_url) return new URL(r.source_url).hostname.replace(/^www\./, '');
  } catch {
    // fall through to source_type
  }
  return r.source_type as string;
}

function toRecentItem(r: RecipeRow): RecentItem {
  return {
    id: r.id,
    title: r.title,
    imageUri: r.image_url ?? undefined,
    cookTime: r.cook_time_minutes != null ? `${r.cook_time_minutes} min` : '—',
    source: sourceLabel(r),
  };
}

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
  return {
    id: r.id,
    title: r.title,
    imageUri: r.image_url ?? undefined,
    cookTime: r.cook_time_minutes != null ? `${r.cook_time_minutes} min` : '—',
    servings: r.servings != null ? `${r.servings} servings` : '',
    source: sourceLabel(r),
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
    case 'no_recipe_found':
      return "We couldn't find a recipe to extract from that. The video, link, or photo may not contain a full recipe — try another.";
    case 'invalid_image':
      return "That image couldn't be read. Try another photo.";
    case 'image_too_large':
      return 'That photo is too large. Try another.';
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
          placeholderTextColor={Colors.mutedText}
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
function LoadingOverlay({
  kind,
  label,
  onCancel,
}: {
  kind: LoadingKind;
  label: string;
  onCancel: () => void;
}) {
  const cfg = LOADING_CONFIG[kind];
  const [elapsedSec, setElapsedSec] = useState(0);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const progress = useSharedValue(0);
  const dotScale = useSharedValue(1);
  const startRef = useRef(Date.now());

  // Honest, never-stuck progress: an exponential approach to ~96% keyed to real
  // elapsed time (fast at first, easing off), so a ~15s import keeps creeping
  // forward the whole time instead of freezing. It resolves by unmounting when
  // the import finishes, so it never needs to "reach" 100% (a slow outlier just
  // sits near 96% until done).
  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      progress.value = withTiming(Math.min(0.96, 1 - Math.exp(-elapsed / cfg.tau)), {
        duration: 180,
        easing: Easing.out(Easing.quad),
      });
      setElapsedSec(Math.floor(elapsed));
    }, 180);
    return () => clearInterval(id);
  }, [progress, cfg.tau]);

  // Pulse the status dot.
  useEffect(() => {
    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 500, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 500, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [dotScale]);

  // Rotate cooking tips to keep the wait engaging.
  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 4200);
    return () => clearInterval(id);
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  // Stage follows the same curve as the bar, so it steps forward and rests on the
  // final stage rather than looping the same four lines for two minutes.
  const approxP = 1 - Math.exp(-elapsedSec / cfg.tau);
  const stageIndex = Math.min(cfg.stages.length - 1, Math.floor(approxP * cfg.stages.length));
  const timeLabel = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`;

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.loadingCard}>
      {/* Pulsing status dot */}
      <View style={styles.loadingHeader}>
        <Animated.View style={[styles.loadingDot, dotStyle]} />
        <Text style={styles.loadingTitle}>{cfg.title}</Text>
        <Pressable onPress={onCancel} hitSlop={6}>
          <Text style={styles.loadingCancel}>Cancel</Text>
        </Pressable>
      </View>

      {/* Source preview */}
      <Text style={styles.loadingUrl} numberOfLines={1}>
        {label}
      </Text>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>

      {/* Stage label + elapsed time */}
      <View style={styles.loadingStageRow}>
        <Animated.Text
          key={stageIndex}
          entering={FadeIn.duration(240)}
          style={styles.loadingStage}
        >
          {cfg.stages[stageIndex]}
        </Animated.Text>
        <Text style={styles.loadingTime}>{timeLabel}</Text>
      </View>

      {/* Reassurance for the slow (video) sources */}
      {cfg.slow ? (
        <Text style={styles.loadingReassure}>
          This usually takes around 15 seconds — you can keep this open.
        </Text>
      ) : null}

      {/* Rotating cooking tip — keeps the wait engaging */}
      <View style={styles.tipCard}>
        <Ionicons name="bulb-outline" size={15} color={Colors.saffron} />
        <Animated.Text key={tipIndex} entering={FadeIn.duration(360)} style={styles.tipText}>
          {TIPS[tipIndex]}
        </Animated.Text>
      </View>

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

// Tap-the-handle or swipe-down-to-dismiss for the inline import sheets. Drives the
// sheet's own translateY: a swipe past the threshold (or a quick flick) animates it
// off-screen then fires onDismiss; a short drag springs back.
function buildSheetDismissGesture(translateY: { value: number }, onDismiss: () => void) {
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        translateY.value = withTiming(
          SCREEN_HEIGHT,
          { duration: 220, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(onDismiss)();
          },
        );
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });
  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onDismiss)();
  });
  return Gesture.Race(pan, tap);
}

// ── Success sheet ──────────────────────────────────────────────────────────────
function SuccessSheet({
  visible,
  recipe,
  onClose,
  onView,
  onAddToCollection,
}: {
  visible: boolean;
  recipe: PreviewRecipe | null;
  onClose: () => void;
  onView: () => void;
  onAddToCollection: () => void;
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
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, sheetStyle]}>
        {/* Drag handle — tap or swipe down to dismiss (the recipe is already saved) */}
        <GestureDetector gesture={buildSheetDismissGesture(translateY, onClose)}>
          <View style={styles.sheetHandleZone}>
            <View style={styles.sheetHandle} />
          </View>
        </GestureDetector>

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

        {/* Actions — the recipe is already saved, so these just route the user on */}
        <View style={styles.sheetActions}>
          <Pressable style={styles.collectionButton} onPress={onAddToCollection}>
            <Ionicons name="albums-outline" size={16} color={Colors.parchment} />
            <Text style={styles.collectionButtonText}>Add to Collection</Text>
          </Pressable>
          <Pressable style={styles.viewButton} onPress={onView}>
            <Text style={styles.viewButtonText}>View Recipe</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.parchment} />
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
  item: RecentItem;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const sourceIcon: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    'youtube.com': 'logo-youtube',
    'Scanned photo': 'camera-outline',
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
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            contentFit="cover"
            transition={300}
            style={styles.recentImage}
          />
        ) : (
          <View style={[styles.recentImage, styles.recentImageEmpty]}>
            <Ionicons name="restaurant-outline" size={20} color={Colors.muted} />
          </View>
        )}
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

// ── "How to import" sheet ──────────────────────────────────────────────────────
// A branded bottom sheet that replaces the plain OS alert when a link source
// (website / YouTube) is tapped. Shows what to copy, an example link,
// the credit cost, and a one-tap "paste from clipboard & import" action.
function SourceHintSheet({
  source,
  onClose,
  onPaste,
}: {
  source: SourceKey | null;
  onClose: () => void;
  onPaste: (text: string) => void;
}) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const overlayOpacity = useSharedValue(0);
  const [error, setError] = useState<string | null>(null);
  const visible = source !== null;

  useEffect(() => {
    if (visible) {
      setError(null);
      overlayOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 200, mass: 0.8 });
    } else {
      overlayOpacity.value = withTiming(0, { duration: 160 });
      translateY.value = withTiming(SCREEN_HEIGHT, {
        duration: 220,
        easing: Easing.in(Easing.cubic),
      });
    }
  }, [visible, translateY, overlayOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  if (!source) return null;
  const cfg = SOURCE_HINTS[source];

  const handlePaste = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const text = await Clipboard.getString();
      if (text && text.trim()) {
        onPaste(text.trim());
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setError('Your clipboard is empty — copy the link first, then tap here.');
      }
    } catch {
      setError('Couldn’t read your clipboard. Paste the link in the box at the top instead.');
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.sheetScrim, overlayStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.hintSheet, sheetStyle]}>
        <GestureDetector gesture={buildSheetDismissGesture(translateY, onClose)}>
          <View style={styles.sheetHandleZone}>
            <View style={styles.sheetHandle} />
          </View>
        </GestureDetector>

        <View style={[styles.hintIconCircle, { backgroundColor: `${cfg.iconColor}22` }]}>
          <Ionicons name={cfg.icon} size={26} color={cfg.iconColor} />
        </View>

        <Text style={styles.hintTitle}>{cfg.title}</Text>
        <Text style={styles.hintBody}>{cfg.description}</Text>

        <View style={styles.hintExampleRow}>
          <Ionicons name="link-outline" size={14} color={Colors.saffron} />
          <Text style={styles.hintExample} numberOfLines={1}>
            {cfg.example}
          </Text>
        </View>

        {cfg.cost ? (
          <View style={styles.hintCostRow}>
            <Ionicons name="pricetag-outline" size={13} color={Colors.mutedText} />
            <Text style={styles.hintCost}>{cfg.cost}</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.hintError}>{error}</Text> : null}

        <Pressable style={styles.hintPasteButton} onPress={handlePaste}>
          <Ionicons name="clipboard-outline" size={16} color={Colors.parchment} />
          <Text style={styles.hintPasteText}>Paste link & import</Text>
        </Pressable>
        <Pressable style={styles.hintDismiss} onPress={onClose} hitSlop={6}>
          <Text style={styles.hintDismissText}>I’ll paste it myself</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ── Free-plan recipe-limit banner ───────────────────────────────────────────────
// Shows in the last stretch before the cap and once it's hit. At the cap it's a
// tappable lock → the recipe_limit paywall; just below it, a soft heads-up. Only
// free users see it (lifetime = unlimited saves). The URL/photo gate is the cap;
// this makes "why was I blocked" visible *before* the import, not after.
function RecipeLimitBanner({
  count,
  limit,
  onUpgrade,
}: {
  count: number;
  limit: number;
  onUpgrade: () => void;
}) {
  const atLimit = count >= limit;
  const remaining = Math.max(0, limit - count);
  const countLabel = count > limit ? `${count} saved` : `${count}/${limit}`;

  return (
    <Pressable
      style={[styles.limitBanner, atLimit && styles.limitBannerFull]}
      onPress={atLimit ? onUpgrade : undefined}
      disabled={!atLimit}
    >
      <View style={[styles.limitIcon, atLimit && styles.limitIconFull]}>
        <Ionicons
          name={atLimit ? 'lock-closed' : 'bookmark-outline'}
          size={16}
          color={atLimit ? Colors.paprika : Colors.saffron}
        />
      </View>
      <View style={styles.limitTextWrap}>
        <Text style={styles.limitTitle}>
          {atLimit ? `Free plan full · ${countLabel}` : `Free plan · ${countLabel} saved`}
        </Text>
        <Text style={styles.limitSub}>
          {atLimit
            ? 'Upgrade for unlimited saves, or delete a recipe to import more.'
            : `${remaining} more before you reach the free limit.`}
        </Text>
      </View>
      {atLimit && <Ionicons name="chevron-forward" size={18} color={Colors.mutedText} />}
    </Pressable>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ImportScreen() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<ImportState>('idle');
  const [loadingKind, setLoadingKind] = useState<LoadingKind>('website');
  const [sourceSheet, setSourceSheet] = useState<SourceKey | null>(null);
  const [imported, setImported] = useState<RecipeRow | null>(null);
  const [collectionPicker, setCollectionPicker] = useState(false);
  const cancelledRef = useRef(false);

  const { mutateAsync } = useImportRecipe();
  const { mutateAsync: scanPhoto } = useImportPhoto();
  const { recipes } = useRecipes();
  const {
    youtubeRemaining,
    isLoading: entLoading,
    showPaywall,
    isLifetime,
    recipeCount,
    recipeLimit,
  } = useEntitlements();
  // YouTube imports draw from the monthly "import credits" pool — 1 credit each
  // (transcriptapi.com). The badge shows the remaining balance; the sublabel makes
  // the price explicit.
  const outOfVideo = !entLoading && youtubeRemaining === 0;
  const creditLabel = (n: number) => `${n} credit${n === 1 ? '' : 's'}`;
  const recentImports = recipes.slice(0, 3).map(toRecentItem);

  const startFetch = async (sourceUrl: string) => {
    const trimmed = sourceUrl.trim();
    if (!trimmed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    // Instagram / TikTok aren't supported — tell the user plainly instead of letting
    // the link fall through to the web scraper (which would just fail confusingly).
    const blocked = unsupportedSource(trimmed);
    if (blocked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        `${blocked} isn't supported`,
        `Rasoi can't import from ${blocked}. Try a YouTube video, a recipe website link, or scan a photo instead.`,
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUrl(trimmed);
    setImported(null);
    cancelledRef.current = false;
    setLoadingKind(isYouTubeUrl(trimmed) ? 'youtube' : 'website');
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
        showLimitPaywall(err);
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

  // Website / blog imports are free + unlimited, so they always open the hint
  // sheet (no credit gate). YouTube goes through handleVideoSource.
  const handleWebsiteSource = () => {
    setSourceSheet('website');
  };

  // Paste-and-go from the hint sheet: close it, then run the normal import — the
  // URL router (importRecipe) sends YouTube / web links down the right path, so a
  // pasted link from any sheet still imports correctly.
  const handleSourcePaste = (text: string) => {
    setSourceSheet(null);
    startFetch(text);
  };

  // ── Photo scan (OCR a cookbook page / printout / handwritten recipe) ──────────
  const runPhotoImport = async (dataUrl: string) => {
    setImported(null);
    cancelledRef.current = false;
    setLoadingKind('photo');
    setState('loading');
    try {
      const recipe = await scanPhoto(dataUrl);
      if (cancelledRef.current) return;
      setImported(recipe);
      setState('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      if (cancelledRef.current) return;
      setState('idle');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err instanceof FreemiumLimitError) {
        showLimitPaywall(err);
      } else {
        const msg =
          err instanceof ImportError
            ? importMessage(err)
            : 'Something went wrong. Please check your connection and try again.';
        Alert.alert('Scan failed', msg);
      }
    }
  };

  // Resize + compress to a small JPEG data URL. A wider 1280px keeps printed
  // text legible for OCR while staying well under the Edge Function's size cap.
  const processAndImport = async (uri: string) => {
    try {
      const manip = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      await runPhotoImport(`data:image/jpeg;base64,${manip.base64}`);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Couldn’t read that photo', 'Please try a different image.');
    }
  };

  const scanFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Enable camera access in Settings to scan a recipe.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!res.canceled && res.assets[0]) await processAndImport(res.assets[0].uri);
  };

  const scanFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos access needed', 'Enable photo access in Settings to choose a recipe photo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!res.canceled && res.assets[0]) await processAndImport(res.assets[0].uri);
  };

  const handleScanPhoto = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Scan a recipe', 'Take a photo of a recipe or choose one from your library.', [
      { text: 'Take Photo', onPress: scanFromCamera },
      { text: 'Choose from Library', onPress: scanFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // A 402 means a usage cap was hit — open the paywall matched to which one:
  // the shared credit pool (imports/scans) → the credit top-up; the saved-recipe
  // cap → the lifetime upgrade (which makes saved recipes unlimited).
  const showLimitPaywall = (err: FreemiumLimitError) => {
    if (err.reason === 'out_of_credits') {
      showPaywall('yt_credits', 'out_of_credits');
    } else {
      showPaywall('lifetime', 'recipe_limit');
    }
  };

  const handleVideoSource = () => {
    // YouTube imports draw from the monthly import-credit pool. When it (plus any
    // bonus credits) is spent, send the user straight to the top-up rather than
    // the paste hint — the only buy path for lifetime users (their plan hides the
    // upgrade card). Otherwise open the branded "how to import" sheet.
    if (outOfVideo) {
      Haptics.selectionAsync();
      showPaywall('yt_credits', 'out_of_credits');
      return;
    }
    setSourceSheet('youtube');
  };

  // The import already persisted the recipe, so the success actions only route
  // the user — none of them save or delete.
  const handleViewRecipe = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const id = imported?.id;
    setState('idle');
    setUrl('');
    setImported(null);
    if (id) router.push(`/recipe/${id}` as any);
  };

  const handleAddToCollection = () => {
    Haptics.selectionAsync();
    // Swap the success sheet for the collection picker (keep `imported` so the
    // picker knows which recipe to file).
    setState('idle');
    setUrl('');
    setCollectionPicker(true);
  };

  // Dismissing the success sheet (handle / swipe / scrim tap) — the recipe stays
  // saved; we just clear the import screen.
  const handleCloseSuccess = () => {
    Haptics.selectionAsync();
    setState('idle');
    setUrl('');
    setImported(null);
  };

  const handleCollectionPickerClose = () => {
    setCollectionPicker(false);
    setImported(null);
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
            Paste a link, scan a photo, or import from YouTube.
          </Text>
        </View>

        {/* ── Free-plan saved-recipe meter (heads-up before importing) ── */}
        {!isLifetime && !entLoading && recipeCount >= recipeLimit - 2 && (
          <RecipeLimitBanner
            count={recipeCount}
            limit={recipeLimit}
            onUpgrade={() => {
              Haptics.selectionAsync();
              showPaywall('lifetime', 'recipe_limit');
            }}
          />
        )}

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
          <LoadingOverlay
            kind={loadingKind}
            label={loadingKind === 'photo' ? 'Scanning your recipe photo' : url}
            onCancel={handleCancel}
          />
        )}

        {/* ── OR divider ── */}
        {state !== 'loading' && (
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>import from</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        {/* ── Import sources ── */}
        {state !== 'loading' && (
          <View style={styles.sourcesGroup}>
            <ImportSourceButton
              label="Scan a Photo"
              sublabel="OCR a cookbook page, card or printout"
              iconName="camera-outline"
              iconLib="ionicons"
              iconColor={Colors.saffron}
              onPress={handleScanPhoto}
            />
            <ImportSourceButton
              label="Website or Blog"
              sublabel="Paste a link to any recipe page"
              iconName="globe-outline"
              iconLib="ionicons"
              iconColor={Colors.saffron}
              badge="Free"
              onPress={handleWebsiteSource}
            />
            <ImportSourceButton
              label="YouTube"
              sublabel={outOfVideo ? 'Out of credits — tap to get more' : 'Cook-along from any video · 1 credit'}
              iconName="logo-youtube"
              iconLib="ionicons"
              iconColor="#FF0000"
              badge={entLoading ? undefined : creditLabel(youtubeRemaining)}
              badgeMuted={outOfVideo}
              onPress={handleVideoSource}
            />
          </View>
        )}

        {/* ── Recent imports ── */}
        {state !== 'loading' && recentImports.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Imports</Text>
              <Pressable
                hitSlop={6}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/(tabs)' as any);
                }}
              >
                <Text style={styles.sectionAction}>See all</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentRow}
            >
              {recentImports.map((item, i) => (
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

      {/* ── "How to import" hint sheet (website / YouTube) ── */}
      <SourceHintSheet
        source={sourceSheet}
        onClose={() => setSourceSheet(null)}
        onPaste={handleSourcePaste}
      />

      {/* ── Success bottom sheet ── */}
      <SuccessSheet
        visible={state === 'success'}
        recipe={imported ? toPreview(imported) : null}
        onClose={handleCloseSuccess}
        onView={handleViewRecipe}
        onAddToCollection={handleAddToCollection}
      />

      {/* ── Collection picker (opened from the success sheet) ── */}
      <RecipeActionsSheet
        visible={collectionPicker}
        recipe={imported ? { id: imported.id, title: imported.title } : null}
        collectionsOnly
        onClose={handleCollectionPickerClose}
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
    color: Colors.mutedText,
    marginTop: 2,
  },

  // Free-plan recipe-limit banner
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  limitBannerFull: {
    borderColor: Colors.paprika,
  },
  limitIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.noir,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitIconFull: {
    borderColor: Colors.paprika,
  },
  limitTextWrap: {
    flex: 1,
    gap: 2,
  },
  limitTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.parchment,
  },
  limitSub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.mutedText,
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
    color: Colors.mutedText,
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
  recentImageEmpty: {
    backgroundColor: Colors.noir,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: Colors.mutedText,
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
  loadingStageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingStage: {
    flex: 1,
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: Colors.mutedText,
    fontStyle: 'italic',
  },
  loadingTime: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    color: Colors.saffron,
    letterSpacing: 0.4,
  },
  loadingReassure: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.mutedText,
    marginTop: -4,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: Colors.noir,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  tipText: {
    flex: 1,
    fontFamily: Fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.parchment,
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
  sheetHandleZone: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 8,
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
    color: Colors.mutedText,
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
  collectionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.muted,
  },
  collectionButtonText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.parchment,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 50,
    backgroundColor: Colors.burgundy,
  },
  viewButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: Colors.parchment,
  },

  // "How to import" hint sheet
  hintSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.muted,
    alignItems: 'center',
  },
  hintIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  hintTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 21,
    color: Colors.parchment,
    textAlign: 'center',
  },
  hintBody: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.mutedText,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  hintExampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    backgroundColor: Colors.noir,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 2,
  },
  hintExample: {
    flex: 1,
    fontFamily: Fonts.monoRegular,
    fontSize: 12,
    color: Colors.saffron,
  },
  hintCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hintCost: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    color: Colors.mutedText,
    letterSpacing: 0.2,
  },
  hintError: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.paprika,
    textAlign: 'center',
  },
  hintPasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    paddingVertical: 15,
    borderRadius: 50,
    backgroundColor: Colors.burgundy,
    marginTop: 4,
  },
  hintPasteText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: Colors.parchment,
  },
  hintDismiss: {
    paddingVertical: 4,
  },
  hintDismissText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.mutedText,
  },
});
