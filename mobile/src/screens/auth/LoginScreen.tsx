import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthStackParamList } from '../../navigation';
import { useAuthStore } from '../../stores/authStore';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { IcBrand } from '../../components/ui/Icons';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const QUICK_ACCOUNTS = [
  { label: 'Compte Homme', email: 'test.homme@tm.local', password: 'Test1234!', gender: 'MALE' as const },
  { label: 'Compte Femme', email: 'test.femme@tm.local', password: 'Test1234!', gender: 'FEMALE' as const },
];

export default function LoginScreen({ navigation }: Props) {
  const { login, register } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      Alert.alert('Erreur', e?.response?.data?.error ?? e?.message ?? 'Échec de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAccess = async (acc: typeof QUICK_ACCOUNTS[0]) => {
    setQuickLoading(acc.email);
    try {
      await login(acc.email, acc.password);
    } catch {
      try {
        await register({
          username: acc.email.split('@')[0].replace('.', '_'),
          email: acc.email,
          password: acc.password,
          display_name: acc.label,
          gender: acc.gender,
        });
      } catch (err2: unknown) {
        const e = err2 as { response?: { data?: { error?: string } }; message?: string };
        Alert.alert('Erreur', e?.response?.data?.error ?? 'Impossible de se connecter');
      }
    } finally {
      setQuickLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[styles.container, { paddingTop: insets.top + 20 }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <IcBrand size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.appName}>Nour</Text>
          <Text style={styles.tagline}>Partage, inspire, élève.</Text>
        </View>

        {/* Quick Access */}
        <View style={styles.quickSection}>
          <View style={styles.quickHeader}>
            <View style={styles.quickLine} />
            <Text style={styles.quickLabel}>Accès rapide test</Text>
            <View style={styles.quickLine} />
          </View>
          <View style={styles.quickRow}>
            {QUICK_ACCOUNTS.map((acc) => (
              <TouchableOpacity
                key={acc.email}
                style={[styles.quickBtn, quickLoading === acc.email && styles.quickBtnLoading]}
                onPress={() => handleQuickAccess(acc)}
                disabled={!!quickLoading}
                activeOpacity={0.8}
              >
                <View style={[styles.quickAvatar, { backgroundColor: acc.gender === 'MALE' ? COLORS.primaryBg : COLORS.goldBg }]}>
                  <Text style={[styles.quickAvatarText, { color: acc.gender === 'MALE' ? COLORS.primary : COLORS.gold }]}>
                    {acc.gender === 'MALE' ? 'H' : 'F'}
                  </Text>
                </View>
                <View style={styles.quickInfo}>
                  <Text style={styles.quickName}>{acc.label}</Text>
                  <Text style={styles.quickEmail}>{acc.email}</Text>
                </View>
                <Text style={styles.quickArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou connectez-vous</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="votre@email.com"
            returnKeyType="next"
          />
          <Input
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <Button
            label="Se connecter"
            onPress={handleLogin}
            loading={loading}
            disabled={!email.trim() || !password}
            fullWidth
            size="lg"
          />
        </View>

        {/* Register link */}
        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.registerLink}>
          <Text style={styles.registerText}>
            Pas de compte ?{' '}
            <Text style={styles.registerBold}>Créer un compte</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: 40 },

  // Logo
  logoSection: { alignItems: 'center', marginBottom: SPACING.xl, gap: 10 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.primary,
    ...SHADOW.green,
  },
  logoEmoji: { fontSize: 32, fontWeight: '700', color: COLORS.primary },
  appName: { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.bold, color: COLORS.primary, letterSpacing: -0.5 },
  tagline: { fontSize: FONT.size.base, color: COLORS.textMuted },

  // Quick access
  quickSection: { marginBottom: SPACING.lg, gap: 12 },
  quickHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  quickLabel: { fontSize: FONT.size.xs, color: COLORS.textSubtle, fontWeight: FONT.weight.medium },
  quickRow: { gap: 8 },
  quickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: 12, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm,
  },
  quickBtnLoading: { opacity: 0.6 },
  quickAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  quickAvatarText: { fontSize: 20, fontWeight: FONT.weight.bold },
  quickInfo: { flex: 1 },
  quickName: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.text },
  quickEmail: { fontSize: FONT.size.xs, color: COLORS.textMuted, marginTop: 1 },
  quickArrow: { fontSize: 16, color: COLORS.primary },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: FONT.size.sm, color: COLORS.textMuted },

  // Form
  form: { gap: SPACING.md, marginBottom: SPACING.lg },

  // Register
  registerLink: { alignItems: 'center', paddingVertical: SPACING.sm },
  registerText: { fontSize: FONT.size.base, color: COLORS.textMuted },
  registerBold: { color: COLORS.primary, fontWeight: FONT.weight.semibold },
});
