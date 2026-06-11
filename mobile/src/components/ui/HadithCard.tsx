import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'react-native-linear-gradient';
import { api } from '../../api/client';
import { COLORS, FONT, RADIUS } from '../../constants/theme';

const W = Dimensions.get('window').width;

interface IslamicData {
  hadith: { text: string; source: string; narrator: string };
  ayah: { arabic: string; fr: string; ref: string };
  date: string;
}

export default function HadithCard() {
  const { data } = useQuery<IslamicData>({
    queryKey: ['hadith-today'],
    queryFn: () => api.get('/islamic/hadith/today').then(r => r.data),
    staleTime: 6 * 60 * 60 * 1000, // 6h
  });

  if (!data) return null;

  return (
    <View style={styles.container}>
      {/* Ayah card */}
      <LinearGradient
        colors={['#0A2918', '#0F3D22', '#1A5C35']}
        style={styles.ayahCard}
      >
        <Text style={styles.arabic}>{data.ayah.arabic}</Text>
        <Text style={styles.ayahFr}>{data.ayah.fr}</Text>
        <Text style={styles.ref}>{data.ayah.ref}</Text>
      </LinearGradient>

      {/* Hadith card */}
      <View style={styles.hadithCard}>
        <View style={styles.hadithBadge}>
          <Text style={styles.hadithBadgeText}>Hadith du jour</Text>
        </View>
        <Text style={styles.hadithText}>{data.hadith.text}</Text>
        <View style={styles.hadithMeta}>
          <Text style={styles.hadithNarrator}>{data.hadith.narrator}</Text>
          <Text style={styles.hadithSource}>{data.hadith.source}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: W, gap: 12, paddingHorizontal: 16, paddingVertical: 16 },

  ayahCard: {
    borderRadius: RADIUS.lg, padding: 20, gap: 10, alignItems: 'center',
  },
  arabic: {
    fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center', lineHeight: 36,
    fontFamily: 'System',
  },
  ayahFr: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 22, fontStyle: 'italic' },
  ref: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },

  hadithCard: {
    backgroundColor: '#F0FDF4', borderRadius: RADIUS.lg, padding: 18, gap: 10,
  },
  hadithBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  hadithBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  hadithText: { fontSize: 14, color: '#1A3D2B', lineHeight: 22, fontStyle: 'italic' },
  hadithMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  hadithNarrator: { fontSize: 12, fontWeight: '700', color: '#2D6A4F', flex: 1 },
  hadithSource: { fontSize: 11, color: '#52A07D', fontWeight: '600' },
});
