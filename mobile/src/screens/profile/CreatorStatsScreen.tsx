import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation';
import { api } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { IcBack, IcPlay, IcHeart, IcUsers, IcComment } from '../../components/ui/Icons';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatorStats'>;

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function fmtWatch(sec: number) {
  if (sec >= 3600) return `${(sec / 3600).toFixed(1)}h`;
  if (sec >= 60) return `${Math.floor(sec / 60)}min`;
  return `${sec}s`;
}

interface Stats {
  total_views: number;
  total_likes: number;
  total_followers: number;
  total_posts: number;
  views_period: number;
  likes_period: number;
  followers_period: number;
  completion_rate: number;
  avg_watch_sec: number;
  top_posts: Array<{ id: string; caption: string; view_count: number; like_count: number; comment_count: number; thumbnail_url: string | null }>;
  period: number;
}

/** Simple arc using View borders — no SVG dependency */
function CompletionRing({ pct, theme }: { pct: number; theme: any }) {
  const size = 100;
  const label = `${pct}%`;
  const color = pct >= 60 ? '#34C759' : pct >= 30 ? '#FF9500' : '#FF3B30';
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={[ringStyles.circle, { width: size, height: size, borderRadius: size / 2, borderColor: theme.borderLight }]}>
        <View style={[ringStyles.fill, { borderColor: color, width: size, height: size, borderRadius: size / 2 }]} />
        <View style={[ringStyles.inner, { backgroundColor: theme.surface, width: size - 12, height: size - 12, borderRadius: (size - 12) / 2 }]}>
          <Text style={[ringStyles.pct, { color }]}>{label}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center' }}>Taux de complétion</Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  circle: { borderWidth: 6, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  fill: { position: 'absolute', borderWidth: 6 },
  inner: { alignItems: 'center', justifyContent: 'center' },
  pct: { fontSize: 18, fontWeight: '800' },
});

export default function CreatorStatsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [period, setPeriod] = useState<'7' | '30'>('7');

  const { data, isLoading } = useQuery<Stats>({
    queryKey: ['creator-stats', period],
    queryFn: () => api.get('/users/me/stats', { params: { period } }).then(r => r.data).catch(() => null),
  });

  const periodLabel = period === '7' ? '7 derniers jours' : '30 derniers jours';

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.borderLight, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <IcBack size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Statistiques</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period toggle */}
      <View style={[styles.periodRow, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
        {(['7', '30'] as const).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
            activeOpacity={0.8}
          >
            <Text style={[styles.periodBtnText, { color: period === p ? COLORS.white : theme.textMuted }]}>
              {p === '7' ? '7 jours' : '30 jours'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : !data ? (
        <View style={styles.center}>
          <Text style={{ color: theme.textMuted }}>Erreur de chargement</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Period stats */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{periodLabel}</Text>
          <View style={styles.cardGrid}>
            {[
              { label: 'Vues', value: data.views_period, Icon: IcPlay, color: '#3B82F6' },
              { label: 'Likes', value: data.likes_period, Icon: IcHeart, color: '#FF3B5C' },
              { label: 'Abonnés', value: data.followers_period, Icon: IcUsers, color: COLORS.primary },
            ].map(({ label, value, Icon, color }) => (
              <View key={label} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
                <View style={[styles.cardIconCircle, { backgroundColor: color + '18' }]}>
                  <Icon size={18} color={color} />
                </View>
                <Text style={[styles.cardVal, { color: theme.text }]}>{fmtNum(value)}</Text>
                <Text style={[styles.cardLabel, { color: theme.textMuted }]}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Engagement metrics */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Engagement</Text>
          <View style={[styles.engagementRow, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
            <CompletionRing pct={data.completion_rate} theme={theme} />
            <View style={styles.engSeparator} />
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text style={[styles.bigNum, { color: theme.text }]}>{fmtWatch(data.avg_watch_sec)}</Text>
              <Text style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center' }}>Durée moy. vue</Text>
            </View>
            <View style={styles.engSeparator} />
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text style={[styles.bigNum, { color: theme.text }]}>{fmtNum(data.total_posts)}</Text>
              <Text style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center' }}>Vidéos publiées</Text>
            </View>
          </View>

          {/* Total compte */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Totaux du compte</Text>
          <View style={[styles.summaryBox, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
            {[
              { key: 'Vues totales', val: fmtNum(data.total_views) },
              { key: 'Likes totaux', val: fmtNum(data.total_likes) },
              { key: 'Abonnés', val: fmtNum(data.total_followers) },
            ].map(({ key, val }) => (
              <View key={key} style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: theme.textMuted }]}>{key}</Text>
                <Text style={[styles.summaryVal, { color: theme.text }]}>{val}</Text>
              </View>
            ))}
          </View>

          {/* Top posts */}
          {data.top_posts.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Meilleures vidéos</Text>
              <View style={[styles.topPostsBox, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
                {data.top_posts.map((p, i) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.topPostRow, i < data.top_posts.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.borderLight }]}
                    onPress={() => navigation.navigate('VideoPlayer', { postId: p.id })}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.topPostRank, { color: i < 3 ? COLORS.primary : theme.textMuted }]}>#{i + 1}</Text>
                    {p.thumbnail_url ? (
                      <Image source={{ uri: p.thumbnail_url }} style={styles.topPostThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.topPostThumb, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderLight }]} />
                    )}
                    <View style={styles.topPostInfo}>
                      <Text style={[styles.topPostCaption, { color: theme.text }]} numberOfLines={1}>
                        {p.caption || '—'}
                      </Text>
                      <View style={styles.topPostMeta}>
                        <IcPlay size={11} color={theme.textMuted} />
                        <Text style={[styles.topPostStat, { color: theme.textMuted }]}>{fmtNum(p.view_count)}</Text>
                        <IcHeart size={11} color={theme.textMuted} />
                        <Text style={[styles.topPostStat, { color: theme.textMuted }]}>{fmtNum(p.like_count)}</Text>
                        <IcComment size={11} color={theme.textMuted} />
                        <Text style={[styles.topPostStat, { color: theme.textMuted }]}>{fmtNum(p.comment_count)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },

  periodRow: {
    flexDirection: 'row', padding: 8, gap: 8,
    borderBottomWidth: 1, paddingHorizontal: SPACING.md,
  },
  periodBtn: {
    flex: 1, paddingVertical: 8, borderRadius: RADIUS.full,
    alignItems: 'center', backgroundColor: 'transparent',
  },
  periodBtnActive: { backgroundColor: COLORS.primary },
  periodBtnText: { fontSize: FONT.size.sm, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SPACING.md, gap: 12 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.8, marginTop: 4,
  },

  cardGrid: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1, borderRadius: 14, padding: 14, borderWidth: 1, gap: 8, alignItems: 'center',
  },
  cardIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardVal: { fontSize: 22, fontWeight: '800' },
  cardLabel: { fontSize: 11, fontWeight: '500' },

  engagementRow: {
    flexDirection: 'row', borderRadius: 14, borderWidth: 1,
    padding: 20, alignItems: 'center', justifyContent: 'space-around',
  },
  engSeparator: { width: 1, height: 60, backgroundColor: 'rgba(0,0,0,0.08)' },
  bigNum: { fontSize: 22, fontWeight: '800' },

  summaryBox: { borderRadius: 14, padding: SPACING.md, borderWidth: 1, gap: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryKey: { fontSize: FONT.size.sm },
  summaryVal: { fontSize: FONT.size.sm, fontWeight: '700' },

  topPostsBox: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  topPostRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  topPostRank: { fontSize: FONT.size.sm, fontWeight: '800', width: 28, textAlign: 'center' },
  topPostThumb: { width: 48, height: 64, borderRadius: 6, backgroundColor: '#111' },
  topPostInfo: { flex: 1, gap: 4 },
  topPostCaption: { fontSize: FONT.size.sm, fontWeight: '500' },
  topPostMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topPostStat: { fontSize: 11, fontWeight: '500' },
});
