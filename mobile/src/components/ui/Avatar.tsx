import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, RADIUS, FONT } from '../../constants/theme';
import { IcCheck } from './Icons';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  onPress?: () => void;
  showBorder?: boolean;
  verified?: boolean;
}

export function Avatar({ uri, name, size = 40, onPress, showBorder, verified }: AvatarProps) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const fontSize = size * 0.38;

  const content = (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, showBorder && styles.border]}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { borderRadius: size / 2 }]} />
      ) : (
        <View style={[styles.fallback, { borderRadius: size / 2 }]}>
          <Text style={[styles.initial, { fontSize }]}>{initial}</Text>
        </View>
      )}
      {verified && (
        <View style={styles.verifiedBadge}>
          <IcCheck size={8} color={COLORS.white} strokeWidth={3} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
  border: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: COLORS.primary,
    fontWeight: FONT.weight.bold,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  verifiedIcon: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: FONT.weight.bold,
  },
});
