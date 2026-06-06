import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT } from '../../constants/theme';
import { IcCheck } from './Icons';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  hasStory?: boolean;
  isLive?: boolean;
  verified?: boolean;
  onPress?: () => void;
  showFollowBadge?: boolean;
  isFollowing?: boolean;
  onFollow?: () => void;
}

export function Avatar({
  uri,
  name,
  size = 40,
  hasStory = false,
  isLive = false,
  verified = false,
  onPress,
  showFollowBadge = false,
  isFollowing = false,
  onFollow,
}: AvatarProps) {
  const theme = useTheme();
  const ringColor = isLive ? '#FF3B30' : '#00E57A';
  const hasRing = hasStory || isLive;
  const initial = (name[0] ?? '?').toUpperCase();

  const inner = (
    <View style={{ position: 'relative', width: size, height: size }}>
      {/* Ring story/live */}
      {hasRing && (
        <View style={[
          styles.ring,
          {
            width: size + 8,
            height: size + 8,
            borderRadius: (size + 8) / 2,
            borderColor: ringColor,
            shadowColor: ringColor,
            top: -4,
            left: -4,
          },
        ]} />
      )}

      {/* Avatar image or initial */}
      {uri ? (
        <Image
          source={{ uri }}
          style={[
            styles.image,
            {
              width: size, height: size, borderRadius: size / 2,
              borderWidth: hasRing ? 2 : 0,
              borderColor: '#000',
            },
          ]}
        />
      ) : (
        <View style={[
          styles.fallback,
          {
            width: size, height: size, borderRadius: size / 2,
            backgroundColor: theme.primaryBg,
            borderWidth: hasRing ? 2 : 0,
            borderColor: '#000',
          },
        ]}>
          <Text style={{ fontSize: size * 0.38, fontWeight: FONT.weight.bold, color: COLORS.primary }}>
            {initial}
          </Text>
        </View>
      )}

      {/* Verified badge */}
      {verified && !isLive && (
        <View style={[styles.verifiedBadge, { borderColor: theme.bg }]}>
          <IcCheck size={8} color="#fff" strokeWidth={3} />
        </View>
      )}

      {/* LIVE badge */}
      {isLive && (
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
      )}

      {/* Follow + badge */}
      {showFollowBadge && !isFollowing && (
        <TouchableOpacity
          style={styles.followBadge}
          onPress={onFollow}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          activeOpacity={0.8}
        >
          <Text style={styles.followBadgeText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  image: { overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ring: {
    position: 'absolute',
    borderWidth: 2.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
    zIndex: -1,
  },
  verifiedBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  liveBadge: {
    position: 'absolute', bottom: -7, alignSelf: 'center', left: '50%',
    marginLeft: -14,
    backgroundColor: '#FF3B30',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
    borderWidth: 1.5, borderColor: '#fff',
  },
  liveBadgeText: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  followBadge: {
    position: 'absolute', bottom: -8, alignSelf: 'center', left: '50%', marginLeft: -10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.error,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#000',
  },
  followBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 18 },
});
