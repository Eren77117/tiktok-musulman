import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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

  const categories = [
    { name: 'Quran', slug: 'quran' },
    { name: 'Hadith', slug: 'hadith' },
    { name: 'Humour', slug: 'humour' },
    { name: 'Cuisine Halal', slug: 'cuisine-halal' },
    { name: 'Education', slug: 'education' },
    { name: 'Sport', slug: 'sport' },
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

  console.log(`Admin seeded: ${admin.email} / Admin1234!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
