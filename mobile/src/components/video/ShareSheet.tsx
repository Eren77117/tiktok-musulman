import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '../../constants/theme';
import { IcShare, IcMail, IcClose, IcCopy } from '../ui/Icons';
import { SharePostToDMModal } from '../messages/SharePostToDMModal';

interface Post {
  id: string;
  caption: string | null;
  thumbnail_url: string | null;
  user: { username: string; display_name: string };
}

interface Props {
  visible: boolean;
  post: Post;
  onClose: () => void;
  onNotInterested?: () => void;
}

export default function ShareSheet({ visible, post, onClose, onNotInterested }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [dmVisible, setDmVisible] = useState(false);

  const postUrl = `https://nour.app/@${post.user.username}/video/${post.id}`;

  const handleShareNative = async () => {
    onClose();
    try {
      await Share.share({
        message: `${post.caption ?? 'Vidéo Nour'}\n${postUrl}`,
        url: postUrl,
      });
    } catch {
      // user cancelled or error
    }
  };

  const handleCopyLink = () => {
    // Clipboard copy — no native module needed for iOS
    onClose();
    // Try Share with a message fallback
    Share.share({ message: postUrl }).catch(() => {});
  };

  const handleSendDM = () => {
    onClose();
    setDmVisible(true);
  };

  const handleNotInterested = () => {
    onNotInterested?.();
    onClose();
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, {
          backgroundColor: theme.surface,
          paddingBottom: Math.max(insets.bottom, 16),
        }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>Partager</Text>

          <TouchableOpacity style={styles.row} onPress={handleSendDM} activeOpacity={0.8}>
            <View style={[styles.iconWrap, { backgroundColor: COLORS.primaryBg }]}>
              <IcMail size={20} color={COLORS.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Envoyer en DM</Text>
              <Text style={[styles.rowSub, { color: theme.textMuted }]}>Partager dans une conversation</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={handleShareNative} activeOpacity={0.8}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(0,122,255,0.1)' }]}>
              <IcShare size={20} color="#007AFF" />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Partager via…</Text>
              <Text style={[styles.rowSub, { color: theme.textMuted }]}>WhatsApp, Instagram, SMS…</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={handleCopyLink} activeOpacity={0.8}>
            <View style={[styles.iconWrap, { backgroundColor: theme.card }]}>
              <IcCopy size={20} color={theme.textMuted} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Copier le lien</Text>
            </View>
          </TouchableOpacity>

          {onNotInterested && (
            <TouchableOpacity style={styles.row} onPress={handleNotInterested} activeOpacity={0.8}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
                <IcClose size={20} color="#FF3B30" />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Pas intéressé</Text>
                <Text style={[styles.rowSub, { color: theme.textMuted }]}>Moins de vidéos comme celle-ci</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      <SharePostToDMModal
        visible={dmVisible}
        post={post}
        onClose={() => setDmVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.md, paddingTop: 12,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: FONT.size.base, fontWeight: '600' },
  rowSub: { fontSize: FONT.size.xs, marginTop: 1 },
});
