# 01 — RÈGLES ABSOLUES NOUR

Ces règles s'appliquent à CHAQUE ligne de code écrite dans ce projet.
Ne jamais les violer, même pour "gagner du temps".

---

## 🎨 DESIGN SYSTEM

### Couleurs (accès via useTheme() UNIQUEMENT)

```typescript
// src/hooks/useTheme.ts — retourne ces valeurs selon le mode
{
  bg: '#F7F7F8',          // light | '#0A0A0A' dark (true black)
  surface: '#FFFFFF',      // light | '#111111' dark
  surfaceAlt: '#F2F2F4',  // light | '#1A1A1A' dark
  text: '#0A0A0B',        // light | '#F5F5F5' dark
  textMuted: '#6B7280',   // light | '#9CA3AF' dark
  textSubtle: '#9CA3AF',  // light | '#6B7280' dark
  border: '#E8E8EA',      // light | '#222222' dark
  borderLight: '#F0F0F2', // light | '#1A1A1A' dark
  primary: '#2D7A4F',     // islamique — identique light/dark
  primaryLight: '#00C26E',// actions vives
  primaryBg: '#EBF5EE',   // light | '#0F2018' dark
  error: '#EF4444',
  warning: '#F59E0B',
}

// COLORS constants (pour les overlays vidéo toujours noirs)
COLORS.white = '#FFFFFF'
COLORS.primary = '#2D7A4F'
COLORS.primaryLight = '#00C26E'
```

### Utilisation dans les composants :
```typescript
// CORRECT
const theme = useTheme();
<View style={{ backgroundColor: theme.surface }}>
  <Text style={{ color: theme.text }}>Bonjour</Text>
</View>

// INTERDIT
<View style={{ backgroundColor: '#ffffff' }}>
  <Text style={{ color: '#000000' }}>Bonjour</Text>
</View>
```

---

## 📐 BORDER RADIUS

```typescript
// Toujours utiliser RADIUS.xxx depuis constants/theme.ts
RADIUS.xs = 4
RADIUS.sm = 8       // inputs, badges
RADIUS.md = 12      // petites cartes
RADIUS.lg = 16      // cartes standard (posts)
RADIUS.xl = 24      // bottom sheets
RADIUS.full = 9999  // pills, boutons, avatars
```

---

## 🔤 TYPOGRAPHIE

```typescript
FONT.size.xs = 11
FONT.size.sm = 13
FONT.size.base = 15
FONT.size.md = 17
FONT.size.lg = 20
FONT.size.xl = 24
FONT.size.xxl = 28

FONT.weight.regular = '400'
FONT.weight.medium = '500'
FONT.weight.semibold = '600'
FONT.weight.bold = '700'
FONT.weight.extrabold = '800'
FONT.weight.black = '900'
```

---

## 📏 SPACING

```typescript
SPACING.xs = 4
SPACING.sm = 8
SPACING.md = 16
SPACING.lg = 24
SPACING.xl = 32
SPACING.xxl = 48
```

---

## 🎬 ANIMATIONS — SPECS EXACTES

### Spring Presets (useNativeDriver: true TOUJOURS)

```typescript
// Navigation slide (entre screens)
{ stiffness: 420, damping: 34 }

// Bottom sheet snap (ouvrir/fermer)
{ stiffness: 520, damping: 42 }

// Modal popup (alerts, toasts)
{ stiffness: 400, damping: 30 }

// Bouton tap bounce
{ stiffness: 600, damping: 20 }

// Like button
{ toValue: 0.82, duration: 80 } → spring back { stiffness: 300, friction: 10 }

// Heart animation (double-tap TikTok)
bounce: spring { tension: 180, friction: 6 } → spring { tension: 200, friction: 8 }
float: timing { toValue: -30, duration: 500, easing: Easing.out(Easing.ease) }
fade: delay 550ms → timing { toValue: 0, duration: 350 }
```

### Easing TikTok smooth :
```typescript
import { Easing } from 'react-native';

// Pour les slides et transitions principales
const EASE_IN_OUT = Easing.bezier(0.22, 1, 0.36, 1);

// Pour les pop-ups
const EASE_OUT_BACK = Easing.bezier(0.34, 1.56, 0.64, 1);

// Pour les dismiss
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);
```

---

## 📱 SAFE AREA

```typescript
// TOUJOURS utiliser useSafeAreaInsets()
const insets = useSafeAreaInsets();

// Header avec safe area
paddingTop: insets.top + 14

// Bottom padding (jamais moins de 24px)
paddingBottom: Math.max(insets.bottom, 24)

// Toasts et banners
bottom: insets.bottom + 80
```

---

## 🎛️ ICÔNES

```typescript
// TOUJOURS importer depuis src/components/ui/Icons.tsx
import { IcHeart, IcComment, IcShare, IcSave } from '../../components/ui/Icons';

// JAMAIS importer directement depuis lucide-react-native
// SAUF pour ajouter une nouvelle icône dans Icons.tsx d'abord

// Format dans Icons.tsx :
export const IcNomIcone = ({ size = 24, color = COLORS.text, strokeWidth = 1.6 }: IconProps) => (
  <NomLucide width={size} height={size} color={color} strokeWidth={strokeWidth} />
);
```

### Icônes manquantes à ajouter dans Icons.tsx :
```typescript
// Vérifier que ces icônes existent, les ajouter si manquantes :
IcEye, IcEyeOff, IcBookmark, IcBookmarkFill, IcMessageCircle,
IcUserPlus, IcUserCheck, IcMoreVertical, IcMoreHorizontal,
IcFlame, IcTrendingUp, IcClock, IcFilter, IcX,
IcChevronRight, IcChevronLeft, IcChevronDown, IcChevronUp,
IcSend, IcImage, IcFolder, IcFolderPlus, IcDraft,
IcHash, IcAtSign, IcGlobe, IcLock, IcUsers2,
IcRadio, IcGift, IcStar, IcPin
```

---

## 🔒 HAPTIC FEEDBACK

```typescript
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

// Like, follow, actions positives fortes
ReactNativeHapticFeedback.trigger('impactMedium', { enableVibrateFallback: true });

// Boutons secondaires, taps simples
ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });

// Erreurs, suppressions
ReactNativeHapticFeedback.trigger('notificationError', { enableVibrateFallback: true });

// Succès, confirmations
ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true });

// Sélection dans une liste
ReactNativeHapticFeedback.trigger('selection', { enableVibrateFallback: true });
```

---

## ⚡ OPTIMISTIC UPDATES (PATTERN OBLIGATOIRE)

Pour TOUTE action utilisateur qui modifie des données :

```typescript
// ✅ PATTERN CORRECT
const likeMutation = useMutation({
  mutationFn: () => api.post(`/posts/${post.id}/like`),
  onMutate: async () => {
    // 1. Snapshot de l'état actuel
    const previousLiked = liked;
    const previousCount = likeCount;
    
    // 2. Mise à jour UI immédiate
    setLiked(prev => !prev);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    
    // 3. Retourner le snapshot pour le rollback
    return { previousLiked, previousCount };
  },
  onError: (error, _, context) => {
    // 4. Rollback en cas d'erreur
    if (context) {
      setLiked(context.previousLiked);
      setLikeCount(context.previousCount);
    }
    // 5. Toast discret
    showToast('Erreur réseau, réessaie');
  },
  // PAS de onSuccess qui recharge — UI déjà à jour
});
```

---

## 📊 FLATLIST OPTIMISATIONS (TOUJOURS)

```typescript
// Config obligatoire pour TOUTES les FlatLists de feed
<FlatList
  removeClippedSubviews={true}
  maxToRenderPerBatch={2}
  windowSize={5}
  initialNumToRender={2}
  updateCellsBatchingPeriod={50}
  keyExtractor={(item) => item.id}
  getItemLayout={(_, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

---

## 🗂️ STRUCTURE DES FICHIERS

```
src/
├── components/
│   ├── ui/                  # Composants UI réutilisables
│   │   ├── Avatar.tsx       # Composant avatar unifié
│   │   ├── Button.tsx       # Boutons standardisés
│   │   ├── Icons.tsx        # Toutes les icônes Lucide
│   │   ├── Skeleton.tsx     # Skeletons loading
│   │   ├── Toast.tsx        # Toast notifications
│   │   └── BottomSheet.tsx  # Bottom sheet réutilisable
│   └── video/
│       ├── VideoPlayerItem.tsx
│       ├── CommentsBottomSheet.tsx
│       └── ShareSheet.tsx
├── screens/                 # Un dossier par domaine
├── stores/                  # Zustand stores
├── hooks/                   # Custom hooks
├── api/                     # API client
└── constants/               # theme.ts, etc.
```

---

## 🔄 Z-INDEX STACK

```typescript
// Respecter STRICTEMENT cette hiérarchie
ZIndex = {
  base: 0,           // fond feed, vidéos
  nav: 1000,         // nav bar, header
  overlay: 2000,     // overlays légers (caption expandée)
  sheet_light: 3000, // comments bottom sheet
  sheet_block: 5000, // modales bloquantes
  toast: 7000,       // toasts et notifications in-app
  offline: 9700,     // bannière offline
  maintenance: 9999, // overlay maintenance
  splash: 99999,     // splash screen
}
```
