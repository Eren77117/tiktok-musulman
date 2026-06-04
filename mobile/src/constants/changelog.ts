export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.5.0',
    date: '2026-06-04 · 02h06',
    changes: [
      'Messagerie H→H et F→F : directe, sans restriction ni demande',
      'Messagerie H↔F : restreinte (règle islamique)',
      'Onboarding 3 écrans au premier lancement',
      'Fils — clic sur un fil → ouvre le détail avec réponses',
      'Fils — répondre à un fil depuis ThreadDetailScreen',
      'Signalement utilisateur + contenu fonctionnel',
      'Blocage utilisateur (block/unblock toggle)',
      'Masquer un utilisateur du feed',
      'Backend : routes /messages/direct, /block, /hide, /reports',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-06-04 · 02h00',
    changes: [
      'Thumbnail automatique : première image de la vidéo extraite à l\'upload',
      'Création de fils corrigée (POST /threads erreur 404 résolue)',
      'Swipe droite→gauche sur vidéo → profil utilisateur avec animation',
      'Profil utilisateur : bouton options (signaler, bloquer, masquer du feed)',
      'Avatar sauvegardé correctement sur le serveur (bug schema corrigé)',
      'Avatar propagé partout : feed, fils, messages, profil',
      'Commentaires : bottom sheet draggable ½ écran, vidéo continue derrière',
      'VideoPlayerScreen : ouvrir une vidéo en plein écran depuis le profil',
      'Notifications : bell avec badge dans Messages, historique cliquable',
      'Stats profil : recalculées en temps réel depuis la DB',
      'Vidéos se mettent en pause quand on quitte l\'onglet',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-06-04 · 01h18',
    changes: [
      'Thème Clair / Sombre / Système appliqué à toute l\'app',
      'Double-tap sur vidéo → like animé (cœur rose)',
      'Tap sur "Pour Toi" → rafraîchissement du feed',
      'Son de la vidéo cliquable avec page dédiée',
      'Partage natif (WhatsApp, iMessage, copier lien)',
      'Barre de navigation redesignée',
      'Upload : hashtags et mentions @utilisateur',
      'Progress bar réelle pendant l\'upload',
      'Paramètres entièrement fonctionnels avec persistance',
      'Changement de mot de passe depuis les paramètres',
      'Photo de profil modifiable',
      'Onglets Profil : Vidéos, Fils, J\'aime, Favoris',
      'Algorithm amélioré avec watch time',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-06-03 · 23h49',
    changes: [
      'Feed TikTok fullscreen scroll vertical',
      'Bouton + → choix Vidéo / Fil',
      'ThreadComposer avec image et vidéo',
      'Système de favoris (save) fonctionnel',
      'Explorer avec grille 3 colonnes et recherche',
      'Dark mode (hook useTheme)',
      'Route /posts/liked backend',
      'Migration PostView pour watch time',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-06-02 · 21h30',
    changes: [
      'Navigation : Accueil, Explorer, +, Messages, Profil',
      'Overlay vidéo : like, commentaire, partage, favoris',
      'Système de fils (threads) style Twitter',
      'Modifier le profil (nom, bio)',
      'Routes backend : threads, favorites, follow',
      'Algorithme feed TikTok (score engagement + decay)',
      'Tracking des vues vidéo',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-01 · 18h00',
    changes: [
      'Lancement de l\'app Nour',
      'Inscription et connexion',
      'Upload vidéo et image',
      'Feed vertical fullscreen',
      'Profil utilisateur',
      'Messages et conversations',
      'Système de notifications',
    ],
  },
];
