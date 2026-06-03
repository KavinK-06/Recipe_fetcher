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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

type Mode = 'signin' | 'signup';

// ── Logo wordmark ──────────────────────────────────────────────────────────────
function Logo() {
  return (
    <View style={styles.logoWrap}>
      <View style={styles.logoMark}>
        <Ionicons name="flame" size={22} color={Colors.saffron} />
      </View>
      <Text style={styles.logoText}>Saveur</Text>
    </View>
  );
}

// ── Social auth button ─────────────────────────────────────────────────────────
function SocialButton({
  label,
  iconName,
  onPress,
}: {
  label: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        style={styles.socialButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.();
        }}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 14, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 300 });
        }}
      >
        <Ionicons name={iconName} size={20} color={Colors.parchment} />
        <Text style={styles.socialButtonText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Mode toggle slide animation
  const toggleX = useSharedValue(0);
  const toggleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: toggleX.value }],
  }));

  // Primary button shake for error feedback
  const submitShake = useSharedValue(0);
  const submitShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: submitShake.value }],
  }));

  // Primary button scale
  const submitScale = useSharedValue(1);
  const submitScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: submitScale.value }],
  }));

  const TOGGLE_WIDTH = 140;

  const switchMode = (next: Mode) => {
    Haptics.selectionAsync();
    setMode(next);
    toggleX.value = withSpring(next === 'signin' ? 0 : TOGGLE_WIDTH, {
      damping: 16,
      stiffness: 260,
    });
  };

  const handleSubmit = () => {
    if (!email || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      submitShake.value = withSequence(
        withTiming(-8, { duration: 55 }),
        withTiming(8, { duration: 55 }),
        withTiming(-6, { duration: 55 }),
        withTiming(6, { duration: 55 }),
        withTiming(0, { duration: 55 }),
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to tabs — real auth wired later
    router.replace('/(tabs)');
  };

  const inputBorderColor = (field: string) =>
    focusedField === field ? Colors.burgundy : Colors.muted;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Logo />

          {/* Mode toggle pill */}
          <View style={styles.toggleTrack}>
            {/* Sliding thumb */}
            <Animated.View style={[styles.toggleThumb, toggleAnimStyle]} />
            <Pressable
              style={styles.toggleOption}
              onPress={() => switchMode('signin')}
            >
              <Text
                style={[
                  styles.toggleLabel,
                  mode === 'signin' && styles.toggleLabelActive,
                ]}
              >
                Sign In
              </Text>
            </Pressable>
            <Pressable
              style={styles.toggleOption}
              onPress={() => switchMode('signup')}
            >
              <Text
                style={[
                  styles.toggleLabel,
                  mode === 'signup' && styles.toggleLabelActive,
                ]}
              >
                Sign Up
              </Text>
            </Pressable>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name field — sign up only */}
            {mode === 'signup' && (
              <View
                style={[
                  styles.inputWrap,
                  { borderColor: inputBorderColor('name') },
                ]}
              >
                <Ionicons name="person-outline" size={16} color={Colors.muted} />
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor={Colors.muted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            )}

            {/* Email */}
            <View
              style={[
                styles.inputWrap,
                { borderColor: inputBorderColor('email') },
              ]}
            >
              <Ionicons name="mail-outline" size={16} color={Colors.muted} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={Colors.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Password */}
            <View
              style={[
                styles.inputWrap,
                { borderColor: inputBorderColor('password') },
              ]}
            >
              <Ionicons name="lock-closed-outline" size={16} color={Colors.muted} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password"
                placeholderTextColor={Colors.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowPassword((v) => !v);
                }}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={16}
                  color={Colors.muted}
                />
              </Pressable>
            </View>

            {/* Forgot password — sign in only */}
            {mode === 'signin' && (
              <Pressable
                style={styles.forgotWrap}
                hitSlop={8}
                onPress={() => Haptics.selectionAsync()}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            )}
          </View>

          {/* Primary submit button */}
          <Animated.View style={[submitShakeStyle, submitScaleStyle]}>
            <Pressable
              style={styles.primaryButton}
              onPress={handleSubmit}
              onPressIn={() => {
                submitScale.value = withSpring(0.97, { damping: 14, stiffness: 300 });
              }}
              onPressOut={() => {
                submitScale.value = withSpring(1, { damping: 14, stiffness: 300 });
              }}
            >
              <Text style={styles.primaryButtonText}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social auth */}
          <View style={styles.socialGroup}>
            <SocialButton
              label="Continue with Apple"
              iconName="logo-apple"
            />
            <SocialButton
              label="Continue with Google"
              iconName="logo-google"
            />
          </View>

          {/* Toggle mode link */}
          <View style={styles.switchRow}>
            <Text style={styles.switchPrompt}>
              {mode === 'signin'
                ? "Don't have an account? "
                : 'Already have an account? '}
            </Text>
            <Pressable
              onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              hitSlop={8}
            >
              <Text style={styles.switchLink}>
                {mode === 'signin' ? 'Sign Up' : 'Sign In'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const TOGGLE_OPTION_WIDTH = 140;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.noir,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    gap: 20,
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
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

  // Mode toggle
  toggleTrack: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.muted,
    padding: 3,
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  toggleThumb: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: TOGGLE_OPTION_WIDTH,
    height: 38,
    borderRadius: 50,
    backgroundColor: Colors.burgundy,
  },
  toggleOption: {
    width: TOGGLE_OPTION_WIDTH,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.muted,
  },
  toggleLabelActive: {
    color: Colors.parchment,
  },

  // Form
  form: {
    gap: 12,
  },
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
  forgotWrap: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: Colors.saffron,
  },

  // Primary button
  primaryButton: {
    backgroundColor: Colors.burgundy,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.parchment,
    letterSpacing: 0.3,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.muted,
  },
  dividerText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: Colors.muted,
  },

  // Social
  socialGroup: {
    gap: 10,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingVertical: 14,
  },
  socialButtonText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.parchment,
  },

  // Switch mode
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  switchPrompt: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    color: Colors.muted,
  },
  switchLink: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.saffron,
  },
});
