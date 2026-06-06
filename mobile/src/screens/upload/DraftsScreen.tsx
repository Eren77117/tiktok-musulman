import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, Alert, StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONT, RADIUS, SPACING } from '../../constants/theme';
import { IcTrash, IcEdit, IcPlay, IcBack } from '../../components/ui/Icons';

interface Draft {
  id: string;
  caption: string;
  videoUri: string | null;
  thumbnailUri: string | null;
  createdAt: string;
}

export default function DraftsScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const loadDrafts = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('nour_drafts');
      setDrafts(JSON.parse(stored ?? '[]'));
    } catch {
      setDrafts([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadDrafts(); }, [loadDrafts]));

  const deleteDraft = (id: string) => {
    Alert.alert('Supprimer', 'Supprimer ce brouillon ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          const updated = drafts.filter(d => d.id !== id);
          setDrafts(updated);
          await AsyncStorage.setItem('nour_drafts', JSON.stringify(updated));
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <IcBack size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Brouillons</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={drafts}
        keyExtractor={d => d.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <IcEdit size={48} color={COLORS.textSubtle} />
            <Text style={styles.emptyTitle}>Aucun brouillon</Text>
            <Text style={styles.emptySubtitle}>Tes publications en cours apparaîtront ici.</Text>
          </View>
        }
        renderItem={({ item: draft }) => (
          <View style={styles.card}>
            <TouchableOpacity style={styles.thumb} onPress={() => nav.navigate('Upload', { draft })} activeOpacity={0.85}>
              {draft.thumbnailUri ? (
                <Image source={{ uri: draft.thumbnailUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.thumbPlaceholder]}>
                  <IcPlay size={24} color={COLORS.textSubtle} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.info}>
              <Text style={styles.caption} numberOfLines={2}>
                {draft.caption || 'Aucune description'}
              </Text>
              <Text style={styles.date}>
                {new Date(draft.createdAt).toLocaleDateString('fr-FR')}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={() => nav.navigate('Upload', { draft })}
                  activeOpacity={0.7}
                >
                  <IcEdit size={13} color={COLORS.primary} />
                  <Text style={styles.continueBtnText}>Continuer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteDraft(draft.id)}
                  style={styles.deleteBtn}
                  activeOpacity={0.7}
                >
                  <IcTrash size={15} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, color: COLORS.text },
  list: { padding: SPACING.md, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textMuted },
  emptySubtitle: { fontSize: 13, color: COLORS.textSubtle, textAlign: 'center' },
  card: {
    flexDirection: 'row', gap: 12, backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg, padding: 12, overflow: 'hidden',
  },
  thumb: { width: 70, height: 90, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: '#111' },
  thumbPlaceholder: { backgroundColor: COLORS.inputBg, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 4 },
  caption: { fontSize: 13, color: COLORS.text, lineHeight: 18 },
  date: { fontSize: 11, color: COLORS.textSubtle },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4, alignItems: 'center' },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  continueBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  deleteBtn: {
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.inputBg, borderRadius: RADIUS.sm,
  },
});
