import React, { useState, useEffect } from 'react';
import { createThumbnail } from 'react-native-create-thumbnail';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  FlatList, ScrollView, Alert, ActivityIndicator, RefreshControl, Modal, ActionSheetIOS, Platform, Linking,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useAuthStore } from '../../stores/authStore';
import { api, getTokens } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, SPACING, RADIUS, SHADOW, API_BASE_URL } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { IcSettings, IcMenu, IcSave, IcCheck, IcHeart, IcGrid, IcEdit, IcCamera, IcChart, IcPlay, IcRepeat, IcBell } from '../../components/ui/Icons';
import { Link } from 'lucide-react-native';
import { LinearGradient } from 'react-native-linear-gradient';
import { EditProfileSheet } from './EditProfileSheet';

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
  if (!v) return null;
  // Cloudinary: generate thumbnail via URL transformation
  if (v.includes('cloudinary.com')) {
    return v
      .replace('/video/upload/', '/video/upload/so_0,q_auto,f_jpg/')
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

const TABS = ['Vidéos', 'Fils', "J'aime", 'Favoris', 'Reposts', 'Collections'];
const LIKE_SUBTABS = ['Pour toi', 'Fils'] as const;
type LikeSubTab = typeof LIKE_SUBTABS[number];

interface Collection {
  id: string;
  name: string;
  thumbnail_url: string | null;
  post_count: number;
}

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
  const [likeSubTab, setLikeSubTab] = useState<LikeSubTab>('Pour toi');
  const [editVisible, setEditVisible] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverError, setCoverError] = useState(false);

  // Notif count (badge cloche)
  const { data: notifData } = useQuery<{ count: number }>({
    queryKey: ['notif-unread'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data).catch(() => ({ count: 0 })),
    refetchInterval: 30_000,
    enabled: !!user?.id,
  });

  // Mes stories actives (pour l'anneau + viewer)
  const { data: myStories = [] } = useQuery<any[]>({
    queryKey: ['stories-mine', user?.id],
    queryFn: () => api.get('/stories/mine').then(r => r.data).catch(() => []),
    refetchInterval: 30_000,
    enabled: !!user?.id,
  });
  const hasStory = myStories.length > 0;

  const openMyStories = () => {
    if (!hasStory) return;
    const group = {
      user: { id: user!.id, display_name: user!.display_name, avatar_url: user!.avatar_url, gender: user!.gender },
      stories: myStories,
    };
    navigation.navigate('StoryViewer' as any, { groups: [group], initialGroupIndex: 0 });
  };

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
    enabled: !!user?.id && activeTab === 2 && likeSubTab === 'Pour toi',
  });

  const { data: likedThreads, isLoading: likedThreadsLoading } = useQuery<{ items: Thread[] }>({
    queryKey: ['user-liked-threads', user?.id],
    queryFn: () => api.get('/threads/liked').then((r) => r.data).catch(() => ({ items: [] })),
    enabled: !!user?.id && activeTab === 2 && likeSubTab === 'Fils',
  });

  const { data: favorites, isLoading: favLoading } = useQuery<{ items: Post[] }>({
    queryKey: ['favorites'],
    queryFn: () => api.get('/favorites').then((r) => r.data).catch(() => ({ items: [] })),
    enabled: !!user?.id && activeTab === 3,
  });

  const { data: reposts, isLoading: repostsLoading } = useQuery<{ items: { post: Post; user: { id: string; username: string; display_name: string; avatar_url: string | null } }[] }>({
    queryKey: ['user-reposts', user?.id],
    queryFn: () => api.get(`/posts/user/${user?.id}/reposts`).then((r) => r.data).catch(() => ({ items: [] })),
    enabled: !!user?.id && activeTab === 4,
  });

  const { data: collections, isLoading: collectionsLoading } = useQuery<{ items: Collection[] }>({
    queryKey: ['my-collections'],
    queryFn: () => api.get('/collections').then((r) => r.data).catch(() => ({ items: [] })),
    enabled: !!user?.id && activeTab === 5,
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
      const tokens = await getTokens();
      if (!tokens) throw new Error('Non authentifié');

      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.type ?? 'image/jpeg', name: 'avatar.jpg' } as any);

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

  const pickCover = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 1200, maxHeight: 400 });
    if (result.didCancel || !result.assets?.[0]?.uri) return;
    setCoverLoading(true);
    try {
      const asset = result.assets[0];
      const tokens = await getTokens();
      if (!tokens) throw new Error('Non authentifié');
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.type ?? 'image/jpeg', name: 'cover.jpg' } as any);
      const uploadRes = await fetch(`${API_BASE_URL}/upload/image`, {
        method: 'POST', headers: { Authorization: `Bearer ${tokens.access}` }, body: formData,
      });
      if (!uploadRes.ok) throw new Error(`Upload error ${uploadRes.status}`);
      const { url: cover_url } = await uploadRes.json();
      await api.patch('/users/me', { cover_url });
      updateUser({ cover_url } as any);
      qc.invalidateQueries({ queryKey: ['me'] });
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Impossible d'uploader la cover.");
    } finally {
      setCoverLoading(false);
    }
  };

  const gridData = activeTab === 0 ? posts?.items
    : activeTab === 2 && likeSubTab === 'Pour toi' ? liked?.items
    : activeTab === 3 ? favorites?.items
    : null;

  const gridLoading = activeTab === 0 ? postsLoading
    : activeTab === 2 && likeSubTab === 'Pour toi' ? likedLoading
    : activeTab === 2 && likeSubTab === 'Fils' ? likedThreadsLoading
    : activeTab === 3 ? favLoading
    : false;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <EditProfileSheet
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        user={user}
        onSave={async (data) => {
          const res = await api.patch('/users/me', data);
          updateUser({ ...data, ...(res.data ?? {}) } as any);
          await loadMe();
          setEditVisible(false);
          qc.invalidateQueries({ queryKey: ['me'] });
        }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchPosts} tintColor={COLORS.primary} />}
      >
        {/* Top bar */}
        <View style={[styles.topBar, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
          <Text style={[styles.topUsername, { color: theme.text }]}>@{user.username}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {/* Cloche notifications */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
              <IcBell size={22} color={theme.text} />
              {(notifData?.count ?? 0) > 0 && (
                <View style={[styles.notifBadge, { borderColor: theme.bg }]}>
                  <Text style={styles.notifBadgeText}>
                    {(notifData?.count ?? 0) > 99 ? '99+' : String(notifData?.count)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {/* Settings */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
              <IcMenu size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Cover photo — shown only if cover_url set */}
        {(user as any).cover_url && !coverError ? (
          <View style={styles.coverWrap}>
            <Image
              source={{ uri: (user as any).cover_url }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setCoverError(true)}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.35)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0.4 }}
              end={{ x: 0, y: 1 }}
              pointerEvents="none"
            />
            <TouchableOpacity style={styles.coverCameraBtn} onPress={pickCover} activeOpacity={0.8} disabled={coverLoading}>
              {coverLoading
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <IcCamera size={15} color={COLORS.white} />
              }
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Hero */}
        <View style={[
          styles.heroSection,
          { backgroundColor: theme.bg },
          !(user as any).cover_url || coverError ? { marginTop: 0, paddingTop: 24 } : {},
        ]}>
          <View style={styles.avatarContainer}>
            {/* Anneau story actif */}
            {hasStory && (
              <View style={styles.storyRing} />
            )}
            <TouchableOpacity onPress={openMyStories} activeOpacity={0.85} style={[styles.avatarWrap, hasStory && styles.avatarWrapWithStory]}>
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
              {user.is_verified && (
                <View style={styles.verifiedBadge}>
                  <IcCheck size={10} color={COLORS.white} strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.storyPlusBtn} onPress={() => navigation.navigate('StoryCreate' as any)} activeOpacity={0.8}>
              <Text style={styles.storyPlusIcon}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.displayName, { color: theme.text }]}>{user.display_name}</Text>
          {(user as any).profile_category ? (
            <View style={[styles.categoryBadge, { backgroundColor: `${COLORS.primary}18` }]}>
              <Text style={[styles.categoryText, { color: COLORS.primary }]}>{(user as any).profile_category}</Text>
            </View>
          ) : null}
          {user.bio ? <Text style={[styles.bio, { color: theme.textMuted }]}>{user.bio}</Text> : null}
          {(user as any).bio_links?.[0] ? (
            <TouchableOpacity
              style={styles.bioLinkRow}
              onPress={() => Linking.openURL((user as any).bio_links[0]).catch(() => {})}
              activeOpacity={0.7}
            >
              <Link size={13} color={COLORS.primary} strokeWidth={2} />
              <Text style={[styles.bioLinkText, { color: COLORS.primary }]} numberOfLines={1}>
                {(user as any).bio_links[0].replace(/^https?:\/\/(www\.)?/, '')}
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.statsRow}>
            <TouchableOpacity onPress={() => navigation.navigate('Followers', { userId: user.id, username: user.username, type: 'following' })} activeOpacity={0.7}>
              <StatItem label="Abonnements" value={user.following_count ?? 0} theme={theme} />
            </TouchableOpacity>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <TouchableOpacity onPress={() => navigation.navigate('Followers', { userId: user.id, username: user.username, type: 'followers' })} activeOpacity={0.7}>
              <StatItem label="Abonnés" value={user.follower_count ?? 0} theme={theme} />
            </TouchableOpacity>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <StatItem label="Publications" value={user.post_count ?? 0} theme={theme} />
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.editBtn, { borderColor: theme.border, flex: 1 }]} onPress={() => setEditVisible(true)} activeOpacity={0.8}>
              <Text style={[styles.editBtnText, { color: theme.text }]}>Modifier le profil</Text>
            </TouchableOpacity>
            {(!(user as any).cover_url || coverError) && (
              <TouchableOpacity style={[styles.editBtn, { borderColor: theme.border, paddingHorizontal: 12 }]} onPress={pickCover} activeOpacity={0.8} disabled={coverLoading}>
                {coverLoading
                  ? <ActivityIndicator size="small" color={theme.text} />
                  : <IcCamera size={16} color={theme.text} />
                }
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
          {TABS.map((tab, i) => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === i && styles.tabActive]} onPress={() => setActiveTab(i)} activeOpacity={0.8}>
              <Text style={[styles.tabLabel, { color: activeTab === i ? COLORS.primary : theme.textMuted }, activeTab === i && styles.tabLabelActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Like sub-tabs */}
        {activeTab === 2 && (
          <View style={[styles.subTabs, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
            {LIKE_SUBTABS.map(sub => (
              <TouchableOpacity
                key={sub}
                style={[styles.subTab, likeSubTab === sub && styles.subTabActive]}
                onPress={() => setLikeSubTab(sub)}
                activeOpacity={0.8}
              >
                <Text style={[styles.subTabLabel, { color: likeSubTab === sub ? COLORS.primary : theme.textMuted }, likeSubTab === sub && styles.subTabLabelActive]}>
                  {sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Content */}
        {activeTab === 1 ? (
          <ThreadsTab threads={threads?.items} loading={threadsLoading} theme={theme} />
        ) : activeTab === 2 && likeSubTab === 'Fils' ? (
          <ThreadsTab threads={likedThreads?.items} loading={likedThreadsLoading} theme={theme} />
        ) : activeTab === 4 ? (
          repostsLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={(reposts?.items ?? []).map(r => ({ ...r.post, _repostedBy: r.user }))}
              numColumns={3}
              keyExtractor={(p) => `repost-${p.id}`}
              scrollEnabled={false}
              columnWrapperStyle={styles.gridRow}
              renderItem={({ item }) => (
                <GridItem
                  item={item}
                  onPress={() => navigation.navigate('VideoPlayer', { postId: item.id })}
                  repostBadge
                />
              )}
              ListEmptyComponent={<EmptyTab tab={4} theme={theme} />}
            />
          )
        ) : activeTab === 5 ? (
          collectionsLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : (
            <CollectionsGrid
              collections={collections?.items ?? []}
              onOpen={(c) => navigation.navigate('CollectionDetail', { collectionId: c.id, name: c.name })}
              theme={theme}
            />
          )
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
            ListEmptyComponent={<EmptyTab tab={activeTab} theme={theme} />}
          />
        )}
      </ScrollView>
    </View>
  );
}

// In-memory thumbnail cache (persists for app session)
const THUMB_CACHE = new Map<string, string>();

function GridItem({ item, onPress, repostBadge }: { item: Post & { _repostedBy?: any }; onPress: () => void; repostBadge?: boolean }) {
  const precomputed = getThumbUrl(item);
  const [thumb, setThumb] = useState<string | null>(precomputed ?? THUMB_CACHE.get(item.id) ?? null);
  const [loading, setLoading] = useState(!thumb && !!item.video_url);

  useEffect(() => {
    if (thumb || !item.video_url) return;
    // Already cached?
    if (THUMB_CACHE.has(item.id)) {
      setThumb(THUMB_CACHE.get(item.id)!);
      setLoading(false);
      return;
    }
    // Generate lazily from remote URL
    createThumbnail({ url: item.video_url, timeStamp: 0, format: 'jpeg' })
      .then(r => {
        THUMB_CACHE.set(item.id, r.path);
        setThumb(r.path);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [item.id]);

  return (
    <TouchableOpacity style={styles.gridItem} activeOpacity={0.8} onPress={onPress}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.gridThumb} resizeMode="cover" />
      ) : loading ? (
        <View style={[styles.gridThumb, styles.gridThumbFallback]}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : (
        <View style={[styles.gridThumb, styles.gridThumbFallback]}>
          <IcPlay size={28} color={COLORS.primaryLight} />
        </View>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.65)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />
      <View style={styles.gridOverlay}>
        <IcPlay size={11} color={COLORS.white} />
        <Text style={styles.gridViews}>{fmtNum(item.view_count)}</Text>
      </View>
      {repostBadge && (
        <View style={styles.repostMini}>
          <IcRepeat size={9} color={COLORS.white} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function ThreadsTab({ threads, loading, theme }: { threads?: Thread[]; loading: boolean; theme: any }) {
  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />;
  if (!threads?.length) return <EmptyTab tab={1} theme={theme} />;
  return (
    <View>
      {threads.map((t) => (
        <View key={t.id} style={[styles.threadItem, { borderBottomColor: theme.border }]}>
          <Text style={[styles.threadContent, { color: theme.text }]}>{t.content}</Text>
          <Text style={[styles.threadMeta, { color: theme.textMuted }]}>{t.like_count} j'aime · {t.reply_count} réponses</Text>
        </View>
      ))}
    </View>
  );
}

function CollectionsGrid({ collections, onOpen, theme }: {
  collections: Collection[];
  onOpen: (c: Collection) => void;
  theme: any;
}) {
  const { width } = require('react-native').Dimensions.get('window');
  const COLS = 2;
  const CELL_W = (width - 3) / COLS;
  const CELL_H = CELL_W * 0.75;

  if (collections.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucune collection</Text>
        <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>Sauvegardez des vidéos dans des collections</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={collections}
      keyExtractor={c => c.id}
      numColumns={COLS}
      scrollEnabled={false}
      columnWrapperStyle={{ gap: 1, marginBottom: 1 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={{ width: CELL_W, height: CELL_H, backgroundColor: theme.card }}
          activeOpacity={0.8}
          onPress={() => onOpen(item)}
        >
          {item.thumbnail_url
            ? <Image source={{ uri: item.thumbnail_url }} style={{ width: '100%', height: '100%' }} />
            : <View style={{ flex: 1, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}>
                <IcGrid size={28} color={theme.textMuted} />
              </View>}
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: 'rgba(0,0,0,0.55)', padding: 8,
          }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{item.name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{item.post_count} vidéo{item.post_count !== 1 ? 's' : ''}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

function EmptyTab({ tab, theme }: { tab: number; theme: any }) {
  const msgs = [
    { title: 'Aucune vidéo', sub: 'Publiez votre première vidéo !' },
    { title: 'Aucun fil', sub: 'Partagez vos pensées !' },
    { title: "Aucun j'aime", sub: 'Aimez des vidéos pour les retrouver ici' },
    { title: 'Aucun favori', sub: 'Sauvegardez du contenu pour le retrouver ici' },
  ];
  return (
    <View style={styles.emptyWrap}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{msgs[tab]?.title}</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>{msgs[tab]?.sub}</Text>
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

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n ?? 0);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  topUsername: { fontSize: FONT.size.md, fontWeight: FONT.weight.bold, letterSpacing: -0.3 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  coverWrap: { width: '100%', height: 130, position: 'relative', overflow: 'hidden', backgroundColor: '#0F3D22' },
  coverCameraBtn: {
    position: 'absolute', bottom: 10, right: 12,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  notifBadge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5,
  },
  notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  heroSection: { alignItems: 'center', paddingTop: SPACING.md, paddingBottom: SPACING.lg, paddingHorizontal: SPACING.lg, gap: 10, marginTop: -30 },

  avatarContainer: { position: 'relative' },
  storyRing: {
    position: 'absolute', width: 108, height: 108, borderRadius: 54,
    borderWidth: 3, borderColor: '#00E57A',
    top: -6, left: -6, zIndex: 0,
    shadowColor: '#00E57A', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 10, elevation: 10,
  },
  avatarWrap: { position: 'relative', zIndex: 1 },
  avatarWrapWithStory: { padding: 3 },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: COLORS.white },
  avatarFallback: {
    backgroundColor: COLORS.primaryBg, borderWidth: 3, borderColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  avatarText: { fontSize: 38, fontWeight: FONT.weight.bold, color: COLORS.primary },
  storyPlusBtn: {
    position: 'absolute', bottom: 0, right: -4,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#0B0B0B',
  },
  storyPlusIcon: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 22 },
  verifiedBadge: {
    position: 'absolute', bottom: 2, left: 2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0B0B0B',
  },

  displayName: { fontSize: FONT.size.xxl, fontWeight: FONT.weight.bold, letterSpacing: -0.5 },
  categoryBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: -4 },
  categoryText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  bio: { fontSize: FONT.size.sm, textAlign: 'center', lineHeight: 20 },
  bioLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -2 },
  bioLinkText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, textDecorationLine: 'underline', maxWidth: 200 },

  statsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginTop: 4 },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold },
  statLabel: { fontSize: FONT.size.xs },
  statDivider: { width: 0.5, height: 28 },

  editBtn: {
    borderWidth: 1, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: 10, marginTop: 4,
  },
  editBtnText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, letterSpacing: 0.1 },

  tabs: { flexDirection: 'row', borderBottomWidth: 0.5 },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabLabel: { fontSize: 12, fontWeight: FONT.weight.medium },
  tabLabelActive: { fontWeight: FONT.weight.bold },

  subTabs: { flexDirection: 'row', borderBottomWidth: 0.5, paddingHorizontal: SPACING.md },
  subTab: { paddingVertical: 9, paddingHorizontal: SPACING.sm, marginRight: 16 },
  subTabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  subTabLabel: { fontSize: 13, fontWeight: FONT.weight.medium },
  subTabLabelActive: { fontWeight: FONT.weight.bold },

  gridRow: { gap: 1 },
  gridItem: { flex: 1 / 3, aspectRatio: 9 / 16, position: 'relative', margin: 0.5 },
  gridThumb: { width: '100%', height: '100%' },
  gridThumbFallback: { backgroundColor: '#001F12', alignItems: 'center', justifyContent: 'center' },
  gridOverlay: {
    position: 'absolute', bottom: 5, left: 5,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  gridViews: { fontSize: FONT.size.xs, color: COLORS.white },
  repostMini: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
    padding: 2,
  },

  threadItem: { padding: SPACING.md, borderBottomWidth: 0.5 },
  threadContent: { fontSize: FONT.size.base, lineHeight: 22 },
  threadMeta: { fontSize: FONT.size.xs, marginTop: 6 },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold },
  emptySubtitle: { fontSize: FONT.size.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
});
