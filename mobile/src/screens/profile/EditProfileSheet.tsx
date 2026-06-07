import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Modal, Animated, Easing, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '../../constants/theme';

const CATEGORIES = [
  'Islam & Foi', 'Coran & Hadith', 'Famille', 'Éducation',
  'Humour Halal', 'Sport & Santé', 'Cuisine Halale', 'Voyage',
  'Tech & Science', 'Business', 'Art & Créativité', 'Autre',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  user: {
    display_name: string;
    bio?: string | null;
    username: string;
    bio_links?: string[];
    profile_category?: string | null;
  } | null;
  onSave: (data: {
    display_name: string;
    bio: string;
    bio_links: string[];
    profile_category: string | null;
  }) => Promise<void>;
}

export function EditProfileSheet({ visible, onClose, user, onSave }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [link, setLink] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkError, setLinkError] = useState('');

  // Sync with user data when opening
  useEffect(() => {
    if (visible && user) {
      setDisplayName(user.display_name);
      setBio(user.bio ?? '');
      setLink(user.bio_links?.[0] ?? '');
      setCategory(user.profile_category ?? null);
      setLinkError('');
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

  const validateLink = (val: string): boolean => {
    if (!val.trim()) return true; // empty is ok
    try {
      const u = new URL(val.startsWith('http') ? val : `https://${val}`);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  };

  const normalizeLink = (val: string): string => {
    if (!val.trim()) return '';
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    return `https://${val}`;
  };

  const handleSave = async () => {
    if (!displayName.trim()) return;
    const normalizedLink = normalizeLink(link);
    if (normalizedLink && !validateLink(normalizedLink)) {
      setLinkError('Lien invalide. Ex: https://monsite.com');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        display_name: displayName.trim(),
        bio: bio.trim(),
        bio_links: normalizedLink ? [normalizedLink] : [],
        profile_category: category,
      });
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
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

            {/* Lien */}
            <Text style={[styles.label, { color: theme.textMuted }]}>Lien (site, chaîne, etc.)</Text>
            <View style={[styles.linkInputWrap, {
              backgroundColor: theme.inputBg,
              borderColor: linkError ? '#FF3B30' : theme.border,
            }]}>
              <Link size={15} color={theme.textMuted} strokeWidth={1.8} />
              <TextInput
                value={link}
                onChangeText={v => { setLink(v); setLinkError(''); }}
                style={[styles.linkInput, { color: theme.text }]}
                placeholder="https://monsite.com"
                placeholderTextColor={theme.textSubtle}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={200}
              />
            </View>
            {linkError ? <Text style={styles.linkError}>{linkError}</Text> : null}

            {/* Catégorie */}
            <Text style={[styles.label, { color: theme.textMuted }]}>Catégorie</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    { borderColor: category === cat ? COLORS.primary : theme.border },
                    category === cat && { backgroundColor: `${COLORS.primary}18` },
                  ]}
                  onPress={() => setCategory(category === cat ? null : cat)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.catLabel,
                    { color: category === cat ? COLORS.primary : theme.textMuted },
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
          </ScrollView>
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
    maxHeight: '90%',
  },
  scrollContent: { paddingBottom: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: {
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, marginBottom: 16, borderWidth: 1,
  },
  bioInput: { height: 90, textAlignVertical: 'top' },
  linkInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, marginBottom: 4,
  },
  linkInput: { flex: 1, fontSize: 15, padding: 0 },
  linkError: { color: '#FF3B30', fontSize: 12, marginBottom: 12, marginLeft: 2 },
  categoryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16,
  },
  catChip: {
    borderRadius: 20, borderWidth: 1.2,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  catLabel: { fontSize: 13, fontWeight: '500' },
  usernameNote: { fontSize: 12, marginBottom: 24 },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 100,
    paddingVertical: 15, alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
