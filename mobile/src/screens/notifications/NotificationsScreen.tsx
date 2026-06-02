import React from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { COLORS, SPACING } from '../../constants';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  LIKE: '♥',
  COMMENT: '💬',
  FOLLOW: '◉',
  MENTION: '@',
  MESSAGE_REQUEST: '✉',
  MESSAGE_REQUEST_ACCEPTED: '✓',
  SYSTEM: '⊕',
};

export default function NotificationsScreen() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ items: Notification[] }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 15_000,
  });

  const readAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = data?.items.filter((n) => !n.is_read).length ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={() => readAllMutation.mutate()}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={data?.items}
          keyExtractor={(n) => n.id}
          renderItem={({ item: n }) => (
            <View style={[styles.row, !n.is_read && styles.rowUnread]}>
              <View style={styles.iconWrap}>
                <Text style={styles.icon}>{TYPE_ICONS[n.type] ?? '⊕'}</Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{n.title}</Text>
                <Text style={styles.rowBody} numberOfLines={2}>{n.body}</Text>
                <Text style={styles.rowTime}>{formatTime(n.created_at)}</Text>
              </View>
              {!n.is_read && <View style={styles.dot} />}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No notifications</Text>
          }
        />
      )}
    </View>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  markAll: { fontSize: 13, color: COLORS.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowUnread: { backgroundColor: COLORS.bgCard },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgInput, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 18 },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  rowBody: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  rowTime: { fontSize: 12, color: COLORS.textSubtle, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 4 },
  empty: { textAlign: 'center', color: COLORS.textMuted, padding: SPACING.xl },
});
