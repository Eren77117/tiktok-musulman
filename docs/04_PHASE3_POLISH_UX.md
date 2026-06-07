# 04 — PHASE 3 : POLISH UX & ANIMATIONS
## Les détails qui font la différence entre "bonne app" et "TikTok"

---

## ✅ CHECKLIST PHASE 3

- [ ] UX-01 : Animations boutons (spring bounce sur tous)
- [ ] UX-02 : Tab indicator animé (slide entre tabs)
- [ ] UX-03 : Like count animation (number bounce)
- [ ] UX-04 : Son marquee (texte défilant)
- [ ] UX-05 : Commentaires améliorés (header, sort, creator liked, replies)
- [ ] UX-06 : Messages améliorés (typing indicator, vu/non vu, swipe reply)
- [ ] UX-07 : Notifications UI améliorée
- [ ] UX-08 : Profile stats animées + tab slide
- [ ] UX-09 : Toast notifications (feedback actions)
- [ ] UX-10 : Swipe profile indicator visuel dans feed

---

## 🎨 UX-01 : Animations boutons — spring bounce

### Règle TikTok
Sur TikTok, CHAQUE bouton a une réaction physique au tap.
L'utilisateur sent que l'app répond immédiatement.

### Composant `AnimatedPressable` à créer :

```typescript
// src/components/ui/AnimatedPressable.tsx
import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

interface AnimatedPressableProps extends PressableProps {
  scale?: number;           // Scale à atteindre au tap (défaut: 0.88)
  tension?: number;         // Spring tension pour le rebond
  friction?: number;        // Spring friction
  haptic?: 'light' | 'medium' | 'none';
  children: React.ReactNode;
}

export function AnimatedPressable({
  scale = 0.88,
  tension = 300,
  friction = 10,
  haptic = 'light',
  onPress,
  children,
  style,
  ...props
}: AnimatedPressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: scale,
      useNativeDriver: true,
      tension: 400,
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension,
      friction,
    }).start();
  };

  const handlePress = (e: any) => {
    if (haptic !== 'none') {
      ReactNativeHapticFeedback.trigger(
        haptic === 'medium' ? 'impactMedium' : 'impactLight',
        { enableVibrateFallback: true }
      );
    }
    onPress?.(e);
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      {...props}
    >
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
```

### Utiliser partout à la place de `TouchableOpacity` :
```typescript
// AVANT
<TouchableOpacity onPress={handleLike} activeOpacity={0.7}>
  <IcHeart size={24} color={theme.text} />
</TouchableOpacity>

// APRÈS
<AnimatedPressable onPress={handleLike} scale={0.82} haptic="medium">
  <IcHeart size={24} color={theme.text} />
</AnimatedPressable>
```

---

## 🎨 UX-02 : Tab indicator animé

### Problème
Quand on change d'onglet dans le profil ou le feed, le soulignement saute instantanément.
TikTok : le soulignement slide en douceur.

### Solution — Composant AnimatedTabBar :

```typescript
// src/components/ui/AnimatedTabBar.tsx
import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, ScrollView } from 'react-native';
import { COLORS, FONT } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface Tab {
  key: string;
  label: string;
}

interface AnimatedTabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  scrollable?: boolean;
  underlineColor?: string;
  variant?: 'light' | 'dark'; // light = fond blanc (profil), dark = transparent (feed)
}

export function AnimatedTabBar({
  tabs,
  activeTab,
  onTabChange,
  scrollable = false,
  underlineColor = COLORS.primary,
  variant = 'light',
}: AnimatedTabBarProps) {
  const theme = useTheme();
  const underlineX = useRef(new Animated.Value(0)).current;
  const tabWidthsRef = useRef<Record<string, number>>({});
  const tabOffsetsRef = useRef<Record<string, number>>({});
  const activeIndex = tabs.findIndex(t => t.key === activeTab);

  const animateToTab = (key: string) => {
    const offset = tabOffsetsRef.current[key] ?? 0;
    const width = tabWidthsRef.current[key] ?? 0;
    
    // Centrer le soulignement sous le tab
    Animated.spring(underlineX, {
      toValue: offset + (width - 40) / 2, // 40px = largeur underline fixe
      useNativeDriver: true,
      stiffness: 420,
      damping: 34,
    }).start();
  };

  useEffect(() => {
    animateToTab(activeTab);
  }, [activeTab]);

  const Container = scrollable ? ScrollView : View;
  const containerProps = scrollable
    ? { horizontal: true, showsHorizontalScrollIndicator: false }
    : { style: { flexDirection: 'row' as const } };

  return (
    <View style={{ position: 'relative' }}>
      <Container {...containerProps}>
        {tabs.map((tab, index) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}
              onLayout={(e) => {
                tabWidthsRef.current[tab.key] = e.nativeEvent.layout.width;
                tabOffsetsRef.current[tab.key] = e.nativeEvent.layout.x;
              }}
              style={{
                paddingHorizontal: scrollable ? 16 : 0,
                flex: scrollable ? undefined : 1,
                alignItems: 'center',
                paddingVertical: 12,
              }}
            >
              <Text style={{
                fontSize: FONT.size.sm,
                fontWeight: isActive ? FONT.weight.bold : FONT.weight.medium,
                color: isActive
                  ? (variant === 'dark' ? '#fff' : theme.text)
                  : (variant === 'dark' ? 'rgba(255,255,255,0.5)' : theme.textMuted),
              }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </Container>

      {/* Animated underline */}
      <Animated.View style={{
        position: 'absolute',
        bottom: 0,
        width: 40,
        height: 2.5,
        borderRadius: 2,
        backgroundColor: variant === 'dark' ? '#fff' : underlineColor,
        transform: [{ translateX: underlineX }],
      }} />
      
      {/* Separator line */}
      <View style={{
        height: 1,
        backgroundColor: theme.borderLight,
      }} />
    </View>
  );
}

// Usage dans ProfileScreen :
<AnimatedTabBar
  tabs={[
    { key: 'videos', label: 'Vidéos' },
    { key: 'fils', label: 'Fils' },
    { key: 'jaime', label: "J'aime" },
    { key: 'favoris', label: 'Favoris' },
    { key: 'reposts', label: 'Reposts' },
  ]}
  activeTab={activeTabKey}
  onTabChange={setActiveTabKey}
  scrollable={true}
/>

// Usage dans FeedScreen header :
<AnimatedTabBar
  tabs={[
    { key: 'abonnes', label: 'Abonnés' },
    { key: 'pourtoi', label: 'Pour toi' },
    { key: 'fils', label: 'Fils' },
  ]}
  activeTab={tab}
  onTabChange={handleTabChange}
  variant="dark"
/>
```

---

## 🎨 UX-03 : Like count — animation nombre

### Problème
Le count de likes change sans animation. Sur TikTok, le chiffre "rebondit" quand il change.

### Solution — AnimatedNumber :

```typescript
// src/components/ui/AnimatedNumber.tsx
import React, { useRef, useEffect } from 'react';
import { Animated, Text, TextStyle } from 'react-native';

interface AnimatedNumberProps {
  value: number;
  formatter?: (n: number) => string;
  style?: TextStyle;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function AnimatedNumber({ value, formatter = fmt, style }: AnimatedNumberProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      // Bounce animation
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.4,
          useNativeDriver: true,
          tension: 600,
          friction: 5,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
      ]).start();
    }
  }, [value]);

  return (
    <Animated.Text style={[style, { transform: [{ scale: scaleAnim }] }]}>
      {formatter(value)}
    </Animated.Text>
  );
}

// Dans VideoPlayerItem, remplacer le count statique :
// AVANT
<Text style={styles.actionCount}>{fmt(likeCount)}</Text>

// APRÈS
<AnimatedNumber value={likeCount} style={[styles.actionCount, { color: liked ? '#FF3B5C' : COLORS.white }]} />
```

---

## 🎨 UX-04 : Son marquee (texte défilant)

### Problème
Quand le titre du son est trop long, il est tronqué avec "...".
Sur TikTok : le texte scroll en boucle (effet marquee).

### Solution — MarqueeText :

```typescript
// src/components/ui/MarqueeText.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Animated, Text, View, TextStyle } from 'react-native';
import { Easing } from 'react-native';

interface MarqueeTextProps {
  text: string;
  style?: TextStyle;
  speed?: number; // pixels per second (défaut: 40)
  containerWidth?: number;
  pauseDuration?: number; // ms de pause avant de repartir
}

export function MarqueeText({
  text,
  style,
  speed = 40,
  containerWidth = 200,
  pauseDuration = 1500,
}: MarqueeTextProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (textWidth <= containerWidth) {
      // Texte assez court → pas de scroll
      translateX.setValue(0);
      return;
    }

    const distance = textWidth - containerWidth + 20;
    const duration = (distance / speed) * 1000;

    const runAnimation = () => {
      animRef.current = Animated.sequence([
        Animated.delay(pauseDuration),
        Animated.timing(translateX, {
          toValue: -distance,
          duration,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
        Animated.delay(pauseDuration),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]);

      animRef.current = Animated.loop(animRef.current as any);
      (animRef.current as any).start();
    };

    runAnimation();
    return () => animRef.current?.stop();
  }, [textWidth, containerWidth, speed]);

  return (
    <View style={{ width: containerWidth, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <Text
          style={style}
          numberOfLines={1}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        >
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

// Dans VideoPlayerItem — son row :
<TouchableOpacity
  style={styles.soundRow}
  onPress={() => nav.navigate('Sound', { ... })}
  activeOpacity={0.8}
>
  <IcMusic size={13} color={COLORS.white} />
  <MarqueeText
    text={`${post.sound.title}${post.sound.artist ? ` · ${post.sound.artist}` : ''}`}
    style={styles.soundText}
    containerWidth={W * 0.45} // Limiter à 45% de la largeur
  />
</TouchableOpacity>
```

---

## 🎨 UX-05 : Commentaires améliorés

### Fichier : `src/components/video/CommentsBottomSheet.tsx`

### Améliorations complètes :

```typescript
// A. Header amélioré
<View style={commentStyles.header}>
  <View style={commentStyles.handle} />
  <View style={commentStyles.titleRow}>
    <Text style={commentStyles.title}>
      {totalCount > 0 ? `${fmt(totalCount)} commentaires` : 'Commentaires'}
    </Text>
    <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <IcX size={22} color={theme.textMuted} />
    </TouchableOpacity>
  </View>
  
  {/* Sort chips */}
  <View style={commentStyles.sortRow}>
    {(['likes', 'recent'] as const).map(sort => (
      <TouchableOpacity
        key={sort}
        style={[commentStyles.sortChip, activeSort === sort && commentStyles.sortChipActive]}
        onPress={() => setActiveSort(sort)}
        activeOpacity={0.7}
      >
        <Text style={[commentStyles.sortChipText, activeSort === sort && commentStyles.sortChipTextActive]}>
          {sort === 'likes' ? 'Les plus aimés' : 'Récents'}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
</View>

// Styles pour le header :
commentStyles = {
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: theme.text },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sortChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border,
  },
  sortChipActive: { backgroundColor: theme.primaryBg, borderColor: COLORS.primary },
  sortChipText: { fontSize: 12, fontWeight: '500', color: theme.textMuted },
  sortChipTextActive: { color: COLORS.primary, fontWeight: '600' },
}

// B. Composant comment item amélioré :
function CommentItem({
  comment,
  isCreator,
  onLike,
  onReply,
  onLongPress,
}: CommentItemProps) {
  const theme = useTheme();
  const [liked, setLiked] = useState(comment.is_liked);
  const [likeCount, setLikeCount] = useState(comment.like_count);
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleLike = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }),
    ]).start();
    setLiked(l => !l);
    setLikeCount(c => liked ? c - 1 : c + 1);
    onLike(comment.id, !liked);
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Avatar uri={comment.user.avatar_url} name={comment.user.display_name} size={36} />
        
        <View style={{ flex: 1 }}>
          {/* Username + timestamp */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.primary }}>
              @{comment.user.username}
            </Text>
            <Text style={{ fontSize: 11, color: theme.textSubtle }}>
              {formatRelativeTime(comment.created_at)}
            </Text>
          </View>

          {/* Contenu */}
          <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20 }}>
            {comment.content}
          </Text>

          {/* "aimé par l'auteur" */}
          {comment.creator_liked && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
              <IcHeartFill size={10} color="#FF3B5C" />
              <Text style={{ fontSize: 10, color: '#FF3B5C', fontWeight: '500' }}>
                aimé par l'auteur
              </Text>
            </View>
          )}

          {/* Actions : Répondre */}
          <TouchableOpacity
            onPress={() => onReply(comment)}
            style={{ marginTop: 5 }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 12, color: theme.textSubtle, fontWeight: '500' }}>
              Répondre
            </Text>
          </TouchableOpacity>

          {/* Voir réponses */}
          {comment.reply_count > 0 && (
            <TouchableOpacity
              onPress={() => setRepliesExpanded(e => !e)}
              style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              activeOpacity={0.7}
            >
              <View style={{ width: 20, height: 1, backgroundColor: COLORS.primary }} />
              <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: '600' }}>
                {repliesExpanded ? 'Masquer les réponses' : `Voir ${comment.reply_count} réponse${comment.reply_count > 1 ? 's' : ''}`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Réponses expandées */}
          {repliesExpanded && comment.replies?.map(reply => (
            <View key={reply.id} style={{ marginTop: 10, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: theme.borderLight }}>
              <CommentItem
                comment={reply}
                isCreator={isCreator}
                onLike={onLike}
                onReply={onReply}
                onLongPress={onLongPress}
              />
            </View>
          ))}
        </View>

        {/* Like bouton (colonne droite) */}
        <View style={{ alignItems: 'center', gap: 2 }}>
          <TouchableOpacity onPress={handleLike} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              {liked
                ? <IcHeartFill size={18} color="#FF3B5C" />
                : <IcHeart size={18} color={theme.textSubtle} />
              }
            </Animated.View>
          </TouchableOpacity>
          {likeCount > 0 && (
            <Text style={{ fontSize: 11, color: theme.textSubtle }}>
              {fmt(likeCount)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// C. Input amélioré (bas du sheet) :
<View style={{
  flexDirection: 'row',
  alignItems: 'flex-end',
  gap: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderTopWidth: 1,
  borderTopColor: theme.borderLight,
  paddingBottom: Math.max(insets.bottom, 12),
}}>
  <Avatar uri={currentUser?.avatar_url} name={currentUser?.display_name ?? 'U'} size={32} />
  
  {/* Reply preview */}
  {replyingTo && (
    <View style={{
      position: 'absolute', top: -44, left: 12, right: 12,
      backgroundColor: theme.surfaceAlt, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 8,
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderLeftWidth: 3, borderLeftColor: COLORS.primary,
    }}>
      <Text style={{ flex: 1, fontSize: 12, color: theme.textMuted }} numberOfLines={1}>
        Réponse à @{replyingTo.user.username}: {replyingTo.content}
      </Text>
      <TouchableOpacity onPress={() => setReplyingTo(null)}>
        <IcX size={14} color={theme.textMuted} />
      </TouchableOpacity>
    </View>
  )}
  
  <TextInput
    style={{
      flex: 1,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 22,
      paddingHorizontal: 14,
      paddingVertical: 9,
      fontSize: 14,
      color: theme.text,
      maxHeight: 100,
    }}
    placeholder={replyingTo ? `Répondre à @${replyingTo.user.username}...` : 'Ajouter un commentaire...'}
    placeholderTextColor={theme.textSubtle}
    value={inputText}
    onChangeText={setInputText}
    multiline
  />
  
  <AnimatedPressable
    onPress={handleSend}
    disabled={!inputText.trim()}
    scale={0.85}
    haptic="medium"
    style={{
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: inputText.trim() ? COLORS.primary : theme.surfaceAlt,
      alignItems: 'center', justifyContent: 'center',
    }}
  >
    <IcSend size={16} color={inputText.trim() ? '#fff' : theme.textSubtle} />
  </AnimatedPressable>
</View>
```

---

## 🎨 UX-06 : Messages améliorés

### Fichier : `src/screens/messages/ConversationScreen.tsx`

### A. Typing indicator :

```typescript
// State
const [otherUserTyping, setOtherUserTyping] = useState(false);
const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// Socket.IO — écouter l'indicateur de frappe
useEffect(() => {
  if (!socket || !conversationId) return;
  
  socket.on('typing:start', ({ userId }: { userId: string }) => {
    if (userId !== currentUser?.id) {
      setOtherUserTyping(true);
      // Auto-reset après 3s si on n'entend plus rien
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setOtherUserTyping(false), 3000);
    }
  });
  
  socket.on('typing:stop', ({ userId }: { userId: string }) => {
    if (userId !== currentUser?.id) {
      setOtherUserTyping(false);
    }
  });
  
  return () => {
    socket.off('typing:start');
    socket.off('typing:stop');
  };
}, [socket, conversationId, currentUser?.id]);

// Émettre quand je tape :
const handleTextChange = (text: string) => {
  setInputText(text);
  // Émettre typing:start
  socket?.emit('typing:start', { conversationId });
  // Debounce stop
  if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
  typingDebounceRef.current = setTimeout(() => {
    socket?.emit('typing:stop', { conversationId });
  }, 1500);
};

// Composant TypingIndicator :
function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -5, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      ).start();

    animate(dot1, 0);
    animate(dot2, 150);
    animate(dot3, 300);
  }, []);

  const dotStyle = (anim: Animated.Value) => ({
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: COLORS.primary,
    transform: [{ translateY: anim }],
  });

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 14, paddingVertical: 10,
      backgroundColor: theme.surfaceAlt, borderRadius: 18,
      alignSelf: 'flex-start', marginLeft: 12, marginBottom: 4,
    }}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}

// Dans le rendu, avant le ListFooterComponent :
{otherUserTyping && <TypingIndicator />}
```

### B. Statut vu/non vu :

```typescript
// Dans la bulle de message envoyée par moi :
<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2 }}>
  <Text style={{ fontSize: 10, color: theme.textSubtle }}>
    {formatTime(message.created_at)}
  </Text>
  {/* Statut */}
  {message.is_read ? (
    // Vu → double tick vert
    <View style={{ flexDirection: 'row' }}>
      <IcCheck size={10} color={COLORS.primary} />
      <IcCheck size={10} color={COLORS.primary} style={{ marginLeft: -5 }} />
    </View>
  ) : (
    // Envoyé → single tick gris
    <IcCheck size={10} color={theme.textSubtle} />
  )}
</View>
```

### C. Swipe to reply (améliorer) :

```typescript
// Le swipe pour répondre existe. S'assurer qu'il y a un feedback visuel :
// Quand dx > 40px → afficher une preview de l'icône reply qui grossit :
const replyIconScale = swipeProgress.interpolate({
  inputRange: [0, 60],
  outputRange: [0, 1],
  extrapolate: 'clamp',
});

// Afficher à gauche de la bulle :
<Animated.View style={{
  position: 'absolute',
  left: -30,
  opacity: replyIconScale,
  transform: [{ scale: replyIconScale }],
}}>
  <IcCornerUpLeft size={18} color={COLORS.primary} />
</Animated.View>
```

---

## 🎨 UX-07 : Notifications UI

### Fichier : `src/screens/notifications/NotificationsScreen.tsx`

### Composant NotifItem amélioré :

```typescript
function NotifItem({ notif, onPress }: { notif: Notification; onPress: () => void }) {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(notif.is_read ? 1 : 0)).current;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: notif.is_read ? theme.surface : theme.primaryBg,
        borderBottomWidth: 1,
        borderBottomColor: theme.borderLight,
      }}
    >
      {/* Avatar avec badge type */}
      <View style={{ position: 'relative' }}>
        <Avatar uri={notif.actor?.avatar_url} name={notif.actor?.display_name ?? 'N'} size={44} />
        {/* Badge type icône */}
        <View style={[notifBadgeStyle(notif.type)]}>
          {getNotifIcon(notif.type)}
        </View>
      </View>

      {/* Texte */}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 13, color: theme.text, lineHeight: 18 }}>
          <Text style={{ fontWeight: '600' }}>
            {notif.actor?.display_name ?? 'Quelqu\'un'}
          </Text>
          {' '}{getNotifText(notif.type, notif.metadata)}
        </Text>
        <Text style={{ fontSize: 11, color: theme.textSubtle }}>
          {formatRelativeTime(notif.created_at)}
        </Text>
      </View>

      {/* Thumbnail si applicable */}
      {notif.post?.thumbnail_url && (
        <Image
          source={{ uri: notif.post.thumbnail_url }}
          style={{ width: 44, height: 58, borderRadius: 6 }}
          resizeMode="cover"
        />
      )}
    </TouchableOpacity>
  );
}

function getNotifIcon(type: string) {
  const size = 12;
  switch (type) {
    case 'LIKE': return <IcHeartFill size={size} color="#fff" />;
    case 'COMMENT': return <IcComment size={size} color="#fff" />;
    case 'FOLLOW': return <IcUserPlus size={size} color="#fff" />;
    case 'MENTION': return <IcAtSign size={size} color="#fff" />;
    case 'SAVE': return <IcBookmark size={size} color="#fff" />;
    case 'LIVE_START': return <IcRadio size={size} color="#fff" />;
    default: return <IcBell size={size} color="#fff" />;
  }
}

function notifBadgeStyle(type: string) {
  const colors: Record<string, string> = {
    LIKE: '#FF3B5C',
    COMMENT: '#3B82F6',
    FOLLOW: COLORS.primary,
    MENTION: '#F59E0B',
    SAVE: '#8B5CF6',
    LIVE_START: '#FF3B30',
  };
  return {
    position: 'absolute' as const,
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors[type] ?? '#6B7280',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: 'white',
  };
}
```

---

## 🎨 UX-08 : Stats profil animées

### Fichier : `src/screens/profile/ProfileScreen.tsx`

### Compteurs qui s'animent au chargement :

```typescript
// Créer un hook useCountUp :
function useCountUp(target: number, duration = 800) {
  const [current, setCurrent] = useState(0);
  const animRef = useRef<Animated.Value>(new Animated.Value(0));

  useEffect(() => {
    if (target === 0) return;
    
    Animated.timing(animRef.current, {
      toValue: target,
      duration,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic),
    }).start();

    const listener = animRef.current.addListener(({ value }) => {
      setCurrent(Math.round(value));
    });

    return () => animRef.current.removeListener(listener);
  }, [target]);

  return current;
}

// Composant StatItem avec count-up :
function StatItem({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  const theme = useTheme();
  const animatedValue = useCountUp(value);

  return (
    <TouchableOpacity
      style={styles.statItem}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Text style={styles.statNumber}>{fmt(animatedValue)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// Usage :
<View style={styles.statsRow}>
  <StatItem
    label="Abonnements"
    value={user.following_count}
    onPress={() => nav.navigate('Followers', { userId: user.id, username: user.username, type: 'following' })}
  />
  <View style={styles.statDivider} />
  <StatItem
    label="Abonnés"
    value={user.follower_count}
    onPress={() => nav.navigate('Followers', { userId: user.id, username: user.username, type: 'followers' })}
  />
  <View style={styles.statDivider} />
  <StatItem
    label="Publications"
    value={user.post_count}
  />
</View>
```

---

## 🎨 UX-09 : Toast notifications in-app

### Créer `src/components/ui/Toast.tsx` :

```typescript
// Toast système global — à placer dans App.tsx
import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONT } from '../../constants/theme';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  text: string;
  type: ToastType;
  duration?: number;
}

interface ToastRef {
  show: (msg: ToastMessage) => void;
}

export const Toast = forwardRef<ToastRef>((_, ref) => {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useImperativeHandle(ref, () => ({
    show: (msg: ToastMessage) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setMessage(msg);
      
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: insets.top + 8,
          useNativeDriver: true,
          stiffness: 400,
          damping: 30,
        }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      timeoutRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => setMessage(null));
      }, msg.duration ?? 2500);
    },
  }));

  if (!message) return null;

  const bgColor = {
    success: '#00C26E',
    error: '#EF4444',
    info: '#111111',
  }[message.type];

  return (
    <Animated.View style={[
      toastStyles.container,
      { backgroundColor: bgColor, transform: [{ translateY }], opacity },
    ]}>
      <Text style={toastStyles.text}>{message.text}</Text>
    </Animated.View>
  );
});

// Singleton ref pour accès global :
export const toastRef = React.createRef<ToastRef>();
export const showToast = (msg: ToastMessage) => toastRef.current?.show(msg);

// Dans App.tsx, en haut de la hiérarchie :
<Toast ref={toastRef} />

// Utilisation partout :
import { showToast } from '../components/ui/Toast';
showToast({ text: 'Vidéo publiée !', type: 'success' });
showToast({ text: 'Erreur réseau, réessaie', type: 'error' });
```

---

## 🎨 UX-10 : Indicateur swipe profil dans feed

### Fichier : `src/components/video/VideoPlayerItem.tsx`

### Afficher un indicateur quand le swipe commence :

```typescript
// State + animation
const [showSwipeHint, setShowSwipeHint] = useState(false);
const hintOpacity = useRef(new Animated.Value(0)).current;

// Dans profilePanResponder.onMoveShouldSetPanResponder :
onMoveShouldSetPanResponder: (evt, g) => {
  const startX = evt.nativeEvent.pageX - g.dx;
  const isSwipingLeft = startX > W * 0.4 && g.dx < -14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3;
  
  if (isSwipingLeft && !showSwipeHint) {
    setShowSwipeHint(true);
    Animated.timing(hintOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }
  
  return isSwipingLeft;
},

onPanResponderRelease: (_, g) => {
  Animated.timing(hintOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowSwipeHint(false));
  // ... reste
},

// Render du hint (top right, sous le bouton mute) :
{showSwipeHint && (
  <Animated.View style={[styles.swipeHint, { opacity: hintOpacity }]}>
    <Avatar
      uri={post.user.avatar_url}
      name={post.user.display_name}
      size={28}
    />
    <Text style={styles.swipeHintText}>@{post.user.username}</Text>
    <IcChevronRight size={14} color="rgba(255,255,255,0.9)" />
  </Animated.View>
)}

// Style :
swipeHint: {
  position: 'absolute',
  top: 54,
  right: 54, // à côté du bouton mute
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
  backgroundColor: 'rgba(0,0,0,0.65)',
  borderRadius: 20,
  paddingHorizontal: 10,
  paddingVertical: 5,
},
swipeHintText: {
  fontSize: 12,
  fontWeight: '600',
  color: 'rgba(255,255,255,0.9)',
},
```

---

## 📋 VALIDATION PHASE 3

Sur iPhone physique, vérifier :

1. Chaque bouton de l'app a une réaction visuelle au tap (spring bounce)
2. Les tabs dans le profil et le feed : l'underline slide en douceur
3. After liking : le count bounce
4. Son long → marquee défile
5. Commentaires : sort chips + "aimé par l'auteur" + replies expandables
6. Conversation : typing indicator animé + vu/non vu
7. Notifications : icônes colorées par type + thumbnail vidéo
8. Profil : stats count-up au chargement
9. Toast apparaît en haut pour les confirmations
10. Swipe profil dans feed : hint "@username →"

```bash
git add -A && git commit -m "feat: Phase 3 — polish UX TikTok-level animations et composants"
git push origin main
```
