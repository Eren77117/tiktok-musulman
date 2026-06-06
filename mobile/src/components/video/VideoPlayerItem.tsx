import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Image, ActivityIndicator, Animated, Pressable, PanResponder,
  Modal, Alert, Easing,
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'react-native-linear-gradient';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, RADIUS } from '../../constants/theme';
import {
  IcHeartFill, IcHeart, IcComment, IcShare, IcSave, IcSaveFill,
  IcMusic, IcPlay, IcCheck, IcMaximize, IcRepeat,
} from '../ui/Icons';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { MarqueeText } from '../ui/MarqueeText';
import { SaveToCollectionSheet } from './SaveToCollectionSheet';
import ShareSheet from './ShareSheet';
import { useAnalyticsTracker } from '../../hooks/useAnalyticsTracker';

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
    avatar_url: string | null; is_verified: boolean; is_following?: boolean; has_story?: boolean;
  };
  sound: { id: string; title: string; artist: string | null } | null;
  reposted_by?: { id: string; username: string; avatar_url: string | null } | null;
  series_episode?: { series_id: string; episode_num: number; series_title: string } | null;
}

interface Props {
  post: FeedPost;
  isVisible: boolean;
  onComment: () => void;
  onNotInterested?: () => void;
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

export function VideoPlayerItem({ post, isVisible, onComment, onNotInterested, itemHeight }: Props) {
  const ITEM_H = itemHeight ?? H;
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const videoRef = useRef<VideoRef>(null);

  // Playback state
  const [liked, setLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [saved, setSaved] = useState(post.is_saved ?? false);
  const [collectionSheetVisible, setCollectionSheetVisible] = useState(false);
  const [following, setFollowing] = useState(post.user.is_following ?? false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(!isVisible);
  const [rate, setRate] = useState(1);
  const [buffering, setBuffering] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1
  const [soundSheetVisible, setSoundSheetVisible] = useState(false);
  const [isHorizontal, setIsHorizontal] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

  // Vinyl spinning animation
  const vinylRotation = useRef(new Animated.Value(0)).current;
  const vinylAnim = useRef<Animated.CompositeAnimation | null>(null);

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

  const thumbScale = useRef(new Animated.Value(1)).current;

  const seekPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (evt) => {
      setSeeking(true);
      Animated.spring(thumbScale, { toValue: 1.8, useNativeDriver: true, tension: 400, friction: 10 }).start();
      const pct = Math.max(0, Math.min(1, evt.nativeEvent.pageX / W));
      const time = pct * totalDurationRef.current;
      setSeekTime(time);
      setProgress(pct);
      videoRef.current?.seek(time);
    },
    onPanResponderMove: (evt) => {
      const pct = Math.max(0, Math.min(1, evt.nativeEvent.pageX / W));
      const time = pct * totalDurationRef.current;
      setSeekTime(time);
      setProgress(pct);
      videoRef.current?.seek(time);
    },
    onPanResponderRelease: () => {
      setSeeking(false);
      Animated.spring(thumbScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();
    },
    onPanResponderTerminate: () => {
      setSeeking(false);
      Animated.spring(thumbScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();
    },
  })).current;

  // Swipe gauche → navigation page profil complète
  const swipeAnim = useRef(new Animated.Value(0)).current;

  const profilePanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (evt, g) => {
      const startX = evt.nativeEvent.pageX - g.dx;
      return startX > W * 0.4 && g.dx < -14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3;
    },
    onPanResponderMove: (_, g) => {
      if (g.dx < 0) swipeAnim.setValue(Math.max(-W * 0.2, g.dx));
    },
    onPanResponderRelease: (_, g) => {
      if (-g.dx > W * 0.22 || g.vx < -0.6) {
        // Snap puis navigue
        Animated.timing(swipeAnim, { toValue: -W * 0.25, duration: 120, useNativeDriver: true }).start(() => {
          swipeAnim.setValue(0);
          nav.navigate('UserProfile', { userId: post.user.id, username: post.user.username });
        });
      } else {
        Animated.spring(swipeAnim, { toValue: 0, useNativeDriver: true, tension: 200, friction: 14 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(swipeAnim, { toValue: 0, useNativeDriver: true, tension: 200, friction: 14 }).start();
    },
  })).current;

  const { track } = useAnalyticsTracker();

  // Watch time tracking enrichi
  const watchDataRef = useRef({
    watchStart: 0, totalWatchTime: 0, rewatchCount: 0,
    pauseCount: 0, interacted: false, sessionStart: 0,
  });

  useEffect(() => {
    if (!isVisible) setVideoReady(false);
    setPaused(!isVisible);
    if (isVisible) {
      const now = Date.now();
      watchDataRef.current.watchStart = now;
      if (watchDataRef.current.sessionStart === 0) {
        watchDataRef.current.sessionStart = now;
      } else {
        watchDataRef.current.rewatchCount++;
      }
    } else {
      if (watchDataRef.current.watchStart > 0) {
        const session = (Date.now() - watchDataRef.current.watchStart) / 1000;
        watchDataRef.current.totalWatchTime += session;
        watchDataRef.current.watchStart = 0;
        const wasSkipped = session < 2.0;
        if (watchDataRef.current.totalWatchTime > 0.3) {
          const dur = post.duration ?? 15;
          const watchPct = Math.min(1, watchDataRef.current.totalWatchTime / dur);
          api.post(`/posts/${post.id}/view`, {
            watch_time: Math.round(watchDataRef.current.totalWatchTime),
            completion_ratio: watchPct,
            completed: watchPct >= 0.8,
            was_skipped: wasSkipped,
            rewatch_count: watchDataRef.current.rewatchCount,
            pause_count: watchDataRef.current.pauseCount,
            interacted: watchDataRef.current.interacted,
          }).catch(() => {});
          track({
            post_id: post.id,
            watch_time: watchDataRef.current.totalWatchTime,
            watch_percent: watchPct,
            rewatch_count: watchDataRef.current.rewatchCount,
            was_skipped: wasSkipped,
            liked: likedRef.current,
            commented: false,
            shared: false,
            saved: false,
          });
        }
        // Reset
        watchDataRef.current = { watchStart: 0, totalWatchTime: 0, rewatchCount: 0, pauseCount: 0, interacted: false, sessionStart: 0 };
      }
    }
  }, [isVisible]);

  // Vinyl spin control
  useEffect(() => {
    if (!paused && isVisible) {
      vinylAnim.current = Animated.loop(
        Animated.timing(vinylRotation, {
          toValue: 1, duration: 4000,
          easing: Easing.linear, useNativeDriver: true,
        })
      );
      vinylAnim.current.start();
    } else {
      vinylAnim.current?.stop();
    }
    return () => { vinylAnim.current?.stop(); };
  }, [paused, isVisible]);

  const vinylSpin = vinylRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

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

  const followMutation = useMutation({
    mutationFn: () => api.post(`/users/${post.user.id}/follow`),
    onMutate: () => setFollowing(f => !f),
    onError: () => setFollowing(post.user.is_following ?? false),
  });

  // ── Heart animation (always plays on double-tap) — TikTok style ──────────
  const heartY = useRef(new Animated.Value(0)).current;
  const animateHeart = useCallback((x: number, y: number) => {
    setHeartPos({ x: x - 56, y: y - 100 });
    heartAnim.setValue(1);
    heartScale.setValue(0.1);
    heartY.setValue(0);
    Animated.parallel([
      // Bounce scale: 0.1 → 1.2 → 1.0
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.25, useNativeDriver: true, tension: 180, friction: 6 }),
        Animated.spring(heartScale, { toValue: 1.0, useNativeDriver: true, tension: 200, friction: 8 }),
      ]),
      // Float up slightly
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(heartY, { toValue: -30, duration: 500, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      ]),
      // Fade out after 600ms
      Animated.sequence([
        Animated.delay(550),
        Animated.timing(heartAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();
  }, [heartAnim, heartScale, heartY]);

  // ── Trigger like (on double-tap) — single like per video ─────────────────
  const triggerLike = useCallback((x: number, y: number) => {
    animateHeart(x, y);
    ReactNativeHapticFeedback.trigger('impactMedium', { enableVibrateFallback: true });
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
      }, 200);
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
    watchDataRef.current.interacted = true;
    const wasLiked = likedRef.current;
    setLiked(l => !l);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    likedRef.current = !wasLiked;
    ReactNativeHapticFeedback.trigger(wasLiked ? 'impactLight' : 'impactMedium', { enableVibrateFallback: true });
    likeMutation.mutate();
  }, [likeMutation]);

  return (
    <Animated.View
      style={[styles.container, { height: ITEM_H }, { transform: [{ translateX: swipeAnim }] }]}
      {...profilePanResponder.panHandlers}
    >
      {/* LAYER 1 — Thumbnail (visible until video ready, prevents black flash) */}
      {!isHorizontal && post.thumbnail_url && !videoReady
        ? <Image source={{ uri: post.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : !post.thumbnail_url && !videoReady
          ? <View style={[StyleSheet.absoluteFill, styles.fallback]} />
          : null
      }

      {/* LAYER 2 — Video */}
      {isVideo && (
        <Video
          ref={videoRef}
          source={{ uri: post.video_url }}
          style={StyleSheet.absoluteFill}
          resizeMode={isHorizontal ? 'contain' : 'cover'}
          repeat
          paused={paused}
          muted={muted}
          rate={rate}
          onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
          onReadyForDisplay={() => setVideoReady(true)}
          onLoad={({ duration, naturalSize }: any) => {
            setBuffering(false);
            setVideoReady(true);
            if (duration > 0) totalDurationRef.current = duration;
            if (naturalSize?.width && naturalSize?.height) {
              setIsHorizontal(naturalSize.width > naturalSize.height);
            }
          }}
          onError={() => { setBuffering(false); }}
          onProgress={({ currentTime, seekableDuration }) => {
            if (!seeking && seekableDuration > 0) {
              setProgress(currentTime / seekableDuration);
              setSeekTime(currentTime);
            }
          }}
          onEnd={() => {
            videoRef.current?.seek(0);
            setProgress(0);
            setSeekTime(0);
          }}
          ignoreSilentSwitch="ignore"
          playInBackground={false}
          playWhenInactive={false}
          bufferConfig={{ minBufferMs: 1500, maxBufferMs: 10000, bufferForPlaybackMs: 500, bufferForPlaybackAfterRebufferMs: 1000 }}
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

      {/* Floating heart on double-tap — TikTok bounce */}
      <Animated.View
        pointerEvents="none"
        style={[styles.floatingHeart, {
          left: heartPos.x, top: heartPos.y,
          opacity: heartAnim,
          transform: [{ scale: heartScale }, { translateY: heartY }],
        }]}
      >
        <IcHeartFill size={112} color="#FF3B5C" />
      </Animated.View>

      {/* Seekable progress bar — interactive, above tab bar */}
      <View style={styles.seekBarHit} {...seekPanResponder.panHandlers}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          {/* Thumb */}
          <Animated.View style={[styles.progressThumb, { left: `${Math.round(progress * 100)}%`, transform: [{ scale: thumbScale }] }]} />
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

      {/* Plein écran — videos horizontales uniquement */}
      {isHorizontal && (
        <TouchableOpacity
          style={styles.fullscreenBtn}
          onPress={() => (videoRef.current as any)?.presentFullscreenPlayer?.()}
          activeOpacity={0.85}
        >
          <IcMaximize size={14} color={COLORS.white} />
          <Text style={styles.fullscreenText}>Plein écran</Text>
        </TouchableOpacity>
      )}



      {/* Bottom gradient */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      {/* Repost indicator — bottom left, above username */}
      {post.reposted_by && (
        <View style={styles.repostBadge}>
          <IcRepeat size={11} color={COLORS.white} />
          {post.reposted_by.avatar_url ? (
            <Image source={{ uri: post.reposted_by.avatar_url }} style={styles.repostAvatar} />
          ) : (
            <View style={[styles.repostAvatar, styles.repostAvatarFallback]}>
              <Text style={styles.repostAvatarInitial}>{post.reposted_by.username[0]?.toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.repostText}>@{post.reposted_by.username}</Text>
        </View>
      )}

      {/* Series episode badge */}
      {post.series_episode && (
        <TouchableOpacity
          style={styles.seriesBadge}
          onPress={() => nav.navigate('SeriesPlayer', { seriesId: post.series_episode!.series_id, startEpisode: Math.max(0, (post.series_episode!.episode_num ?? 1) - 1) })}
          activeOpacity={0.85}
        >
          <Text style={styles.seriesBadgeText}>
            Série · Ép. {post.series_episode.episode_num}
          </Text>
        </TouchableOpacity>
      )}

      {/* Bottom left — username + caption */}
      <View style={styles.bottomLeft}>
        <TouchableOpacity onPress={goToProfile} activeOpacity={0.8} style={styles.usernameRow}>
          <Text style={styles.username}>@{post.user.username}</Text>
          {post.user.is_verified && (
            <View style={styles.verifiedBadge}>
              <IcCheck size={9} color={COLORS.white} strokeWidth={3} />
            </View>
          )}
        </TouchableOpacity>
        {post.caption ? (
          <TouchableOpacity onPress={() => setCaptionExpanded(e => !e)} activeOpacity={0.9}>
            <CaptionText
              text={post.caption}
              expanded={captionExpanded}
              onHashtag={(tag) => nav.navigate('Hashtag', { tag })}
              onMention={(username) => {
                api.get(`/users/by-username/${username}`)
                  .then(r => nav.navigate('UserProfile', { userId: r.data.id, username }))
                  .catch(() => {});
              }}
            />
          </TouchableOpacity>
        ) : null}
        {post.sound && (
          <TouchableOpacity
            style={styles.soundRow}
            onPress={() => nav.navigate('Sound', { soundId: post.sound!.id, title: post.sound!.title, artist: post.sound!.artist })}
            activeOpacity={0.8}
          >
            <MarqueeText
              text={`${post.sound.title}${post.sound.artist ? ` · ${post.sound.artist}` : ''}`}
              style={styles.soundText}
              containerWidth={W * 0.45}
              speed={35}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Right actions */}
      <View style={styles.rightActions}>
        {/* Avatar + follow */}
        <TouchableOpacity
          style={[styles.avatarWrap, post.user.has_story && styles.avatarStoryRing]}
          onPress={goToProfile}
          activeOpacity={0.85}
        >
          {post.user.avatar_url
            ? <Image source={{ uri: post.user.avatar_url }} style={[styles.avatar, post.user.has_story && { borderColor: 'transparent' }]} />
            : <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{post.user.display_name[0]?.toUpperCase()}</Text>
              </View>
          }
          {!following && (
            <TouchableOpacity
              style={styles.followDot}
              onPress={() => { ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true }); followMutation.mutate(); }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={styles.followDotText}>+</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity style={styles.actionBtn} onPress={handleLikePress} activeOpacity={0.8}>
          {liked ? <IcHeartFill size={32} color="#FF3B5C" /> : <IcHeart size={32} color={COLORS.white} />}
          <AnimatedNumber value={likeCount} style={{ ...styles.actionCount, color: liked ? '#FF3B5C' : COLORS.white }} />
        </TouchableOpacity>

        {/* Comment */}
        <ActionBtn icon={<IcComment size={30} color={COLORS.white} />} count={fmt(post.comment_count)} onPress={() => { watchDataRef.current.interacted = true; onComment(); }} />

        {/* Save → Collections */}
        <ActionBtn
          icon={saved ? <IcSaveFill size={28} color={COLORS.primary} /> : <IcSave size={28} color={COLORS.white} />}
          count={''}
          onPress={() => setCollectionSheetVisible(true)}
        />

        {/* Share */}
        <ActionBtn
          icon={<IcShare size={28} color={COLORS.white} />}
          count={fmt(post.share_count || 0)}
          onPress={() => {
            ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
            setShareSheetVisible(true);
          }}
        />

        {/* Vinyl disc — sound */}
        {post.sound && (
          <TouchableOpacity onPress={() => setSoundSheetVisible(true)} activeOpacity={0.85} style={styles.vinylWrap}>
            <Animated.View style={[styles.vinylOuter, { transform: [{ rotate: vinylSpin }] }]}>
              {/* Outer ring */}
              <View style={styles.vinylRing} />
              {/* Center image or fallback */}
              {post.user.avatar_url
                ? <Image source={{ uri: post.user.avatar_url }} style={styles.vinylCenter} />
                : <View style={[styles.vinylCenter, { backgroundColor: COLORS.primaryBg }]}>
                    <IcMusic size={12} color={COLORS.primary} />
                  </View>
              }
              {/* Center hole */}
              <View style={styles.vinylHole} />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>

      {/* Sound Sheet */}
      {post.sound && (
        <SoundSheet
          visible={soundSheetVisible}
          sound={post.sound}
          onClose={() => setSoundSheetVisible(false)}
          onNavigateSound={() => {
            setSoundSheetVisible(false);
            nav.navigate('Sound', { soundId: post.sound!.id, title: post.sound!.title, artist: post.sound!.artist });
          }}
          onUseSound={() => {
            setSoundSheetVisible(false);
            nav.navigate('Create' as any);
          }}
        />
      )}
      {/* Swipe profile hint — pill visible pendant le swipe */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swipeHintPill,
          {
            opacity: swipeAnim.interpolate({ inputRange: [-W * 0.2, -20, 0], outputRange: [1, 0.6, 0] }),
            transform: [{ translateX: swipeAnim.interpolate({ inputRange: [-W * 0.2, 0], outputRange: [0, 40] }) }],
          },
        ]}
      >
        {post.user.avatar_url
          ? <Image source={{ uri: post.user.avatar_url }} style={styles.swipeHintAvatar} />
          : <View style={[styles.swipeHintAvatar, { backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.primary }}>
                {post.user.display_name[0]?.toUpperCase()}
              </Text>
            </View>
        }
        <Text style={styles.swipeHintText}>@{post.user.username}</Text>
        <Text style={styles.swipeHintArrow}>→</Text>
      </Animated.View>

      {/* Share Sheet */}
      <ShareSheet
        post={post}
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        onNotInterested={onNotInterested}
      />

      {/* Save to Collection Sheet */}
      <SaveToCollectionSheet
        visible={collectionSheetVisible}
        postId={post.id}
        onClose={() => setCollectionSheetVisible(false)}
      />

    </Animated.View>
  );
}

// ── Sound Sheet ─────────────────────────────────────────────────────────────
function SoundSheet({
  visible, sound, onClose, onNavigateSound, onUseSound,
}: {
  visible: boolean;
  sound: { id: string; title: string; artist: string | null };
  onClose: () => void;
  onNavigateSound: () => void;
  onUseSound: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={soundStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={soundStyles.sheet}>
        <View style={soundStyles.handle} />
        {/* Sound info */}
        <View style={soundStyles.soundInfo}>
          <View style={soundStyles.soundIcon}>
            <IcMusic size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={soundStyles.soundTitle} numberOfLines={1}>{sound.title}</Text>
            {sound.artist && <Text style={soundStyles.soundArtist} numberOfLines={1}>{sound.artist}</Text>}
          </View>
        </View>

        <View style={soundStyles.divider} />

        {/* Options */}
        <TouchableOpacity style={soundStyles.option} onPress={onUseSound} activeOpacity={0.7}>
          <IcPlay size={20} color={COLORS.text} />
          <Text style={soundStyles.optionText}>Utiliser ce son</Text>
        </TouchableOpacity>
        <TouchableOpacity style={soundStyles.option} onPress={onNavigateSound} activeOpacity={0.7}>
          <IcHeart size={20} color={COLORS.text} />
          <Text style={soundStyles.optionText}>Voir toutes les vidéos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={soundStyles.option} onPress={() => { Alert.alert('Bientôt', 'Téléchargement disponible prochainement.'); onClose(); }} activeOpacity={0.7}>
          <IcSave size={20} color={COLORS.text} />
          <Text style={soundStyles.optionText}>Télécharger</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[soundStyles.option, { marginTop: 8 }]} onPress={onClose} activeOpacity={0.7}>
          <Text style={[soundStyles.optionText, { color: COLORS.textMuted, textAlign: 'center', flex: 1 }]}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const soundStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: 34, paddingTop: 12,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },
  soundInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  soundIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  soundTitle: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold, color: COLORS.text },
  soundArtist: { fontSize: FONT.size.sm, color: COLORS.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4 },
  optionText: { fontSize: FONT.size.base, color: COLORS.text },
});

function CaptionText({
  text,
  expanded,
  onHashtag,
  onMention,
}: {
  text: string;
  expanded: boolean;
  onHashtag?: (tag: string) => void;
  onMention?: (username: string) => void;
}) {
  const tokens = text.split(/(#\w+|@\w+)/g).filter(Boolean);
  return (
    <Text style={styles.caption} numberOfLines={expanded ? undefined : 2}>
      {tokens.map((token, i) => {
        if (token.startsWith('#')) {
          return (
            <Text key={i} style={styles.captionTag} onPress={() => onHashtag?.(token.slice(1))} suppressHighlighting>
              {token}
            </Text>
          );
        }
        if (token.startsWith('@')) {
          return (
            <Text key={i} style={styles.captionMention} onPress={() => onMention?.(token.slice(1))} suppressHighlighting>
              {token}
            </Text>
          );
        }
        return <Text key={i}>{token}</Text>;
      })}
    </Text>
  );
}

function ActionBtn({
  icon, count, onPress, countColor = COLORS.white,
}: { icon: React.ReactNode; count?: string; onPress: () => void; countColor?: string }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }),
    ]).start();
    onPress();
  };
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={handlePress} activeOpacity={1}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {icon}
      </Animated.View>
      {count !== undefined && count !== '' && (
        <Text style={[styles.actionCount, { color: countColor }]}>{count}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { width: W, height: H, backgroundColor: '#000', overflow: 'hidden' }, // H overridden by inline
  fallback: { backgroundColor: '#0A0A0A' },

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
    left: W / 2 - 36,
    backgroundColor: 'rgba(0,194,110,0.15)', borderRadius: RADIUS.full,
    paddingHorizontal: 20, paddingVertical: 9,
    borderWidth: 1, borderColor: 'rgba(0,194,110,0.4)',
  },
  speedText: { fontSize: 22, fontWeight: '800', color: '#00C26E', letterSpacing: 0.5 },

  floatingHeart: { position: 'absolute', width: 112, height: 112 },


  repostBadge: {
    position: 'absolute', bottom: 200, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  repostAvatar: { width: 16, height: 16, borderRadius: 8, overflow: 'hidden' },
  repostAvatarFallback: { backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  repostAvatarInitial: { fontSize: 8, fontWeight: '700', color: COLORS.primary },
  repostText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  bottomLeft: { position: 'absolute', bottom: 56, left: 14, right: 90, gap: 5 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold, color: COLORS.white },
  verifiedBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  caption: { fontSize: FONT.size.sm, color: 'rgba(255,255,255,0.92)', lineHeight: 20 },
  captionTag: { color: COLORS.primaryLight, fontWeight: FONT.weight.semibold },
  captionMention: { color: COLORS.white, fontWeight: FONT.weight.semibold, textDecorationLine: 'underline' },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  soundText: { fontSize: FONT.size.xs, color: 'rgba(255,255,255,0.85)', flexShrink: 1 },

  rightActions: { position: 'absolute', right: 10, bottom: 88, alignItems: 'center', gap: 20 },
  avatarWrap: { position: 'relative', marginBottom: 6 },
  avatarStoryRing: {
    borderRadius: 30, borderWidth: 2.5, borderColor: '#00E57A', padding: 2,
    shadowColor: '#00E57A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 8,
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 2, borderColor: '#00C26E',
  },
  avatarFallback: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#001F12', borderWidth: 2, borderColor: '#00C26E',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: FONT.weight.bold, color: '#00C26E' },
  followDot: {
    position: 'absolute', bottom: -10, left: '50%',
    transform: [{ translateX: -11 }],
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#00C26E', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#000',
  },
  followDotText: { color: '#fff', fontSize: 14, fontWeight: FONT.weight.bold, lineHeight: 20 },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 12, fontWeight: FONT.weight.semibold, color: COLORS.white },

  // Vinyl disc
  vinylWrap: { alignItems: 'center', marginTop: 4 },
  vinylOuter: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: '#111',
  },
  vinylRing: {
    position: 'absolute', width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  vinylCenter: {
    width: 28, height: 28, borderRadius: 14, overflow: 'hidden',
  },
  vinylHole: {
    position: 'absolute', width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },

  // Seek bar — 20px above bottom, 48px touch zone, 3px bar
  seekBarHit: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 48, justifyContent: 'flex-end',
  },
  progressBg: {
    height: 2.5, backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 0, position: 'relative',
  },
  progressFill: {
    position: 'absolute', top: 0, left: 0, height: '100%',
    backgroundColor: '#00C26E',
    shadowColor: '#00C26E', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 4,
  },
  progressThumb: {
    position: 'absolute', top: -5, width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#00C26E',
    marginLeft: -6, shadowColor: '#00C26E', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 6,
  },
  seekTimeBubble: {
    position: 'absolute', bottom: 62, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  seekTimeText: { fontSize: 12, color: COLORS.white, fontWeight: FONT.weight.semibold },

  swipeHintPill: {
    position: 'absolute', right: 16, top: '45%',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 100, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  swipeHintAvatar: { width: 24, height: 24, borderRadius: 12 },
  swipeHintText: { fontSize: 13, fontWeight: '600', color: COLORS.white },
  swipeHintArrow: { fontSize: 14, color: COLORS.white },

  fullscreenBtn: {
    position: 'absolute',
    bottom: '8%',
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  fullscreenText: { fontSize: 13, fontWeight: '500', color: COLORS.white },

  seriesBadge: {
    position: 'absolute',
    top: 60,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  seriesBadgeText: { fontSize: 11, fontWeight: '600', color: COLORS.white },

});

