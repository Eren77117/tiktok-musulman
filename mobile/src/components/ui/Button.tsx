import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet, ActivityIndicator,
  ViewStyle, TextStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
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
  const theme = useTheme();

  const variantStyle: ViewStyle = variant === 'primary'
    ? { backgroundColor: theme.primary }
    : variant === 'secondary'
    ? { backgroundColor: theme.primaryBg }
    : variant === 'outline'
    ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.primary }
    : variant === 'ghost'
    ? { backgroundColor: 'transparent' }
    : { backgroundColor: COLORS.error };

  const textColor = variant === 'primary' || variant === 'danger'
    ? COLORS.white
    : theme.primary;

  const sizeStyle: ViewStyle = size === 'sm'
    ? { paddingHorizontal: SPACING.md, paddingVertical: 8, minHeight: 36 }
    : size === 'lg'
    ? { paddingHorizontal: SPACING.xl, paddingVertical: 16, minHeight: 54 }
    : { paddingHorizontal: SPACING.lg, paddingVertical: 13, minHeight: 46 };

  const textSize = size === 'sm'
    ? FONT.size.sm
    : size === 'lg'
    ? FONT.size.md
    : FONT.size.base;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyle,
        sizeStyle,
        fullWidth ? { width: '100%' } : {},
        (disabled || loading) ? { opacity: 0.5 } : {},
        variant === 'primary' ? SHADOW.green as ViewStyle : {},
        style ?? {},
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? COLORS.white : theme.primary}
          size="small"
        />
      ) : (
        <Text style={[styles.text, { color: textColor, fontSize: textSize }, textStyle]}>
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
  text: { fontWeight: FONT.weight.semibold },
});
