import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { io, Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation';
import { api, getTokens } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { COLORS, SPACING, WS_URL } from '../../constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender: { id: string; username: string; display_name: string; avatar_url: string | null };
}

export default function ConversationScreen({ route, navigation }: Props) {
  const { conversationId, otherUser } = route.params;
  const { user } = useAuthStore();
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const { isLoading, data: msgData } = useQuery<{ items: Message[] }>({
    queryKey: ['messages', conversationId],
    queryFn: () => api.get(`/messages/conversations/${conversationId}/messages`).then((r) => r.data),
  });

  React.useEffect(() => {
    if (msgData) setMessages([...msgData.items].reverse());
  }, [msgData]);

  useEffect(() => {
    navigation.setOptions({ title: otherUser.display_name });

    let socket: Socket;
    (async () => {
      const tokens = await getTokens();
      if (!tokens) return;
      socket = io(WS_URL, { auth: { token: tokens.access }, transports: ['websocket'] });
      socket.emit('join:conversation', conversationId);
      socket.on('message:new', (msg: Message) => {
        setMessages((prev) => [...prev, msg]);
      });
      socketRef.current = socket;
    })();

    return () => {
      socketRef.current?.emit('leave:conversation', conversationId);
      socketRef.current?.disconnect();
    };
  }, [conversationId]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/messages/conversations/${conversationId}/messages`, { content }),
    onSuccess: (res) => {
      setMessages((prev) => [...prev, res.data]);
      setText('');
    },
  });

  const flatRef = useRef<FlatList>(null);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: m }) => {
            const isMe = m.sender.id === user?.id;
            return (
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                  {m.content}
                </Text>
              </View>
            );
          }}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor={COLORS.textSubtle}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sendMutation.isPending) && styles.sendBtnDisabled]}
          onPress={() => text.trim() && sendMutation.mutate(text.trim())}
          disabled={!text.trim() || sendMutation.isPending}
        >
          <Text style={styles.sendIcon}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.md, gap: 8 },
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: COLORS.primary, alignSelf: 'flex-end' },
  bubbleThem: { backgroundColor: COLORS.bgCard, alignSelf: 'flex-start' },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextThem: { color: COLORS.text },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.bgInput,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { fontSize: 18, color: '#fff', fontWeight: '700' },
});
