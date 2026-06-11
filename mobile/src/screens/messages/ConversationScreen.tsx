import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Pressable, Animated, Modal, Alert, Image, PanResponder,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { launchImageLibrary } from 'react-native-image-picker';
import { useQuery, useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation';
import { api, getTokens } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, SPACING, WS_URL, FONT, RADIUS } from '../../constants';
import { IcSend, IcCornerUpLeft, IcTrash, IcClose, IcImage, IcFlame } from '../../components/ui/Icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

interface Message {
  id: string;
  content: string;
  media_url?: string | null;
  is_read: boolean;
  is_ephemeral?: boolean;
  created_at: string;
  reactions?: Record<string, string>;
  reply_to?: { id: string; content: string; sender_name: string } | null;
  sender: { id: string; username: string; display_name: string; avatar_url: string | null };
}

const REACTIONS = ['❤', '😂', '👍', '😮', '😢', '🙏'];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function TypingBubble({ theme }: { theme: ReturnType<typeof import('../../hooks/useTheme').useTheme> }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: -4, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600),
      ]));
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 200);
    const a3 = anim(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={[styles.bubbleRowThem, { marginVertical: 2, alignSelf: 'flex-start' }]}>
      <View style={[styles.bubble, styles.bubbleThem, { backgroundColor: theme.card, flexDirection: 'row', gap: 4, paddingVertical: 14 }]}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.textMuted, transform: [{ translateY: dot }] }} />
        ))}
      </View>
    </View>
  );
}

// Swipe-right-to-reply wrapper — slides bubble right, shows scaling reply icon at 40px
function SwipeableMessage({ children, onReply, disabled }: {
  children: React.ReactNode;
  onReply: () => void;
  disabled?: boolean;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const triggered = useRef(false);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      !disabled && g.dx > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderGrant: () => { triggered.current = false; },
    onPanResponderMove: (_, g) => {
      const val = Math.max(0, Math.min(55, g.dx));
      tx.setValue(val);
      // Scale icon 0→1 as swipe goes 0→40px
      iconScale.setValue(Math.min(1, val / 40));
      if (!triggered.current && val >= 40) {
        triggered.current = true;
        ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });
        onReply();
      }
    },
    onPanResponderRelease: () => {
      Animated.parallel([
        Animated.spring(tx, { toValue: 0, useNativeDriver: true, tension: 300, friction: 14 }),
        Animated.spring(iconScale, { toValue: 0, useNativeDriver: true, tension: 300, friction: 14 }),
      ]).start();
    },
    onPanResponderTerminate: () => {
      tx.setValue(0);
      iconScale.setValue(0);
    },
  })).current;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Animated.View style={{
        transform: [{ scale: iconScale }],
        marginLeft: 4,
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(45,122,79,0.15)',
        alignItems: 'center', justifyContent: 'center',
        position: 'absolute', left: -36,
      }}>
        <IcCornerUpLeft size={14} color={COLORS.primary} />
      </Animated.View>
      <Animated.View style={{ flex: 1, transform: [{ translateX: tx }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

export default function ConversationScreen({ route, navigation }: Props) {
  const { conversationId, otherUser } = route.params;
  const { user } = useAuthStore();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [text, setText] = useState('');
  const [ephemeralMode, setEphemeralMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState('islam');
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [reactingTo, setReactingTo] = useState<Message | null>(null);
  const [myReactions, setMyReactions] = useState<Record<string, string>>({});
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [attachLoading, setAttachLoading] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const { isLoading, isError, data: msgData } = useQuery<{ items: Message[] }>({
    queryKey: ['messages', conversationId],
    queryFn: () => api.get(`/messages/conversations/${conversationId}/messages`).then(r => r.data).catch(() => ({ items: [] })),
    retry: 1,
  });

  useEffect(() => {
    if (msgData?.items) {
      setMessages([...msgData.items].reverse());
      const rx: Record<string, string> = {};
      [...msgData.items].reverse().forEach(m => {
        if (m.reactions && user?.id && m.reactions[user.id]) rx[m.id] = m.reactions[user.id];
      });
      setMyReactions(rx);
    }
  }, [msgData, user?.id]);

  useEffect(() => {
    navigation.setOptions({
      title: otherUser.display_name,
      headerStyle: { backgroundColor: theme.surface },
      headerTintColor: theme.text,
    });

    let socket: Socket;
    (async () => {
      const tokens = await getTokens();
      if (!tokens) return;
      socket = io(WS_URL, { auth: { token: tokens.access }, transports: ['websocket'] });
      socket.emit('join:conversation', conversationId);

      socket.on('message:new', (msg: Message) => {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      });

      socket.on('message:reaction', ({ msgId, userId: uid, emoji }: { msgId: string; userId: string; emoji: string }) => {
        setMessages(prev => prev.map(m =>
          m.id === msgId ? { ...m, reactions: { ...(m.reactions ?? {}), [uid]: emoji } } : m
        ));
      });

      socket.on('message:read', ({ conversationId: cId }: { conversationId: string }) => {
        if (cId === conversationId) {
          setMessages(prev => prev.map(m => m.sender.id === user?.id ? { ...m, is_read: true } : m));
        }
      });

      socket.on('typing:start', ({ userId: uid }: { userId: string }) => {
        if (uid !== user?.id) setIsOtherTyping(true);
      });

      socket.on('typing:stop', ({ userId: uid }: { userId: string }) => {
        if (uid !== user?.id) setIsOtherTyping(false);
      });

      socketRef.current = socket;
    })();

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      socketRef.current?.emit('leave:conversation', conversationId);
      socketRef.current?.disconnect();
    };
  }, [conversationId, theme.surface, theme.text]);

  const handleTextChange = useCallback((val: string) => {
    setText(val);
    if (!socketRef.current) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current.emit('typing:start', conversationId);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socketRef.current?.emit('typing:stop', conversationId);
    }, 2000);
  }, [conversationId]);

  const sendMutation = useMutation({
    mutationFn: (payload: { content: string; media_url?: string; reply_to_id?: string; is_ephemeral?: boolean }) =>
      api.post(`/messages/conversations/${conversationId}/messages`, payload),
    onSuccess: res => {
      setMessages(prev => [...prev, res.data]);
      setText('');
      setReplyTo(null);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      isTypingRef.current = false;
      socketRef.current?.emit('typing:stop', conversationId);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: () => Alert.alert('Erreur', "Impossible d'envoyer le message."),
  });

  const fetchGifs = useCallback(async (q: string) => {
    setGifLoading(true);
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(q)}&limit=20&rating=g`);
      const json = await res.json();
      const items = (json.data ?? []).map((g: any) => ({
        id: g.id,
        url: g.images.original.url,
        preview: g.images.fixed_height_small.url,
      }));
      setGifs(items);
    } catch { setGifs([]); }
    finally { setGifLoading(false); }
  }, []);

  const openGifPicker = () => {
    setShowGifPicker(true);
    if (gifs.length === 0) fetchGifs(gifQuery);
  };

  const sendGif = (url: string) => {
    setShowGifPicker(false);
    sendMutation.mutate({ content: '', media_url: url });
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate({ content: trimmed, reply_to_id: replyTo?.id, is_ephemeral: ephemeralMode || undefined });
  }, [text, replyTo, sendMutation]);

  const handleAttach = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.didCancel || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setAttachLoading(true);
    try {
      const form = new FormData();
      form.append('file', { uri: asset.uri!, type: asset.type ?? 'image/jpeg', name: asset.fileName ?? 'photo.jpg' } as any);
      const res = await api.post('/upload/image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      sendMutation.mutate({ content: '', media_url: res.data.url, reply_to_id: replyTo?.id });
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer l'image.");
    } finally {
      setAttachLoading(false);
    }
  }, [replyTo, sendMutation]);

  const handleReact = useCallback(async (emoji: string) => {
    if (!reactingTo || !user?.id) return;
    const msgId = reactingTo.id;
    const prev = myReactions[msgId];
    const newEmoji = prev === emoji ? '' : emoji;
    setMyReactions(r => ({ ...r, [msgId]: newEmoji }));
    setMessages(msgs => msgs.map(m =>
      m.id === msgId ? { ...m, reactions: { ...(m.reactions ?? {}), [user.id]: newEmoji } } : m
    ));
    setReactingTo(null);
    try {
      await api.post(`/messages/conversations/${conversationId}/messages/${msgId}/react`, { emoji: newEmoji });
      socketRef.current?.emit('message:reaction', { conversationId, msgId, emoji: newEmoji });
    } catch {}
  }, [reactingTo, myReactions, user?.id, conversationId]);

  const handleDelete = useCallback(async (msgId: string) => {
    Alert.alert('Supprimer', 'Supprimer ce message ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          setMessages(msgs => msgs.map(m => m.id === msgId ? { ...m, content: '[DELETED]' } : m));
          try { await api.delete(`/messages/conversations/${conversationId}/messages/${msgId}`); } catch {}
        },
      },
    ]);
    setReactingTo(null);
  }, [conversationId]);

  const renderItem = useCallback(({ item: m }: { item: Message }) => {
    const isMe = m.sender.id === user?.id;
    const deleted = m.content === '[DELETED]' || m.content === '[HIDDEN]';
    const myRx = myReactions[m.id];
    const rxList = m.reactions ? Object.entries(m.reactions).filter(([, e]) => e) : [];

    return (
      <SwipeableMessage
        onReply={() => { setReplyTo(m); setTimeout(() => inputRef.current?.focus(), 100); }}
        disabled={deleted}
      >
      <Pressable
        onLongPress={() => !deleted && setReactingTo(m)}
        delayLongPress={350}
        style={({ pressed }) => [
          styles.bubbleRow,
          isMe ? styles.bubbleRowMe : styles.bubbleRowThem,
          pressed && { opacity: 0.85 },
        ]}
      >
        {m.reply_to && (
          <View style={[styles.replyPreview, { borderLeftColor: COLORS.primary, backgroundColor: theme.card }]}>
            <Text style={[styles.replyName, { color: COLORS.primary }]} numberOfLines={1}>{m.reply_to.sender_name}</Text>
            <Text style={[styles.replyText, { color: theme.textMuted }]} numberOfLines={1}>{m.reply_to.content}</Text>
          </View>
        )}

        <View style={[
          styles.bubble,
          isMe ? [styles.bubbleMe, { backgroundColor: COLORS.primary }]
               : [styles.bubbleThem, { backgroundColor: theme.card }],
          deleted && { opacity: 0.55 },
        ]}>
          {m.media_url && !deleted && (
            <Image source={{ uri: m.media_url }} style={styles.mediaThumb} resizeMode="cover" />
          )}
          {(m.content.trim().length > 0 || deleted) && (
            <Text style={[styles.bubbleText, { color: isMe ? '#fff' : theme.text }]}>
              {deleted ? 'Message supprimé' : m.content}
            </Text>
          )}
          <View style={styles.metaRow}>
            {m.is_ephemeral && !deleted && (
              <IcFlame size={12} color={isMe ? 'rgba(255,200,200,0.9)' : '#EF4444'} />
            )}
            <Text style={[styles.timeText, { color: isMe ? 'rgba(255,255,255,0.6)' : theme.textMuted }]}>
              {fmtTime(m.created_at)}
            </Text>
            {isMe && !deleted && (
              <Text style={[styles.tickText, { color: m.is_read ? '#4CD964' : 'rgba(255,255,255,0.55)' }]}>
                {m.is_read ? '✓✓' : '✓'}
              </Text>
            )}
          </View>
        </View>

        {rxList.length > 0 && (
          <View style={[styles.rxRow, isMe ? styles.rxRowMe : styles.rxRowThem]}>
            {rxList.slice(0, 5).map(([uid, emoji]) => (
              <Text key={uid} style={styles.rxEmoji}>{emoji}</Text>
            ))}
            {rxList.length > 5 && <Text style={[styles.rxCount, { color: theme.textMuted }]}>+{rxList.length - 5}</Text>}
          </View>
        )}

        {!deleted && (
          <TouchableOpacity
            style={[styles.replyBtn, isMe ? styles.replyBtnMe : styles.replyBtnThem]}
            onPress={() => { setReplyTo(m); inputRef.current?.focus(); }}
            activeOpacity={0.7}
          >
            <IcCornerUpLeft size={14} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </Pressable>
      </SwipeableMessage>
    );
  }, [user?.id, myReactions, theme]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={88}
    >
      <Modal visible={!!reactingTo} transparent animationType="fade" onRequestClose={() => setReactingTo(null)}>
        <Pressable style={styles.rxBackdrop} onPress={() => setReactingTo(null)}>
          <View style={[styles.rxPicker, { backgroundColor: theme.card }]}>
            {REACTIONS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={[styles.rxBtn, reactingTo && myReactions[reactingTo.id] === emoji && { backgroundColor: theme.primaryBg }]}
                onPress={() => handleReact(emoji)}
                activeOpacity={0.7}
              >
                <Text style={styles.rxBtnEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            {reactingTo?.sender.id === user?.id && (
              <TouchableOpacity style={styles.rxBtn} onPress={() => handleDelete(reactingTo!.id)} activeOpacity={0.7}>
                <IcTrash size={18} color="#FF3B30" />
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* GIF Picker */}
      <Modal visible={showGifPicker} transparent animationType="slide" onRequestClose={() => setShowGifPicker(false)}>
        <View style={[styles.gifModal, { backgroundColor: theme.surface }]}>
          <View style={[styles.gifHeader, { borderBottomColor: theme.borderLight }]}>
            <Text style={[styles.gifTitle, { color: theme.text }]}>GIFs islamiques</Text>
            <TouchableOpacity onPress={() => setShowGifPicker(false)} activeOpacity={0.7}>
              <IcClose size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={[styles.gifSearchRow, { backgroundColor: theme.card }]}>
            <TextInput
              style={[styles.gifSearchInput, { color: theme.text }]}
              value={gifQuery}
              onChangeText={q => { setGifQuery(q); }}
              onSubmitEditing={() => fetchGifs(gifQuery)}
              placeholder="Rechercher un GIF..."
              placeholderTextColor={theme.textMuted}
              returnKeyType="search"
            />
          </View>
          {gifLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={gifs}
              numColumns={2}
              keyExtractor={g => g.id}
              contentContainerStyle={{ padding: 8, gap: 8 }}
              columnWrapperStyle={{ gap: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => sendGif(item.url)} activeOpacity={0.8} style={styles.gifCell}>
                  <Image source={{ uri: item.preview }} style={styles.gifImg} resizeMode="cover" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: COLORS.primary, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingHorizontal: 32 }}>
            Impossible de charger la conversation.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={[styles.list, { paddingBottom: replyTo ? 100 : 16 }]}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          ListFooterComponent={isOtherTyping ? <TypingBubble theme={theme} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>Envoie ton premier message</Text>
            </View>
          }
        />
      )}

      {replyTo && (
        <View style={[styles.replyBanner, { backgroundColor: theme.card, borderTopColor: theme.borderLight }]}>
          <View style={styles.replyBannerLeft}>
            <IcCornerUpLeft size={14} color={COLORS.primary} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.replyBannerName, { color: COLORS.primary }]} numberOfLines={1}>{replyTo.sender.display_name}</Text>
              <Text style={[styles.replyBannerText, { color: theme.textMuted }]} numberOfLines={1}>{replyTo.content}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding: 4 }}>
            <IcClose size={16} color={theme.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.inputRow, {
        backgroundColor: theme.surface,
        borderTopColor: theme.borderLight,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
      }]}>
        <TouchableOpacity style={styles.attachBtn} onPress={handleAttach} disabled={attachLoading} activeOpacity={0.7}>
          {attachLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <IcImage size={22} color={theme.textMuted} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.attachBtn, ephemeralMode && { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 18 }]}
          onPress={() => { ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true }); setEphemeralMode(m => !m); }}
          activeOpacity={0.7}
        >
          <IcFlame size={22} color={ephemeralMode ? '#EF4444' : theme.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.attachBtn} onPress={openGifPicker} activeOpacity={0.7}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.textMuted }}>GIF</Text>
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
          value={text}
          onChangeText={handleTextChange}
          placeholder="Message..."
          placeholderTextColor={theme.textMuted}
          multiline
          maxLength={2000}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sendMutation.isPending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
          activeOpacity={0.8}
        >
          {sendMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <IcSend size={18} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: 4 },

  bubbleRow: { maxWidth: '80%', marginVertical: 2 },
  bubbleRowMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowThem: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, borderBottomRightRadius: 4 },
  bubbleMe: { borderBottomRightRadius: 4, borderBottomLeftRadius: 18 },
  bubbleThem: { borderBottomRightRadius: 18, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, justifyContent: 'flex-end' },
  timeText: { fontSize: 10 },
  tickText: { fontSize: 10, fontWeight: '700' },

  mediaThumb: { width: 200, height: 200, borderRadius: 12, marginBottom: 6 },

  replyPreview: { borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 4, marginBottom: 4, borderRadius: 4 },
  replyName: { fontSize: 11, fontWeight: '700', marginBottom: 1 },
  replyText: { fontSize: 12 },

  rxRow: { flexDirection: 'row', gap: 2, marginTop: 3 },
  rxRowMe: { alignSelf: 'flex-end' },
  rxRowThem: { alignSelf: 'flex-start' },
  rxEmoji: { fontSize: 14 },
  rxCount: { fontSize: 11, alignSelf: 'center' },

  replyBtn: { position: 'absolute', top: '50%', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  replyBtnMe: { left: -32 },
  replyBtnThem: { right: -32 },

  replyBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 8, borderTopWidth: 1, gap: 8 },
  replyBannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  replyBannerName: { fontSize: 12, fontWeight: '700' },
  replyBannerText: { fontSize: 12 },

  inputRow: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md, paddingTop: 8, borderTopWidth: 1, alignItems: 'flex-end' },
  attachBtn: { width: 36, height: 42, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 120, borderWidth: 1 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },

  rxBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  rxPicker: { flexDirection: 'row', borderRadius: 20, padding: 8, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 },
  rxBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rxBtnEmoji: { fontSize: 24 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: FONT.size.sm },
  gifModal: { flex: 1, marginTop: 100, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  gifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  gifTitle: { fontSize: 16, fontWeight: '700' },
  gifSearchRow: { margin: 12, borderRadius: 12, paddingHorizontal: 14 },
  gifSearchInput: { fontSize: 14, paddingVertical: 10 },
  gifCell: { flex: 1, aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#111' },
  gifImg: { width: '100%', height: '100%' },
});
