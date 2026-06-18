import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { useNutritionAnalysis } from '../hooks/useNutritionAnalysis';
import { useEntitlements } from '../hooks/useEntitlements';
import { NutritionError, type NutritionResult } from '../lib/api/nutrition';

const SCAN_COST = 1; // credits per scan — matches _shared/gating.ts (shared pool)

const CONFIDENCE_COLOR: Record<NutritionResult['confidence'], string> = {
  high: Colors.saffron,
  medium: Colors.saffron,
  low: Colors.paprika,
};

// ── Macro stat ──────────────────────────────────────────────────────────────────
function Macro({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroValue}>
        {value != null ? Math.round(value) : '—'}
        <Text style={styles.macroUnit}>{unit}</Text>
      </Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────
function ResultCard({ result }: { result: NutritionResult }) {
  if (!result.dish) {
    return (
      <Animated.View entering={FadeIn.duration(260)} style={styles.resultCard}>
        <View style={styles.notFoodIcon}>
          <Ionicons name="help-outline" size={28} color={Colors.muted} />
        </View>
        <Text style={styles.notFoodTitle}>Couldn’t spot a dish</Text>
        <Text style={styles.notFoodSub}>
          Try a clearer, well-lit photo of the food itself.
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(280).springify()} style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultDish}>{result.dish}</Text>
          {result.servingSize ? (
            <Text style={styles.resultServing}>{result.servingSize}</Text>
          ) : null}
        </View>
        <View style={[styles.confPill, { backgroundColor: CONFIDENCE_COLOR[result.confidence] }]}>
          <Text style={styles.confPillText}>{result.confidence}</Text>
        </View>
      </View>

      {/* Calories hero */}
      <View style={styles.calorieRow}>
        <Text style={styles.calorieValue}>{Math.round(result.calories)}</Text>
        <Text style={styles.calorieUnit}>kcal</Text>
      </View>

      {/* Macro grid */}
      <View style={styles.macroGrid}>
        <Macro label="Protein" value={result.protein_g} unit="g" />
        <View style={styles.macroDivider} />
        <Macro label="Carbs" value={result.carbs_g} unit="g" />
        <View style={styles.macroDivider} />
        <Macro label="Fat" value={result.fat_g} unit="g" />
      </View>
      {(result.fiber_g != null || result.sugar_g != null) && (
        <View style={styles.subMacroRow}>
          {result.fiber_g != null && (
            <Text style={styles.subMacro}>Fiber {Math.round(result.fiber_g)}g</Text>
          )}
          {result.sugar_g != null && (
            <Text style={styles.subMacro}>Sugar {Math.round(result.sugar_g)}g</Text>
          )}
        </View>
      )}

      {/* Items */}
      {result.items.length > 0 && (
        <View style={styles.itemsBlock}>
          <Text style={styles.itemsLabel}>Breakdown</Text>
          {result.items.map((it, i) => (
            <View key={`${it.name}-${i}`} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
              <Text style={styles.itemCals}>{Math.round(it.calories)} kcal</Text>
            </View>
          ))}
        </View>
      )}

      {/* Assumptions */}
      {result.assumptions.length > 0 && (
        <View style={styles.assumptions}>
          <Text style={styles.assumptionsLabel}>Assumptions</Text>
          {result.assumptions.map((a, i) => (
            <Text key={i} style={styles.assumptionText}>• {a}</Text>
          ))}
        </View>
      )}

      <Text style={styles.disclaimer}>Estimates only — not medical or dietary advice.</Text>
    </Animated.View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function NutritionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { youtubeRemaining: credits, showPaywall, refetch: refetchEntitlements } =
    useEntitlements();
  const analysis = useNutritionAnalysis();

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<NutritionResult | null>(null);

  const hasCredits = credits >= SCAN_COST;

  // Resize + compress to a small JPEG data URL (the Edge Function rejects >5 MB).
  const processImage = async (uri: string) => {
    const manip = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 768 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    setPreviewUri(manip.uri);
    setImageDataUrl(`data:image/jpeg;base64,${manip.base64}`);
    setResult(null);
  };

  const pickFromCamera = async () => {
    Haptics.selectionAsync();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Enable camera access in Settings to scan a dish.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: true, aspect: [1, 1] });
    if (!res.canceled && res.assets[0]) await processImage(res.assets[0].uri);
  };

  const pickFromLibrary = async () => {
    Haptics.selectionAsync();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos access needed', 'Enable photo access in Settings to choose a dish photo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 1, allowsEditing: true, aspect: [1, 1] });
    if (!res.canceled && res.assets[0]) await processImage(res.assets[0].uri);
  };

  const reset = () => {
    setImageDataUrl(null);
    setPreviewUri(null);
    setNote('');
    setResult(null);
  };

  const analyze = async () => {
    if (!imageDataUrl) return;
    if (!hasCredits) {
      showPaywall('yt_credits', 'out_of_credits');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const r = await analysis.mutateAsync({ image: imageDataUrl, note: note.trim() || undefined });
      setResult(r);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchEntitlements(); // a credit was just deducted server-side
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err instanceof NutritionError && err.code === 'out_of_credits') {
        showPaywall('yt_credits', 'out_of_credits');
        return;
      }
      const msg =
        err instanceof NutritionError && err.code === 'image_too_large'
          ? 'That photo is too large. Try another.'
          : 'Couldn’t analyse that photo. Please try again.';
      Alert.alert('Scan failed', msg);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.headerButton}
          hitSlop={6}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.parchment} />
        </Pressable>
        <Text style={styles.headerTitle}>Calorie Scanner</Text>
        <View style={styles.creditsPill}>
          <Ionicons name="ticket-outline" size={11} color={Colors.saffron} />
          <Text style={styles.creditsText}>{credits}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!previewUri ? (
          // ── Idle ──
          <Animated.View entering={FadeIn.duration(240)} style={styles.idleWrap}>
            <View style={styles.scanIcon}>
              <Ionicons name="scan-outline" size={44} color={Colors.saffron} />
            </View>
            <Text style={styles.idleTitle}>Scan a dish</Text>
            <Text style={styles.idleSub}>
              Snap a cooked dish and get an instant estimate of its calories and macros.
              Each scan costs 1 credit.
            </Text>

            <View style={styles.idleButtons}>
              <Pressable style={styles.primaryButton} onPress={pickFromCamera}>
                <Ionicons name="camera" size={18} color={Colors.parchment} />
                <Text style={styles.primaryButtonText}>Take Photo</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={pickFromLibrary}>
                <Ionicons name="images-outline" size={18} color={Colors.parchment} />
                <Text style={styles.secondaryButtonText}>Choose from Library</Text>
              </Pressable>
            </View>

            {!hasCredits && (
              <Pressable style={styles.lowCredits} onPress={() => showPaywall('yt_credits', 'out_of_credits')}>
                <Ionicons name="information-circle-outline" size={14} color={Colors.paprika} />
                <Text style={styles.lowCreditsText}>
                  You’re out of credits. Tap to top up.
                </Text>
              </Pressable>
            )}
          </Animated.View>
        ) : (
          // ── Preview / Result ──
          <View style={styles.previewWrap}>
            <View style={styles.previewImageWrap}>
              <Image source={{ uri: previewUri }} contentFit="cover" style={styles.previewImage} />
              {!result && !analysis.isPending && (
                <Pressable style={styles.retake} onPress={reset}>
                  <Ionicons name="refresh" size={15} color={Colors.parchment} />
                  <Text style={styles.retakeText}>Retake</Text>
                </Pressable>
              )}
            </View>

            {result ? (
              <>
                <ResultCard result={result} />
                <Pressable style={styles.primaryButton} onPress={reset}>
                  <Ionicons name="scan-outline" size={18} color={Colors.parchment} />
                  <Text style={styles.primaryButtonText}>Scan Another</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.noteWrap}>
                  <Ionicons name="pencil-outline" size={16} color={Colors.muted} />
                  <TextInput
                    style={styles.noteInput}
                    placeholder="Optional note (e.g. about 2 cups)"
                    placeholderTextColor={Colors.mutedText}
                    value={note}
                    onChangeText={setNote}
                    editable={!analysis.isPending}
                  />
                </View>

                <Pressable
                  style={[styles.primaryButton, analysis.isPending && styles.primaryButtonDisabled]}
                  onPress={analyze}
                  disabled={analysis.isPending}
                >
                  {analysis.isPending ? (
                    <>
                      <ActivityIndicator color={Colors.parchment} size="small" />
                      <Text style={styles.primaryButtonText}>Analysing…</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color={Colors.parchment} />
                      <Text style={styles.primaryButtonText}>
                        {hasCredits ? 'Analyse (1 credit)' : 'Get credits'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.noir,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    color: Colors.parchment,
  },
  creditsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  creditsText: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: Colors.saffron,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // Idle
  idleWrap: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 14,
  },
  scanIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 26,
    color: Colors.parchment,
    marginTop: 6,
  },
  idleSub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.mutedText,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  idleButtons: {
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 16,
  },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.burgundy,
    borderRadius: 50,
    paddingVertical: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: Colors.parchment,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    borderRadius: 50,
    paddingVertical: 16,
  },
  secondaryButtonText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.parchment,
  },
  lowCredits: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  lowCreditsText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.paprika,
  },

  // Preview
  previewWrap: {
    gap: 16,
    paddingTop: 4,
  },
  previewImageWrap: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
  },
  retake: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(26,10,14,0.7)',
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retakeText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.parchment,
  },
  noteWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  noteInput: {
    flex: 1,
    fontFamily: Fonts.bodyRegular,
    fontSize: 15,
    color: Colors.parchment,
    padding: 0,
  },

  // Result card
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.muted,
    padding: 18,
    gap: 14,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  resultDish: {
    fontFamily: Fonts.displayBold,
    fontSize: 20,
    color: Colors.parchment,
    textTransform: 'capitalize',
  },
  resultServing: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: Colors.mutedText,
    marginTop: 2,
  },
  confPill: {
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confPillText: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    color: Colors.noir,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  calorieValue: {
    fontFamily: Fonts.displayBold,
    fontSize: 44,
    color: Colors.saffron,
    lineHeight: 48,
  },
  calorieUnit: {
    fontFamily: Fonts.monoMedium,
    fontSize: 14,
    color: Colors.mutedText,
    marginBottom: 8,
  },
  macroGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.noir,
    borderRadius: 14,
    paddingVertical: 14,
  },
  macro: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  macroDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: Colors.muted,
  },
  macroValue: {
    fontFamily: Fonts.monoBold,
    fontSize: 18,
    color: Colors.parchment,
  },
  macroUnit: {
    fontFamily: Fonts.monoRegular,
    fontSize: 12,
    color: Colors.mutedText,
  },
  macroLabel: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11,
    color: Colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subMacroRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  subMacro: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.mutedText,
  },
  itemsBlock: {
    gap: 8,
  },
  itemsLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  itemName: {
    flex: 1,
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    color: Colors.parchment,
    textTransform: 'capitalize',
  },
  itemCals: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    color: Colors.saffron,
  },
  assumptions: {
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.muted,
    paddingTop: 12,
  },
  assumptionsLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  assumptionText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.mutedText,
  },
  disclaimer: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11,
    color: Colors.mutedText,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Non-food result
  notFoodIcon: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.noir,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoodTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    color: Colors.parchment,
    textAlign: 'center',
  },
  notFoodSub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: Colors.mutedText,
    textAlign: 'center',
  },
});
