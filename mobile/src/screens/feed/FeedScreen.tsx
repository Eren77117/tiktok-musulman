import React, { useState, useCallback, useRef } from 'react';
import {
  View, FlatList, StyleSheet, Text, TouchableOpacity,
  StatusBar, Dimensions, ViewToken,
} from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { VideoPlayerItem, FeedPost } from '../../components/video/VideoPlayerItem';
import { CommentsBottomSheet } from '../../components/video/CommentsBottomSheet';
import { COLORS, FONT } from '../../constants/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const { height: H } = Dimensions.get('window');

type FeedTab = 'pourtoi' | 'fils';

interface ThreadItem {
  id: string;
  content: string;
  like_count: number;
  reply_count: number;
  repost_count: number;
  is_liked: boolean;
  created_at: string;
  user: { id: string; username: string; display_name: string; avatar_url: string | null; is_verified: boolean };
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const isFocused = useIsFocused();
  const [tab, setTab] = useState<FeedTab>('pourtoi');
  const [visibleId, setVisibleId] = useState<string | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

  // Pause all videos when leaving this screen
  const effectiveVisibleId = isFocused && tab === 'pourtoi' ? visibleId : null;
  const seenIds = useRef<string[]>([]);

  // ── Pour Toi (video feed) ────────────────────────────────────────────────────
  const {
    data: feedData, fetchNextPage: fetchNextFeed,
    hasNextPage: hasNextFeed, isFetchingNextPage: fetchingFeed,
    isLoading: loadingFeed, refetch: refetchFeed, isRefetching: refreshingFeed,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) =>
      api.get('/posts/feed', {
        params: { cursor: pageParam, limit: 5, seen: seenIds.current.slice(-20).join(',') },
      }).then(r => r.data as { items: FeedPost[]; next_cursor: string | null }),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.next_cursor,
  });

  // ── Fils (threads) ───────────────────────────────────────────────────────────
  const {
    data: threadsData, fetchNextPage: fetchNextThreads,
    hasNextPage: hasNextThreads, isFetchingNextPage: fetchingThreads,
    isLoading: loadingThreads, refetch: refetchThreads,
  } = useInfiniteQuery({
    queryKey: ['threads'],
    queryFn: ({ pageParam }) =>
      api.get('/threads', { params: { cursor: pageParam, limit: 15 } })
        .then(r => r.data as { items: ThreadItem[]; next_cursor: string | null })
        .catch(() => ({ items: [], next_cursor: null })),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.next_cursor,
  });

  const posts  = feedData?.pages.flatMap(p => p.items) ?? [];
  const threads = threadsData?.pages.flatMap(p => p.items) ?? [];

  // Auto-set first visible video when feed loads
  React.useEffect(() => {
    if (posts.length > 0 && visibleId === null) {
      setVisibleId(posts[0].id);
    }
  }, [posts.length]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const id = viewableItems[0].item?.id;
        setVisibleId(id ?? null);
        if (id && !seenIds.current.includes(id)) seenIds.current.push(id);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  });

  // Tap "Pour toi" again while already on it → refresh feed
  const handlePourToiPress = useCallback(() => {
    if (tab === 'pourtoi') {
      seenIds.current = [];
      refetchFeed();
    } else {
      setTab('pourtoi');
    }
  }, [tab, refetchFeed]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header overlay — tabs only, no side buttons */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.tabs}>
          <TouchableOpacity onPress={handlePourToiPress} style={styles.tabBtn} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === 'pourtoi' && styles.tabTextActive]}>Pour toi</Text>
            {tab === 'pourtoi' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('fils')} style={styles.tabBtn} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === 'fils' && styles.tabTextActive]}>Fils</Text>
            {tab === 'fils' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── POUR TOI — fullscreen video feed ── */}
      {tab === 'pourtoi' && (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          renderItem={({ item }) => (
            <VideoPlayerItem
              post={item}
              isVisible={effectiveVisibleId === item.id}
              onComment={() => setCommentsPostId(item.id)}
            />
          )}
          pagingEnabled
          snapToInterval={H}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig.current}
          onEndReached={() => hasNextFeed && !fetchingFeed && fetchNextFeed()}
          onEndReachedThreshold={0.5}
          getItemLayout={(_, index) => ({ length: H, offset: H * index, index })}
          ListEmptyComponent={
            !loadingFeed ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>Aucune vidéo pour l'instant</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Comments bottom sheet */}
      <CommentsBottomSheet postId={commentsPostId} onClose={() => setCommentsPostId(null)} />

      {/* ── FILS — text threads ── */}
      {tab === 'fils' && (
        <FilsFeed
          threads={threads}
          loading={loadingThreads}
          onLoadMore={() => hasNextThreads && !fetchingThreads && fetchNextThreads()}
          onRefresh={refetchThreads}
          onUserPress={(userId, username) => nav.navigate('UserProfile', { userId, username })}
          onThreadPress={(id) => nav.navigate('ThreadDetail', { threadId: id })}
          insets={insets}
        />
      )}
    </View>
  );
}

// ── Fils sub-component ──────────────────────────────────────────────────────────
import {
  ScrollView, RefreshControl, Alert, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { IcHeartFill, IcHeart, IcComment, IcShare, IcClose, IcPlus } from '../../components/ui/Icons';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';

function fmtTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}j`;
}

function FilsFeed({
  threads, loading, onLoadMore, onRefresh, onUserPress, onThreadPress, insets,
}: {
  threads: ThreadItem[];
  loading: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  onUserPress: (id: string, username: string) => void;
  onThreadPress: (id: string) => void;
  insets: { top: number; bottom: number };
}) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const theme = useTheme();
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const postMutation = useMutation({
    mutationFn: (content: string) => api.post('/threads', { content }),
    onSuccess: () => { setText(''); setComposing(false); qc.invalidateQueries({ queryKey: ['threads'] }); },
    onError: () => Alert.alert('Erreur', 'Impossible de publier.'),
  });

  const handleRefresh = async () => { setRefreshing(true); await onRefresh(); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {composing ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[{
            backgroundColor: theme.surface, padding: SPACING.md,
            borderBottomWidth: 1, borderBottomColor: theme.borderLight,
            paddingTop: insets.top + 56,
          }]}>
            <TextInput
              style={[{
                minHeight: 60, fontSize: FONT.size.base, textAlignVertical: 'top',
                paddingTop: 4, color: theme.text,
              }]}
              value={text}
              onChangeText={setText}
              placeholder="Quoi de nouveau ?"
              placeholderTextColor={theme.textSubtle}
              multiline
              maxLength={280}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <TouchableOpacity onPress={() => { setText(''); setComposing(false); }} style={{ padding: 8 }}>
                <IcClose size={20} color={theme.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 20, paddingVertical: 8 }, !text.trim() && { opacity: 0.4 }]}
                onPress={() => text.trim() && postMutation.mutate(text.trim())}
                disabled={!text.trim() || postMutation.isPending}
              >
                <Text style={{ color: COLORS.white, fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold }}>Publier</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <TouchableOpacity
          style={[{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: theme.surface, padding: SPACING.md,
            borderBottomWidth: 1, borderBottomColor: theme.borderLight,
            marginTop: insets.top + 56,
          }]}
          onPress={() => setComposing(true)}
          activeOpacity={0.8}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: FONT.weight.bold, color: COLORS.primary }}>
              {user?.display_name?.[0]?.toUpperCase() ?? 'U'}
            </Text>
          </View>
          <Text style={{ flex: 1, fontSize: FONT.size.base, color: theme.textSubtle }}>Quoi de nouveau ?</Text>
          <Text style={{ fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.primary, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 6 }}>
            Publier
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={threads}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        renderItem={({ item: t }) => (
          <ThreadCard item={t} onUserPress={() => onUserPress(t.user.id, t.user.username)} onPress={() => onThreadPress(t.id)} theme={theme} />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 6 }}>
              <Text style={{ fontSize: FONT.size.base, fontWeight: FONT.weight.medium, color: theme.text }}>Aucun fil pour l'instant.</Text>
              <Text style={{ fontSize: FONT.size.sm, color: theme.textMuted }}>Écris le premier !</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

function ThreadCard({ item, onUserPress, onPress, theme }: { item: ThreadItem; onUserPress: () => void; onPress: () => void; theme: any }) {
  const [liked, setLiked] = useState(item.is_liked);
  const [likeCount, setLikeCount] = useState(item.like_count);

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/threads/${item.id}/like`),
    onMutate: () => { const was = liked; setLiked(l => !l); setLikeCount(c => was ? c - 1 : c + 1); },
    onError: () => { setLiked(item.is_liked); setLikeCount(item.like_count); },
  });

  return (
    <View style={{
      flexDirection: 'row', gap: 10,
      backgroundColor: theme.surface,
      paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: 4,
      borderBottomWidth: 1, borderBottomColor: theme.borderLight,
    }}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <TouchableOpacity onPress={onUserPress}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: FONT.weight.bold, color: COLORS.primary }}>
              {item.user.display_name[0]?.toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={{ width: 1.5, flex: 1, backgroundColor: theme.borderLight, minHeight: 20 }} />
      </View>
      <View style={{ flex: 1, paddingBottom: SPACING.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <TouchableOpacity onPress={onUserPress}>
            <Text style={{ fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: theme.text }}>{item.user.display_name}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: FONT.size.xs, color: theme.textSubtle }}>{fmtTime(item.created_at)}</Text>
        </View>
        <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
          <Text style={{ fontSize: FONT.size.base, color: theme.text, lineHeight: 22 }}>{item.content}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: 8 }}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => likeMutation.mutate()} activeOpacity={0.7}>
            {liked ? <IcHeartFill size={18} color="#FF3B5C" /> : <IcHeart size={18} color={theme.textMuted} />}
            {likeCount > 0 && <Text style={[{ fontSize: FONT.size.xs, color: theme.textMuted }, liked && { color: '#FF3B5C' }]}>{likeCount}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} activeOpacity={0.7}>
            <IcComment size={18} color={theme.textMuted} />
            {item.reply_count > 0 && <Text style={{ fontSize: FONT.size.xs, color: theme.textMuted }}>{item.reply_count}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} activeOpacity={0.7}>
            <IcShare size={18} color={theme.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    alignItems: 'center', paddingBottom: 10,
    zIndex: 10,
  },
  tabs: { flexDirection: 'row', gap: 24 },
  tabBtn: { alignItems: 'center', paddingBottom: 4 },
  tabText: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold, color: 'rgba(255,255,255,0.6)' },
  tabTextActive: { color: COLORS.white },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: COLORS.white, borderRadius: 1 },
  emptyWrap: { height: H, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: COLORS.white, fontSize: FONT.size.base },
});

