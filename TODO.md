# TODO — Nour App · CEO Mode
> Mis à jour: 2026-06-06 — Session UX/DA/thème
> Source règles: ~/Desktop/CLAUDE_AGENT_INSTRUCTIONS.md + ~/Desktop/RIDE_GUIDE_COMPLET.md

---

## 🔴 SESSION CEO — EN COURS (2026-06-05)

- [x] Swipe droite→gauche sur vidéo "Pour toi" → panel profil slide depuis droite (UserProfilePanel) ✅
- [x] Fix conflit PanResponder seek vs swipe profil ✅
- [x] SplashScreen animé (logo bounce + wordmark fadeUp + dots pulsants) ✅
- [x] ErrorBoundary global (remplace écran rouge développeur) ✅
- [x] Suppression tabs header: Boutique, Proche, Communauté ✅
- [x] Preloading vidéos: windowSize 5, faster bufferConfig ✅
- [x] Design system doc complet (design_system.md) ✅
- [x] Pull-to-refresh sur Pour toi + Suivis ✅
- [x] Heart animation TikTok style (bounce + float + fade) ✅
- [x] Action buttons spring bounce on press ✅
- [x] Dark mode ExploreScreen + MessagesScreen ✅
- [x] Onboarding redesign (icons, animated dots, no emoji) ✅
- [x] UserProfileScreen skeleton loading ✅
- [x] PostDetailScreen skeleton + dark mode ✅
- [x] Live viewer count broadcast temps réel ✅

---

> Inspiré de TikTok, Instagram Reels, BeReal, Twitter/Threads
> Généré le 2026-06-04

---

## 🔴 CRITIQUE (bugs bloquants)

- [x] Fix live streaming — viewer ne reçoit pas le stream WebRTC (closure stale localStream)
- [x] Fix liked posts — threads inclus dans l'onglet vidéos, video_url manquant
- [x] Fix render crash FeedScreen — FeedItem.id undefined
- [x] Fix double-tap like — délai 250ms supprimé, animation immédiate
- [x] Fix avatar propagation — loadMe() après upload
- [x] Fix thumbnails vidéo — Cloudinary fallback always-on
- [x] Fix message même genre — ConversationRequest unique constraint crash
- [x] Fix LiveViewerScreen — chat ne s'affiche pas en temps réel (WebSocket room)
- [x] Fix GoLiveScreen — afficher les messages viewers en live
- [x] Fix vitesse 2x — certains players ne supportent pas `rate` prop

---

## 🟠 PRIORITÉ HAUTE (semaine 1)

### 📱 Feed "Pour toi"
- [x] Onglet "Suivis" — feed uniquement des comptes suivis
- [x] Pull-to-refresh avec animation (spinner vert)
- [x] Indicateur de chargement en bas (spinner vert)
- [ ] Precaching des 2-3 vidéos suivantes (backgrounded)
- [x] Mémorisation de la position dans le feed (pourToiIndexRef + initialScrollIndex) ✅
- [ ] Skip vidéo en swipant vers le haut plus rapidement (animation accélérée)
- [x] Indicateur de progression de la vidéo (barre verte en bas)
- [x] Durée de la vidéo affichée (badge haut gauche)
- [x] Réduire le délai de single-tap pause (300ms → 200ms)

### 🎬 Lecteur vidéo
- [x] Seek en maintenant appuyé gauche/droite (holdSeeking + ±10s continu) ✅
- [ ] Afficher le temps actuel / durée totale en mode 2x
- [ ] Résolution adaptative (quality selector bas)
- [x] Replay automatique après la fin (seek(0) + replayAnim) ✅
- [x] Plein écran paysage si la vidéo est en 16:9 horizontal (presentFullscreenPlayer) ✅
- [x] Pinch-to-zoom sur la vidéo (GestureDetector + Reanimated, x1→x3) ✅
- [x] Option désactiver l'autoplay (accessibilité) ✅

### 💬 Commentaires
- [x] Commentaires en temps réel (Socket.IO post:watch/comment:new) ✅
- [x] Répondre à un commentaire (parent_id + banner @username) ✅
- [x] Liker un commentaire (API réelle + toggle) ✅
- [x] Mentionner @utilisateur dans un commentaire (autocomplete @) ✅
- [x] Épingler un commentaire (créateur seulement) ✅
- [x] Supprimer son propre commentaire (ActionSheet + API) ✅
- [x] Pagination des commentaires (load more) ✅
- [ ] Afficher les commentaires en live dans le player (overlay)

### 👤 Profil
- [x] Bannière/cover photo sur le profil (LinearGradient + pickCover) ✅
- [x] Lien externe dans la bio (cliquable, Linking.openURL) ✅
- [x] Catégorie/niche du compte (Islam, Coran, Famille...) ✅
- [x] Statistiques avancées (CreatorStatsScreen: vues, likes, complétion, top posts) ✅
- [x] QR Code du profil (partager son compte) ✅
- [x] Bouton "Partager le profil" (Share sheet natif) ✅
- [ ] Mode créateur vs mode standard
- [ ] Onglet "Reposts" sur le profil

### 🔔 Notifications
- [x] Page notifications avec 4 onglets : Tous / J'aime / Commentaires / Abonnés ✅
- [ ] Notification groupée ("X et Y ont aimé ta vidéo")
- [x] Badge non-lus sur l'onglet Boite (navigation tab bar) ✅
- [x] Marquer tout comme lu (PATCH /notifications/read-all) ✅
- [ ] Push notifications APNs (APNS_KEY_ID, APNS_TEAM_ID en env)
- [ ] Notification quand quelqu'un mentionne @vous dans un commentaire
- [ ] Notification quand votre vidéo est en tendance

---

## 🟡 PRIORITÉ MOYENNE (semaine 2-3)

### 🔴 Live amélioré
- [ ] Live co-host (2 streamers en split screen)
- [ ] Invite un spectateur en live (apparaît à côté du host)
- [ ] Compteur de viewers avec liste (clic sur compteur = liste)
- [ ] Replay du live (enregistrement automatique post-live)
- [ ] Miniature en live : bulles flottantes de réactions (cœurs, emojis)
- [ ] Cadeaux virtuels (diamonds → monétisation future)
- [ ] Partager le live (lien + story)
- [ ] Timer de durée du live affiché
- [ ] Mode portrait et paysage en live

### 📚 Livres
- [ ] Page détail livre (couverture grande, résumé complet, auteur, catégorie)
- [ ] Suivre un auteur
- [ ] Collection de livres (créer des listes)
- [ ] Partager un extrait de livre (screenshot stylisé)
- [ ] Ajouter un livre (upload cover + saisie texte)
- [ ] Livres en tendance (section dédiée)
- [ ] Lecture in-app (scroll continu style Kindle)

### 📤 Upload
- [ ] Filtres vidéo (luminosité, contraste, saturation)
- [ ] Rogner la vidéo (trimmer)
- [ ] Ajouter du texte sur la vidéo (titre, hadith, versets)
- [ ] Ajouter des stickers/emojis islamiques (croissant, étoile, mosquée)
- [ ] Choisir la couverture manuellement (frame selector)
- [ ] Duet — répondre à une vidéo en split-screen
- [ ] Stitch — cliper une partie d'une vidéo et y répondre
- [ ] Séries (regrouper des vidéos en playlist ordonnée)
- [ ] Brouillon (sauvegarder avant de publier)
- [ ] Planifier une publication (date + heure)
- [ ] Qui peut voir : Public / Abonnés / Seulement moi

### 💌 Messagerie
- [ ] Envoyer une vidéo/post depuis le feed en DM
- [ ] Réactions emoji sur les messages (appui long)
- [ ] Répondre à un message (swipe droite)
- [ ] Messages vocaux
- [ ] Envoyer des images en DM
- [ ] Messages éphémères (s'effacent après lecture)
- [ ] Status "vu" avec horodatage
- [ ] Indicateur "En train d'écrire..."
- [ ] Épingler une conversation
- [ ] Archiver une conversation
- [ ] Demandes de message (pour cross-gender : demande + acceptation)
- [ ] Partager un profil en DM
- [ ] GIF islamiques (via GIPHY API filtré)

### 🔍 Découverte
- [ ] Recherche par hashtag (résultats vidéos + comptes)
- [ ] Recherche par son/musique
- [ ] Tendances du jour (top hashtags)
- [ ] Page d'un hashtag (header + vidéos)
- [ ] Catégories dédiées : Coran, Hadith, Famille, Éducation, Humour Halal
- [ ] Challenges islamiques (ex: #30JoursCoranChallenge)
- [ ] Filtrer par pays/langue
- [ ] Comptes suggérés (based on who you follow)

---

## 🟢 PRIORITÉ BASSE (semaine 3-4)

### 🎵 Sons & Musique
- [ ] Bibliothèque de sons islamiques (nasheeds, anasheed)
- [ ] Sons originaux (créés par les utilisateurs)
- [ ] Favoriser un son (bookmark)
- [ ] Page d'un son avec toutes les vidéos qui l'utilisent
- [ ] Ajouter un son à ses favoris
- [ ] Créer un son depuis une vidéo (clip audio)
- [ ] Nasheed du jour (featured)

### 🌙 Fonctionnalités islamiques
- [ ] Heure de prière quotidienne (notification)
- [ ] Rappels du vendredi
- [ ] Calendrier islamique affiché
- [ ] Mode Ramadan (UI spéciale, compte à rebours iftar)
- [ ] Versets du Coran intégrés (API Quran.com)
- [ ] Hadiths du jour
- [ ] Duas du matin/soir
- [ ] Qibla compass dans l'app
- [ ] Compteur Tasbih
- [ ] Contenu géo-filtré (par pays musulman)

### 📊 Analytics créateur
- [ ] Dashboard views des 7/30 derniers jours
- [ ] Taux de complétion par vidéo
- [ ] Source de trafic (feed / profil / recherche)
- [ ] Démographie de l'audience (pays, âge)
- [ ] Meilleure heure de publication
- [ ] Revenu estimé (si monétisation activée)

### 💰 Monétisation (future)
- [ ] Programme créateur (seuil 1000 abonnés)
- [ ] Pourboires sur les lives (diamants → vrai argent)
- [ ] Contenu exclusif (abonnement payant par créateur)
- [ ] Marketplace islamique (vendre produits halal)
- [ ] Boost de publications

### 🛡️ Sécurité & Modération
- [ ] Signaler une vidéo avec catégories précises
- [ ] Système de points de contenu (3 violations → suspension)
- [ ] IA de modération automatique (contenu inapproprié)
- [ ] Filtre de mots offensants configurable par l'utilisateur
- [ ] Mode restreint (contenu filtré pour enfants)
- [ ] Confidentialité renforcée (qui peut me trouver, me taguer)
- [ ] Vérification d'email obligatoire
- [ ] 2FA (double authentification)
- [ ] Historique des connexions
- [ ] Blacklist de comptes (super-ban)

---

## 🔵 UX & POLISH (ongoing)

### Animations & Transitions
- [ ] Transition partagée avatar → profil (hero animation)
- [ ] Skeleton loading partout (pas de spinners vides)
- [ ] Haptic feedback sur tous les CTA (double tap, like, follow)
- [ ] Swipe-back natif iOS (edge swipe retour)
- [ ] Animation de publication réussie (confetti vert)
- [ ] Transition fluid entre feed et profil
- [ ] Bounce animation sur le compteur de like quand on aime
- [ ] Micro-interactions (pulse sur l'icône notifications)
- [ ] Loading screen animé au lancement (logo Nour + croissant)

### Accessibilité
- [ ] Support VoiceOver / TalkBack
- [ ] Taille de texte dynamique (respecter les préférences iOS)
- [ ] Mode haut contraste
- [ ] Réduire les animations (respecter prefers-reduced-motion)
- [ ] Sous-titres automatiques sur les vidéos

### Performances
- [ ] Lazy loading des images (blur-up effect)
- [ ] Cache vidéo intelligent (LRU 200MB)
- [ ] Compression des images avatar avant upload (max 200KB)
- [ ] CDN pour les vidéos (Cloudinary + cache headers)
- [ ] Service Worker pour mode offline
- [ ] Prefetch des 3 premières vidéos du feed
- [ ] Background fetch (iOS Background App Refresh)

---

## ⚙️ TECHNIQUE & INFRA

- [ ] Tests unitaires (Jest) pour les fonctions critiques
- [ ] Tests E2E (Detox) pour les flows principaux
- [ ] CI/CD GitHub Actions (build + test)
- [ ] Variables d'env Railway : APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY
- [ ] TURN server pour WebRTC (Twilio/Xirsys) — nécessaire en prod
- [ ] Monitoring erreurs (Sentry)
- [ ] Analytics (Mixpanel ou Amplitude)
- [ ] A/B testing infrastructure
- [ ] Rate limiting sur tous les endpoints API
- [ ] Pagination cursor-based sur tous les gets
- [ ] Webhooks pour les événements importants
- [ ] Backup DB quotidien Railway
- [ ] Staging environment (separate Railway project)
- [ ] Documentation API (Swagger auto-généré par Fastify)

---

## 📦 RELEASES

### v1.0 — MVP actuel
- Feed vidéo + upload + profil + follow + messages same-gender + live basique + livres

### v1.1 — Stabilité (en cours)
- Live streaming fonctionnel, liked posts, thumbnails, DA redesign

### v1.2 — Social
- Commentaires temps réel, réponses, notifications push, onglet Suivis

### v1.3 — Discovery
- Recherche avancée, hashtags, tendances, challenges

### v1.4 — Islamique
- Fonctionnalités islamiques (prières, Coran, hadiths), Ramadan mode

### v2.0 — Monétisation
- Programme créateur, cadeaux live, contenu exclusif

---

*Mis à jour : 2026-06-04*
