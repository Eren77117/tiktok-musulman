import React, { useCallback, useRef } from 'react';
import {
  View, FlatList, StyleSheet, Text, TouchableOpacity, StatusBar, RefreshControl,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { VideoCard } from '../../components/video/VideoCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { IcBell, IcMail, IcBrand } from '../../components/ui/Icons';
import { COLORS, FONT, SPACING } from '../../constants/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Post {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  duration: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  is_liked: boolean;
  user: { id: string; username: string; display_name: string; avatar_url: string | null; is_verified: boolean };
  sound: { id: string; title: string; artist: string | null } | null;
}

interface FeedPage { items: Post[]; next_cursor: string | null }

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const seenIds = useRef<string[]>([]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } =
    useInfiniteQuery({
      queryKey: ['feed'],
      queryFn: ({ pageParam }) =>
        api.get('/posts/feed', {
          params: {
            cursor: pageParam,
            limit: 8,
            seen: seenIds.current.slice(-40).join(','),
          },
        }).then(r => r.data as FeedPage),
      initialPageParam: null as string | null,
      getNextPageParam: last => last.next_cursor,
    });

  const posts = data?.pages.flatMap(p => p.items) ?? [];

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    const ids = viewableItems.map((v: any) => v.item?.id).filter(Boolean);
    ids.forEach((id: string) => {
      if (!seenIds.current.includes(id)) seenIds.current.push(id);
    });
  }, []);

  const renderSkeleton = () => (
    <View style={{ padding: SPACING.md, gap: 16 }}>
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonHeader}>
            <Skeleton width={40} height={40} borderRadius={20} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="50%" height={13} />
              <Skeleton width="30%" height={11} />
            </View>
          </View>
          <Skeleton width="100%" height={220} borderRadius={12} />
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLogo}>
          <IcBrand size={24} color={COLORS.primary} />
          <Text style={styles.logoText}>Nour</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.headerBtn}
            activeOpacity={0.7}
          >
            <IcBell size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Messages')}
            style={styles.headerBtn}
            activeOpacity={0.7}
          >
            <IcMail size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? renderSkeleton() : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          renderItem={({ item }) => (
            <VideoCard
              post={item}
              onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
              onUserPress={() => navigation.navigate('UserProfile', { userId: item.user.id, username: item.user.username })}
            />
          )}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="video"
              title="Aucune vidéo pour l'instant"
              subtitle="Revenez bientôt pour découvrir du contenu"
            />
          }
          ListFooterComponent={isFetchingNextPage ? (
            <View style={styles.footer}><Skeleton width={60} height={4} /></View>
          ) : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  headerLogo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoText: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, color: COLORS.primary },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.md, gap: 16, paddingBottom: 32 },
  footer: { alignItems: 'center', paddingVertical: 20 },
  skeletonCard: { gap: 12 },
  skeletonHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
