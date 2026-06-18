import React, { useState } from 'react';
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
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSignIn, isClerkAPIResponseError } from '@clerk/clerk-expo';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

function Logo() {
  return (
    <View style={styles.logoWrap}>
      <View style={styles.logoMark}>
        <Ionicons name="flame" size={22} color={Colors.saffron} />
      </View>
      <Text style={styles.logoText}>Rasoi</Text>
    </View>
  );
}

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // When the account has 2FA enabled, Clerk verifies the password then asks for a
  // second factor (an emailed code). We flip to a code-entry step instead of the
  // email/password fields.
  const [twoFactor, setTwoFactor] = useState(false);
  const [code, setCode] = useState('');

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

  const handleSignIn = async () => {
    if (!isLoaded) return;
    if (!email || !password) {
      shakeError('Please enter your email and password.');
      return;
    }
    setError(null);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
        return;
      }
      // Password OK but the account has 2FA → send the email code and switch to
      // the code-entry step. (With 2FA off, create() returns 'complete' above and
      // this is skipped, so the branch is harmless when 2FA isn't in play.)
      if (result.status === 'needs_second_factor') {
        const emailFactor = result.supportedSecondFactors?.find(
          (f) => f.strategy === 'email_code',
        );
        if (!emailFactor) {
          shakeError('This account uses a second factor this app cannot verify yet.');
          return;
        }
        await signIn.prepareSecondFactor({
          strategy: 'email_code',
          emailAddressId: (emailFactor as { emailAddressId: string }).emailAddressId,
        } as never);
        setCode('');
        setTwoFactor(true);
        return;
      }
      // Anything else (e.g. needs_first_factor, has no password) — surface it
      // rather than silently doing nothing (which reads as "the button is dead").
      console.warn('[sign-in] non-complete status:', result.status, JSON.stringify(result));
      shakeError(
        `Couldn't finish signing in (status: ${result.status}). This account may use a different sign-in method.`,
      );
    } catch (err: unknown) {
      if (isClerkAPIResponseError(err)) {
        shakeError(err.errors[0]?.longMessage ?? err.errors[0]?.message ?? 'Sign in failed.');
      } else {
        shakeError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2 (only when 2FA is enabled): verify the emailed code.
  const handleVerifyTwoFactor = async () => {
    if (!isLoaded) return;
    if (code.trim().length < 6) {
      shakeError('Enter the 6-digit code we emailed you.');
      return;
    }
    setError(null);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: code.trim(),
      } as never);
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else {
        shakeError(`Couldn't verify the code (status: ${result.status}).`);
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

  const handleResendTwoFactor = async () => {
    if (!isLoaded) return;
    Haptics.selectionAsync();
    try {
      const emailFactor = signIn.supportedSecondFactors?.find(
        (f) => f.strategy === 'email_code',
      );
      await signIn.prepareSecondFactor({
        strategy: 'email_code',
        emailAddressId: (emailFactor as { emailAddressId?: string } | undefined)?.emailAddressId,
      } as never);
      setError(null);
      setCode('');
    } catch {
      setError('Could not resend the code. Please try again.');
    }
  };

  const borderColor = (field: string) =>
    focusedField === field ? Colors.burgundy : Colors.muted;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Logo />

          <View style={styles.headingWrap}>
            <Text style={styles.heading}>{twoFactor ? 'Two-step verification' : 'Welcome back'}</Text>
            <Text style={styles.subheading}>
              {twoFactor
                ? `Enter the 6-digit code we emailed to ${email}.`
                : 'Sign in to your Rasoi account'}
            </Text>
          </View>

          {twoFactor ? (
            <View style={styles.form}>
              <View style={[styles.inputWrap, { borderColor: borderColor('code') }]}>
                <Ionicons name="keypad-outline" size={16} color={Colors.muted} />
                <TextInput
                  style={[styles.input, { letterSpacing: 6, fontFamily: Fonts.monoBold }]}
                  placeholder="000000"
                  placeholderTextColor={Colors.mutedText}
                  value={code}
                  onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyTwoFactor}
                  onFocus={() => setFocusedField('code')}
                  onBlur={() => setFocusedField(null)}
                  autoFocus
                />
              </View>

              <Pressable style={styles.forgotWrap} hitSlop={8} onPress={handleResendTwoFactor}>
                <Text style={styles.forgotText}>Resend code</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={[styles.inputWrap, { borderColor: borderColor('email') }]}>
                <Ionicons name="mail-outline" size={16} color={Colors.muted} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={Colors.mutedText}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(null); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={[styles.inputWrap, { borderColor: borderColor('password') }]}>
                <Ionicons name="lock-closed-outline" size={16} color={Colors.muted} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Password"
                  placeholderTextColor={Colors.mutedText}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(null); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <Pressable onPress={() => { Haptics.selectionAsync(); setShowPassword((v) => !v); }} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={16}
                    color={Colors.muted}
                  />
                </Pressable>
              </View>

              <Pressable style={styles.forgotWrap} hitSlop={8} onPress={() => Haptics.selectionAsync()}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Animated.View style={[submitShakeStyle, submitScaleStyle]}>
            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={twoFactor ? handleVerifyTwoFactor : handleSignIn}
              disabled={loading}
              onPressIn={() => { submitScale.value = withSpring(0.97, { damping: 14, stiffness: 300 }); }}
              onPressOut={() => { submitScale.value = withSpring(1, { damping: 14, stiffness: 300 }); }}
            >
              {loading
                ? <ActivityIndicator color={Colors.parchment} />
                : <Text style={styles.primaryButtonText}>{twoFactor ? 'Verify Code' : 'Sign In'}</Text>}
            </Pressable>
          </Animated.View>

          {twoFactor ? (
            <View style={styles.switchRow}>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTwoFactor(false);
                  setCode('');
                  setError(null);
                }}
              >
                <Text style={styles.switchLink}>Use a different account</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.switchRow}>
              <Text style={styles.switchPrompt}>Don't have an account? </Text>
              <Link href="/(auth)/sign-up" asChild>
                <Pressable hitSlop={8} onPress={() => Haptics.selectionAsync()}>
                  <Text style={styles.switchLink}>Sign Up</Text>
                </Pressable>
              </Link>
            </View>
          )}
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
    gap: 20,
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
  headingWrap: { alignItems: 'center', gap: 4 },
  heading: {
    fontFamily: Fonts.displayBold,
    fontSize: 26,
    color: Colors.parchment,
  },
  subheading: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    color: Colors.mutedText,
  },
  form: { gap: 12 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.bodyRegular,
    fontSize: 15,
    color: Colors.parchment,
    padding: 0,
  },
  forgotWrap: { alignSelf: 'flex-end' },
  forgotText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: Colors.saffron,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchPrompt: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    color: Colors.mutedText,
  },
  switchLink: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.saffron,
  },
});
