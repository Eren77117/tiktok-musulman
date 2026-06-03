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

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({
    username: '', email: '', password: '',
    display_name: '', gender: '' as 'MALE' | 'FEMALE' | '',
  });
  const [loading, setLoading] = useState(false);

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleRegister = async () => {
    if (!form.gender) return Alert.alert('Requis', 'Veuillez sélectionner votre genre.');
    if (!form.username || !form.email || !form.password || !form.display_name) {
      return Alert.alert('Requis', 'Veuillez remplir tous les champs.');
    }
    if (form.password.length < 8) return Alert.alert('Erreur', 'Le mot de passe doit avoir au moins 8 caractères.');

    setLoading(true);
    try {
      await register({ ...form, gender: form.gender as 'MALE' | 'FEMALE' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: unknown } }; message?: string };
      const msg = e?.response?.data?.error;
      Alert.alert('Erreur', typeof msg === 'string' ? msg : e?.message ?? 'Inscription échouée');
    } finally {
      setLoading(false);
    }
  };

  const isValid = form.username && form.email && form.password.length >= 8 && form.display_name && form.gender;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[styles.container, { paddingTop: insets.top + 20 }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez la communauté Nour</Text>
        </View>

        {/* Genre — OBLIGATOIRE en premier */}
        <View style={styles.genderSection}>
          <Text style={styles.genderLabel}>Genre <Text style={styles.required}>*</Text></Text>
          <Text style={styles.genderHint}>Requis pour les règles de messagerie respectueuses</Text>
          <View style={styles.genderRow}>
            {(['MALE', 'FEMALE'] as const).map(g => (
              <TouchableOpacity
                key={g}
                style={[styles.genderBtn, form.gender === g && styles.genderBtnActive]}
                onPress={() => update('gender', g)}
                activeOpacity={0.8}
              >
                <Text style={styles.genderEmoji}>{g === 'MALE' ? 'H' : 'F'}</Text>
                <Text style={[styles.genderText, form.gender === g && styles.genderTextActive]}>
                  {g === 'MALE' ? 'Homme' : 'Femme'}
                </Text>
                {form.gender === g && <View style={styles.genderCheck}><Text style={styles.checkmark}>✓</Text></View>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Form fields */}
        <View style={styles.form}>
          <Input label="Nom affiché" value={form.display_name} onChangeText={v => update('display_name', v)} placeholder="Votre nom" returnKeyType="next" />
          <Input label="Nom d'utilisateur" value={form.username} onChangeText={v => update('username', v.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="nom_utilisateur" autoCapitalize="none" returnKeyType="next" />
          <Input label="Email" value={form.email} onChangeText={v => update('email', v)} keyboardType="email-address" autoCapitalize="none" placeholder="votre@email.com" returnKeyType="next" />
          <Input label="Mot de passe (min. 8 caractères)" value={form.password} onChangeText={v => update('password', v)} secureTextEntry placeholder="••••••••" returnKeyType="done" onSubmitEditing={handleRegister} />
        </View>

        <Button
          label="Créer mon compte"
          onPress={handleRegister}
          loading={loading}
          disabled={!isValid}
          fullWidth size="lg"
        />

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.loginLink}>
          <Text style={styles.loginText}>
            Déjà un compte ? <Text style={styles.loginBold}>Se connecter</Text>
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
  backBtn: { marginBottom: SPACING.md },
  backIcon: { fontSize: 24, color: COLORS.primary },
  header: { marginBottom: SPACING.xl, gap: 6 },
  title: { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.bold, color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: FONT.size.base, color: COLORS.textMuted },
  required: { color: COLORS.error },

  genderSection: { marginBottom: SPACING.lg, gap: 6 },
  genderLabel: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.text },
  genderHint: { fontSize: FONT.size.xs, color: COLORS.textMuted, marginBottom: 4 },
  genderRow: { flexDirection: 'row', gap: 12 },
  genderBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  genderBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  genderEmoji: { fontSize: 20 },
  genderText: { fontSize: FONT.size.base, fontWeight: FONT.weight.medium, color: COLORS.textMuted, flex: 1 },
  genderTextActive: { color: COLORS.primary },
  genderCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: COLORS.white, fontSize: 11, fontWeight: FONT.weight.bold },

  form: { gap: SPACING.md, marginBottom: SPACING.lg },
  loginLink: { alignItems: 'center', paddingVertical: SPACING.md },
  loginText: { fontSize: FONT.size.base, color: COLORS.textMuted },
  loginBold: { color: COLORS.primary, fontWeight: FONT.weight.semibold },
});
