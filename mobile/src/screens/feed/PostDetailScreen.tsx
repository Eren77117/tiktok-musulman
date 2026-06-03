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
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { IcBack, IcSend, IcHeartFill, IcHeart } from '../../components/ui/Icons';

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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <IcBack size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commentaires</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={data?.items}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: c }) => (
            <View style={styles.comment}>
              <View style={styles.commentAvatar}>
                {c.user.avatar_url ? (
                  <Image source={{ uri: c.user.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarImg, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{c.user.display_name[0]?.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <View style={styles.commentBody}>
                <View style={styles.commentBubble}>
                  <Text style={styles.commentUser}>@{c.user.username}</Text>
                  <Text style={styles.commentText}>{c.content}</Text>
                </View>
                <Text style={styles.commentTime}>{fmtTime(c.created_at)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Aucun commentaire pour l'instant.</Text>
              <Text style={styles.emptySubText}>Soyez le premier à commenter !</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Ajouter un commentaire..."
          placeholderTextColor={COLORS.textPlaceholder}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || addMutation.isPending) && styles.sendBtnDisabled]}
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, color: COLORS.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.md, gap: 14, flexGrow: 1 },

  comment: { flexDirection: 'row', gap: 10 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', flexShrink: 0 },
  avatarImg: { width: 36, height: 36 },
  avatarFallback: { backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 14, fontWeight: FONT.weight.bold, color: COLORS.primary },
  commentBody: { flex: 1, gap: 4 },
  commentBubble: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: 10, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  commentUser: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold, color: COLORS.primary, marginBottom: 2 },
  commentText: { fontSize: FONT.size.sm, color: COLORS.text, lineHeight: 20 },
  commentTime: { fontSize: FONT.size.xs, color: COLORS.textSubtle },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 6 },
  emptyText: { fontSize: FONT.size.base, fontWeight: FONT.weight.medium, color: COLORS.text },
  emptySubText: { fontSize: FONT.size.sm, color: COLORS.textMuted },

  inputRow: {
    flexDirection: 'row', gap: 8, padding: SPACING.md, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.white, alignItems: 'flex-end',
  },
  input: {
    flex: 1, backgroundColor: COLORS.inputBg,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    color: COLORS.text, fontSize: FONT.size.sm,
    maxHeight: 100, borderWidth: 1, borderColor: COLORS.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
