import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  ScrollView,
  Keyboard,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Scissors, Lock, Mail, User, Eye, EyeOff, Sparkles, UserPlus } from 'lucide-react-native';
import { APP_NAME } from '@/constants/app';
import { useAuth } from '@/providers/AuthProvider';

const { width } = Dimensions.get('window');

// Elegant salon palette
const Salon = {
  rose: '#E91E63',
  roseDeep: '#AD1457',
  roseDark: '#880E4F',
  roseSoft: '#F48FB1',
  roseLight: '#FCE4EC',
  rosePale: '#FFF0F5',
  gold: '#D4AF37',
  goldLight: '#F5E6CC',
  white: '#FFFFFF',
  text: '#1A1A2E',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',
  inputBg: '#FFF5F8',
  inputBorder: '#F3D5DE',
  shadow: '#880E4F',
};

export default function LoginScreen() {
  const { login, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const sparkle1 = useRef(new Animated.Value(0)).current;
  const sparkle2 = useRef(new Animated.Value(0)).current;
  const nameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideUpAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    // Sparkle animations
    const sparkleLoop = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    };
    sparkleLoop(sparkle1, 0);
    sparkleLoop(sparkle2, 750);
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setError('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      shake();
      return;
    }
    if (isSignUp && !name.trim()) {
      setError('Please enter your name');
      shake();
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const result = await signUp(email, password, name);
      if (!result.success) {
        setError(result.error || 'Sign up failed');
        shake();
      } else if (result.needsVerification) {
        setSuccessMsg('Account created! Check your email to verify, then sign in.');
        setIsSignUp(false);
        setPassword('');
      }
    } else {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Login failed');
        shake();
      }
    }

    setLoading(false);
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setSuccessMsg('');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Salon.roseDark} />
      <LinearGradient
        colors={[Salon.rose, Salon.roseDeep, Salon.roseDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero Section ── */}
          <Animated.View
            style={[
              styles.heroSection,
              {
                opacity: fadeAnim,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            {/* Decorative sparkles */}
            <Animated.View style={[styles.sparkleTopLeft, { opacity: sparkle1 }]}>
              <Sparkles size={16} color={Salon.gold} />
            </Animated.View>
            <Animated.View style={[styles.sparkleTopRight, { opacity: sparkle2 }]}>
              <Sparkles size={12} color={Salon.goldLight} />
            </Animated.View>

            {/* Logo circle */}
            <View style={styles.logoOuter}>
              <LinearGradient
                colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.08)']}
                style={styles.logoGradient}
              >
                <View style={styles.logoInner}>
                  <Scissors size={36} color={Salon.white} strokeWidth={1.8} />
                </View>
              </LinearGradient>
            </View>

            {/* Brand name */}
            <Text style={styles.brandName}>{APP_NAME}</Text>
            <Text style={styles.brandTagline}>B E A U T Y   S A L O N</Text>

            {/* Decorative line */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <View style={styles.dividerDot} />
              <View style={styles.dividerLine} />
            </View>
          </Animated.View>

          {/* ── Form Card ── */}
          <Animated.View
            style={[
              styles.formCard,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideUpAnim },
                  { translateX: shakeAnim },
                ],
              },
            ]}
          >
            <Text style={styles.welcomeText}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
            <Text style={styles.signInText}>{isSignUp ? 'Sign up with your email' : 'Sign in to your account'}</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {successMsg ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputContainer}>
                <Mail
                  size={18}
                  color={Salon.roseSoft}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={Salon.textLight}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => isSignUp ? nameRef.current?.focus() : passwordRef.current?.focus()}
                  testID="login-email"
                />
              </View>
            </View>

            {/* Name (sign-up only) */}
            {isSignUp && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputContainer}>
                  <User
                    size={18}
                    color={Salon.roseSoft}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={nameRef}
                    style={styles.input}
                    placeholder="Enter your full name"
                    placeholderTextColor={Salon.textLight}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    testID="signup-name"
                  />
                </View>
              </View>
            )}

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputContainer}>
                <Lock
                  size={18}
                  color={Salon.roseSoft}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={Salon.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  testID="login-password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={Salon.textLight} />
                  ) : (
                    <Eye size={18} color={Salon.textLight} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In / Sign Up Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
              testID="login-button"
              style={styles.loginBtnWrapper}
            >
              <LinearGradient
                colors={[Salon.rose, Salon.roseDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color={Salon.white} size="small" />
                ) : (
                  <Text style={styles.loginBtnText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Toggle Sign In / Sign Up */}
            <TouchableOpacity
              onPress={toggleMode}
              style={styles.toggleBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.toggleTextBold}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  /* ── Hero ── */
  heroSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 32,
  },
  sparkleTopLeft: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 75 : 55,
    left: width * 0.15,
  },
  sparkleTopRight: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 85 : 65,
    right: width * 0.18,
  },
  logoOuter: {
    marginBottom: 20,
  },
  logoGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandName: {
    fontSize: 32,
    fontWeight: '700',
    color: Salon.white,
    letterSpacing: 2,
  },
  brandTagline: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
    letterSpacing: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 8,
  },
  dividerLine: {
    width: 32,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dividerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Salon.gold,
  },

  /* ── Form Card ── */
  formCard: {
    flex: 1,
    backgroundColor: Salon.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    shadowColor: Salon.shadow,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: Salon.text,
  },
  signInText: {
    fontSize: 14,
    color: Salon.textMuted,
    marginTop: 4,
    marginBottom: 28,
  },

  /* Error */
  errorBox: {
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
  successBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
  },
  successText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '500',
  },

  /* Inputs */
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Salon.text,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Salon.inputBg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Salon.inputBorder,
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Salon.text,
  },
  eyeBtn: {
    padding: 4,
  },

  /* Button */
  loginBtnWrapper: {
    marginTop: 8,
    borderRadius: 14,
    shadowColor: Salon.rose,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  loginBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: Salon.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  toggleBtn: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 14,
    color: Salon.textMuted,
  },
  toggleTextBold: {
    color: Salon.rose,
    fontWeight: '700',
  },
});