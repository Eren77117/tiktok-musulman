import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker, { types, isCancel } from 'react-native-document-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { IcClose, IcImage, IcVideo } from '../../components/ui/Icons';

type Props = NativeStackScreenProps<RootStackParamList, 'ThreadComposer'>;

interface Media {
  uri: string;
  type: 'image' | 'video';
  name: string;
  mimeType: string;
}

export default function ThreadComposerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const theme = useTheme();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [media, setMedia] = useState<Media | null>(null);
  const [uploading, setUploading] = useState(false);

  const postMutation = useMutation({
    mutationFn: async (payload: { content: string; media_url?: string; media_type?: string }) =>
      api.post('/threads', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threads'] });
      navigation.goBack();
    },
    onError: () => Alert.alert('Erreur', 'Impossible de publier.'),
  });

  const pickImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.didCancel || !result.assets?.[0]?.uri) return;
    const a = result.assets[0];
    setMedia({ uri: a.uri!, type: 'image', name: a.fileName ?? 'photo.jpg', mimeType: a.type ?? 'image/jpeg' });
  };

  const pickVideo = async () => {
    try {
      const res = await DocumentPicker.pickSingle({ type: [types.video] });
      setMedia({ uri: res.uri, type: 'video', name: res.name ?? 'video.mp4', mimeType: res.type ?? 'video/mp4' });
    } catch (e) {
      if (!isCancel(e)) Alert.alert('Erreur', 'Impossible de sélectionner la vidéo.');
    }
  };

  const handlePublish = async () => {
    if (!text.trim() && !media) return;
    ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });
    setUploading(true);
    try {
      let media_url: string | undefined;
      let media_type: string | undefined;

      if (media) {
        const formData = new FormData();
        formData.append('file', { uri: media.uri, type: media.mimeType, name: media.name } as any);
        const endpoint = media.type === 'image' ? '/upload/image' : '/upload/video';
        const uploadRes = await api.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        media_url = uploadRes.data.url;
        media_type = media.type;
      }

      await postMutation.mutateAsync({ content: text.trim(), media_url, media_type });
    } catch {
      Alert.alert('Erreur', "Impossible de publier.");
    } finally {
      setUploading(false);
    }
  };

  const canPublish = (text.trim().length > 0 || !!media) && !uploading;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} activeOpacity={0.7}>
          <IcClose size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Nouveau fil</Text>
        <TouchableOpacity
          style={[styles.publishBtn, !canPublish && styles.publishBtnDisabled]}
          onPress={handlePublish}
          disabled={!canPublish}
          activeOpacity={0.8}
        >
          {uploading
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <Text style={styles.publishBtnText}>Publier</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Composer row */}
        <View style={styles.composerRow}>
          <View style={styles.avatarCol}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{user?.display_name?.[0]?.toUpperCase() ?? 'U'}</Text>
              </View>
            )}
            {!!text || !!media ? <View style={[styles.threadLine, { backgroundColor: theme.border }]} /> : null}
          </View>
          <View style={styles.composerMain}>
            <Text style={[styles.displayName, { color: theme.text }]}>{user?.display_name ?? ''}</Text>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={text}
              onChangeText={setText}
              placeholder="Quoi de nouveau ?"
              placeholderTextColor={theme.textSubtle}
              multiline
              maxLength={500}
              autoFocus
            />
            {media && (
              <View style={styles.mediaPreview}>
                {media.type === 'image' ? (
                  <Image source={{ uri: media.uri }} style={styles.mediaImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.videoPreview, { backgroundColor: theme.primaryBg, borderColor: COLORS.primaryLight }]}>
                    <IcVideo size={32} color={COLORS.primary} />
                    <Text style={styles.videoName} numberOfLines={1}>{media.name}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.removeMedia} onPress={() => setMedia(null)} activeOpacity={0.8}>
                  <IcClose size={14} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.mediaActions}>
              <TouchableOpacity onPress={pickImage} style={[styles.mediaBtn, { backgroundColor: theme.primaryBg }]} activeOpacity={0.7}>
                <IcImage size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={pickVideo} style={[styles.mediaBtn, { backgroundColor: theme.primaryBg }]} activeOpacity={0.7}>
                <IcVideo size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={[styles.charCount, { color: theme.textMuted }]}>{text.length}/500</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold },
  publishBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  publishBtnDisabled: { opacity: 0.4 },
  publishBtnText: { color: COLORS.white, fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },

  body: { padding: SPACING.md },
  composerRow: { flexDirection: 'row', gap: 12 },
  avatarCol: { alignItems: 'center', gap: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { backgroundColor: COLORS.primaryBg, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: FONT.weight.bold, color: COLORS.primary },
  threadLine: { width: 2, flex: 1, borderRadius: 1, marginTop: 4 },

  composerMain: { flex: 1, gap: 8 },
  displayName: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  input: { fontSize: FONT.size.base, lineHeight: 22, minHeight: 80, textAlignVertical: 'top' },

  mediaPreview: { position: 'relative', borderRadius: RADIUS.md, overflow: 'hidden', marginTop: 4 },
  mediaImage: { width: '100%', height: 200, borderRadius: RADIUS.md },
  videoPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1,
  },
  videoName: { flex: 1, fontSize: FONT.size.sm, color: COLORS.primary },
  removeMedia: {
    position: 'absolute', top: 8, right: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },

  mediaActions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  mediaBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
  charCount: { marginLeft: 'auto', fontSize: FONT.size.xs },
});
