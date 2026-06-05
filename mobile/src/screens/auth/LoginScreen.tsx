import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthStackParamList } from '../../navigation';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
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
  const theme = useTheme();
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
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: theme.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top + 20 }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={[styles.logoCircle, { backgroundColor: theme.primaryBg, borderColor: theme.primary }]}>
            <IcBrand size={36} color={theme.primary} />
          </View>
          <Text style={[styles.appName, { color: theme.primary }]}>Nour</Text>
          <Text style={[styles.tagline, { color: theme.textMuted }]}>Partage, inspire, élève.</Text>
        </View>

        {/* Quick Access */}
        <View style={styles.quickSection}>
          <View style={styles.quickHeader}>
            <View style={[styles.quickLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.quickLabel, { color: theme.textSubtle }]}>Accès rapide test</Text>
            <View style={[styles.quickLine, { backgroundColor: theme.border }]} />
          </View>
          <View style={styles.quickRow}>
            {QUICK_ACCOUNTS.map((acc) => (
              <TouchableOpacity
                key={acc.email}
                style={[styles.quickBtn, { backgroundColor: theme.card, borderColor: theme.border }, quickLoading === acc.email && styles.quickBtnLoading]}
                onPress={() => handleQuickAccess(acc)}
                disabled={!!quickLoading}
                activeOpacity={0.8}
              >
                <View style={[styles.quickAvatar, { backgroundColor: acc.gender === 'MALE' ? theme.primaryBg : COLORS.goldBg }]}>
                  <Text style={[styles.quickAvatarText, { color: acc.gender === 'MALE' ? theme.primary : COLORS.gold }]}>
                    {acc.gender === 'MALE' ? 'H' : 'F'}
                  </Text>
                </View>
                <View style={styles.quickInfo}>
                  <Text style={[styles.quickName, { color: theme.text }]}>{acc.label}</Text>
                  <Text style={[styles.quickEmail, { color: theme.textMuted }]}>{acc.email}</Text>
                </View>
                <Text style={[styles.quickArrow, { color: theme.primary }]}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <Text style={[styles.dividerText, { color: theme.textMuted }]}>ou connectez-vous</Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
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
          <Text style={[styles.registerText, { color: theme.textMuted }]}>
            Pas de compte ?{' '}
            <Text style={[styles.registerBold, { color: theme.primary }]}>Créer un compte</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: 40 },

  logoSection: { alignItems: 'center', marginBottom: SPACING.xl, gap: 10 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, ...SHADOW.green,
  },
  appName: { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.bold, letterSpacing: -0.5 },
  tagline: { fontSize: FONT.size.base },

  quickSection: { marginBottom: SPACING.lg, gap: 12 },
  quickHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickLine: { flex: 1, height: 1 },
  quickLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.medium },
  quickRow: { gap: 8 },
  quickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.md, padding: 12, borderWidth: 1, ...SHADOW.sm,
  },
  quickBtnLoading: { opacity: 0.6 },
  quickAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  quickAvatarText: { fontSize: 20, fontWeight: FONT.weight.bold },
  quickInfo: { flex: 1 },
  quickName: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  quickEmail: { fontSize: FONT.size.xs, marginTop: 1 },
  quickArrow: { fontSize: 16 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.lg },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: FONT.size.sm },

  form: { gap: SPACING.md, marginBottom: SPACING.lg },

  registerLink: { alignItems: 'center', paddingVertical: SPACING.sm },
  registerText: { fontSize: FONT.size.base },
  registerBold: { fontWeight: FONT.weight.semibold },
});
