/**
 * Single-video fullscreen player — opened from profile grid
 * Shows the video with all overlays (like, comment, share, save)
 * Comments open as a bottom sheet
 */
import React, { useState } from 'react';
import { View, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation';
import { api } from '../../api/client';
import { VideoPlayerItem, FeedPost } from '../../components/video/VideoPlayerItem';
import { CommentsBottomSheet } from '../../components/video/CommentsBottomSheet';
import { IcBack } from '../../components/ui/Icons';
import { COLORS } from '../../constants/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoPlayer'>;

export default function VideoPlayerScreen({ route, navigation }: Props) {
  const { postId } = route.params;
  const insets = useSafeAreaInsets();
  const [commentsOpen, setCommentsOpen] = useState(false);

  const { data: post } = useQuery<FeedPost>({
    queryKey: ['post', postId],
    queryFn: () => api.get(`/posts/${postId}`).then(r => r.data),
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Back button */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 8 }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <IcBack size={24} color={COLORS.white} />
      </TouchableOpacity>

      {post && (
        <VideoPlayerItem
          post={post}
          isVisible={!commentsOpen}
          onComment={() => setCommentsOpen(true)}
        />
      )}

      <CommentsBottomSheet
        postId={commentsOpen ? postId : null}
        onClose={() => setCommentsOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backBtn: {
    position: 'absolute', left: 14, zIndex: 100,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
});
