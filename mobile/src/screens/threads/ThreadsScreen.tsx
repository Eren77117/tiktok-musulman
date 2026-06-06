import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { RootStackParamList } from '../../navigation';
import { Avatar } from '../../components/ui/Avatar';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { IcHeart, IcHeartFill, IcComment, IcShare, IcClose, IcPlus, IcEdit } from '../../components/ui/Icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Thread {
  id: string;
  content: string;
  like_count: number;
  reply_count: number;
  repost_count: number;
  is_liked: boolean;
  created_at: string;
  user: { id: string; username: string; display_name: string; avatar_url: string | null; is_verified: boolean };
}

interface ThreadsPage { items: Thread[]; next_cursor: string | null }

function fmtTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'maintenant';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}j`;
}

function ThreadItem({ item, onUserPress }: { item: Thread; onUserPress: () => void }) {
  const theme = useTheme();
  const [liked, setLiked] = useState(item.is_liked);
  const [likeCount, setLikeCount] = useState(item.like_count);

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/threads/${item.id}/like`),
    onMutate: () => {
      const wasLiked = liked;
      setLiked(!wasLiked);
      setLikeCount((c) => (wasLiked ? c - 1 : c + 1));
    },
    onError: () => {
      setLiked(item.is_liked);
      setLikeCount(item.like_count);
    },
  });

  return (
    <View style={[styles.threadCard, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
      <View style={styles.threadLeft}>
        <TouchableOpacity onPress={onUserPress} activeOpacity={0.8}>
          <Avatar uri={item.user.avatar_url} name={item.user.display_name} size={40} verified={item.user.is_verified} />
        </TouchableOpacity>
        <View style={[styles.threadLine, { backgroundColor: theme.borderLight }]} />
      </View>

      <View style={styles.threadRight}>
        <View style={styles.threadMeta}>
          <TouchableOpacity onPress={onUserPress} activeOpacity={0.8}>
            <Text style={[styles.threadName, { color: theme.text }]}>{item.user.display_name}</Text>
          </TouchableOpacity>
          <Text style={[styles.threadUsername, { color: theme.textMuted }]}>@{item.user.username}</Text>
          <Text style={[styles.threadDot, { color: theme.textSubtle }]}>·</Text>
          <Text style={[styles.threadTime, { color: theme.textSubtle }]}>{fmtTime(item.created_at)}</Text>
        </View>

        <Text style={[styles.threadContent, { color: theme.text }]}>{item.content}</Text>

        <View style={styles.threadActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => likeMutation.mutate()} activeOpacity={0.7}>
            {liked ? <IcHeartFill size={18} /> : <IcHeart size={18} color={theme.textMuted} />}
            {likeCount > 0 && (
              <Text style={[styles.actionCount, { color: liked ? COLORS.like : theme.textMuted }]}>{likeCount}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <IcComment size={18} color={theme.textMuted} />
            {item.reply_count > 0 && <Text style={[styles.actionCount, { color: theme.textMuted }]}>{item.reply_count}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <IcShare size={18} color={theme.textMuted} />
            {item.repost_count > 0 && <Text style={[styles.actionCount, { color: theme.textMuted }]}>{item.repost_count}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function ThreadsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [compose, setCompose] = useState('');
  const [composing, setComposing] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } =
    useInfiniteQuery({
      queryKey: ['threads'],
      queryFn: ({ pageParam }) =>
        api.get('/threads', { params: { cursor: pageParam, limit: 15 } })
          .then((r) => r.data as ThreadsPage)
          .catch(() => ({ items: [], next_cursor: null } as ThreadsPage)),
      initialPageParam: null as string | null,
      getNextPageParam: (last) => last.next_cursor,
    });

  const threads = data?.pages.flatMap((p) => p.items) ?? [];

  const postMutation = useMutation({
    mutationFn: (content: string) => api.post('/threads', { content }),
    onSuccess: () => {
      setCompose('');
      setComposing(false);
      qc.invalidateQueries({ queryKey: ['threads'] });
    },
    onError: () => Alert.alert('Erreur', 'Impossible de publier ce fil.'),
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Fils</Text>
        <TouchableOpacity
          style={[styles.composeBtn, { backgroundColor: theme.primaryBg ?? COLORS.primaryBg }]}
          onPress={() => setComposing((v) => !v)}
          activeOpacity={0.8}
        >
          {composing ? <IcClose size={16} color={COLORS.primary} /> : <IcPlus size={16} color={COLORS.primary} />}
        </TouchableOpacity>
      </View>

      {/* Compose box */}
      {composing && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.composeBox, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
            <Avatar uri={user?.avatar_url ?? null} name={user?.display_name ?? 'U'} size={36} />
            <TextInput
              style={[styles.composeInput, { color: theme.text }]}
              value={compose}
              onChangeText={setCompose}
              placeholder="Quoi de nouveau ?"
              placeholderTextColor={theme.textSubtle}
              multiline
              maxLength={280}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.postBtn, (!compose.trim() || postMutation.isPending) && styles.postBtnDisabled]}
              onPress={() => compose.trim() && postMutation.mutate(compose.trim())}
              disabled={!compose.trim() || postMutation.isPending}
              activeOpacity={0.8}
            >
              <Text style={styles.postBtnText}>Publier</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Feed */}
      <FlatList
        data={threads}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ThreadItem
            item={item}
            onUserPress={() =>
              navigation.navigate('UserProfile', { userId: item.user.id, username: item.user.username })
            }
          />
        )}
        onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconWrap, { backgroundColor: COLORS.primaryBg }]}>
                <IcEdit size={28} color={COLORS.primary} strokeWidth={1.5} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucun fil pour l'instant</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>Soyez le premier à publier !</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => setComposing(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBtnText}>Écrire un fil</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold },
  composeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },

  composeBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: SPACING.md,
    borderBottomWidth: 1,
  },
  composeInput: {
    flex: 1, fontSize: FONT.size.base,
    minHeight: 60, textAlignVertical: 'top',
    paddingTop: 2,
  },
  postBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-end',
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.white },

  listContent: { paddingBottom: 32 },

  threadCard: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: 4,
    borderBottomWidth: 1,
  },
  threadLeft: { alignItems: 'center', gap: 4 },
  threadLine: { width: 1.5, flex: 1, minHeight: 20, marginTop: 4 },
  threadRight: { flex: 1, paddingBottom: SPACING.sm },

  threadMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 4 },
  threadName: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  threadUsername: { fontSize: FONT.size.xs },
  threadDot: { fontSize: FONT.size.xs },
  threadTime: { fontSize: FONT.size.xs },

  threadContent: { fontSize: FONT.size.base, lineHeight: 22, marginBottom: SPACING.sm },

  threadActions: { flexDirection: 'row', gap: SPACING.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  actionCount: { fontSize: FONT.size.xs },

  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold },
  emptySubtitle: { fontSize: FONT.size.sm },
  emptyBtn: {
    marginTop: SPACING.md, backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full, paddingHorizontal: 24, paddingVertical: 10,
  },
  emptyBtnText: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold, color: COLORS.white },
});
