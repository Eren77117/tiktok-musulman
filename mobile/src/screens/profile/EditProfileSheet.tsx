import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Modal, Animated, Easing, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '../../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  user: { display_name: string; bio?: string | null; username: string } | null;
  onSave: (data: { display_name: string; bio: string }) => Promise<void>;
}

export function EditProfileSheet({ visible, onClose, user, onSave }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync with user data when opening
  useEffect(() => {
    if (visible && user) {
      setDisplayName(user.display_name);
      setBio(user.bio ?? '');
    }
  }, [visible, user]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1, useNativeDriver: true,
        stiffness: 520, damping: 42,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0, duration: 240, useNativeDriver: true,
        easing: Easing.bezier(0.4, 0, 1, 1),
      }).start();
    }
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [700, 0],
  });

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await onSave({ display_name: displayName.trim(), bio: bio.trim() });
    } finally {
      setSaving(false);
    }
  };

  if (!visible && !saving) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Sheet */}
        <Animated.View style={[styles.sheet, { backgroundColor: theme.surface, transform: [{ translateY }] }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <Text style={[styles.title, { color: theme.text }]}>Modifier le profil</Text>

          {/* Nom affiché */}
          <Text style={[styles.label, { color: theme.textMuted }]}>Nom affiché</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            placeholder="Ton nom affiché"
            placeholderTextColor={theme.textSubtle}
            maxLength={50}
          />

          {/* Bio */}
          <Text style={[styles.label, { color: theme.textMuted }]}>Bio ({bio.length}/150)</Text>
          <TextInput
            value={bio}
            onChangeText={t => setBio(t.slice(0, 150))}
            style={[styles.input, styles.bioInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            placeholder="Parle de toi..."
            placeholderTextColor={theme.textSubtle}
            multiline
            maxLength={150}
          />

          {/* Username read-only */}
          <Text style={[styles.usernameNote, { color: theme.textSubtle }]}>
            @{user?.username} — le nom d'utilisateur n'est pas modifiable
          </Text>

          {/* Enregistrer */}
          <TouchableOpacity
            style={[styles.saveBtn, { opacity: !displayName.trim() || saving ? 0.5 : 1 }]}
            onPress={handleSave}
            disabled={!displayName.trim() || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Enregistrer</Text>
            }
          </TouchableOpacity>

          <View style={{ height: Math.max(insets.bottom, 24) }} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md, paddingTop: 12,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: {
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, marginBottom: 16, borderWidth: 1,
  },
  bioInput: { height: 90, textAlignVertical: 'top' },
  usernameNote: { fontSize: 12, marginBottom: 24 },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 100,
    paddingVertical: 15, alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
