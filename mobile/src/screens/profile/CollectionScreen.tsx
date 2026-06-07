import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, FlatList, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { COLORS, FONT, RADIUS, SPACING } from '../../constants/theme';
import { IcBack, IcPlay } from '../../components/ui/Icons';
import { RootStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Collection'>;

interface Post {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  view_count: number;
  like_count: number;
  caption: string;
}

const COL = 3;
const CELL_SIZE = Math.round((Dimensions.get('window').width - 2) / COL);

export default function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { collectionId, name } = route.params;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['collection-posts', collectionId],
    queryFn: ({ pageParam }) =>
      api.get(`/collections/${collectionId}/posts`, { params: { cursor: pageParam, limit: 12 } }).then(r => r.data),
    getNextPageParam: (last: any) => last.next_cursor ?? undefined,
    initialPageParam: undefined,
  });

  const posts: Post[] = data?.pages.flatMap((p: any) => p.items) ?? [];

  const renderItem = useCallback(({ item }: { item: Post }) => {
    const thumb = item.thumbnail_url ?? item.video_url;
    return (
      <TouchableOpacity
        style={styles.cell}
        onPress={() => nav.navigate('VideoPlayer', { postId: item.id })}
        activeOpacity={0.85}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
        <View style={styles.playBadge}>
          <IcPlay size={12} color={COLORS.white} />
          <Text style={styles.viewCount}>
            {item.view_count >= 1000 ? `${(item.view_count / 1000).toFixed(1)}K` : String(item.view_count)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [nav]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <IcBack size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
      ) : posts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTxt}>Aucune vidéo dans cette collection</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          numColumns={COL}
          renderItem={renderItem}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
          ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
          columnWrapperStyle={{ gap: 1 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
  },
  title: { flex: 1, fontSize: FONT.size.lg, fontWeight: '700', color: COLORS.white, textAlign: 'center', marginHorizontal: 8 },
  cell: { width: CELL_SIZE, height: CELL_SIZE, backgroundColor: '#111' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { backgroundColor: COLORS.border },
  playBadge: {
    position: 'absolute', bottom: 4, left: 4,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  viewCount: { fontSize: 11, fontWeight: '600', color: COLORS.white },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { fontSize: FONT.size.md, color: COLORS.textMuted },
});
