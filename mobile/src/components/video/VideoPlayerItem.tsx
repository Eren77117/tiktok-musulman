import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Image, ActivityIndicator, Animated, Share, Pressable, PanResponder,
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'react-native-linear-gradient';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, RADIUS } from '../../constants/theme';
import {
  IcHeartFill, IcHeart, IcComment, IcShare, IcSave, IcSaveFill,
  IcMusic, IcPlay, IcVolume, IcMute, IcCheck,
} from '../ui/Icons';

const { width: W, height: H } = Dimensions.get('window');

export interface FeedPost {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  duration: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  is_liked: boolean;
  is_saved?: boolean;
  user: {
    id: string; username: string; display_name: string;
    avatar_url: string | null; is_verified: boolean;
  };
  sound: { id: string; title: string; artist: string | null } | null;
}

interface Props {
  post: FeedPost;
  isVisible: boolean;
  onComment: () => void;
  /** Height allocated for this item (screen H minus tab bar) */
  itemHeight?: number;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function VideoPlayerItem({ post, isVisible, onComment, itemHeight }: Props) {
  const ITEM_H = itemHeight ?? H;
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const videoRef = useRef<VideoRef>(null);

  // Playback state
  const [liked, setLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [saved, setSaved] = useState(post.is_saved ?? false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(!isVisible);
  const [rate, setRate] = useState(1);
  const [buffering, setBuffering] = useState(true);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1

  // Long-press zone tracking
  const longPressZoneRef = useRef<'left' | 'middle' | 'right' | null>(null);
  const pausedBeforeLongRef = useRef(false);

  // Double-tap like (instant — no delay on double tap)
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartAnim = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0.3)).current;
  const [heartPos, setHeartPos] = useState({ x: W / 2 - 50, y: H / 2 - 80 });

  // Pause indicator
  const pauseAnim = useRef(new Animated.Value(0)).current;

  // Speed indicator
  const speedAnim = useRef(new Animated.Value(0)).current;

  // Seek state
  const [seeking, setSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const totalDurationRef = useRef(post.duration || 0);

  const seekPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setSeeking(true);
      const pct = Math.max(0, Math.min(1, evt.nativeEvent.locationX / W));
      const time = pct * totalDurationRef.current;
      setSeekTime(time);
      setProgress(pct);
      videoRef.current?.seek(time);
    },
    onPanResponderMove: (_, g) => {
      const raw = g.moveX; // absolute X on screen
      const pct = Math.max(0, Math.min(1, raw / W));
      const time = pct * totalDurationRef.current;
      setSeekTime(time);
      setProgress(pct);
      videoRef.current?.seek(time);
    },
    onPanResponderRelease: () => setSeeking(false),
    onPanResponderTerminate: () => setSeeking(false),
  })).current;

  // Horizontal swipe → profile
  const swipeX = useRef(new Animated.Value(0)).current;
  const profilePanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => { if (g.dx < 0) swipeX.setValue(g.dx); },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -80 || g.vx < -0.5) {
        Animated.timing(swipeX, { toValue: -W, duration: 200, useNativeDriver: true }).start(() => swipeX.setValue(0));
        setTimeout(() => nav.navigate('UserProfile', { userId: post.user.id, username: post.user.username }), 150);
      } else {
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
      }
    },
  })).current;

  // Watch time tracking
  const watchStartRef = useRef<number | null>(null);
  const watchAccumRef = useRef(0);

  useEffect(() => {
    setPaused(!isVisible);
    if (isVisible) {
      watchStartRef.current = Date.now();
    } else {
      if (watchStartRef.current) {
        watchAccumRef.current += (Date.now() - watchStartRef.current) / 1000;
        watchStartRef.current = null;
        if (watchAccumRef.current > 0.5) {
          api.post(`/posts/${post.id}/view`, {
            watch_time: Math.round(watchAccumRef.current),
            completed: watchAccumRef.current >= (post.duration ?? 15) * 0.8,
          }).catch(() => {});
          watchAccumRef.current = 0;
        }
      }
    }
  }, [isVisible]);

  const likedRef = useRef(liked);
  useEffect(() => { likedRef.current = liked; }, [liked]);

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/posts/${post.id}/like`),
    onError: () => { setLiked(post.is_liked); setLikeCount(post.like_count); },
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post(`/favorites/posts/${post.id}`),
    onMutate: () => setSaved(s => !s),
    onError: () => setSaved(post.is_saved ?? false),
  });

  // ── Heart animation (always plays on double-tap) ──────────────────────────
  const animateHeart = useCallback((x: number, y: number) => {
    setHeartPos({ x: x - 50, y: y - 80 });
    heartAnim.setValue(1);
    heartScale.setValue(0.3);
    Animated.parallel([
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 5 }),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(heartAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, [heartAnim, heartScale]);

  // ── Trigger like (on double-tap) — single like per video ─────────────────
  const triggerLike = useCallback((x: number, y: number) => {
    animateHeart(x, y);
    // Only call API / update state if not already liked
    if (!likedRef.current) {
      setLiked(true);
      setLikeCount(c => c + 1);
      likedRef.current = true;
      likeMutation.mutate();
    }
  }, [animateHeart, likeMutation]);

  // ── Pause indicator ───────────────────────────────────────────────────────
  const showPauseIndicator = useCallback(() => {
    pauseAnim.setValue(1);
    Animated.timing(pauseAnim, { toValue: 0, duration: 700, delay: 300, useNativeDriver: true }).start();
  }, [pauseAnim]);

  // ── Speed indicator ───────────────────────────────────────────────────────
  const showSpeedIndicator = useCallback(() => {
    speedAnim.setValue(1);
  }, [speedAnim]);

  const hideSpeedIndicator = useCallback(() => {
    Animated.timing(speedAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, [speedAnim]);

  // ── Tap handler (shared across all zones) ────────────────────────────────
  // Double tap = instant like; single tap = toggle pause (after 300ms)
  const handleZoneTap = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap — fire immediately, cancel pending single-tap
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      triggerLike(x, y);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        lastTapRef.current = 0;
        setPaused(p => { showPauseIndicator(); return !p; });
      }, 300);
    }
  }, [triggerLike, showPauseIndicator]);

  // ── Long press handlers ───────────────────────────────────────────────────
  const handleLongPress = useCallback((zone: 'left' | 'middle' | 'right') => {
    // Cancel any pending single-tap
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    lastTapRef.current = 0;
    longPressZoneRef.current = zone;

    if (zone === 'left' || zone === 'right') {
      setRate(2);
      showSpeedIndicator();
    } else {
      pausedBeforeLongRef.current = paused;
      setPaused(true);
      showPauseIndicator();
    }
  }, [paused, showPauseIndicator, showSpeedIndicator]);

  const handlePressOut = useCallback((zone: 'left' | 'middle' | 'right') => {
    if (longPressZoneRef.current === zone) {
      longPressZoneRef.current = null;
      if (zone === 'left' || zone === 'right') {
        setRate(1);
        hideSpeedIndicator();
      } else {
        setPaused(pausedBeforeLongRef.current);
      }
    }
  }, [hideSpeedIndicator]);

  const goToProfile = () => nav.navigate('UserProfile', { userId: post.user.id, username: post.user.username });

  const isVideo = post.video_url && post.video_url !== '' &&
    (post.video_url.startsWith('http') || post.video_url.startsWith('file'));

  // ── Like button toggle (left heart icon) ─────────────────────────────────
  const handleLikePress = useCallback(() => {
    const wasLiked = likedRef.current;
    setLiked(l => !l);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    likedRef.current = !wasLiked;
    likeMutation.mutate();
  }, [likeMutation]);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: swipeX }] }]} {...profilePanResponder.panHandlers}>
      {/* LAYER 1 — Thumbnail */}
      {post.thumbnail_url
        ? <Image source={{ uri: post.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : <View style={[StyleSheet.absoluteFill, styles.fallback]} />
      }

      {/* LAYER 2 — Video */}
      {isVideo && (
        <Video
          ref={videoRef}
          source={{ uri: post.video_url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          repeat
          paused={paused}
          muted={muted}
          rate={rate}
          onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
          onLoad={({ duration }) => {
            setBuffering(false);
            if (duration > 0) totalDurationRef.current = duration;
          }}
          onError={() => { setBuffering(false); }}
          onProgress={({ currentTime, seekableDuration }) => {
            if (!seeking && seekableDuration > 0) {
              setProgress(currentTime / seekableDuration);
              setSeekTime(currentTime);
            }
          }}
          ignoreSilentSwitch="ignore"
          playInBackground={false}
          playWhenInactive={false}
          bufferConfig={{ minBufferMs: 2500, maxBufferMs: 15000, bufferForPlaybackMs: 1000, bufferForPlaybackAfterRebufferMs: 2000 }}
        />
      )}

      {/* LAYER 3 — Gesture zones (behind UI elements) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.zonesRow} pointerEvents="box-none">
          {/* Left zone — long press = 2x speed */}
          <Pressable
            style={styles.zoneLeft}
            onPress={e => handleZoneTap(e.nativeEvent.locationX, e.nativeEvent.locationY)}
            onLongPress={() => handleLongPress('left')}
            onPressOut={() => handlePressOut('left')}
            delayLongPress={200}
          />
          {/* Middle zone — long press = pause while held */}
          <Pressable
            style={styles.zoneMiddle}
            onPress={e => handleZoneTap(e.nativeEvent.locationX + W * 0.35, e.nativeEvent.locationY)}
            onLongPress={() => handleLongPress('middle')}
            onPressOut={() => handlePressOut('middle')}
            delayLongPress={200}
          />
          {/* Right zone — long press = 2x speed */}
          <Pressable
            style={styles.zoneRight}
            onPress={e => handleZoneTap(e.nativeEvent.locationX + W * 0.65, e.nativeEvent.locationY)}
            onLongPress={() => handleLongPress('right')}
            onPressOut={() => handlePressOut('right')}
            delayLongPress={200}
          />
        </View>
      </View>

      {/* Buffering */}
      {buffering && isVideo && (
        <View style={styles.bufferWrap} pointerEvents="none">
          <ActivityIndicator color={COLORS.white} size="large" />
        </View>
      )}

      {/* Pause indicator */}
      <Animated.View style={[styles.pauseIndicator, { opacity: pauseAnim }]} pointerEvents="none">
        <View style={styles.pauseCircle}>
          {paused
            ? <IcPlay size={32} color={COLORS.white} />
            : <View style={styles.pauseBars}><View style={styles.pauseBar} /><View style={styles.pauseBar} /></View>
          }
        </View>
      </Animated.View>

      {/* 2x speed indicator */}
      <Animated.View style={[styles.speedBadge, { opacity: speedAnim }]} pointerEvents="none">
        <Text style={styles.speedText}>2x</Text>
      </Animated.View>

      {/* Floating heart on double-tap */}
      <Animated.View
        pointerEvents="none"
        style={[styles.floatingHeart, { left: heartPos.x, top: heartPos.y, opacity: heartAnim, transform: [{ scale: heartScale }] }]}
      >
        <IcHeartFill size={100} color="#FF3B5C" />
      </Animated.View>

      {/* Seekable progress bar — interactive, above tab bar */}
      <View style={styles.seekBarHit} {...seekPanResponder.panHandlers}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          {/* Thumb */}
          <View style={[styles.progressThumb, { left: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>

      {/* Time display while seeking */}
      {seeking && (
        <View style={styles.seekTimeBubble} pointerEvents="none">
          <Text style={styles.seekTimeText}>
            {fmtDuration(seekTime)} / {fmtDuration(totalDurationRef.current)}
          </Text>
        </View>
      )}

      {/* Mute button */}
      <TouchableOpacity style={styles.muteBtn} onPress={() => setMuted(m => !m)} activeOpacity={0.8}>
        {muted ? <IcMute size={18} color={COLORS.white} /> : <IcVolume size={18} color={COLORS.white} />}
      </TouchableOpacity>

      {/* Bottom gradient */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.gradient} pointerEvents="none" />

      {/* Bottom left — username + caption */}
      <View style={styles.bottomLeft}>
        <TouchableOpacity onPress={goToProfile} activeOpacity={0.8}>
          <Text style={styles.username}>@{post.user.username}</Text>
        </TouchableOpacity>
        {post.caption ? (
          <TouchableOpacity onPress={() => setCaptionExpanded(e => !e)} activeOpacity={0.9}>
            <Text style={styles.caption} numberOfLines={captionExpanded ? undefined : 2}>{post.caption}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Bottom right — sound */}
      {post.sound && (
        <TouchableOpacity
          style={styles.bottomRight}
          onPress={() => nav.navigate('Sound', { soundId: post.sound!.id, title: post.sound!.title, artist: post.sound!.artist })}
          activeOpacity={0.8}
        >
          <IcMusic size={12} color={COLORS.white} />
          <Text style={styles.soundText} numberOfLines={1}>
            {post.sound.title}{post.sound.artist ? ` · ${post.sound.artist}` : ''}
          </Text>
        </TouchableOpacity>
      )}

      {/* Right actions */}
      <View style={styles.rightActions}>
        <TouchableOpacity style={styles.avatarWrap} onPress={goToProfile} activeOpacity={0.85}>
          {post.user.avatar_url
            ? <Image source={{ uri: post.user.avatar_url }} style={styles.avatar} />
            : <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{post.user.display_name[0]?.toUpperCase()}</Text>
              </View>
          }
          <View style={styles.followDot}>
            <Text style={styles.followDotText}>+</Text>
          </View>
        </TouchableOpacity>

        {/* Like — sync with double-tap state */}
        <ActionBtn
          icon={liked ? <IcHeartFill size={30} color="#FF3B5C" /> : <IcHeart size={30} color={COLORS.white} />}
          count={fmt(likeCount)}
          onPress={handleLikePress}
          countColor={liked ? '#FF3B5C' : COLORS.white}
        />

        {/* Comment */}
        <ActionBtn icon={<IcComment size={28} color={COLORS.white} />} count={fmt(post.comment_count)} onPress={onComment} />

        {/* Save */}
        <ActionBtn
          icon={saved ? <IcSaveFill size={26} color={COLORS.primary} /> : <IcSave size={26} color={COLORS.white} />}
          onPress={() => saveMutation.mutate()}
        />

        {/* Share */}
        <ActionBtn
          icon={<IcShare size={26} color={COLORS.white} />}
          count={fmt(post.share_count || 0)}
          onPress={() => {
            Share.share({ message: `Regarde cette vidéo sur Nour\nhttps://nour.app/post/${post.id}` });
            api.post(`/posts/${post.id}/view`, {}).catch(() => {});
          }}
        />
      </View>
    </Animated.View>
  );
}

function ActionBtn({
  icon, count, onPress, countColor = COLORS.white,
}: { icon: React.ReactNode; count?: string; onPress: () => void; countColor?: string }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.8}>
      {icon}
      {count !== undefined && <Text style={[styles.actionCount, { color: countColor }]}>{count}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { width: W, height: H, backgroundColor: '#000', overflow: 'hidden' },
  fallback: { backgroundColor: '#111' },

  // Gesture zones
  zonesRow: { flex: 1, flexDirection: 'row' },
  zoneLeft: { width: W * 0.35, height: '100%' },
  zoneMiddle: { width: W * 0.30, height: '100%' },
  zoneRight: { width: W * 0.35, height: '100%' },

  bufferWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },

  pauseIndicator: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',
  },
  pauseCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  pauseBars: { flexDirection: 'row', gap: 6 },
  pauseBar: { width: 6, height: 26, backgroundColor: COLORS.white, borderRadius: 3 },

  speedBadge: {
    position: 'absolute', top: '45%', alignSelf: 'center',
    left: W / 2 - 32,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: RADIUS.full,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  speedText: { fontSize: 24, fontWeight: '800', color: COLORS.white },

  floatingHeart: { position: 'absolute', width: 100, height: 100 },

  muteBtn: {
    position: 'absolute', top: 54, right: 14,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.5 },

  bottomLeft: { position: 'absolute', bottom: 104, left: 14, right: 90, gap: 5 },
  username: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold, color: COLORS.white },
  caption: { fontSize: FONT.size.sm, color: 'rgba(255,255,255,0.9)', lineHeight: 19 },

  bottomRight: {
    position: 'absolute', bottom: 78, right: 14, left: '35%',
    flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'flex-end',
  },
  soundText: { fontSize: FONT.size.xs, color: 'rgba(255,255,255,0.85)', flexShrink: 1 },

  rightActions: { position: 'absolute', right: 10, bottom: 96, alignItems: 'center', gap: 22 },
  avatarWrap: { position: 'relative', marginBottom: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: COLORS.white },
  avatarFallback: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primaryBg, borderWidth: 2, borderColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: FONT.weight.bold, color: COLORS.primary },
  followDot: {
    position: 'absolute', bottom: -8, left: '50%',
    transform: [{ translateX: -10 }],
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#FF3B5C', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  followDotText: { color: COLORS.white, fontSize: 13, fontWeight: FONT.weight.bold, lineHeight: 18 },
  actionBtn: { alignItems: 'center', gap: 3 },
  actionCount: { fontSize: 12, fontWeight: FONT.weight.semibold, color: COLORS.white },

  // Seek bar
  seekBarHit: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 28, justifyContent: 'flex-end', paddingBottom: 4,
  },
  progressBg: {
    height: 3, backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 0, position: 'relative',
  },
  progressFill: { position: 'absolute', top: 0, left: 0, height: '100%', backgroundColor: COLORS.primary },
  progressThumb: {
    position: 'absolute', top: -5, width: 12, height: 12,
    borderRadius: 6, backgroundColor: COLORS.white,
    marginLeft: -6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4, shadowRadius: 2,
  },
  seekTimeBubble: {
    position: 'absolute', bottom: 36, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  seekTimeText: { fontSize: 12, color: COLORS.white, fontWeight: FONT.weight.semibold },
});
