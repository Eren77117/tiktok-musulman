import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, FlatList, ScrollView,
  TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { IcSearch, IcClose, IcHash, IcUsers, IcBack, IcClock } from '../../components/ui/Icons';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';

const HISTORY_KEY = 'nour_search_history';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface UserResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  follower_count: number;
}
interface HashtagResult { tag: string; count: number }
interface SearchData { users?: UserResult[]; hashtags?: HashtagResult[] }
interface TrendingData { hashtags?: HashtagResult[]; users?: UserResult[] }

type Tab = 'tout' | 'comptes' | 'hashtags';

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [tab, setTab] = useState<Tab>('tout');
  const [history, setHistory] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(h => setHistory(JSON.parse(h ?? '[]'))).catch(() => {});
  }, []);

  const saveHistory = useCallback(async (q: string) => {
    const updated = [q, ...history.filter(h => h !== q)].slice(0, 10);
    setHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }, [history]);

  const removeHistoryItem = useCallback(async (q: string) => {
    const updated = history.filter(h => h !== q);
    setHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }, [history]);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await AsyncStorage.setItem(HISTORY_KEY, '[]');
  }, []);

  const handleChange = useCallback((v: string) => {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebouncedQ(v.trim()), 350);
  }, []);

  const doSearch = useCallback((q: string) => {
    setQuery(q);
    setDebouncedQ(q);
    saveHistory(q);
  }, [saveHistory]);

  const handleClear = useCallback(() => {
    setQuery('');
    setDebouncedQ('');
    setTab('tout');
  }, []);

  const { data: suggestionsData } = useQuery<SearchData>({
    queryKey: ['search/suggestions', debouncedQ],
    queryFn: () => api.get('/search/suggestions', { params: { q: debouncedQ } }).then(r => r.data),
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
  });

  const { data: searchData, isLoading: searchLoading } = useQuery<SearchData>({
    queryKey: ['search', debouncedQ],
    queryFn: () => api.get('/search', { params: { q: debouncedQ } }).then(r => r.data),
    enabled: debouncedQ.length > 0,
  });

  const { data: trendingData } = useQuery<TrendingData>({
    queryKey: ['search/trending'],
    queryFn: () => api.get('/search/trending').then(r => r.data),
    enabled: debouncedQ.length === 0,
  });

  const s = styles(theme);

  const goUser = (u: UserResult) => navigation.navigate('UserProfile', { userId: u.id, username: u.username });
  const goHash = (tag: string) => navigation.navigate('Hashtag', { tag });

  function renderAvatar(u: UserResult, size: number) {
    if (u.avatar_url) return <Image source={{ uri: u.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>{u.display_name[0]?.toUpperCase()}</Text>
      </View>
    );
  }

  function renderUserRow(u: UserResult) {
    return (
      <TouchableOpacity key={u.id} style={s.userRow} onPress={() => goUser(u)} activeOpacity={0.7}>
        {renderAvatar(u, 48)}
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={s.displayName} numberOfLines={1}>{u.display_name}</Text>
            {u.is_verified && <IcUsers size={14} color={COLORS.primary} />}
          </View>
          <Text style={s.username}>@{u.username} · {fmtCount(u.follower_count)} abonnés</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderHashRow(h: HashtagResult) {
    return (
      <TouchableOpacity key={h.tag} style={s.hashRow} onPress={() => goHash(h.tag)} activeOpacity={0.7}>
        <View style={s.hashIcon}><IcHash size={18} color={theme.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.hashTag}>#{h.tag}</Text>
          <Text style={s.hashCount}>{fmtCount(h.count)} vidéos</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderTabContent() {
    // Show suggestions inline while full search loads
    if (searchLoading && suggestionsData) {
      const sugUsers = suggestionsData.users ?? [];
      const sugHashtags = suggestionsData.hashtags ?? [];
      const mixed: Array<{ type: 'user'; data: UserResult } | { type: 'hash'; data: HashtagResult }> = [
        ...sugUsers.map(u => ({ type: 'user' as const, data: u })),
        ...sugHashtags.map(h => ({ type: 'hash' as const, data: h })),
      ];
      return (
        <FlatList
          data={mixed}
          keyExtractor={(item) => item.type === 'user' ? `su-${item.data.id}` : `sh-${item.data.tag}`}
          renderItem={({ item }) => item.type === 'user' ? renderUserRow(item.data) : renderHashRow(item.data)}
          contentContainerStyle={{ padding: SPACING.md }}
        />
      );
    }
    if (searchLoading) {
      return <View style={s.center}><ActivityIndicator color={theme.primary} size="large" /></View>;
    }
    const users = searchData?.users ?? [];
    const hashtags = searchData?.hashtags ?? [];

    if (tab === 'comptes') {
      return (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          renderItem={({ item }) => renderUserRow(item)}
          contentContainerStyle={{ padding: SPACING.md }}
          ListEmptyComponent={<Text style={s.empty}>Aucun compte trouvé</Text>}
        />
      );
    }
    if (tab === 'hashtags') {
      return (
        <FlatList
          data={hashtags}
          keyExtractor={h => h.tag}
          renderItem={({ item }) => renderHashRow(item)}
          contentContainerStyle={{ padding: SPACING.md }}
          ListEmptyComponent={<Text style={s.empty}>Aucun hashtag trouvé</Text>}
        />
      );
    }
    // "Tout"
    const mixed: Array<{ type: 'user'; data: UserResult } | { type: 'hash'; data: HashtagResult }> = [
      ...users.slice(0, 5).map(u => ({ type: 'user' as const, data: u })),
      ...hashtags.slice(0, 10).map(h => ({ type: 'hash' as const, data: h })),
    ];
    return (
      <FlatList
        data={mixed}
        keyExtractor={(item) => item.type === 'user' ? `u-${item.data.id}` : `h-${item.data.tag}`}
        renderItem={({ item }) => item.type === 'user' ? renderUserRow(item.data) : renderHashRow(item.data)}
        contentContainerStyle={{ padding: SPACING.md }}
        ListEmptyComponent={<Text style={s.empty}>Aucun résultat pour "{debouncedQ}"</Text>}
      />
    );
  }

  function renderTrending() {
    const tHashtags = trendingData?.hashtags ?? [];
    const tUsers = trendingData?.users ?? [];
    return (
      <ScrollView contentContainerStyle={{ padding: SPACING.md }} showsVerticalScrollIndicator={false}>
        {/* Historique */}
        {history.length > 0 && (
          <View style={{ marginBottom: SPACING.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
              <Text style={s.sectionTitle}>Récents</Text>
              <TouchableOpacity onPress={clearHistory} activeOpacity={0.7}>
                <Text style={{ fontSize: FONT.size.sm, color: theme.textSubtle }}>Tout effacer</Text>
              </TouchableOpacity>
            </View>
            {history.slice(0, 6).map(q => (
              <TouchableOpacity
                key={q}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
                onPress={() => doSearch(q)}
                activeOpacity={0.7}
              >
                <IcClock size={16} color={theme.textSubtle} />
                <Text style={{ flex: 1, fontSize: FONT.size.base, color: theme.text }}>{q}</Text>
                <TouchableOpacity onPress={() => removeHistoryItem(q)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <IcClose size={14} color={theme.textSubtle} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {tHashtags.length > 0 && (
          <View style={{ marginBottom: SPACING.lg }}>
            <Text style={s.sectionTitle}>Tendances</Text>
            <View style={s.pillsWrap}>
              {tHashtags.map(h => (
                <TouchableOpacity key={h.tag} style={s.pill} onPress={() => goHash(h.tag)} activeOpacity={0.7}>
                  <IcHash size={13} color={theme.primary} />
                  <Text style={s.pillText}>{h.tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {tUsers.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Comptes suggérés</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.md, paddingVertical: SPACING.sm }}>
              {tUsers.map(u => (
                <TouchableOpacity key={u.id} style={s.trendUser} onPress={() => goUser(u)} activeOpacity={0.7}>
                  {renderAvatar(u, 56)}
                  <Text style={s.trendUserName} numberOfLines={1}>{u.display_name}</Text>
                  <Text style={s.trendUserHandle} numberOfLines={1}>@{u.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Search bar */}
      <View style={s.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <IcBack size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={s.inputWrap}>
          <IcSearch size={16} color={theme.textMuted} />
          <TextInput
            style={s.input}
            value={query}
            onChangeText={handleChange}
            placeholder="Rechercher..."
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => { if (query.trim()) saveHistory(query.trim()); }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <IcClose size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs (only when searching) */}
      {debouncedQ.length > 0 && (
        <View style={s.tabs}>
          {(['tout', 'comptes', 'hashtags'] as Tab[]).map(t => (
            <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)} activeOpacity={0.7}>
              <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
                {t === 'tout' ? 'Tout' : t === 'comptes' ? 'Comptes' : 'Hashtags'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ flex: 1 }}>
        {debouncedQ.length > 0 ? renderTabContent() : renderTrending()}
      </View>
    </View>
  );
}

const styles = (t: ReturnType<typeof import('../../hooks/useTheme').useTheme>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  bar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.sm,
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: t.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: t.borderLight,
    paddingHorizontal: SPACING.sm, gap: SPACING.sm, height: 42,
  },
  input: { flex: 1, fontSize: FONT.size.base, color: t.text, paddingVertical: 0 },
  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.borderLight,
    marginHorizontal: SPACING.md,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: t.primary },
  tabLabel: { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium, color: t.textMuted },
  tabLabelActive: { color: t.primary, fontWeight: FONT.weight.semibold },
  userRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: t.borderLight,
  },
  displayName: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold, color: t.text },
  username: { fontSize: FONT.size.sm, color: t.textMuted, marginTop: 2 },
  hashRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: t.borderLight,
  },
  hashIcon: {
    width: 44, height: 44, borderRadius: RADIUS.sm,
    backgroundColor: t.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  hashTag: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold, color: t.text },
  hashCount: { fontSize: FONT.size.sm, color: t.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: t.textMuted, marginTop: 48, fontSize: FONT.size.base },
  sectionTitle: {
    fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold,
    color: t.textMuted, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: t.surface, borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: t.borderLight,
  },
  pillText: { fontSize: FONT.size.sm, color: t.text, fontWeight: FONT.weight.medium },
  trendUser: { alignItems: 'center', width: 80, gap: 4 },
  trendUserName: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold, color: t.text, textAlign: 'center' },
  trendUserHandle: { fontSize: FONT.size.xs, color: t.textMuted, textAlign: 'center' },
});
