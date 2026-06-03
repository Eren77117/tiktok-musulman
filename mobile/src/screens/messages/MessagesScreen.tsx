import React from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { COLORS, SPACING } from '../../constants';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Conversation {
  id: string;
  other_user: { id: string; username: string; display_name: string; avatar_url: string | null };
  last_message: { content: string; created_at: string; sender_id: string } | null;
  updated_at: string;
}

export default function MessagesScreen() {
  const navigation = useNavigation<Nav>();

  const { data, isLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => api.get('/messages/conversations').then((r) => r.data),
    refetchInterval: 10_000,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(c) => c.id}
          renderItem={({ item: c }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('Conversation', {
                conversationId: c.id,
                otherUser: c.other_user,
              })}
              activeOpacity={0.7}
            >
              <View style={styles.avatar}>
                {c.other_user.avatar_url ? (
                  <Image source={{ uri: c.other_user.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarImg, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>{c.other_user.display_name[0]?.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{c.other_user.display_name}</Text>
                <Text style={styles.rowLast} numberOfLines={1}>
                  {c.last_message?.content ?? 'Aucun message encore'}
                </Text>
              </View>
              <Text style={styles.rowTime}>
                {c.last_message ? formatTime(c.last_message.created_at) : ''}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>Aucune conversation pour l'instant</Text>
          }
        />
      )}
    </View>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  avatar: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden' },
  avatarImg: { width: 50, height: 50 },
  avatarFallback: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  rowLast: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  rowTime: { fontSize: 12, color: COLORS.textSubtle },
  empty: { textAlign: 'center', color: COLORS.textMuted, padding: SPACING.xl },
});
