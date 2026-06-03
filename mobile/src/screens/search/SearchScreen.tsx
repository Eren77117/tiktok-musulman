import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, FlatList,
  TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { COLORS, SPACING } from '../../constants';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface UserResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  follower_count: number;
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const navigation = useNavigation<Nav>();

  const { data, isLoading } = useQuery<{ users?: UserResult[] }>({
    queryKey: ['search', debouncedQ],
    queryFn: () => api.get('/search', { params: { q: debouncedQ } }).then((r) => r.data),
    enabled: debouncedQ.length > 0,
  });

  const { data: trending } = useQuery({
    queryKey: ['trending'],
    queryFn: () => api.get('/search/trending').then((r) => r.data),
    enabled: !debouncedQ,
  });

  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChange = (v: string) => {
    setQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQ(v), 400);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChange}
          placeholder="Chercher utilisateurs, vidéos..."
          placeholderTextColor={COLORS.textSubtle}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {isLoading && debouncedQ ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : debouncedQ ? (
        <FlatList
          data={data?.users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: SPACING.md }}
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
                    <Text style={styles.avatarText}>{u.display_name[0]?.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.displayName}>{u.display_name}</Text>
                <Text style={styles.username}>@{u.username} · {u.follower_count.toLocaleString()} abonnés</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aucun résultat pour "{debouncedQ}"</Text>
          }
        />
      ) : (
        <View style={styles.trendingSection}>
          <Text style={styles.sectionTitle}>Tendances</Text>
          <View style={styles.categories}>
            {(trending?.categories ?? []).map((c: { id: string; name: string }) => (
              <TouchableOpacity key={c.id} style={styles.categoryTag}>
                <Text style={styles.categoryText}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    margin: SPACING.md,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { fontSize: 18, color: COLORS.textSubtle },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: COLORS.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  avatarImg: { width: 48, height: 48 },
  avatarFallback: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  userInfo: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  username: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
  trendingSection: { padding: SPACING.md },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted, marginBottom: 12 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryTag: { backgroundColor: COLORS.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.border },
  categoryText: { fontSize: 13, color: COLORS.text },
});
