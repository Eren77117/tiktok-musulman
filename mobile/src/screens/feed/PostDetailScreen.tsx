import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation';
import { api } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { Skeleton } from '../../components/ui/Skeleton';
import { IcBack, IcSend, IcComment } from '../../components/ui/Icons';

type Props = NativeStackScreenProps<RootStackParamList, 'PostDetail'>;

interface Comment {
  id: string;
  content: string;
  like_count: number;
  created_at: string;
  user: { id: string; username: string; display_name: string; avatar_url: string | null };
}

function fmtTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'maintenant';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}j`;
}

export default function PostDetailScreen({ route, navigation }: Props) {
  const { postId } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ items: Comment[] }>({
    queryKey: ['comments', postId],
    queryFn: () => api.get(`/comments/post/${postId}`).then(r => r.data),
  });

  const addMutation = useMutation({
    mutationFn: (content: string) => api.post(`/comments/post/${postId}`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', postId] });
      setText('');
    },
  });

  const handleSend = () => {
    if (!text.trim() || addMutation.isPending) return;
    addMutation.mutate(text.trim());
  };

  const comments = data?.items ?? [];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <IcBack size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Commentaires{comments.length > 0 ? ` (${comments.length})` : ''}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.skeletonList}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={36} height={36} borderRadius={18} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width={100} height={12} borderRadius={6} />
                <Skeleton width="80%" height={14} borderRadius={7} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={c => c.id}
          contentContainerStyle={[styles.list, { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: c }) => (
            <View style={styles.comment}>
              <View style={styles.commentAvatar}>
                {c.user.avatar_url ? (
                  <Image source={{ uri: c.user.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarImg, { backgroundColor: theme.primaryBg, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={[styles.avatarInitial, { color: theme.primary }]}>{c.user.display_name[0]?.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <View style={styles.commentBody}>
                <View style={[styles.commentBubble, { backgroundColor: theme.card, borderColor: theme.borderLight }]}>
                  <Text style={[styles.commentUser, { color: theme.primary }]}>@{c.user.username}</Text>
                  <Text style={[styles.commentText, { color: theme.text }]}>{c.content}</Text>
                </View>
                <Text style={[styles.commentTime, { color: theme.textSubtle }]}>{fmtTime(c.created_at)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <IcComment size={40} color={theme.textSubtle} strokeWidth={1.5} />
              <Text style={[styles.emptyText, { color: theme.text }]}>Aucun commentaire</Text>
              <Text style={[styles.emptySubText, { color: theme.textMuted }]}>Soyez le premier à commenter !</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8, backgroundColor: theme.surface, borderTopColor: theme.borderLight }]}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
          value={text}
          onChangeText={setText}
          placeholder="Ajouter un commentaire..."
          placeholderTextColor={theme.textPlaceholder}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: COLORS.primary }, (!text.trim() || addMutation.isPending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || addMutation.isPending}
          activeOpacity={0.8}
        >
          {addMutation.isPending
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <IcSend size={18} color={COLORS.white} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold },
  skeletonList: { padding: SPACING.md, gap: 18 },
  skeletonRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  list: { padding: SPACING.md, gap: 14 },

  comment: { flexDirection: 'row', gap: 10 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', flexShrink: 0 },
  avatarImg: { width: 36, height: 36 },
  avatarInitial: { fontSize: 14, fontWeight: FONT.weight.bold },
  commentBody: { flex: 1, gap: 4 },
  commentBubble: {
    borderRadius: RADIUS.md, padding: 10, borderWidth: 1,
  },
  commentUser: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold, marginBottom: 2 },
  commentText: { fontSize: FONT.size.sm, lineHeight: 20 },
  commentTime: { fontSize: FONT.size.xs },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: FONT.size.base, fontWeight: FONT.weight.medium },
  emptySubText: { fontSize: FONT.size.sm },

  inputRow: {
    flexDirection: 'row', gap: 8, padding: SPACING.md, paddingTop: 10,
    borderTopWidth: 1, alignItems: 'flex-end',
  },
  input: {
    flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: FONT.size.sm, maxHeight: 100, borderWidth: 1,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
