import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, ActionSheetIOS, Platform,
  FlatList, Animated, Image, Modal,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import DocumentPicker, { types, isCancel } from 'react-native-document-picker';
import { createThumbnail } from 'react-native-create-thumbnail';
import { launchImageLibrary } from 'react-native-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, getTokens } from '../../api/client';
import { API_BASE_URL } from '../../constants';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { IcVideo, IcCreate, IcClose, IcImage, IcHash, IcAt, IcCheck, IcMusic, IcSave } from '../../components/ui/Icons';
import { showToast } from '../../components/ui/Toast';

interface VideoFile {
  uri: string;
  name: string;
  size: number | null;
  type: string;
  isImage: boolean;
}

interface UserSuggestion {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

function parseCaption(text: string): React.ReactNode[] {
  const parts = text.split(/(#\w+|@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('#')) return <Text key={i} style={styles.captionHash}>{part}</Text>;
    if (part.startsWith('@')) return <Text key={i} style={styles.captionMention}>{part}</Text>;
    return <Text key={i} style={styles.captionNormal}>{part}</Text>;
  });
}

interface Draft { id: string; caption: string; videoUri: string | null; thumbnailUri: string | null; createdAt: string }

const CONFETTI_COLORS = [COLORS.primary, '#4CD964', '#FFD60A', '#FF6B6B', '#5AC8FA', '#AF52DE'];
const CONFETTI_PRESETS = [
  { dx: -80, dy: -180, rot: 45 }, { dx: 80, dy: -200, rot: -30 }, { dx: -40, dy: -220, rot: 60 },
  { dx: 120, dy: -160, rot: -60 }, { dx: -120, dy: -150, rot: 90 }, { dx: 20, dy: -240, rot: -45 },
  { dx: -160, dy: -120, rot: 30 }, { dx: 160, dy: -110, rot: -90 }, { dx: 60, dy: -190, rot: 75 },
  { dx: -60, dy: -210, rot: -75 },
];

function ConfettiDot({ preset, color, show }: { preset: typeof CONFETTI_PRESETS[0]; color: string; show: boolean }) {
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!show) { tx.setValue(0); ty.setValue(0); opacity.setValue(0); scale.setValue(0); return; }
    Animated.parallel([
      Animated.timing(tx, { toValue: preset.dx, duration: 900, useNativeDriver: true }),
      Animated.timing(ty, { toValue: preset.dy, duration: 900, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 700, delay: 200, useNativeDriver: true }),
      ]),
      Animated.spring(scale, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start();
  }, [show]);

  return (
    <Animated.View style={{
      position: 'absolute', width: 10, height: 10, borderRadius: 5,
      backgroundColor: color, opacity,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    }} />
  );
}

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const theme = useTheme();
  const qc = useQueryClient();
  const [media, setMedia] = useState<VideoFile | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [customCover, setCustomCover] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Mention/hashtag suggestions
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.6)).current;

  // Fetch mention suggestions
  const { data: mentionData } = useQuery<{ users?: UserSuggestion[] }>({
    queryKey: ['mention-search', mentionQuery],
    queryFn: () => api.get('/search', { params: { q: mentionQuery } }).then(r => r.data).catch(() => ({})),
    enabled: mentionQuery.length >= 1,
  });

  const handleCaptionChange = useCallback((text: string, sel?: { start: number }) => {
    setCaption(text);
    const pos = sel?.start ?? text.length;
    setCursorPos(pos);
    // Detect @mention trigger
    const before = text.slice(0, pos);
    const match = before.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  }, []);

  const insertMention = useCallback((username: string) => {
    const before = caption.slice(0, cursorPos);
    const after = caption.slice(cursorPos);
    const mentionStart = before.lastIndexOf('@');
    const newCaption = before.slice(0, mentionStart) + '@' + username + ' ' + after;
    setCaption(newCaption);
    setShowMentions(false);
    setMentionQuery('');
  }, [caption, cursorPos]);

  const insertHashtag = useCallback((tag: string) => {
    setCaption(c => c + (c.endsWith(' ') || c === '' ? '' : ' ') + '#' + tag + ' ');
  }, []);

  const pickFromGallery = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1, quality: 0.9 });
      if (result.didCancel) return;
      if (result.errorCode === 'permission') {
        Alert.alert('Accès refusé', 'Allez dans Réglages → Nour → Photos pour autoriser l\'accès.'); return;
      }
      const asset = result.assets?.[0];
      if (!asset?.uri) { await pickFromFiles(); return; }
      const ext = (asset.fileName?.split('.').pop() ?? 'mp4').toLowerCase();
      const isImage = ['jpg','jpeg','png','webp','heic'].includes(ext);
      setMedia({ uri: asset.uri, name: asset.fileName ?? `media.${ext}`, size: asset.fileSize ?? null, type: asset.type ?? (isImage ? 'image/jpeg' : 'video/mp4'), isImage });
    } catch { await pickFromFiles(); }
  };

  const pickFromFiles = async () => {
    try {
      const result = await DocumentPicker.pickSingle({ type: [types.video, types.images], copyTo: 'cachesDirectory' });
      if (!result.uri) return;
      const uri = result.fileCopyUri ?? result.uri;
      const name = result.name ?? 'video.mp4';
      const ext = name.split('.').pop()?.toLowerCase() ?? 'mp4';
      const isImage = ['jpg','jpeg','png','webp','heic'].includes(ext);
      setMedia({ uri, name, size: result.size ?? null, type: result.type ?? (isImage ? 'image/jpeg' : 'video/mp4'), isImage });
    } catch (err) {
      if (isCancel(err)) return;
      Alert.alert('Erreur', 'Impossible de sélectionner le fichier.');
    }
  };

  const handlePickPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Annuler', 'Galerie Photos', 'Fichiers'], cancelButtonIndex: 0 },
        (i) => { if (i === 1) pickFromGallery(); if (i === 2) pickFromFiles(); },
      );
    } else { pickFromFiles(); }
  };

  const animateProgress = (to: number) => {
    Animated.timing(progressAnim, { toValue: to, duration: 300, useNativeDriver: false }).start();
  };

  const pickCustomCover = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
    if (result.didCancel || !result.assets?.[0]?.uri) return;
    setCustomCover(result.assets[0].uri);
  };

  const handleSaveDraft = async () => {
    try {
      const stored = await AsyncStorage.getItem('nour_drafts');
      const drafts: Draft[] = JSON.parse(stored ?? '[]');
      const newDraft: Draft = {
        id: Date.now().toString(),
        caption: caption.trim(),
        videoUri: media?.uri ?? null,
        thumbnailUri: null,
        createdAt: new Date().toISOString(),
      };
      drafts.unshift(newDraft);
      await AsyncStorage.setItem('nour_drafts', JSON.stringify(drafts.slice(0, 20)));
      showToast('Brouillon sauvegardé', 'success');
      nav.goBack();
    } catch {
      showToast('Erreur de sauvegarde', 'error');
    }
  };

  const handlePublish = async () => {
    if (!media?.uri) return;
    setUploading(true);
    setUploadProgress(0);
    animateProgress(0);

    try {
      setUploadStep('Envoi du fichier...');
      animateProgress(15);

      const tokens = await getTokens();
      if (!tokens) throw new Error('Non authentifié');

      // Upload via fetch (plus fiable que XHR sur iOS)
      const formData = new FormData();
      // Ensure correct MIME type for iOS videos
      const mimeType = media.isImage ? 'image/jpeg'
        : media.type?.startsWith('video/') ? media.type : 'video/mp4';
      formData.append('file', { uri: media.uri, type: mimeType, name: media.name } as any);
      const endpoint = media.isImage ? '/upload/image' : '/upload/video';

      setUploadProgress(30);
      animateProgress(30);

      const uploadRes = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.access}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        let errMsg = `Erreur ${uploadRes.status}`;
        try { const j = await uploadRes.json(); errMsg = j?.error ?? errMsg; } catch {}
        throw new Error(errMsg);
      }

      const uploadData = await uploadRes.json();
      setUploadProgress(70);
      animateProgress(70);

      if (!uploadData?.url) throw new Error('URL manquante — vérifiez la configuration Cloudinary');
      const videoUrl = uploadData.url.startsWith('http') ? uploadData.url : `${API_BASE_URL.replace('/api', '')}${uploadData.url}`;

      // ── Thumbnail — priorité: custom cover → backend Cloudinary → local extract → fallback ──
      let thumbnailUrl: string | undefined = undefined;

      // Custom cover selected by user
      if (customCover) {
        try {
          const coverForm = new FormData();
          coverForm.append('file', { uri: customCover, type: 'image/jpeg', name: 'cover.jpg' } as any);
          const coverRes = await fetch(`${API_BASE_URL}/upload/image`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokens.access}` },
            body: coverForm,
          });
          if (coverRes.ok) { const cd = await coverRes.json(); if (cd?.url) thumbnailUrl = cd.url; }
        } catch {}
      }
      if (!thumbnailUrl) thumbnailUrl = uploadData.thumbnail_url ?? undefined;

      if (media.isImage) {
        thumbnailUrl = videoUrl;
      } else if (!thumbnailUrl) {
        // Local frame extraction → upload as image
        try {
          setUploadStep('Extraction de la couverture...');
          animateProgress(75);
          const localUri = media.uri.startsWith('file://') ? media.uri : `file://${media.uri}`;
          const thumb = await createThumbnail({ url: localUri, timeStamp: 0, format: 'jpeg' });
          const thumbUri = thumb.path.startsWith('file://') ? thumb.path : `file://${thumb.path}`;
          const thumbForm = new FormData();
          thumbForm.append('file', { uri: thumbUri, type: 'image/jpeg', name: 'cover.jpg' } as any);
          const thumbRes = await fetch(`${API_BASE_URL}/upload/image`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokens.access}` },
            body: thumbForm,
          });
          if (thumbRes.ok) {
            const td = await thumbRes.json();
            if (td?.url) thumbnailUrl = td.url;
          }
        } catch {}

        // Cloudinary auto-thumbnail fallback
        if (!thumbnailUrl && videoUrl.includes('cloudinary.com')) {
          thumbnailUrl = videoUrl
            .replace('/video/upload/', '/video/upload/so_0,q_auto,f_jpg,w_720,h_1280,c_fill/')
            .replace(/\.(mp4|mov|avi|webm|mkv)$/i, '.jpg');
        }
      }

      setUploadStep('Publication...');
      animateProgress(85);

      await api.post('/posts', {
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        caption: caption.trim() || undefined,
        duration: 1,
        is_public: visibility === 'public',
        visibility,
      });

      animateProgress(100);
      setUploadProgress(100);

      setTimeout(() => {
        setMedia(null);
        setCaption('');
        setUploading(false);
        setUploadStep('');
        setUploadProgress(0);
        animateProgress(0);
        qc.invalidateQueries({ queryKey: ['feed'] });
        qc.invalidateQueries({ queryKey: ['user-posts'] });
        ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true });
        setShowSuccess(true);
        successOpacity.setValue(0);
        successScale.setValue(0.6);
        Animated.parallel([
          Animated.spring(successOpacity, { toValue: 1, useNativeDriver: true, tension: 180, friction: 12 }),
          Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
        ]).start(() => {
          setTimeout(() => {
            Animated.timing(successOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
              setShowSuccess(false);
              nav.navigate('Home' as never);
            });
          }, 1800);
        });
      }, 600);
    } catch (err: any) {
      setUploading(false);
      setUploadStep('');
      setUploadProgress(0);
      animateProgress(0);
      const msg = err?.response?.data?.error ?? err?.message ?? 'Échec de l\'envoi. Vérifie ta connexion.';
      Alert.alert('Erreur', msg);
    }
  };

  const sizeMB = media?.size ? (media.size / 1_000_000).toFixed(1) : null;
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  const popularHashtags = ['rappel', 'coran', 'motivation', 'islam', 'dua', 'lifestyle', 'famille'];

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Nouvelle publication</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Media picker ── */}
        <TouchableOpacity style={[styles.picker, { backgroundColor: theme.card, borderColor: !!media ? COLORS.primary : theme.border }, !!media && styles.pickerSelected]} onPress={handlePickPress} activeOpacity={0.8} disabled={uploading}>
          {media ? (
            <View style={styles.pickerInfo}>
              <View style={styles.pickerIconWrap}>
                {media.isImage ? <IcImage size={22} color={COLORS.primary} /> : <IcVideo size={22} color={COLORS.primary} />}
              </View>
              <View style={styles.pickerDetails}>
                <Text style={[styles.pickerFileName, { color: theme.text }]} numberOfLines={1}>{media.name}</Text>
                {sizeMB && <Text style={[styles.pickerMeta, { color: theme.textMuted }]}>{sizeMB} MB · Appuie pour changer</Text>}
              </View>
              <TouchableOpacity onPress={() => !uploading && setMedia(null)} style={styles.clearBtn} hitSlop={{ top:12, bottom:12, left:12, right:12 }}>
                <IcClose size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pickerEmpty}>
              <View style={styles.pickerEmptyIconWrap}>
                <IcCreate size={28} color={COLORS.primary} strokeWidth={2} />
              </View>
              <Text style={[styles.pickerEmptyLabel, { color: theme.text }]}>Ajouter une vidéo ou photo</Text>
              <Text style={[styles.pickerEmptyHint, { color: theme.textMuted }]}>Galerie · Fichiers · MP4, MOV, JPG, PNG</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Progress bar ── */}
        {uploading && (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
            </View>
            <Text style={styles.progressText}>{uploadStep} {uploadProgress > 0 ? `${uploadProgress}%` : ''}</Text>
          </View>
        )}

        {/* ── Caption with hashtag/mention support ── */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Description</Text>
          <TextInput
            ref={inputRef}
            style={[styles.textarea, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            value={caption}
            onChangeText={(t) => handleCaptionChange(t)}
            onSelectionChange={(e) => handleCaptionChange(caption, e.nativeEvent.selection)}
            placeholder="Décris ta vidéo... #hashtag @mention"
            placeholderTextColor={theme.textSubtle}
            multiline
            maxLength={500}
            editable={!uploading}
          />
          {/* Live preview with colored hashtags/mentions */}
          {caption.length > 0 && (
            <View style={[styles.captionPreview, { backgroundColor: theme.primaryBg }]}>
              <Text style={[styles.captionPreviewLabel, { color: theme.textMuted }]}>Aperçu :</Text>
              <Text style={styles.captionPreviewText}>{parseCaption(caption)}</Text>
            </View>
          )}
          <Text style={[styles.charCount, { color: theme.textSubtle }]}>{caption.length}/500</Text>
        </View>

        {/* ── @Mention suggestions ── */}
        {showMentions && (mentionData?.users?.length ?? 0) > 0 && (
          <View style={[styles.suggestionsBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {mentionData!.users!.slice(0, 5).map((u) => (
              <TouchableOpacity key={u.id} style={[styles.suggestionRow, { borderBottomColor: theme.border }]} onPress={() => insertMention(u.username)} activeOpacity={0.7}>
                {u.avatar_url
                  ? <Image source={{ uri: u.avatar_url }} style={styles.suggestionAvatar} />
                  : <View style={[styles.suggestionAvatar, styles.suggestionAvatarFallback]}><Text style={styles.suggestionAvatarText}>{u.display_name[0]?.toUpperCase()}</Text></View>
                }
                <View>
                  <Text style={[styles.suggestionName, { color: theme.text }]}>{u.display_name}</Text>
                  <Text style={[styles.suggestionUsername, { color: theme.textMuted }]}>@{u.username}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Visibility selector ── */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Qui peut voir</Text>
          <View style={styles.visRow}>
            {(['public', 'followers', 'private'] as const).map((v) => {
              const labels = { public: 'Public', followers: 'Abonnés', private: 'Privé' };
              return (
                <TouchableOpacity
                  key={v}
                  style={[styles.visBtn, { borderColor: theme.border }, visibility === v && styles.visBtnActive]}
                  onPress={() => setVisibility(v)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.visBtnText, { color: theme.textMuted }, visibility === v && styles.visBtnTextActive]}>
                    {labels[v]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Custom cover ── */}
        {media && !media.isImage && (
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Couverture</Text>
            <TouchableOpacity style={styles.coverRow} onPress={pickCustomCover} activeOpacity={0.8}>
              {customCover ? (
                <Image source={{ uri: customCover }} style={styles.coverThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.coverThumb, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }]}>
                  <IcImage size={22} color={theme.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.coverLabel, { color: theme.text }]}>{customCover ? 'Couverture personnalisée' : 'Choisir une image de couverture'}</Text>
                <Text style={[styles.coverHint, { color: theme.textMuted }]}>{customCover ? 'Appuie pour changer' : 'Depuis votre galerie · sinon auto-générée'}</Text>
              </View>
              {customCover && (
                <TouchableOpacity onPress={() => setCustomCover(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <IcClose size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Quick hashtag chips ── */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Hashtags populaires</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hashtagRow}>
            {popularHashtags.map(tag => (
              <TouchableOpacity key={tag} style={styles.hashChip} onPress={() => insertHashtag(tag)} activeOpacity={0.8}>
                <IcHash size={12} color={COLORS.primary} />
                <Text style={styles.hashChipText}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Tips ── */}
        <View style={[styles.tipsBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.tipTitle, { color: theme.text }]}>Conseils</Text>
          <Text style={[styles.tipItem, { color: theme.textMuted }]}>· Utilise <Text style={styles.tipHighlight}>#hashtag</Text> pour apparaître dans Explorer</Text>
          <Text style={[styles.tipItem, { color: theme.textMuted }]}>· Mentionne <Text style={styles.tipHighlight}>@utilisateur</Text> pour les notifier</Text>
          <Text style={[styles.tipItem, { color: theme.textMuted }]}>· Vidéos verticales (9:16) recommandées</Text>
          <Text style={[styles.tipItem, { color: theme.textMuted }]}>· Max 100 MB pour un upload rapide</Text>
        </View>

        {/* ── Buttons row ── */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.draftBtn, (!media || uploading) && { opacity: 0.4 }]}
            onPress={handleSaveDraft}
            disabled={!media || uploading}
            activeOpacity={0.8}
          >
            <IcSave size={16} color={COLORS.primary} />
            <Text style={styles.draftBtnText}>Brouillon</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, { flex: 1 }, (!media || uploading) && styles.submitBtnDisabled]}
            onPress={handlePublish}
            disabled={!media || uploading}
            activeOpacity={0.85}
          >
            {uploading
              ? <ActivityIndicator color={COLORS.white} size="small" />
              : <Text style={styles.submitBtnText}>Publier</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Success overlay ── */}
      {showSuccess && (
        <Animated.View style={[styles.successOverlay, { opacity: successOpacity }]} pointerEvents="none">
          <Animated.View style={[styles.successCard, { backgroundColor: theme.surface, transform: [{ scale: successScale }] }]}>
            <View style={[styles.successCheckWrap, { overflow: 'visible' }]}>
              <IcCheck size={42} color={COLORS.white} strokeWidth={3} />
              {CONFETTI_PRESETS.map((p, i) => (
                <ConfettiDot key={i} preset={p} color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]} show={showSuccess} />
              ))}
            </View>
            <Text style={[styles.successTitle, { color: theme.text }]}>Publiée !</Text>
            <Text style={[styles.successSub, { color: theme.textMuted }]}>Ta vidéo est en ligne dans le feed</Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  headerTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, color: COLORS.text },
  content: { padding: SPACING.md, gap: SPACING.md },

  picker: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed',
    minHeight: 160, overflow: 'hidden', justifyContent: 'center',
  },
  pickerSelected: { borderStyle: 'solid', borderColor: COLORS.primary },
  pickerEmpty: { alignItems: 'center', gap: 10, padding: SPACING.xl },
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

  progressWrap: { gap: 6 },
  progressTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  progressText: { fontSize: FONT.size.xs, color: COLORS.primary, fontWeight: FONT.weight.medium, textAlign: 'center' },

  field: { gap: 8 },
  fieldLabel: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.textMuted },
  textarea: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md,
    fontSize: FONT.size.base, color: COLORS.text,
    minHeight: 100, textAlignVertical: 'top',
  },
  captionPreview: {
    backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.sm,
    padding: SPACING.sm, gap: 4,
  },
  captionPreviewLabel: { fontSize: FONT.size.xs, color: COLORS.textMuted },
  captionPreviewText: { fontSize: FONT.size.sm, lineHeight: 20 },
  captionNormal: { color: COLORS.text },
  captionHash: { color: COLORS.primary, fontWeight: FONT.weight.semibold },
  captionMention: { color: '#3B82F6', fontWeight: FONT.weight.semibold },
  charCount: { fontSize: FONT.size.xs, color: COLORS.textSubtle, textAlign: 'right' },

  suggestionsBox: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderLight, overflow: 'hidden', ...SHADOW.sm,
  },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  suggestionAvatar: { width: 36, height: 36, borderRadius: 18 },
  suggestionAvatarFallback: { backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  suggestionAvatarText: { fontSize: 14, fontWeight: FONT.weight.bold, color: COLORS.primary },
  suggestionName: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, color: COLORS.text },
  suggestionUsername: { fontSize: FONT.size.xs, color: COLORS.textMuted },

  hashtagRow: { gap: 8, paddingVertical: 4 },
  hashChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: COLORS.primaryLight,
  },
  hashChipText: { fontSize: FONT.size.sm, color: COLORS.primary, fontWeight: FONT.weight.medium },

  tipsBox: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: SPACING.md, gap: 4,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  tipTitle: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold, color: COLORS.text, marginBottom: 4 },
  tipItem: { fontSize: FONT.size.xs, color: COLORS.textMuted, lineHeight: 18 },
  tipHighlight: { color: COLORS.primary, fontWeight: FONT.weight.semibold },

  visRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  visBtn: {
    flex: 1, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 8, alignItems: 'center',
  },
  visBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  visBtnText: { fontSize: FONT.size.sm, fontWeight: '600', color: COLORS.textMuted },
  visBtnTextActive: { color: COLORS.white },

  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coverThumb: { width: 56, height: 74, borderRadius: 6, backgroundColor: '#111' },
  coverLabel: { fontSize: FONT.size.sm, fontWeight: '600', color: COLORS.text },
  coverHint: { fontSize: FONT.size.xs, color: COLORS.textMuted, marginTop: 2 },

  successOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', zIndex: 999,
  },
  successCard: {
    backgroundColor: COLORS.white, borderRadius: 24,
    paddingHorizontal: 40, paddingVertical: 36,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
  },
  successCheckWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: { fontSize: 26, fontWeight: FONT.weight.bold, color: COLORS.text },
  successSub: { fontSize: FONT.size.sm, color: COLORS.textMuted, textAlign: 'center' },

  btnRow: { flexDirection: 'row', gap: 12 },
  draftBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 16, paddingHorizontal: 16,
  },
  draftBtnText: { fontSize: FONT.size.md, fontWeight: FONT.weight.semibold, color: COLORS.primary },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 16, alignItems: 'center', ...SHADOW.green,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: FONT.size.md, fontWeight: FONT.weight.semibold, color: COLORS.white },
});
