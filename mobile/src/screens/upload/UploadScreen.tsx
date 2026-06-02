import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import { COLORS, SPACING } from '../../constants';

export default function UploadScreen() {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  const pickVideo = async () => {
    const result = await launchImageLibrary({
      mediaType: 'video',
      videoQuality: 'high',
    });
    if (result.assets?.[0]?.uri) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!videoUri) throw new Error('No video selected');
      setUploading(true);

      const formData = new FormData();
      formData.append('file', {
        uri: videoUri,
        type: 'video/mp4',
        name: 'video.mp4',
      } as unknown as Blob);

      const uploadRes = await api.post('/upload/video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await api.post('/posts', {
        video_url: uploadRes.data.url,
        caption: caption.trim() || undefined,
        duration: 0,
        is_public: true,
      });

      setVideoUri(null);
      setCaption('');
      Alert.alert('Posted!', 'Your video is live.');
    },
    onSettled: () => setUploading(false),
    onError: () => Alert.alert('Error', 'Upload failed. Please try again.'),
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New Post</Text>

      <TouchableOpacity style={styles.picker} onPress={pickVideo} activeOpacity={0.8}>
        {videoUri ? (
          <Text style={styles.pickerSelected}>Video selected</Text>
        ) : (
          <>
            <Text style={styles.pickerIcon}>+</Text>
            <Text style={styles.pickerText}>Tap to select a video</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Caption</Text>
        <TextInput
          style={styles.textarea}
          value={caption}
          onChangeText={setCaption}
          placeholder="Add a caption..."
          placeholderTextColor={COLORS.textSubtle}
          multiline
          maxLength={500}
        />
      </View>

      <TouchableOpacity
        style={[styles.btn, (!videoUri || uploading) && styles.btnDisabled]}
        onPress={() => postMutation.mutate()}
        disabled={!videoUri || uploading}
        activeOpacity={0.8}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Post video</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, gap: SPACING.md },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  picker: {
    height: 200,
    backgroundColor: COLORS.bgInput,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pickerIcon: { fontSize: 40, color: COLORS.textSubtle, fontWeight: '300' },
  pickerText: { fontSize: 14, color: COLORS.textMuted },
  pickerSelected: { fontSize: 15, color: COLORS.green, fontWeight: '600' },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  textarea: {
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
