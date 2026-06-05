import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { FONT, SPACING } from '../../constants/theme';
import { Button } from './Button';
import {
  Video, Search, MessageSquare, User, Bell, Bookmark,
  TrendingUp, Heart, List, HelpCircle,
} from 'lucide-react-native';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  video: Video,
  search: Search,
  chat: MessageSquare,
  user: User,
  bell: Bell,
  save: Bookmark,
  trending: TrendingUp,
  heart: Heart,
  list: List,
  help: HelpCircle,
};

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'help', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();
  const IconComp = ICON_MAP[icon] ?? HelpCircle;

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: theme.primaryBg }]}>
        <IconComp size={32} color={theme.primary} strokeWidth={1.5} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} size="sm" style={{ marginTop: SPACING.lg } as any} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 12 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, textAlign: 'center' },
  subtitle: { fontSize: FONT.size.base, textAlign: 'center', lineHeight: 22 },
});
