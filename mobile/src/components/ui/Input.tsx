import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, TextInputProps } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, RADIUS, FONT, SPACING } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

export function Input({
  label, error, leftIcon, rightIcon, onRightIconPress, style, ...props
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
      )}
      <View style={[
        styles.container,
        {
          backgroundColor: theme.inputBg,
          borderColor: focused ? theme.primary : error ? COLORS.error : theme.border,
        },
        focused && { backgroundColor: theme.surface },
      ]}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, { color: theme.text }, leftIcon ? { paddingLeft: 0 } : undefined, style]}
          placeholderTextColor={theme.textPlaceholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.iconRight} disabled={!onRightIconPress}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    fontSize: FONT.size.sm,
    fontWeight: FONT.weight.medium,
    marginLeft: 2,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    minHeight: 50,
    paddingHorizontal: SPACING.md,
  },
  input: {
    flex: 1,
    fontSize: FONT.size.base,
    paddingVertical: 12,
  },
  iconLeft: { marginRight: 10 },
  iconRight: { marginLeft: 10 },
  error: {
    fontSize: FONT.size.xs,
    color: COLORS.error,
    marginLeft: 2,
  },
});
