# 05 — PHASE 4 : NOUVELLES FONCTIONNALITÉS
## Features manquantes vs TikTok — les implémenter de zéro

---

## ✅ CHECKLIST PHASE 4

- [ ] FEAT-01 : Collections (Favoris organisés en dossiers)
- [ ] FEAT-02 : Brouillons (Drafts locaux AsyncStorage)
- [ ] FEAT-03 : Recherche avancée (trending, historique, suggestions)
- [ ] FEAT-04 : Hashtag Screen enrichie (follow hashtag, count, sort)
- [ ] FEAT-05 : View count badge dans le feed
- [ ] FEAT-06 : Duet / Stitch (partage avec citation vidéo)
- [ ] FEAT-07 : Son Screen enrichi
- [ ] FEAT-08 : Live — améliorations (hearts, badges, modération)
- [ ] FEAT-09 : Onboarding amélioré (sélection catégories)
- [ ] FEAT-10 : Offline mode + bannière de connexion

---

## 🆕 FEAT-01 : Collections (Favoris organisés)

### Concept TikTok
Sur TikTok, quand tu sauvegardes une vidéo, tu peux la mettre dans une "Collection"
(Cuisine, Rappels islamiques, Science, etc.). Les collections apparaissent dans l'onglet Favoris du profil.

### Backend — Endpoints requis :

```typescript
// Ajouter dans backend/src/routes/collections.ts

// Créer une collection
POST /collections
Body: { name: string }
Response: { id, name, thumbnail_url, post_count, user_id }

// Lister mes collections
GET /collections
Response: { items: Collection[] }

// Posts d'une collection
GET /collections/:id/posts?cursor=&limit=
Response: { items: Post[], next_cursor }

// Ajouter un post à une collection
POST /collections/:id/posts
Body: { postId: string }
Response: 200

// Retirer un post d'une collection
DELETE /collections/:id/posts/:postId
Response: 200

// Supprimer une collection
DELETE /collections/:id
Response: 200

// Schéma Prisma à ajouter :
model Collection {
  id          String   @id @default(cuid())
  name        String
  user_id     String
  user        User     @relation(fields: [user_id], references: [id])
  posts       CollectionPost[]
  created_at  DateTime @default(now())
  
  @@unique([user_id, name])
}

model CollectionPost {
  collection_id String
  post_id      String
  collection   Collection @relation(fields: [collection_id], references: [id])
  post         Post       @relation(fields: [post_id], references: [id])
  saved_at     DateTime   @default(now())
  
  @@id([collection_id, post_id])
}
```

### Frontend — `SaveToCollectionSheet.tsx` :

```typescript
// src/components/video/SaveToCollectionSheet.tsx
import React, { useState } from 'react';
import {
  View, Text, Modal, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Image, Alert, StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, RADIUS } from '../../constants/theme';
import { IcFolderPlus, IcCheck, IcFolder, IcX } from '../ui/Icons';
import { showToast } from './Toast';

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
  has_post?: boolean; // true si ce post est déjà dans cette collection
}

export function SaveToCollectionSheet({ visible, postId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const { data, isLoading } = useQuery<{ items: Collection[] }>({
    queryKey: ['collections', postId],
    queryFn: () =>
      api.get('/collections', { params: { postId } }).then(r => r.data),
    enabled: visible,
  });

  const saveMutation = useMutation({
    mutationFn: (collectionId: string) =>
      api.post(`/collections/${collectionId}/posts`, { postId }),
    onSuccess: (_, collectionId) => {
      qc.invalidateQueries({ queryKey: ['collections', postId] });
      showToast({ text: 'Ajouté à la collection', type: 'success' });
      onClose();
    },
    onError: () => showToast({ text: 'Erreur, réessaie', type: 'error' }),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      api.post('/collections', { name }).then(r => r.data),
    onSuccess: (collection) => {
      setCreating(false);
      setNewName('');
      saveMutation.mutate(collection.id);
    },
    onError: () => showToast({ text: 'Nom déjà utilisé ou erreur', type: 'error' }),
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate(newName.trim());
  };

  const collections = data?.items ?? [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[collStyles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {/* Handle */}
        <View style={collStyles.handle} />

        {/* Header */}
        <View style={collStyles.header}>
          <Text style={[collStyles.title, { color: theme.text }]}>Enregistrer dans</Text>
          <TouchableOpacity onPress={onClose}>
            <IcX size={22} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Bouton créer collection */}
        {creating ? (
          <View style={collStyles.createRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Nom de la collection..."
              placeholderTextColor={theme.textSubtle}
              style={[collStyles.createInput, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
              autoFocus
              maxLength={30}
              onSubmitEditing={handleCreate}
            />
            <TouchableOpacity
              onPress={handleCreate}
              disabled={!newName.trim() || createMutation.isPending}
              style={[collStyles.createBtn, !newName.trim() && { opacity: 0.4 }]}
            >
              {createMutation.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={collStyles.createBtnText}>Créer</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={collStyles.newCollectionBtn}
            onPress={() => setCreating(true)}
            activeOpacity={0.7}
          >
            <View style={[collStyles.collThumb, { backgroundColor: theme.primaryBg, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed' }]}>
              <IcFolderPlus size={20} color={COLORS.primary} />
            </View>
            <Text style={[collStyles.collName, { color: COLORS.primary }]}>
              Nouvelle collection
            </Text>
          </TouchableOpacity>
        )}

        {/* Liste des collections */}
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
                style={collStyles.collItem}
                onPress={() => !coll.has_post && saveMutation.mutate(coll.id)}
                activeOpacity={0.7}
              >
                {/* Thumbnail */}
                {coll.thumbnail_url ? (
                  <Image source={{ uri: coll.thumbnail_url }} style={collStyles.collThumb} resizeMode="cover" />
                ) : (
                  <View style={[collStyles.collThumb, { backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}>
                    <IcFolder size={20} color={theme.textSubtle} />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={[collStyles.collName, { color: theme.text }]}>{coll.name}</Text>
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

const collStyles = StyleSheet.create({
  sheet: {
    backgroundColor: 'white',  // useTheme ici dans prod
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingTop: 12,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '700' },
  newCollectionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, marginBottom: 8 },
  createRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  createInput: { flex: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  createBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  collItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  collThumb: { width: 52, height: 52, borderRadius: 8, overflow: 'hidden' },
  collName: { fontSize: 14, fontWeight: '600' },
});
```

### Dans `VideoPlayerItem.tsx` — remplacer le bouton Save :

```typescript
// Remplacer le bouton Save simple par l'ouverture du CollectionSheet :
const [collectionSheetVisible, setCollectionSheetVisible] = useState(false);

// Bouton save :
<ActionBtn
  icon={saved ? <IcBookmarkFill size={28} color={COLORS.primary} /> : <IcSave size={28} color={COLORS.white} />}
  count={''}
  onPress={() => setCollectionSheetVisible(true)}
/>

// Render :
<SaveToCollectionSheet
  visible={collectionSheetVisible}
  postId={post.id}
  onClose={() => setCollectionSheetVisible(false)}
/>
```

### Dans `ProfileScreen` — onglet Favoris :

```typescript
// Afficher les collections comme une grille de "dossiers" :
function CollectionsGrid({ userId }: { userId: string }) {
  const theme = useTheme();
  const { data, isLoading } = useQuery({
    queryKey: ['collections', userId],
    queryFn: () => api.get('/collections').then(r => r.data as { items: Collection[] }),
  });

  const collections = data?.items ?? [];
  const COLL_SIZE = (Dimensions.get('window').width - 48) / 2;

  if (isLoading) return <Skeleton width="100%" height={200} />;

  return (
    <FlatList
      data={collections}
      numColumns={2}
      columnWrapperStyle={{ gap: 16 }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      keyExtractor={c => c.id}
      renderItem={({ item: coll }) => (
        <TouchableOpacity
          style={{ width: COLL_SIZE }}
          onPress={() => nav.navigate('Collection', { collectionId: coll.id, name: coll.name })}
          activeOpacity={0.85}
        >
          {/* Couverture */}
          <View style={{ width: COLL_SIZE, height: COLL_SIZE, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.surfaceAlt }}>
            {coll.thumbnail_url ? (
              <Image source={{ uri: coll.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <IcFolder size={32} color={theme.textSubtle} />
              </View>
            )}
          </View>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginTop: 6 }} numberOfLines={1}>
            {coll.name}
          </Text>
          <Text style={{ fontSize: 11, color: theme.textSubtle }}>
            {coll.post_count} vidéo{coll.post_count !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <Text style={{ color: theme.textSubtle, textAlign: 'center', marginTop: 40 }}>
          Aucune collection. Sauvegarde des vidéos pour commencer.
        </Text>
      }
    />
  );
}
```

---

## 🆕 FEAT-02 : Brouillons (Drafts locaux)

### Concept TikTok
Sauvegarder un post en cours de création localement avant publication.
Accessible depuis le profil.

### Fichier : `src/screens/upload/UploadScreen.tsx`

### Bouton "Brouillon" :

```typescript
// Dans UploadScreen, ajouter un bouton "Brouillon" à côté de "Publier" :
const handleSaveDraft = async () => {
  try {
    const drafts = JSON.parse(
      await AsyncStorage.getItem('nour_drafts') ?? '[]'
    ) as Draft[];

    const newDraft: Draft = {
      id: Date.now().toString(),
      caption: caption.trim(),
      videoUri: videoUri ?? null,
      thumbnailUri: thumbnailUri ?? null,
      createdAt: new Date().toISOString(),
    };

    drafts.unshift(newDraft); // Ajouter en premier
    await AsyncStorage.setItem('nour_drafts', JSON.stringify(drafts.slice(0, 20))); // Max 20

    showToast({ text: 'Brouillon sauvegardé', type: 'success' });
    nav.goBack();
  } catch {
    showToast({ text: 'Erreur de sauvegarde', type: 'error' });
  }
};

// Dans le row de boutons en bas :
<View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
  <TouchableOpacity
    style={[styles.draftBtn]}
    onPress={handleSaveDraft}
    activeOpacity={0.8}
  >
    <IcDraft size={18} color={COLORS.primary} />
    <Text style={styles.draftBtnText}>Brouillon</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.publishBtn, uploading && styles.publishBtnDisabled]}
    onPress={handlePublish}
    disabled={uploading}
    activeOpacity={0.85}
  >
    {uploading
      ? <ActivityIndicator color="#fff" />
      : <Text style={styles.publishBtnText}>Publier</Text>
    }
  </TouchableOpacity>
</View>
```

### `DraftsScreen.tsx` — nouveau fichier :

```typescript
// src/screens/upload/DraftsScreen.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Alert, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT } from '../../constants/theme';
import { IcTrash, IcEdit } from '../ui/Icons';

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
  const theme = useTheme();
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

  const deleteDraft = async (id: string) => {
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

  const openDraft = (draft: Draft) => {
    nav.navigate('Upload', { draft });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={draftStyles.header}>
        <Text style={[draftStyles.headerTitle, { color: theme.text }]}>Brouillons</Text>
      </View>

      <FlatList
        data={drafts}
        keyExtractor={d => d.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}>
            <IcDraft size={48} color={theme.textSubtle} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: theme.textMuted }}>
              Aucun brouillon
            </Text>
            <Text style={{ fontSize: 13, color: theme.textSubtle }}>
              Tes publications en cours apparaîtront ici.
            </Text>
          </View>
        }
        renderItem={({ item: draft }) => (
          <View style={[draftStyles.card, { backgroundColor: theme.surface }]}>
            {/* Thumbnail */}
            <TouchableOpacity style={draftStyles.thumb} onPress={() => openDraft(draft)}>
              {draft.thumbnailUri ? (
                <Image source={{ uri: draft.thumbnailUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}>
                  <IcPlay size={28} color={theme.textSubtle} />
                </View>
              )}
            </TouchableOpacity>

            {/* Info */}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 13, color: theme.text, lineHeight: 18 }} numberOfLines={2}>
                {draft.caption || 'Aucune description'}
              </Text>
              <Text style={{ fontSize: 11, color: theme.textSubtle }}>
                {new Date(draft.createdAt).toLocaleDateString('fr-FR')}
              </Text>

              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  style={draftStyles.editBtn}
                  onPress={() => openDraft(draft)}
                  activeOpacity={0.7}
                >
                  <IcEdit size={13} color={COLORS.primary} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.primary }}>Continuer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteDraft(draft.id)}
                  activeOpacity={0.7}
                  style={draftStyles.deleteBtn}
                >
                  <IcTrash size={13} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const draftStyles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E8E8EA' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  card: { flexDirection: 'row', gap: 12, borderRadius: 16, overflow: 'hidden', padding: 12 },
  thumb: { width: 70, height: 90, borderRadius: 10, overflow: 'hidden', backgroundColor: '#111' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EBF5EE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  deleteBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', borderRadius: 8 },
});
```

### Accès Drafts depuis ProfileScreen :
```typescript
// Dans le header ProfileScreen, ajouter un bouton "Brouillons" dans le menu (...)
// Ou un bouton dédié dans la grille Vidéos si des brouillons existent :
{draftsCount > 0 && (
  <TouchableOpacity
    style={styles.draftsBadge}
    onPress={() => nav.navigate('Drafts')}
    activeOpacity={0.8}
  >
    <IcDraft size={16} color={COLORS.primary} />
    <Text style={styles.draftsBadgeText}>{draftsCount} brouillon{draftsCount > 1 ? 's' : ''}</Text>
  </TouchableOpacity>
)}
```

---

## 🆕 FEAT-03 : Recherche avancée

### Fichier : `src/screens/search/SearchScreen.tsx`

### État sans recherche (page de découverte) :

```typescript
function DiscoveryView({ onSearch }: { onSearch: (q: string) => void }) {
  const theme = useTheme();
  const nav = useNavigation<any>();

  // Trending hashtags
  const { data: trendingTags } = useQuery({
    queryKey: ['trending-hashtags'],
    queryFn: () => api.get('/posts/hashtags/trending?limit=15').then(r => r.data as { tag: string; count: number }[]),
    staleTime: 10 * 60 * 1000,
  });

  // Comptes suggérés
  const { data: suggestedUsers } = useQuery({
    queryKey: ['suggested-users'],
    queryFn: () => api.get('/users/suggested?limit=5').then(r => r.data as { items: any[] }).catch(() => ({ items: [] })),
  });

  // Historique local
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem('nour_search_history')
      .then(h => setHistory(JSON.parse(h ?? '[]')))
      .catch(() => {});
  }, []);

  const clearHistory = async () => {
    await AsyncStorage.setItem('nour_search_history', '[]');
    setHistory([]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} showsVerticalScrollIndicator={false}>

      {/* Historique */}
      {history.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Récents</Text>
            <TouchableOpacity onPress={clearHistory} activeOpacity={0.7}>
              <Text style={{ fontSize: 13, color: theme.textSubtle }}>Tout effacer</Text>
            </TouchableOpacity>
          </View>
          {history.slice(0, 5).map((q, i) => (
            <TouchableOpacity
              key={i}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
              onPress={() => onSearch(q)}
              activeOpacity={0.7}
            >
              <IcClock size={16} color={theme.textSubtle} />
              <Text style={{ flex: 1, fontSize: 14, color: theme.text }}>{q}</Text>
              <TouchableOpacity onPress={() => {
                const updated = history.filter(h => h !== q);
                setHistory(updated);
                AsyncStorage.setItem('nour_search_history', JSON.stringify(updated));
              }}>
                <IcX size={14} color={theme.textSubtle} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Trending hashtags */}
      {trendingTags && trendingTags.length > 0 && (
        <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 12 }}>
            Hashtags tendance
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {trendingTags.map(({ tag, count }) => (
              <TouchableOpacity
                key={tag}
                style={{
                  backgroundColor: theme.primaryBg,
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderWidth: 1,
                  borderColor: 'rgba(45,122,79,0.2)',
                }}
                onPress={() => nav.navigate('Hashtag', { tag })}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.primary }}>
                  #{tag}
                </Text>
                <Text style={{ fontSize: 10, color: theme.textSubtle, marginTop: 1 }}>
                  {fmt(count)} vidéos
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Comptes suggérés */}
      {suggestedUsers?.items && suggestedUsers.items.length > 0 && (
        <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 12 }}>
            Comptes suggérés
          </Text>
          {suggestedUsers.items.map((user: any) => (
            <View key={user.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
              <Avatar uri={user.avatar_url} name={user.display_name} size={44} onPress={() => nav.navigate('UserProfile', { userId: user.id, username: user.username })} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{user.display_name}</Text>
                <Text style={{ fontSize: 12, color: theme.textSubtle }}>@{user.username} · {fmt(user.follower_count)} abonnés</Text>
              </View>
              <FollowButton userId={user.id} isFollowing={user.is_following} />
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// Sauvegarder dans l'historique après une recherche :
const doSearch = async (query: string) => {
  if (!query.trim()) return;
  setSearchQuery(query);

  // Sauvegarder dans historique
  const history = JSON.parse(await AsyncStorage.getItem('nour_search_history') ?? '[]') as string[];
  const updated = [query, ...history.filter(h => h !== query)].slice(0, 10);
  await AsyncStorage.setItem('nour_search_history', JSON.stringify(updated));
};
```

---

## 🆕 FEAT-04 : Hashtag Screen enrichie

### Fichier : `src/screens/explore/HashtagScreen.tsx`

### Version complète avec follow + sort :

```typescript
export default function HashtagScreen({ route }: { route: any }) {
  const { tag } = route.params as { tag: string };
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const [sort, setSort] = useState<'trending' | 'recent'>('trending');
  const [following, setFollowing] = useState(false);

  // Check si je suis déjà ce hashtag
  const { data: followData } = useQuery({
    queryKey: ['hashtag-follow', tag],
    queryFn: () => api.get(`/hashtags/${tag}/follow-status`).then(r => r.data).catch(() => ({ following: false })),
  });

  useEffect(() => {
    if (followData) setFollowing(followData.following);
  }, [followData]);

  const followMutation = useMutation({
    mutationFn: () => following
      ? api.delete(`/hashtags/${tag}/follow`)
      : api.post(`/hashtags/${tag}/follow`),
    onMutate: () => setFollowing(f => !f),
    onError: () => setFollowing(f => !f),
  });

  const { data: statsData } = useQuery({
    queryKey: ['hashtag-stats', tag],
    queryFn: () => api.get(`/hashtags/${tag}/stats`).then(r => r.data).catch(() => ({ video_count: 0 })),
  });

  const videosQuery = useInfiniteQuery({
    queryKey: ['hashtag-videos', tag, sort],
    queryFn: ({ pageParam }) =>
      api.get(`/posts/hashtag/${tag}`, { params: { cursor: pageParam, limit: 12, sort } })
        .then(r => r.data)
        .catch(() => ({ items: [], next_cursor: null })),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.next_cursor,
  });

  const videos = videosQuery.data?.pages.flatMap(p => p.items) ?? [];
  const THUMB_W = (Dimensions.get('window').width - 4) / 3;
  const THUMB_H = THUMB_W * 1.35;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 16, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => nav.goBack()} style={{ marginBottom: 12 }}>
          <IcChevronLeft size={24} color={theme.text} />
        </TouchableOpacity>

        {/* Hashtag hero */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 28, fontWeight: '900', color: theme.text }}>#{tag}</Text>
            <Text style={{ fontSize: 13, color: theme.textSubtle, marginTop: 3 }}>
              {fmt(statsData?.video_count ?? 0)} vidéo{(statsData?.video_count ?? 0) !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Bouton suivre hashtag */}
          <TouchableOpacity
            style={{
              backgroundColor: following ? theme.surfaceAlt : COLORS.primary,
              borderRadius: 9999,
              paddingHorizontal: 16,
              paddingVertical: 9,
              borderWidth: following ? 1 : 0,
              borderColor: theme.border,
            }}
            onPress={() => followMutation.mutate()}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: following ? theme.text : '#fff' }}>
              {following ? 'Suivi' : 'Suivre'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sort chips */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {(['trending', 'recent'] as const).map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => setSort(s)}
              style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                backgroundColor: sort === s ? theme.primaryBg : theme.surfaceAlt,
                borderWidth: 1,
                borderColor: sort === s ? COLORS.primary : theme.border,
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: sort === s ? COLORS.primary : theme.textMuted }}>
                {s === 'trending' ? 'Tendance' : 'Récents'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Grille 3 colonnes */}
      <FlatList
        data={videos}
        numColumns={3}
        keyExtractor={v => v.id}
        columnWrapperStyle={{ gap: 2 }}
        ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
        onEndReached={() => videosQuery.hasNextPage && !videosQuery.isFetchingNextPage && videosQuery.fetchNextPage()}
        onEndReachedThreshold={2}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{ width: THUMB_W, height: THUMB_H, backgroundColor: '#111' }}
            onPress={() => nav.navigate('VideoPlayer', { postId: item.id })}
            activeOpacity={0.9}
          >
            {item.thumbnail_url ? (
              <Image source={{ uri: item.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : null}
            <View style={{ position: 'absolute', bottom: 5, left: 5, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <IcPlay size={10} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>{fmt(item.view_count)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
```

---

## 🆕 FEAT-05 : View count badge dans le feed

### Fichier : `src/components/video/VideoPlayerItem.tsx`

```typescript
// Ajouter sous le bouton mute, en haut à droite :
<View style={styles.viewCountBadge} pointerEvents="none">
  <IcEye size={11} color="rgba(255,255,255,0.8)" />
  <Text style={styles.viewCountText}>{fmt(post.view_count)}</Text>
</View>

// Style :
viewCountBadge: {
  position: 'absolute',
  top: 54,
  right: 56, // à gauche du bouton mute
  flexDirection: 'row',
  alignItems: 'center',
  gap: 3,
  backgroundColor: 'rgba(0,0,0,0.45)',
  borderRadius: 10,
  paddingHorizontal: 7,
  paddingVertical: 3,
},
viewCountText: {
  fontSize: 11,
  fontWeight: '600',
  color: 'rgba(255,255,255,0.85)',
},
```

---

## 🆕 FEAT-08 : Live — améliorations

### Fichier : `src/screens/live/LiveViewerScreen.tsx`

### A. Hearts qui montent :

```typescript
// Système de hearts flottants
interface FloatingHeart { id: string; x: number }

const [hearts, setHearts] = useState<FloatingHeart[]>([]);

const addHeart = useCallback(() => {
  const id = Date.now().toString();
  const x = Math.random() * 60 + 20; // position aléatoire
  setHearts(prev => [...prev.slice(-15), { id, x }]); // max 15 en même temps
  setTimeout(() => {
    setHearts(prev => prev.filter(h => h.id !== id));
  }, 2500);
}, []);

// Bouton like → addHeart()
// Socket.IO 'live:reaction' → addHeart()

// Composant FloatingHearts :
{hearts.map(heart => (
  <FloatingHeartItem key={heart.id} x={heart.x} />
))}

function FloatingHeartItem({ x }: { x: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }),
      Animated.timing(translateY, { toValue: -200, duration: 2000, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      Animated.sequence([
        Animated.delay(1500),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      bottom: 100,
      right: x,
      transform: [{ translateY }, { scale }],
      opacity,
    }}>
      <IcHeartFill size={28} color="#FF3B5C" />
    </Animated.View>
  );
}
```

### B. Badges viewers animés :

```typescript
// Compteur viewers avec animation +N :
function ViewerCountBadge({ count }: { count: number }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(count);

  useEffect(() => {
    if (count !== prevCount.current) {
      prevCount.current = count;
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
      ]).start();
    }
  }, [count]);

  return (
    <Animated.View style={[liveStyles.viewerBadge, { transform: [{ scale: scaleAnim }] }]}>
      <IcUsers2 size={12} color="#fff" />
      <Text style={liveStyles.viewerText}>{fmt(count)}</Text>
    </Animated.View>
  );
}
```

---

## 🆕 FEAT-10 : Bannière offline

### `src/components/ui/OfflineBanner.tsx` :

```typescript
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = React.useState(false);
  const translateY = useRef(new Animated.Value(-60)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isOffline ? insets.top : -60,
      useNativeDriver: true,
      stiffness: 400,
      damping: 30,
    }).start();
  }, [isOffline]);

  return (
    <Animated.View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9700,
      transform: [{ translateY }],
      backgroundColor: '#EF4444',
      paddingTop: insets.top,
      paddingHorizontal: 16,
      paddingBottom: 10,
    }}>
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
        Pas de connexion internet
      </Text>
    </Animated.View>
  );
}

// Dans App.tsx, ajouter après le NavigationContainer :
<OfflineBanner />
```

---

## 📋 VALIDATION PHASE 4

Sur iPhone physique :

1. **Collections** : sauvegarder une vidéo → picker collections → créer une collection → vidéo dedans → onglet Favoris = grille de dossiers
2. **Brouillons** : commencer un upload → "Brouillon" → retour profil → "Mes brouillons" → reprendre la création
3. **Recherche** : ouvrir SearchScreen → trending hashtags visibles → tapper → HashtagScreen
4. **HashtagScreen** : count vidéos + bouton Suivre + sort Tendance/Récents
5. **View count** : visible en haut des vidéos dans le feed
6. **Live** : hearts montent au tap like + viewer count s'anime
7. **Offline** : désactiver WiFi → bannière rouge en haut

```bash
git add -A && git commit -m "feat: Phase 4 — Collections, Drafts, Search avancée, HashtagFollow, ViewCount, Live amélioré"
git push origin main
```
