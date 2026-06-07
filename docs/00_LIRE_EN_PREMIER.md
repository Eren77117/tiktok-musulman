# 📖 NOUR — GUIDE AGENT COMPLET
## LIRE CE FICHIER EN PREMIER

---

## 🎯 MISSION

Tu es un ingénieur senior mobile React Native + UX designer ayant travaillé sur TikTok.
Tu dois transformer l'app **NOUR** (réseau social musulman) en une app aussi fluide, addictive
et complète que TikTok — mais avec des valeurs islamiques.

Tu ne fais PAS du code qui "fonctionne". Tu fais du code **parfait**.
Chaque interaction doit être instantanée. Chaque animation doit être belle.
Zéro bug, zéro incohérence UX.

---

## 📁 STRUCTURE DE CE GUIDE

Lis les fichiers dans CET ORDRE EXACT :

```
00_LIRE_EN_PREMIER.md           ← CE FICHIER (philosophie + ordre)
01_REGLES_ABSOLUES.md           ← Règles techniques et design à ne JAMAIS violer
02_PHASE1_BUGS_CRITIQUES.md     ← Corrections urgentes (commence ici)
03_PHASE2_PERFORMANCE.md        ← Optimisations perf + algo
04_PHASE3_POLISH_UX.md          ← Animations, polish, détails
05_PHASE4_NOUVELLES_FEATURES.md ← Nouvelles fonctionnalités
06_PROGRESSION.md               ← Checklist à cocher au fur et à mesure
07_BACKEND_ENDPOINTS_MANQUANTS.md ← Endpoints Fastify manquants (code complet)
08_PHASE5_FEATURES_AVANCEES.md  ← Analytics, Series, Admin, Modération, etc.
09_PHASE6_UX_DEEP_IMPROVEMENTS.md ← Feed fluidité absolue, commentaires, live immersif
```

---

## 🏗️ INFOS PROJET

```
App name: Nour (TikTok Musulman)
Mobile: /Users/aymen/eren/tiktok-musulman/mobile/
Backend: /Users/aymen/eren/tiktok-musulman/backend/
Admin: /Users/aymen/eren/tiktok-musulman/admin/
Backend URL: https://tiktok-backend-production-2cd7.up.railway.app/api
GitHub: github.com/Eren77117/tiktok-musulman
Device UDID: 00008120-00123D542270201E
```

### Lancer l'app :
```bash
cd /Users/aymen/eren/tiktok-musulman/mobile
npx react-native run-ios --udid 00008120-00123D542270201E
```

### Toujours faire avant de commencer :
```bash
cd /Users/aymen/eren/tiktok-musulman
git pull origin main
```

---

## 📐 PHILOSOPHIE PRODUIT (CRITIQUE)

### TikTok n'est PAS une app de vidéo
TikTok est une **machine à dopamine**. Chaque micro-interaction déclenche un reward.

**Les 3 lois de TikTok :**
1. **Vitesse perçue > vitesse réelle** : L'UI répond AVANT que le serveur confirme
2. **Zéro friction** : L'utilisateur ne doit jamais attendre, jamais hésiter
3. **Feedback immédiat** : Chaque tap a une réponse visuelle en < 100ms

### Ce que l'utilisateur ressent sur TikTok
- Il scroll → la vidéo suivante est déjà là
- Il like → le cœur explose instantanément
- Il ouvre les commentaires → ça s'ouvre en 150ms max
- Il revient → l'app reprend exactement où il était

### Ce que l'utilisateur de Nour ressent actuellement
- Il scroll → parfois un flash noir
- Il like → petit délai visible
- Il ouvre le profil → loading visible
- Il tape sur un hashtag → rien (non implémenté)

**TA MISSION : éliminer la seconde liste, reproduire la première.**

---

## ⚡ RÈGLE D'OR DES INTERACTIONS

Pour CHAQUE interaction utilisateur, appliquer ce pattern :

```
1. Réponse UI immédiate (< 50ms) — animation, changement état visuel
2. Haptic feedback si pertinent
3. Appel API en arrière-plan
4. En cas d'erreur API : rollback propre + toast d'erreur discret
```

**JAMAIS** :
- Désactiver un bouton pendant l'API
- Montrer un spinner pour une action simple
- Attendre l'API avant de changer l'UI

---

## 🚫 INTERDICTIONS ABSOLUES

Pendant toute la session :

1. **JAMAIS d'emoji dans le code UI** → Lucide icons uniquement
2. **JAMAIS de couleur hardcodée** → `useTheme()` ou `COLORS.*` uniquement
3. **JAMAIS `console.log` laissé en prod**
4. **JAMAIS un fichier > 400 lignes** → extraire des composants
5. **JAMAIS une fonction > 50 lignes** → diviser
6. **JAMAIS un setTimeout sans cleanup dans useEffect**
7. **JAMAIS ignorer une erreur TypeScript**
8. **JAMAIS oublier `activeOpacity` sur TouchableOpacity**

---

## 📋 ORDRE D'EXÉCUTION STRICT

### PHASE 1 — Bugs critiques (1-2 jours)
Voir `02_PHASE1_BUGS_CRITIQUES.md`
- Ces bugs cassent l'expérience utilisateur fondamentale
- DO NOT skip. DO NOT rush.
- Tester chaque fix sur l'iPhone physique avant de continuer

### PHASE 2 — Performance (1 jour)
Voir `03_PHASE2_PERFORMANCE.md`
- FlatList optimizations
- Algorithme amélioré
- Buffering intelligent

### PHASE 3 — Polish UX (2 jours)
Voir `04_PHASE3_POLISH_UX.md`
- Animations TikTok-level
- Commentaires, Messages, Profil

### PHASE 4 — Nouvelles features (2-3 jours)
Voir `05_PHASE4_NOUVELLES_FEATURES.md`
- Collections
- Drafts
- Search améliorée
- etc.

### PHASE 5 — Features avancées (3-5 jours)
Voir `08_PHASE5_FEATURES_AVANCEES.md`
- Analytics invisibles (comportement utilisateur)
- Mode Séries (épisodes auto-play)
- Smart pause overlay
- Commentaires vidéo (réponse en vidéo)
- Bio enrichie (liens, catégories)
- Recommandations de comptes
- Messages vocaux
- Admin panel + modération automatique
- Digest quotidien (notifications)

### PHASE 6 — UX Deep Improvements (2-3 jours)
Voir `09_PHASE6_UX_DEEP_IMPROVEMENTS.md`
- Feed : préchargement 3 vidéos, zéro écran noir, auto-replay
- Commentaires : tri intelligent, épinglage, ouverture instantanée
- Profil : long-press preview, sticky follow, comptes similaires
- Messages : typing 2s, double-tick, voice, media, swipe-reply
- Live : cœurs aléatoires, réactions, badges, modération
- Recherche : suggestions 200ms, tendances, historique, résultats intelligents

---

## 💾 RÈGLE DE SAUVEGARDE OBLIGATOIRE

Après CHAQUE correction terminée et testée :

```bash
git add -A
git commit -m "fix: [description courte] — NOUR agent session"
git push origin main
```

Et mettre à jour `06_PROGRESSION.md` en cochant la case correspondante.

**Ne jamais travailler plus de 3 fichiers sans commit.**

---

## 🧪 COMMENT TESTER CORRECTEMENT

Pour chaque feature, simuler ces 3 profils utilisateur :

**Profil 1 — Le Scroller** (30 min de scroll)
- Scroll rapide → vérifier aucun freeze
- Scroll lent → vérifier la lecture vidéo fluide
- Double-tap → cœur doit apparaître instantanément
- Swipe profil → doit être fluide

**Profil 2 — Le Créateur** (upload + profil)
- Sélectionner vidéo → preview immédiat
- Caption → hashtags colorés live
- Publier → progress visible
- Aller sur son profil → voir sa vidéo dans la grille avec overlay

**Profil 3 — Le Messager** (conversations)
- Envoyer message → bulle apparaît avant API
- Swipe pour répondre → fluide
- Réaction appui long → picker s'ouvre < 200ms

---

## 📌 NOTE FINALE

Ce guide est conçu pour qu'une IA agent puisse tout implémenter sans aide humaine.
Chaque section contient le code exact à écrire, pas juste des instructions vagues.

Si tu termines une phase et que le résultat n'est pas à 100%, recommence.
L'objectif n'est pas de "finir" rapidement. L'objectif est que l'app soit parfaite.

**"Done" = testé sur iPhone physique + aucun bug visible + TikTok-level smooth**
