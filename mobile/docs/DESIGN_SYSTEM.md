# Nour — Design System
> Référence obligatoire. Inspiré TikTok + Apple HIG + RIDE guide.
> Mise à jour: 2026-06-05

---

## 1. COULEURS

### Thème Light
```
bg:              #F7F7F8   — fond principal
surface:         #FFFFFF   — cards, sheets
card:            #FFFFFF   — items de liste
inputBg:         #F0F0F2   — fond des inputs
text:            #0A0A0B   — texte principal
textMuted:       #60646C   — texte secondaire
textSubtle:      #9EA3AB   — placeholders, hints
border:          #E8E8EC   — séparateurs
tabBg:           #FFFFFF   — fond tab bar
tabActive:       #2D7A4F   — onglet actif
tabInactive:     #9EA3AB   — onglets inactifs
primary:         #2D7A4F   — vert islamique
primaryLight:    #4CAF7A   — vert clair
primaryBg:       #EBF5EE   — fond vert transparent
```

### Thème Dark (TikTok-style true black)
```
bg:              #0A0A0A   — fond vrai noir
surface:         #111111   — surface légèrement relevée
card:            #161616   — cartes
inputBg:         #1C1C1C   — inputs
text:            #F5F5F5   — texte blanc
textMuted:       #A0A0A8   — texte secondaire
textSubtle:      #606068   — hints
border:          #222222   — séparateurs subtils
tabBg:           #0A0A0A   — tab bar noir
tabActive:       #4CAF7A   — vert clair (contrast meilleur sur noir)
tabInactive:     #484850   — inactif gris
primary:         #2D7A4F   — même vert
primaryBg:       #0F2018   — fond vert très sombre
```

### Couleurs statiques (jamais changent)
```
white:   #FFFFFF
black:   #000000
error:   #EF4444
like:    #FF3B5C   — rouge like
gold:    #C9A84C   — accent doré
success: #2D7A4F
```

### Règle d'utilisation
```typescript
// TOUJOURS via useTheme()
const theme = useTheme();
// JAMAIS hardcoder: color: '#000000', background: 'white'
// TOUJOURS: color: theme.text, backgroundColor: theme.bg
```

---

## 2. TYPOGRAPHIE

```
FONT.size.xs    = 11px   — badges, labels petit
FONT.size.sm    = 12px   — meta, timestamps
FONT.size.base  = 14px   — body principal
FONT.size.md    = 15px   — body grande taille
FONT.size.lg    = 17px   — titres section
FONT.size.xl    = 20px   — titres page
FONT.size.xxl   = 24px
FONT.size.xxxl  = 28px   — titles larges
FONT.size.huge  = 36px

FONT.weight.normal   = '400'
FONT.weight.medium   = '500'
FONT.weight.semibold = '600'
FONT.weight.bold     = '700'
FONT.weight.extrabold= '800'
```

### Hiérarchie typographique
| Rôle | Size | Weight | Remarque |
|------|------|--------|----------|
| Titre principal | xxxl (28) | 900 | letterSpacing -0.5 |
| Titre section | xl (20) | 700 | |
| Sous-titre | lg (17) | 600 | |
| Body | base (14) | 400 | lineHeight 1.5 |
| Caption | sm (12) | 400 | color textMuted |
| Badge | xs (11) | 600 | uppercase, letterSpacing 0.5 |
| Chiffres clés | depends | 800 | letterSpacing -0.5 à -1 |

---

## 3. ESPACEMENT

```
SPACING.xs  = 4px
SPACING.sm  = 8px
SPACING.md  = 16px
SPACING.lg  = 24px
SPACING.xl  = 32px
SPACING.xxl = 48px
```

### Règles d'espacement
- Padding interne composant: 12-16px
- Padding section/page: 16-24px
- Gap entre items de liste: 8-12px
- Gap icône + texte: 6-10px
- Margin entre sections: 16-24px

---

## 4. BORDER RADIUS

```
RADIUS.xs   = 4px   — chips, badges, petits éléments
RADIUS.sm   = 8px   — inputs, tags
RADIUS.md   = 12px  — cartes compactes, boutons
RADIUS.lg   = 16px  — cartes standards (posts)
RADIUS.xl   = 20px  — modales, panels
RADIUS.full = 9999  — pills, avatars, boutons CTA
```

### Règles border-radius
- Cards de post: 16px
- Bottom sheets: 24px top-left + top-right, 0 bottom
- Boutons CTA: 100px (pill)
- Inputs: 12px
- Avatars: toujours circulaires (borderRadius = taille/2)
- Toujours `overflow: hidden` sur containers avec border-radius

---

## 5. OMBRES

```typescript
SHADOW.sm   = { shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.08, shadowRadius:3, elevation:2 }
SHADOW.md   = { shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.12, shadowRadius:6, elevation:4 }
SHADOW.green= { shadowColor:'#2D7A4F', shadowOffset:{width:0,height:4}, shadowOpacity:0.35, shadowRadius:12, elevation:8 }
```

---

## 6. COMPOSANTS — REFERENCE

### Bouton primaire (CTA)
```
height: 50px (md), 42px (sm), 56px (lg)
borderRadius: 100 (pill)
backgroundColor: theme.primary
color: white
fontWeight: 700
paddingHorizontal: 24-40px
shadowColor: theme.primary (ombre verte)
activeOpacity: 0.82
```

### Bouton secondaire / outline
```
height: 44px
borderRadius: 100
backgroundColor: transparent
borderWidth: 1.5
borderColor: theme.border
color: theme.text
fontWeight: 600
```

### Input
```
minHeight: 50px
borderRadius: 12px
borderWidth: 1.5px
borderColor: focused → theme.primary, error → #EF4444, else → theme.border
backgroundColor: focused → theme.surface, else → theme.inputBg
paddingHorizontal: 16px
```

### Card
```
backgroundColor: theme.card
borderRadius: 16px
borderWidth: 1px
borderColor: theme.border
padding: 16px (default)
SHADOW.sm applied
```

### Avatar
```
Tailles: 32 (micro), 44 (liste), 60 (profil petit), 80 (profil principal)
borderRadius: taille/2
Fallback: initiales sur fond primaryBg, couleur primary
Verified badge: vert, 18px, bottom-right
```

---

## 7. ANIMATIONS

### Springs (React Native Animated)
```typescript
// Navigation slide (page → page)
{ tension: 420, friction: 34 }

// Bottom sheet snap
{ tension: 520, friction: 42 }

// Modal popup
{ damping: 26, stiffness: 300, mass: 0.9 }

// Emoji réaction bounce
{ tension: 600, friction: 20 }

// Profile panel slide-in
{ damping: 26, stiffness: 300, mass: 0.9 }
```

### Timings
```
Transitions rapides:  150-200ms
Transitions normales: 220-280ms
Splash exit:          380ms
Easing iOS:           cubic-bezier(0.22, 1, 0.36, 1)
```

### Règles animations
- JAMAIS animer transform sur des listes qui scrollent (perf)
- useNativeDriver: true sur toutes les animations de transform/opacity
- whileTap équivalent: Animated.spring scale 0.96 sur cards, 0.88 sur icônes nav

---

## 8. GESTES

### Swipe profil (VideoPlayerItem)
- Déclenchement: zone droite (startX > W*0.4), mouvement gauche > 12px
- Panel width: 85% de l'écran, depuis le bord droit
- Commit: dx > 25% de W OU velocity < -0.5
- Backdrop: opacity 0 → 0.55 progressivement
- Spring open: damping 26, stiffness 300
- Spring close: damping 26, stiffness 320
- Backdrop tap: ferme le panel

### Tab bar
- Pas de tabDot
- Icon size: 24px
- strokeWidth: 2.2 (focused), 1.8 (unfocused)
- TabActive color: theme.tabActive
- TabInactive color: theme.tabInactive

### Safe Area (obligatoire)
```typescript
const insets = useSafeAreaInsets();
paddingTop: insets.top + 14
paddingBottom: Math.max(insets.bottom, 24)
```

---

## 9. FEED VIDÉO — RÉFÉRENCE TIKTOK

### Layout vidéo plein écran
```
Container: width:100%, height: screenH - tabBarHeight
Video: resizeMode 'cover' (portrait) ou 'contain' (paysage)
Gradient overlay: bas de l'écran, noir transparent → noir
Actions droite: col verticale, icônes 28px, gap 20px
Info bas gauche: avatar+nom+caption+son
```

### Actions droite (de bas en haut)
```
1. Avatar + follow button (+)
2. Like (coeur) + count
3. Commentaire (bulle) + count
4. Partager (flèche) + count
5. Enregistrer (signet) + count
6. Son (vinyle tournant)
```

### Share sheet (inspiration TikTok)
```
Section 1: contacts horizontaux scrollables
Section 2: actions en grid horizontale (Republier, Copier lien, WhatsApp, SMS...)
Section 3: liste verticale (Télécharger, Ajouter Story, Signaler, Pas intéressé)
```

---

## 10. INSPIRATION TIKTOK — PATTERNS CLÉS

### Ce qu'on reproduit
1. Feed vertical plein écran paginé
2. Actions à droite en colonne
3. Tabs header scrollable horizontal
4. Profile panel slide (swipe gauche sur vidéo)
5. Double-tap coeur flottant
6. Son tournant (vinyle)
7. Badge "republications" bas gauche
8. Barre progression bas de vidéo

### Ce qu'on adapte (Nour = islamique)
- Couleur primaire: vert #2D7A4F (pas rouge TikTok)
- Contenu: vidéos islamiques, coraniques
- Règles messaging: hommes/femmes (pas de DM cross-gender sans consentement)
- Pas de contenu inapproprié
- Ramadan mode (future)

### Ce qu'on améliore par rapport à TikTok
- Dark mode propre (true black)
- Thème adaptatif complet (light/dark)
- Moins de fonctionnalités mais 100% fonctionnelles
- Performance: prefetch au boot, cache React Query

---

## 11. Z-INDEX STACK

```
0      — Fond feed (vidéos)
100    — Overlays vidéo (gradient, actions)
500    — Profile panel (swipe)
1000   — Navigation tab bar, header
3000   — Comments bottom sheet
5000   — ShareSheet, SoundSheet modales
9000   — Toasts
9700   — Offline banner
99999  — SplashScreen
```

---

## 12. RÈGLES INTERDITES

```
❌ Couleurs hardcodées: color: '#000', backgroundColor: 'white'
❌ border-radius < 8px sur les cards
❌ overflow: visible sur containers avec border-radius
❌ Emoji dans l'UI (→ utiliser uniquement Lucide icons)
❌ Spinner seul sans skeleton quand chargement > 300ms
❌ Touch target < 44×44px
❌ Animation sur des éléments scrollables
❌ useNativeDriver: false sur transform/opacity
❌ useState/hooks après return conditionnel
❌ Magic numbers → utiliser les constantes du design system
```
