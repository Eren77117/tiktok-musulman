import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  ScrollView, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Moon, Shield, Compass, Check, Lock } from 'lucide-react-native';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';

const { width: W } = Dimensions.get('window');
export const ONBOARDING_KEY = 'nour_onboarding_v1';

type BulletIcon = { icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; label: string; color: string };
interface Slide {
  key: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  iconColor: string;
  bg: string;
  title: string;
  subtitle: string;
  bullets?: BulletIcon[];
  categories?: string[];
}

const SLIDES: Slide[] = [
  {
    key: '1',
    Icon: Moon,
    iconColor: COLORS.primary,
    title: 'Bienvenue sur Nour',
    subtitle: 'La communauté islamique\npour partager, inspirer et apprendre.',
    bullets: [
      { icon: Check, label: 'Contenu islamique de qualité', color: COLORS.primary },
      { icon: Check, label: 'Rappels, Coran, Motivation', color: COLORS.primary },
      { icon: Check, label: 'Une communauté bienveillante', color: COLORS.primary },
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
      { icon: Check, label: 'Hommes — Hommes : direct', color: COLORS.primary },
      { icon: Check, label: 'Femmes — Femmes : direct', color: COLORS.primary },
      { icon: Lock, label: 'Hommes — Femmes : sur demande', color: '#8B5CF6' },
    ],
    bg: '#EDE9FE',
  },
  {
    key: '3',
    Icon: Compass,
    iconColor: COLORS.primary,
    title: 'Contenu personnalisé',
    subtitle: 'Choisis tes catégories préférées\npour un feed adapté.',
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
  const dotAnim = useRef(SLIDES.map(() => new Animated.Value(0))).current;

  const goTo = (idx: number) => {
    setPage(idx);
    scrollRef.current?.scrollTo({ x: W * idx, animated: true });
    // Animate active dot
    Animated.parallel(
      dotAnim.map((a, i) =>
        Animated.spring(a, { toValue: i === idx ? 1 : 0, useNativeDriver: false, tension: 200, friction: 12 })
      )
    ).start();
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
            <View style={[styles.iconCircle, { backgroundColor: slide.iconColor + '20' }]}>
              <slide.Icon size={56} color={slide.iconColor} strokeWidth={1.3} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>

            {slide.bullets && (
              <View style={styles.bullets}>
                {slide.bullets.map((b, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <View style={[styles.bulletIcon, { backgroundColor: b.color + '18' }]}>
                      <b.icon size={14} color={b.color} strokeWidth={2.5} />
                    </View>
                    <Text style={styles.bulletText}>{b.label}</Text>
                  </View>
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
        {SLIDES.map((_, i) => {
          const w = dotAnim[i].interpolate({ inputRange: [0, 1], outputRange: [8, 24] });
          const bg = dotAnim[i].interpolate({ inputRange: [0, 1], outputRange: [COLORS.border, COLORS.primary] });
          return <Animated.View key={i} style={[styles.dot, { width: w, backgroundColor: bg }]} />;
        })}
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.btn}
          onPress={page < SLIDES.length - 1 ? () => goTo(page + 1) : handleDone}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>
            {page < SLIDES.length - 1 ? 'Continuer' : 'Commencer'}
          </Text>
        </TouchableOpacity>
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
  slide: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: SPACING.xl, gap: 18,
  },
  iconCircle: {
    width: 112, height: 112, borderRadius: 56,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  title: {
    fontSize: 28, fontWeight: '800', color: COLORS.text,
    textAlign: 'center', letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FONT.size.base, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 24,
  },
  bullets: { gap: 10, alignSelf: 'stretch', marginTop: 4 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulletIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bulletText: { fontSize: FONT.size.base, color: COLORS.text, flex: 1 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 },
  catChip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: FONT.size.sm, fontWeight: '600', color: COLORS.textMuted },
  catTextActive: { color: COLORS.white },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 16 },
  dot: { height: 8, borderRadius: 4 },
  footer: { padding: SPACING.lg, gap: 10 },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: 100,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  btnText: { fontSize: FONT.size.base, fontWeight: '700', color: COLORS.white },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: FONT.size.sm, color: COLORS.textMuted },
});
