import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, RADIUS } from '../../constants/theme';
import { IcBack, IcCamera, IcImage } from '../../components/ui/Icons';

export default function StoryCreateScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [media, setMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickMedia = async (src: 'camera' | 'library') => {
    const fn = src === 'camera' ? launchCamera : launchImageLibrary;
    const result = await fn({ mediaType: 'photo', quality: 0.9, maxWidth: 1080, maxHeight: 1920 });
    if (result.didCancel || !result.assets?.[0]?.uri) return;
    setMedia({ uri: result.assets[0].uri, type: 'image' });
  };

  const publish = async () => {
    if (!media) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', { uri: media.uri, type: 'image/jpeg', name: 'story.jpg' } as any);
      const { data: upload } = await api.post('/upload/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await api.post('/stories', {
        media_url: upload.url,
        media_type: 'image',
        duration: 5,
      });
      Alert.alert('Story publiée !', 'Ta story est visible pendant 24h.');
      nav.goBack();
    } catch {
      Alert.alert('Erreur', 'Impossible de publier la story.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
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
          <TouchableOpacity style={styles.changeBtn} onPress={() => setMedia(null)} activeOpacity={0.8}>
            <Text style={styles.changeBtnText}>Changer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.pickZone}>
          <Text style={[styles.pickHint, { color: theme.textMuted }]}>Choisis une photo pour ta story</Text>
          <View style={styles.pickBtns}>
            <TouchableOpacity style={[styles.pickBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => pickMedia('camera')} activeOpacity={0.8}>
              <IcCamera size={28} color={COLORS.primary} />
              <Text style={[styles.pickBtnText, { color: theme.text }]}>Appareil photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pickBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => pickMedia('library')} activeOpacity={0.8}>
              <IcImage size={28} color={COLORS.primary} />
              <Text style={[styles.pickBtnText, { color: theme.text }]}>Galerie</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  backBtn: { padding: 4 },
  title: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold },
  publishBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  publishBtnDisabled: { opacity: 0.4 },
  publishText: { color: '#fff', fontWeight: FONT.weight.semibold, fontSize: FONT.size.sm },
  preview: { flex: 1, position: 'relative' },
  previewImg: { flex: 1, width: '100%' },
  changeBtn: {
    position: 'absolute', bottom: 32, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  changeBtnText: { color: '#fff', fontWeight: '600' },
  pickZone: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32 },
  pickHint: { fontSize: FONT.size.base, textAlign: 'center' },
  pickBtns: { flexDirection: 'row', gap: 16 },
  pickBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 24, borderRadius: RADIUS.lg, borderWidth: 1,
  },
  pickBtnText: { fontSize: FONT.size.sm, fontWeight: '500', textAlign: 'center' },
});
