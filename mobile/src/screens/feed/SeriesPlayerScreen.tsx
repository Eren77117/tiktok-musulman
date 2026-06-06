import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, Dimensions, ActivityIndicator, Image,
} from 'react-native';
import Video, { OnProgressData, OnLoadData } from 'react-native-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { COLORS, FONT, RADIUS } from '../../constants/theme';
import { IcBack, IcPlay, IcPause } from '../../components/ui/Icons';
import { RootStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'SeriesPlayer'>;

const { width: W, height: H } = Dimensions.get('window');
const COUNTDOWN = 5; // seconds before auto-advance

interface Episode {
  id: string;
  episode_num: number;
  post: {
    id: string;
    video_url: string;
    thumbnail_url: string | null;
    caption: string;
    duration: number | null;
    view_count: number;
    like_count: number;
    user: { id: string; username: string; display_name: string; avatar_url: string | null };
  };
}

interface Series {
  id: string;
  title: string;
  description: string | null;
  episodes: Episode[];
}

function EpisodePlayer({
  episode, isActive, onEnd,
}: {
  episode: Episode; isActive: boolean; onEnd: () => void;
}) {
  const [paused, setPaused] = useState(!isActive);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<any>(null);

  useEffect(() => {
    setPaused(!isActive);
    if (isActive) setProgress(0);
  }, [isActive]);

  const handleLoad = (data: OnLoadData) => {
    setDuration(data.duration);
    setReady(true);
  };

  const handleProgress = (data: OnProgressData) => {
    setProgress(data.currentTime);
  };

  const handleEnd = () => {
    onEnd();
  };

  const pct = duration > 0 ? progress / duration : 0;

  return (
    <View style={styles.episodeContainer}>
      {episode.post.thumbnail_url && !ready && (
        <Image source={{ uri: episode.post.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}
      <Video
        ref={videoRef}
        source={{ uri: episode.post.video_url }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        paused={paused}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={handleEnd}
        progressUpdateInterval={500}
      />

      {/* Top info */}
      <View style={styles.episodeInfo}>
        <View style={styles.episodeNumBadge}>
          <Text style={styles.episodeNumTxt}>Ép. {episode.episode_num}</Text>
        </View>
        {episode.post.caption ? (
          <Text style={styles.captionTxt} numberOfLines={2}>{episode.post.caption}</Text>
        ) : null}
      </View>

      {/* Play/pause tap */}
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPaused(v => !v)} activeOpacity={1}>
        {paused && ready && (
          <View style={styles.pauseIndicator}>
            <IcPlay size={48} color="rgba(255,255,255,0.9)" />
          </View>
        )}
      </TouchableOpacity>

      {/* Progress bar */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

function CountdownOverlay({ onSkip, onCancel }: { onSkip: () => void; onCancel: () => void }) {
  const [count, setCount] = useState(COUNTDOWN);
  const circleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(prev => {
        if (prev <= 1) { clearInterval(interval); onSkip(); return 0; }
        return prev - 1;
      });
    }, 1000);
    Animated.timing(circleAnim, {
      toValue: 0, duration: COUNTDOWN * 1000, useNativeDriver: false,
    }).start();
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.countdownOverlay}>
      <View style={styles.countdownCard}>
        <Text style={styles.countdownLabel}>Prochain épisode</Text>
        <View style={styles.countdownCircle}>
          <Text style={styles.countdownNum}>{count}</Text>
        </View>
        <View style={styles.countdownBtns}>
          <TouchableOpacity style={styles.countdownSkip} onPress={onSkip} activeOpacity={0.85}>
            <Text style={styles.countdownSkipTxt}>Lancer maintenant</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.countdownCancel} onPress={onCancel} activeOpacity={0.85}>
            <Text style={styles.countdownCancelTxt}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function SeriesPlayerScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { seriesId, startEpisode = 0 } = route.params;

  const { data: series, isLoading } = useQuery<Series>({
    queryKey: ['series', seriesId],
    queryFn: () => api.get(`/series/${seriesId}`).then(r => r.data),
  });

  const flatRef = useRef<FlatList>(null);
  const [currentIdx, setCurrentIdx] = useState(startEpisode);
  const [showCountdown, setShowCountdown] = useState(false);

  const episodes = series?.episodes ?? [];

  const handleEpisodeEnd = useCallback(() => {
    if (currentIdx < episodes.length - 1) {
      setShowCountdown(true);
    }
  }, [currentIdx, episodes.length]);

  const advanceEpisode = useCallback(() => {
    setShowCountdown(false);
    const next = currentIdx + 1;
    setCurrentIdx(next);
    flatRef.current?.scrollToIndex({ index: next, animated: true });
  }, [currentIdx]);

  const cancelCountdown = useCallback(() => {
    setShowCountdown(false);
  }, []);

  const renderItem = useCallback(({ item, index }: { item: Episode; index: number }) => (
    <EpisodePlayer
      episode={item}
      isActive={index === currentIdx && !showCountdown}
      onEnd={handleEpisodeEnd}
    />
  ), [currentIdx, showCountdown, handleEpisodeEnd]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <IcBack size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.seriesTitle} numberOfLines={1}>{series?.title}</Text>
          <Text style={styles.episodeCounter}>{currentIdx + 1} / {episodes.length}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Episode pills */}
      <View style={styles.pillsRow}>
        {episodes.map((_, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.pill, i === currentIdx && styles.pillActive]}
            onPress={() => { setCurrentIdx(i); setShowCountdown(false); flatRef.current?.scrollToIndex({ index: i, animated: true }); }}
            activeOpacity={0.8}
          />
        ))}
      </View>

      <FlatList
        ref={flatRef}
        data={episodes}
        keyExtractor={ep => ep.id}
        renderItem={renderItem}
        pagingEnabled
        horizontal={false}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        getItemLayout={(_, index) => ({ length: H, offset: H * index, index })}
        initialScrollIndex={startEpisode}
      />

      {showCountdown && (
        <CountdownOverlay onSkip={advanceEpisode} onCancel={cancelCountdown} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  seriesTitle: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold, color: COLORS.white },
  episodeCounter: { fontSize: FONT.size.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  pillsRow: {
    position: 'absolute', top: 90, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'center', gap: 4, paddingHorizontal: 20,
  },
  pill: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', maxWidth: 40 },
  pillActive: { backgroundColor: COLORS.primary },

  episodeContainer: { width: W, height: H, backgroundColor: COLORS.black },
  episodeInfo: {
    position: 'absolute', bottom: 80, left: 16, right: 70,
    gap: 6,
  },
  episodeNumBadge: {
    backgroundColor: 'rgba(0,176,90,0.85)', borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start',
  },
  episodeNumTxt: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, color: COLORS.white },
  captionTxt: { fontSize: FONT.size.sm, color: COLORS.white, lineHeight: 20 },
  pauseIndicator: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  progressBg: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 3, backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary },

  countdownOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', zIndex: 20,
  },
  countdownCard: {
    backgroundColor: '#111', borderRadius: 20, padding: 28,
    alignItems: 'center', width: 280, gap: 16,
  },
  countdownLabel: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold, color: COLORS.white },
  countdownCircle: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  countdownNum: { fontSize: 32, fontWeight: FONT.weight.bold, color: COLORS.white },
  countdownBtns: { width: '100%', gap: 10 },
  countdownSkip: {
    backgroundColor: COLORS.primary, borderRadius: 100,
    paddingVertical: 13, alignItems: 'center',
  },
  countdownSkipTxt: { color: COLORS.white, fontWeight: FONT.weight.bold, fontSize: FONT.size.base },
  countdownCancel: { paddingVertical: 8, alignItems: 'center' },
  countdownCancelTxt: { color: 'rgba(255,255,255,0.6)', fontSize: FONT.size.sm },
});
