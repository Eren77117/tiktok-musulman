/**
 * LiveViewerScreen — Watch a live stream
 * WebRTC viewer + Socket.io chat
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, Alert, ActivityIndicator, Dimensions, StatusBar, Animated, Easing,
} from 'react-native';
import { RTCPeerConnection, RTCView, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { io, Socket } from 'socket.io-client';
import { useQuery } from '@tanstack/react-query';
import { api, getTokens } from '../../api/client';
import { API_BASE_URL } from '../../constants/theme';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { IcClose, IcHeart, IcHeartFill, IcUsers, IcSend } from '../../components/ui/Icons';

const { width: W, height: H } = Dimensions.get('window');
const SOCKET_URL = API_BASE_URL.replace('/api', '');
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

type Props = NativeStackScreenProps<RootStackParamList, 'LiveViewer'>;

interface ChatMsg { id?: string; user: { id: string; display_name: string; avatar_url: string | null }; text: string; timestamp: number; rank?: string | null }
interface LiveSession {
  id: string; title: string; viewer_count: number; chat_enabled: boolean;
  user: { id: string; username: string; display_name: string; avatar_url: string | null };
}
interface FloatingHeart { id: string; x: number }

function FloatingHeartItem({ x }: { x: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }),
      Animated.timing(translateY, { toValue: -200, duration: 2000, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      Animated.sequence([
        Animated.delay(1500),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);
  const colors = ['#FF3B5C', '#FF9500', '#FF2D55', '#FF6B6B', '#C026D3'];
  const color = colors[Math.floor(Math.abs(x * 7) % colors.length)];
  const size = 22 + Math.floor(Math.abs(x * 3) % 14);
  return (
    <Animated.View style={{ position: 'absolute', bottom: 100, left: x, transform: [{ translateY }, { scale }], opacity }}>
      <IcHeartFill size={size} color={color} />
    </Animated.View>
  );
}

function ViewerCountBadge({ count }: { count: number }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(count);
  useEffect(() => {
    if (count !== prevCount.current) {
      prevCount.current = count;
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
      ]).start();
    }
  }, [count]);
  return (
    <Animated.View style={[styles.viewerBadge, { transform: [{ scale: scaleAnim }] }]}>
      <IcUsers size={13} color={COLORS.white} />
      <Text style={styles.viewerCount}>{count}</Text>
    </Animated.View>
  );
}

export default function LiveViewerScreen({ route, navigation }: Props) {
  const { sessionId, broadcasterId } = route.params as any;
  const insets = useSafeAreaInsets();
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [connected, setConnected] = useState(false);
  const [liveEnded, setLiveEnded] = useState(false);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [liveSeconds, setLiveSeconds] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const { data: session } = useQuery<LiveSession>({
    queryKey: ['live-session', sessionId],
    queryFn: () => api.get(`/live/${sessionId}`).then(r => r.data),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (session) {
      setViewerCount(session.viewer_count);
      setChatEnabled(session.chat_enabled);
    }
  }, [session]);

  // ── Socket + WebRTC ─────────────────────────────────────────────────────────
  useEffect(() => {
    let pc: RTCPeerConnection;

    (async () => {
      const tokens = await getTokens();
      if (!tokens) return;

      const socket = io(SOCKET_URL, { auth: { token: tokens.access }, transports: ['websocket'] });
      socketRef.current = socket;

      const joinRoom = () => {
        socket.emit('live:join', sessionId);
        socket.emit('live:viewer:join', { sessionId, broadcasterId });
        // Merge history with any real-time messages already received (avoids overwrite race)
        api.get(`/live/${sessionId}/messages`).then(r => {
          setMessages(prev => {
            const ids = new Set((r.data.items as ChatMsg[]).map(m => m.id));
            const realtime = prev.filter(m => m.id && !ids.has(m.id));
            return [...(r.data.items as ChatMsg[]), ...realtime];
          });
        }).catch(() => {});
      };

      socket.on('connect', joinRoom);
      socket.on('reconnect', joinRoom);

      socket.on('live:ended', () => setLiveEnded(true));
      socket.on('live:reaction', addHeart);

      socket.on('live:comment', (msg: ChatMsg) => {
        setMessages(prev => [...prev.slice(-200), msg]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      });

      // WebRTC: receive offer from broadcaster
      socket.on('webrtc:offer', async ({ sdp }: any) => {
        try {
          pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          pcRef.current = pc;

          // react-native-webrtc: use property callbacks (types don't expose addEventListener)
          (pc as any).ontrack = (event: any) => {
            const stream = event.streams?.[0];
            if (stream) { setRemoteStream(stream); setConnected(true); }
          };

          (pc as any).onicecandidate = (event: any) => {
            if (event.candidate) {
              socket.emit('webrtc:ice', { sessionId, targetId: broadcasterId, candidate: event.candidate });
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc:answer', { sessionId, broadcasterId, sdp: answer });
        } catch (err) {
          console.warn('[LiveViewer] webrtc:offer error:', err);
        }
      });

      // ICE from broadcaster
      socket.on('webrtc:ice', async ({ candidate }: any) => {
        if (pcRef.current && candidate) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
        }
      });

      // Viewer count updates (real-time from backend)
      socket.on('live:viewer:count', (count: number) => setViewerCount(count));
    })();

    return () => {
      socketRef.current?.emit('live:leave', sessionId);
      socketRef.current?.disconnect();
      pcRef.current?.close();
    };
  }, [sessionId, broadcasterId]);

  const addHeart = useCallback(() => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    const x = Math.random() * (W - 40) + 10;
    setHearts(prev => [...prev.slice(-20), { id, x }]);
    setTimeout(() => setHearts(prev => prev.filter(h => h.id !== id)), 2500);
  }, []);

  // Live elapsed timer — counts from when viewer joined
  useEffect(() => {
    const interval = setInterval(() => setLiveSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = () => {
    if (!chatText.trim() || !socketRef.current) return;
    socketRef.current.emit('live:comment', { sessionId, text: chatText.trim() });
    setChatText('');
  };

  if (liveEnded) {
    return (
      <View style={styles.container}>
        <View style={styles.endedOverlay}>
          <Text style={styles.endedText}>Le live est terminé</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Remote stream */}
      {remoteStream ? (
        <RTCView streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" zOrder={0} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.waiting]}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.waitingText}>Connexion au live...</Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.userInfo}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.hostName} numberOfLines={1}>{session?.user.display_name ?? ''}</Text>
        </View>
        <ViewerCountBadge count={viewerCount} />
        <View style={styles.liveTimerBadge}>
          <Text style={styles.liveTimerText}>
            {String(Math.floor(liveSeconds / 60)).padStart(2,'0')}:{String(liveSeconds % 60).padStart(2,'0')}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <IcClose size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={[styles.liveTitle, { top: insets.top + 60 }]} numberOfLines={2}>
        {session?.title}
      </Text>

      {/* Chat overlay */}
      {chatEnabled && (
        <View style={[styles.chatArea, { paddingBottom: insets.bottom + 70 }]}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m, i) => m.id ?? `${i}`}
            renderItem={({ item: m }) => (
              <View style={styles.chatRow}>
                {m.rank === 'top' && <View style={styles.rankBadgeTop}><Text style={styles.rankBadgeTxt}>TOP</Text></View>}
                {m.rank === 'loyal' && <View style={styles.rankBadgeLoy}><Text style={styles.rankBadgeTxt}>LOYAL</Text></View>}
                <Text style={styles.chatUser}>{m.user.display_name} </Text>
                <Text style={styles.chatTxt}>{m.text}</Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        </View>
      )}

      {/* Floating hearts */}
      {hearts.map(h => <FloatingHeartItem key={h.id} x={h.x} />)}

      {/* Follow + reaction buttons (right side) */}
      <View style={[styles.rightActions, { bottom: insets.bottom + 80 }]}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            addHeart();
            socketRef.current?.emit('live:reaction', { sessionId });
          }}
          activeOpacity={0.7}
        >
          <IcHeartFill size={28} color="#FF3B5C" />
        </TouchableOpacity>
      </View>

      {/* Chat input */}
      {chatEnabled && (
        <View style={[styles.chatInputRow, { bottom: insets.bottom + 14 }]}>
          <TextInput
            style={styles.chatInput}
            value={chatText}
            onChangeText={setChatText}
            placeholder="Écrire un message..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <IcSend size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  waiting: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  waitingText: { color: COLORS.white, fontSize: FONT.size.base },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8, zIndex: 10 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FF3B5C', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.white },
  liveText: { fontSize: 10, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  hostName: { fontSize: FONT.size.sm, fontWeight: '700', color: COLORS.white, flex: 1 },
  viewerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 4 },
  viewerCount: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  liveTimerBadge: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 4 },
  liveTimerText: { fontSize: 11, fontWeight: '700', color: COLORS.white, letterSpacing: 0.5 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  liveTitle: { position: 'absolute', left: 14, right: 80, color: COLORS.white, fontSize: FONT.size.sm, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  chatArea: { position: 'absolute', bottom: 0, left: 0, right: 90, maxHeight: H * 0.4, padding: 14 },
  chatRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 4, alignSelf: 'flex-start' },
  chatUser: { fontSize: 12, fontWeight: '700', color: COLORS.primaryLight },
  chatTxt: { fontSize: 12, color: COLORS.white },
  rankBadgeTop: { backgroundColor: '#F59E0B', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginRight: 4 },
  rankBadgeLoy: { backgroundColor: '#10B981', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginRight: 4 },
  rankBadgeTxt: { fontSize: 9, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5 },
  rightActions: { position: 'absolute', right: 14, flexDirection: 'column', gap: 16 },
  actionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  chatInputRow: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', gap: 8 },
  chatInput: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', color: COLORS.white, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: FONT.size.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontSize: 18, color: COLORS.white },
  endedOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  endedText: { fontSize: FONT.size.xl, fontWeight: '700', color: COLORS.white },
  backBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 30, paddingVertical: 12 },
  backBtnText: { color: COLORS.white, fontWeight: '700' },
});
