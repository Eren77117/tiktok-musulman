import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Animated,
  TextInput, KeyboardAvoidingView, Platform, FlatList, Modal, Pressable,
  ActivityIndicator, Dimensions, Alert, Share, ActionSheetIOS,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { COLORS, FONT, RADIUS } from '../../constants/theme';
import { IcBack, IcHeart, IcHeartFill, IcSend, IcEye, IcMore } from '../../components/ui/Icons';

const { width: W, height: H } = Dimensions.get('window');
const STORY_DURATION = 5000;

interface Story {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  user: { id: string; display_name: string; avatar_url: string | null; gender: string };
  is_viewed: boolean;
  is_liked: boolean;
  views_count: number;
  likes_count: number;
  replies_count: number;
  created_at: string;
  expires_at: string;
}

interface StoryGroup {
  user: Story['user'];
  stories: Story[];
}

export default function StoryViewerScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user: me } = useAuthStore();
  const qc = useQueryClient();

  const { groups, initialGroupIndex = 0 } = route.params as { groups: StoryGroup[]; initialGroupIndex: number };

  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [showViewers, setShowViewers] = useState(false);
  const [paused, setPaused] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const isOwnStory = story?.user.id === me?.id;
  const canReply = !isOwnStory && me?.gender === story?.user.gender;

  // Mark as viewed
  useEffect(() => {
    if (!story) return;
    api.post(`/stories/${story.id}/view`).catch(() => {});
  }, [story?.id]);

  // Progress bar animation
  useEffect(() => {
    if (!story || paused) return;
    progress.setValue(0);
    anim.current?.stop();
    anim.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => anim.current?.stop();
  }, [story?.id, paused]);

  const goNext = () => {
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx(i => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(i => i + 1);
      setStoryIdx(0);
    } else {
      nav.goBack();
    }
  };

  const goPrev = () => {
    if (storyIdx > 0) setStoryIdx(i => i - 1);
    else if (groupIdx > 0) {
      setGroupIdx(i => i - 1);
      setStoryIdx(0);
    }
  };

  const { mutate: toggleLike, isPending: liking } = useMutation({
    mutationFn: () => api.post(`/stories/${story.id}/like`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories-feed'] });
      qc.invalidateQueries({ queryKey: ['stories-mine'] });
    },
  });

  const { mutate: deleteStory } = useMutation({
    mutationFn: () => api.delete(`/stories/${story.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories-mine'] });
      qc.invalidateQueries({ queryKey: ['stories-feed'] });
      nav.goBack();
    },
    onError: () => Alert.alert('Erreur', 'Impossible de supprimer la story.'),
  });

  const handleOptions = () => {
    const shareUrl = `https://nour.app/story/${story.id}`;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Partager', 'Supprimer', 'Annuler'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) Share.share({ message: `Regarde ma story sur Nour ! ${shareUrl}` });
          if (i === 1) Alert.alert('Supprimer', 'Supprimer cette story définitivement ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: () => deleteStory() },
          ]);
        }
      );
    } else {
      Alert.alert('Options', undefined, [
        { text: '📤 Partager', onPress: () => Share.share({ message: `Regarde ma story sur Nour ! ${shareUrl}` }) },
        { text: '🗑 Supprimer', style: 'destructive', onPress: () =>
          Alert.alert('Supprimer', 'Supprimer cette story définitivement ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: () => deleteStory() },
          ])
        },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  };

  const { mutate: sendReply, isPending: replying } = useMutation({
    mutationFn: (content: string) => api.post(`/stories/${story.id}/reply`, { content }),
    onSuccess: () => { setReplyText(''); },
  });

  const { data: viewers } = useQuery({
    queryKey: ['story-viewers', story?.id],
    queryFn: () => api.get(`/stories/${story!.id}/views`).then(r => r.data),
    enabled: showViewers && isOwnStory,
  });

  if (!story) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Progress bars */}
      <View style={styles.progressRow}>
        {group.stories.map((s, i) => (
          <View key={s.id} style={styles.progressTrack}>
            <Animated.View style={[
              styles.progressFill,
              i < storyIdx ? styles.progressDone
              : i === storyIdx ? { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }
              : styles.progressEmpty,
            ]} />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={styles.storyHeader}>
        <TouchableOpacity onPress={() => nav.goBack()} activeOpacity={0.8} style={styles.backBtn}>
          <IcBack size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.userInfo}>
          {story.user.avatar_url
            ? <Image source={{ uri: story.user.avatar_url }} style={styles.avatar} />
            : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{story.user.display_name[0]}</Text></View>}
          <Text style={styles.username}>{story.user.display_name}</Text>
        </View>
        {isOwnStory && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => setShowViewers(true)} activeOpacity={0.8} style={styles.viewersBtn}>
              <IcEye size={18} color="#fff" />
              <Text style={styles.viewersCount}>{story.views_count}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleOptions} activeOpacity={0.8} style={{ padding: 4 }}>
              <IcMore size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Media */}
      <TouchableOpacity activeOpacity={1} onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)} style={styles.media}>
        <TouchableOpacity style={styles.tapLeft} activeOpacity={1} onPress={goPrev} />
        <Image source={{ uri: story.media_url }} style={styles.image} resizeMode="cover" />
        <TouchableOpacity style={styles.tapRight} activeOpacity={1} onPress={goNext} />
      </TouchableOpacity>

      {/* Bottom — like + réponse */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottom}>
        <View style={styles.bottomRow}>
          {canReply && (
            <TextInput
              style={styles.replyInput}
              placeholder="Répondre..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={replyText}
              onChangeText={setReplyText}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
            />
          )}
          {canReply && replyText.length > 0 && (
            <TouchableOpacity
              onPress={() => sendReply(replyText)}
              disabled={replying}
              style={styles.sendBtn}
              activeOpacity={0.8}
            >
              {replying ? <ActivityIndicator size="small" color="#fff" /> : <IcSend size={20} color="#fff" />}
            </TouchableOpacity>
          )}
          {!isOwnStory && (
            <TouchableOpacity onPress={() => toggleLike()} disabled={liking} style={styles.likeBtn} activeOpacity={0.8}>
              {story.is_liked
                ? <IcHeartFill size={26} color="#FF3B5C" />
                : <IcHeart size={26} color="#fff" />}
            </TouchableOpacity>
          )}
          {isOwnStory && (
            <View style={styles.statsRow}>
              <View style={styles.stat}><IcEye size={16} color="rgba(255,255,255,0.8)" /><Text style={styles.statText}>{story.views_count}</Text></View>
              <View style={styles.stat}><IcHeartFill size={16} color="#FF3B5C" /><Text style={styles.statText}>{story.likes_count}</Text></View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Modal vues */}
      <Modal visible={showViewers} transparent animationType="slide" onRequestClose={() => setShowViewers(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowViewers(false)}>
          <Pressable style={styles.viewersSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Vues ({story.views_count})</Text>
            <FlatList
              data={viewers ?? []}
              keyExtractor={(v: any) => v.id}
              renderItem={({ item: v }: any) => (
                <View style={styles.viewerRow}>
                  {v.viewer?.avatar_url
                    ? <Image source={{ uri: v.viewer.avatar_url }} style={styles.viewerAvatar} />
                    : <View style={styles.viewerAvatarFallback}><Text style={styles.viewerInitial}>{v.viewer?.display_name?.[0]}</Text></View>}
                  <Text style={styles.viewerName}>{v.viewer?.display_name}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucune vue pour l'instant</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  progressRow: { flexDirection: 'row', gap: 3, paddingHorizontal: 12, paddingBottom: 8 },
  progressTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  progressDone: { width: '100%', backgroundColor: '#fff' },
  progressEmpty: { width: '0%' },
  storyHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  backBtn: { padding: 4 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: COLORS.primary },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontWeight: '700', fontSize: 14 },
  username: { color: '#fff', fontWeight: '600', fontSize: 14 },
  viewersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewersCount: { color: '#fff', fontSize: 13 },
  media: { flex: 1, position: 'relative' },
  image: { width: W, height: '100%' },
  tapLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: W * 0.35, zIndex: 10 },
  tapRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: W * 0.35, zIndex: 10 },
  bottom: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  replyInput: {
    flex: 1, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 16, color: '#fff', fontSize: 14,
  },
  sendBtn: { padding: 8 },
  likeBtn: { padding: 8, marginLeft: 'auto' },
  statsRow: { flexDirection: 'row', gap: 16, marginLeft: 'auto' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: '#fff', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  viewersSheet: {
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: H * 0.6,
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { color: '#fff', fontSize: FONT.size.lg, fontWeight: '700', marginBottom: 16 },
  viewerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  viewerAvatar: { width: 40, height: 40, borderRadius: 20 },
  viewerAvatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  viewerInitial: { color: '#fff', fontWeight: '700' },
  viewerName: { color: '#fff', fontSize: 15 },
  emptyText: { color: '#666', textAlign: 'center', paddingTop: 20 },
});
