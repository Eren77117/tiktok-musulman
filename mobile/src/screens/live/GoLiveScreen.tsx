/**
 * GoLiveScreen — Broadcaster screen
 * Uses react-native-webrtc for camera capture + Socket.io for signaling
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Dimensions, Platform, StatusBar, Modal, FlatList, Image,
} from 'react-native';
import { RTCPeerConnection, RTCView, mediaDevices, MediaStream, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { io, Socket } from 'socket.io-client';
import { api, getTokens } from '../../api/client';
import { API_BASE_URL } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';
import { IcClose, IcUsers, IcMail, IcRefresh } from '../../components/ui/Icons';

const { width: W, height: H } = Dimensions.get('window');
const SOCKET_URL = API_BASE_URL.replace('/api', '');

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

type Props = NativeStackScreenProps<RootStackParamList, 'GoLive'>;

interface Viewer { id: string; name: string }
interface ChatMsg { id?: string; user: { display_name: string }; text: string; timestamp: number }

export default function GoLiveScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [step, setStep] = useState<'setup' | 'live'>('setup');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cameraFront, setCameraFront] = useState(true);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [viewerList, setViewerList] = useState<Array<{ id: string; username: string; display_name: string; avatar_url: string | null }>>([]);

  const socketRef = useRef<Socket | null>(null);
  const peerRefs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const sessionRef = useRef<string | null>(null);

  // ── Camera setup ────────────────────────────────────────────────────────────
  // Use ref so socket callbacks always have fresh stream (avoids stale closure bug)
  const localStreamRef = useRef<MediaStream | null>(null);

  // Live duration timer
  useEffect(() => {
    if (step !== 'live') return;
    setLiveSeconds(0);
    const interval = setInterval(() => setLiveSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await mediaDevices.getUserMedia({
          video: { facingMode: cameraFront ? 'user' : 'environment', width: 720, height: 1280 },
          audio: true,
        });
        setLocalStream(stream);
        localStreamRef.current = stream;
      } catch {
        Alert.alert('Erreur', 'Impossible d\'accéder à la caméra. Vérifiez les permissions.');
      }
    })();
    return () => {
      stream?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    };
  }, [cameraFront]);

  // ── Socket + WebRTC setup when live starts ──────────────────────────────────
  const setupSocket = useCallback(async (sId: string) => {
    const tokens = await getTokens();
    if (!tokens) return;

    const socket = io(SOCKET_URL, { auth: { token: tokens.access }, transports: ['websocket'] });
    socketRef.current = socket;
    sessionRef.current = sId;

    const joinRoom = () => socket.emit('live:join', sId);
    socket.on('connect', joinRoom);
    socket.on('reconnect', joinRoom);
    // Join immediately if already connected
    if (socket.connected) joinRoom();

    socket.on('connect_error', (err: any) => {
      console.warn('[GoLive] Socket error:', err.message);
    });

    // New viewer joined — create WebRTC offer using ref (never stale)
    socket.on('live:viewer:joined', async ({ viewerId }: { viewerId: string }) => {
      const stream = localStreamRef.current;
      if (!stream) {
        console.warn('[GoLive] localStream not ready for viewer', viewerId);
        return;
      }
      setViewers(prev => [...prev.filter(v => v.id !== viewerId), { id: viewerId, name: '' }]);
      setViewerCount(c => c + 1);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerRefs.current.set(viewerId, pc);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      (pc as any).onicecandidate = ({ candidate }: any) => {
        if (candidate) socket.emit('webrtc:ice', { sessionId: sId, targetId: viewerId, candidate });
      };

      try {
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        socket.emit('webrtc:offer', { sessionId: sId, viewerId, sdp: offer });
      } catch (err) {
        console.warn('[GoLive] createOffer failed:', err);
      }
    });

    // Viewer sent answer
    socket.on('webrtc:answer', async ({ viewerId, sdp }: any) => {
      const pc = peerRefs.current.get(viewerId);
      if (pc) {
        try { await pc.setRemoteDescription(new RTCSessionDescription(sdp)); } catch {}
      }
    });

    // ICE candidate from viewer
    socket.on('webrtc:ice', async ({ fromId, candidate }: any) => {
      const pc = peerRefs.current.get(fromId);
      if (pc && candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
    });

    // Live chat
    socket.on('live:comment', (msg: ChatMsg) => {
      setMessages(prev => [...prev.slice(-99), msg]);
    });
  }, []);

  const startLive = async () => {
    if (!title.trim()) { Alert.alert('Titre requis', 'Donne un titre à ton live.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/live/start', { title: title.trim(), category, is_public: true });
      setSessionId(data.id);
      sessionRef.current = data.id;
      await setupSocket(data.id);
      setStep('live');
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.error ?? 'Impossible de démarrer le live.');
    } finally { setLoading(false); }
  };

  const endLive = () => {
    Alert.alert('Terminer le live ?', 'Tous les spectateurs seront déconnectés.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Terminer', style: 'destructive', onPress: async () => {
          if (sessionRef.current) {
            socketRef.current?.emit('live:end', sessionRef.current);
            await api.post(`/live/${sessionRef.current}/end`).catch(() => {});
          }
          peerRefs.current.forEach(pc => pc.close());
          peerRefs.current.clear();
          socketRef.current?.disconnect();
          localStream?.getTracks().forEach(t => t.stop());
          navigation.goBack();
        },
      },
    ]);
  };

  const sendChatMessage = () => {
    if (!chatText.trim() || !socketRef.current || !sessionRef.current) return;
    socketRef.current.emit('live:comment', { sessionId: sessionRef.current, text: chatText.trim() });
    setChatText('');
  };

  const toggleCamera = () => setCameraFront(f => !f);

  const toggleChat = async () => {
    if (!sessionRef.current) return;
    const newState = !chatEnabled;
    setChatEnabled(newState);
    await api.patch(`/live/${sessionRef.current}/chat`, { enabled: newState }).catch(() => {});
    socketRef.current?.emit('live:comment', { sessionId: sessionRef.current, text: `Chat ${newState ? 'activé' : 'désactivé'}` });
  };

  const CATEGORIES = ['general', 'rappel', 'coran', 'motivation', 'question'];

  if (step === 'setup') {
    return (
      <View style={[styles.setupContainer, { paddingTop: insets.top + 10 }]}>
        <StatusBar barStyle="light-content" />

        {/* Camera preview */}
        {localStream && (
          <RTCView streamURL={localStream.toURL()} style={styles.preview} objectFit="cover" zOrder={0} />
        )}
        <View style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={styles.setupHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <IcClose size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.setupTitle}>Nouveau live</Text>
          <TouchableOpacity onPress={toggleCamera} style={styles.iconBtn}>
            <IcRefresh size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.setupForm}>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Titre de ton live..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            maxLength={80}
          />

          <View style={styles.catRow}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c} style={[styles.catChip, category === c && styles.catChipActive]} onPress={() => setCategory(c)} activeOpacity={0.8}>
                <Text style={[styles.catText, category === c && styles.catTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[styles.goBtn, (!title.trim() || loading) && { opacity: 0.5 }]} onPress={startLive} disabled={!title.trim() || loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.goBtnText}>Commencer le live</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── LIVE MODE ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.liveContainer}>
      <StatusBar barStyle="light-content" />

      {/* Camera stream */}
      {localStream && (
        <RTCView streamURL={localStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" zOrder={0} />
      )}

      {/* Live badge + viewers */}
      <View style={[styles.liveHeader, { paddingTop: insets.top + 8 }]}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
        <TouchableOpacity
          style={styles.viewerBadge}
          onPress={async () => {
            if (!sessionId) return;
            const { data } = await api.get(`/live/${sessionId}/viewers`).catch(() => ({ data: { items: [] } }));
            setViewerList(data.items);
            setShowViewers(true);
          }}
          activeOpacity={0.8}
        >
          <IcUsers size={14} color={COLORS.white} />
          <Text style={styles.viewerCount}>{viewerCount}</Text>
        </TouchableOpacity>
        <View style={styles.timerBadge}>
          <Text style={styles.timerText}>
            {String(Math.floor(liveSeconds / 3600)).padStart(2,'0')}:{String(Math.floor((liveSeconds % 3600) / 60)).padStart(2,'0')}:{String(liveSeconds % 60).padStart(2,'0')}
          </Text>
        </View>
        <TouchableOpacity onPress={endLive} style={styles.endBtn} activeOpacity={0.8}>
          <Text style={styles.endBtnText}>Terminer</Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <View style={styles.titleOverlay}>
        <Text style={styles.liveTitle}>{title}</Text>
      </View>

      {/* Chat */}
      <View style={[styles.chatArea, { paddingBottom: insets.bottom + 70 }]}>
        {messages.slice(-8).map((m, i) => (
          <View key={m.id ?? `${m.timestamp}-${i}`} style={styles.chatMsg}>
            <Text style={styles.chatUser}>{m.user.display_name} </Text>
            <Text style={styles.chatText}>{m.text}</Text>
          </View>
        ))}
      </View>

      {/* Chat input */}
      {chatEnabled && (
        <View style={[styles.chatInputRow, { bottom: insets.bottom + 12 }]}>
          <TextInput
            style={styles.chatInput}
            value={chatText}
            onChangeText={setChatText}
            placeholder="Dis quelque chose..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            onSubmitEditing={sendChatMessage}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendChatMessage} activeOpacity={0.8}>
            <IcMail size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { bottom: insets.bottom + 80 }]}>
        <TouchableOpacity style={styles.ctrlBtn} onPress={toggleCamera} activeOpacity={0.8}>
          <IcRefresh size={20} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrlBtn} onPress={toggleChat} activeOpacity={0.8}>
          <IcMail size={18} color={chatEnabled ? COLORS.primary : COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Viewer list modal */}
      <Modal visible={showViewers} transparent animationType="slide" onRequestClose={() => setShowViewers(false)}>
        <TouchableOpacity style={styles.viewerModalBackdrop} activeOpacity={1} onPress={() => setShowViewers(false)}>
          <View style={[styles.viewerModal, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.viewerModalHandle} />
            <Text style={styles.viewerModalTitle}>Spectateurs ({viewerList.length})</Text>
            <FlatList
              data={viewerList}
              keyExtractor={v => v.id}
              renderItem={({ item: v }) => (
                <View style={styles.viewerRow}>
                  {v.avatar_url
                    ? <Image source={{ uri: v.avatar_url }} style={styles.viewerAvatar} />
                    : <View style={[styles.viewerAvatar, styles.viewerAvatarFb]}><Text style={{ color: '#fff', fontWeight: '700' }}>{v.display_name[0]?.toUpperCase()}</Text></View>
                  }
                  <View>
                    <Text style={styles.viewerName}>{v.display_name}</Text>
                    <Text style={styles.viewerHandle}>@{v.username}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.viewerEmpty}>Aucun spectateur</Text>}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  setupContainer: { flex: 1, backgroundColor: '#000' },
  preview: { ...StyleSheet.absoluteFill },
  setupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, marginBottom: 'auto' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 22 },
  setupTitle: { fontSize: FONT.size.lg, fontWeight: '700', color: COLORS.white },
  flipIcon: { fontSize: 22, color: COLORS.white },
  setupForm: { padding: SPACING.lg, gap: 16 },
  titleInput: { backgroundColor: 'rgba(0,0,0,0.5)', color: COLORS.white, borderRadius: RADIUS.md, padding: 14, fontSize: FONT.size.lg, fontWeight: '600', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: FONT.size.sm, color: 'rgba(255,255,255,0.7)' },
  catTextActive: { color: COLORS.white, fontWeight: '600' },
  goBtn: { backgroundColor: '#FF3B5C', borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center' },
  goBtnText: { fontSize: FONT.size.base, fontWeight: '700', color: COLORS.white },

  liveContainer: { flex: 1, backgroundColor: '#000' },
  liveHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, zIndex: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FF3B5C', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.white },
  liveBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  viewerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5 },
  viewerCount: { fontSize: FONT.size.sm, fontWeight: '700', color: COLORS.white },
  timerBadge: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 5 },
  timerText: { fontSize: 11, fontWeight: '700', color: COLORS.white, letterSpacing: 0.5, fontVariant: ['tabular-nums'] as any },
  endBtn: { marginLeft: 'auto', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#FF3B5C' },
  endBtnText: { fontSize: FONT.size.sm, fontWeight: '600', color: '#FF3B5C' },
  titleOverlay: { position: 'absolute', top: 90, left: 14, right: 80 },
  liveTitle: { fontSize: FONT.size.base, fontWeight: '700', color: COLORS.white, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  chatArea: { position: 'absolute', bottom: 0, left: 0, right: 100, padding: 14, gap: 6 },
  chatMsg: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  chatUser: { fontSize: 12, fontWeight: '700', color: COLORS.primaryLight },
  chatText: { fontSize: 12, color: COLORS.white },
  chatInputRow: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', gap: 8 },
  chatInput: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', color: COLORS.white, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: FONT.size.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { fontSize: 18, color: COLORS.white },
  controls: { position: 'absolute', right: 14, flexDirection: 'column', gap: 12 },
  ctrlBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  ctrlIcon: { fontSize: 20, color: COLORS.white },

  viewerModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  viewerModal: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', padding: 16 },
  viewerModalHandle: { width: 36, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  viewerModalTitle: { fontSize: FONT.size.base, fontWeight: '700', color: COLORS.white, marginBottom: 12 },
  viewerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  viewerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333' },
  viewerAvatarFb: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  viewerName: { fontSize: FONT.size.sm, fontWeight: '600', color: COLORS.white },
  viewerHandle: { fontSize: FONT.size.xs, color: 'rgba(255,255,255,0.5)' },
  viewerEmpty: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 20, fontSize: FONT.size.sm },
});
