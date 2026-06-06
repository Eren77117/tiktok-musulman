import React, { useState, useRef, useCallback } from 'react';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, ScrollView, Animated,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, MessageCircle, UserPlus, Bookmark, AtSign, Bell, Check } from 'lucide-react-native';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, SPACING } from '../../constants/theme';
import { IcBack } from '../../components/ui/Icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  data?: { post_id?: string; user_id?: string; comment_id?: string; session_id?: string; avatar_url?: string };
}

const TYPE_META: Record<string, { icon: any; color: string; bg: string }> = {
  LIKE:                     { icon: Heart,         color: '#FF3B5C', bg: '#FEE2E2' },
  COMMENT:                  { icon: MessageCircle, color: '#3B82F6', bg: '#DBEAFE' },
  FOLLOW:                   { icon: UserPlus,      color: COLORS.primary, bg: COLORS.primaryBg },
  SAVE:                     { icon: Bookmark,      color: '#8B5CF6', bg: '#EDE9FE' },
  MENTION:                  { icon: AtSign,        color: '#F59E0B', bg: '#FEF3C7' },
  MESSAGE_REQUEST:          { icon: MessageCircle, color: '#06B6D4', bg: '#CFFAFE' },
  MESSAGE_REQUEST_ACCEPTED: { icon: Check,         color: COLORS.primary, bg: COLORS.primaryBg },
  LIVE_START:               { icon: Bell,          color: '#FF3B30', bg: '#FFE5E5' },
  SYSTEM:                   { icon: Bell,          color: '#6B7280', bg: '#F3F4F6' },
};

const TABS = [
  { key: 'all',      label: 'Tout' },
  { key: 'likes',    label: "J'aime" },
  { key: 'comments', label: 'Commentaires' },
  { key: 'follows',  label: 'Abonnés' },
] as const;
type TabKey = typeof TABS[number]['key'];

const TAB_TYPES: Record<TabKey, string[]> = {
  all:      [],
  likes:    ['LIKE', 'SAVE'],
  comments: ['COMMENT', 'MENTION'],
  follows:  ['FOLLOW'],
};

function fmtTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}j`;
}

export default function NotificationsScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  // Animated underline
  const tabWidths = useRef<number[]>([]);
  const tabOffsets = useRef<number[]>([]);
  const underlineX = useRef(new Animated.Value(0)).current;
  const underlineW = useRef(new Animated.Value(0)).current;

  const animateTab = (index: number) => {
    const w = tabWidths.current[index] ?? 0;
    const x = tabOffsets.current[index] ?? 0;
    Animated.parallel([
      Animated.spring(underlineX, { toValue: x, useNativeDriver: false, stiffness: 420, damping: 34 }),
      Animated.spring(underlineW, { toValue: w, useNativeDriver: false, stiffness: 420, damping: 34 }),
    ]).start();
  };

  const { data, isLoading, refetch, isRefetching } = useQuery<{ items: Notification[] }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data).catch(() => ({ items: [] })),
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
  });

  const readAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-unread'] });
    },
  });

  const markRead = (notif: Notification) => {
    api.patch(`/notifications/${notif.id}/read`).catch(() => {});
    qc.setQueryData(['notifications'], (old: any) => old ? {
      ...old, items: old.items.map((n: Notification) =>
        n.id === notif.id ? { ...n, is_read: true } : n),
    } : old);
    qc.invalidateQueries({ queryKey: ['notif-unread'] });

    const postId = notif.data?.post_id;
    const userId = notif.data?.user_id;
    const sessionId = notif.data?.session_id;
    if (sessionId && notif.type === 'LIVE_START') {
      nav.navigate('LiveViewer', { sessionId, broadcasterId: userId ?? '' });
    } else if (postId && ['LIKE', 'COMMENT', 'SAVE', 'MENTION'].includes(notif.type)) {
      nav.navigate('VideoPlayer', { postId });
    } else if (userId) {
      nav.navigate('UserProfile', { userId, username: '' });
    }
  };

  const allNotifs = data?.items ?? [];
  const types = TAB_TYPES[activeTab];
  const filtered = types.length === 0 ? allNotifs : allNotifs.filter(n => types.includes(n.type));
  const unreadCount = allNotifs.filter(n => !n.is_read).length;

  const renderNotif = useCallback(({ item: n }: { item: Notification }) => {
    const meta = TYPE_META[n.type] ?? TYPE_META.SYSTEM;
    const isFollow = n.type === 'FOLLOW';
    return (
      <TouchableOpacity
        style={[
          styles.row,
          { borderBottomColor: theme.borderLight },
          !n.is_read && { backgroundColor: theme.isDark ? '#0D1F13' : '#F0FDF4' },
        ]}
        onPress={() => { ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true }); markRead(n); }}
        activeOpacity={0.7}
      >
        <View style={styles.iconWrap}>
          {n.data?.avatar_url && isFollow ? (
            <View>
              <Image source={{ uri: n.data.avatar_url }} style={styles.avatarImg} />
              <View style={[styles.iconBadge, { backgroundColor: meta.bg }]}>
                <meta.icon size={11} color={meta.color} strokeWidth={2} />
              </View>
            </View>
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: meta.bg }]}>
              <meta.icon size={20} color={meta.color} strokeWidth={1.8} />
            </View>
          )}
        </View>
        <View style={styles.rowInfo}>
          <Text style={[styles.rowTitle, { color: theme.text }]}>{n.title}</Text>
          <Text style={[styles.rowBody, { color: theme.textMuted }]} numberOfLines={2}>{n.body}</Text>
          <Text style={[styles.rowTime, { color: theme.textSubtle }]}>{fmtTime(n.created_at)}</Text>
        </View>
        {!n.is_read && <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />}
      </TouchableOpacity>
    );
  }, [theme]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <IcBack size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={() => { ReactNativeHapticFeedback.trigger('impactMedium', { enableVibrateFallback: true }); readAllMutation.mutate(); }} style={styles.markAllBtn} disabled={readAllMutation.isPending}>
            <Text style={styles.markAllText}>Tout lire</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 68 }} />}
      </View>

      {/* Tabs */}
      <View style={[styles.tabsWrap, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TABS.map((tab, i) => {
            const isActive = activeTab === tab.key;
            const tabUnread = tab.key === 'all'
              ? unreadCount
              : allNotifs.filter(n => TAB_TYPES[tab.key].includes(n.type) && !n.is_read).length;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tab}
                onPress={() => {
                  ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });
                  setActiveTab(tab.key);
                  animateTab(i);
                }}
                onLayout={e => {
                  tabWidths.current[i] = e.nativeEvent.layout.width;
                  tabOffsets.current[i] = e.nativeEvent.layout.x;
                  if (i === 0 && activeTab === 'all') {
                    underlineW.setValue(e.nativeEvent.layout.width);
                    underlineX.setValue(e.nativeEvent.layout.x);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, { color: isActive ? COLORS.primary : theme.textMuted }, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tabUnread > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{tabUnread > 9 ? '9+' : tabUnread}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Animated.View style={[styles.tabUnderline, { left: underlineX, width: underlineW }]} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Bell size={48} color={theme.textSubtle} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucune notification</Text>
          <Text style={[styles.emptySub, { color: theme.textMuted }]}>
            {activeTab === 'all' ? 'Tes likes, abonnés et commentaires apparaîtront ici' :
             activeTab === 'likes' ? 'Personne n\'a encore aimé tes vidéos' :
             activeTab === 'comments' ? 'Aucun commentaire pour l\'instant' :
             'Aucun nouvel abonné pour l\'instant'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={n => n.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
          renderItem={renderNotif}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '700' },
  markAllBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  markAllText: { fontSize: FONT.size.sm, color: COLORS.primary, fontWeight: FONT.weight.semibold },

  tabsWrap: { borderBottomWidth: 1 },
  tabsRow: { paddingHorizontal: SPACING.md, gap: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 12 },
  tabLabel: { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium },
  tabLabelActive: { fontWeight: FONT.weight.bold },
  tabBadge: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  tabUnderline: { position: 'absolute', bottom: 0, height: 2.5, backgroundColor: COLORS.primary, borderRadius: 2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: SPACING.md, paddingVertical: 13,
    borderBottomWidth: 0.5,
  },
  iconWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  iconBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, lineHeight: 18 },
  rowBody: { fontSize: FONT.size.xs, lineHeight: 16 },
  rowTime: { fontSize: 11, marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold },
  emptySub: { fontSize: FONT.size.sm, textAlign: 'center', lineHeight: 20 },
});
