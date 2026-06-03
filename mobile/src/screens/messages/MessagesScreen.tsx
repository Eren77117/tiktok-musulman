import React from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { IcBell } from '../../components/ui/Icons';
import { useQuery } from '@tanstack/react-query';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Conversation {
  id: string;
  other_user: { id: string; username: string; display_name: string; avatar_url: string | null };
  last_message: { content: string; created_at: string; sender_id: string; is_read: boolean } | null;
  updated_at: string;
  unread_count?: number;
}

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'maintenant';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 86_400_000 * 7) return `${Math.floor(diff / 86_400_000)}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function MessagesScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const { data: notifCount } = useQuery<{ count: number }>({
    queryKey: ['notif-count'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data).catch(() => ({ count: 0 })),
    refetchInterval: 15_000,
  });

  const { data, isLoading, refetch, isRefetching } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => api.get('/messages/conversations').then(r => r.data).catch(() => []),
    refetchInterval: 8_000,  // real-time polling
    refetchOnWindowFocus: true,
  });

  const conversations = data ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
        <Text style={[styles.title, { color: theme.text }]}>Messages</Text>
        <TouchableOpacity style={styles.newBtn} activeOpacity={0.7}
          onPress={() => navigation.navigate('Notifications')}>
          <IcBell size={22} color={COLORS.primary} />
          {(notifCount?.count ?? 0) > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {(notifCount?.count ?? 0) > 9 ? '9+' : notifCount?.count}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
          renderItem={({ item: c }) => {
            const unread = (c.unread_count ?? 0) > 0;
            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: theme.borderLight }]}
                onPress={() => navigation.navigate('Conversation', { conversationId: c.id, otherUser: c.other_user })}
                activeOpacity={0.7}
              >
                <View style={styles.avatarWrap}>
                  {c.other_user.avatar_url ? (
                    <Image source={{ uri: c.other_user.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: theme.primaryBg }]}>
                      <Text style={styles.avatarText}>{c.other_user.display_name[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.onlineDot} />
                </View>
                <View style={styles.rowInfo}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowName, { color: theme.text }, unread && styles.rowNameUnread]}>
                      {c.other_user.display_name}
                    </Text>
                    <Text style={[styles.rowTime, { color: theme.textSubtle }]}>
                      {c.last_message ? formatTime(c.last_message.created_at) : ''}
                    </Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <Text style={[styles.rowLast, { color: unread ? theme.text : theme.textMuted }, unread && styles.rowLastUnread]} numberOfLines={1}>
                      {c.last_message?.content ?? 'Aucun message'}
                    </Text>
                    {unread && <View style={styles.badge}><Text style={styles.badgeText}>{c.unread_count}</Text></View>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucune conversation</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>Tes messages apparaîtront ici</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: '700' },
  newBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifBadge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FF3B5C', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: COLORS.white,
  },
  notifBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#22C55E', borderWidth: 2, borderColor: COLORS.white,
  },
  rowInfo: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontSize: FONT.size.base, fontWeight: FONT.weight.medium },
  rowNameUnread: { fontWeight: FONT.weight.bold },
  rowTime: { fontSize: 12 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLast: { fontSize: FONT.size.sm, flex: 1 },
  rowLastUnread: { fontWeight: FONT.weight.semibold },
  badge: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold },
  emptySub: { fontSize: FONT.size.sm },
});
