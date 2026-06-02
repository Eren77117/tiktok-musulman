import React from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  FlatList, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../api/client';
import { COLORS, SPACING } from '../../constants';

interface Post {
  id: string;
  thumbnail_url: string | null;
  view_count: number;
  like_count: number;
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const { data: posts, isLoading } = useQuery<{ items: Post[] }>({
    queryKey: ['user-posts', user?.id],
    queryFn: () => api.get(`/posts/user/${user?.id}`).then((r) => r.data),
    enabled: !!user?.id,
  });

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{user.display_name[0]?.toUpperCase()}</Text>
            </View>
          )}
        </View>
        <Text style={styles.displayName}>{user.display_name}</Text>
        <Text style={styles.username}>@{user.username}</Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

        <View style={styles.stats}>
          <Stat label="Following" value={user.following_count} />
          <View style={styles.statDivider} />
          <Stat label="Followers" value={user.follower_count} />
          <View style={styles.statDivider} />
          <Stat label="Likes" value={user.post_count} />
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => Alert.alert('Sign out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: logout },
          ])}
        >
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={posts?.items}
          numColumns={3}
          keyExtractor={(p) => p.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              {item.thumbnail_url ? (
                <Image source={{ uri: item.thumbnail_url }} style={styles.gridThumb} />
              ) : (
                <View style={[styles.gridThumb, { backgroundColor: '#222' }]} />
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No posts yet</Text>
          }
        />
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 40 },
  header: { alignItems: 'center', padding: SPACING.lg, gap: 8 },
  avatarWrap: { marginBottom: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  displayName: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  username: { fontSize: 14, color: COLORS.textMuted },
  bio: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginTop: 4 },
  stat: { alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textMuted },
  statDivider: { width: 1, height: 24, backgroundColor: COLORS.border },
  logoutBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  logoutText: { fontSize: 14, color: COLORS.textMuted },
  gridItem: { flex: 1 / 3, aspectRatio: 9 / 16, margin: 0.5 },
  gridThumb: { flex: 1 },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, padding: SPACING.xl },
});
