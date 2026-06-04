import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  FlatList, ScrollView, Alert, ActivityIndicator, RefreshControl, Modal, ActionSheetIOS, Platform,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { IcSettings, IcSave, IcCheck, IcHeart, IcGrid, IcEdit } from '../../components/ui/Icons';
import { EditProfileScreen } from './EditProfileScreen';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Post {
  id: string;
  thumbnail_url: string | null;
  video_url?: string;
  view_count: number;
  like_count: number;
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

interface Thread {
  id: string;
  content: string;
  like_count: number;
  reply_count: number;
  created_at: string;
}

const TABS = ['Vidéos', 'Fils', "J'aime", 'Favoris'];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user, updateUser, loadMe } = useAuthStore();
  const theme = useTheme();

  // Real-time stats — reload user every 15s
  useQuery({
    queryKey: ['me-stats'],
    queryFn: async () => { await loadMe(); return null; },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    enabled: !!user?.id,
  });
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [editVisible, setEditVisible] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const { data: posts, isLoading: postsLoading, refetch: refetchPosts, isRefetching } = useQuery<{ items: Post[] }>({
    queryKey: ['user-posts', user?.id],
    queryFn: () => api.get(`/posts/user/${user?.id}`).then((r) => r.data),
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  const { data: threads, isLoading: threadsLoading } = useQuery<{ items: Thread[] }>({
    queryKey: ['user-threads', user?.id],
    queryFn: () => api.get(`/threads?user_id=${user?.id}&limit=30`).then((r) => r.data).catch(() => ({ items: [] })),
    enabled: !!user?.id && activeTab === 1,
  });

  const { data: liked, isLoading: likedLoading } = useQuery<{ items: Post[] }>({
    queryKey: ['user-liked', user?.id],
    queryFn: () => api.get('/posts/liked').then((r) => r.data).catch(() => ({ items: [] })),
    enabled: !!user?.id && activeTab === 2,
  });

  const { data: favorites, isLoading: favLoading } = useQuery<{ items: Post[] }>({
    queryKey: ['favorites'],
    queryFn: () => api.get('/favorites').then((r) => r.data).catch(() => ({ items: [] })),
    enabled: !!user?.id && activeTab === 3,
  });

  if (!user) return null;

  const handleAvatarPress = () => {
    const options = ['Prendre une photo', 'Choisir depuis la galerie', 'Annuler'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2 },
        (i) => { if (i === 0) pickAvatar('camera'); else if (i === 1) pickAvatar('library'); },
      );
    } else {
      Alert.alert('Photo de profil', '', [
        { text: 'Prendre une photo', onPress: () => pickAvatar('camera') },
        { text: 'Depuis la galerie', onPress: () => pickAvatar('library') },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  };

  const pickAvatar = async (src: 'camera' | 'library') => {
    const fn = src === 'camera' ? launchCamera : launchImageLibrary;
    const result = await fn({ mediaType: 'photo', quality: 0.9, maxWidth: 500, maxHeight: 500 });
    if (result.didCancel || !result.assets?.[0]?.uri) return;

    setAvatarLoading(true);
    try {
      const asset = result.assets[0];
      const tokens = await import('../../api/client').then(m => m.getTokens());
      if (!tokens) throw new Error('Non authentifié');

      // Use native fetch (more reliable than axios for multipart on iOS)
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: 'image/jpeg', name: 'avatar.jpg' } as any);

      const { API_BASE_URL } = await import('../../constants/theme');
      const uploadRes = await fetch(`${API_BASE_URL}/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.access}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err?.error ?? `Upload error ${uploadRes.status}`);
      }

      const uploadData = await uploadRes.json();
      const avatar_url: string = uploadData.url;

      if (!avatar_url) throw new Error('URL manquante dans la réponse');

      // Save to server
      await api.patch('/users/me', { avatar_url });

      // Update local state immediately + re-sync store from DB
      updateUser({ avatar_url });
      await loadMe();

      // Invalidate all caches so avatar propagates everywhere
      qc.invalidateQueries();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Impossible de mettre à jour la photo.");
    } finally {
      setAvatarLoading(false);
    }
  };

  const gridData = activeTab === 0 ? posts?.items
    : activeTab === 2 ? liked?.items
    : activeTab === 3 ? favorites?.items
    : null;

  const gridLoading = activeTab === 0 ? postsLoading
    : activeTab === 2 ? likedLoading
    : activeTab === 3 ? favLoading
    : false;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet">
        <EditProfileScreen onClose={() => { setEditVisible(false); qc.invalidateQueries({ queryKey: ['me'] }); }} />
      </Modal>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchPosts} tintColor={COLORS.primary} />}
      >
        {/* Top bar */}
        <View style={[styles.topBar, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
          <Text style={[styles.topUsername, { color: theme.text }]}>@{user.username}</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
            <IcSettings size={22} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={[styles.heroSection, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85} style={styles.avatarWrap}>
            {avatarLoading ? (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            ) : user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{user.display_name[0]?.toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.cameraOverlay}>
              <IcEdit size={12} color={COLORS.white} />
            </View>
            {user.is_verified && (
              <View style={styles.verifiedBadge}>
                <IcCheck size={10} color={COLORS.white} strokeWidth={3} />
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.displayName, { color: theme.text }]}>{user.display_name}</Text>
          {user.bio ? <Text style={[styles.bio, { color: theme.textMuted }]}>{user.bio}</Text> : null}

          <View style={styles.statsRow}>
            <StatItem label="Abonnements" value={user.following_count ?? 0} />
            <View style={styles.statDivider} />
            <StatItem label="Abonnés" value={user.follower_count ?? 0} />
            <View style={styles.statDivider} />
            <StatItem label="Publications" value={user.post_count ?? 0} />
          </View>

          <TouchableOpacity style={styles.editBtn} onPress={() => setEditVisible(true)} activeOpacity={0.8}>
            <Text style={styles.editBtnText}>Modifier le profil</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
          {TABS.map((tab, i) => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === i && styles.tabActive]} onPress={() => setActiveTab(i)} activeOpacity={0.8}>
              <Text style={[styles.tabLabel, { color: activeTab === i ? COLORS.primary : theme.textMuted }, activeTab === i && styles.tabLabelActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {activeTab === 1 ? (
          <ThreadsTab threads={threads?.items} loading={threadsLoading} />
        ) : gridLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={gridData ?? []}
            numColumns={3}
            keyExtractor={(p) => p.id}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item }) => <GridItem item={item} onPress={() => navigation.navigate('VideoPlayer', { postId: item.id })} />}
            ListEmptyComponent={<EmptyTab tab={activeTab} />}
          />
        )}
      </ScrollView>
    </View>
  );
}

function GridItem({ item, onPress }: { item: Post; onPress: () => void }) {
  const thumb = getThumbUrl(item);
  return (
    <TouchableOpacity style={styles.gridItem} activeOpacity={0.8} onPress={onPress}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.gridThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.gridThumb, styles.gridThumbFallback]}>
          <IcGrid size={24} color={COLORS.primaryLight} />
        </View>
      )}
      <View style={styles.gridOverlay}>
        <IcHeart size={11} color={COLORS.white} />
        <Text style={styles.gridViews}>{fmtNum(item.view_count)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ThreadsTab({ threads, loading }: { threads?: Thread[]; loading: boolean }) {
  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />;
  if (!threads?.length) return <EmptyTab tab={1} />;
  return (
    <View>
      {threads.map((t) => (
        <View key={t.id} style={styles.threadItem}>
          <Text style={styles.threadContent}>{t.content}</Text>
          <Text style={styles.threadMeta}>{t.like_count} j'aime · {t.reply_count} réponses</Text>
        </View>
      ))}
    </View>
  );
}

function EmptyTab({ tab }: { tab: number }) {
  const msgs = [
    { title: 'Aucune vidéo', sub: 'Publiez votre première vidéo !' },
    { title: 'Aucun fil', sub: 'Partagez vos pensées !' },
    { title: "Aucun j'aime", sub: 'Aimez des vidéos pour les retrouver ici' },
    { title: 'Aucun favori', sub: 'Sauvegardez du contenu pour le retrouver ici' },
  ];
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>{msgs[tab]?.title}</Text>
      <Text style={styles.emptySubtitle}>{msgs[tab]?.sub}</Text>
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
  return String(n ?? 0);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 60 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  topUsername: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, color: COLORS.text },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  heroSection: { alignItems: 'center', paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg, gap: 10 },

  avatarWrap: { position: 'relative' },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarFallback: {
    backgroundColor: COLORS.primaryBg, borderWidth: 2, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 36, fontWeight: FONT.weight.bold, color: COLORS.primary },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  verifiedBadge: {
    position: 'absolute', bottom: 0, left: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },

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
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabLabel: { fontSize: 12, fontWeight: FONT.weight.medium, color: COLORS.textMuted },
  tabLabelActive: { color: COLORS.primary, fontWeight: FONT.weight.semibold },

  gridRow: { gap: 1 },
  gridItem: { flex: 1 / 3, aspectRatio: 9 / 16, position: 'relative', margin: 0.5 },
  gridThumb: { width: '100%', height: '100%' },
  gridThumbFallback: { backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  gridOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 4, backgroundColor: 'rgba(0,0,0,0.35)',
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  gridViews: { fontSize: FONT.size.xs, color: COLORS.white },

  threadItem: {
    backgroundColor: COLORS.white, padding: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  threadContent: { fontSize: FONT.size.base, color: COLORS.text, lineHeight: 22 },
  threadMeta: { fontSize: FONT.size.xs, color: COLORS.textMuted, marginTop: 6 },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, color: COLORS.text },
  emptySubtitle: { fontSize: FONT.size.sm, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl },
});
