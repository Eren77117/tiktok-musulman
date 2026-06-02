import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation';
import { useAuthStore } from '../../stores/authStore';
import { COLORS, SPACING } from '../../constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const TEST_ACCOUNTS = [
  { label: 'Test Male', email: 'test.homme@tm.local', password: 'Test1234!', gender: 'MALE' as const },
  { label: 'Test Female', email: 'test.femme@tm.local', password: 'Test1234!', gender: 'FEMALE' as const },
];

export default function LoginScreen({ navigation }: Props) {
  const { login, register } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { error?: string } }; message?: string };
      const msg = axErr?.response?.data?.error
        ?? (axErr?.message?.includes('Network') ? 'Cannot reach server. Check your WiFi connection.' : 'Login failed');
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (acc: typeof TEST_ACCOUNTS[0]) => {
    setLoading(true);
    try {
      await login(acc.email, acc.password);
    } catch {
      // Account doesn't exist yet — create it
      try {
        await register({
          username: acc.email.split('@')[0].replace('.', '_'),
          email: acc.email,
          password: acc.password,
          display_name: acc.label,
          gender: acc.gender,
        });
      } catch (err2: unknown) {
        const axErr = err2 as { response?: { data?: { error?: string } }; message?: string };
        Alert.alert('Error', axErr?.response?.data?.error ?? 'Cannot connect to server');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>TikTok Musulman</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        {/* Quick Access */}
        <View style={styles.quickSection}>
          <Text style={styles.quickLabel}>Quick Access</Text>
          <View style={styles.quickRow}>
            {TEST_ACCOUNTS.map((acc) => (
              <TouchableOpacity
                key={acc.email}
                style={styles.quickBtn}
                onPress={() => quickLogin(acc)}
                disabled={loading}
                activeOpacity={0.8}
              >
                <View style={[styles.quickAvatar, { backgroundColor: acc.gender === 'MALE' ? '#4f46e5' : '#9333ea' }]}>
                  <Text style={styles.quickAvatarText}>{acc.label[0]}</Text>
                </View>
                <View style={styles.quickInfo}>
                  <Text style={styles.quickName}>{acc.label}</Text>
                  <Text style={styles.quickCreds}>{acc.email}</Text>
                  <Text style={styles.quickCreds}>{acc.password}</Text>
                </View>
                <Text style={styles.quickArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or sign in manually</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholderTextColor={COLORS.textSubtle}
              placeholder="you@example.com"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholderTextColor={COLORS.textSubtle}
              placeholder="Your password"
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.link}>
            <Text style={styles.linkText}>No account? <Text style={styles.linkBold}>Register</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
  header: { alignItems: 'center', marginBottom: SPACING.xl },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 6 },

  quickSection: { marginBottom: SPACING.md },
  quickLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSubtle, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  quickRow: { gap: 8 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  quickInfo: { flex: 1, gap: 1 },
  quickName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  quickCreds: { fontSize: 10, color: COLORS.textSubtle, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  quickArrow: { fontSize: 16, color: COLORS.primary },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: SPACING.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 12, color: COLORS.textSubtle },

  form: { gap: SPACING.md },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  input: {
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  link: { alignItems: 'center', marginTop: SPACING.sm },
  linkText: { fontSize: 14, color: COLORS.textMuted },
  linkBold: { color: COLORS.primary, fontWeight: '600' },
});
