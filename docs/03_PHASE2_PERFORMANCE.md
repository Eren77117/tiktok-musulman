# 03 — PHASE 2 : PERFORMANCE & ALGORITHME
## Vitesse perçue = vitesse réelle × 2

---

## ✅ CHECKLIST PHASE 2

- [ ] PERF-01 : FlatList feed ultra-optimisée
- [ ] PERF-02 : Préchargement des vidéos suivantes
- [ ] PERF-03 : Buffering intelligent réseau lent
- [ ] PERF-04 : Algorithme "Pour toi" amélioré (watch time + rewatch + skip)
- [ ] PERF-05 : Algorithme score backend enrichi
- [ ] PERF-06 : Pagination curseur optimisée (no re-fetch inutile)
- [ ] PERF-07 : Image lazy loading avec Skeleton
- [ ] PERF-08 : React Query stale time optimisé

---

## ⚡ PERF-01 : FlatList feed ultra-optimisée

### Fichier : `src/screens/feed/FeedScreen.tsx`

La FlatList actuelle a de bons paramètres mais peut être encore optimisée.

### Solution complète :

```typescript
// Config FlatList Pour Toi — version TikTok-level
<FlatList<FeedItem>
  data={filteredPosts}
  style={{ flex: 1 }}
  
  // Layout
  pagingEnabled
  decelerationRate="fast"
  showsVerticalScrollIndicator={false}
  
  // Performance critique
  removeClippedSubviews={true}
  maxToRenderPerBatch={2}
  windowSize={5}           // 5 = 2 avant + actuel + 2 après
  initialNumToRender={1}
  updateCellsBatchingPeriod={16} // 1 frame
  
  // Layout calculation (évite les re-calculs)
  getItemLayout={(_, index) => ({
    length: ITEM_H,
    offset: ITEM_H * index,
    index,
  })}
  
  // Viewability
  onViewableItemsChanged={onViewableItemsChanged}
  viewabilityConfig={{
    itemVisiblePercentThreshold: 60, // 60% visible = "actif"
    minimumViewTime: 100, // au moins 100ms avant de compter comme vu
  }}
  
  // Infinite scroll
  onEndReached={() => hasNextFeed && !fetchingFeed && fetchNextFeed()}
  onEndReachedThreshold={3}
  
  // Keys stables
  keyExtractor={p =>
    p.type === 'video' ? p.data.id :
    p.type === 'book' ? `book-${p.data.id}` :
    `live-${p.data.id}`
  }
  
  // Scroll events
  onMomentumScrollBegin={() => {
    // Réduire haptic pendant le scroll rapide
  }}
/>

// IMPORTANT : Mémoriser les callbacks pour éviter les re-renders
const onViewableItemsChanged = useCallback(({ viewableItems }) => {
  if (viewableItems.length > 0) {
    const item = viewableItems[0].item as FeedItem;
    const id = item?.type === 'video' ? item.data.id : null;
    setVisibleId(id);
    if (id && !seenIds.current.includes(id)) {
      seenIds.current = [...seenIds.current.slice(-19), id]; // keep last 20
    }
  }
}, []);

// Mémoriser renderItem
const renderItem = useCallback(({ item }: { item: FeedItem }) => {
  if (item.type === 'book') return <BookCard book={item.data} isVisible={false} />;
  if (item.type === 'live') return <FeedLiveCard live={item.data} onPress={...} />;
  return (
    <VideoPlayerItem
      post={item.data}
      isVisible={effectiveVisibleId === item.data.id}
      onComment={() => setCommentsPostId(item.data.id)}
      onNotInterested={() => hidePost(item.data.id)}
      itemHeight={ITEM_H}
    />
  );
}, [effectiveVisibleId]);
```

---

## ⚡ PERF-02 : Préchargement des vidéos

### Problème
Actuellement les vidéos commencent à charger quand elles deviennent visibles.
Sur TikTok : les 2-3 vidéos suivantes sont déjà en cache.

### Solution — Hook useVideoPreloader :

```typescript
// src/hooks/useVideoPreloader.ts
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Video from 'react-native-video';

interface PreloadPost {
  id: string;
  video_url: string;
}

export function useVideoPreloader(
  posts: PreloadPost[],
  currentIndex: number,
  windowSize = 2
) {
  const preloadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Précharger les N vidéos suivantes
    const toPreload = posts
      .slice(currentIndex + 1, currentIndex + 1 + windowSize)
      .filter(p => p.video_url && !preloadedRef.current.has(p.id));

    toPreload.forEach(post => {
      preloadedRef.current.add(post.id);
      
      // React Native Video supporte le preload via une Video component en background
      // La méthode la plus simple est de créer une Video hidden avec paused=true
      // ce qui force le prefetch du segment initial
      if (Platform.OS === 'ios') {
        // iOS : utiliser Image.prefetch pour les thumbnails au moins
        if (post.video_url) {
          // Prefetch via AVPlayer cache — déclenché par Video component hidden
          // (géré dans VideoPlayerItem via props preload)
        }
      }
    });

    // Nettoyer les vidéos très loin (économiser mémoire)
    if (currentIndex > 3) {
      const toEvict = posts.slice(0, currentIndex - 3).map(p => p.id);
      toEvict.forEach(id => preloadedRef.current.delete(id));
    }
  }, [currentIndex, posts]);
}

// Dans FeedScreen, trouver le currentIndex :
const currentIndex = posts.findIndex(
  p => p.type === 'video' && p.data.id === visibleId
);

useVideoPreloader(
  posts.filter(p => p.type === 'video').map(p => ({
    id: p.data.id,
    video_url: (p.data as FeedPost).video_url,
  })),
  currentIndex
);
```

### Stratégie de préchargement dans VideoPlayerItem :
```typescript
// Ajouter un prop 'shouldPreload' pour les items N+1 et N+2
interface Props {
  // ... existing props
  shouldPreload?: boolean; // true pour les 2 suivantes
}

// Dans le composant :
{shouldPreload && isVideo && (
  // Video en background avec paused=true force le buffer initial
  <Video
    source={{ uri: post.video_url }}
    style={{ width: 0, height: 0, opacity: 0 }} // invisible
    paused={true}
    muted={true}
    bufferConfig={{
      minBufferMs: 2000,
      maxBufferMs: 5000,
      bufferForPlaybackMs: 1000,
      bufferForPlaybackAfterRebufferMs: 1500,
    }}
  />
)}
```

---

## ⚡ PERF-03 : Buffering intelligent

### Problème
Sur réseau lent, la vidéo bloque avec un spinner. TikTok réduit la qualité automatiquement
et montre la thumbnail pendant le buffer.

### Fichier : `src/components/video/VideoPlayerItem.tsx`

### Solution :

```typescript
// Mesurer la qualité du réseau
import NetInfo from '@react-native-community/netinfo';

// Dans VideoPlayerItem ou via un hook global :
const [networkQuality, setNetworkQuality] = useState<'fast' | 'slow' | 'offline'>('fast');

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (!state.isConnected) {
      setNetworkQuality('offline');
    } else if (state.type === 'wifi') {
      setNetworkQuality('fast');
    } else if (state.details?.cellularGeneration === '4g' || state.details?.cellularGeneration === '5g') {
      setNetworkQuality('fast');
    } else {
      setNetworkQuality('slow');
    }
  });
  return unsubscribe;
}, []);

// Buffer config selon qualité réseau :
const bufferConfig = networkQuality === 'slow' ? {
  minBufferMs: 500,
  maxBufferMs: 3000,
  bufferForPlaybackMs: 250,
  bufferForPlaybackAfterRebufferMs: 500,
} : {
  minBufferMs: 1500,
  maxBufferMs: 10000,
  bufferForPlaybackMs: 500,
  bufferForPlaybackAfterRebufferMs: 1000,
};

// Thumbnail améliorée pendant le buffer :
// Montrer la thumbnail TOUJOURS (pas seulement pendant le chargement initial)
// Elle disparaît seulement quand la vidéo est bien en lecture
const [videoReady, setVideoReady] = useState(false);

// Dans Video component :
onReadyForDisplay={() => setVideoReady(true)}
onBuffer={({ isBuffering }) => {
  setBuffering(isBuffering);
  if (isBuffering) setVideoReady(false);
}}

// Render thumbnail :
{(!videoReady || buffering) && post.thumbnail_url && (
  <Image
    source={{ uri: post.thumbnail_url }}
    style={StyleSheet.absoluteFill}
    resizeMode="cover"
    // Toujours présente comme fallback
  />
)}

// Spinner minimal (pas l'ActivityIndicator géant) :
{buffering && isVideo && videoReady === false && (
  <View style={styles.bufferWrap} pointerEvents="none">
    <View style={styles.bufferDot} /> // Petit point pulsant, pas un spinner
  </View>
)}

// Style bufferDot :
bufferDot: {
  width: 8, height: 8, borderRadius: 4,
  backgroundColor: 'rgba(255,255,255,0.8)',
  // Animation pulsante simple
}
```

---

## ⚡ PERF-04 : Tracking comportement utilisateur (frontend)

### Problème
L'algo actuel enregistre seulement le watch_time.
TikTok mesure : temps regardé, rewatches, vitesse du scroll, pauses.

### Fichier : `src/components/video/VideoPlayerItem.tsx`

### Solution — Enrichir les données envoyées :

```typescript
// Données à tracker par vidéo :
const watchDataRef = useRef({
  watchStart: 0,
  totalWatchTime: 0,
  rewatchCount: 0,
  pauseCount: 0,
  skipSpeed: 0, // temps entre entrée et sortie du viewport en ms
  completionRatio: 0,
  interacted: false, // like, comment, share, save, follow
});

// Quand la vidéo devient visible :
useEffect(() => {
  if (isVisible) {
    watchDataRef.current.watchStart = Date.now();
    if (watchDataRef.current.totalWatchTime > 0) {
      watchDataRef.current.rewatchCount++; // Si on revient sur cette vidéo
    }
  } else {
    if (watchDataRef.current.watchStart > 0) {
      const sessionTime = (Date.now() - watchDataRef.current.watchStart) / 1000;
      watchDataRef.current.totalWatchTime += sessionTime;
      watchDataRef.current.watchStart = 0;

      // Détecter skip rapide (< 2 secondes = on a scrollé vite)
      const wasSkipped = sessionTime < 2.0;

      // Envoyer au backend
      if (watchDataRef.current.totalWatchTime > 0.3) {
        api.post(`/posts/${post.id}/view`, {
          watch_time: Math.round(watchDataRef.current.totalWatchTime),
          rewatch_count: watchDataRef.current.rewatchCount,
          completion_ratio: Math.min(1, watchDataRef.current.totalWatchTime / (post.duration || 15)),
          was_skipped: wasSkipped,
          pause_count: watchDataRef.current.pauseCount,
          interacted: watchDataRef.current.interacted,
        }).catch(() => {});
      }

      // Reset pour la prochaine session
      if (!isVisible) {
        watchDataRef.current = {
          watchStart: 0,
          totalWatchTime: 0,
          rewatchCount: 0,
          pauseCount: 0,
          skipSpeed: 0,
          completionRatio: 0,
          interacted: false,
        };
      }
    }
  }
}, [isVisible]);

// Marquer comme interacted quand like/comment/share :
const handleLikePress = useCallback(() => {
  watchDataRef.current.interacted = true;
  // ... reste du code like
}, []);
```

---

## ⚡ PERF-05 : Algorithme backend enrichi

### Fichier : `backend/src/routes/posts.ts` (ou fichier routes posts)

### Score actuel → Score enrichi :

```typescript
// Formule de score TikTok-inspirée
function calculateScore(post: any, userPrefs: UserPreferences): number {
  const {
    view_count,
    like_count,
    comment_count,
    share_count,
    save_count,
    avg_watch_time,
    avg_completion_ratio,
    avg_rewatch_count,
    avg_skip_rate,
    created_at,
  } = post;

  // Base engagement score
  let score = 0;
  score += like_count * 10;
  score += comment_count * 15;
  score += share_count * 20;
  score += save_count * 12;
  score += Math.min(view_count, 10000) * 0.5;

  // Watch time bonus (critique — TikTok weight le plus fort)
  const completionBonus = (avg_completion_ratio ?? 0) * 50; // max 50 pts si 100% vu
  score += completionBonus;

  // Rewatch bonus (signe d'une vidéo addictive)
  const rewatchBonus = Math.min(avg_rewatch_count ?? 0, 3) * 15; // max 45 pts
  score += rewatchBonus;

  // Skip penalty
  const skipPenalty = (avg_skip_rate ?? 0) * 20;
  score -= skipPenalty;

  // Décroissance temporelle (TikTok : vidéos récentes boostées)
  const ageHours = (Date.now() - new Date(created_at).getTime()) / 3600000;
  const ageFactor = Math.pow(0.97, Math.max(0, ageHours - 1)); // decay après 1h
  score *= ageFactor;

  // Boost catégorie (affinité utilisateur)
  if (userPrefs?.favCategories?.includes(post.category)) {
    score *= 1.5;
  }

  // Boost créateur favori
  const creatorAffinity = userPrefs?.creatorAffinities?.[post.user_id] ?? 1;
  score *= creatorAffinity; // 1.0 à 1.8

  // Boost si suivi
  if (userPrefs?.followingIds?.includes(post.user_id)) {
    score *= 1.3;
  }

  // Diversité (pénaliser si même créateur déjà montré récemment)
  // Géré côté application, pas ici

  return Math.max(0, score);
}
```

### Endpoint `/posts/feed` — ajouter ces paramètres :

```typescript
// Query params attendus :
interface FeedQuery {
  cursor?: string;
  limit?: number;
  seen?: string;          // IDs séparés par virgule
  skip_user?: string;     // IDs créateurs déjà vus ce batch (diversité)
}

// Logique diversité (max 2 vidéos par créateur par page) :
const seenCreators = new Map<string, number>();
const diversePosts = scoredPosts.filter(post => {
  const count = seenCreators.get(post.user_id) ?? 0;
  if (count >= 2) return false;
  seenCreators.set(post.user_id, count + 1);
  return true;
});
```

---

## ⚡ PERF-06 : Pagination curseur optimisée

### Problème actuel
Lors d'un pull-to-refresh, toute la liste est rechargée depuis 0.
TikTok maintient les vidéos déjà vues et ajoute les nouvelles en haut.

### Solution — Optimiser le refetch :

```typescript
// Dans FeedScreen :
const handleRefresh = useCallback(async () => {
  // Vider les seenIds pour avoir du contenu frais
  seenIds.current = [];
  
  // Remonter en haut de la liste en douceur
  flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  
  // Refetch
  await refetchFeed();
}, [refetchFeed]);

// React Query config optimisée :
const feedQuery = useInfiniteQuery({
  queryKey: ['feed'],
  queryFn: async ({ pageParam }) => {
    const response = await api.get('/posts/feed', {
      params: {
        cursor: pageParam,
        limit: 6, // 6 vidéos par batch (optimal)
        seen: seenIds.current.slice(-20).join(','),
      },
    });
    return response.data as { items: FeedPost[]; next_cursor: string | null };
  },
  initialPageParam: null as string | null,
  getNextPageParam: last => last.next_cursor ?? undefined,
  staleTime: 5 * 60 * 1000,       // 5 min avant re-fetch
  gcTime: 30 * 60 * 1000,         // 30 min en cache
  refetchOnWindowFocus: false,     // Ne pas re-fetch quand app revient en focus
  refetchOnMount: false,           // Ne pas re-fetch au montage si données en cache
});
```

---

## ⚡ PERF-07 : Skeleton Loading uniformisé

### Règle
Aucun `ActivityIndicator` visible à l'utilisateur pour le chargement de contenu.
Toujours utiliser des Skeletons qui imitent la forme du contenu final.

### Skeletons à créer/améliorer :

```typescript
// src/components/ui/Skeleton.tsx — ajouter des presets

// Skeleton pour la liste de conversations :
export function ConversationSkeleton() {
  return (
    <View style={{ flexDirection: 'row', padding: 16, gap: 12, alignItems: 'center' }}>
      <Skeleton width={50} height={50} borderRadius={25} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="60%" height={14} borderRadius={7} />
        <Skeleton width="80%" height={12} borderRadius={6} />
      </View>
      <Skeleton width={30} height={12} borderRadius={6} />
    </View>
  );
}

// Skeleton pour le profil :
export function ProfileSkeleton() {
  return (
    <View>
      {/* Cover */}
      <Skeleton width="100%" height={130} borderRadius={0} />
      {/* Avatar */}
      <View style={{ alignItems: 'center', marginTop: -45 }}>
        <Skeleton width={90} height={90} borderRadius={45} />
        <View style={{ gap: 8, marginTop: 12, alignItems: 'center' }}>
          <Skeleton width={120} height={18} borderRadius={9} />
          <Skeleton width={180} height={13} borderRadius={6} />
        </View>
      </View>
      {/* Stats */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 }}>
        {[0,1,2].map(i => (
          <View key={i} style={{ alignItems: 'center', gap: 4 }}>
            <Skeleton width={40} height={20} borderRadius={10} />
            <Skeleton width={60} height={12} borderRadius={6} />
          </View>
        ))}
      </View>
    </View>
  );
}

// Skeleton pour les notifications :
export function NotifSkeleton() {
  return (
    <View style={{ flexDirection: 'row', padding: 16, gap: 12, alignItems: 'center' }}>
      <Skeleton width={44} height={44} borderRadius={22} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="90%" height={13} borderRadius={6} />
        <Skeleton width="50%" height={11} borderRadius={5} />
      </View>
      <Skeleton width={44} height={44} borderRadius={8} />
    </View>
  );
}

// Skeleton pour la grille explore :
export function ExploreGridSkeleton({ cols = 2 }: { cols?: number }) {
  const W = Dimensions.get('window').width;
  const itemW = (W - 2) / cols;
  const itemH = itemW * 1.5;
  
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} width={itemW} height={itemH} borderRadius={0} />
      ))}
    </View>
  );
}
```

---

## ⚡ PERF-08 : React Query config globale

### Fichier : `src/api/client.ts` ou `src/App.tsx`

### Configuration QueryClient optimisée :

```typescript
// Dans App.tsx :
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,      // 2 min par défaut
      gcTime: 10 * 60 * 1000,         // 10 min en cache
      retry: 2,                        // 2 tentatives max
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false,
      refetchOnMount: 'always',
      networkMode: 'online',
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
    },
  },
});

// Overrides spécifiques par query :
// Feed vidéo — stale après 5 min
useInfiniteQuery({ queryKey: ['feed'], staleTime: 5 * 60 * 1000, ... })

// Stats profil — rafraîchir toutes les 15s
useQuery({ queryKey: ['me-stats'], refetchInterval: 15_000, staleTime: 0, ... })

// Lives actifs — rafraîchir toutes les 30s
useQuery({ queryKey: ['feed-live-active'], refetchInterval: 30_000, ... })

// Notifications non-lues — rafraîchir toutes les 30s
useQuery({ queryKey: ['notif-unread-count'], refetchInterval: 30_000, ... })

// Messages conversations — rafraîchir toutes les 10s
useQuery({ queryKey: ['conversations'], refetchInterval: 10_000, ... })
```

---

## 📋 VALIDATION PHASE 2

Tester sur iPhone avec **réseau 4G simulé** (pas WiFi) :

1. Scroll rapide dans le feed → aucun freeze ni écran noir
2. Vidéo suivante démarre sans attente visible
3. Sur réseau lent → thumbnail reste visible pendant buffer
4. Pull-to-refresh → contenu frais en < 2 secondes
5. Grille profil → charge toutes les thumbnails en skeleton puis image
6. Messages → liste charge en skeleton puis contenu

```bash
git add -A && git commit -m "perf: Phase 2 — optimisations performance et algorithme"
git push origin main
```
