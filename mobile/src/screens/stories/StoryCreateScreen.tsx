import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
  Alert, Modal, FlatList, TextInput, Pressable,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '../../constants/theme';
import { IcBack, IcCamera, IcImage, IcMusic, IcHeart, IcHeartFill, IcSearch } from '../../components/ui/Icons';

const FAV_KEY = 'favorite_sounds_v1';

interface Sound {
  id: string;
  title: string;
  artist: string | null;
  url: string;
  duration: number;
  use_count: number;
  is_trending: boolean;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n ?? 0);
}

export default function StoryCreateScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [media, setMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedSound, setSelectedSound] = useState<Sound | null>(null);
  const [soundSheetVisible, setSoundSheetVisible] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [favIds, setFavIds] = useState<string[]>([]);

  // Charger les favoris depuis AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(FAV_KEY).then(v => {
      if (v) setFavIds(JSON.parse(v));
    });
  }, []);

  const saveFavIds = async (ids: string[]) => {
    setFavIds(ids);
    await AsyncStorage.setItem(FAV_KEY, JSON.stringify(ids));
  };

  const toggleFav = (id: string) => {
    const next = favIds.includes(id) ? favIds.filter(x => x !== id) : [...favIds, id];
    saveFavIds(next);
  };

  // Sons depuis le backend
  const { data: allSounds = [] } = useQuery<Sound[]>({
    queryKey: ['sounds', searchQ],
    queryFn: () => api.get(`/sounds${searchQ ? `?q=${encodeURIComponent(searchQ)}` : ''}`).then(r => r.data).catch(() => []),
    enabled: soundSheetVisible,
  });

  // Sons triés : favoris en premier
  const sortedSounds = [
    ...allSounds.filter(s => favIds.includes(s.id)),
    ...allSounds.filter(s => !favIds.includes(s.id)),
  ];

  const pickMedia = async (src: 'camera' | 'library') => {
    const fn = src === 'camera' ? launchCamera : launchImageLibrary;
    const result = await fn({ mediaType: 'photo', quality: 1, maxWidth: 1080, maxHeight: 1920 });
    if (result.didCancel || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.uri) return;
    setMedia({ uri: asset.uri, type: 'image' });
  };

  const publish = async () => {
    if (!media) return;
    setUploading(true);
    try {
      // Upload image
      const form = new FormData();
      const fileName = media.uri.split('/').pop() ?? 'story.jpg';
      const ext = fileName.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      form.append('file', {
        uri: media.uri,
        type: mimeType,
        name: fileName,
      } as any);

      const uploadResp = await api.post('/upload/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      const mediaUrl = uploadResp.data?.url;
      if (!mediaUrl) throw new Error('URL upload manquante');

      // Créer la story
      await api.post('/stories', {
        media_url: mediaUrl,
        media_type: 'image',
        duration: 5,
        ...(selectedSound ? { sound_id: selectedSound.id } : {}),
      });

      Alert.alert('Story publiée !', 'Ta story est visible pendant 24h.');
      nav.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Vérifier ta connexion internet.';
      Alert.alert('Erreur publication', msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <IcBack size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Nouvelle story</Text>
        <TouchableOpacity
          onPress={publish}
          disabled={!media || uploading}
          style={[styles.publishBtn, (!media || uploading) && styles.publishBtnDisabled]}
          activeOpacity={0.8}
        >
          {uploading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.publishText}>Publier</Text>}
        </TouchableOpacity>
      </View>

      {media ? (
        <View style={styles.preview}>
          <Image source={{ uri: media.uri }} style={styles.previewImg} resizeMode="cover" />

          {/* Son sélectionné sur la preview */}
          {selectedSound && (
            <View style={styles.soundBadge}>
              <IcMusic size={13} color="#fff" />
              <Text style={styles.soundBadgeText} numberOfLines={1}>
                {selectedSound.title}{selectedSound.artist ? ` · ${selectedSound.artist}` : ''}
              </Text>
            </View>
          )}

          {/* Boutons bas */}
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.5)' }]}
              onPress={() => setSoundSheetVisible(true)}
              activeOpacity={0.8}
            >
              <IcMusic size={18} color="#fff" />
              <Text style={styles.actionBtnText}>{selectedSound ? 'Changer le son' : 'Ajouter un son'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.5)' }]}
              onPress={() => setMedia(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>Changer la photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.pickZone}>
          <Text style={[styles.pickHint, { color: theme.textMuted }]}>Choisis une photo pour ta story</Text>
          <View style={styles.pickBtns}>
            <TouchableOpacity
              style={[styles.pickBtn, { backgroundColor: theme.card }]}
              onPress={() => pickMedia('camera')} activeOpacity={0.8}
            >
              <IcCamera size={28} color={COLORS.primary} />
              <Text style={[styles.pickBtnText, { color: theme.text }]}>Appareil photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickBtn, { backgroundColor: theme.card }]}
              onPress={() => pickMedia('library')} activeOpacity={0.8}
            >
              <IcImage size={28} color={COLORS.primary} />
              <Text style={[styles.pickBtnText, { color: theme.text }]}>Galerie</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom sheet sons */}
      <Modal
        visible={soundSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSoundSheetVisible(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSoundSheetVisible(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.isDark ? '#161616' : '#fff' }]}>
            {/* Handle + titre */}
            <View style={styles.sheetTop}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Sons</Text>
            </View>

            {/* Barre de recherche */}
            <View style={[styles.searchBar, { backgroundColor: theme.card }]}>
              <IcSearch size={16} color={theme.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Rechercher un son..."
                placeholderTextColor={theme.textPlaceholder}
                value={searchQ}
                onChangeText={setSearchQ}
              />
            </View>

            {/* Option : aucun son */}
            <TouchableOpacity
              style={[styles.soundRow, { borderBottomColor: theme.borderLight },
                !selectedSound && { backgroundColor: theme.isDark ? '#0D1F13' : '#F0FDF4' }]}
              onPress={() => { setSelectedSound(null); setSoundSheetVisible(false); }}
              activeOpacity={0.75}
            >
              <View style={[styles.soundIcon, { backgroundColor: theme.card }]}>
                <Text style={{ fontSize: 18 }}>🚫</Text>
              </View>
              <Text style={[styles.soundName, { color: theme.text }]}>Aucun son</Text>
              {!selectedSound && <View style={[styles.checkDot, { backgroundColor: COLORS.primary }]} />}
            </TouchableOpacity>

            {/* Liste des sons */}
            {sortedSounds.length === 0 ? (
              <View style={styles.emptySound}>
                <IcMusic size={36} color={theme.textSubtle} />
                <Text style={[styles.emptySoundText, { color: theme.textMuted }]}>
                  {searchQ ? 'Aucun son trouvé' : 'Aucun son disponible pour l\'instant'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={sortedSounds}
                keyExtractor={s => s.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: s }) => {
                  const isFav = favIds.includes(s.id);
                  const isSelected = selectedSound?.id === s.id;
                  return (
                    <TouchableOpacity
                      style={[styles.soundRow, { borderBottomColor: theme.borderLight },
                        isSelected && { backgroundColor: theme.isDark ? '#0D1F13' : '#F0FDF4' }]}
                      onPress={() => { setSelectedSound(s); setSoundSheetVisible(false); }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.soundIcon, { backgroundColor: theme.isDark ? '#1F1F1F' : COLORS.primaryBg }]}>
                        <IcMusic size={20} color={COLORS.primary} />
                      </View>
                      <View style={styles.soundInfo}>
                        <View style={styles.soundTitleRow}>
                          <Text style={[styles.soundName, { color: theme.text }]} numberOfLines={1}>
                            {s.title}
                          </Text>
                          {s.is_trending && (
                            <View style={styles.trendingBadge}>
                              <Text style={styles.trendingText}>🔥</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.soundArtist, { color: theme.textMuted }]} numberOfLines={1}>
                          {s.artist ?? 'Artiste inconnu'} · {fmtNum(s.use_count)} vidéos
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => toggleFav(s.id)} style={styles.favBtn} activeOpacity={0.7}>
                        {isFav
                          ? <IcHeartFill size={20} color="#FF3B5C" />
                          : <IcHeart size={20} color={theme.textMuted} />}
                      </TouchableOpacity>
                      {isSelected && <View style={[styles.checkDot, { backgroundColor: COLORS.primary }]} />}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { padding: 4, width: 40 },
  title: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold },
  publishBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: 16, paddingVertical: 8, minWidth: 72, alignItems: 'center',
  },
  publishBtnDisabled: { opacity: 0.4 },
  publishText: { color: '#fff', fontWeight: FONT.weight.semibold, fontSize: FONT.size.sm },

  preview: { flex: 1, position: 'relative' },
  previewImg: { flex: 1, width: '100%' },
  soundBadge: {
    position: 'absolute', top: 16, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, maxWidth: '80%',
  },
  soundBadgeText: { color: '#fff', fontSize: 12, fontWeight: '500', flex: 1 },
  previewActions: {
    position: 'absolute', bottom: 28, width: '100%',
    flexDirection: 'row', justifyContent: 'center', gap: 12, paddingHorizontal: 20,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  pickZone: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32 },
  pickHint: { fontSize: FONT.size.base, textAlign: 'center' },
  pickBtns: { flexDirection: 'row', gap: 16, width: '100%' },
  pickBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 24, borderRadius: RADIUS.lg,
  },
  pickBtnText: { fontSize: FONT.size.sm, fontWeight: '500', textAlign: 'center' },

  // Sound sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', paddingBottom: 30 },
  sheetTop: { alignItems: 'center', paddingTop: 12, paddingBottom: 8, paddingHorizontal: SPACING.md },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12 },
  sheetTitle: { fontSize: FONT.size.lg, fontWeight: '700' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: SPACING.md, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: RADIUS.lg, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: FONT.size.sm, padding: 0 },

  soundRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  soundIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  soundInfo: { flex: 1, gap: 3 },
  soundTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  soundName: { fontSize: FONT.size.sm, fontWeight: '600', flex: 1 },
  soundArtist: { fontSize: 12 },
  trendingBadge: { padding: 2 },
  trendingText: { fontSize: 12 },
  favBtn: { padding: 6 },
  checkDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },

  emptySound: { alignItems: 'center', padding: 40, gap: 12 },
  emptySoundText: { fontSize: FONT.size.sm, textAlign: 'center' },
});
