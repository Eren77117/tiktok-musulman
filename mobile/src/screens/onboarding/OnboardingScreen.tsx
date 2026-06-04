import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  ScrollView, Animated, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Moon, MessageCircle, Compass, Heart, Users, Shield } from 'lucide-react-native';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';

const { width: W } = Dimensions.get('window');
export const ONBOARDING_KEY = 'nour_onboarding_v1';

const SLIDES = [
  {
    key: '1',
    Icon: Moon,
    iconColor: COLORS.primary,
    title: 'Bienvenue sur Nour',
    subtitle: 'La communauté islamique\npour partager, inspirer et apprendre.',
    bullets: [
      '🌙 Contenu islamique de qualité',
      '🕌 Rappels, Coran, Motivation',
      '🤝 Une communauté bienveillante',
    ],
    bg: COLORS.primaryBg,
  },
  {
    key: '2',
    Icon: Shield,
    iconColor: '#8B5CF6',
    title: 'Messagerie respectueuse',
    subtitle: 'Nour respecte les règles islamiques\nde la communication.',
    bullets: [
      '✅ Hommes ↔ Hommes : direct',
      '✅ Femmes ↔ Femmes : direct',
      '🔒 Hommes ↔ Femmes : restreint',
    ],
    bg: '#EDE9FE',
  },
  {
    key: '3',
    Icon: Compass,
    iconColor: COLORS.primary,
    title: 'Contenu personnalisé',
    subtitle: 'Choisis tes catégories préférées\npour un feed adapté.',
    bullets: null,
    categories: ['Rappel', 'Coran', 'Motivation', 'Lifestyle', 'Famille', 'Science', 'Dua'],
    bg: COLORS.primaryBg,
  },
];

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const [page, setPage] = useState(0);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  const goTo = (idx: number) => {
    setPage(idx);
    scrollRef.current?.scrollTo({ x: W * idx, animated: true });
  };

  const handleDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    onDone();
  };

  const toggleCat = (c: string) => {
    setSelectedCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
      >
        {SLIDES.map((slide, i) => (
          <View key={slide.key} style={[styles.slide, { backgroundColor: slide.bg, width: W }]}>
            <View style={[styles.iconCircle, { backgroundColor: slide.iconColor + '22' }]}>
              <slide.Icon size={60} color={slide.iconColor} strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>

            {slide.bullets && (
              <View style={styles.bullets}>
                {slide.bullets.map((b, j) => (
                  <Text key={j} style={styles.bullet}>{b}</Text>
                ))}
              </View>
            )}

            {slide.categories && (
              <View style={styles.catGrid}>
                {slide.categories.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.catChip, selectedCats.includes(c) && styles.catChipActive]}
                    onPress={() => toggleCat(c)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.catText, selectedCats.includes(c) && styles.catTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, page === i && styles.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        {page < SLIDES.length - 1 ? (
          <TouchableOpacity style={styles.btn} onPress={() => goTo(page + 1)} activeOpacity={0.85}>
            <Text style={styles.btnText}>Continuer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btn} onPress={handleDone} activeOpacity={0.85}>
            <Text style={styles.btnText}>Commencer →</Text>
          </TouchableOpacity>
        )}
        {page < SLIDES.length - 1 && (
          <TouchableOpacity style={styles.skipBtn} onPress={handleDone}>
            <Text style={styles.skipText}>Passer</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryBg },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 20 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: FONT.size.base, color: COLORS.textMuted, textAlign: 'center', lineHeight: 24 },
  bullets: { gap: 12, alignSelf: 'stretch' },
  bullet: { fontSize: FONT.size.base, color: COLORS.text, lineHeight: 24, paddingLeft: 4 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 },
  catChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: FONT.size.sm, fontWeight: '600', color: COLORS.textMuted },
  catTextActive: { color: COLORS.white },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive: { width: 24, backgroundColor: COLORS.primary },
  footer: { padding: SPACING.lg, gap: 10 },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center' },
  btnText: { fontSize: FONT.size.base, fontWeight: '700', color: COLORS.white },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: FONT.size.sm, color: COLORS.textMuted },
});
