import { FastifyInstance } from 'fastify';

// Curated hadiths (FR) — rotates daily by day-of-year
const HADITHS = [
  {
    text: "Les actions ne valent que par les intentions, et chaque personne n'a que ce qu'elle a eu l'intention d'accomplir.",
    source: "Boukhâri & Muslim",
    narrator: "Omar ibn al-Khattab",
  },
  {
    text: "Le croyant pour le croyant est comme un bâtiment dont les parties se soutiennent mutuellement.",
    source: "Boukhâri & Muslim",
    narrator: "Abu Moussa al-Ash'ari",
  },
  {
    text: "Le meilleur parmi vous est celui qui a le meilleur caractère.",
    source: "Boukhâri",
    narrator: "Abdallah ibn Amr",
  },
  {
    text: "Facilite et ne complique pas, annonce la bonne nouvelle et ne fais pas fuir.",
    source: "Boukhâri & Muslim",
    narrator: "Anas ibn Malik",
  },
  {
    text: "Nul d'entre vous ne sera un vrai croyant tant qu'il n'aimera pas pour son frère ce qu'il aime pour lui-même.",
    source: "Boukhâri & Muslim",
    narrator: "Anas ibn Malik",
  },
  {
    text: "Le fort n'est pas celui qui terrasse les autres ; le fort est celui qui se maîtrise quand il est en colère.",
    source: "Boukhâri & Muslim",
    narrator: "Abu Hourayra",
  },
  {
    text: "Souriez à votre frère — c'est une sadaqa.",
    source: "Tirmidhi",
    narrator: "Abu Dharr al-Ghifâri",
  },
  {
    text: "Cherche ce qui te profite, demande de l'aide à Allah et ne te décourage pas.",
    source: "Muslim",
    narrator: "Abu Hourayra",
  },
  {
    text: "Allah est Beau et Il aime la Beauté.",
    source: "Muslim",
    narrator: "Abdallah ibn Mas'oud",
  },
  {
    text: "Le croyant n'est pas celui qui se rassasie pendant que son voisin est affamé.",
    source: "Al-Bayhaqi",
    narrator: "Ibn Abbas",
  },
  {
    text: "Craignez Allah où que vous soyez, faites succéder à la mauvaise action une bonne action qui l'efface, et comportez-vous avec les gens avec un bon caractère.",
    source: "Tirmidhi",
    narrator: "Mouadh ibn Jabal",
  },
  {
    text: "Dis : « Mon Seigneur, accroît ma science. »",
    source: "Coran 20:114",
    narrator: "Verste du Coran",
  },
  {
    text: "Assurément, avec la difficulté il y a une facilité.",
    source: "Coran 94:6",
    narrator: "Verste du Coran",
  },
  {
    text: "La sincérité est de faire un acte pour Allah seul, sans chercher les regards des hommes.",
    source: "Al-Bayhaqi",
    narrator: "Hadith qudsi",
  },
  {
    text: "Traite les gens comme tu aimes qu'ils te traitent.",
    source: "Tirmidhi",
    narrator: "Abu Hourayra",
  },
];

const QURAN_AYAHS = [
  { arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', fr: 'En vérité, avec la difficulté il y a une facilité.', ref: 'Sourate Al-Inshirah 94:6' },
  { arabic: 'وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ', fr: 'Il se peut que vous ayez en aversion une chose alors qu\'elle vous est un bien.', ref: 'Sourate Al-Baqara 2:216' },
  { arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ', fr: 'Invoquez-Moi donc et Je vous répondrai.', ref: 'Sourate Al-Baqara 2:152' },
  { arabic: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', fr: 'Certes, Allah est avec les endurants.', ref: 'Sourate Al-Baqara 2:153' },
  { arabic: 'وَقُل رَّبِّ زِدْنِي عِلْمًا', fr: 'Et dis : « Mon Seigneur, accroît ma science. »', ref: 'Sourate Taha 20:114' },
];

export async function islamicRoutes(app: FastifyInstance) {
  app.get('/hadith/today', async (_req, reply) => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const hadith = HADITHS[dayOfYear % HADITHS.length];
    const ayah = QURAN_AYAHS[dayOfYear % QURAN_AYAHS.length];
    return reply.send({ hadith, ayah, date: new Date().toISOString().slice(0, 10) });
  });
}
