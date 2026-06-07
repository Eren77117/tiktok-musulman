# 08 — PHASE 5 : FEATURES AVANCÉES & SYSTÈME INTELLIGENT
## Analytics invisible, algo auto-apprenant, admin panel, modération, live complet

---

## ✅ CHECKLIST PHASE 5

- [ ] ADV-01 : Mini analytics invisible (tracking batch)
- [ ] ADV-02 : Mode Série (playlist vidéos)
- [ ] ADV-03 : Pause intelligente (overlay discret)
- [ ] ADV-04 : Commentaires vidéo (répondre en vidéo)
- [ ] ADV-05 : Bio enrichie (liens, hashtags, catégories)
- [ ] ADV-06 : Recommandation comptes (algo)
- [ ] ADV-07 : Messages vocaux
- [ ] ADV-08 : Live complet (hearts, badges, modération, slow mode)
- [ ] ADV-09 : Search autocomplete + trending dynamique
- [ ] ADV-10 : Admin panel complet
- [ ] ADV-11 : Modération automatique (mots interdits, spam)
- [ ] ADV-12 : Notifications intelligentes + résumé journalier

---

## 📊 ADV-01 : Mini Analytics Invisible

### Concept
TikTok sait exactement combien de secondes tu as regardé chaque vidéo, combien de fois tu
l'as rewatchée, si tu as scrollé vite ou lentement. C'est la base de l'algorithme.
L'utilisateur ne voit RIEN — c'est 100% invisible.

### Schéma Prisma — table `user_video_analytics`

```prisma
model UserVideoAnalytics {
  id                  String   @id @default(cuid())
  user_id             String
  post_id             String
  session_id          String   // UUID de session (généré côté client)
  
  // Temps
  watch_time_ms       Int      // Millisecondes regardées (plus précis que secondes)
  time_before_scroll  Int      // Ms avant de scroller (intérêt initial)
  
  // Comportement
  completed           Boolean  @default(false)
  rewatch_count       Int      @default(0)
  pause_count         Int      @default(0)
  skip_rapid          Boolean  @default(false) // < 1500ms = skip
  
  // Interactions
  liked               Boolean  @default(false)
  like_delay_ms       Int?     // Ms entre entrée viewport et like
  commented           Boolean  @default(false)
  shared              Boolean  @default(false)
  saved               Boolean  @default(false)
  followed_creator    Boolean  @default(false)
  visited_profile     Boolean  @default(false)
  
  // Scroll
  scroll_speed        Float?   // px/ms (calculé côté client)
  
  // Contexte
  feed_position       Int?     // Position dans le feed (0=premier)
  network_quality     String?  // 'fast' | 'slow' | '4g' | 'wifi'
  
  created_at          DateTime @default(now())
  
  user                User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  post                Post     @relation(fields: [post_id], references: [id], onDelete: Cascade)
  
  @@index([user_id])
  @@index([post_id])
  @@index([created_at])
}
```

### Backend — Route `POST /analytics/batch`

```typescript
// backend/src/routes/analytics.ts

fastify.post('/analytics/batch', {
  preHandler: [authenticateOptional], // fonctionne même pour les non-connectés
  schema: {
    body: z.object({
      session_id: z.string(),
      events: z.array(z.object({
        post_id: z.string(),
        watch_time_ms: z.number().min(0).max(3_600_000),
        time_before_scroll: z.number().min(0),
        completed: z.boolean().default(false),
        rewatch_count: z.number().min(0).max(20),
        pause_count: z.number().min(0),
        skip_rapid: z.boolean().default(false),
        liked: z.boolean().default(false),
        like_delay_ms: z.number().optional(),
        commented: z.boolean().default(false),
        shared: z.boolean().default(false),
        saved: z.boolean().default(false),
        followed_creator: z.boolean().default(false),
        visited_profile: z.boolean().default(false),
        scroll_speed: z.number().optional(),
        feed_position: z.number().optional(),
        network_quality: z.string().optional(),
      })).max(50), // max 50 events par batch
    }),
  },
}, async (req, reply) => {
  const userId = req.user?.id ?? null;
  const { session_id, events } = req.body;

  // Insertion en masse (performant)
  if (events.length > 0) {
    await prisma.userVideoAnalytics.createMany({
      data: events.map(e => ({
        ...e,
        user_id: userId ?? 'anonymous',
        session_id,
      })),
      skipDuplicates: true,
    });

    // Mettre à jour les stats des posts en arrière-plan
    // (pas de await — fire and forget)
    updatePostStats(events.map(e => e.post_id)).catch(console.error);
  }

  return reply.send({ success: true, processed: events.length });
});

async function updatePostStats(postIds: string[]) {
  const unique = [...new Set(postIds)];
  await Promise.all(unique.map(async (postId) => {
    const stats = await prisma.userVideoAnalytics.aggregate({
      where: { post_id: postId },
      _avg: {
        watch_time_ms: true,
        rewatch_count: true,
        time_before_scroll: true,
      },
      _count: {
        id: true,
        skip_rapid: true,
      },
    });

    await prisma.post.update({
      where: { id: postId },
      data: {
        avg_watch_time_ms: stats._avg.watch_time_ms ?? 0,
        avg_rewatch: stats._avg.rewatch_count ?? 0,
        skip_rate: stats._count.skip_rapid / Math.max(stats._count.id, 1),
      },
    }).catch(() => {}); // Ignore si colonnes n'existent pas encore
  }));
}
```

### Frontend — Hook `useAnalyticsTracker`

```typescript
// src/hooks/useAnalyticsTracker.ts
import { useRef, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AnalyticsEvent {
  post_id: string;
  watch_time_ms: number;
  time_before_scroll: number;
  completed: boolean;
  rewatch_count: number;
  pause_count: number;
  skip_rapid: boolean;
  liked: boolean;
  like_delay_ms?: number;
  commented: boolean;
  shared: boolean;
  saved: boolean;
  followed_creator: boolean;
  visited_profile: boolean;
  scroll_speed?: number;
  feed_position?: number;
  network_quality?: string;
}

const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const QUEUE_KEY = 'nour_analytics_queue';
const BATCH_INTERVAL_MS = 5000; // Envoyer toutes les 5 secondes

// Queue globale pour ne pas envoyer en double
let eventQueue: AnalyticsEvent[] = [];
let batchTimer: ReturnType<typeof setInterval> | null = null;

async function flushQueue() {
  if (eventQueue.length === 0) return;
  
  const toSend = [...eventQueue];
  eventQueue = [];

  try {
    await api.post('/analytics/batch', {
      session_id: SESSION_ID,
      events: toSend,
    });
  } catch {
    // Échec réseau → stocker offline
    try {
      const existing = JSON.parse(await AsyncStorage.getItem(QUEUE_KEY) ?? '[]') as AnalyticsEvent[];
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...existing, ...toSend].slice(-200)));
    } catch {}
  }
}

async function flushOfflineQueue() {
  try {
    const stored = JSON.parse(await AsyncStorage.getItem(QUEUE_KEY) ?? '[]') as AnalyticsEvent[];
    if (stored.length === 0) return;
    
    await api.post('/analytics/batch', { session_id: SESSION_ID, events: stored });
    await AsyncStorage.setItem(QUEUE_KEY, '[]');
  } catch {}
}

export function startAnalyticsBatcher() {
  // Vider la queue offline au démarrage
  flushOfflineQueue();
  
  if (batchTimer) return;
  batchTimer = setInterval(flushQueue, BATCH_INTERVAL_MS);
}

export function stopAnalyticsBatcher() {
  if (batchTimer) {
    clearInterval(batchTimer);
    batchTimer = null;
  }
  flushQueue(); // Vider avant de stopper
}

export function trackVideoEvent(event: AnalyticsEvent) {
  // Dédupliquer par post_id dans la queue
  const existing = eventQueue.findIndex(e => e.post_id === event.post_id);
  if (existing >= 0) {
    // Merger avec l'événement existant
    eventQueue[existing] = {
      ...eventQueue[existing],
      ...event,
      watch_time_ms: eventQueue[existing].watch_time_ms + event.watch_time_ms,
      rewatch_count: Math.max(eventQueue[existing].rewatch_count, event.rewatch_count),
      pause_count: eventQueue[existing].pause_count + event.pause_count,
      liked: eventQueue[existing].liked || event.liked,
      commented: eventQueue[existing].commented || event.commented,
      shared: eventQueue[existing].shared || event.shared,
      saved: eventQueue[existing].saved || event.saved,
      followed_creator: eventQueue[existing].followed_creator || event.followed_creator,
    };
  } else {
    eventQueue.push(event);
  }
}

// Hook pour VideoPlayerItem — accumuler les données au fil du temps
export function useVideoAnalytics(postId: string, feedPosition?: number) {
  const dataRef = useRef({
    enterTime: 0,
    watchAccumMs: 0,
    pauseCount: 0,
    rewatchCount: 0,
    isSecondView: false,
    liked: false,
    likeEnterTime: 0,
    commented: false,
    shared: false,
    saved: false,
    followedCreator: false,
    visitedProfile: false,
  });

  const onEnterViewport = useCallback(() => {
    dataRef.current.enterTime = Date.now();
    dataRef.current.likeEnterTime = Date.now();
    if (dataRef.current.watchAccumMs > 0) {
      dataRef.current.rewatchCount++;
    }
  }, []);

  const onExitViewport = useCallback((videoDurationMs: number) => {
    if (dataRef.current.enterTime === 0) return;
    
    const sessionMs = Date.now() - dataRef.current.enterTime;
    dataRef.current.watchAccumMs += sessionMs;
    dataRef.current.enterTime = 0;

    const totalMs = dataRef.current.watchAccumMs;
    const skipRapid = totalMs < 1500;
    const completed = totalMs >= videoDurationMs * 0.8;

    trackVideoEvent({
      post_id: postId,
      watch_time_ms: Math.round(totalMs),
      time_before_scroll: Math.round(sessionMs),
      completed,
      rewatch_count: dataRef.current.rewatchCount,
      pause_count: dataRef.current.pauseCount,
      skip_rapid: skipRapid,
      liked: dataRef.current.liked,
      like_delay_ms: dataRef.current.liked ? Math.round(dataRef.current.likeEnterTime) : undefined,
      commented: dataRef.current.commented,
      shared: dataRef.current.shared,
      saved: dataRef.current.saved,
      followed_creator: dataRef.current.followedCreator,
      visited_profile: dataRef.current.visitedProfile,
      feed_position: feedPosition,
    });
  }, [postId, feedPosition]);

  const onPause = useCallback(() => { dataRef.current.pauseCount++; }, []);
  const onLike = useCallback(() => {
    if (!dataRef.current.liked) {
      dataRef.current.liked = true;
      dataRef.current.likeEnterTime = Date.now() - dataRef.current.likeEnterTime;
    }
  }, []);
  const onComment = useCallback(() => { dataRef.current.commented = true; }, []);
  const onShare = useCallback(() => { dataRef.current.shared = true; }, []);
  const onSave = useCallback(() => { dataRef.current.saved = true; }, []);
  const onFollow = useCallback(() => { dataRef.current.followedCreator = true; }, []);
  const onVisitProfile = useCallback(() => { dataRef.current.visitedProfile = true; }, []);

  return { onEnterViewport, onExitViewport, onPause, onLike, onComment, onShare, onSave, onFollow, onVisitProfile };
}
```

### Intégration dans App.tsx

```typescript
// Dans App.tsx, au montage :
useEffect(() => {
  startAnalyticsBatcher();
  return () => stopAnalyticsBatcher();
}, []);
```

### Intégration dans VideoPlayerItem

```typescript
// Ajouter dans VideoPlayerItem :
const analytics = useVideoAnalytics(post.id, feedPosition);

// Quand isVisible change :
useEffect(() => {
  if (isVisible) {
    analytics.onEnterViewport();
  } else {
    analytics.onExitViewport((post.duration ?? 15) * 1000);
  }
}, [isVisible]);

// Au pause :
const handlePause = () => {
  setPaused(p => !p);
  if (!paused) analytics.onPause();
};

// Au like :
const handleLike = () => {
  analytics.onLike();
  // ... reste du code like
};

// etc. pour onComment, onShare, onSave, onFollow, onVisitProfile
```

---

## 🎯 ADV-02 : Mode Série

### Concept TikTok
Certains créateurs font des séries (épisodes). TikTok affiche "Episode 2/5" et propose
"Regarder la suite" automatiquement.

### Schéma Prisma

```prisma
model Series {
  id          String   @id @default(cuid())
  creator_id  String
  title       String
  description String?
  cover_url   String?
  created_at  DateTime @default(now())
  creator     User     @relation(fields: [creator_id], references: [id])
  episodes    SeriesEpisode[]
}

model SeriesEpisode {
  id          String   @id @default(cuid())
  series_id   String
  post_id     String
  order_index Int
  series      Series   @relation(fields: [series_id], references: [id], onDelete: Cascade)
  post        Post     @relation(fields: [post_id], references: [id], onDelete: Cascade)

  @@unique([series_id, order_index])
  @@unique([series_id, post_id])
}
```

### Endpoints backend

```typescript
// GET /series/:id — infos série + épisodes
fastify.get('/series/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  
  const series = await prisma.series.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, username: true, display_name: true, avatar_url: true } },
      episodes: {
        orderBy: { order_index: 'asc' },
        include: {
          post: {
            select: {
              id: true, thumbnail_url: true, caption: true,
              duration: true, view_count: true, like_count: true,
            },
          },
        },
      },
    },
  });
  
  if (!series) return reply.status(404).send({ error: 'Série non trouvée' });
  return reply.send(series);
});

// POST /series — créer une série
fastify.post('/series', {
  preHandler: [authenticate],
  schema: {
    body: z.object({
      title: z.string().min(1).max(80),
      description: z.string().max(300).optional(),
      postIds: z.array(z.string()).min(1).max(50),
    }),
  },
}, async (req, reply) => {
  const { title, description, postIds } = req.body;
  const creatorId = req.user.id;

  const series = await prisma.series.create({
    data: {
      title,
      description,
      creator_id: creatorId,
      episodes: {
        create: postIds.map((postId, idx) => ({
          post_id: postId,
          order_index: idx,
        })),
      },
    },
  });

  return reply.status(201).send(series);
});
```

### Frontend — `SeriesPlayerScreen.tsx`

```typescript
// src/screens/series/SeriesPlayerScreen.tsx
export default function SeriesPlayerScreen({ route }: { route: any }) {
  const { seriesId, startEpisode = 0 } = route.params;
  const nav = useNavigation<any>();
  const theme = useTheme();
  const [currentEp, setCurrentEp] = useState(startEpisode);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: series } = useQuery({
    queryKey: ['series', seriesId],
    queryFn: () => api.get(`/series/${seriesId}`).then(r => r.data),
  });

  const episodes = series?.episodes ?? [];
  const currentPost = episodes[currentEp]?.post;
  const isLast = currentEp >= episodes.length - 1;

  // Auto-play suivant quand vidéo se termine
  const handleVideoEnd = () => {
    if (isLast) return;
    setAutoPlayCountdown(5); // 5 secondes avant auto-play
    countdownRef.current = setInterval(() => {
      setAutoPlayCountdown(c => {
        if (c === null || c <= 1) {
          clearInterval(countdownRef.current!);
          setCurrentEp(ep => ep + 1);
          return null;
        }
        return c - 1;
      });
    }, 1000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Player vidéo */}
      {currentPost && (
        <VideoPlayerItem
          post={currentPost as any}
          isVisible={true}
          onComment={() => {}}
          itemHeight={Dimensions.get('window').height}
        />
      )}

      {/* Badge épisode */}
      <View style={seriesStyles.episodeBadge}>
        <Text style={seriesStyles.episodeText}>
          Épisode {currentEp + 1}/{episodes.length}
        </Text>
        <Text style={seriesStyles.seriesTitle} numberOfLines={1}>
          {series?.title}
        </Text>
      </View>

      {/* Overlay "Suivant dans Xs" */}
      {autoPlayCountdown !== null && !isLast && (
        <View style={seriesStyles.autoPlayOverlay}>
          <Text style={seriesStyles.autoPlayText}>
            Épisode suivant dans {autoPlayCountdown}s
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
            <TouchableOpacity
              style={seriesStyles.autoPlayCancel}
              onPress={() => {
                clearInterval(countdownRef.current!);
                setAutoPlayCountdown(null);
              }}
            >
              <Text style={{ color: '#fff', fontSize: 13 }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={seriesStyles.autoPlayNext}
              onPress={() => {
                clearInterval(countdownRef.current!);
                setAutoPlayCountdown(null);
                setCurrentEp(ep => ep + 1);
              }}
            >
              <IcPlay size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Maintenant</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Liste épisodes (bottom drawer) */}
      {/* ... FlatList des épisodes avec thumbnail + titre */}
    </View>
  );
}

// Dans VideoPlayerItem — si le post appartient à une série :
// Afficher badge "Voir la série" et naviguer vers SeriesPlayerScreen
```

---

## ⏳ ADV-03 : Pause Intelligente

### Concept
Si l'utilisateur reste immobile > 4 secondes sur une vidéo (sans scroller, sans tapper),
afficher un overlay discret suggérant du contenu similaire ou de suivre le créateur.
Disparaît au prochain scroll ou tap.

### Frontend — Dans `VideoPlayerItem.tsx`

```typescript
// Ajouter ces states/refs :
const [showSmartPause, setShowSmartPause] = useState(false);
const smartPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const smartPauseOpacity = useRef(new Animated.Value(0)).current;

// Réinitialiser le timer à chaque interaction :
const resetSmartPauseTimer = useCallback(() => {
  if (smartPauseTimerRef.current) clearTimeout(smartPauseTimerRef.current);
  if (showSmartPause) {
    // Cacher le overlay
    Animated.timing(smartPauseOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowSmartPause(false));
  }
  
  // Repartir le timer
  smartPauseTimerRef.current = setTimeout(() => {
    if (isVisible && !paused) {
      setShowSmartPause(true);
      Animated.timing(smartPauseOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, 4000);
}, [isVisible, paused, showSmartPause]);

// Appeler resetSmartPauseTimer sur : tap, swipe, pause, scroll
// (passer en prop onInteraction au FlatList)

useEffect(() => {
  if (!isVisible) {
    if (smartPauseTimerRef.current) clearTimeout(smartPauseTimerRef.current);
    setShowSmartPause(false);
  } else {
    resetSmartPauseTimer();
  }
}, [isVisible]);

// Overlay SmartPause :
{showSmartPause && (
  <Animated.View style={[smartPauseStyles.overlay, { opacity: smartPauseOpacity }]}>
    {/* Ne pas bloquer les taps → pointerEvents box-none */}
    <View style={smartPauseStyles.card}>
      <TouchableOpacity
        style={smartPauseStyles.followBtn}
        onPress={() => { followMutation.mutate(); resetSmartPauseTimer(); }}
        activeOpacity={0.85}
      >
        <Avatar uri={post.user.avatar_url} name={post.user.display_name} size={32} />
        <Text style={smartPauseStyles.followText}>
          Suivre @{post.user.username}
        </Text>
        <IcUserPlus size={16} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={smartPauseStyles.similarBtn}
        onPress={() => { nav.navigate('Hashtag', { tag: extractMainTag(post.caption) }); }}
        activeOpacity={0.8}
      >
        <Text style={smartPauseStyles.similarText}>
          Plus de contenu similaire
        </Text>
        <IcChevronRight size={14} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </View>
  </Animated.View>
)}

const smartPauseStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 90,
    left: 14,
    right: 90,
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  followText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  similarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  similarText: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
});
```

---

## 🔥 ADV-04 : Commentaires vidéo (répondre en vidéo)

### Concept TikTok
Tu peux répondre à un commentaire par une vidéo. La vidéo répond est marquée
et affichée dans le feed avec un lien vers le commentaire d'origine.

### Schéma Prisma

```prisma
// Ajouter sur le modèle Post :
model Post {
  // ... champs existants
  video_reply_comment_id String? // ID du commentaire auquel cette vidéo répond
  video_reply_comment    Comment? @relation("VideoReply", fields: [video_reply_comment_id], references: [id])
}

// Sur Comment :
model Comment {
  // ... champs existants
  video_replies Post[] @relation("VideoReply")
  has_video_reply Boolean @default(false)
}
```

### Frontend — Bouton "Répondre en vidéo" dans CommentsBottomSheet

```typescript
// Dans le menu d'actions d'un commentaire (appui long) :
{isCreator && (
  <TouchableOpacity
    style={actionStyles.option}
    onPress={() => {
      onClose(); // Fermer les commentaires
      nav.navigate('Upload', {
        videoReplyCommentId: comment.id,
        videoReplyCommentText: comment.content,
        videoReplyUsername: comment.user.username,
      });
    }}
    activeOpacity={0.7}
  >
    <IcVideo size={20} color={theme.text} />
    <Text style={actionStyles.optionText}>Répondre en vidéo</Text>
  </TouchableOpacity>
)}

// Dans UploadScreen — si videoReplyCommentId dans params :
// Afficher une preview du commentaire en haut de l'écran
{videoReplyCommentId && (
  <View style={uploadStyles.replyCommentPreview}>
    <Text style={uploadStyles.replyCommentLabel}>
      Réponse à @{videoReplyUsername}
    </Text>
    <Text style={uploadStyles.replyCommentText} numberOfLines={2}>
      {videoReplyCommentText}
    </Text>
  </View>
)}

// Et envoyer videoReplyCommentId dans le POST /posts
```

### Dans le feed — Badge réponse vidéo

```typescript
// Si post.video_reply_comment_id existe, afficher un badge spécial :
{post.video_reply_comment_id && (
  <View style={styles.videoReplyBadge}>
    <IcComment size={11} color="#fff" />
    <Text style={styles.videoReplyText}>Réponse à un commentaire</Text>
  </View>
)}
```

---

## 🧾 ADV-05 : Bio enrichie

### Schéma Prisma

```prisma
// Ajouter sur User :
model User {
  // ... champs existants
  bio_links    Json?   // [{ label: "Mon site", url: "https://..." }]
  bio_tags     Json?   // ["rappel", "coran", "famille"]
  profile_category String? // 'createur' | 'savant' | 'medecin' | 'etudiant' | etc.
}
```

### Frontend — `EditProfileSheet.tsx` enrichi

```typescript
// Ajouter sections après la bio :

{/* Catégorie */}
<Text style={labelStyle}>Catégorie</Text>
<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
  {PROFILE_CATEGORIES.map(cat => (
    <TouchableOpacity
      key={cat.key}
      style={[chipStyle, selectedCategory === cat.key && chipActiveStyle]}
      onPress={() => setSelectedCategory(cat.key)}
      activeOpacity={0.7}
    >
      <Text style={[chipTextStyle, selectedCategory === cat.key && chipTextActiveStyle]}>
        {cat.label}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>

{/* Lien externe */}
<Text style={labelStyle}>Lien</Text>
<TextInput
  value={bioLink}
  onChangeText={setBioLink}
  placeholder="https://ton-site.com"
  placeholderTextColor={theme.textSubtle}
  keyboardType="url"
  autoCapitalize="none"
  style={inputStyle}
/>

// Constantes :
const PROFILE_CATEGORIES = [
  { key: 'createur', label: 'Créateur' },
  { key: 'savant', label: 'Savant/Imam' },
  { key: 'etudiant', label: 'Étudiant' },
  { key: 'medecin', label: 'Médecin/Santé' },
  { key: 'entrepreneur', label: 'Entrepreneur' },
  { key: 'parent', label: 'Parent' },
  { key: 'sportif', label: 'Sport/Fitness' },
];

// Dans ProfileScreen — afficher lien cliquable dans la bio :
{user?.bio_links?.[0]?.url && (
  <TouchableOpacity
    onPress={() => Linking.openURL(user.bio_links[0].url)}
    activeOpacity={0.7}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}
  >
    <IcExternalLink size={13} color={COLORS.primary} />
    <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: '500' }}>
      {user.bio_links[0].label || user.bio_links[0].url}
    </Text>
  </TouchableOpacity>
)}
```

---

## 🤝 ADV-06 : Recommandation de comptes

### Backend — `GET /users/recommendations`

```typescript
fastify.get('/users/recommendations', {
  preHandler: [authenticate],
  schema: {
    querystring: z.object({ limit: z.coerce.number().default(10) }),
  },
}, async (req, reply) => {
  const userId = req.user.id;
  const { limit } = req.query;

  // 1. Comptes suivis par les gens que je suis (amis d'amis)
  const myFollowing = await prisma.follow.findMany({
    where: { follower_id: userId },
    select: { following_id: true },
  });
  const myFollowingIds = myFollowing.map(f => f.following_id);

  // Comptes suivis par mes abonnements (que je ne suis pas encore)
  const friendsOfFriends = await prisma.follow.findMany({
    where: {
      follower_id: { in: myFollowingIds },
      following_id: { notIn: [...myFollowingIds, userId] },
    },
    select: { following_id: true },
    distinct: ['following_id'],
  });

  const fofIds = friendsOfFriends.map(f => f.following_id);

  // 2. Comptes populaires dans mes catégories préférées
  // (basé sur les hashtags que je regarde le plus)
  const myTopHashtags = await prisma.userVideoAnalytics.groupBy({
    by: ['post_id'],
    where: { user_id: userId },
    orderBy: { _sum: { watch_time_ms: 'desc' } },
    take: 50,
    _sum: { watch_time_ms: true },
  });

  // 3. Scorer et retourner
  const candidates = [...new Set([...fofIds])].slice(0, limit * 3);

  const users = await prisma.user.findMany({
    where: {
      id: { in: candidates.length > 0 ? candidates : undefined },
      id: { notIn: [...myFollowingIds, userId] },
    },
    orderBy: { follower_count: 'desc' },
    take: limit,
    select: {
      id: true, username: true, display_name: true,
      avatar_url: true, follower_count: true, is_verified: true,
      profile_category: true,
    },
  });

  return reply.send({
    items: users.map(u => ({ ...u, is_following: false })),
    reason: 'Suivis par des gens que tu suis',
  });
});
```

### Frontend — Dans `UserProfileScreen`

```typescript
// Section "Comptes similaires" en bas du profil :
function SimilarAccountsSection({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ['user-recommendations', userId],
    queryFn: () => api.get('/users/recommendations?limit=5').then(r => r.data as { items: any[] }),
  });

  if (!data?.items?.length) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 12 }}>
        Comptes similaires
      </Text>
      {data.items.map(user => (
        <TouchableOpacity
          key={user.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
          onPress={() => nav.push('UserProfile', { userId: user.id, username: user.username })}
          activeOpacity={0.7}
        >
          <Avatar uri={user.avatar_url} name={user.display_name} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{user.display_name}</Text>
            <Text style={{ fontSize: 11, color: theme.textSubtle }}>@{user.username} · {fmt(user.follower_count)} abonnés</Text>
          </View>
          <FollowButton userId={user.id} size="sm" />
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

---

## 🎙️ ADV-07 : Messages vocaux

### Concept
Maintenir le bouton micro enfoncé → enregistrement audio → relâcher → preview → envoyer.

### Frontend — Dans `ConversationScreen.tsx`

```typescript
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
// npm install react-native-audio-recorder-player

const recorderPlayer = new AudioRecorderPlayer();
const [recording, setRecording] = useState(false);
const [audioPath, setAudioPath] = useState<string | null>(null);
const [audioDuration, setAudioDuration] = useState(0);
const recordingAnim = useRef(new Animated.Value(1)).current;

// Pulsation pendant l'enregistrement
const pulseRecording = () => {
  Animated.loop(
    Animated.sequence([
      Animated.timing(recordingAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
      Animated.timing(recordingAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ])
  ).start();
};

const startRecording = async () => {
  setRecording(true);
  pulseRecording();
  const path = Platform.OS === 'ios'
    ? `${Date.now()}.m4a`
    : `${RNFS.CachesDirectoryPath}/${Date.now()}.mp3`;
  
  await recorderPlayer.startRecorder(path);
  recorderPlayer.addRecordBackListener(e => {
    setAudioDuration(Math.round(e.currentPosition / 1000));
  });
};

const stopRecording = async () => {
  recordingAnim.stopAnimation();
  recordingAnim.setValue(1);
  setRecording(false);
  const result = await recorderPlayer.stopRecorder();
  recorderPlayer.removeRecordBackListener();
  setAudioPath(result);
};

const sendAudio = async () => {
  if (!audioPath) return;
  // Upload vers Cloudinary (même endpoint que les images)
  const form = new FormData();
  form.append('file', { uri: audioPath, type: 'audio/m4a', name: 'voice.m4a' } as any);
  const { data } = await api.post('/upload/audio', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  
  // Envoyer le message avec l'URL audio
  await sendMessage({ type: 'audio', audio_url: data.url, duration: audioDuration });
  setAudioPath(null);
};

// Bouton micro (dans l'input row) :
<Pressable
  onPressIn={startRecording}
  onPressOut={stopRecording}
  style={{ padding: 8 }}
>
  <Animated.View style={{ transform: [{ scale: recordingAnim }] }}>
    <IcMic size={22} color={recording ? '#FF3B30' : theme.textMuted} />
  </Animated.View>
</Pressable>

// Preview audio avant envoi :
{audioPath && (
  <View style={audioPreviewStyle}>
    <IcPlay size={16} color={COLORS.primary} />
    <Text style={{ flex: 1, color: theme.text, fontSize: 13 }}>
      Message vocal · {audioDuration}s
    </Text>
    <TouchableOpacity onPress={() => setAudioPath(null)}>
      <IcX size={16} color={theme.textMuted} />
    </TouchableOpacity>
    <TouchableOpacity onPress={sendAudio}>
      <IcSend size={20} color={COLORS.primary} />
    </TouchableOpacity>
  </View>
)}

// Bulle audio dans la conversation :
function AudioBubble({ message, isMe }: { message: any; isMe: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const togglePlay = async () => {
    if (playing) {
      await recorderPlayer.stopPlayer();
      setPlaying(false);
    } else {
      setPlaying(true);
      await recorderPlayer.startPlayer(message.audio_url);
      recorderPlayer.addPlayBackListener(e => {
        setProgress(e.currentPosition / e.duration);
        if (e.currentPosition >= e.duration) {
          setPlaying(false);
          setProgress(0);
        }
      });
    }
  };
  
  return (
    <TouchableOpacity
      style={[bubbleStyle(isMe), { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 150 }]}
      onPress={togglePlay}
    >
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
        {playing ? <IcPause size={16} color="#fff" /> : <IcPlay size={16} color="#fff" />}
      </View>
      {/* Waveform simplifiée */}
      <View style={{ flex: 1, height: 24, justifyContent: 'center' }}>
        <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 }}>
          <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: '#fff', borderRadius: 2 }} />
        </View>
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{message.duration}s</Text>
    </TouchableOpacity>
  );
}
```

---

## 📊 ADV-10 : Admin Panel complet

### Pages à créer dans `admin/src/`

L'admin panel existe déjà (React + Vite + Tailwind). Ajouter ces pages :

#### Page Analytics (`/analytics`)

```typescript
// admin/src/pages/AnalyticsPage.tsx
// KPIs principaux :
// - DAU (daily active users) — count distinct user_id in analytics aujourd'hui
// - Sessions moyennes par user
// - Durée moyenne session
// - Retention J7 / J30
// - Top hashtags
// - Rétention par catégorie de contenu

// Graphiques avec recharts ou chart.js :
// - Ligne : DAU sur 30 jours
// - Bar : top 10 vidéos par watch time
// - Pie : répartition par type de contenu
// - Funnel : vues → likes → commentaires → partages

// Endpoint backend :
// GET /admin/analytics?period=7d|30d|90d
```

#### Page Modération (`/moderation`)

```typescript
// admin/src/pages/ModerationPage.tsx
// - Liste des signalements non traités
// - Boutons : Ignorer / Supprimer contenu / Bannir utilisateur
// - Filtres : type de signalement, date
// - Preview du contenu signalé

// Endpoint backend :
// GET /admin/reports?status=pending|reviewed&cursor=
// PATCH /admin/reports/:id { action: 'ignore' | 'delete_post' | 'ban_user' }
```

#### Page Algo Tuning (`/algo`)

```typescript
// admin/src/pages/AlgoPage.tsx
// Permettre d'ajuster les poids de l'algorithme via un formulaire :
// watch_time_weight: [0-100] (slider)
// rewatch_weight: [0-100]
// like_weight: [0-100]
// comment_weight: [0-100]
// share_weight: [0-100]
// skip_penalty: [0-100]
// age_decay_factor: [0.90-0.99]

// Stocker dans une table config :
model AlgoConfig {
  id                  String  @id @default("default")
  watch_time_weight   Float   @default(3)
  rewatch_weight      Float   @default(5)
  like_weight         Float   @default(10)
  comment_weight      Float   @default(15)
  share_weight        Float   @default(20)
  skip_penalty        Float   @default(10)
  age_decay_factor    Float   @default(0.97)
  updated_at          DateTime @default(now())
}

// L'algo du feed lit cette config pour ses calculs
// → permet d'A/B tester et ajuster sans redéployer
```

---

## 🛡️ ADV-11 : Modération automatique

### Filtre mots interdits

```typescript
// backend/src/services/moderation.ts

const FORBIDDEN_WORDS = [
  // Mots vulgaires, injurieux, etc.
  // Liste à compléter selon les besoins
  'mot1', 'mot2',
];

const FORBIDDEN_REGEX = new RegExp(
  FORBIDDEN_WORDS.map(w => `\\b${w}\\b`).join('|'),
  'gi'
);

export function containsForbiddenContent(text: string): boolean {
  return FORBIDDEN_REGEX.test(text);
}

export function sanitizeText(text: string): string {
  return text.replace(FORBIDDEN_REGEX, match => '*'.repeat(match.length));
}

// Détection spam (posts répétitifs) :
export async function isSpam(userId: string, content: string): Promise<boolean> {
  const recent = await prisma.post.findMany({
    where: {
      user_id: userId,
      created_at: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // 1h
    },
    select: { caption: true },
    take: 5,
  });

  // Si 3+ posts similaires dans l'heure → spam
  const similar = recent.filter(p =>
    p.caption && content &&
    similarity(p.caption, content) > 0.85
  );

  return similar.length >= 3;
}

// Utiliser dans POST /posts (création) :
if (containsForbiddenContent(caption)) {
  return reply.status(400).send({ error: 'Contenu non autorisé' });
}
if (await isSpam(userId, caption)) {
  return reply.status(429).send({ error: 'Trop de publications similaires' });
}
```

---

## 🔔 ADV-12 : Notifications intelligentes + résumé

### Résumé journalier (cron)

```typescript
// backend/src/cron/dailyDigest.ts
// Cron : tous les jours à 18h

import { CronJob } from 'cron';

export function startDailyDigestCron() {
  new CronJob('0 18 * * *', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Pour chaque utilisateur actif hier :
    const activeUsers = await prisma.user.findMany({
      where: { last_active_at: { gte: yesterday } },
      select: { id: true, display_name: true },
    });

    for (const user of activeUsers) {
      const stats = await prisma.notification.aggregate({
        where: {
          recipient_id: user.id,
          created_at: { gte: yesterday },
        },
        _count: { id: true },
      });

      const likes = await prisma.notification.count({
        where: { recipient_id: user.id, type: 'LIKE', created_at: { gte: yesterday } },
      });

      if (stats._count.id > 0) {
        // Envoyer notification push résumé
        await sendPushNotification(user.id, {
          title: 'Ton activité d\'hier',
          body: `Tu as reçu ${likes} j'aime et ${stats._count.id} interactions. Continue !`,
          data: { type: 'DAILY_DIGEST' },
        });
      }
    }
  }, null, true, 'Europe/Paris');
}
```

---

## 📋 VALIDATION PHASE 5

Tester chaque feature en tant qu'utilisateur :

1. **Analytics** : Regarder 5 vidéos → logs backend → vérifier que les données arrivent
2. **Série** : Créer une série de 3 vidéos → regarder → auto-play suivant
3. **Pause intelligente** : Regarder une vidéo sans bouger 4s → overlay apparaît
4. **Commentaire vidéo** : Répondre en vidéo → post créé avec lien commentaire
5. **Bio enrichie** : Ajouter un lien + catégorie → visible sur profil
6. **Recommandations** : Profil d'un user → "Comptes similaires"
7. **Message vocal** : Maintenir micro → enregistrer → envoyer
8. **Admin panel** : Ouvrir dashboard → graphiques chargés
9. **Modération** : Poster un message avec mot interdit → bloqué

```bash
git add -A && git commit -m "feat: Phase 5 analytics invisible, séries, pause intelligente, admin panel, modération"
git push origin main
```
