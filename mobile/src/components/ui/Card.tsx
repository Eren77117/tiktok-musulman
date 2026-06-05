import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { RADIUS, SHADOW } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  shadow?: 'sm' | 'md' | 'none';
  padding?: number;
}

export function Card({ children, style, shadow = 'sm', padding = 16 }: CardProps) {
  const theme = useTheme();

  return (
    <View style={[
      styles.card,
      { backgroundColor: theme.card, borderColor: theme.border },
      shadow !== 'none' && SHADOW[shadow],
      { padding },
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
});
