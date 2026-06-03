import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, ActionSheetIOS, Platform,
} from 'react-native';
import DocumentPicker, { types, isCancel, isInProgress } from 'react-native-document-picker';
import { launchImageLibrary } from 'react-native-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, getTokens } from '../../api/client';
import { API_BASE_URL } from '../../constants';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { IcVideo, IcCreate, IcClose, IcImage } from '../../components/ui/Icons';

interface VideoFile {
  uri: string;
  name: string;
  size: number | null;
  type: string;
  isImage: boolean;
}

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [media, setMedia] = useState<VideoFile | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');

  const pickFromGallery = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed',
        selectionLimit: 1,
        quality: 0.8,
      });

      if (result.didCancel) return;

      if (result.errorCode === 'permission') {
        Alert.alert(
          'Accès refusé',
          'Allez dans Réglages → Nour → Photos et autorisez l\'accès.',
        );
        return;
      }

      if (result.errorCode || result.errorMessage) {
        // Fallback to DocumentPicker if image picker fails
        await pickFromFiles();
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const ext = (asset.fileName?.split('.').pop() ?? 'mp4').toLowerCase();
      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext);

      setMedia({
        uri: asset.uri,
        name: asset.fileName ?? `media.${ext}`,
        size: asset.fileSize ?? null,
        type: asset.type ?? (isImage ? 'image/jpeg' : 'video/mp4'),
        isImage,
      });
    } catch {
      // Native crash fallback → open Files
      await pickFromFiles();
    }
  };

  const pickFromFiles = async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [types.video, types.images],
        copyTo: 'cachesDirectory',
      });

      if (!result.uri) return;

      const uri = result.fileCopyUri ?? result.uri;
      const name = result.name ?? 'video.mp4';
      const ext = name.split('.').pop()?.toLowerCase() ?? 'mp4';
      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext);

      setMedia({
        uri,
        name,
        size: result.size ?? null,
        type: result.type ?? (isImage ? 'image/jpeg' : 'video/mp4'),
        isImage,
      });
    } catch (err: unknown) {
      if (isCancel(err) || isInProgress(err)) return;
      Alert.alert('Erreur', 'Impossible de sélectionner le fichier.');
    }
  };

  const handlePickPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Annuler', 'Galerie Photos', 'Fichiers'],
          cancelButtonIndex: 0,
          title: 'Ajouter une vidéo ou photo',
        },
        (index) => {
          if (index === 1) pickFromGallery();
          if (index === 2) pickFromFiles();
        },
      );
    } else {
      pickFromFiles();
    }
  };

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!media?.uri) throw new Error('Aucun média sélectionné');
      setUploading(true);

      try {
        setUploadStep('Envoi du fichier...');

        // Use native fetch for multipart — more reliable than axios on New Arch
        const tokens = await getTokens();
        if (!tokens) throw new Error('Non authentifié');

        const endpoint = media.isImage ? '/upload/image' : '/upload/video';
        const uploadUrl = `${API_BASE_URL}${endpoint}`;

        const formData = new FormData();
        formData.append('file', {
          uri: media.uri,
          type: media.type,
          name: media.name,
        } as unknown as Blob);

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokens.access}` },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errData = await uploadResponse.json().catch(() => ({}));
          throw new Error(errData?.error ?? `Erreur upload (${uploadResponse.status})`);
        }

        const uploadData = await uploadResponse.json();
        if (!uploadData?.url) throw new Error('URL manquante dans la réponse du serveur');

        // Make URL absolute if backend returned relative path
        const videoUrl = uploadData.url.startsWith('http')
          ? uploadData.url
          : `${API_BASE_URL.replace('/api', '')}${uploadData.url}`;

        setUploadStep('Publication...');

        await api.post('/posts', {
          video_url: videoUrl,
          thumbnail_url: media.isImage ? videoUrl : undefined,
          caption: caption.trim() || undefined,
          duration: 1,
          is_public: true,
        });

        setMedia(null);
        setCaption('');
        qc.invalidateQueries({ queryKey: ['feed'] });
        qc.invalidateQueries({ queryKey: ['user-posts'] });
        Alert.alert('Publié !', 'Votre contenu est en ligne et visible dans le fil.');
      } finally {
        setUploading(false);
        setUploadStep('');
      }
    },
    onError: (err: any) => {
      setUploading(false);
      setUploadStep('');
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        "Échec de l'envoi. Vérifiez votre connexion.";
      Alert.alert('Erreur d\'upload', msg);
    },
  });

  const sizeMB = media?.size ? (media.size / 1_000_000).toFixed(1) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nouvelle publication</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Media picker */}
        <TouchableOpacity
          style={[styles.picker, !!media && styles.pickerSelected]}
          onPress={handlePickPress}
          activeOpacity={0.8}
          disabled={uploading}
        >
          {media ? (
            <View style={styles.pickerInfo}>
              <View style={styles.pickerIconWrap}>
                {media.isImage
                  ? <IcImage size={22} color={COLORS.primary} />
                  : <IcVideo size={22} color={COLORS.primary} />
                }
              </View>
              <View style={styles.pickerDetails}>
                <Text style={styles.pickerFileName} numberOfLines={1}>{media.name}</Text>
                {sizeMB && <Text style={styles.pickerMeta}>{sizeMB} MB</Text>}
              </View>
              <TouchableOpacity
                onPress={() => !uploading && setMedia(null)}
                style={styles.clearBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <IcClose size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pickerEmpty}>
              <View style={styles.pickerEmptyIconWrap}>
                <IcCreate size={28} color={COLORS.primary} strokeWidth={2} />
              </View>
              <Text style={styles.pickerEmptyLabel}>Ajouter une vidéo ou photo</Text>
              <Text style={styles.pickerEmptyHint}>Galerie Photos · Fichiers — MP4, MOV, JPG, PNG</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Upload progress */}
        {uploading && (
          <View style={styles.uploadingRow}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <Text style={styles.uploadingText}>{uploadStep || 'Envoi en cours...'}</Text>
          </View>
        )}

        {/* Caption */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={styles.textarea}
            value={caption}
            onChangeText={setCaption}
            placeholder="Ajouter une description, des hashtags..."
            placeholderTextColor={COLORS.textPlaceholder}
            multiline
            maxLength={500}
            editable={!uploading}
          />
          <Text style={styles.charCount}>{caption.length}/500</Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (!media || uploading) && styles.submitBtnDisabled]}
          onPress={() => postMutation.mutate()}
          disabled={!media || uploading}
          activeOpacity={0.85}
        >
          <Text style={styles.submitBtnText}>
            {uploading ? 'Envoi...' : 'Publier'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  headerTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, color: COLORS.text },
  content: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: 60 },

  picker: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed',
    minHeight: 180, overflow: 'hidden', justifyContent: 'center',
  },
  pickerSelected: { borderStyle: 'solid', borderColor: COLORS.primary },

  pickerEmpty: { alignItems: 'center', gap: 12, padding: SPACING.xl },
  pickerEmptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.primaryBg, borderWidth: 2, borderColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  pickerEmptyLabel: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold, color: COLORS.text },
  pickerEmptyHint: { fontSize: FONT.size.xs, color: COLORS.textMuted, textAlign: 'center' },

  pickerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.md },
  pickerIconWrap: {
    width: 52, height: 52, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  pickerDetails: { flex: 1 },
  pickerFileName: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.text },
  pickerMeta: { fontSize: FONT.size.xs, color: COLORS.textMuted, marginTop: 2 },
  clearBtn: { padding: 4 },

  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: SPACING.sm },
  uploadingText: { fontSize: FONT.size.sm, color: COLORS.primary, fontWeight: FONT.weight.medium },

  field: { gap: 6 },
  fieldLabel: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.textMuted },
  textarea: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md,
    fontSize: FONT.size.base, color: COLORS.text,
    minHeight: 100, textAlignVertical: 'top',
  },
  charCount: { fontSize: FONT.size.xs, color: COLORS.textSubtle, textAlign: 'right' },

  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 16, alignItems: 'center', ...SHADOW.green,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: FONT.size.md, fontWeight: FONT.weight.semibold, color: COLORS.white },
});
