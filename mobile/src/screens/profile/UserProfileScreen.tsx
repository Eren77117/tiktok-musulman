import React from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../api/client';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { IcBack, IcFollow, IcFollowing, IcMail } from '../../components/ui/Icons';

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

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function UserProfileScreen({ route, navigation }: Props) {
  const { username } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['profile', username],
    queryFn: () => api.get(`/users/${username}`).then(r => r.data),
  });

  const followMutation = useMutation({
    mutationFn: () => api.post(`/users/${profile?.id}/follow`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', username] }),
  });

  const handleMessage = () => {
    if (!user || !profile) return;

    const sameGender = user.gender === profile.gender;
    if (!sameGender) {
      Alert.alert(
        'Messagerie restreinte',
        'Sur Nour, les messages entre hommes et femmes non mahrams ne sont pas autorisés.',
        [{ text: 'Compris' }],
      );
      return;
    }

    navigation.navigate('Messages');
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!profile) return null;

  const isOwnProfile = user?.id === profile.id;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <IcBack size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{profile.username}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar + info */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{profile.display_name[0]?.toUpperCase()}</Text>
              </View>
            )}
            {profile.is_verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            )}
          </View>

          <Text style={styles.displayName}>{profile.display_name}</Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{fmtNum(profile.post_count)}</Text>
              <Text style={styles.statLabel}>Publications</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{fmtNum(profile.follower_count)}</Text>
              <Text style={styles.statLabel}>Abonnés</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{fmtNum(profile.following_count)}</Text>
              <Text style={styles.statLabel}>Abonnements</Text>
            </View>
          </View>

          {/* Actions */}
          {!isOwnProfile && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.followBtn, profile.is_following && styles.followingBtn]}
                onPress={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                activeOpacity={0.8}
              >
                {profile.is_following
                  ? <IcFollowing size={16} color={COLORS.textMuted} />
                  : <IcFollow size={16} color={COLORS.white} />
                }
                <Text style={[styles.followText, profile.is_following && styles.followingText]}>
                  {profile.is_following ? 'Abonné' : 'Suivre'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.messageBtn}
                onPress={handleMessage}
                activeOpacity={0.8}
              >
                <IcMail size={16} color={COLORS.primary} />
                <Text style={styles.messageBtnText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, backgroundColor: COLORS.white,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold, color: COLORS.text },
  content: { paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: SPACING.xl, paddingHorizontal: SPACING.lg, gap: SPACING.sm },

  avatarWrap: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    backgroundColor: COLORS.primaryBg, borderWidth: 3, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 38, fontWeight: FONT.weight.bold, color: COLORS.primary },
  verifiedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedText: { color: COLORS.white, fontSize: 11, fontWeight: FONT.weight.bold },

  displayName: { fontSize: FONT.size.xxl, fontWeight: FONT.weight.bold, color: COLORS.text, letterSpacing: -0.3 },
  bio: { fontSize: FONT.size.sm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  statsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginTop: 4 },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, color: COLORS.text },
  statLabel: { fontSize: FONT.size.xs, color: COLORS.textMuted },
  statDivider: { width: 1, height: 30, backgroundColor: COLORS.border },

  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 28, paddingVertical: 10, ...SHADOW.green,
  },
  followingBtn: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    shadowColor: 'transparent',
  },
  followText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.white },
  followingText: { color: COLORS.textMuted },
  messageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.white, borderRadius: RADIUS.full,
    paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  messageBtnText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.primary },
});
