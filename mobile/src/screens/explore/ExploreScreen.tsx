import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, FlatList,
  TouchableOpacity, Image, ActivityIndicator, ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface UserResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  follower_count: number;
}

interface Post {
  id: string;
  thumbnail_url: string | null;
  caption: string | null;
  like_count: number;
  view_count: number;
  user: { id: string; username: string; display_name: string };
}

const CATEGORIES = [
  { id: 'all', label: 'Tout', icon: '✦' },
  { id: 'rappel', label: 'Rappel', icon: '◑' },
  { id: 'coran', label: 'Coran', icon: '◈' },
  { id: 'motivation', label: 'Motivation', icon: '◆' },
  { id: 'lifestyle', label: 'Lifestyle', icon: '◇' },
];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: searchData, isLoading: searchLoading } = useQuery<{ users?: UserResult[]; posts?: Post[] }>({
    queryKey: ['search', debouncedQ],
    queryFn: () => api.get('/search', { params: { q: debouncedQ } }).then((r) => r.data),
    enabled: debouncedQ.length > 1,
  });

  const { data: trending, isLoading: trendingLoading } = useQuery<{ items?: Post[] }>({
    queryKey: ['trending', activeCategory],
    queryFn: () => api.get('/posts/trending', {
      params: activeCategory !== 'all' ? { category: activeCategory, limit: 20 } : { limit: 20 },
    }).then((r) => r.data).catch(() => ({ items: [] })),
    enabled: !debouncedQ,
  });

  const handleChange = (v: string) => {
    setQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQ(v), 400);
  };

  const clearSearch = () => {
    setQuery('');
    setDebouncedQ('');
  };

  const isSearching = debouncedQ.length > 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explorer</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleChange}
            placeholder="Chercher utilisateurs, vidéos..."
            placeholderTextColor={COLORS.textPlaceholder}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isSearching ? (
        // ── Search results ──
        searchLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={searchData?.users ?? []}
            keyExtractor={(u) => u.id}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              searchData?.users?.length ? (
                <Text style={styles.sectionLabel}>Utilisateurs</Text>
              ) : null
            }
            renderItem={({ item: u }) => (
              <TouchableOpacity
                style={styles.userRow}
                onPress={() => navigation.navigate('UserProfile', { userId: u.id, username: u.username })}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  {u.avatar_url ? (
                    <Image source={{ uri: u.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarImg, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>{u.display_name[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.displayName}>{u.display_name}</Text>
                  <Text style={styles.username}>@{u.username} · {u.follower_count.toLocaleString()} abonnés</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>⌕</Text>
                <Text style={styles.emptyTitle}>Aucun résultat</Text>
                <Text style={styles.emptySubtitle}>Essayez d'autres termes</Text>
              </View>
            }
          />
        )
      ) : (
        // ── Trending / Category browse ──
        <FlatList
          data={trending?.items ?? []}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              {/* Categories */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesRow}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catChip, activeCategory === cat.id && styles.catChipActive]}
                    onPress={() => setActiveCategory(cat.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.catIcon}>{cat.icon}</Text>
                    <Text style={[styles.catLabel, activeCategory === cat.id && styles.catLabelActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.sectionLabel}>Tendances</Text>
            </View>
          }
          renderItem={({ item: p }) => (
            <TouchableOpacity
              style={styles.gridCard}
              onPress={() => navigation.navigate('PostDetail', { postId: p.id })}
              activeOpacity={0.85}
            >
              {p.thumbnail_url ? (
                <Image source={{ uri: p.thumbnail_url }} style={styles.gridImg} resizeMode="cover" />
              ) : (
                <View style={[styles.gridImg, styles.gridImgFallback]}>
                  <Text style={styles.gridFallbackIcon}>▶</Text>
                </View>
              )}
              <View style={styles.gridOverlay}>
                <Text style={styles.gridViews}>♥ {fmtNum(p.like_count)}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            trendingLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>◎</Text>
                <Text style={styles.emptyTitle}>Aucun contenu</Text>
                <Text style={styles.emptySubtitle}>Revenez bientôt</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const GRID_ITEM_WIDTH = '48%';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  headerTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, color: COLORS.text },

  searchWrap: { padding: SPACING.md, paddingBottom: 0 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.inputBg,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon: { fontSize: 18, color: COLORS.textMuted },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: FONT.size.base, color: COLORS.text },
  clearBtn: { padding: 4 },
  clearIcon: { fontSize: 14, color: COLORS.textMuted },

  listContent: { padding: SPACING.md, paddingTop: SPACING.sm },
  sectionLabel: {
    fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold,
    color: COLORS.textMuted, marginBottom: SPACING.sm, marginTop: SPACING.sm,
  },

  // User row
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: SPACING.sm, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOW.sm,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  avatarImg: { width: 48, height: 48 },
  avatarFallback: { backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: FONT.weight.bold, color: COLORS.primary },
  userInfo: { flex: 1 },
  displayName: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold, color: COLORS.text },
  username: { fontSize: FONT.size.xs, color: COLORS.textMuted, marginTop: 2 },
  chevron: { fontSize: 20, color: COLORS.textSubtle },

  // Categories
  categoriesRow: { paddingVertical: SPACING.sm, gap: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.white, borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  catChipActive: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
  catIcon: { fontSize: 14 },
  catLabel: { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium, color: COLORS.textMuted },
  catLabelActive: { color: COLORS.primary, fontWeight: FONT.weight.semibold },

  // Grid
  gridRow: { justifyContent: 'space-between', marginBottom: 8 },
  gridCard: {
    width: GRID_ITEM_WIDTH, aspectRatio: 4 / 5,
    borderRadius: RADIUS.md, overflow: 'hidden',
    backgroundColor: COLORS.primaryBg,
  },
  gridImg: { width: '100%', height: '100%' },
  gridImgFallback: { alignItems: 'center', justifyContent: 'center' },
  gridFallbackIcon: { fontSize: 32, color: COLORS.primaryLight },
  gridOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 8, backgroundColor: 'rgba(0,0,0,0.35)',
  },
  gridViews: { fontSize: FONT.size.xs, color: COLORS.white, fontWeight: FONT.weight.medium },

  // Empty
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 48, color: COLORS.primaryLight, marginBottom: 8 },
  emptyTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, color: COLORS.text },
  emptySubtitle: { fontSize: FONT.size.sm, color: COLORS.textMuted },
});
