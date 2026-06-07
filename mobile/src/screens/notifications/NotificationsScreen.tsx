import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Animated,
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

function fmtTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}j`;
}

type TabKey = 'all' | 'likes' | 'comments' | 'follows';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: any;
  iconColor: string;
}

const TABS: TabConfig[] = [
  { key: 'all',      label: 'Tous',         icon: Bell,         iconColor: '#6B7280' },
  { key: 'likes',    label: "J'aime",       icon: Heart,        iconColor: '#FF3B5C' },
  { key: 'comments', label: 'Commentaires', icon: MessageCircle,iconColor: '#3B82F6' },
  { key: 'follows',  label: 'Abonnés',      icon: UserPlus,     iconColor: COLORS.primary },
];

function useNotifTab(tab: TabKey) {
  const tabParam = tab === 'all' ? undefined : tab;
  return useQuery<{ items: Notification[] }>({
    queryKey: ['notifications', tab],
    queryFn: () => api.get('/notifications', {
      params: { limit: 30, ...(tabParam ? { tab: tabParam } : {}) },
    }).then(r => r.data).catch(() => ({ items: [] })),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });
}

export default function NotificationsScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const { data, isLoading, refetch, isRefetching } = useNotifTab(activeTab);

  const readAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      TABS.forEach(t => qc.invalidateQueries({ queryKey: ['notifications', t.key] }));
      qc.invalidateQueries({ queryKey: ['notif-unread'] });
    },
  });

  const markRead = useCallback((notif: Notification) => {
    api.patch(`/notifications/${notif.id}/read`).catch(() => {});
    // Optimistic update across all tab caches
    TABS.forEach(t => {
      qc.setQueryData(['notifications', t.key], (old: any) => old ? {
        ...old, items: old.items.map((n: Notification) =>
          n.id === notif.id ? { ...n, is_read: true } : n),
      } : old);
    });
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
  }, [nav, qc]);

  const allNotifs = data?.items ?? [];
  const unread = allNotifs.filter(n => !n.is_read).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <IcBack size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
        {unread > 0 ? (
          <TouchableOpacity
            onPress={() => readAllMutation.mutate()}
            style={styles.markAllBtn}
            disabled={readAllMutation.isPending}
          >
            <Text style={styles.markAllText}>Tout lire</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 68 }} />}
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Icon
                size={15}
                color={isActive ? COLORS.primary : theme.textMuted}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <Text style={[
                styles.tabLabel,
                { color: isActive ? COLORS.primary : theme.textMuted },
                isActive && styles.tabLabelActive,
              ]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : allNotifs.length === 0 ? (
        <EmptyState tab={activeTab} theme={theme} />
      ) : (
        <FlatList
          data={allNotifs}
          keyExtractor={n => n.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          renderItem={({ item: n }) => (
            <NotifRow key={n.id} notif={n} onPress={markRead} theme={theme} />
          )}
        />
      )}
    </View>
  );
}

function NotifRow({
  notif: n,
  onPress,
  theme,
}: {
  notif: Notification;
  onPress: (n: Notification) => void;
  theme: any;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const meta = TYPE_META[n.type] ?? TYPE_META.SYSTEM;
  const isFollow = n.type === 'FOLLOW';

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 300 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.row,
          { borderBottomColor: theme.borderLight },
          !n.is_read && { backgroundColor: theme.isDark ? '#0D1F13' : '#F0FDF4' },
        ]}
        onPress={() => onPress(n)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {/* Icône ou avatar */}
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
    </Animated.View>
  );
}

function EmptyState({ tab, theme }: { tab: TabKey; theme: any }) {
  const MSGS: Record<TabKey, { icon: any; color: string; title: string; sub: string }> = {
    all:      { icon: Bell,         color: '#6B7280', title: 'Aucune notification', sub: 'Tes likes, abonnés et commentaires apparaîtront ici' },
    likes:    { icon: Heart,        color: '#FF3B5C', title: 'Aucun j\'aime',       sub: 'Quand quelqu\'un aime ta vidéo, tu le verras ici' },
    comments: { icon: MessageCircle,color: '#3B82F6', title: 'Aucun commentaire',   sub: 'Les commentaires et mentions apparaîtront ici' },
    follows:  { icon: UserPlus,     color: COLORS.primary, title: 'Aucun abonné', sub: 'Quand quelqu\'un s\'abonne, tu le verras ici' },
  };
  const msg = MSGS[tab];
  const Icon = msg.icon;
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconWrap, { backgroundColor: `${msg.color}15` }]}>
        <Icon size={36} color={msg.color} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{msg.title}</Text>
      <Text style={[styles.emptySub, { color: theme.textMuted }]}>{msg.sub}</Text>
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

  tabBar: {
    flexDirection: 'row', borderBottomWidth: 0.5,
  },
  tabItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, gap: 4, position: 'relative',
  },
  tabItemActive: {},
  tabLabel: { fontSize: 11, fontWeight: '500', lineHeight: 14 },
  tabLabelActive: { fontWeight: '700' },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: '15%', right: '15%',
    height: 2.5, backgroundColor: COLORS.primary, borderRadius: 2,
  },

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

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, textAlign: 'center' },
  emptySub: { fontSize: FONT.size.sm, textAlign: 'center', lineHeight: 20 },
});
