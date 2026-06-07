import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Modal, Animated, Easing, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '../../constants/theme';
import { IcClose, IcLink } from '../../components/ui/Icons';

const CATEGORIES = [
  'Islam & Foi', 'Coran & Hadith', 'Famille', 'Éducation', 'Humour Halal',
  'Sport & Santé', 'Cuisine Halale', 'Voyage', 'Tech & Science', 'Business',
  'Art & Créativité', 'Autre',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  user: { display_name: string; bio?: string | null; username: string; bio_links?: string[]; profile_category?: string | null } | null;
  onSave: (data: { display_name: string; bio: string; bio_links: string[]; profile_category: string | null }) => Promise<void>;
}

export function EditProfileSheet({ visible, onClose, user, onSave }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [bioLinks, setBioLinks] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && user) {
      setDisplayName(user.display_name);
      setBio(user.bio ?? '');
      setBioLinks(user.bio_links ?? []);
      setCategory(user.profile_category ?? null);
      setLinkInput('');
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

  const addLink = () => {
    const raw = linkInput.trim();
    if (!raw) return;
    const url = raw.startsWith('http') ? raw : `https://${raw}`;
    if (bioLinks.length >= 3) return;
    setBioLinks(prev => [...prev, url]);
    setLinkInput('');
  };

  const removeLink = (i: number) => setBioLinks(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await onSave({ display_name: displayName.trim(), bio: bio.trim(), bio_links: bioLinks, profile_category: category });
    } finally {
      setSaving(false);
    }
  };

  if (!visible && !saving) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <Animated.View style={[styles.sheet, { backgroundColor: theme.surface, transform: [{ translateY }] }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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

          {/* Liens */}
          <Text style={[styles.label, { color: theme.textMuted }]}>Liens ({bioLinks.length}/3)</Text>
          {bioLinks.map((l, i) => (
            <View key={i} style={[styles.linkRow, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <IcLink size={14} color={COLORS.primary} />
              <Text style={[styles.linkTxt, { color: theme.text }]} numberOfLines={1}>{l.replace(/^https?:\/\//, '')}</Text>
              <TouchableOpacity onPress={() => removeLink(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <IcClose size={14} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
          {bioLinks.length < 3 && (
            <View style={styles.linkAddRow}>
              <TextInput
                value={linkInput}
                onChangeText={setLinkInput}
                onSubmitEditing={addLink}
                style={[styles.linkInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                placeholder="ex: instagram.com/ton_compte"
                placeholderTextColor={theme.textSubtle}
                autoCapitalize="none"
                keyboardType="url"
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.linkAddBtn} onPress={addLink} activeOpacity={0.8}>
                <Text style={styles.linkAddBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Catégorie */}
          <Text style={[styles.label, { color: theme.textMuted }]}>Catégorie</Text>
          <View style={styles.categoriesWrap}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(category === cat ? null : cat)}
                style={[
                  styles.catChip,
                  category === cat
                    ? { backgroundColor: COLORS.primary }
                    : { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 },
                ]}
                activeOpacity={0.75}
              >
                <Text style={[styles.catText, { color: category === cat ? '#fff' : theme.textMuted }]}>{cat}</Text>
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
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: {
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, marginBottom: 16, borderWidth: 1,
  },
  bioInput: { height: 90, textAlignVertical: 'top' },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, marginBottom: 6,
  },
  linkTxt: { flex: 1, fontSize: FONT.size.sm },
  linkAddRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  linkInput: {
    flex: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, borderWidth: 1,
  },
  linkAddBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    width: 44, alignItems: 'center', justifyContent: 'center',
  },
  linkAddBtnTxt: { color: '#fff', fontSize: 22, fontWeight: '300', lineHeight: 28 },
  categoriesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catChip: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  catText: { fontSize: 12, fontWeight: '600' },
  usernameNote: { fontSize: 12, marginBottom: 24, marginTop: 8 },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 100,
    paddingVertical: 15, alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
