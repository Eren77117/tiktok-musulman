import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Vibration, Alert, Linking,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'react-native-linear-gradient';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { api } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { IcBack } from '../../components/ui/Icons';

type Tab = 'prayers' | 'hadith' | 'coran' | 'duas' | 'tasbih';

// ── Duas du matin/soir ────────────────────────────────────────────────────────
const DUAS_MATIN = [
  { title: 'Au réveil', arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ', fr: 'Louange à Allah qui nous a ramenés à la vie après nous avoir fait mourir, et vers Lui est le retour.', source: 'Boukhâri' },
  { title: 'Protection du matin', arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ', fr: 'Au nom d\'Allah avec Lequel rien ne peut nuire, ni sur terre ni dans le ciel, et Il est l\'Audient, l\'Omniscient.', source: 'Abu Dawoud' },
  { title: 'Demande de bien', arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا', fr: 'Ô Allah, c\'est grâce à Toi que nous entrons dans le matin et dans le soir.', source: 'Abu Dawoud' },
];
const DUAS_SOIR = [
  { title: 'Au coucher', arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', fr: 'En Ton nom, ô Allah, je meurs et je vis.', source: 'Boukhâri' },
  { title: 'Protection de la nuit', arabic: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ', fr: 'Ô Allah, préserve-moi de Ton châtiment le Jour où Tu ressusciteras Tes serviteurs.', source: 'Abu Dawoud & Tirmidhi' },
];

// ── Versets du Coran ──────────────────────────────────────────────────────────
const SURAHS = [
  { num: 1, name: 'Al-Fatiha', fr: 'L\'Ouverture', verses: 7 },
  { num: 2, name: 'Al-Baqara', fr: 'La Vache', verses: 286 },
  { num: 36, name: 'Ya-Sin', fr: 'Ya-Sin', verses: 83 },
  { num: 55, name: 'Al-Rahman', fr: 'Le Très Miséricordieux', verses: 78 },
  { num: 67, name: 'Al-Mulk', fr: 'La Royauté', verses: 30 },
  { num: 112, name: 'Al-Ikhlas', fr: 'Le Monothéisme pur', verses: 4 },
  { num: 113, name: 'Al-Falaq', fr: 'L\'Aube naissante', verses: 5 },
  { num: 114, name: 'An-Nas', fr: 'Les Hommes', verses: 6 },
];

// ── Tasbih ────────────────────────────────────────────────────────────────────
const DHIKR_LIST = [
  { label: 'Subhan Allah', arabic: 'سُبْحَانَ اللَّه', target: 33 },
  { label: 'Alhamdulillah', arabic: 'الْحَمْدُ لِلَّه', target: 33 },
  { label: 'Allahu Akbar', arabic: 'اللَّهُ أَكْبَر', target: 34 },
  { label: 'La ilaha illallah', arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ', target: 100 },
  { label: 'Astaghfirullah', arabic: 'أَسْتَغْفِرُ اللَّه', target: 100 },
];

const PRAYER_NAMES: Record<string, string> = {
  Fajr: 'Fajr', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha',
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'prayers', label: 'Prières' },
  { key: 'hadith', label: 'Hadith' },
  { key: 'coran', label: 'Coran' },
  { key: 'duas', label: 'Duas' },
  { key: 'tasbih', label: 'Tasbih' },
];

export default function IslamicScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('hadith');
  const [duaSection, setDuaSection] = useState<'matin' | 'soir'>('matin');
  const [dhikrIdx, setDhikrIdx] = useState(0);
  const [count, setCount] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Prayer times via Aladhan API (Paris default, no key needed)
  const { data: prayerData } = useQuery<any>({
    queryKey: ['prayer-times-today'],
    queryFn: async () => {
      const today = new Date();
      const d = today.getDate(), m = today.getMonth() + 1, y = today.getFullYear();
      const res = await fetch(`https://api.aladhan.com/v1/timingsByCity/${d}-${m}-${y}?city=Paris&country=France&method=3`);
      const json = await res.json();
      return json.data?.timings ?? null;
    },
    staleTime: 6 * 60 * 60 * 1000,
  });

  const { data: islamicData } = useQuery<any>({
    queryKey: ['hadith-today'],
    queryFn: () => api.get('/islamic/hadith/today').then(r => r.data),
    staleTime: 6 * 60 * 60 * 1000,
  });

  const dhikr = DHIKR_LIST[dhikrIdx];

  const handleTasbih = () => {
    ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });
    const next = count + 1;
    setCount(next);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true, speed: 80 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 60 }),
    ]).start();
    if (next >= dhikr.target) {
      ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true });
    }
  };

  const resetTasbih = () => { setCount(0); };
  const nextDhikr = () => { setDhikrIdx((dhikrIdx + 1) % DHIKR_LIST.length); setCount(0); };

  const openSurah = (num: number) => {
    Linking.openURL(`https://quran.com/${num}`).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le Coran en ligne.');
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={['#0A2918', '#0F3D22']} style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <IcBack size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nour Islamique</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabsRow, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={styles.tabBtn} onPress={() => setTab(t.key)} activeOpacity={0.8}>
            <Text style={[styles.tabLabel, { color: tab === t.key ? COLORS.primary : theme.textMuted }, tab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
            {tab === t.key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── PRIÈRES ── */}
        {tab === 'prayers' && (
          <View style={{ gap: 12 }}>
            {/* Ramadan countdown card */}
            {(() => {
              // Ramadan 2026: Feb 18 – Mar 19 (approx)
              const now = new Date();
              const year = now.getFullYear();
              const ramadanStart = new Date(year, 1, 18); // ~Feb 18
              const ramadanEnd = new Date(year, 2, 19);   // ~Mar 19
              const isRamadan = now >= ramadanStart && now <= ramadanEnd;
              const daysUntil = Math.ceil((ramadanStart.getTime() - now.getTime()) / 86400000);
              const daysLeft = Math.ceil((ramadanEnd.getTime() - now.getTime()) / 86400000);
              if (now > ramadanEnd) return null; // over
              if (isRamadan) {
                return (
                  <LinearGradient colors={['#7C3AED', '#4C1D95']} style={[styles.ayahCard, { paddingVertical: 16 }]}>
                    <Text style={{ fontSize: 22 }}>🌙</Text>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Ramadan Moubarak</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Encore {daysLeft} jour{daysLeft > 1 ? 's' : ''}</Text>
                    {prayerData?.Maghrib && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>Iftar : {prayerData.Maghrib} · Suhoor : {prayerData?.Fajr}</Text>}
                  </LinearGradient>
                );
              }
              if (daysUntil > 0 && daysUntil <= 30) {
                return (
                  <View style={[styles.hadithCard, { backgroundColor: theme.card, alignItems: 'center', paddingVertical: 14 }]}>
                    <Text style={{ fontSize: 20 }}>🌙</Text>
                    <Text style={[{ fontWeight: '700', fontSize: 15, marginTop: 4 }, { color: theme.text }]}>Ramadan dans {daysUntil} jours</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>Prépare-toi spirituellement</Text>
                  </View>
                );
              }
              return null;
            })()}
            <LinearGradient colors={['#0A2918', '#0F3D22']} style={[styles.ayahCard, { gap: 6 }]}>
              <Text style={[styles.ayahRef, { color: 'rgba(255,255,255,0.7)', marginBottom: 4 }]}>Horaires · Paris, France</Text>
              {prayerData ? (
                Object.entries(PRAYER_NAMES).map(([key, label]) => {
                  const time: string = prayerData[key] ?? '--:--';
                  const now = new Date();
                  const [h, min] = time.split(':').map(Number);
                  const isPast = h * 60 + min < now.getHours() * 60 + now.getMinutes();
                  return (
                    <View key={key} style={styles.prayerRow}>
                      <Text style={[styles.prayerName, isPast && styles.prayerPast]}>{label}</Text>
                      <Text style={[styles.prayerTime, isPast && styles.prayerPast]}>{time}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', paddingVertical: 20 }}>Chargement...</Text>
              )}
            </LinearGradient>
            <View style={[styles.hadithCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.duaTitle, { color: COLORS.primary }]}>Dua avant la prière</Text>
              <Text style={styles.duaArabic}>اللَّهُمَّ اجْعَلْنِي مِنَ التَّوَّابِينَ وَاجْعَلْنِي مِنَ الْمُتَطَهِّرِينَ</Text>
              <Text style={[styles.duaFr, { color: theme.textMuted }]}>Ô Allah, fais de moi quelqu'un qui se repent souvent et de ceux qui se purifient.</Text>
            </View>
          </View>
        )}

        {/* ── HADITH ── */}
        {tab === 'hadith' && islamicData && (
          <View style={{ gap: 16 }}>
            <LinearGradient colors={['#0A2918', '#0F3D22', '#1A5C35']} style={styles.ayahCard}>
              <Text style={styles.arabic}>{islamicData.ayah.arabic}</Text>
              <Text style={styles.ayahFr}>{islamicData.ayah.fr}</Text>
              <Text style={styles.ayahRef}>{islamicData.ayah.ref}</Text>
            </LinearGradient>
            <View style={[styles.hadithCard, { backgroundColor: theme.card }]}>
              <View style={styles.hadithBadge}>
                <Text style={styles.hadithBadgeText}>Hadith du jour</Text>
              </View>
              <Text style={[styles.hadithText, { color: theme.text }]}>{islamicData.hadith.text}</Text>
              <View style={styles.hadithMeta}>
                <Text style={[styles.hadithNarrator, { color: COLORS.primary }]}>{islamicData.hadith.narrator}</Text>
                <Text style={[styles.hadithSource, { color: theme.textMuted }]}>{islamicData.hadith.source}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── CORAN ── */}
        {tab === 'coran' && (
          <View style={{ gap: 10 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Sourates populaires</Text>
            {SURAHS.map(s => (
              <TouchableOpacity key={s.num} style={[styles.surahRow, { backgroundColor: theme.card }]} onPress={() => openSurah(s.num)} activeOpacity={0.8}>
                <View style={styles.surahNum}>
                  <Text style={styles.surahNumText}>{s.num}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.surahName, { color: theme.text }]}>{s.name}</Text>
                  <Text style={[styles.surahFr, { color: theme.textMuted }]}>{s.fr} · {s.verses} versets</Text>
                </View>
                <Text style={styles.surahArrow}>›</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.quranBtn, { backgroundColor: COLORS.primary }]} onPress={() => Linking.openURL('https://quran.com').catch(() => {})} activeOpacity={0.8}>
              <Text style={styles.quranBtnText}>Ouvrir Quran.com complet</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── DUAS ── */}
        {tab === 'duas' && (
          <View style={{ gap: 16 }}>
            <View style={styles.duaSectionRow}>
              {(['matin', 'soir'] as const).map(s => (
                <TouchableOpacity key={s} style={[styles.duaSectionBtn, duaSection === s && { backgroundColor: COLORS.primaryBg }]} onPress={() => setDuaSection(s)} activeOpacity={0.8}>
                  <Text style={[styles.duaSectionText, { color: duaSection === s ? COLORS.primary : theme.textMuted }]}>
                    {s === 'matin' ? 'Matin' : 'Soir'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {(duaSection === 'matin' ? DUAS_MATIN : DUAS_SOIR).map((d, i) => (
              <View key={i} style={[styles.duaCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.duaTitle, { color: COLORS.primary }]}>{d.title}</Text>
                <Text style={styles.duaArabic}>{d.arabic}</Text>
                <Text style={[styles.duaFr, { color: theme.textMuted }]}>{d.fr}</Text>
                <Text style={[styles.duaSource, { color: theme.textSubtle }]}>{d.source}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── TASBIH ── */}
        {tab === 'tasbih' && (
          <View style={styles.tasbihContainer}>
            {/* Dhikr selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dhikrRow}>
              {DHIKR_LIST.map((d, i) => (
                <TouchableOpacity key={i} onPress={() => { setDhikrIdx(i); setCount(0); }} activeOpacity={0.8}
                  style={[styles.dhikrChip, dhikrIdx === i && { backgroundColor: COLORS.primaryBg }]}>
                  <Text style={[styles.dhikrChipText, { color: dhikrIdx === i ? COLORS.primary : theme.textMuted }]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Counter */}
            <LinearGradient colors={['#0A2918', '#0F3D22', '#1A5C35']} style={styles.tasbihCircleWrap}>
              <Text style={styles.tasbihArabic}>{dhikr.arabic}</Text>
              <Text style={styles.tasbihLabel}>{dhikr.label}</Text>
              <Text style={[styles.tasbihProgress, { color: count >= dhikr.target ? '#4CD964' : 'rgba(255,255,255,0.5)' }]}>
                {count} / {dhikr.target}
              </Text>
            </LinearGradient>

            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={[styles.tasbihBtn, count >= dhikr.target && styles.tasbihBtnDone]}
                onPress={handleTasbih}
                activeOpacity={0.85}
              >
                <Text style={styles.tasbihBtnText}>{count >= dhikr.target ? 'Terminé ✓' : 'Compter'}</Text>
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.tasbihActions}>
              <TouchableOpacity style={[styles.tasbihAct, { backgroundColor: theme.card }]} onPress={resetTasbih} activeOpacity={0.8}>
                <Text style={[styles.tasbihActText, { color: theme.textMuted }]}>Réinitialiser</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tasbihAct, { backgroundColor: theme.card }]} onPress={nextDhikr} activeOpacity={0.8}>
                <Text style={[styles.tasbihActText, { color: COLORS.primary }]}>Suivant</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  tabsRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, position: 'relative' },
  tabLabel: { fontSize: FONT.size.sm, fontWeight: '500' },
  tabLabelActive: { fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 12, right: 12, height: 2.5, backgroundColor: COLORS.primary, borderRadius: 2 },

  content: { padding: SPACING.md, paddingBottom: 40 },

  // Ayah / hadith
  ayahCard: { borderRadius: RADIUS.lg, padding: 20, gap: 10, alignItems: 'center' },
  arabic: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center', lineHeight: 36 },
  ayahFr: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 22, fontStyle: 'italic' },
  ayahRef: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  hadithCard: { borderRadius: RADIUS.lg, padding: 18, gap: 10 },
  hadithBadge: { alignSelf: 'flex-start', backgroundColor: COLORS.primaryBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  hadithBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  hadithText: { fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  hadithMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hadithNarrator: { fontSize: 12, fontWeight: '700' },
  hadithSource: { fontSize: 11, fontWeight: '600' },

  // Prayers
  prayerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.12)' },
  prayerName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  prayerTime: { fontSize: 16, fontWeight: '700', color: '#fff' },
  prayerPast: { opacity: 0.4 },

  // Coran
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  surahRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: RADIUS.md },
  surahNum: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  surahNumText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  surahName: { fontSize: 14, fontWeight: '700' },
  surahFr: { fontSize: 12, marginTop: 2 },
  surahArrow: { fontSize: 20, color: COLORS.primary, fontWeight: '300' },
  quranBtn: { borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginTop: 8 },
  quranBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Duas
  duaSectionRow: { flexDirection: 'row', gap: 8 },
  duaSectionBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center' },
  duaSectionText: { fontSize: 14, fontWeight: '700' },
  duaCard: { borderRadius: RADIUS.lg, padding: 16, gap: 10 },
  duaTitle: { fontSize: 13, fontWeight: '700' },
  duaArabic: { fontSize: 18, fontWeight: '600', textAlign: 'right', color: '#1A3D2B', lineHeight: 30 },
  duaFr: { fontSize: 13, lineHeight: 20, fontStyle: 'italic' },
  duaSource: { fontSize: 11, fontWeight: '600' },

  // Tasbih
  tasbihContainer: { alignItems: 'center', gap: 20 },
  dhikrRow: { gap: 8, paddingVertical: 4 },
  dhikrChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: 'rgba(0,0,0,0.05)' },
  dhikrChipText: { fontSize: 13, fontWeight: '600' },
  tasbihCircleWrap: { width: 240, height: 240, borderRadius: 120, alignItems: 'center', justifyContent: 'center', gap: 8 },
  tasbihArabic: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  tasbihLabel: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  tasbihProgress: { fontSize: 28, fontWeight: '800' },
  tasbihBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 60, paddingVertical: 18, borderRadius: RADIUS.full },
  tasbihBtnDone: { backgroundColor: '#4CD964' },
  tasbihBtnText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  tasbihActions: { flexDirection: 'row', gap: 12 },
  tasbihAct: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center' },
  tasbihActText: { fontSize: 14, fontWeight: '600' },
});
