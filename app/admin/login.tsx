/**
 * Admin web login — split layout with salon hero image and login form.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, LogIn } from 'lucide-react-native';
import { useAuth } from '@/providers/AuthProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors, SalonImages } from '@/constants/web';
import { APP_NAME, BUSINESS_NAME } from '@/constants/app';

export default function AdminLogin() {
  const router = useRouter();
  const { login, isAuthenticated, isAdmin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Already logged in as admin — go to dashboard
  React.useEffect(() => {
    if (isAuthenticated && isAdmin) {
      router.replace('/admin/dashboard' as any);
    }
  }, [isAuthenticated, isAdmin]);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.success) {
        setError(result.error || 'Login failed');
      } else if (result.pendingApproval) {
        setError('Your account is pending admin approval');
      }
      // Auth provider will trigger the useEffect above on success
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const { width } = Dimensions.get('window');
  const isNarrow = width < 900;

  return (
    <View style={styles.root}>
      {/* Left: Hero image */}
      {!isNarrow && (
        <View style={styles.heroSide}>
          <Image
            source={{ uri: SalonImages.loginHero }}
            style={styles.heroImage as any}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroBrand}>{APP_NAME}</Text>
            <Text style={styles.heroTagline}>{BUSINESS_NAME}</Text>
            <Text style={styles.heroSub}>Admin Dashboard</Text>
          </View>
        </View>
      )}

      {/* Right: Login form */}
      <View style={[styles.formSide, isNarrow && styles.formSideFull]}>
        <View style={styles.formCard}>
          {/* Brand for narrow screens */}
          {isNarrow && (
            <View style={styles.narrowBrand}>
              <Text style={styles.narrowBrandName}>{APP_NAME}</Text>
              <Text style={styles.narrowBrandSub}>Admin Panel</Text>
            </View>
          )}

          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formSubtitle}>Sign in to your admin account</Text>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="admin@muchlove.com"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textTertiary}
                secureTextEntry={!showPassword}
                editable={!loading}
                onSubmitEditing={handleLogin}
              />
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowPassword(p => !p)}
              >
                {showPassword
                  ? <EyeOff size={18} color={Colors.textTertiary} />
                  : <Eye size={18} color={Colors.textTertiary} />
                }
              </Pressable>
            </View>
          </View>

          {/* Submit */}
          <Pressable
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <LogIn size={18} color="#FFFFFF" />
                <Text style={styles.submitText}>Sign In</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.footerNote}>
            Only admin accounts can access this panel
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    // @ts-ignore web
    minHeight: '100vh',
    backgroundColor: Colors.background,
  },
  // Hero (left)
  heroSide: {
    flex: 55,
    position: 'relative',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  } as any,
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: WebColors.loginOverlay,
  },
  heroContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  heroBrand: {
    fontFamily: 'Billabong',
    fontSize: 56,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroTagline: {
    fontSize: WebTypo.h3,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: WebTypo.body,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  // Form (right)
  formSide: {
    flex: 45,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  formSideFull: {
    flex: 1,
  },
  formCard: {
    width: '100%',
    maxWidth: 400,
  },
  narrowBrand: {
    alignItems: 'center',
    marginBottom: 32,
  },
  narrowBrandName: {
    fontFamily: 'Billabong',
    fontSize: 40,
    color: Colors.primary,
  },
  narrowBrandSub: {
    fontSize: WebTypo.tiny,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: -4,
  },
  formTitle: {
    fontSize: WebTypo.h1,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: WebTypo.body,
    color: Colors.textSecondary,
    marginBottom: 28,
  },
  errorBox: {
    backgroundColor: Colors.dangerLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    fontSize: WebTypo.small,
    color: Colors.danger,
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: WebTypo.label,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: WebTypo.body,
    color: Colors.text,
    backgroundColor: Colors.inputBg,
    // @ts-ignore web
    outlineColor: Colors.inputFocus,
  },
  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 46,
  },
  eyeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: 10,
    marginTop: 8,
    // @ts-ignore web transition
    transition: 'background-color 0.2s',
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontSize: WebTypo.button,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footerNote: {
    fontSize: WebTypo.tiny,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 24,
  },
});
