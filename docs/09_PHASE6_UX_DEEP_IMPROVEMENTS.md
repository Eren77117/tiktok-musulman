# 09 — PHASE 6 : UX DEEP IMPROVEMENTS
## Tu es un ingénieur senior mobile + UX designer ayant travaillé sur TikTok
## Objectif : sensations physiques impossibles à distinguer de l'original

---

## PHILOSOPHIE DE CETTE PHASE

TikTok ne se distingue pas par ses features. Il se distingue par la **sensation**. Chaque milliseconde est optimisée. Chaque action a un retour physique. Chaque transition est pensée pour que l'utilisateur ne ressente jamais de friction.

Cette phase s'attaque à 6 axes :
1. Feed "Pour Toi" — fluidité absolue
2. Commentaires — contenu en soi
3. Profil — rétention maximale
4. Messages — WhatsApp + TikTok
5. Live — immersion totale
6. Recherche — discovery engine

---

## DEEP-01 : FEED "POUR TOI" — FLUIDITÉ ABSOLUE

### Objectif
Zéro écran noir. Zéro attente visible. Sensation de flux infini.

### 1.1 — Préchargement agressif (3 vidéos d'avance)

```typescript
// hooks/useAggressivePreloader.ts
import { useRef, useEffect } from 'react'
import Video from 'react-native-video'

interface PreloadEntry {
  url: string
  ref: React.RefObject<typeof Video>
}

export function useAggressivePreloader(
  videos: { video_url: string }[],
  currentIndex: number
) {
  const preloadRefs = useRef<Map<number, React.RefObject<any>>>(new Map())

  // Précharger indices currentIndex+1, +2, +3
  const preloadIndices = [
    currentIndex + 1,
    currentIndex + 2,
    currentIndex + 3,
  ].filter(i => i < videos.length)

  useEffect(() => {
    // Nettoyer les refs trop loin derrière
    preloadRefs.current.forEach((_, index) => {
      if (index < currentIndex - 1 || index > currentIndex + 3) {
        preloadRefs.current.delete(index)
      }
    })
  }, [currentIndex])

  const getPreloadRef = (index: number) => {
    if (!preloadRefs.current.has(index)) {
      preloadRefs.current.set(index, { current: null })
    }
    return preloadRefs.current.get(index)!
  }

  return { preloadIndices, getPreloadRef }
}
```

```tsx
// Dans FeedScreen — rendu des vidéos cachées pour préchargement
{preloadIndices.map(index => (
  <Video
    key={`preload-${videos[index]?.id}`}
    source={{ uri: videos[index]?.video_url }}
    style={{ width: 0, height: 0, position: 'absolute' }}
    paused={true}
    muted={true}
    repeat={false}
    bufferConfig={{
      minBufferMs: 5000,
      maxBufferMs: 15000,
      bufferForPlaybackMs: 2000,
      bufferForPlaybackAfterRebufferMs: 3000,
    }}
  />
))}
```

### 1.2 — Seuil auto-play 80% visibilité

```typescript
// Dans FeedScreen FlatList
const viewabilityConfig = useRef({
  itemVisiblePercentThreshold: 80, // 80% de la vidéo visible → play
  minimumViewTime: 0,              // Immédiat, pas d'attente
}).current

const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
  if (viewableItems.length > 0) {
    const topVisible = viewableItems[0]
    setCurrentIndex(topVisible.index)
    // Mise à jour immédiate — 0ms delay
    currentIndexRef.current = topVisible.index
  }
}, [])
```

### 1.3 — Pause instantanée 0ms

```typescript
// Dans VideoPlayerItem — pause doit être synchrone
// PAS de setTimeout, PAS de debounce sur la pause
// La vidéo doit s'arrêter dans le même frame que le scroll

const shouldPlay = useMemo(() => {
  return isCurrentVideo && !isPaused && !isBuffering
}, [isCurrentVideo, isPaused, isBuffering])

// Utiliser paused prop directement — react-native-video respecte ce prop synchronement
<Video
  paused={!shouldPlay}  // Changement immédiat
  // ...
/>
```

### 1.4 — Auto-replay si durée < 10 secondes

```typescript
// Dans VideoPlayerItem
const handleVideoEnd = useCallback(() => {
  if (videoDuration <= 10) {
    // Replay automatique immédiat
    videoRef.current?.seek(0)
    // Ne pas mettre paused = true, laisser la vidéo repartir
    return
  }
  // Vidéo longue : incrémenter rewatchCount si l'utilisateur reste
  trackEnd()
}, [videoDuration])

<Video
  onEnd={handleVideoEnd}
  repeat={videoDuration <= 10} // Prop repeat pour les courtes vidéos
  // ...
/>
```

### 1.5 — Tracking vitesse de scroll (comportement)

```typescript
// Dans FeedScreen — détecter scroll rapide vs lent
const lastScrollTime = useRef(Date.now())
const lastScrollOffset = useRef(0)
const scrollSpeedRef = useRef<'fast' | 'slow' | 'normal'>('normal')

const onScroll = useCallback((event: any) => {
  const now = Date.now()
  const currentOffset = event.nativeEvent.contentOffset.y
  const delta = Math.abs(currentOffset - lastScrollOffset.current)
  const elapsed = now - lastScrollTime.current

  if (elapsed > 0) {
    const speed = delta / elapsed // px/ms
    if (speed > 2) {
      scrollSpeedRef.current = 'fast'
    } else if (speed < 0.5) {
      scrollSpeedRef.current = 'slow'
    } else {
      scrollSpeedRef.current = 'normal'
    }
  }

  lastScrollOffset.current = currentOffset
  lastScrollTime.current = now
}, [])

// Transmettre au tracker analytics
// scroll_speed: scrollSpeedRef.current à l'envoi batch
```

### 1.6 — Zéro écran noir entre vidéos

```typescript
// VideoPlayerItem — toujours afficher le thumbnail pendant le chargement
// Le thumbnail ne disparaît QUE quand la vidéo est prête à jouer (onReadyForDisplay)

const [videoReady, setVideoReady] = useState(false)

const handleReadyForDisplay = useCallback(() => {
  setVideoReady(true)
  // Fade out le thumbnail avec une transition douce
  Animated.timing(thumbnailOpacity, {
    toValue: 0,
    duration: 150, // 150ms fade — assez rapide pour être invisible
    useNativeDriver: true,
  }).start()
}, [])

// Rendu
<View style={StyleSheet.absoluteFill}>
  {/* Video toujours montée */}
  <Video
    onReadyForDisplay={handleReadyForDisplay}
    // ...
  />
  
  {/* Thumbnail en overlay, fade out quand prêt */}
  <Animated.Image
    source={{ uri: post.thumbnail_url }}
    style={[StyleSheet.absoluteFill, { opacity: thumbnailOpacity }]}
    resizeMode="cover"
  />
</View>
```

---

## DEEP-02 : COMMENTAIRES — CONTENU EN SOI

### Objectif
Les commentaires doivent être aussi engageants que les vidéos.

### 2.1 — Tri intelligent (likes + réponses + récence)

```typescript
// Backend — GET /posts/:id/comments?sort=smart
// Formule : score = likes*3 + reply_count*5 + (1 / (ageHours + 1))

router.get('/posts/:id/comments', async (req, reply) => {
  const { sort = 'smart', cursor, limit = 20 } = req.query as any
  const postId = req.params.id

  let orderBy: any
  if (sort === 'likes') {
    orderBy = { likes_count: 'desc' }
  } else if (sort === 'recent') {
    orderBy = { created_at: 'desc' }
  } else {
    // Smart sort : calculé en mémoire après fetch
    orderBy = { created_at: 'desc' }
  }

  const comments = await prisma.comment.findMany({
    where: { post_id: postId, parent_id: null },
    include: {
      user: { select: { id: true, username: true, avatar_url: true } },
      _count: { select: { replies: true } },
    },
    orderBy,
    take: parseInt(limit) + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
  })

  if (sort === 'smart') {
    const now = Date.now()
    comments.sort((a, b) => {
      const ageA = (now - new Date(a.created_at).getTime()) / 3600000
      const ageB = (now - new Date(b.created_at).getTime()) / 3600000
      const scoreA = a.likes_count * 3 + a._count.replies * 5 + 1 / (ageA + 1)
      const scoreB = b.likes_count * 3 + b._count.replies * 5 + 1 / (ageB + 1)
      return scoreB - scoreA
    })
  }

  const hasNext = comments.length > parseInt(limit)
  return reply.send({
    comments: comments.slice(0, parseInt(limit)),
    nextCursor: hasNext ? comments[parseInt(limit) - 1].id : null,
  })
})
```

### 2.2 — Réponses inline avec indentation légère

```tsx
// CommentsBottomSheet — CommentItem avec réponses expandables
interface CommentItemProps {
  comment: Comment
  onReply: (comment: Comment) => void
  depth?: number // 0 = root, 1 = reply (max 1 niveau)
}

function CommentItem({ comment, onReply, depth = 0 }: CommentItemProps) {
  const { colors } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const [replies, setReplies] = useState<Comment[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)

  const loadReplies = async () => {
    if (loadingReplies) return
    setLoadingReplies(true)
    try {
      const data = await api.get(`/comments/${comment.id}/replies`)
      setReplies(data.replies)
      setExpanded(true)
    } finally {
      setLoadingReplies(false)
    }
  }

  return (
    <View style={{ marginLeft: depth === 1 ? 44 : 0 }}>
      {/* Avatar + contenu */}
      <View style={styles.commentRow}>
        <Avatar uri={comment.user.avatar_url} size={depth === 0 ? 36 : 28} />
        <View style={styles.commentContent}>
          <Text style={[styles.username, { color: colors.text.primary }]}>
            {comment.user.username}
          </Text>
          <Text style={{ color: colors.text.secondary }}>{comment.text}</Text>
          
          {/* Actions */}
          <View style={styles.commentActions}>
            <Text style={styles.timestamp}>{formatRelative(comment.created_at)}</Text>
            <TouchableOpacity onPress={() => onReply(comment)}>
              <Text style={{ color: colors.text.tertiary }}>Répondre</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Like count */}
        <View style={styles.likeCol}>
          <LikeButton commentId={comment.id} count={comment.likes_count} />
        </View>
      </View>

      {/* "Voir X réponses" */}
      {comment._count?.replies > 0 && !expanded && (
        <TouchableOpacity
          style={styles.expandReplies}
          onPress={loadReplies}
        >
          {loadingReplies ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={{ color: colors.primary }}>
              ▸ Voir {comment._count.replies} réponse{comment._count.replies > 1 ? 's' : ''}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Réponses expandées */}
      {expanded && replies.map(reply => (
        <CommentItem
          key={reply.id}
          comment={reply}
          onReply={onReply}
          depth={1}
        />
      ))}
    </View>
  )
}
```

### 2.3 — Épingler un commentaire (créateur seulement)

```typescript
// Backend — PATCH /comments/:id/pin
router.patch('/comments/:id/pin', { preHandler: [authenticate] }, async (req, reply) => {
  const comment = await prisma.comment.findUnique({
    where: { id: req.params.id },
    include: { post: true },
  })
  if (!comment) return reply.code(404).send({ error: 'Comment not found' })
  if (comment.post.user_id !== req.user.id) {
    return reply.code(403).send({ error: 'Only the creator can pin' })
  }

  // Dépingler l'ancien
  await prisma.comment.updateMany({
    where: { post_id: comment.post_id, is_pinned: true },
    data: { is_pinned: false },
  })

  // Épingler le nouveau
  const pinned = await prisma.comment.update({
    where: { id: req.params.id },
    data: { is_pinned: true },
  })
  return reply.send(pinned)
})
```

```tsx
// Affichage dans CommentsBottomSheet — commentaire épinglé en premier
// Prisma: orderBy: [{ is_pinned: 'desc' }, { smart_score: 'desc' }]

{comment.is_pinned && (
  <View style={styles.pinnedBadge}>
    <IcPin size={12} color={colors.primary} />
    <Text style={{ color: colors.primary, fontSize: 11 }}>Épinglé par le créateur</Text>
  </View>
)}
```

### 2.4 — Ouverture instantanée avec préchargement en arrière-plan

```typescript
// Dans VideoPlayerItem — précharger les commentaires avant ouverture
const commentsQuery = useQuery({
  queryKey: ['comments', post.id, 'smart'],
  queryFn: () => api.get(`/posts/${post.id}/comments?sort=smart&limit=20`),
  enabled: false, // Pas de fetch automatique
  staleTime: 30_000,
})

// Précharger au hover/longpress sur l'icône commentaire
const handleCommentHover = useCallback(() => {
  commentsQuery.refetch()
}, [])

// Ouvrir la sheet — données déjà en cache si préchargées
const handleOpenComments = useCallback(() => {
  if (!commentsQuery.isFetched) {
    commentsQuery.refetch()
  }
  setShowComments(true)
}, [commentsQuery])

// Sur l'icône commentaire :
<AnimatedPressable
  onPressIn={handleCommentHover}  // Préchargement dès le touch
  onPress={handleOpenComments}
>
  <IcMessageCircle />
</AnimatedPressable>
```

---

## DEEP-03 : PROFIL — RÉTENTION MAXIMALE

### Objectif
L'utilisateur doit vouloir rester sur un profil, pas juste le parcourir.

### 3.1 — Aperçu vidéo au long-press (auto-play muet)

```tsx
// Dans le composant PostThumb du profil
function PostThumb({ post, onPress }: { post: Post; onPress: () => void }) {
  const [previewing, setPreviewing] = useState(false)
  const longPressTimer = useRef<NodeJS.Timeout>()
  const scaleAnim = useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    longPressTimer.current = setTimeout(() => {
      setPreviewing(true)
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        stiffness: 400,
        damping: 30,
      }).start()
    }, 350) // 350ms = long press
  }

  const handlePressOut = () => {
    clearTimeout(longPressTimer.current)
    if (previewing) {
      setPreviewing(false)
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 500,
        damping: 35,
      }).start()
    } else {
      onPress()
    }
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
        {/* Thumbnail normal */}
        <Image source={{ uri: post.thumbnail_url }} style={styles.thumb} />

        {/* Overlay vidéo en preview */}
        {previewing && (
          <Video
            source={{ uri: post.video_url }}
            style={StyleSheet.absoluteFill}
            paused={false}
            muted={true}
            repeat={true}
            resizeMode="cover"
          />
        )}

        {/* Overlay gradient + stats */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.gradient}
        >
          <IcPlay size={12} color="white" />
          <Text style={styles.viewCount}>{formatCount(post.view_count)}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  )
}
```

### 3.2 — Bouton "S'abonner" sticky pendant le scroll

```tsx
// Dans UserProfileScreen — sticky follow button
function UserProfileScreen() {
  const { colors } = useTheme()
  const scrollY = useRef(new Animated.Value(0)).current
  
  // Afficher le sticky button quand on scroll après le header
  const HEADER_HEIGHT = 280
  const stickyVisible = useRef(new Animated.Value(0)).current

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const y = event.nativeEvent.contentOffset.y
        Animated.timing(stickyVisible, {
          toValue: y > HEADER_HEIGHT ? 1 : 0,
          duration: 200,
          useNativeDriver: true,
        }).start()
      },
    }
  )

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView onScroll={handleScroll} scrollEventThrottle={16}>
        {/* Header profil normal */}
        <ProfileHeader user={user} />
        
        {/* Contenu */}
        <ProfileContent user={user} />
      </Animated.ScrollView>

      {/* Sticky follow button en haut */}
      <Animated.View
        style={[
          styles.stickyFollow,
          {
            opacity: stickyVisible,
            transform: [
              {
                translateY: stickyVisible.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-60, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={/* visible */ 'auto'}
      >
        <View style={styles.stickyFollowInner}>
          <Avatar uri={user.avatar_url} size={28} />
          <Text style={styles.stickyUsername}>@{user.username}</Text>
          <FollowButton userId={user.id} compact />
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  stickyFollow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 100,
  },
  stickyFollowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
})
```

### 3.3 — Section "Comptes similaires" en bas du profil

```tsx
// Après la grille vidéos — SimilarAccounts component
function SimilarAccounts({ userId }: { userId: string }) {
  const { colors } = useTheme()
  const { data } = useQuery({
    queryKey: ['similar-accounts', userId],
    queryFn: () => api.get(`/users/${userId}/similar`),
    staleTime: 5 * 60_000,
  })

  if (!data?.users?.length) return null

  return (
    <View style={styles.similarSection}>
      <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
        Comptes similaires
      </Text>
      <FlatList
        horizontal
        data={data.users}
        keyExtractor={u => u.id}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <SimilarAccountCard user={item} />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      />
    </View>
  )
}

function SimilarAccountCard({ user }: { user: User }) {
  const { colors } = useTheme()
  const navigation = useNavigation()
  
  return (
    <Pressable
      style={styles.similarCard}
      onPress={() => navigation.navigate('UserProfileScreen', { userId: user.id })}
    >
      <Avatar uri={user.avatar_url} size={56} />
      <Text style={styles.similarUsername} numberOfLines={1}>@{user.username}</Text>
      <Text style={styles.similarFollowers}>
        {formatCount(user.followers_count)} abonnés
      </Text>
      <FollowButton userId={user.id} compact style={styles.similarFollowBtn} />
    </Pressable>
  )
}
```

```typescript
// Backend — GET /users/:id/similar
// Algo : mêmes catégories de contenus + réseau commun (amis de followers)
router.get('/users/:id/similar', async (req, reply) => {
  const targetId = req.params.id

  // Récupérer les catégories/hashtags fréquents de ce créateur
  const topHashtags = await prisma.post.findMany({
    where: { user_id: targetId },
    select: { hashtags: true },
    take: 20,
    orderBy: { view_count: 'desc' },
  })

  const tagSet = new Set<string>()
  topHashtags.forEach(p => p.hashtags?.forEach((t: string) => tagSet.add(t)))
  const tags = Array.from(tagSet).slice(0, 5)

  // Trouver des créateurs avec les mêmes hashtags
  const similar = await prisma.user.findMany({
    where: {
      id: { not: targetId },
      posts: {
        some: {
          hashtags: { hasSome: tags },
        },
      },
    },
    select: {
      id: true,
      username: true,
      avatar_url: true,
      _count: { select: { followers: true } },
    },
    take: 10,
    orderBy: { followers: { _count: 'desc' } },
  })

  return reply.send({
    users: similar.map(u => ({
      ...u,
      followers_count: u._count.followers,
    })),
  })
})
```

### 3.4 — Grille profil optimisée (FlatList avec getItemLayout)

```tsx
// ProfileGrid.tsx — grille 3 colonnes hyper-performante
const GAP = 1.5
const THUMB_SIZE = (Dimensions.get('window').width - GAP * 2) / 3

function ProfileGrid({ userId }: { userId: string }) {
  const query = useInfiniteQuery({
    queryKey: ['profile-posts', userId],
    queryFn: ({ pageParam }) =>
      api.get(`/users/${userId}/posts?cursor=${pageParam || ''}&limit=30`),
    getNextPageParam: (last: any) => last.nextCursor,
    staleTime: 2 * 60_000,
  })

  const posts = query.data?.pages.flatMap(p => p.posts) ?? []

  const getItemLayout = useCallback(
    (_: any, index: number) => {
      const row = Math.floor(index / 3)
      return {
        length: THUMB_SIZE + GAP,
        offset: row * (THUMB_SIZE + GAP),
        index,
      }
    },
    []
  )

  const renderItem = useCallback(
    ({ item }: { item: Post }) => (
      <PostThumb post={item} onPress={() => openPost(item)} />
    ),
    []
  )

  return (
    <FlatList
      data={posts}
      numColumns={3}
      keyExtractor={p => p.id}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      removeClippedSubviews={true}
      maxToRenderPerBatch={9} // 3 lignes
      windowSize={7}
      onEndReached={() => query.fetchNextPage()}
      onEndReachedThreshold={0.5}
      columnWrapperStyle={{ gap: GAP }}
      ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
    />
  )
}
```

---

## DEEP-04 : MESSAGES — WHATSAPP + TIKTOK

### Objectif
Messagerie fluide avec les standards 2024 : typing, read receipts, voice, media, swipe reply.

### 4.1 — Typing indicator (disparaît après 2s d'inactivité)

```typescript
// ConversationScreen — envoi du typing indicator avec debounce
const typingTimeout = useRef<NodeJS.Timeout>()
const isTypingRef = useRef(false)

const handleTextChange = useCallback((text: string) => {
  setInputText(text)
  
  if (!isTypingRef.current) {
    isTypingRef.current = true
    socket.emit('typing:start', { conversationId })
  }

  clearTimeout(typingTimeout.current)
  typingTimeout.current = setTimeout(() => {
    isTypingRef.current = false
    socket.emit('typing:stop', { conversationId })
  }, 2000) // Arrêt automatique après 2s
}, [conversationId])

// Cleanup
useEffect(() => {
  return () => {
    clearTimeout(typingTimeout.current)
    if (isTypingRef.current) {
      socket.emit('typing:stop', { conversationId })
    }
  }
}, [])
```

```tsx
// TypingIndicator component
function TypingIndicator({ isVisible }: { isVisible: boolean }) {
  const { colors } = useTheme()
  const dot1 = useRef(new Animated.Value(0)).current
  const dot2 = useRef(new Animated.Value(0)).current
  const dot3 = useRef(new Animated.Value(0)).current
  const containerOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(containerOpacity, {
      toValue: isVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start()

    if (isVisible) {
      const bounce = (dot: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dot, { toValue: -6, duration: 200, useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.delay(400),
          ])
        )

      const a1 = bounce(dot1, 0)
      const a2 = bounce(dot2, 150)
      const a3 = bounce(dot3, 300)
      a1.start(); a2.start(); a3.start()

      return () => { a1.stop(); a2.stop(); a3.stop() }
    }
  }, [isVisible])

  return (
    <Animated.View style={[styles.typingContainer, { opacity: containerOpacity }]}>
      <View style={styles.typingBubble}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { transform: [{ translateY: dot }], backgroundColor: colors.text.tertiary }]}
          />
        ))}
      </View>
    </Animated.View>
  )
}
```

### 4.2 — Double-tick read receipts temps réel

```typescript
// Backend Socket.IO — émettre 'message:read' quand l'utilisateur ouvre la conversation
socket.on('conversation:open', async ({ conversationId }) => {
  const userId = socket.data.userId
  
  // Marquer tous les messages non lus comme lus
  const updated = await prisma.message.updateMany({
    where: {
      conversation_id: conversationId,
      user_id: { not: userId },
      read_at: null,
    },
    data: { read_at: new Date() },
  })

  if (updated.count > 0) {
    // Notifier l'expéditeur
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    })
    
    const senderId = conversation?.participants.find(p => p.user_id !== userId)?.user_id
    if (senderId) {
      const senderSocket = io.sockets.sockets.get(userSockets.get(senderId) || '')
      senderSocket?.emit('messages:read', { conversationId, readBy: userId })
    }
  }
})
```

```tsx
// MessageBubble — affichage double-tick
function MessageStatusIcon({ message, isMine }: { message: Message; isMine: boolean }) {
  const { colors } = useTheme()
  if (!isMine) return null

  if (message.read_at) {
    // Lu — double tick vert
    return (
      <View style={styles.tickContainer}>
        <IcCheck size={12} color={colors.primary} />
        <IcCheck size={12} color={colors.primary} style={{ marginLeft: -6 }} />
      </View>
    )
  }

  if (message.delivered_at) {
    // Délivré — double tick gris
    return (
      <View style={styles.tickContainer}>
        <IcCheck size={12} color={colors.text.tertiary} />
        <IcCheck size={12} color={colors.text.tertiary} style={{ marginLeft: -6 }} />
      </View>
    )
  }

  // Envoyé — tick unique gris
  return <IcCheck size={12} color={colors.text.tertiary} />
}
```

### 4.3 — Messages vocaux (hold-to-record)

```typescript
// Installation requise : npm install react-native-audio-recorder-player
// Voir ADV-07 dans 08_PHASE5_FEATURES_AVANCEES.md pour le composant complet

// Résumé du flow :
// 1. onPressIn → AudioRecorderPlayer.startRecorder()
// 2. Vibration + animation croissante pendant l'enregistrement
// 3. onPressOut → stopRecorder() → upload Cloudinary → sendMessage avec audio_url
// 4. Glisser vers la gauche pendant hold → annuler

// VoiceRecordButton.tsx — voir fichier 08 pour le code complet
```

### 4.4 — Aperçu image/vidéo dans le chat

```tsx
// MediaMessage component — aperçu inline
function MediaMessage({ message }: { message: Message }) {
  const { colors } = useTheme()
  const navigation = useNavigation()

  if (message.media_type === 'image') {
    return (
      <Pressable
        onPress={() => navigation.navigate('MediaViewer', { uri: message.media_url })}
      >
        <Image
          source={{ uri: message.media_url }}
          style={styles.mediaPreview}
          resizeMode="cover"
        />
      </Pressable>
    )
  }

  if (message.media_type === 'video') {
    return (
      <Pressable
        onPress={() => navigation.navigate('MediaViewer', { uri: message.media_url })}
      >
        <View style={styles.videoPreview}>
          <Image source={{ uri: message.thumbnail_url }} style={StyleSheet.absoluteFill} />
          <View style={styles.playOverlay}>
            <IcPlay size={32} color="white" fill="white" />
          </View>
          <Text style={styles.videoDuration}>{formatDuration(message.duration_s)}</Text>
        </View>
      </Pressable>
    )
  }

  return null
}

// Envoi média dans ConversationScreen
const handleSendMedia = async () => {
  const result = await launchImageLibrary({ mediaType: 'mixed' })
  if (!result.assets?.[0]) return

  const asset = result.assets[0]
  const isVideo = asset.type?.startsWith('video')

  // Upload Cloudinary
  const formData = new FormData()
  formData.append('file', { uri: asset.uri, type: asset.type, name: asset.fileName } as any)
  const { url, thumbnail_url, duration } = await api.upload(
    isVideo ? '/upload/video' : '/upload/image',
    formData
  )

  // Envoyer le message
  sendMessageMutation.mutate({
    conversationId,
    media_url: url,
    media_type: isVideo ? 'video' : 'image',
    thumbnail_url,
    duration_s: duration,
  })
}
```

### 4.5 — Swipe-to-reply avec feedback visuel

```tsx
// SwipeableMessage.tsx
import { PanResponder } from 'react-native'

function SwipeableMessage({ message, onReply, children }: SwipeableProps) {
  const translateX = useRef(new Animated.Value(0)).current
  const replyIconScale = useRef(new Animated.Value(0)).current
  const REPLY_THRESHOLD = 60

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        // Seulement vers la droite
        if (gs.dx > 0) {
          const clamped = Math.min(gs.dx, 80)
          translateX.setValue(clamped)
          
          // Scale de l'icône reply proportionnelle au swipe
          const progress = Math.min(clamped / REPLY_THRESHOLD, 1)
          replyIconScale.setValue(progress)
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx >= REPLY_THRESHOLD) {
          onReply(message)
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        }
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          stiffness: 500,
          damping: 40,
        }).start()
        Animated.timing(replyIconScale, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start()
      },
    })
  ).current

  return (
    <View style={styles.swipeContainer}>
      {/* Icône reply qui apparaît derrière */}
      <Animated.View
        style={[
          styles.replyIcon,
          { transform: [{ scale: replyIconScale }] },
        ]}
      >
        <IcCornerUpLeft size={20} color={colors.text.tertiary} />
      </Animated.View>

      {/* Message qui slide */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  )
}
```

---

## DEEP-05 : LIVE — IMMERSION TOTALE

### Objectif
Le live doit être une expérience communautaire, pas juste une vidéo.

### 5.1 — Cœurs flottants à positions aléatoires

```tsx
// FloatingHeartsOverlay.tsx — gestion du pool de cœurs
interface FloatingHeart {
  id: string
  x: number // position horizontale aléatoire
  color: string
}

const HEART_COLORS = ['#FF3B6F', '#FF6B3B', '#FFD93D', '#6BCB77', '#4D96FF']

function FloatingHeartsOverlay({ hearts }: { hearts: FloatingHeart[] }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {hearts.map(heart => (
        <FloatingHeartItem key={heart.id} heart={heart} />
      ))}
    </View>
  )
}

function FloatingHeartItem({ heart }: { heart: FloatingHeart }) {
  const translateY = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  const scale = useRef(new Animated.Value(0)).current
  const rotate = useRef(new Animated.Value(heart.x % 2 === 0 ? -0.3 : 0.3)).current

  useEffect(() => {
    Animated.parallel([
      // Apparition
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 600,
        damping: 15,
      }),
      // Montée
      Animated.timing(translateY, {
        toValue: -300 - Math.random() * 100,
        duration: 2500 + Math.random() * 1000,
        useNativeDriver: true,
      }),
      // Rotation légère
      Animated.sequence([
        Animated.timing(rotate, {
          toValue: -rotate._value,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: rotate._value,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Fade out à la fin
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }, [])

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 100,
        left: heart.x,
        transform: [
          { translateY },
          { scale },
          { rotate: rotate.interpolate({ inputRange: [-1, 1], outputRange: ['-20deg', '20deg'] }) },
        ],
        opacity,
      }}
    >
      <IcHeart size={32} color={heart.color} fill={heart.color} />
    </Animated.View>
  )
}

// Dans LiveScreen — ajouter un cœur au tap ou via socket
const [hearts, setHearts] = useState<FloatingHeart[]>([])

const addHeart = useCallback((color?: string) => {
  const SCREEN_W = Dimensions.get('window').width
  const newHeart: FloatingHeart = {
    id: `heart-${Date.now()}-${Math.random()}`,
    x: 20 + Math.random() * (SCREEN_W - 80), // Toute la largeur
    color: color || HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
  }
  setHearts(prev => [...prev.slice(-20), newHeart]) // Max 20 cœurs simultanés
  
  // Cleanup après animation
  setTimeout(() => {
    setHearts(prev => prev.filter(h => h.id !== newHeart.id))
  }, 3500)
}, [])
```

### 5.2 — Réactions temps réel (visibles par tous)

```typescript
// Backend Socket.IO — diffuser les réactions à tous les viewers
socket.on('live:react', async ({ liveId, reaction }) => {
  // reaction: '❤️' | '🔥' | '😂' | '👏' | '😮'
  io.to(`live:${liveId}`).emit('live:reaction', {
    userId: socket.data.userId,
    reaction,
    username: socket.data.username,
  })
})
```

```tsx
// LiveReactionBar.tsx — barre de réactions rapides
const REACTIONS = ['❤️', '🔥', '😂', '👏', '😮']

function LiveReactionBar({ liveId }: { liveId: string }) {
  const { socket } = useSocket()
  const [cooldown, setCooldown] = useState(false)

  const sendReaction = (reaction: string) => {
    if (cooldown) return
    socket.emit('live:react', { liveId, reaction })
    setCooldown(true)
    setTimeout(() => setCooldown(false), 500) // Cooldown 500ms par type
  }

  return (
    <View style={styles.reactionBar}>
      {REACTIONS.map(r => (
        <AnimatedPressable
          key={r}
          onPress={() => sendReaction(r)}
          style={[styles.reactionBtn, cooldown && styles.reactionBtnDisabled]}
        >
          <Text style={styles.reactionEmoji}>{r}</Text>
        </AnimatedPressable>
      ))}
    </View>
  )
}
```

### 5.3 — Badges viewers (Top / Loyal / Modérateur)

```tsx
// LiveCommentItem — afficher les badges
function LiveCommentItem({ comment }: { comment: LiveComment }) {
  const { colors } = useTheme()
  
  const getBadge = () => {
    if (comment.user.is_moderator) return { label: 'MOD', color: '#4D96FF' }
    if (comment.user.live_rank === 'top') return { label: 'TOP', color: '#FFD700' }
    if (comment.user.live_rank === 'loyal') return { label: 'LOYAL', color: colors.primary }
    return null
  }

  const badge = getBadge()

  return (
    <View style={styles.liveComment}>
      <Avatar uri={comment.user.avatar_url} size={24} />
      {badge && (
        <View style={[styles.badge, { backgroundColor: badge.color }]}>
          <Text style={styles.badgeText}>{badge.label}</Text>
        </View>
      )}
      <Text style={styles.commentUsername}>{comment.user.username}</Text>
      <Text style={styles.commentText}>{comment.text}</Text>
    </View>
  )
}
```

```typescript
// Backend — calculer le rang live_rank basé sur l'historique
// live_rank = 'top' si dans le top 3 des viewers les plus actifs de ce créateur
// live_rank = 'loyal' si a regardé > 5 lives de ce créateur
async function getLiveRank(viewerId: string, creatorId: string) {
  const watchHistory = await prisma.liveWatchHistory.count({
    where: { viewer_id: viewerId, live: { creator_id: creatorId } },
  })
  
  if (watchHistory >= 5) return 'loyal'
  
  const topViewers = await prisma.liveWatchHistory.groupBy({
    by: ['viewer_id'],
    where: { live: { creator_id: creatorId } },
    _count: { viewer_id: true },
    orderBy: { _count: { viewer_id: 'desc' } },
    take: 3,
  })
  
  if (topViewers.some(t => t.viewer_id === viewerId)) return 'top'
  return null
}
```

### 5.4 — Modération (mute/ban/slow mode)

```typescript
// Backend — PATCH /lives/:id/moderation
router.patch('/lives/:id/moderation', { preHandler: [authenticate] }, async (req, reply) => {
  const { action, userId, duration } = req.body as any
  // action: 'mute' | 'ban' | 'slow_mode'
  
  const live = await prisma.live.findUnique({ where: { id: req.params.id } })
  if (live?.creator_id !== req.user.id) {
    return reply.code(403).send({ error: 'Only creator can moderate' })
  }

  if (action === 'mute') {
    await prisma.liveMute.create({
      data: {
        live_id: req.params.id,
        user_id: userId,
        expires_at: new Date(Date.now() + (duration || 300) * 1000),
      },
    })
    io.to(`live:${req.params.id}`).emit('live:user_muted', { userId })
  }

  if (action === 'ban') {
    await prisma.liveBan.create({
      data: { live_id: req.params.id, user_id: userId },
    })
    // Déconnecter l'utilisateur banni du room
    const bannedSocket = io.sockets.sockets.get(userSockets.get(userId) || '')
    bannedSocket?.leave(`live:${req.params.id}`)
    bannedSocket?.emit('live:banned', { liveId: req.params.id })
  }

  if (action === 'slow_mode') {
    await prisma.live.update({
      where: { id: req.params.id },
      data: { slow_mode_seconds: duration || 5 },
    })
    io.to(`live:${req.params.id}`).emit('live:slow_mode', { seconds: duration || 5 })
  }

  return reply.send({ success: true })
})
```

### 5.5 — Compteur viewers animé

```tsx
// ViewerCountBadge.tsx — compte qui pulse à chaque changement
function ViewerCountBadge({ count }: { count: number }) {
  const { colors } = useTheme()
  const scale = useRef(new Animated.Value(1)).current
  const prevCount = useRef(count)

  useEffect(() => {
    if (count !== prevCount.current) {
      prevCount.current = count
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.2, useNativeDriver: true, stiffness: 600 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, stiffness: 400 }),
      ]).start()
    }
  }, [count])

  return (
    <Animated.View
      style={[styles.badge, { backgroundColor: 'rgba(0,0,0,0.5)', transform: [{ scale }] }]}
    >
      <IcEye size={14} color="white" />
      <Text style={styles.countText}>{formatCount(count)}</Text>
    </Animated.View>
  )
}
```

---

## DEEP-06 : RECHERCHE — DISCOVERY ENGINE

### Objectif
La recherche doit donner envie d'explorer, pas juste trouver quelque chose de précis.

### 6.1 — Suggestions instantanées avec debounce 200ms

```tsx
// ExploreScreen — search suggestions en temps réel
function SearchSuggestions({ query }: { query: string }) {
  const { colors } = useTheme()
  const debouncedQuery = useDebounce(query, 200) // 200ms debounce

  const { data: suggestions } = useQuery({
    queryKey: ['search-suggestions', debouncedQuery],
    queryFn: () => api.get(`/search/suggestions?q=${debouncedQuery}`),
    enabled: debouncedQuery.length >= 2,
    staleTime: 10_000,
  })

  if (!suggestions?.items?.length) return null

  return (
    <View style={styles.suggestionsContainer}>
      {suggestions.items.map((item: SearchSuggestion) => (
        <Pressable key={item.id} style={styles.suggestionRow} onPress={() => applySearch(item)}>
          {item.type === 'hashtag' ? (
            <IcHash size={16} color={colors.text.tertiary} />
          ) : item.type === 'user' ? (
            <Avatar uri={item.avatar_url} size={24} />
          ) : (
            <IcSearch size={16} color={colors.text.tertiary} />
          )}
          <Text style={[styles.suggestionText, { color: colors.text.primary }]}>
            {item.label}
          </Text>
          {item.type === 'hashtag' && (
            <Text style={styles.hashtagCount}>{formatCount(item.video_count)} vidéos</Text>
          )}
        </Pressable>
      ))}
    </View>
  )
}

// Hook debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
```

```typescript
// Backend — GET /search/suggestions?q=
router.get('/search/suggestions', async (req, reply) => {
  const { q } = req.query as any
  if (!q || q.length < 2) return reply.send({ items: [] })

  const [users, hashtags] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { username: { startsWith: q, mode: 'insensitive' } },
          { display_name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, avatar_url: true, _count: { select: { followers: true } } },
      orderBy: { followers: { _count: 'desc' } },
      take: 3,
    }),
    prisma.post.groupBy({
      by: ['hashtags'],
      where: { hashtags: { has: q.toLowerCase() } },
    }).then(async () => {
      // Compter les occurrences de hashtags contenant q
      const tags = await prisma.$queryRaw<{ tag: string; count: number }[]>`
        SELECT unnest(hashtags) as tag, COUNT(*) as count
        FROM posts
        WHERE EXISTS (
          SELECT 1 FROM unnest(hashtags) t WHERE t ILIKE ${`%${q}%`}
        )
        GROUP BY tag
        HAVING unnest(hashtags) ILIKE ${`%${q}%`}
        ORDER BY count DESC
        LIMIT 5
      `
      return tags
    }),
  ])

  const items = [
    ...users.map(u => ({
      id: u.id,
      type: 'user',
      label: `@${u.username}`,
      avatar_url: u.avatar_url,
    })),
    ...hashtags.map(h => ({
      id: h.tag,
      type: 'hashtag',
      label: `#${h.tag}`,
      video_count: h.count,
    })),
  ]

  return reply.send({ items })
})
```

### 6.2 — Hashtags tendance dynamiques

```typescript
// Backend — GET /search/trending
// Calculer les hashtags les plus utilisés sur les dernières 24h
router.get('/search/trending', async (req, reply) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const trending = await prisma.$queryRaw<{ tag: string; count: number }[]>`
    SELECT unnest(hashtags) as tag, COUNT(*) as count
    FROM posts
    WHERE created_at > ${oneDayAgo}
      AND is_published = true
    GROUP BY tag
    ORDER BY count DESC
    LIMIT 15
  `

  return reply.send({ trending })
})
```

```tsx
// TrendingHashtags component dans DiscoveryView
function TrendingHashtags() {
  const { colors } = useTheme()
  const { data } = useQuery({
    queryKey: ['search-trending'],
    queryFn: () => api.get('/search/trending'),
    staleTime: 5 * 60_000, // 5 minutes
    refetchInterval: 5 * 60_000,
  })

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
        Tendances maintenant
      </Text>
      {data?.trending.map((item: any, index: number) => (
        <Pressable
          key={item.tag}
          style={styles.trendingRow}
          onPress={() => navigation.navigate('HashtagScreen', { tag: item.tag })}
        >
          <View style={[styles.trendingRank, { backgroundColor: index < 3 ? colors.primary : colors.surface }]}>
            <Text style={{ color: index < 3 ? 'white' : colors.text.primary, fontWeight: '700' }}>
              {index + 1}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.trendingTag, { color: colors.text.primary }]}>#{item.tag}</Text>
            <Text style={{ color: colors.text.tertiary }}>{formatCount(item.count)} vidéos</Text>
          </View>
          <IcChevronRight size={16} color={colors.text.tertiary} />
        </Pressable>
      ))}
    </View>
  )
}
```

### 6.3 — Historique local avec suppression item par item

```typescript
// useSearchHistory.ts
import AsyncStorage from '@react-native-async-storage/async-storage'

const HISTORY_KEY = 'nour_search_history'
const MAX_HISTORY = 15

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(raw => {
      if (raw) setHistory(JSON.parse(raw))
    })
  }, [])

  const addToHistory = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    const next = [trimmed, ...history.filter(h => h !== trimmed)].slice(0, MAX_HISTORY)
    setHistory(next)
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  }, [history])

  const removeFromHistory = useCallback(async (query: string) => {
    const next = history.filter(h => h !== query)
    setHistory(next)
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  }, [history])

  const clearHistory = useCallback(async () => {
    setHistory([])
    await AsyncStorage.removeItem(HISTORY_KEY)
  }, [])

  return { history, addToHistory, removeFromHistory, clearHistory }
}
```

```tsx
// SearchHistoryList component
function SearchHistoryList({
  history,
  onSelect,
  onRemove,
  onClear,
}: SearchHistoryProps) {
  const { colors } = useTheme()

  return (
    <View>
      <View style={styles.historyHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Recherches récentes</Text>
        <Pressable onPress={onClear}>
          <Text style={{ color: colors.primary }}>Tout effacer</Text>
        </Pressable>
      </View>
      {history.map(item => (
        <View key={item} style={styles.historyRow}>
          <Pressable style={styles.historyContent} onPress={() => onSelect(item)}>
            <IcClock size={16} color={colors.text.tertiary} />
            <Text style={[styles.historyText, { color: colors.text.primary }]}>{item}</Text>
          </Pressable>
          <Pressable onPress={() => onRemove(item)} hitSlop={12}>
            <IcX size={16} color={colors.text.tertiary} />
          </Pressable>
        </View>
      ))}
    </View>
  )
}
```

### 6.4 — Résultats intelligents (engagement + pertinence)

```typescript
// Backend — GET /search/results?q=&type=videos|users|hashtags
router.get('/search/results', async (req, reply) => {
  const { q, type = 'all', cursor, limit = 20 } = req.query as any

  if (type === 'users' || type === 'all') {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { display_name: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { _count: { select: { followers: true, posts: true } } },
      orderBy: { followers: { _count: 'desc' } },
      take: type === 'users' ? parseInt(limit) : 5,
    })
    if (type === 'users') return reply.send({ users })
  }

  if (type === 'videos' || type === 'all') {
    // Score = view_count * 0.3 + likes_count * 0.5 + comment_count * 0.2
    // + bonus récence : * (0.95 ^ ageHours)
    const videos = await prisma.$queryRaw<any[]>`
      SELECT p.*,
             u.username, u.avatar_url, u.display_name,
             (p.view_count * 0.3 + p.likes_count * 0.5 + p.comment_count * 0.2)
               * POWER(0.95, EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600)
             AS score
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.is_published = true
        AND (
          p.caption ILIKE ${'%' + q + '%'}
          OR ${'\\m' + q + '\\M'} = ANY(p.hashtags)
        )
      ORDER BY score DESC
      LIMIT ${parseInt(limit)}
    `
    if (type === 'videos') return reply.send({ videos })
  }

  return reply.send({ users: [], videos: [] })
})
```

---

## CHECKLIST PHASE 6

### DEEP-01 : Feed fluidité
- [ ] Préchargement 3 vidéos d'avance implémenté
- [ ] Seuil auto-play 80% visibilité
- [ ] Pause instantanée 0ms (pas de setTimeout)
- [ ] Auto-replay vidéos < 10s
- [ ] Tracking vitesse scroll (fast/slow/normal)
- [ ] Zéro écran noir (thumbnail jusqu'à onReadyForDisplay)

### DEEP-02 : Commentaires
- [ ] Tri intelligent (likes×3 + replies×5 + récence)
- [ ] Réponses inline depth=1 avec expand
- [ ] Épinglage créateur (PATCH /comments/:id/pin)
- [ ] Préchargement au pressIn sur l'icône
- [ ] `is_pinned` dans Prisma schema

### DEEP-03 : Profil rétention
- [ ] Long-press 350ms → aperçu vidéo muet
- [ ] Sticky follow button après header
- [ ] Section "Comptes similaires" (GET /users/:id/similar)
- [ ] ProfileGrid avec getItemLayout

### DEEP-04 : Messages
- [ ] Typing stop auto après 2s
- [ ] Double-tick lu (vert) / délivré (gris)
- [ ] Voice messages hold-to-record (voir DEEP-04.3)
- [ ] Aperçu image/vidéo inline
- [ ] Swipe-to-reply avec icône scaling

### DEEP-05 : Live
- [ ] Cœurs positions aléatoires (toute la largeur)
- [ ] Réactions temps réel Socket.IO (live:react)
- [ ] Badges MOD/TOP/LOYAL
- [ ] Modération mute/ban/slow-mode
- [ ] Compteur viewers animé (pulse au changement)

### DEEP-06 : Recherche
- [ ] Suggestions debounce 200ms
- [ ] Backend GET /search/suggestions
- [ ] Hashtags tendance 24h (GET /search/trending)
- [ ] Historique AsyncStorage avec suppression item
- [ ] Résultats triés par score engagement+pertinence

---

## PRISMA ADDITIONS POUR PHASE 6

```prisma
// Ajouter à schema.prisma

model LiveWatchHistory {
  id          String   @id @default(cuid())
  viewer_id   String
  live_id     String
  watched_at  DateTime @default(now())
  viewer      User     @relation(fields: [viewer_id], references: [id])
  live        Live     @relation(fields: [live_id], references: [id])
  @@unique([viewer_id, live_id])
}

model LiveMute {
  id         String   @id @default(cuid())
  live_id    String
  user_id    String
  expires_at DateTime
  created_at DateTime @default(now())
}

model LiveBan {
  id         String   @id @default(cuid())
  live_id    String
  user_id    String
  created_at DateTime @default(now())
  @@unique([live_id, user_id])
}
```

```bash
# Commande migration
npx prisma migrate dev --name phase6_live_moderation_watch_history
```

---

## NOTE FINALE

Cette phase est optionnelle si la Phase 5 (features avancées) n'est pas terminée. Mais si tu veux que Nour soit **indiscernable de TikTok** sur le plan des sensations, ces améliorations sont essentielles.

Priorité absolue dans cette phase :
1. **DEEP-01** (feed fluidité) — impact immédiat sur la rétention
2. **DEEP-04** (messages) — différenciateur fort
3. **DEEP-06** (recherche) — discovery = croissance organique
