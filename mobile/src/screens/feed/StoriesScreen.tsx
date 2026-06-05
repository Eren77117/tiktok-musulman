import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Animated, PanResponder, Dimensions, StatusBar, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { IcClose, IcEye } from '../../components/ui/Icons';

const { width: W, height: H } = Dimensions.get('window');

interface StoryUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  duration: number;
  view_count: number;
  expires_at: string;
  created_at: string;
  user: StoryUser;
  is_viewed: boolean;
  linked_post_id?: string | null;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Stories'>;

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

export default function StoriesScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { userId } = route.params;

  const [stories, setStories] = useState<Story[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const viewedIds = useRef<Set<string>>(new Set());

  // ── Load stories ─────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/stories', { params: { user_id: userId } })
      .then(r => {
        const data: Story[] = r.data?.stories ?? r.data ?? [];
        if (data.length === 0) { nav.goBack(); return; }
        setStories(data);
        setLoading(false);
      })
      .catch(() => nav.goBack());
  }, [userId]);

  // ── Mark viewed ──────────────────────────────────────────────────────────────
  const markViewed = useCallback((story: Story) => {
    if (viewedIds.current.has(story.id)) return;
    viewedIds.current.add(story.id);
    api.post(`/stories/${story.id}/view`).catch(() => {});
  }, []);

  // ── Animate progress bar ─────────────────────────────────────────────────────
  const startProgress = useCallback((story: Story) => {
    progress.setValue(0);
    animRef.current?.stop();
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: (story.duration ?? 5) * 1000,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) goNext();
    });
  }, [progress]);

  useEffect(() => {
    if (!stories.length || loading) return;
    const story = stories[index];
    markViewed(story);
    if (!paused) startProgress(story);
    return () => animRef.current?.stop();
  }, [index, stories, loading, paused]);

  useEffect(() => {
    if (paused) {
      animRef.current?.stop();
    } else if (stories[index]) {
      startProgress(stories[index]);
    }
  }, [paused]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    setIndex(i => {
      if (i + 1 >= stories.length) { nav.goBack(); return i; }
      return i + 1;
    });
  }, [stories.length, nav]);

  const goPrev = useCallback(() => {
    setIndex(i => Math.max(0, i - 1));
  }, []);

  // ── Swipe down to close ──────────────────────────────────────────────────────
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10 && g.dy > 0,
      onPanResponderGrant: () => animRef.current?.stop(),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100) {
          Animated.timing(translateY, { toValue: H, duration: 200, useNativeDriver: true }).start(() => nav.goBack());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          if (stories[index]) startProgress(stories[index]);
        }
      },
    })
  ).current;

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={COLORS.white} size="large" />
      </View>
    );
  }

  if (!stories.length) return null;

  const story = stories[index];

  return (
    <Animated.View style={[styles.root, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
      <StatusBar hidden />

      {/* Media */}
      {story.media_type === 'video' ? (
        <Video
          source={{ uri: story.media_url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          paused={paused}
          repeat={false}
          onEnd={goNext}
        />
      ) : (
        <Image source={{ uri: story.media_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}

      {/* Dark gradients overlay */}
      <View style={styles.topGradient} pointerEvents="none" />
      <View style={styles.bottomGradient} pointerEvents="none" />

      {/* Progress bars */}
      <View style={[styles.progressRow, { top: insets.top + 8 }]}>
        {stories.map((s, i) => (
          <View key={s.id} style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: i < index
                    ? '100%'
                    : i === index
                    ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                    : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Top header */}
      <View style={[styles.header, { top: insets.top + 22 }]}>
        <Image
          source={story.user.avatar_url ? { uri: story.user.avatar_url } : { uri: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(story.user.display_name) + '&background=2D7A4F&color=fff' }}
          style={styles.avatar}
        />
        <View style={styles.headerText}>
          <Text style={styles.displayName}>{story.user.display_name}</Text>
          <Text style={styles.timeAgo}>{timeAgo(story.created_at)}</Text>
        </View>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <IcClose size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Tap zones */}
      <View style={styles.tapZones} pointerEvents="box-none">
        <TouchableOpacity style={styles.tapLeft} activeOpacity={1} onPress={goPrev} />
        <TouchableOpacity style={styles.tapRight} activeOpacity={1} onPress={goNext} />
      </View>

      {/* Bottom */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.viewCount}>
          <IcEye size={16} color={COLORS.white} />
          <Text style={styles.viewCountText}>{story.view_count ?? 0}</Text>
        </View>

        {story.linked_post_id && (
          <TouchableOpacity
            style={styles.viewVideoBtn}
            onPress={() => nav.navigate('VideoPlayer', { postId: story.linked_post_id! })}
            activeOpacity={0.85}
          >
            <Text style={styles.viewVideoText}>Voir la vidéo</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.black,
    width: W,
    height: H,
  },
  loader: {
    flex: 1,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 160,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 140,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  progressRow: {
    position: 'absolute', left: SPACING.sm, right: SPACING.sm,
    flexDirection: 'row', gap: 4, zIndex: 20,
  },
  progressTrack: {
    flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: RADIUS.full, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
  },
  header: {
    position: 'absolute', left: SPACING.md, right: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 20,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: COLORS.white,
  },
  headerText: { flex: 1 },
  displayName: {
    fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.white,
  },
  timeAgo: {
    fontSize: FONT.size.xs, color: 'rgba(255,255,255,0.7)',
  },
  tapZones: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', zIndex: 10,
  },
  tapLeft: { flex: 1 },
  tapRight: { flex: 1 },
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.md, alignItems: 'center', zIndex: 20,
  },
  viewCount: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
  },
  viewCountText: {
    fontSize: FONT.size.sm, color: COLORS.white, fontWeight: FONT.weight.medium,
  },
  viewVideoBtn: {
    marginTop: SPACING.sm,
    paddingVertical: 10, paddingHorizontal: 28,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  viewVideoText: {
    fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.white,
  },
});
