import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createThumbnail } from 'react-native-create-thumbnail';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Modal, Pressable,
  FlatList, ActivityIndicator, Alert, Dimensions, ActionSheetIOS, Platform,
  Share, Linking, NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../api/client';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { IcBack, IcFollow, IcFollowing, IcMail, IcHeart, IcPlay, IcCheck, IcMore, IcShare, IcRepeat } from '../../components/ui/Icons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { Skeleton } from '../../components/ui/Skeleton';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  bio_links: string[];
  profile_category: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  is_following: boolean;
  follower_count: number;
  following_count: number;
  post_count: number;
  gender: 'MALE' | 'FEMALE';
  active_live_session_id: string | null;
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
  if (!v) return null;
  if (v.includes('cloudinary.com')) {
    return v
      .replace('/video/upload/', '/video/upload/so_0,q_auto,f_jpg/')
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

  const [activeTab, setActiveTab] = useState<0 | 1>(0);

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

  const { data: repostsData, isLoading: repostsLoading } = useQuery<{ items: (Post & { _repostedBy?: any })[] }>({
    queryKey: ['user-reposts-public', userId || profile?.id],
    queryFn: () => api.get(`/posts/user/${userId || profile?.id}/reposts`).then(r => r.data).catch(() => ({ items: [] })),
    enabled: !!(userId || profile?.id) && activeTab === 1,
  });

  const { data: userStories } = useQuery<any[]>({
    queryKey: ['user-stories', userId || profile?.id],
    queryFn: () => api.get(`/stories?user_id=${userId || profile?.id}`).then(r => r.data).catch(() => []),
    enabled: !!(userId || profile?.id),
    staleTime: 30_000,
  });
  const hasStory = (userStories ?? []).length > 0;

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

  const [verseModalVisible, setVerseModalVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [showStickyFollow, setShowStickyFollow] = useState(false);
  const headerThreshold = 260;

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setShowStickyFollow(e.nativeEvent.contentOffset.y > headerThreshold);
  }, []);

  const handleBlock = async () => {
    if (!profile) return;
    try {
      if (isBlocked) {
        await api.delete(`/users/${profile.id}/block`).catch(() =>
          api.post(`/users/${profile.id}/unblock`));
        setIsBlocked(false);
        qc.invalidateQueries({ queryKey: ['user-posts-public', profile.id] });
      } else {
        await api.post(`/users/${profile.id}/block`);
        setIsBlocked(true);
        qc.invalidateQueries({ queryKey: ['user-posts-public', profile.id] });
      }
    } catch {}
    setOptionsVisible(false);
  };

  const handleShareProfile = () => {
    if (!profile) return;
    setOptionsVisible(false);
    Share.share({
      message: `Découvre @${profile.username} sur Nour !\nhttps://nour.app/u/${profile.username}`,
    });
  };

  const handleMessage = async () => {
    if (!user || !profile) return;
    if (user.gender !== profile.gender) {
      setVerseModalVisible(true);
      return;
    }
    try {
      const { data } = await api.post('/messages/direct', { recipient_id: profile.id });
      navigation.navigate('Conversation', {
        conversationId: data.conversation_id,
        otherUser: { id: profile.id, display_name: profile.display_name },
      });
    } catch (e: any) {
      // If a prior request exists in non-accepted state, retry won't fail now (backend fixed)
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Impossible d\'ouvrir la conversation.');
    }
  };

  const handleShare = () => {
    if (!profile) return;
    Share.share({
      message: `Découvre @${profile.username} sur Nour !\nhttps://nour.app/u/${profile.username}`,
      url: `https://nour.app/u/${profile.username}`,
    });
  };

  const handleLivePress = () => {
    if (!profile?.active_live_session_id) return;
    navigation.navigate('LiveViewer', { sessionId: profile.active_live_session_id, broadcasterId: profile.id });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
        {/* Skeleton header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
          <Skeleton width={24} height={24} borderRadius={12} />
          <Skeleton width={120} height={16} borderRadius={8} />
          <Skeleton width={24} height={24} borderRadius={12} />
        </View>
        {/* Cover skeleton */}
        <Skeleton width="100%" height={120} borderRadius={0} />
        {/* Hero skeleton */}
        <View style={[{ backgroundColor: theme.surface, padding: 16, gap: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
            <Skeleton width={80} height={80} borderRadius={40} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width={140} height={18} borderRadius={9} />
              <Skeleton width={100} height={13} borderRadius={7} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <Skeleton width={60} height={32} borderRadius={8} />
            <Skeleton width={60} height={32} borderRadius={8} />
            <Skeleton width={60} height={32} borderRadius={8} />
          </View>
          <Skeleton width="100%" height={40} borderRadius={20} />
        </View>
        {/* Grid skeleton */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 1, marginTop: 1 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} width={CELL} height={CELL * 1.5} borderRadius={0} />
          ))}
        </View>
      </View>
    );
  }

  if (!profile) return null;
  const isOwnProfile = user?.id === profile.id;
  const posts = isBlocked ? [] : (postsData?.items ?? []);
  const reposts = isBlocked ? [] : (repostsData?.items ?? []);
  const displayPosts = activeTab === 0 ? posts : reposts;
  const displayLoading = activeTab === 0 ? postsLoading : repostsLoading;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <IcBack size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>@{profile.username}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!isOwnProfile && showStickyFollow && (
            <TouchableOpacity
              style={[styles.stickyFollowBtn, profile.is_following && styles.stickyFollowingBtn]}
              onPress={() => { ReactNativeHapticFeedback.trigger('impactMedium', { enableVibrateFallback: true }); followMutation.mutate(); }}
              disabled={followMutation.isPending}
              activeOpacity={0.85}
            >
              <Text style={[styles.stickyFollowText, profile.is_following && { color: COLORS.primary }]}>
                {profile.is_following ? 'Suivi' : "S'abonner"}
              </Text>
            </TouchableOpacity>
          )}
          {!isOwnProfile && (
            <TouchableOpacity onPress={() => setOptionsVisible(true)} style={styles.backBtn} activeOpacity={0.7}>
              <IcMore size={22} color={theme.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={displayPosts}
        keyExtractor={p => p.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 1, paddingBottom: 40 }}
        columnWrapperStyle={{ gap: 1 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={[styles.hero, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
            {/* Avatar — ring story vert ou ring live rouge */}
            <TouchableOpacity
              style={[
                styles.avatarWrap,
                profile.active_live_session_id && styles.avatarLiveRing,
                hasStory && !profile.active_live_session_id && styles.avatarStoryRing,
              ]}
              activeOpacity={0.85}
              onPress={profile.active_live_session_id ? handleLivePress
                : hasStory ? () => navigation.navigate('StoryViewer', { groups: userStories ?? [], initialGroupIndex: 0 })
                : undefined}
            >
              {profile.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                : <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.primaryBg }]}>
                    <Text style={styles.avatarInitial}>{profile.display_name[0]?.toUpperCase()}</Text>
                  </View>
              }
              {profile.active_live_session_id && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>EN DIRECT</Text>
                </View>
              )}
              {profile.is_verified && !profile.active_live_session_id && (
                <View style={styles.verifiedBadge}>
                  <IcCheck size={9} color={COLORS.white} strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>

            <Text style={[styles.displayName, { color: theme.text }]}>{profile.display_name}</Text>
            {profile.profile_category ? (
              <View style={[styles.categoryBadge, { backgroundColor: `${COLORS.primary}18` }]}>
                <Text style={[styles.categoryText, { color: COLORS.primary }]}>{profile.profile_category}</Text>
              </View>
            ) : null}
            {profile.bio ? <BioText bio={profile.bio} theme={theme} /> : null}
            {profile.bio_links?.length > 0 && (
              <View style={styles.bioLinksRow}>
                {profile.bio_links.map((link, i) => (
                  <TouchableOpacity key={i} onPress={() => Linking.openURL(link).catch(() => {})} activeOpacity={0.75} style={styles.bioLinkPill}>
                    <Text style={styles.bioLinkText} numberOfLines={1}>{link.replace(/^https?:\/\//, '')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

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
                {/* S'abonner — pill vert plein ou outline si suivi */}
                <TouchableOpacity
                  style={[
                    styles.followBtn,
                    profile.is_following
                      ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary, shadowOpacity: 0 }
                      : { backgroundColor: COLORS.primary, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
                  ]}
                  onPress={() => {
                    ReactNativeHapticFeedback.trigger('impactMedium', { enableVibrateFallback: true });
                    followMutation.mutate();
                  }}
                  disabled={followMutation.isPending}
                  activeOpacity={0.85}
                >
                  {profile.is_following
                    ? <IcCheck size={15} color={COLORS.primary} strokeWidth={2.5} />
                    : null
                  }
                  <Text style={[styles.followText, profile.is_following && { color: COLORS.primary }]}>
                    {profile.is_following ? 'Suivi' : "S'abonner"}
                  </Text>
                </TouchableOpacity>

                {/* Message — outline vert */}
                <TouchableOpacity
                  style={[styles.messageBtn, { borderColor: COLORS.primary }]}
                  onPress={handleMessage}
                  activeOpacity={0.8}
                >
                  <IcMail size={15} color={COLORS.primary} />
                  <Text style={[styles.messageBtnText, { color: COLORS.primary }]}>Message</Text>
                </TouchableOpacity>

                {/* Rejoindre live si en direct */}
                {profile.active_live_session_id && (
                  <TouchableOpacity
                    style={styles.liveBtn}
                    onPress={handleLivePress}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.liveBtnText}>En direct</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Tabs */}
            <View style={[styles.tabsRow, { borderTopColor: theme.borderLight }]}>
              <TouchableOpacity
                style={[styles.tabItem, activeTab === 0 && { borderBottomColor: COLORS.primary }]}
                onPress={() => setActiveTab(0)} activeOpacity={0.8}
              >
                <IcPlay size={15} color={activeTab === 0 ? COLORS.primary : theme.textMuted} />
                <Text style={[styles.tabItemText, { color: activeTab === 0 ? COLORS.primary : theme.textMuted }]}>Vidéos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabItem, activeTab === 1 && { borderBottomColor: COLORS.primary }]}
                onPress={() => setActiveTab(1)} activeOpacity={0.8}
              >
                <IcRepeat size={15} color={activeTab === 1 ? COLORS.primary : theme.textMuted} />
                <Text style={[styles.tabItemText, { color: activeTab === 1 ? COLORS.primary : theme.textMuted }]}>Reposts</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item: p }) => (
          <LazyVideoCell
            post={p}
            theme={theme}
            showRepostBadge={activeTab === 1}
            onPress={() => navigation.navigate('VideoPlayer', { postId: p.id })}
            onLongPress={() => { ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true }); setPreviewPost(p); }}
          />
        )}
        ListEmptyComponent={
          displayLoading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} width={CELL} height={CELL * 1.5} borderRadius={0} />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>Aucune publication</Text>
            </View>
          )
        }
      />

      {/* Modal options profil */}
      <Modal visible={optionsVisible} transparent animationType="slide" onRequestClose={() => setOptionsVisible(false)}>
        <Pressable style={optStyles.backdrop} onPress={() => setOptionsVisible(false)}>
          <Pressable style={[optStyles.sheet, { backgroundColor: theme.isDark ? '#1A1A1A' : '#fff' }]}>
            <View style={optStyles.sheetTop}>
              <View style={optStyles.handle} />
              <TouchableOpacity onPress={() => setOptionsVisible(false)} style={optStyles.closeBtn} activeOpacity={0.7}>
                <Text style={[optStyles.closeX, { color: theme.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Avatar + nom */}
            <View style={optStyles.profileRow}>
              {profile?.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={optStyles.avatar} />
                : <View style={optStyles.avatarFallback}><Text style={optStyles.avatarInitial}>{profile?.display_name?.[0]}</Text></View>}
              <Text style={[optStyles.profileName, { color: theme.text }]}>{profile?.display_name}</Text>
              <Text style={[optStyles.profileHandle, { color: theme.textMuted }]}>@{profile?.username}</Text>
            </View>

            <View style={[optStyles.divider, { backgroundColor: theme.border }]} />

            {/* Partager */}
            <TouchableOpacity style={optStyles.option} onPress={handleShareProfile} activeOpacity={0.7}>
              <View style={[optStyles.optionIcon, { backgroundColor: '#EEF2FF' }]}>
                <IcShare size={20} color="#6366F1" />
              </View>
              <View style={optStyles.optionText}>
                <Text style={[optStyles.optionTitle, { color: theme.text }]}>Partager ce profil</Text>
                <Text style={[optStyles.optionSub, { color: theme.textMuted }]}>Envoie le lien à quelqu'un</Text>
              </View>
            </TouchableOpacity>

            {/* Bloquer / Débloquer */}
            <TouchableOpacity style={optStyles.option} onPress={handleBlock} activeOpacity={0.7}>
              <View style={[optStyles.optionIcon, { backgroundColor: isBlocked ? '#F0FDF4' : '#FEF2F2' }]}>
                <Text style={{ fontSize: 20 }}>{isBlocked ? '🔓' : '🚫'}</Text>
              </View>
              <View style={optStyles.optionText}>
                <Text style={[optStyles.optionTitle, { color: isBlocked ? '#16A34A' : '#EF4444' }]}>
                  {isBlocked ? `Débloquer @${profile?.username}` : `Bloquer @${profile?.username}`}
                </Text>
                <Text style={[optStyles.optionSub, { color: theme.textMuted }]}>
                  {isBlocked ? 'Tu reverras ses vidéos dans ton feed' : 'Ses vidéos n\'apparaîtront plus dans ton feed'}
                </Text>
              </View>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal verset coranique — messagerie cross-genre */}
      <Modal visible={verseModalVisible} transparent animationType="fade" onRequestClose={() => setVerseModalVisible(false)}>
        <Pressable style={verseStyles.backdrop} onPress={() => setVerseModalVisible(false)}>
          <Pressable style={verseStyles.card}>
            <Text style={verseStyles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
            <Text style={verseStyles.arabic}>
              وَلَا تَقْرَبُوا۟ ٱلزِّنَىٰٓ ۖ إِنَّهُۥ كَانَ فَـٰحِشَةًۭ وَسَآءَ سَبِيلًۭا ٣٢
            </Text>
            <Text style={verseStyles.french}>
              « Et n'approchez point la fornication. En vérité, c'est une turpitude et quel mauvais chemin ! »
            </Text>
            <Text style={verseStyles.ref}>Sourate Al-Isrâ' (17:32)</Text>
            <Text style={verseStyles.note}>
              Sur Nour, la messagerie entre frères et sœurs non mahrams n'est pas autorisée afin de préserver les limites qu'Allah a fixées.
            </Text>
            <TouchableOpacity style={verseStyles.btn} onPress={() => setVerseModalVisible(false)} activeOpacity={0.8}>
              <Text style={verseStyles.btnText}>J'ai compris</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Long-press video preview */}
      <Modal visible={!!previewPost} transparent animationType="fade" onRequestClose={() => setPreviewPost(null)}>
        <Pressable style={previewStyles.backdrop} onPress={() => setPreviewPost(null)}>
          <Pressable style={[previewStyles.card, { backgroundColor: theme.surface }]}>
            {previewPost && (
              <>
                <Image
                  source={{ uri: getThumbUrl(previewPost) ?? undefined }}
                  style={previewStyles.thumb}
                  resizeMode="cover"
                />
                {previewPost.caption ? (
                  <Text style={[previewStyles.caption, { color: theme.text }]} numberOfLines={2}>{previewPost.caption}</Text>
                ) : null}
                <View style={previewStyles.stats}>
                  <IcPlay size={13} color={theme.textMuted} />
                  <Text style={[previewStyles.stat, { color: theme.textMuted }]}>{fmtNum(previewPost.view_count)}</Text>
                  <IcHeart size={13} color={theme.textMuted} />
                  <Text style={[previewStyles.stat, { color: theme.textMuted }]}>{fmtNum(previewPost.like_count)}</Text>
                </View>
                <TouchableOpacity
                  style={previewStyles.viewBtn}
                  onPress={() => { setPreviewPost(null); navigation.navigate('VideoPlayer', { postId: previewPost.id }); }}
                  activeOpacity={0.8}
                >
                  <Text style={previewStyles.viewBtnText}>Voir la vidéo</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const USER_THUMB_CACHE = new Map<string, string>();

function LazyVideoCell({ post: p, theme, onPress, onLongPress, showRepostBadge }: { post: Post; theme: any; onPress: () => void; onLongPress?: () => void; showRepostBadge?: boolean }) {
  const precomputed = getThumbUrl(p);
  const [thumb, setThumb] = useState<string | null>(precomputed ?? USER_THUMB_CACHE.get(p.id) ?? null);
  const [loading, setLoading] = useState(!thumb && !!p.video_url);

  useEffect(() => {
    if (thumb || !p.video_url) return;
    if (USER_THUMB_CACHE.has(p.id)) { setThumb(USER_THUMB_CACHE.get(p.id)!); setLoading(false); return; }
    createThumbnail({ url: p.video_url, timeStamp: 0, format: 'jpeg' })
      .then(r => { USER_THUMB_CACHE.set(p.id, r.path); setThumb(r.path); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [p.id]);

  return (
    <TouchableOpacity style={[styles.cell, { backgroundColor: theme.surface }]} onPress={onPress} onLongPress={onLongPress} delayLongPress={350} activeOpacity={0.85}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.cellImg} resizeMode="cover" />
      ) : loading ? (
        <View style={[styles.cellImg, styles.cellFallback, { backgroundColor: theme.card }]}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : (
        <View style={[styles.cellImg, styles.cellFallback, { backgroundColor: theme.card }]}>
          <IcPlay size={24} color={COLORS.primaryLight} />
        </View>
      )}
      <View style={styles.cellOverlay}>
        <IcPlay size={10} color={COLORS.white} />
        <Text style={styles.cellCount}>{fmtNum(p.view_count)}</Text>
      </View>
      {showRepostBadge && (
        <View style={styles.repostMini}>
          <IcRepeat size={11} color={COLORS.white} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const URL_REGEX = /https?:\/\/[^\s]+/g;

function BioText({ bio, theme }: { bio: string; theme: any }) {
  const parts: { text: string; isLink: boolean }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_REGEX.source, 'g');
  while ((match = re.exec(bio)) !== null) {
    if (match.index > lastIndex) parts.push({ text: bio.slice(lastIndex, match.index), isLink: false });
    parts.push({ text: match[0], isLink: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < bio.length) parts.push({ text: bio.slice(lastIndex), isLink: false });

  return (
    <Text style={[styles.bio, { color: theme.textMuted }]}>
      {parts.map((p, i) =>
        p.isLink
          ? <Text key={i} style={{ color: COLORS.primary, textDecorationLine: 'underline' }}
              onPress={() => Linking.openURL(p.text).catch(() => {})}>{p.text}</Text>
          : <Text key={i}>{p.text}</Text>
      )}
    </Text>
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
  avatarLiveRing: { padding: 3, borderRadius: 50, borderWidth: 3, borderColor: '#FF3B30' },
  avatarStoryRing: {
    padding: 3, borderRadius: 50, borderWidth: 3, borderColor: '#00E57A',
    shadowColor: '#00E57A', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85, shadowRadius: 8, elevation: 8,
  },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { borderWidth: 3, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 34, fontWeight: FONT.weight.bold, color: COLORS.primary },
  verifiedBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute', bottom: -10, left: '50%', transform: [{ translateX: -28 }],
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF3B30', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.white },
  liveText: { fontSize: 9, fontWeight: FONT.weight.bold, color: COLORS.white, letterSpacing: 0.3 },

  displayName: { fontSize: FONT.size.xxl, fontWeight: FONT.weight.bold, letterSpacing: -0.3 },
  categoryBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4, alignSelf: 'center' },
  categoryText: { fontSize: FONT.size.xs, fontWeight: '700', letterSpacing: 0.3 },
  bio: { fontSize: FONT.size.sm, textAlign: 'center', lineHeight: 20 },
  bioLinksRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 6 },
  bioLinkPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,176,90,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  bioLinkText: { fontSize: FONT.size.xs, color: COLORS.primary, fontWeight: FONT.weight.semibold, maxWidth: 160 },

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
  stickyFollowBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  stickyFollowingBtn: {
    backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary,
  },
  stickyFollowText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  messageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: RADIUS.full, paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1.5,
  },
  messageBtnText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  liveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#FF3B30', borderRadius: RADIUS.full,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  liveBtnText: { fontSize: FONT.size.sm, fontWeight: '700', color: '#fff' },

  tabsRow: {
    flexDirection: 'row', width: '100%', marginTop: 4, borderTopWidth: 1,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  repostMini: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: 2,
  },

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

const optStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36 },
  sheetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingHorizontal: 16, position: 'relative' },
  handle: { width: 36, height: 4, backgroundColor: '#ccc', borderRadius: 2 },
  closeBtn: { position: 'absolute', right: 16, top: 8, padding: 8 },
  closeX: { fontSize: 16, fontWeight: '600' },
  profileRow: { alignItems: 'center', paddingVertical: 20, gap: 4 },
  avatar: { width: 60, height: 60, borderRadius: 30, marginBottom: 4 },
  avatarFallback: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarInitial: { color: '#fff', fontSize: 24, fontWeight: '700' },
  profileName: { fontSize: 16, fontWeight: '700' },
  profileHandle: { fontSize: 13 },
  divider: { height: 1, marginHorizontal: 16, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  optionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 15, fontWeight: '600' },
  optionSub: { fontSize: 12 },
});

const verseStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#0F1A12', borderRadius: 20,
    padding: 28, width: '100%', maxWidth: 380,
    borderWidth: 1, borderColor: '#2D7A4F',
    alignItems: 'center', gap: 14,
  },
  bismillah: {
    fontSize: 16, color: '#C9A84C',
    fontFamily: 'System', textAlign: 'center',
  },
  arabic: {
    fontSize: 22, color: COLORS.white, textAlign: 'center',
    lineHeight: 38, direction: 'rtl',
  },
  french: {
    fontSize: 14, color: '#D1D5DB', textAlign: 'center',
    fontStyle: 'italic', lineHeight: 22,
  },
  ref: {
    fontSize: 12, color: '#C9A84C', textAlign: 'center',
  },
  note: {
    fontSize: 12, color: '#9CA3AF', textAlign: 'center',
    lineHeight: 18, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: '#1F2D22',
  },
  btn: {
    marginTop: 4, backgroundColor: '#2D7A4F',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32,
  },
  btnText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
});

const previewStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', borderRadius: 20, overflow: 'hidden', gap: 12, paddingBottom: 16 },
  thumb: { width: '100%', aspectRatio: 9 / 16, maxHeight: 400 },
  caption: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  stat: { fontSize: 13 },
  viewBtn: {
    marginHorizontal: 16, backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingVertical: 12, alignItems: 'center',
  },
  viewBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
