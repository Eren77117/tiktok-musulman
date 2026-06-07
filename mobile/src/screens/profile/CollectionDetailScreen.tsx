import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { IcBack, IcTrash, IcGrid } from '../../components/ui/Icons';

type Route = RouteProp<RootStackParamList, 'CollectionDetail'>;

interface Post {
  id: string;
  thumbnail_url: string | null;
  view_count: number;
  like_count: number;
  caption: string | null;
}

const { width } = Dimensions.get('window');
const COLS = 3;
const CELL = (width - 2) / COLS;

export default function CollectionDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { collectionId, name } = route.params;
  const theme = useTheme();
  const qc = useQueryClient();
  const [cursor, setCursor] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadPage = useCallback(async (reset = false) => {
    if (loadingMore && !reset) return;
    setLoadingMore(true);
    try {
      const cur = reset ? null : cursor;
      const res = await api.get(`/collections/${collectionId}/posts`, {
        params: { limit: 12, ...(cur ? { cursor: cur } : {}) },
      });
      const { items, next_cursor } = res.data;
      setPosts(prev => reset ? items : [...prev, ...items]);
      setCursor(next_cursor ?? null);
      setHasMore(!!next_cursor);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
      setInitialLoading(false);
    }
  }, [collectionId, cursor, loadingMore]);

  useFocusEffect(useCallback(() => {
    setPosts([]);
    setCursor(null);
    setHasMore(true);
    setInitialLoading(true);
    loadPage(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const removeSelected = () => {
    Alert.alert(
      'Retirer de la collection',
      `Retirer ${selected.size} vidéo${selected.size > 1 ? 's' : ''} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer', style: 'destructive',
          onPress: async () => {
            await Promise.all(
              [...selected].map(pid =>
                api.delete(`/collections/${collectionId}/posts/${pid}`).catch(() => {}),
              ),
            );
            setPosts(prev => prev.filter(p => !selected.has(p.id)));
            setSelected(new Set());
            setSelectMode(false);
            qc.invalidateQueries({ queryKey: ['collections'] });
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Post }) => {
    const isSel = selected.has(item.id);
    return (
      <TouchableOpacity
        style={styles.cell}
        activeOpacity={0.8}
        onPress={() => {
          if (selectMode) { toggleSelect(item.id); return; }
          navigation.navigate('VideoPlayer', { postId: item.id });
        }}
        onLongPress={() => { setSelectMode(true); toggleSelect(item.id); }}
      >
        {item.thumbnail_url
          ? <Image source={{ uri: item.thumbnail_url }} style={styles.thumb} />
          : <View style={[styles.thumb, { backgroundColor: theme.card }]} />}
        {selectMode && (
          <View style={[styles.selectOverlay, isSel && styles.selectOverlayActive]}>
            {isSel && <View style={styles.checkDot} />}
          </View>
        )}
        {!selectMode && (
          <View style={styles.countBadge}>
            <IcGrid size={10} color="#fff" />
            <Text style={styles.countText}>{item.view_count >= 1000
              ? `${(item.view_count / 1000).toFixed(1)}k`
              : String(item.view_count)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (selectMode) { setSelectMode(false); setSelected(new Set()); }
          else navigation.goBack();
        }} activeOpacity={0.7}>
          <IcBack size={22} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>{posts.length} vidéo{posts.length !== 1 ? 's' : ''}</Text>
        </View>

        {selectMode ? (
          <TouchableOpacity
            style={[styles.deleteBtn, { opacity: selected.size === 0 ? 0.4 : 1 }]}
            onPress={selected.size > 0 ? removeSelected : undefined}
            activeOpacity={0.7}
          >
            <IcTrash size={20} color="#FF3B30" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.selectBtn} onPress={() => setSelectMode(true)} activeOpacity={0.7}>
            <Text style={[styles.selectBtnText, { color: COLORS.primary }]}>Sélectionner</Text>
          </TouchableOpacity>
        )}
      </View>

      {initialLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.center}>
          <IcGrid size={48} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Collection vide</Text>
          <Text style={[styles.emptySub, { color: theme.textMuted }]}>Sauvegarde des vidéos pour les retrouver ici</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          numColumns={COLS}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
          columnWrapperStyle={{ gap: 1 }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => { if (hasMore && !loadingMore) loadPage(); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore && !initialLoading
            ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
            : null}
        />
      )}

      {selectMode && selected.size > 0 && (
        <View style={[styles.selBar, { bottom: insets.bottom + 12, backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.selBarText, { color: theme.text }]}>{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</Text>
          <TouchableOpacity onPress={removeSelected} activeOpacity={0.8}>
            <Text style={styles.selBarAction}>Retirer</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 0.5, gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, letterSpacing: -0.3 },
  headerSub: { fontSize: FONT.size.xs, marginTop: 1 },
  selectBtn: { paddingHorizontal: 4 },
  selectBtnText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  deleteBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, textAlign: 'center' },
  emptySub: { fontSize: FONT.size.sm, textAlign: 'center', lineHeight: 20 },
  cell: { width: CELL, height: CELL, backgroundColor: '#111' },
  thumb: { width: '100%', height: '100%' },
  selectOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'transparent',
    borderWidth: 2.5, borderColor: 'transparent',
  },
  selectOverlayActive: {
    backgroundColor: '#00C26E33',
    borderColor: COLORS.primary,
  },
  checkDot: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: '#fff',
  },
  countBadge: {
    position: 'absolute', bottom: 4, left: 4,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2,
  },
  countText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  selBar: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, padding: 14,
    borderWidth: 0.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  selBarText: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },
  selBarAction: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold, color: '#FF3B30' },
});
