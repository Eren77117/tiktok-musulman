import React from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT } from '../../constants/theme';
import { IcBack, IcEye, IcHeart } from '../../components/ui/Icons';

const CELL = (Dimensions.get('window').width - 4) / 3;

export default function StoryArchiveScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const { data: stories = [], isLoading } = useQuery<any[]>({
    queryKey: ['stories-archive'],
    queryFn: () => api.get('/stories/archive').then(r => r.data),
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <IcBack size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Archives</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}><Text style={{ color: theme.textMuted }}>Chargement...</Text></View>
      ) : stories.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: theme.textMuted, fontSize: FONT.size.base }}>Aucune story archivée</Text>
          <Text style={{ color: theme.textMuted, fontSize: FONT.size.sm, marginTop: 8, textAlign: 'center' }}>
            Tes stories expirées apparaîtront ici
          </Text>
        </View>
      ) : (
        <FlatList
          data={stories}
          numColumns={3}
          keyExtractor={(s: any) => s.id}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
          renderItem={({ item: s }: any) => (
            <View style={styles.cell}>
              <Image source={{ uri: s.media_url }} style={styles.cellImg} resizeMode="cover" />
              <View style={styles.cellOverlay}>
                <View style={styles.stat}>
                  <IcEye size={11} color="#fff" />
                  <Text style={styles.statText}>{s.views_count}</Text>
                </View>
                <View style={styles.stat}>
                  <IcHeart size={11} color="#fff" />
                  <Text style={styles.statText}>{s.likes_count}</Text>
                </View>
              </View>
            </View>
          )}
          contentContainerStyle={{ gap: 2 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { padding: 4, width: 40 },
  title: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  cell: { width: CELL, height: CELL * 1.5, position: 'relative' },
  cellImg: { width: '100%', height: '100%' },
  cellOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 8, padding: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { color: '#fff', fontSize: 10, fontWeight: '600' },
});
