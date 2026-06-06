# 02 — PHASE 1 : CORRECTIONS CRITIQUES
## Ces bugs cassent l'expérience. Corriger avant tout le reste.

---

## ✅ CHECKLIST PHASE 1

- [ ] BUG-01 : Cover photo profil (gradient + upload)
- [ ] BUG-02 : Grille profil sans overlay view count
- [ ] BUG-03 : Tab naming feed incohérent
- [ ] BUG-04 : Avatar composant non unifié
- [ ] BUG-05 : UserProfile boutons S'abonner/Message
- [ ] BUG-06 : Caption @mentions non tappables
- [ ] BUG-07 : Notifications non accessibles depuis profil
- [ ] BUG-08 : Explore grille trop petite (3 colonnes → 2)
- [ ] BUG-09 : Seek bar thumb toujours visible (devrait apparaître au touch)
- [ ] BUG-10 : EditProfile plein écran → Bottom Sheet

---

## 🔴 BUG-01 : Cover photo profil

### Problème observé (screenshot)
La cover photo du profil est un rectangle vert clair (`#E5F5EE`) vide et inesthétique.
Sur TikTok, le cover est soit une vraie photo, soit un gradient foncé beau.

### Fichier : `src/screens/profile/ProfileScreen.tsx`

### Solution complète :

```typescript
// 1. Remplacer le composant cover actuel par celui-ci :

function ProfileCover({
  coverUrl,
  onUpload,
  isOwner,
  loading,
}: {
  coverUrl: string | null;
  onUpload: () => void;
  isOwner: boolean;
  loading: boolean;
}) {
  return (
    <View style={coverStyles.container}>
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={['#0A2918', '#0F3D22', '#1A5C35']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Overlay gradient bas pour lisibilité */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0.4 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      {/* Bouton upload cover — visible uniquement si propriétaire */}
      {isOwner && (
        <TouchableOpacity
          style={coverStyles.uploadBtn}
          onPress={onUpload}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <IcCamera size={16} color="#fff" />
          }
        </TouchableOpacity>
      )}
    </View>
  );
}

const coverStyles = StyleSheet.create({
  container: {
    height: 130,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#0F3D22',
  },
  uploadBtn: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});

// 2. Fonction upload cover dans ProfileScreen :
const handleCoverUpload = async () => {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    quality: 0.8,
    maxWidth: 1200,
    maxHeight: 400,
  });

  if (!result.assets?.[0]?.uri) return;

  setCoverLoading(true);
  try {
    const { tokens } = await getTokens();
    const form = new FormData();
    form.append('file', {
      uri: result.assets[0].uri,
      type: result.assets[0].type ?? 'image/jpeg',
      name: 'cover.jpg',
    } as any);

    const { data } = await api.post('/upload/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    await api.patch('/users/me', { cover_url: data.url });
    updateUser({ cover_url: data.url });
  } catch {
    Alert.alert('Erreur', "Impossible d'uploader la photo de couverture.");
  } finally {
    setCoverLoading(false);
  }
};
```

### Test :
1. Ouvrir ProfileScreen
2. Vérifier gradient vert foncé si pas de cover
3. Tapper l'icône caméra → galerie s'ouvre
4. Sélectionner image → upload → cover remplacée
5. Relancer l'app → cover persistée ✓

---

## 🔴 BUG-02 : Grille profil — thumbnails sans overlay

### Problème observé
Les vidéos dans la grille profil sont affichées comme de simples images.
Sur TikTok : chaque thumbnail a une icône play + le nombre de vues en bas à gauche.

### Fichier : `src/screens/profile/ProfileScreen.tsx`

### Solution — Composant PostThumb :

```typescript
function PostThumb({
  post,
  size,
  onPress,
}: {
  post: Post;
  size: number;
  onPress: () => void;
}) {
  const thumbUri = getThumbUrl(post);

  return (
    <TouchableOpacity
      style={{ width: size, height: size * 1.35, backgroundColor: '#111' }}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {thumbUri ? (
        <Image
          source={{ uri: thumbUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' }]}>
          <IcPlay size={24} color="rgba(255,255,255,0.4)" />
        </View>
      )}

      {/* Overlay gradient bas */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      {/* Play icon + view count */}
      <View style={{
        position: 'absolute', bottom: 5, left: 5,
        flexDirection: 'row', alignItems: 'center', gap: 3,
      }}>
        <IcPlay size={11} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
          {fmt(post.view_count)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// Dans la grille :
const GRID_GAP = 1.5;
const SCREEN_W = Dimensions.get('window').width;
const THUMB_SIZE = (SCREEN_W - GRID_GAP * 2) / 3;

// FlatList config :
<FlatList
  data={videoPosts}
  numColumns={3}
  keyExtractor={p => p.id}
  ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
  columnWrapperStyle={{ gap: GRID_GAP }}
  renderItem={({ item }) => (
    <PostThumb
      post={item}
      size={THUMB_SIZE}
      onPress={() => nav.navigate('VideoPlayer', { postId: item.id })}
    />
  )}
/>
```

---

## 🔴 BUG-03 : Tab naming feed incohérent

### Problème
Le code utilise `'suivis'` comme clé mais affiche "Communauté" (qui est le trending feed).
Nommage confus pour le dev et l'utilisateur.

### Fichier : `src/screens/feed/FeedScreen.tsx`

### Solution :
```typescript
// Renommer les tabs pour être cohérent avec TikTok
// TikTok : Following | For You | (Threads)
// Nour : Abonnés | Pour toi | Fils

type FeedTab = 'abonnes' | 'pourtoi' | 'fils';

// Affichage :
const TAB_LABELS: Record<FeedTab, string> = {
  abonnes: 'Abonnés',
  pourtoi: 'Pour toi',
  fils: 'Fils',
};

// Dans le state initial :
const [tab, setTab] = useState<FeedTab>('pourtoi');

// Dans les queries — renommer les queryKeys aussi :
queryKey: ['following-feed']  // pour abonnes
queryKey: ['feed']            // pour pourtoi
queryKey: ['threads']         // pour fils

// Les 3 tabs dans le header :
{(['abonnes', 'pourtoi', 'fils'] as FeedTab[]).map(key => (
  <TouchableOpacity
    key={key}
    onPress={key === 'pourtoi' ? handlePourToiPress : () => setTab(key)}
    style={styles.tabBtn}
    activeOpacity={0.8}
  >
    <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
      {TAB_LABELS[key]}
    </Text>
    {tab === key && <View style={styles.tabUnderline} />}
  </TouchableOpacity>
))}
```

---

## 🔴 BUG-04 : Avatar composant non unifié

### Problème
Le composant Avatar dans `src/components/ui/Avatar.tsx` n'est pas utilisé partout.
Chaque écran réinvente sa propre version → incohérence visuelle.

### Solution — Refaire `src/components/ui/Avatar.tsx` :

```typescript
import React from 'react';
import { View, Image, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT } from '../../constants/theme';
import { IcPlay } from './Icons';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  hasStory?: boolean;
  isLive?: boolean;
  onPress?: () => void;
  showFollowBadge?: boolean;
  isFollowing?: boolean;
  onFollow?: () => void;
}

export function Avatar({
  uri,
  name,
  size = 40,
  hasStory = false,
  isLive = false,
  onPress,
  showFollowBadge = false,
  isFollowing = false,
  onFollow,
}: AvatarProps) {
  const theme = useTheme();
  const ringColor = isLive ? '#FF3B30' : '#00E57A';
  const hasRing = hasStory || isLive;

  const inner = (
    <View style={{ position: 'relative' }}>
      {/* Ring */}
      {hasRing && (
        <View style={[
          avatarStyles.ring,
          {
            width: size + 8,
            height: size + 8,
            borderRadius: (size + 8) / 2,
            borderColor: ringColor,
            shadowColor: ringColor,
            top: -4,
            left: -4,
          }
        ]} />
      )}

      {/* Image ou initiale */}
      {uri ? (
        <Image
          source={{ uri }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: hasRing ? 2 : 0,
            borderColor: '#000',
          }}
        />
      ) : (
        <View style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.primaryBg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: hasRing ? 2 : 0,
            borderColor: '#000',
          }
        ]}>
          <Text style={{
            fontSize: size * 0.38,
            fontWeight: FONT.weight.bold,
            color: COLORS.primary,
          }}>
            {name[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
      )}

      {/* Badge LIVE */}
      {isLive && (
        <View style={avatarStyles.liveBadge}>
          <Text style={avatarStyles.liveBadgeText}>LIVE</Text>
        </View>
      )}

      {/* Follow badge */}
      {showFollowBadge && !isFollowing && (
        <TouchableOpacity
          style={avatarStyles.followBadge}
          onPress={onFollow}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={avatarStyles.followBadgeText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

const avatarStyles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 2.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
    zIndex: -1,
  },
  liveBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  liveBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  followBadge: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  followBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
});
```

### Remplacer dans TOUS ces fichiers :
- `VideoPlayerItem.tsx` → utiliser `<Avatar uri={post.user.avatar_url} name={post.user.display_name} ... />`
- `MessagesScreen.tsx` → dans les conversations et stories cercles
- `CommentsBottomSheet.tsx` → avatars commentaires
- `NotificationsScreen.tsx` → avatars notifs
- `UserProfileScreen.tsx` → avatar du profil visité
- `ConversationScreen.tsx` → avatars dans le chat

---

## 🔴 BUG-05 : UserProfile boutons d'action

### Problème (screenshot)
Sur le profil d'un autre utilisateur, les boutons "S'abonner" et "Message" sont peu clairs
et peu distincts. Sur TikTok : "Follow" est un gros pill vert rempli, "Message" est outline.

### Fichier : `src/screens/profile/UserProfileScreen.tsx`

### Solution — Section boutons d'action :

```typescript
function ProfileActions({
  isFollowing,
  canMessage,  // basé sur règles genre islamique
  onFollow,
  onMessage,
  onLive,
  isLive,
}: ProfileActionsProps) {
  const [followAnim] = useState(new Animated.Value(1));

  const handleFollow = () => {
    Animated.sequence([
      Animated.timing(followAnim, { toValue: 0.92, duration: 100, useNativeDriver: true }),
      Animated.spring(followAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }),
    ]).start();
    ReactNativeHapticFeedback.trigger('impactMedium', { enableVibrateFallback: true });
    onFollow();
  };

  return (
    <View style={actionStyles.row}>
      {/* Bouton Follow / Suivi */}
      <Animated.View style={{ transform: [{ scale: followAnim }], flex: 1 }}>
        <TouchableOpacity
          style={[
            actionStyles.followBtn,
            isFollowing && actionStyles.followingBtn,
          ]}
          onPress={handleFollow}
          activeOpacity={0.85}
        >
          {isFollowing ? (
            <>
              <IcUserCheck size={16} color={COLORS.primary} />
              <Text style={[actionStyles.followBtnText, { color: COLORS.primary }]}>
                Suivi
              </Text>
            </>
          ) : (
            <Text style={actionStyles.followBtnText}>S'abonner</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Bouton Message — seulement si autorisé par règles islamiques */}
      {canMessage && (
        <TouchableOpacity
          style={actionStyles.messageBtn}
          onPress={onMessage}
          activeOpacity={0.8}
        >
          <IcMessageCircle size={16} color={COLORS.primary} />
          <Text style={actionStyles.messageBtnText}>Message</Text>
        </TouchableOpacity>
      )}

      {/* Bouton Live — si utilisateur est en live */}
      {isLive && (
        <TouchableOpacity
          style={actionStyles.liveBtn}
          onPress={onLive}
          activeOpacity={0.8}
        >
          <IcRadio size={16} color="#fff" />
          <Text style={actionStyles.liveBtnText}>Rejoindre</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const actionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 9999,
    paddingVertical: 11,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    shadowOpacity: 0,
  },
  followBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 9999,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  messageBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  liveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF3B30',
    borderRadius: 9999,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  liveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
```

---

## 🔴 BUG-06 : Caption @mentions non tappables

### Problème
Dans `VideoPlayerItem.tsx`, le composant `CaptionText` colore les `#hashtag` en vert
mais les `@mentions` ne sont pas cliquables.

### Fichier : `src/components/video/VideoPlayerItem.tsx`

### Solution — Remplacer `CaptionText` :

```typescript
function CaptionText({
  text,
  expanded,
  onHashtag,
  onMention,
}: {
  text: string;
  expanded: boolean;
  onHashtag?: (tag: string) => void;
  onMention?: (username: string) => void;
}) {
  // Séparer le texte en tokens : mots normaux, #hashtags, @mentions
  const tokens = text.split(/(\s+|(?=#)|(?=@))/g).filter(Boolean);

  return (
    <Text style={styles.caption} numberOfLines={expanded ? undefined : 2}>
      {tokens.map((token, i) => {
        if (token.startsWith('#')) {
          const tag = token.slice(1);
          return (
            <Text
              key={i}
              style={styles.captionTag}
              onPress={() => onHashtag?.(tag)}
              suppressHighlighting
            >
              {token}
            </Text>
          );
        }
        if (token.startsWith('@')) {
          const username = token.slice(1);
          return (
            <Text
              key={i}
              style={styles.captionMention}
              onPress={() => onMention?.(username)}
              suppressHighlighting
            >
              {token}
            </Text>
          );
        }
        return token;
      })}
    </Text>
  );
}

// Dans les styles, ajouter :
captionMention: {
  color: COLORS.white,
  fontWeight: FONT.weight.semibold,
  textDecorationLine: 'underline',
},
captionTag: {
  color: '#7DFFB8', // vert clair sur fond vidéo sombre
  fontWeight: FONT.weight.semibold,
},

// Usage dans VideoPlayerItem, passer les handlers :
<CaptionText
  text={post.caption}
  expanded={captionExpanded}
  onHashtag={(tag) => nav.navigate('Hashtag', { tag })}
  onMention={(username) => {
    // Chercher l'ID depuis le username — ou naviguer par username directement
    // Idéalement : POST /users/by-username/:username ou GET /users?username=xxx
    api.get(`/users/by-username/${username}`)
      .then(r => nav.navigate('UserProfile', { userId: r.data.id, username }))
      .catch(() => {});
  }}
/>
```

### Backend : s'assurer que `GET /users/by-username/:username` existe.
Si non : l'ajouter dans le backend (simple lookup par username).

---

## 🔴 BUG-07 : Notifications non accessibles depuis le profil

### Problème
La cloche de notifications n'est accessible que depuis `MessagesScreen`.
Sur TikTok : accessible depuis le profil ET depuis le feed.

### Fichier : `src/screens/profile/ProfileScreen.tsx`

### Solution — Ajouter dans le header du profil :

```typescript
// Header ProfileScreen — actuellement : @username + menu
// Nouveau : @username (centre) + cloche (droite) + menu (droite aussi)

// Fetch non-lus count
const { data: notifData } = useQuery({
  queryKey: ['notif-unread-count'],
  queryFn: () => api.get('/notifications/unread-count').then(r => r.data as { count: number }).catch(() => ({ count: 0 })),
  refetchInterval: 30_000,
});
const unreadCount = notifData?.count ?? 0;

// Dans le header :
<View style={styles.headerRow}>
  <Text style={styles.headerUsername}>@{user?.username}</Text>
  <View style={{ flexDirection: 'row', gap: 8 }}>
    {/* Cloche notifications avec badge */}
    <TouchableOpacity
      style={styles.headerBtn}
      onPress={() => nav.navigate('Notifications')}
      activeOpacity={0.8}
    >
      <IcBell size={22} color={theme.text} />
      {unreadCount > 0 && (
        <View style={styles.notifBadge}>
          <Text style={styles.notifBadgeText}>
            {unreadCount > 99 ? '99+' : String(unreadCount)}
          </Text>
        </View>
      )}
    </TouchableOpacity>

    {/* Menu */}
    <TouchableOpacity
      style={styles.headerBtn}
      onPress={() => nav.navigate('Settings')}
      activeOpacity={0.8}
    >
      <IcMenu size={22} color={theme.text} />
    </TouchableOpacity>
  </View>
</View>

// Styles à ajouter :
notifBadge: {
  position: 'absolute',
  top: 0,
  right: 0,
  minWidth: 16,
  height: 16,
  borderRadius: 8,
  backgroundColor: '#FF3B30',
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 3,
  borderWidth: 1.5,
  borderColor: theme.bg,
},
notifBadgeText: {
  fontSize: 9,
  fontWeight: '800',
  color: '#fff',
},
```

### Backend : s'assurer que `GET /notifications/unread-count` → `{ count: number }` existe.

---

## 🔴 BUG-08 : Explore grille trop petite (3 → 2 colonnes)

### Problème
La grille de `ExploreScreen` en 3 colonnes donne des thumbnails trop petits pour voir
les vidéos. TikTok Discover utilise 2 colonnes avec des thumbnails plus grands.

### Fichier : `src/screens/explore/ExploreScreen.tsx`

### Solution :

```typescript
const GAP = 2;
const SCREEN_W = Dimensions.get('window').width;
const THUMB_W = (SCREEN_W - GAP) / 2;
const THUMB_H = THUMB_W * 1.5; // format portrait 2:3

// Composant thumbnail :
function ExploreThumbnail({ post, onPress }: { post: any; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={{ width: THUMB_W, height: THUMB_H, backgroundColor: '#111' }}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {post.thumbnail_url ? (
        <Image
          source={{ uri: post.thumbnail_url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1A1A1A' }]} />
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      {/* Stats overlay */}
      <View style={{ position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <IcPlay size={12} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
          {fmt(post.view_count)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// FlatList :
<FlatList
  data={videos}
  numColumns={2}
  keyExtractor={p => p.id}
  ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
  columnWrapperStyle={{ gap: GAP }}
  renderItem={({ item }) => (
    <ExploreThumbnail
      post={item}
      onPress={() => nav.navigate('VideoPlayer', { postId: item.id })}
    />
  )}
/>
```

---

## 🔴 BUG-09 : Seek bar thumb — amélioration

### Problème
Le thumb (cercle vert) de la progress bar est toujours visible même sans interaction.
Sur TikTok : le thumb est plus discret par défaut, s'agrandit au touch.

### Fichier : `src/components/video/VideoPlayerItem.tsx`

### Solution :

```typescript
// Ajouter un state pour savoir si l'utilisateur touche la seek bar
const thumbScale = useRef(new Animated.Value(1)).current;

// Dans seekPanResponder :
onPanResponderGrant: () => {
  setSeeking(true);
  Animated.spring(thumbScale, {
    toValue: 1.5,
    useNativeDriver: true,
    tension: 400,
    friction: 10,
  }).start();
  // ... reste du code
},
onPanResponderRelease: () => {
  setSeeking(false);
  Animated.spring(thumbScale, {
    toValue: 1,
    useNativeDriver: true,
    tension: 300,
    friction: 10,
  }).start();
},

// Dans le rendu du thumb :
<Animated.View style={[
  styles.progressThumb,
  {
    left: `${Math.round(progress * 100)}%`,
    transform: [{ scale: thumbScale }],
  }
]} />
```

---

## 🔴 BUG-10 : EditProfile plein écran → Bottom Sheet

### Problème
`EditProfileScreen` s'ouvre en plein écran Modal. C'est lourd.
Sur TikTok : "Edit profile" est un sheet du bas fluide.

### Solution — Transformer en Bottom Sheet :

```typescript
// Dans ProfileScreen, à la place du Modal plein écran :
import { EditProfileSheet } from './EditProfileSheet'; // nouveau fichier

// State :
const [editSheetVisible, setEditSheetVisible] = useState(false);

// Render :
<EditProfileSheet
  visible={editSheetVisible}
  onClose={() => setEditSheetVisible(false)}
  user={user}
  onSave={async (data) => {
    await api.patch('/users/me', data);
    updateUser(data);
    setEditSheetVisible(false);
  }}
/>
```

### Créer `src/screens/profile/EditProfileSheet.tsx` :

```typescript
export function EditProfileSheet({ visible, onClose, user, onSave }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 520,
        damping: 42,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.bezier(0.4, 0, 1, 1),
      }).start();
    }
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await onSave({ display_name: displayName.trim(), bio: bio.trim() });
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sheet */}
      <Animated.View style={[{
        backgroundColor: theme.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: Math.max(insets.bottom, 24) + 16,
        paddingTop: 12,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        transform: [{ translateY }],
      }]}>
        {/* Handle */}
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 20 }} />

        {/* Title */}
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 24 }}>
          Modifier le profil
        </Text>

        {/* Nom affiché */}
        <Text style={{ fontSize: 13, color: theme.textMuted, marginBottom: 6, fontWeight: '500' }}>Nom affiché</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          style={{
            backgroundColor: theme.surfaceAlt,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            color: theme.text,
            marginBottom: 16,
          }}
          placeholder="Ton nom affiché"
          placeholderTextColor={theme.textSubtle}
          maxLength={50}
        />

        {/* Bio */}
        <Text style={{ fontSize: 13, color: theme.textMuted, marginBottom: 6, fontWeight: '500' }}>
          Bio ({bio.length}/150)
        </Text>
        <TextInput
          value={bio}
          onChangeText={t => setBio(t.slice(0, 150))}
          style={{
            backgroundColor: theme.surfaceAlt,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            color: theme.text,
            marginBottom: 8,
            height: 90,
            textAlignVertical: 'top',
          }}
          placeholder="Parle de toi..."
          placeholderTextColor={theme.textSubtle}
          multiline
          maxLength={150}
        />

        {/* Username (read-only) */}
        <Text style={{ fontSize: 13, color: theme.textSubtle, marginBottom: 24 }}>
          @{user?.username} — le nom d'utilisateur n'est pas modifiable
        </Text>

        {/* Bouton enregistrer */}
        <TouchableOpacity
          style={{
            backgroundColor: saving ? 'rgba(45,122,79,0.5)' : COLORS.primary,
            borderRadius: 9999,
            paddingVertical: 15,
            alignItems: 'center',
          }}
          onPress={handleSave}
          disabled={saving || !displayName.trim()}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Enregistrer</Text>
          }
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}
```

---

## 📋 VALIDATION PHASE 1

Avant de passer à la Phase 2, vérifier sur l'iPhone physique :

1. **Profile** : cover gradient vert foncé + bouton caméra → upload fonctionne
2. **Grille** : chaque thumbnail affiche play icon + view count
3. **Feed** : tabs "Abonnés | Pour toi | Fils" dans le bon ordre
4. **Avatar** : partout cohérent (initiale colorée si pas de photo)
5. **UserProfile** : bouton "S'abonner" vert plein, "Message" outline
6. **Caption** : @mentions tappables → naviguent vers le profil
7. **Profil** : cloche en haut à droite avec badge rouge
8. **Explore** : 2 colonnes avec thumbnails plus grands
9. **Seek bar** : thumb s'agrandit au touch
10. **Edit profil** : s'ouvre comme un sheet du bas

**Si un seul de ces points échoue → corriger avant de continuer.**

```bash
git add -A && git commit -m "fix: Phase 1 — bugs critiques UX résolus"
git push origin main
```
