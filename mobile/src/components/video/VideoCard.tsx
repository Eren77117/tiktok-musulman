import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Avatar } from '../ui/Avatar';
import {
  IcHeart, IcHeartFill, IcComment, IcShare, IcSave,
  IcSaveFill, IcMusic, IcPlay,
} from '../ui/Icons';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';

interface Post {
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
  user: { id: string; username: string; display_name: string; avatar_url: string | null; is_verified: boolean };
  sound: { id: string; title: string; artist: string | null } | null;
}

interface VideoCardProps {
  post: Post;
  onPress: () => void;
  onUserPress: () => void;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDuration(s: number) {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function VideoCard({ post, onPress, onUserPress }: VideoCardProps) {
  const [liked, setLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [saved, setSaved] = useState(false);
  const viewTracked = useRef(false);

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/posts/${post.id}/like`),
    onMutate: () => {
      const wasLiked = liked;
      setLiked(l => !l);
      setLikeCount(c => wasLiked ? c - 1 : c + 1);
    },
    onError: () => {
      setLiked(post.is_liked);
      setLikeCount(post.like_count);
    },
  });

  const handlePress = useCallback(() => {
    if (!viewTracked.current) {
      viewTracked.current = true;
      api.post(`/posts/${post.id}/view`, { watch_time: 0 }).catch(() => {});
    }
    onPress();
  }, [onPress, post.id]);

  return (
    <View style={styles.card}>
      {/* User header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onUserPress} style={styles.userRow} activeOpacity={0.8}>
          <Avatar uri={post.user.avatar_url} name={post.user.display_name} size={40} verified={post.user.is_verified} />
          <View style={styles.userInfo}>
            <Text style={styles.displayName} numberOfLines={1}>{post.user.display_name}</Text>
            <Text style={styles.username}>@{post.user.username}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.followBtn} activeOpacity={0.8}>
          <Text style={styles.followText}>Suivre</Text>
        </TouchableOpacity>
      </View>

      {/* Thumbnail / tap to play */}
      <TouchableWithoutFeedback onPress={handlePress}>
        <View style={styles.mediaContainer}>
          {post.thumbnail_url ? (
            <Image source={{ uri: post.thumbnail_url }} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={styles.thumbnailFallback}>
              <IcPlay size={40} color={COLORS.primaryLight} />
            </View>
          )}
          <View style={styles.playOverlay}>
            <View style={styles.playBtn}>
              <IcPlay size={20} color={COLORS.text} fill={COLORS.text} />
            </View>
          </View>
          {post.duration > 0 && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(post.duration)}</Text>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Caption */}
      {post.caption ? (
        <Text style={styles.caption} numberOfLines={2}>{post.caption}</Text>
      ) : null}

      {/* Sound */}
      {post.sound && (
        <View style={styles.soundRow}>
          <IcMusic size={12} color={COLORS.primary} />
          <Text style={styles.soundText} numberOfLines={1}>
            {post.sound.title}{post.sound.artist ? ` — ${post.sound.artist}` : ''}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={() => likeMutation.mutate()} activeOpacity={0.7}>
          {liked
            ? <IcHeartFill size={20} />
            : <IcHeart size={20} color={COLORS.textMuted} />
          }
          <Text style={[styles.actionCount, liked && styles.actionCountLiked]}>{fmt(likeCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={handlePress} activeOpacity={0.7}>
          <IcComment size={20} color={COLORS.textMuted} />
          <Text style={styles.actionCount}>{fmt(post.comment_count)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} activeOpacity={0.7}>
          <IcShare size={20} color={COLORS.textMuted} />
          <Text style={styles.actionCount}>{fmt(post.share_count || 0)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.action}
          onPress={() => setSaved(s => !s)}
          activeOpacity={0.7}
        >
          {saved
            ? <IcSaveFill size={20} />
            : <IcSave size={20} color={COLORS.textMuted} />
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderLight,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.md, paddingBottom: 10,
  },
  userRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  userInfo: { flex: 1 },
  displayName: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.text },
  username: { fontSize: FONT.size.xs, color: COLORS.textMuted, marginTop: 1 },
  followBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.primary,
  },
  followText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold, color: COLORS.primary },

  mediaContainer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: COLORS.inputBg },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryBg },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  playBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: RADIUS.xs,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  durationText: { fontSize: FONT.size.xs, color: COLORS.white, fontWeight: FONT.weight.medium },

  caption: { fontSize: FONT.size.sm, color: COLORS.text, paddingHorizontal: SPACING.md, paddingTop: 10, lineHeight: 20 },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingTop: 6 },
  soundText: { fontSize: FONT.size.xs, color: COLORS.textMuted, flex: 1 },

  actions: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    marginTop: 8, gap: 4,
  },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: FONT.size.xs, color: COLORS.textMuted },
  actionCountLiked: { color: COLORS.like },
});
