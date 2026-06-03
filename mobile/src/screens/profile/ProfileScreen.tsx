import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  FlatList, ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { IcSettings, IcGrid, IcSave, IcCheck } from '../../components/ui/Icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Post {
  id: string;
  thumbnail_url: string | null;
  view_count: number;
  like_count: number;
}

const TABS = ['Vidéos', 'Favoris'];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);

  const { data: posts, isLoading, refetch, isRefetching } = useQuery<{ items: Post[] }>({
    queryKey: ['user-posts', user?.id],
    queryFn: () => api.get(`/posts/user/${user?.id}`).then((r) => r.data),
    enabled: !!user?.id,
  });

  if (!user) return null;

  const confirmLogout = () => {
    Alert.alert('Se déconnecter', 'Êtes-vous sûr ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.topUsername}>@{user.username}</Text>
          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
            >
              <IcSettings size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Avatar + name */}
        <View style={styles.heroSection}>
          <View style={styles.avatarWrap}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{user.display_name[0]?.toUpperCase()}</Text>
              </View>
            )}
            {user.is_verified && (
              <View style={styles.verifiedBadge}>
                <IcCheck size={10} color={COLORS.white} strokeWidth={3} />
              </View>
            )}
          </View>
          <Text style={styles.displayName}>{user.display_name}</Text>
          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatItem label="Abonnements" value={user.following_count} />
            <View style={styles.statDivider} />
            <StatItem label="Abonnés" value={user.follower_count} />
            <View style={styles.statDivider} />
            <StatItem label="Publications" value={user.post_count} />
          </View>

          {/* Edit profile btn */}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => Alert.alert('Bientôt', 'Édition du profil bientôt disponible.')}
            activeOpacity={0.8}
          >
            <Text style={styles.editBtnText}>Modifier le profil</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === i && styles.tabActive]}
              onPress={() => setActiveTab(i)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, activeTab === i && styles.tabLabelActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Grid */}
        {isLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={activeTab === 0 ? posts?.items : []}
            numColumns={3}
            keyExtractor={(p) => p.id}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.gridItem} activeOpacity={0.8}>
                {item.thumbnail_url ? (
                  <Image source={{ uri: item.thumbnail_url }} style={styles.gridThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.gridThumb, styles.gridThumbFallback]}>
                    <Text style={styles.gridFallbackIcon}>▶</Text>
                  </View>
                )}
                <View style={styles.gridOverlay}>
                  <Text style={styles.gridViews}>▶ {fmtNum(item.view_count)}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>▶</Text>
                <Text style={styles.emptyTitle}>
                  {activeTab === 0 ? 'Aucune vidéo' : 'Aucun favori'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {activeTab === 0 ? 'Publiez votre première vidéo !' : 'Sauvegardez du contenu pour le retrouver ici'}
                </Text>
              </View>
            }
          />
        )}
      </ScrollView>
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{fmtNum(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 40 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  topUsername: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, color: COLORS.text },
  topActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 22, color: COLORS.textMuted },

  heroSection: { alignItems: 'center', paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg, gap: 10, backgroundColor: COLORS.white },

  avatarWrap: { position: 'relative' },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarFallback: {
    backgroundColor: COLORS.primaryBg,
    borderWidth: 2, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 36, fontWeight: FONT.weight.bold, color: COLORS.primary },
  verifiedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  verifiedIcon: { fontSize: 11, color: COLORS.white, fontWeight: FONT.weight.bold },

  displayName: { fontSize: FONT.size.xxl, fontWeight: FONT.weight.bold, color: COLORS.text, letterSpacing: -0.3 },
  bio: { fontSize: FONT.size.sm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  statsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginTop: 4 },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, color: COLORS.text },
  statLabel: { fontSize: FONT.size.xs, color: COLORS.textMuted },
  statDivider: { width: 1, height: 28, backgroundColor: COLORS.border },

  editBtn: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 10, marginTop: 4,
  },
  editBtnText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.text },

  tabs: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabLabel: { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium, color: COLORS.textMuted },
  tabLabelActive: { color: COLORS.primary, fontWeight: FONT.weight.semibold },

  gridRow: { gap: 1 },
  gridItem: { flex: 1 / 3, aspectRatio: 9 / 16, position: 'relative', margin: 0.5 },
  gridThumb: { width: '100%', height: '100%' },
  gridThumbFallback: { backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  gridFallbackIcon: { fontSize: 24, color: COLORS.primaryLight },
  gridOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 4, backgroundColor: 'rgba(0,0,0,0.3)',
  },
  gridViews: { fontSize: FONT.size.xs, color: COLORS.white },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIcon: { fontSize: 40, color: COLORS.primaryLight },
  emptyTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, color: COLORS.text },
  emptySubtitle: { fontSize: FONT.size.sm, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl },
});
