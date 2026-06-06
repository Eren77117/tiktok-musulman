import React, { useState } from 'react';
import {
  View, Text, Modal, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Image, StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '../../constants/theme';
import { IcFolderPlus, IcFolder, IcClose, IcCheck } from '../ui/Icons';
import { showToast } from '../ui/Toast';

interface Props {
  visible: boolean;
  postId: string;
  onClose: () => void;
}

interface Collection {
  id: string;
  name: string;
  post_count: number;
  thumbnail_url: string | null;
  has_post?: boolean;
}

export function SaveToCollectionSheet({ visible, postId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const { data, isLoading } = useQuery<{ items: Collection[] }>({
    queryKey: ['collections', postId],
    queryFn: () => api.get('/collections', { params: { postId } }).then(r => r.data),
    enabled: visible,
  });

  const saveMutation = useMutation({
    mutationFn: (collectionId: string) =>
      api.post(`/collections/${collectionId}/posts`, { postId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections', postId] });
      showToast('Ajouté à la collection', 'success');
      onClose();
    },
    onError: () => showToast('Erreur, réessaie', 'error'),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post('/collections', { name }).then(r => r.data),
    onSuccess: (collection: Collection) => {
      setCreating(false);
      setNewName('');
      saveMutation.mutate(collection.id);
    },
    onError: () => showToast('Nom déjà utilisé ou erreur', 'error'),
  });

  const collections = data?.items ?? [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Enregistrer dans</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <IcClose size={22} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {creating ? (
          <View style={styles.createRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Nom de la collection..."
              placeholderTextColor={theme.textSubtle}
              style={[styles.createInput, { color: theme.text, backgroundColor: theme.card }]}
              autoFocus
              maxLength={30}
              onSubmitEditing={() => { if (newName.trim()) createMutation.mutate(newName.trim()); }}
            />
            <TouchableOpacity
              onPress={() => { if (newName.trim()) createMutation.mutate(newName.trim()); }}
              disabled={!newName.trim() || createMutation.isPending}
              style={[styles.createBtn, !newName.trim() && { opacity: 0.4 }]}
            >
              {createMutation.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.createBtnText}>Créer</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.newCollBtn} onPress={() => setCreating(true)} activeOpacity={0.7}>
            <View style={[styles.collThumb, { backgroundColor: theme.primaryBg, borderWidth: 1.5, borderColor: COLORS.primary }]}>
              <IcFolderPlus size={20} color={COLORS.primary} />
            </View>
            <Text style={[styles.collName, { color: COLORS.primary }]}>Nouvelle collection</Text>
          </TouchableOpacity>
        )}

        {isLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} />
        ) : collections.length === 0 ? (
          <Text style={{ color: theme.textMuted, textAlign: 'center', marginVertical: 20, fontSize: 14 }}>
            Crée ta première collection pour organiser tes vidéos favorites.
          </Text>
        ) : (
          <FlatList
            data={collections}
            keyExtractor={c => c.id}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 340 }}
            renderItem={({ item: coll }) => (
              <TouchableOpacity
                style={styles.collItem}
                onPress={() => { if (!coll.has_post) saveMutation.mutate(coll.id); }}
                activeOpacity={0.7}
              >
                {coll.thumbnail_url ? (
                  <Image source={{ uri: coll.thumbnail_url }} style={styles.collThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.collThumb, { backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }]}>
                    <IcFolder size={20} color={theme.textSubtle} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.collName, { color: theme.text }]}>{coll.name}</Text>
                  <Text style={{ fontSize: 12, color: theme.textSubtle, marginTop: 2 }}>
                    {coll.post_count} vidéo{coll.post_count !== 1 ? 's' : ''}
                  </Text>
                </View>
                {coll.has_post && <IcCheck size={18} color={COLORS.primary} />}
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingTop: 12,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '700' },
  newCollBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, marginBottom: 8 },
  createRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  createInput: { flex: 1, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  createBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 10 },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  collItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  collThumb: { width: 52, height: 52, borderRadius: RADIUS.sm, overflow: 'hidden' },
  collName: { fontSize: 14, fontWeight: '600' },
});
