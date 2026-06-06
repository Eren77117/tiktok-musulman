import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl, ScrollView, ActionSheetIOS, Platform, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { IcSearch, IcBell, IcPlus, IcPin, IcArchive, IcMail } from '../../components/ui/Icons';
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

function AvatarCircle({ user, size = 56 }: { user: { display_name: string; avatar_url: string | null }; size?: number }) {
  const theme = useTheme();
  if (user.avatar_url) {
    return <Image source={{ uri: user.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.35, fontWeight: FONT.weight.bold, color: COLORS.primary }}>
        {user.display_name[0]?.toUpperCase()}
      </Text>
    </View>
  );
}

export default function MessagesScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());

  const handleLongPressConv = useCallback((c: Conversation) => {
    const isPinned = pinnedIds.has(c.id);
    const isArchived = archivedIds.has(c.id);
    const options = [
      'Annuler',
      isPinned ? 'Désépingler' : 'Épingler',
      isArchived ? 'Désarchiver' : 'Archiver',
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 0 }, (idx) => {
        if (idx === 1) {
          setPinnedIds(prev => { const s = new Set(prev); isPinned ? s.delete(c.id) : s.add(c.id); return s; });
        } else if (idx === 2) {
          setArchivedIds(prev => { const s = new Set(prev); isArchived ? s.delete(c.id) : s.add(c.id); return s; });
        }
      });
    } else {
      Alert.alert(c.other_user.display_name, undefined, [
        { text: isPinned ? 'Désépingler' : 'Épingler', onPress: () => setPinnedIds(prev => { const s = new Set(prev); isPinned ? s.delete(c.id) : s.add(c.id); return s; }) },
        { text: isArchived ? 'Désarchiver' : 'Archiver', onPress: () => setArchivedIds(prev => { const s = new Set(prev); isArchived ? s.delete(c.id) : s.add(c.id); return s; }) },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  }, [pinnedIds, archivedIds]);

  const { data: notifCount } = useQuery<{ count: number }>({
    queryKey: ['notif-count'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data).catch(() => ({ count: 0 })),
    refetchInterval: 15_000,
  });

  const { data, isLoading, refetch, isRefetching } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => api.get('/messages/conversations').then(r => r.data).catch(() => []),
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
  });

  const allConvs = data ?? [];
  // Pinned first, archived hidden
  const conversations = [
    ...allConvs.filter(c => pinnedIds.has(c.id) && !archivedIds.has(c.id)),
    ...allConvs.filter(c => !pinnedIds.has(c.id) && !archivedIds.has(c.id)),
  ];
  const archivedConvs = allConvs.filter(c => archivedIds.has(c.id));

  const goToConversation = (c: Conversation) =>
    navigation.navigate('Conversation', { conversationId: c.id, otherUser: c.other_user });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
        <Text style={[styles.title, { color: theme.text }]}>Messages</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}
            onPress={() => navigation.navigate('Notifications')}>
            <IcBell size={22} color={theme.text} />
            {(notifCount?.count ?? 0) > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {(notifCount?.count ?? 0) > 9 ? '9+' : notifCount?.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <IcSearch size={22} color={theme.text} />
          </TouchableOpacity>
        </View>
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
          ListHeaderComponent={
            conversations.length > 0 ? (
              <View style={[styles.storySection, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRow}>
                  {/* Créer */}
                  <View style={styles.storyItem}>
                    <View style={[styles.storyCreateCircle, { backgroundColor: theme.primaryBg, borderColor: COLORS.primaryLight }]}>
                      <IcPlus size={22} color={COLORS.primary} />
                    </View>
                    <Text style={[styles.storyLabel, { color: theme.textMuted }]} numberOfLines={1}>Créer</Text>
                  </View>
                  {/* Conversations actives */}
                  {conversations.slice(0, 8).map(c => (
                    <TouchableOpacity key={c.id} style={styles.storyItem} onPress={() => goToConversation(c)} activeOpacity={0.8}>
                      <View style={[styles.storyCircle, (c.unread_count ?? 0) > 0 && { borderColor: COLORS.primary, borderWidth: 2.5 }]}>
                        <AvatarCircle user={c.other_user} size={52} />
                      </View>
                      <Text style={[styles.storyLabel, { color: theme.text }]} numberOfLines={1}>
                        {c.other_user.display_name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
          renderItem={({ item: c }) => {
            const unread = (c.unread_count ?? 0) > 0;
            const isPinned = pinnedIds.has(c.id);
            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: theme.borderLight, backgroundColor: theme.surface }]}
                onPress={() => goToConversation(c)}
                onLongPress={() => handleLongPressConv(c)}
                delayLongPress={400}
                activeOpacity={0.7}
              >
                <View style={styles.avatarWrap}>
                  <AvatarCircle user={c.other_user} size={52} />
                  {(c.unread_count ?? 0) > 0 && (
                    <View style={[styles.unreadDot, { borderColor: theme.bg }]} />
                  )}
                </View>
                <View style={styles.rowInfo}>
                  <View style={styles.rowTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                      {isPinned && <IcPin size={11} color={COLORS.primary} />}
                      <Text style={[styles.rowName, { color: theme.text }, unread && styles.rowNameUnread]} numberOfLines={1}>
                        {c.other_user.display_name}
                      </Text>
                    </View>
                    <Text style={[styles.rowTime, { color: theme.textSubtle }]}>
                      {c.last_message ? formatTime(c.last_message.created_at) : ''}
                    </Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <Text style={[styles.rowLast, { color: unread ? theme.text : theme.textMuted }, unread && styles.rowLastUnread]} numberOfLines={1}>
                      {c.last_message?.content ?? 'Aucun message'}
                    </Text>
                    {unread
                      ? <View style={styles.badge}><Text style={styles.badgeText}>{c.unread_count}</Text></View>
                      : null
                    }
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={archivedConvs.length > 0 ? (
            <TouchableOpacity
              style={[styles.archivedRow, { borderTopColor: theme.borderLight }]}
              onPress={() => Alert.alert('Archivées', `${archivedConvs.length} conversation(s) archivée(s)\nAppui long → Désarchiver`)}
              activeOpacity={0.7}
            >
              <IcArchive size={18} color={theme.textMuted} />
              <Text style={[styles.archivedText, { color: theme.textMuted }]}>
                {archivedConvs.length} conversation{archivedConvs.length > 1 ? 's' : ''} archivée{archivedConvs.length > 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          ) : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.primaryBg }]}>
                <IcMail size={28} color={COLORS.primary} strokeWidth={1.5} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucune conversation</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>Commence une discussion avec quelqu'un que tu suis</Text>
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
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifBadge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#FF3B5C', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: COLORS.white,
  },
  notifBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  storySection: { paddingVertical: 12, borderBottomWidth: 1 },
  storyRow: { paddingHorizontal: SPACING.md, gap: 16 },
  storyItem: { alignItems: 'center', gap: 6, width: 62 },
  storyCreateCircle: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  storyCircle: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 0, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  storyLabel: { fontSize: 11, fontWeight: FONT.weight.medium, textAlign: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  avatarWrap: { position: 'relative' },
  unreadDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.primary, borderWidth: 2,
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12, paddingHorizontal: 40 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  archivedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderTopWidth: 1 },
  archivedText: { fontSize: FONT.size.sm },
  emptyTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold },
  emptySub: { fontSize: FONT.size.sm },
});
