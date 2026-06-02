import React, { useRef, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, ViewToken, StatusBar,
  Dimensions, ActivityIndicator, Text,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { VideoPost } from '../../components/video/VideoPost';
import { COLORS } from '../../constants';

const { height: SCREEN_H } = Dimensions.get('window');

interface Post {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  duration: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
  sound: { id: string; title: string; artist: string | null } | null;
}

interface FeedPage {
  items: Post[];
  next_cursor: string | null;
}

async function fetchFeed({ pageParam }: { pageParam: string | null }): Promise<FeedPage> {
  const { data } = await api.get('/posts/feed', {
    params: { cursor: pageParam, limit: 5 },
  });
  return data;
}

export default function FeedScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 80 });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: fetchFeed,
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });

  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]) setActiveIndex(viewableItems[0].index ?? 0);
    },
    [],
  );

  const onEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!posts.length) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: COLORS.textMuted }}>No videos yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <VideoPost post={item} isActive={index === activeIndex} />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_H}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        removeClippedSubviews
        getItemLayout={(_, index) => ({
          length: SCREEN_H,
          offset: SCREEN_H * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
});
