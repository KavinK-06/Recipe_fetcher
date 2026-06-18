import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSignUp, isClerkAPIResponseError } from '@clerk/clerk-expo';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>(Array(CODE_LENGTH).fill(null));

  const submitScale = useSharedValue(1);
  const submitShake = useSharedValue(0);
  const submitScaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: submitScale.value }] }));
  const submitShakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: submitShake.value }] }));

  const shakeError = (msg: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setError(msg);
    submitShake.value = withSequence(
      withTiming(-8, { duration: 55 }),
      withTiming(8, { duration: 55 }),
      withTiming(-6, { duration: 55 }),
      withTiming(6, { duration: 55 }),
      withTiming(0, { duration: 55 }),
    );
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    // Handle paste: distribute digits across boxes
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
      const next = [...digits];
      for (let i = 0; i < pasted.length; i++) {
        next[i] = pasted[i];
      }
      setDigits(next);
      const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
      inputRefs.current[focusIndex]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError(null);

    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;
    const code = digits.join('');
    if (code.length < CODE_LENGTH) {
      shakeError('Please enter the full 6-digit code.');
      return;
    }
    setError(null);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await signUp!.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      if (isClerkAPIResponseError(err)) {
        shakeError(err.errors[0]?.longMessage ?? err.errors[0]?.message ?? 'Invalid code.');
      } else {
        shakeError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!isLoaded || !signUp) return;
    Haptics.selectionAsync();
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setError(null);
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch {
      setError('Could not resend code. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo mark */}
          <View style={styles.logoWrap}>
            <View style={styles.logoMark}>
              <Ionicons name="flame" size={22} color={Colors.saffron} />
            </View>
            <Text style={styles.logoText}>Rasoi</Text>
          </View>

          <View style={styles.headingWrap}>
            <Text style={styles.heading}>Check your email</Text>
            <Text style={styles.subheading}>
              We sent a 6-digit verification code to your email address.
            </Text>
          </View>

          {/* OTP boxes */}
          <View style={styles.otpRow}>
            {digits.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => { inputRefs.current[i] = ref; }}
                style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                value={digit}
                onChangeText={(v) => handleChange(i, v)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
                caretHidden
                textAlign="center"
              />
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Animated.View style={[submitShakeStyle, submitScaleStyle]}>
            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleVerify}
              disabled={loading}
              onPressIn={() => { submitScale.value = withSpring(0.97, { damping: 14, stiffness: 300 }); }}
              onPressOut={() => { submitScale.value = withSpring(1, { damping: 14, stiffness: 300 }); }}
            >
              {loading
                ? <ActivityIndicator color={Colors.parchment} />
                : <Text style={styles.primaryButtonText}>Verify Email</Text>}
            </Pressable>
          </Animated.View>

          <View style={styles.resendRow}>
            <Text style={styles.resendPrompt}>Didn't receive it? </Text>
            <Pressable hitSlop={8} onPress={handleResend}>
              <Text style={styles.resendLink}>Resend code</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.noir },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 24,
    gap: 24,
  },
  logoWrap: { alignItems: 'center', gap: 10, marginBottom: 8 },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: Fonts.displayBold,
    fontSize: 32,
    color: Colors.parchment,
    letterSpacing: 1,
  },
  headingWrap: { alignItems: 'center', gap: 8 },
  heading: {
    fontFamily: Fonts.displayBold,
    fontSize: 26,
    color: Colors.parchment,
  },
  subheading: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    color: Colors.mutedText,
    textAlign: 'center',
    lineHeight: 20,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  otpBox: {
    width: 46,
    height: 58,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    fontFamily: Fonts.monoBold,
    fontSize: 22,
    color: Colors.parchment,
  },
  otpBoxFilled: {
    borderColor: Colors.burgundy,
  },
  errorText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: Colors.paprika,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.burgundy,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.parchment,
    letterSpacing: 0.3,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendPrompt: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    color: Colors.mutedText,
  },
  resendLink: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.saffron,
  },
});
