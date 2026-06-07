import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '../../constants/theme';
import { IcClose, IcCheck, IcSearch } from '../ui/Icons';

interface Conversation {
  id: string;
  other_user: { id: string; display_name: string; username: string; avatar_url: string | null };
  last_message: { content: string; created_at: string; sender_id: string } | null;
}

interface Post {
  id: string;
  thumbnail_url: string | null;
  caption: string | null;
}

interface Props {
  visible: boolean;
  post: Post | null;
  onClose: () => void;
}

export function SharePostToDMModal({ visible, post, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [sent, setSent] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<{ items: Conversation[] }>({
    queryKey: ['conversations'],
    queryFn: () => api.get('/messages/conversations').then(r => r.data),
    enabled: visible,
  });

  const sendMutation = useMutation({
    mutationFn: ({ conversationId }: { conversationId: string }) =>
      api.post(`/messages/conversations/${conversationId}/messages`, {
        content: '',
        shared_post_id: post?.id,
      }),
    onSuccess: (_, { conversationId }) => {
      setSent(prev => new Set([...prev, conversationId]));
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const conversations = (data?.items ?? []).filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.other_user.display_name.toLowerCase().includes(q) ||
      c.other_user.username.toLowerCase().includes(q)
    );
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Envoyer</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <IcClose size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Post preview */}
          {post && (
            <View style={[styles.postPreview, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {post.thumbnail_url ? (
                <Image source={{ uri: post.thumbnail_url }} style={styles.postThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.postThumb, { backgroundColor: '#222' }]} />
              )}
              <Text style={[styles.postCaption, { color: theme.textMuted }]} numberOfLines={2}>
                {post.caption || 'Vidéo'}
              </Text>
            </View>
          )}

          {/* Search */}
          <View style={[styles.searchRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <IcSearch size={16} color={theme.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Rechercher une conversation…"
              placeholderTextColor={theme.textSubtle}
            />
          </View>

          {/* Conversations list */}
          {isLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ margin: 24 }} />
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={c => c.id}
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: c }) => {
                const isSent = sent.has(c.id);
                const isPending = sendMutation.isPending && sendMutation.variables?.conversationId === c.id;
                return (
                  <TouchableOpacity
                    style={styles.convRow}
                    onPress={() => !isSent && sendMutation.mutate({ conversationId: c.id })}
                    activeOpacity={0.75}
                    disabled={isSent || isPending}
                  >
                    {c.other_user.avatar_url ? (
                      <Image source={{ uri: c.other_user.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 15 }}>
                          {c.other_user.display_name[0]?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.convName, { color: theme.text }]}>{c.other_user.display_name}</Text>
                      <Text style={[styles.convUsername, { color: theme.textMuted }]}>@{c.other_user.username}</Text>
                    </View>
                    <View style={[
                      styles.sendBtn,
                      isSent
                        ? { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }
                        : { backgroundColor: COLORS.primary },
                    ]}>
                      {isPending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : isSent ? (
                        <IcCheck size={14} color={COLORS.primary} strokeWidth={2.5} />
                      ) : (
                        <Text style={styles.sendBtnText}>Envoyer</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: theme.textMuted }]}>
                  {search ? 'Aucune conversation trouvée' : 'Aucune conversation'}
                </Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.md, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '700' },
  postPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.md, borderWidth: 1, padding: 10, marginBottom: 12,
  },
  postThumb: { width: 56, height: 56, borderRadius: RADIUS.sm, overflow: 'hidden' },
  postCaption: { flex: 1, fontSize: FONT.size.sm, lineHeight: 18 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: RADIUS.md, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: FONT.size.sm },
  convRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 4,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  convName: { fontSize: FONT.size.base, fontWeight: '600' },
  convUsername: { fontSize: FONT.size.xs, marginTop: 1 },
  sendBtn: {
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7, minWidth: 72,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { textAlign: 'center', padding: 20, fontSize: FONT.size.sm },
});
