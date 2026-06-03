import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { IcClose, IcCheck } from '../../components/ui/Icons';

interface Props { onClose: () => void }

export function EditProfileScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');

  const mutation = useMutation({
    mutationFn: () => api.patch('/users/me', {
      display_name: displayName.trim(),
      bio: bio.trim() || null,
    }),
    onSuccess: (res) => {
      updateUser(res.data);
      onClose();
    },
    onError: (e: any) => Alert.alert('Erreur', e?.response?.data?.error ?? 'Échec de la mise à jour'),
  });

  const isDirty = displayName !== user?.display_name || bio !== (user?.bio ?? '');

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
          <IcClose size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier le profil</Text>
        <TouchableOpacity
          style={[styles.saveBtn, (!isDirty || mutation.isPending) && styles.saveBtnDisabled]}
          onPress={() => mutation.mutate()}
          disabled={!isDirty || mutation.isPending}
          activeOpacity={0.8}
        >
          {mutation.isPending
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <Text style={styles.saveBtnText}>Enregistrer</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Avatar placeholder */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {displayName[0]?.toUpperCase() ?? user?.display_name?.[0]?.toUpperCase() ?? 'U'}
            </Text>
          </View>
          <Text style={styles.changePhotoBtn}>Changer la photo (bientôt)</Text>
        </View>

        {/* Fields */}
        <View style={styles.fields}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nom affiché</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Votre nom"
              placeholderTextColor={COLORS.textPlaceholder}
              maxLength={50}
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Parlez de vous..."
              placeholderTextColor={COLORS.textPlaceholder}
              maxLength={200}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nom d'utilisateur</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={user?.username}
              editable={false}
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={styles.fieldHint}>Le nom d'utilisateur ne peut pas être modifié.</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, color: COLORS.text },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: COLORS.white, fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },

  content: { padding: SPACING.md, gap: SPACING.lg },
  avatarSection: { alignItems: 'center', gap: 10 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primaryBg, borderWidth: 2, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 36, fontWeight: FONT.weight.bold, color: COLORS.primary },
  changePhotoBtn: { fontSize: FONT.size.sm, color: COLORS.primary, fontWeight: FONT.weight.medium },

  fields: { gap: SPACING.md },
  field: { gap: 6 },
  fieldLabel: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12,
    fontSize: FONT.size.base, color: COLORS.text,
  },
  inputDisabled: { backgroundColor: COLORS.inputBg, color: COLORS.textMuted },
  textarea: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  charCount: { fontSize: FONT.size.xs, color: COLORS.textSubtle, textAlign: 'right' },
  fieldHint: { fontSize: FONT.size.xs, color: COLORS.textSubtle },
});
