import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation';
import { useAuthStore } from '../../stores/authStore';
import { COLORS, SPACING } from '../../constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuthStore();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    display_name: '',
    gender: '' as 'MALE' | 'FEMALE' | '',
  });
  const [loading, setLoading] = useState(false);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleRegister = async () => {
    if (!form.gender) {
      Alert.alert('Required', 'Please select your gender');
      return;
    }
    if (!form.username || !form.email || !form.password || !form.display_name) {
      Alert.alert('Required', 'Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      await register({ ...form, gender: form.gender as 'MALE' | 'FEMALE' });
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { error?: unknown } }; message?: string };
      const serverMsg = axErr?.response?.data?.error;
      const msg = typeof serverMsg === 'string'
        ? serverMsg
        : axErr?.message?.includes('Network')
          ? 'Cannot reach server. Check your WiFi connection.'
          : 'Registration failed. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join TikTok Musulman</Text>
        </View>

        <View style={styles.form}>
          {(['display_name', 'username', 'email', 'password'] as const).map((field) => (
            <View key={field} style={styles.inputGroup}>
              <Text style={styles.label}>
                {field === 'display_name' ? 'Display name' : field.charAt(0).toUpperCase() + field.slice(1)}
              </Text>
              <TextInput
                style={styles.input}
                value={form[field]}
                onChangeText={(v) => set(field, v)}
                keyboardType={field === 'email' ? 'email-address' : 'default'}
                autoCapitalize={field === 'email' || field === 'username' ? 'none' : 'sentences'}
                secureTextEntry={field === 'password'}
                autoComplete={field === 'email' ? 'email' : field === 'password' ? 'new-password' : 'off'}
                placeholderTextColor={COLORS.textSubtle}
                placeholder={field === 'display_name' ? 'Your name' : ''}
              />
            </View>
          ))}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender (required)</Text>
            <View style={styles.genderRow}>
              {(['MALE', 'FEMALE'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderBtn, form.gender === g && styles.genderBtnActive]}
                  onPress={() => set('gender', g)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.genderText, form.gender === g && styles.genderTextActive]}>
                    {g === 'MALE' ? 'Male' : 'Female'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>{loading ? 'Creating...' : 'Create account'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.link}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
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
  genderRow: { flexDirection: 'row', gap: SPACING.sm },
  genderBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgInput,
    alignItems: 'center',
  },
  genderBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '22' },
  genderText: { fontSize: 15, color: COLORS.textMuted, fontWeight: '500' },
  genderTextActive: { color: COLORS.primary },
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
