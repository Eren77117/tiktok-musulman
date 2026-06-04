import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, Dimensions, ActionSheetIOS, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../api/client';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { IcBack, IcFollow, IcFollowing, IcMail, IcHeart, IcPlay, IcCheck, IcMore } from '../../components/ui/Icons';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  is_following: boolean;
  follower_count: number;
  following_count: number;
  post_count: number;
  gender: 'MALE' | 'FEMALE';
}

interface Post {
  id: string;
  thumbnail_url: string | null;
  video_url?: string;
  view_count: number;
  like_count: number;
  caption: string | null;
}

function getThumbUrl(post: Pick<Post, 'thumbnail_url' | 'video_url'>): string | null {
  if (post.thumbnail_url) return post.thumbnail_url;
  const v = post.video_url;
  if (v?.includes('cloudinary.com')) {
    return v
      .replace('/video/upload/', '/video/upload/so_0,w_600,h_1066,c_fill,q_auto,f_jpg/')
      .replace(/\.(mp4|mov|avi|webm|mkv)$/i, '.jpg');
  }
  return null;
}

const { width: W } = Dimensions.get('window');
const CELL = (W - 2) / 3;

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n ?? 0);
}

export default function UserProfileScreen({ route, navigation }: Props) {
  const { username, userId } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const theme = useTheme();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['profile', username],
    queryFn: () => api.get(`/users/${username}`).then(r => r.data),
    refetchOnWindowFocus: true,
  });

  const { data: postsData, isLoading: postsLoading } = useQuery<{ items: Post[] }>({
    queryKey: ['user-posts-public', userId || profile?.id],
    queryFn: () => api.get(`/posts/user/${userId || profile?.id}`).then(r => r.data).catch(() => ({ items: [] })),
    enabled: !!(userId || profile?.id),
  });

  const followMutation = useMutation({
    mutationFn: () => api.post(`/users/${profile?.id}/follow`),
    onMutate: () => {
      qc.setQueryData(['profile', username], (old: any) => old ? {
        ...old,
        is_following: !old.is_following,
        follower_count: old.is_following ? old.follower_count - 1 : old.follower_count + 1,
      } : old);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['profile', username] }),
  });

  const handleOptions = () => {
    const options = ['Signaler', 'Bloquer', 'Ne plus voir dans le feed', 'Annuler'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 3, destructiveButtonIndex: 1 },
        (i) => {
          if (i === 0) {
            Alert.alert('Signalement envoyé', 'Merci, nous examinerons ce profil.');
            api.post('/reports', { target_type: 'user', target_id: profile?.id, reason: 'inappropriate' }).catch(() => {});
          } else if (i === 1) {
            Alert.alert('Bloquer', `Bloquer @${profile?.username} ?`, [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Bloquer', style: 'destructive', onPress: () => {
                api.post(`/users/${profile?.id}/block`).catch(() => {});
                navigation.goBack();
              }},
            ]);
          } else if (i === 2) {
            Alert.alert('Masqué', `Tu ne verras plus @${profile?.username} dans ton feed.`);
            api.post(`/users/${profile?.id}/hide`).catch(() => {});
          }
        },
      );
    } else {
      Alert.alert('Options', '', [
        { text: 'Signaler', onPress: () => { api.post('/reports', { target_type: 'user', target_id: profile?.id, reason: 'inappropriate' }).catch(() => {}); Alert.alert('Signalement envoyé'); }},
        { text: 'Bloquer', style: 'destructive', onPress: () => { api.post(`/users/${profile?.id}/block`).catch(() => {}); navigation.goBack(); }},
        { text: 'Ne plus voir dans le feed', onPress: () => Alert.alert('Masqué') },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  };

  const handleMessage = async () => {
    if (!user || !profile) return;
    if (user.gender !== profile.gender) {
      Alert.alert(
        'Messagerie restreinte',
        'Sur Nour, la messagerie directe entre hommes et femmes non mahrams n\'est pas autorisée.',
        [{ text: 'Compris' }],
      );
      return;
    }
    try {
      const { data } = await api.post('/messages/direct', { recipient_id: profile.id });
      navigation.navigate('Conversation', {
        conversationId: data.conversation_id,
        otherUser: { id: profile.id, display_name: profile.display_name },
      });
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Impossible d\'ouvrir la conversation.');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!profile) return null;
  const isOwnProfile = user?.id === profile.id;
  const posts = postsData?.items ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <IcBack size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>@{profile.username}</Text>
        {!isOwnProfile && (
          <TouchableOpacity onPress={handleOptions} style={styles.backBtn} activeOpacity={0.7}>
            <IcMore size={22} color={theme.text} />
          </TouchableOpacity>
        )}
        {isOwnProfile && <View style={{ width: 40 }} />}
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 1, paddingBottom: 40 }}
        columnWrapperStyle={{ gap: 1 }}
        ListHeaderComponent={
          <View style={[styles.hero, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
            {/* Avatar */}
            <TouchableOpacity style={styles.avatarWrap} activeOpacity={0.85}>
              {profile.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                : <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.primaryBg }]}>
                    <Text style={styles.avatarInitial}>{profile.display_name[0]?.toUpperCase()}</Text>
                  </View>
              }
              {profile.is_verified && (
                <View style={styles.verifiedBadge}>
                  <IcCheck size={9} color={COLORS.white} strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>

            <Text style={[styles.displayName, { color: theme.text }]}>{profile.display_name}</Text>
            {profile.bio
              ? <Text style={[styles.bio, { color: theme.textMuted }]}>{profile.bio}</Text>
              : null
            }

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatItem label="Publications" value={profile.post_count} theme={theme} />
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <StatItem label="Abonnés" value={profile.follower_count} theme={theme} />
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <StatItem label="Abonnements" value={profile.following_count} theme={theme} />
            </View>

            {/* Actions */}
            {!isOwnProfile && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.followBtn, profile.is_following && { backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border }]}
                  onPress={() => followMutation.mutate()}
                  disabled={followMutation.isPending}
                  activeOpacity={0.8}
                >
                  {profile.is_following
                    ? <IcFollowing size={15} color={theme.textMuted} />
                    : <IcFollow size={15} color={COLORS.white} />
                  }
                  <Text style={[styles.followText, profile.is_following && { color: theme.textMuted }]}>
                    {profile.is_following ? 'Abonné' : 'Suivre'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.messageBtn, { borderColor: COLORS.primary, backgroundColor: theme.surface }]}
                  onPress={handleMessage}
                  activeOpacity={0.8}
                >
                  <IcMail size={15} color={COLORS.primary} />
                  <Text style={[styles.messageBtnText, { color: COLORS.primary }]}>Message</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Grid header */}
            <View style={[styles.gridHeader, { borderTopColor: theme.borderLight }]}>
              <IcPlay size={16} color={COLORS.primary} />
              <Text style={[styles.gridHeaderText, { color: theme.text }]}>Vidéos ({profile.post_count})</Text>
            </View>
          </View>
        }
        renderItem={({ item: p }) => (
          <TouchableOpacity
            style={[styles.cell, { backgroundColor: theme.surface }]}
            onPress={() => navigation.navigate('VideoPlayer', { postId: p.id })}
            activeOpacity={0.85}
          >
            {getThumbUrl(p)
              ? <Image source={{ uri: getThumbUrl(p)! }} style={styles.cellImg} resizeMode="cover" />
              : <View style={[styles.cellImg, styles.cellFallback, { backgroundColor: theme.card }]}>
                  <IcPlay size={24} color={COLORS.primaryLight} />
                </View>
            }
            <View style={styles.cellOverlay}>
              <IcPlay size={10} color={COLORS.white} />
              <Text style={styles.cellCount}>{fmtNum(p.view_count)}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          postsLoading
            ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
            : (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>Aucune publication</Text>
              </View>
            )
        }
      />
    </View>
  );
}

function StatItem({ label, value, theme }: { label: string; value: number; theme: any }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: theme.text }]}>{fmtNum(value)}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },

  hero: {
    alignItems: 'center', paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg, gap: SPACING.sm,
    borderBottomWidth: 1,
  },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { borderWidth: 3, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 34, fontWeight: FONT.weight.bold, color: COLORS.primary },
  verifiedBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },

  displayName: { fontSize: FONT.size.xxl, fontWeight: FONT.weight.bold, letterSpacing: -0.3 },
  bio: { fontSize: FONT.size.sm, textAlign: 'center', lineHeight: 20 },

  statsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginTop: 4 },
  statItem: { alignItems: 'center', gap: 2, minWidth: 70 },
  statValue: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold },
  statLabel: { fontSize: FONT.size.xs },
  statDivider: { width: 1, height: 30 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 28, paddingVertical: 10, ...SHADOW.green,
  },
  followText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.white },
  messageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: RADIUS.full, paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1.5,
  },
  messageBtnText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },

  gridHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    width: '100%', paddingTop: SPACING.md, marginTop: 4,
    borderTopWidth: 1,
  },
  gridHeaderText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },

  cell: { width: CELL, height: CELL * (16 / 9) },
  cellImg: { width: '100%', height: '100%' },
  cellFallback: { alignItems: 'center', justifyContent: 'center' },
  cellOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 4, backgroundColor: 'rgba(0,0,0,0.4)',
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  cellCount: { fontSize: 10, color: COLORS.white },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: FONT.size.base },
});
