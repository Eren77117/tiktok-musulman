import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { RADIUS } from '../../constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = RADIUS.sm, style }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 850, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 850, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: theme.border, opacity },
        style,
      ]}
    />
  );
}

// ── Conversation skeleton ─────────────────────────────────────────────────────
export function ConversationSkeleton() {
  return (
    <View style={skStyles.convRow}>
      <Skeleton width={52} height={52} borderRadius={26} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="55%" height={14} borderRadius={7} />
        <Skeleton width="80%" height={12} borderRadius={6} />
      </View>
      <Skeleton width={30} height={11} borderRadius={6} />
    </View>
  );
}

// ── Profile skeleton ──────────────────────────────────────────────────────────
export function ProfileSkeleton() {
  return (
    <View>
      <Skeleton width="100%" height={130} borderRadius={0} />
      <View style={skStyles.profileAvatarWrap}>
        <Skeleton width={90} height={90} borderRadius={45} />
        <View style={{ gap: 8, marginTop: 12, alignItems: 'center' }}>
          <Skeleton width={130} height={18} borderRadius={9} />
          <Skeleton width={190} height={13} borderRadius={6} />
        </View>
      </View>
      <View style={skStyles.statsRow}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ alignItems: 'center', gap: 5 }}>
            <Skeleton width={42} height={20} borderRadius={10} />
            <Skeleton width={58} height={11} borderRadius={6} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Notification skeleton ─────────────────────────────────────────────────────
export function NotifSkeleton() {
  return (
    <View style={skStyles.notifRow}>
      <Skeleton width={46} height={46} borderRadius={23} />
      <View style={{ flex: 1, gap: 7 }}>
        <Skeleton width="90%" height={13} borderRadius={6} />
        <Skeleton width="50%" height={11} borderRadius={5} />
      </View>
      <Skeleton width={44} height={44} borderRadius={8} />
    </View>
  );
}

// ── Thread skeleton ───────────────────────────────────────────────────────────
export function ThreadSkeleton() {
  return (
    <View style={skStyles.threadRow}>
      <Skeleton width={42} height={42} borderRadius={21} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="40%" height={13} borderRadius={6} />
        <Skeleton width="90%" height={13} borderRadius={6} />
        <Skeleton width="65%" height={13} borderRadius={6} />
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
          <Skeleton width={36} height={11} borderRadius={5} />
          <Skeleton width={36} height={11} borderRadius={5} />
        </View>
      </View>
    </View>
  );
}

// ── Explore grid skeleton ─────────────────────────────────────────────────────
export function ExploreGridSkeleton({ cols = 2 }: { cols?: number }) {
  const W = Dimensions.get('window').width;
  const itemW = (W - 2) / cols;
  const itemH = itemW * 1.5;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} width={itemW} height={itemH} borderRadius={0} />
      ))}
    </View>
  );
}

const skStyles = StyleSheet.create({
  convRow: {
    flexDirection: 'row', padding: 16, gap: 12, alignItems: 'center',
  },
  profileAvatarWrap: {
    alignItems: 'center', marginTop: -45, paddingTop: 0,
  },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, paddingHorizontal: 20,
  },
  notifRow: {
    flexDirection: 'row', padding: 16, gap: 12, alignItems: 'center',
  },
  threadRow: {
    flexDirection: 'row', padding: 16, gap: 12, alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent',
  },
});
