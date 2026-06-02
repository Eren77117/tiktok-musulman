import React from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  FlatList, ScrollView, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { api } from '../../api/client';
import { COLORS, SPACING } from '../../constants';

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
}

export default function UserProfileScreen({ route, navigation }: Props) {
  const { username } = route.params;
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['profile', username],
    queryFn: () => api.get(`/users/${username}`).then((r) => r.data),
  });

  const followMutation = useMutation({
    mutationFn: () => api.post(`/users/${profile?.id}/follow`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', username] }),
  });

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!profile) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{profile.display_name[0]?.toUpperCase()}</Text>
            </View>
          )}
        </View>
        <Text style={styles.displayName}>{profile.display_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statVal}>{profile.following_count}</Text><Text style={styles.statLabel}>Following</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.stat}><Text style={styles.statVal}>{profile.follower_count}</Text><Text style={styles.statLabel}>Followers</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.stat}><Text style={styles.statVal}>{profile.post_count}</Text><Text style={styles.statLabel}>Posts</Text></View>
        </View>

        <TouchableOpacity
          style={[styles.followBtn, profile.is_following && styles.followingBtn]}
          onPress={() => followMutation.mutate()}
          activeOpacity={0.8}
        >
          <Text style={[styles.followText, profile.is_following && styles.followingText]}>
            {profile.is_following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 40 },
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  backBtn: { padding: SPACING.md },
  backText: { fontSize: 24, color: COLORS.text },
  header: { alignItems: 'center', paddingHorizontal: SPACING.lg, gap: 8 },
  avatarWrap: { marginBottom: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  displayName: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  username: { fontSize: 14, color: COLORS.textMuted },
  bio: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  stat: { alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textMuted },
  statDivider: { width: 1, height: 24, backgroundColor: COLORS.border },
  followBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 40, paddingVertical: 12 },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
  followText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  followingText: { color: COLORS.textMuted },
});
