import React from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { IcBack, IcPlay } from '../../components/ui/Icons';

type Route = RouteProp<RootStackParamList, 'SeriesDetail'>;

interface Episode {
  id: string;
  episode_num: number;
  post: {
    id: string;
    thumbnail_url: string | null;
    caption: string | null;
    duration: number;
    view_count: number;
    like_count: number;
    user: { id: string; username: string; display_name: string; avatar_url: string | null };
  };
}

interface SeriesData {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  episode_count: number;
  episodes: Episode[];
  user: { id: string; username: string; display_name: string; avatar_url: string | null };
}

const { width } = Dimensions.get('window');
const THUMB_W = 120;
const THUMB_H = 90;

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function SeriesDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { seriesId } = route.params;
  const theme = useTheme();

  const { data: series, isLoading } = useQuery<SeriesData>({
    queryKey: ['series', seriesId],
    queryFn: () => api.get(`/series/${seriesId}`).then(r => r.data),
    staleTime: 60_000,
  });

  const renderEpisode = ({ item }: { item: Episode }) => (
    <TouchableOpacity
      style={[styles.episodeRow, { borderBottomColor: theme.border }]}
      activeOpacity={0.75}
      onPress={() => navigation.navigate('VideoPlayer', { postId: item.post.id })}
    >
      {/* Thumbnail */}
      <View style={styles.thumbWrap}>
        {item.post.thumbnail_url
          ? <Image source={{ uri: item.post.thumbnail_url }} style={styles.thumb} />
          : <View style={[styles.thumb, { backgroundColor: theme.card }]} />}
        <View style={styles.playOverlay}>
          <IcPlay size={20} color="#fff" />
        </View>
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{fmtDuration(item.post.duration)}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.episodeInfo}>
        <View style={styles.epNumRow}>
          <View style={[styles.epNumBadge, { backgroundColor: `${COLORS.primary}22` }]}>
            <Text style={[styles.epNum, { color: COLORS.primary }]}>Ep. {item.episode_num}</Text>
          </View>
        </View>
        <Text style={[styles.epCaption, { color: theme.text }]} numberOfLines={2}>
          {item.post.caption ?? `Épisode ${item.episode_num}`}
        </Text>
        <Text style={[styles.epMeta, { color: theme.textMuted }]}>
          {fmtViews(item.post.view_count)} vues · {fmtDuration(item.post.duration)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <IcBack size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Série</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : !series ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Série introuvable</Text>
        </View>
      ) : (
        <FlatList
          data={series.episodes}
          keyExtractor={ep => ep.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={[styles.seriesHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
              {/* Banner */}
              {series.thumbnail_url ? (
                <Image source={{ uri: series.thumbnail_url }} style={styles.banner} />
              ) : (
                <View style={[styles.banner, styles.bannerPlaceholder]}>
                  <IcPlay size={40} color={COLORS.primary} />
                </View>
              )}
              <View style={styles.seriesMeta}>
                <Text style={[styles.seriesTitle, { color: theme.text }]}>{series.title}</Text>
                {series.description ? (
                  <Text style={[styles.seriesDesc, { color: theme.textMuted }]}>{series.description}</Text>
                ) : null}
                <View style={styles.seriesStats}>
                  <View style={[styles.statChip, { backgroundColor: `${COLORS.primary}18` }]}>
                    <Text style={[styles.statText, { color: COLORS.primary }]}>
                      {series.episode_count} épisode{series.episode_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              </View>
              {series.episodes.length > 0 && (
                <TouchableOpacity
                  style={[styles.watchAllBtn, { backgroundColor: COLORS.primary }]}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('VideoPlayer', { postId: series.episodes[0].post.id })}
                >
                  <IcPlay size={16} color="#fff" />
                  <Text style={styles.watchAllText}>Regarder depuis le début</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={renderEpisode}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucun épisode</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>Les épisodes apparaîtront ici</Text>
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
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 },
  emptyTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, textAlign: 'center' },
  emptySub: { fontSize: FONT.size.sm, textAlign: 'center' },

  seriesHeader: { borderBottomWidth: 0.5, paddingBottom: 16 },
  banner: { width: '100%', height: 200 },
  bannerPlaceholder: { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  seriesMeta: { padding: SPACING.md, gap: 6 },
  seriesTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, lineHeight: 28 },
  seriesDesc: { fontSize: FONT.size.sm, lineHeight: 20 },
  seriesStats: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  watchAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: SPACING.md, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 20, justifyContent: 'center',
  },
  watchAllText: { color: '#fff', fontWeight: FONT.weight.bold, fontSize: FONT.size.base },

  episodeRow: {
    flexDirection: 'row', gap: 14,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  thumbWrap: { position: 'relative', borderRadius: 10, overflow: 'hidden' },
  thumb: { width: THUMB_W, height: THUMB_H, borderRadius: 10 },
  playOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  durationBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  durationText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  episodeInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  epNumRow: { flexDirection: 'row' },
  epNumBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  epNum: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold },
  epCaption: { fontSize: FONT.size.base, fontWeight: FONT.weight.medium, lineHeight: 20 },
  epMeta: { fontSize: FONT.size.xs },
});
