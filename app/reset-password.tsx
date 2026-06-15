import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Supabase fires PASSWORD_RECOVERY when the deep link is opened with
  // a recovery token. We just need to let the session establish itself —
  // updateUser() will use the active session automatically.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // session is now active — ready to accept a new password
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    setError('');
    if (!password.trim()) {
      setError('Please enter a new password');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    await supabase.auth.signOut();
    setTimeout(() => router.replace('/login'), 2000);
  };

  if (done) {
    return (
      <View style={styles.center}>
        <CheckCircle size={56} color={Colors.success} />
        <Text style={styles.doneTitle}>Password updated!</Text>
        <Text style={styles.doneMsg}>Redirecting you to sign in…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set new password</Text>
        <Text style={styles.subtitle}>Choose a strong password for your account.</Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.inputRow}>
          <Lock size={18} color={Colors.textTertiary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="New password"
            placeholderTextColor={Colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
            {showPassword
              ? <EyeOff size={18} color={Colors.textTertiary} />
              : <Eye size={18} color={Colors.textTertiary} />}
          </TouchableOpacity>
        </View>

        <View style={styles.inputRow}>
          <Lock size={18} color={Colors.textTertiary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor={Colors.textTertiary}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showConfirm}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
            {showConfirm
              ? <EyeOff size={18} color={Colors.textTertiary} />
              : <Eye size={18} color={Colors.textTertiary} />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleReset}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Update password</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/login')} style={styles.backBtn}>
          <Text style={styles.backText}>Back to sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.screen,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.screen,
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  error: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    backgroundColor: Colors.dangerLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  eyeBtn: { padding: 4 },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontSize: FontSize.body,
    fontWeight: '700',
  },
  backBtn: { alignItems: 'center', marginTop: Spacing.sm },
  backText: { color: Colors.primary, fontSize: FontSize.body, fontWeight: '600' },
  doneTitle: { fontSize: FontSize.heading, fontWeight: '700', color: Colors.text },
  doneMsg: { fontSize: FontSize.body, color: Colors.textSecondary },
});
