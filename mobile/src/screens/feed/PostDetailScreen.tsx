import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { api } from '../../api/client';
import { COLORS, SPACING } from '../../constants';

type Props = NativeStackScreenProps<RootStackParamList, 'PostDetail'>;

interface Comment {
  id: string;
  content: string;
  like_count: number;
  created_at: string;
  user: { id: string; username: string; display_name: string; avatar_url: string | null };
  _count: { replies: number };
}

export default function PostDetailScreen({ route, navigation }: Props) {
  const { postId } = route.params;
  const [text, setText] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ items: Comment[] }>({
    queryKey: ['comments', postId],
    queryFn: () => api.get(`/comments/post/${postId}`).then((r) => r.data),
  });

  const addMutation = useMutation({
    mutationFn: (content: string) => api.post(`/comments/post/${postId}`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', postId] });
      setText('');
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comments</Text>
        <View style={{ width: 32 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={data?.items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: SPACING.md }}
          renderItem={({ item: c }) => (
            <View style={styles.comment}>
              <View style={styles.commentAvatar}>
                {c.user.avatar_url ? (
                  <Image source={{ uri: c.user.avatar_url }} style={styles.commentAvatarImg} />
                ) : (
                  <View style={[styles.commentAvatarImg, styles.commentAvatarFallback]}>
                    <Text style={styles.fallbackText}>{c.user.display_name[0]?.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <View style={styles.commentBody}>
                <Text style={styles.commentUser}>@{c.user.username}</Text>
                <Text style={styles.commentText}>{c.content}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No comments yet. Be first.</Text>
          }
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Add a comment..."
          placeholderTextColor={COLORS.textSubtle}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={() => text.trim() && addMutation.mutate(text.trim())}
          disabled={!text.trim() || addMutation.isPending}
        >
          <Text style={styles.sendText}>Post</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { fontSize: 24, color: COLORS.text, width: 32 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  comment: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  commentAvatarImg: { width: 36, height: 36 },
  commentAvatarFallback: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  commentBody: { flex: 1, gap: 2 },
  commentUser: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  commentText: { fontSize: 14, color: COLORS.textMuted, lineHeight: 20 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
  inputRow: { flexDirection: 'row', gap: 8, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  input: {
    flex: 1,
    backgroundColor: COLORS.bgInput,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
