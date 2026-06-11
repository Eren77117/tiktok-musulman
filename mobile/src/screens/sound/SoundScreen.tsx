import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'react-native-linear-gradient';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { IcBack, IcMusic, IcHeart, IcPlay, IcEye } from '../../components/ui/Icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Sound'>;

const { width: W } = Dimensions.get('window');
const COLS = 3;
const CELL_W = (W - 2) / COLS;
const CELL_H = CELL_W * (16 / 9);

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n ?? 0);
}

function SpinningDisc({ theme }: { theme: any }) {
  const rot = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    anim.current = Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 3000, useNativeDriver: true })
    );
    anim.current.start();
    return () => anim.current?.stop();
  }, []);

  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={[styles.disc, { transform: [{ rotate }] }]}>
      <View style={[styles.discOuter, { backgroundColor: theme.isDark ? '#1A1A1A' : '#222' }]}>
        <View style={[styles.discInner, { backgroundColor: COLORS.primary }]}>
          <IcMusic size={20} color="#fff" />
        </View>
      </View>
    </Animated.View>
  );
}

export default function SoundScreen({ route, navigation }: Props) {
  const { soundId, title, artist } = route.params as any;
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['sound', soundId],
    queryFn: () => api.get(`/sounds/${soundId}`).then(r => r.data).catch(() => ({
      id: soundId, title, artist, url: null, use_count: 0, posts: [],
    })),
  });

  const sound = data ?? { id: soundId, title, artist, url: null, use_count: 0, posts: [] };

  const renderItem = ({ item: p }: { item: any }) => (
    <TouchableOpacity
      style={styles.cell}
      onPress={() => {
        ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });
        navigation.navigate('VideoPlayer', { postId: p.id });
      }}
      activeOpacity={0.85}
    >
      {p.thumbnail_url
        ? <Image source={{ uri: p.thumbnail_url }} style={styles.cellImg} resizeMode="cover" />
        : <View style={[styles.cellImg, styles.cellFallback]}><IcPlay size={20} color={COLORS.primaryLight} /></View>
      }
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={styles.cellGradient}
      >
        <View style={styles.cellStats}>
          <IcEye size={9} color="#fff" />
          <Text style={styles.cellCount}>{fmtNum(p.view_count)}</Text>
          <View style={{ width: 6 }} />
          <IcHeart size={9} color="#fff" />
          <Text style={styles.cellCount}>{fmtNum(p.like_count)}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const header = (
    <View>
      {/* Hero */}
      <LinearGradient
        colors={['#0A2918', '#0F3D22', '#143D26']}
        style={[styles.hero, { paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <IcBack size={24} color="#fff" />
        </TouchableOpacity>

        <SpinningDisc theme={theme} />

        <View style={styles.heroInfo}>
          <Text style={styles.heroTitle} numberOfLines={2}>{sound.title}</Text>
          {sound.artist && <Text style={styles.heroArtist}>{sound.artist}</Text>}
          <View style={styles.heroMeta}>
            <IcPlay size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.heroMetaText}>{fmtNum(sound.use_count)} vidéos</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Section header */}
      {!isLoading && sound.posts?.length > 0 && (
        <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Vidéos avec ce son
          </Text>
          <Text style={[styles.sectionCount, { color: theme.textMuted }]}>
            {sound.posts.length}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={sound.posts ?? []}
        keyExtractor={p => p.id}
        numColumns={COLS}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        getItemLayout={(_data, index) => {
          const row = Math.floor(index / COLS);
          return { length: CELL_H + 1, offset: (CELL_H + 1) * row, index };
        }}
        ListHeaderComponent={header}
        renderItem={renderItem}
        ListEmptyComponent={
          isLoading
            ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
            : <Text style={[styles.empty, { color: theme.textMuted }]}>Aucune vidéo avec ce son</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    position: 'absolute',
    top: 0,
    left: SPACING.md,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  disc: { marginTop: 20 },
  discOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  discInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: { alignItems: 'center', gap: 4 },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroArtist: { fontSize: FONT.size.sm, color: 'rgba(255,255,255,0.65)' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  heroMetaText: { fontSize: FONT.size.xs, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  sectionTitle: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  sectionCount: { fontSize: FONT.size.sm },

  gridContent: {},
  gridRow: { gap: 1 },
  cell: { width: CELL_W, height: CELL_H, backgroundColor: '#111', marginBottom: 1 },
  cellImg: { width: '100%', height: '100%' },
  cellFallback: { backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  cellGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 6,
  },
  cellStats: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cellCount: { fontSize: 10, color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: FONT.size.base },
});
