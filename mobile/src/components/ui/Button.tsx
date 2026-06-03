import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet, ActivityIndicator,
  ViewStyle, TextStyle,
} from 'react-native';
import { COLORS, RADIUS, FONT, SPACING, SHADOW } from '../../constants/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  loading, disabled, style, textStyle, fullWidth,
}: ButtonProps) {
  const btnStyle: ViewStyle[] = [
    styles.base,
    styles[variant] as ViewStyle,
    styles[`size_${size}` as keyof typeof styles] as ViewStyle,
    fullWidth ? { width: '100%' } as ViewStyle : {},
    (disabled || loading) ? styles.disabled : {},
    variant === 'primary' ? (SHADOW.green as ViewStyle) : {},
    style ?? {},
  ];

  return (
    <TouchableOpacity
      style={btnStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? COLORS.white : COLORS.primary}
          size="small"
        />
      ) : (
        <Text style={[styles.text, styles[`text_${variant}` as keyof typeof styles], styles[`textSize_${size}` as keyof typeof styles], textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  disabled: { opacity: 0.5 },

  // Variants
  primary: { backgroundColor: COLORS.primary },
  secondary: { backgroundColor: COLORS.primaryBg },
  outline: { backgroundColor: COLORS.transparent, borderWidth: 1.5, borderColor: COLORS.primary },
  ghost: { backgroundColor: COLORS.transparent },
  danger: { backgroundColor: COLORS.error },

  // Sizes
  size_sm: { paddingHorizontal: SPACING.md, paddingVertical: 8, minHeight: 36 },
  size_md: { paddingHorizontal: SPACING.lg, paddingVertical: 13, minHeight: 46 },
  size_lg: { paddingHorizontal: SPACING.xl, paddingVertical: 16, minHeight: 54 },

  // Text base
  text: { fontWeight: FONT.weight.semibold },
  text_primary: { color: COLORS.white },
  text_secondary: { color: COLORS.primary },
  text_outline: { color: COLORS.primary },
  text_ghost: { color: COLORS.primary },
  text_danger: { color: COLORS.white },

  // Text sizes
  textSize_sm: { fontSize: FONT.size.sm },
  textSize_md: { fontSize: FONT.size.base },
  textSize_lg: { fontSize: FONT.size.md },
});
