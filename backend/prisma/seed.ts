import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SEED_VIDEOS = [
  {
    caption: 'Rappel du jour — La patience est la clé du paradis. Prends soin de ton coeur.',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail_url: null,
    duration: 15,
  },
  {
    caption: 'Motivation matinale — Commence ta journée avec Bismillah et avance avec confiance.',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail_url: null,
    duration: 15,
  },
  {
    caption: 'Récitation Sourate Al-Fatiha — Que cette récitation apaise vos coeurs.',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnail_url: null,
    duration: 15,
  },
  {
    caption: 'Lifestyle halal — Nourrir son corps et son âme avec ce qui est pur.',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    thumbnail_url: null,
    duration: 15,
  },
  {
    caption: 'Hadith du jour — "Le meilleur d\'entre vous est celui qui a les meilleures moeurs." (Sahih Muslim)',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    thumbnail_url: null,
    duration: 55,
  },
];

async function main() {
  const hash = await bcrypt.hash('Admin1234!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@tiktok-musulman.local' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@tiktok-musulman.local',
      password_hash: hash,
      display_name: 'Admin',
      gender: 'MALE',
      role: 'ADMIN',
    },
  });

  // Test accounts
  const testMale = await prisma.user.upsert({
    where: { email: 'test.homme@tm.local' },
    update: {},
    create: {
      username: 'test_homme',
      email: 'test.homme@tm.local',
      password_hash: await bcrypt.hash('Test1234!', 12),
      display_name: 'Compte Homme',
      gender: 'MALE',
      role: 'USER',
    },
  });

  const testFemale = await prisma.user.upsert({
    where: { email: 'test.femme@tm.local' },
    update: {},
    create: {
      username: 'test_femme',
      email: 'test.femme@tm.local',
      password_hash: await bcrypt.hash('Test1234!', 12),
      display_name: 'Compte Femme',
      gender: 'FEMALE',
      role: 'USER',
    },
  });

  const categories = [
    { name: 'Rappel', slug: 'rappel' },
    { name: 'Coran', slug: 'coran' },
    { name: 'Motivation', slug: 'motivation' },
    { name: 'Lifestyle', slug: 'lifestyle' },
    { name: 'Cuisine Halal', slug: 'cuisine-halal' },
    { name: 'Education', slug: 'education' },
    { name: 'Nasheeds', slug: 'nasheeds' },
    { name: 'Famille', slug: 'famille' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  // Seed 5 sample posts for testing
  const posters = [testMale, testFemale, admin, testMale, testFemale];
  for (let i = 0; i < SEED_VIDEOS.length; i++) {
    const v = SEED_VIDEOS[i];
    const existing = await prisma.post.findFirst({ where: { video_url: v.video_url } });
    if (!existing) {
      await prisma.post.create({
        data: {
          user_id: posters[i].id,
          video_url: v.video_url,
          thumbnail_url: v.thumbnail_url,
          caption: v.caption,
          duration: v.duration,
          is_public: true,
          status: 'ACTIVE',
        },
      });
    }
  }

  console.log(`Seeded: admin=${admin.email}, testMale=${testMale.email}, testFemale=${testFemale.email}`);
  console.log(`5 sample videos seeded.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
