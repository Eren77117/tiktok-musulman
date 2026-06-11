import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation';
import { api } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { IcBack, IcHash, IcPlay, IcFollowing, IcFollow } from '../../components/ui/Icons';

const { width: W } = Dimensions.get('window');
type Props = NativeStackScreenProps<RootStackParamList, 'Hashtag'>;
type Sort = 'trending' | 'recent';

interface Post { id: string; thumbnail_url: string | null; view_count: number }

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export default function HashtagScreen({ route, navigation }: Props) {
  const { tag } = route.params;
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [sort, setSort] = useState<Sort>('trending');
  const [following, setFollowing] = useState(false);

  const { data: followData } = useQuery({
    queryKey: ['hashtag-follow', tag],
    queryFn: () => api.get(`/hashtags/${tag}/follow-status`).then(r => r.data).catch(() => ({ following: false })),
  });

  useEffect(() => { if (followData) setFollowing(followData.following); }, [followData]);

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

  const { data, isLoading } = useQuery<{ items: Post[]; total: number }>({
    queryKey: ['hashtag', tag, sort],
    queryFn: () =>
      api.get(`/posts/hashtag/${tag}`, { params: { sort } })
        .then(r => r.data)
        .catch(() => ({ items: [], total: 0 })),
  });

  const posts = data?.items ?? [];
  const CELL = (W - 2) / 3;
  const videoCount = statsData?.video_count ?? data?.total ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.borderLight, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <IcBack size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.hashIconWrap}>
            <IcHash size={20} color={COLORS.primary} />
          </View>
          <View>
            <Text style={[styles.tag, { color: theme.text }]}>#{tag}</Text>
            <Text style={[styles.tagCount, { color: theme.textMuted }]}>{fmt(videoCount)} vidéo{videoCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* Follow button */}
        <TouchableOpacity
          style={[
            styles.followBtn,
            following
              ? { backgroundColor: theme.card }
              : { backgroundColor: COLORS.primary },
          ]}
          onPress={() => followMutation.mutate()}
          activeOpacity={0.8}
        >
          {following
            ? <IcFollowing size={14} color={theme.text} />
            : <IcFollow size={14} color={COLORS.white} />
          }
          <Text style={[styles.followBtnText, { color: following ? theme.text : COLORS.white }]}>
            {following ? 'Suivi' : 'Suivre'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sort chips */}
      <View style={[styles.sortBar, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
        {(['trending', 'recent'] as Sort[]).map(s => (
          <TouchableOpacity
            key={s}
            onPress={() => setSort(s)}
            style={[
              styles.chip,
              sort === s
                ? { backgroundColor: COLORS.primaryBg }
                : { backgroundColor: theme.card },
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, { color: sort === s ? COLORS.primary : theme.textMuted }]}>
              {s === 'trending' ? 'Tendance' : 'Récents'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          numColumns={3}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.cell, { width: CELL, height: CELL * 16 / 9 }]}
              onPress={() => navigation.navigate('VideoPlayer', { postId: item.id })}
              activeOpacity={0.85}
            >
              {item.thumbnail_url ? (
                <Image source={{ uri: item.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.card }]} />
              )}
              <View style={styles.viewsOverlay}>
                <IcPlay size={10} color="#fff" />
                <Text style={styles.viewsText}>{fmt(item.view_count)}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>Aucune vidéo pour #{tag}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 12, borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  hashIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  tag: { fontSize: 16, fontWeight: '700' },
  tagCount: { fontSize: 11, marginTop: 1 },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 8,
  },
  followBtnText: { fontSize: 13, fontWeight: '700' },
  sortBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1,
  },
  chip: { borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { gap: 1 },
  cell: { position: 'relative', margin: 0.5, backgroundColor: '#111', overflow: 'hidden' },
  viewsOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    padding: 4, backgroundColor: 'rgba(0,0,0,0.4)',
  },
  viewsText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: FONT.size.base },
});
