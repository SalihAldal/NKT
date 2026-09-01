import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CATEGORIES = [
  { id: 'cat-korku', slug: 'korku', name: 'Korku', description: 'Gerilim ve korku temalı içerikler', icon: '👻', order: 1, isFree: true, ageRating: 'all' },
  { id: 'cat-cesaret', slug: 'cesaret', name: 'Cesaret', description: 'Cesaret görevleri', icon: '🔥', order: 2, isFree: true, ageRating: 'all' },
  { id: 'cat-taniyorsun', slug: 'ne-kadar-taniyorsun', name: 'Ne Kadar Tanıyorsun?', description: 'Arkadaşlarını test et', icon: '💜', order: 3, isFree: true, ageRating: 'all' },
  { id: 'cat-utandiran', slug: 'utandiran-sorular', name: 'Utandıran Sorular', description: 'Utandıran sorular', icon: '😳', order: 4, isFree: true, ageRating: 'all' },
  { id: 'cat-gece', slug: 'gece-muhabbeti', name: 'Gece Muhabbeti', description: 'Gece sohbetleri', icon: '🌙', order: 5, isFree: true, ageRating: 'all' },
  { id: 'cat-ask-iliski', slug: 'ask-iliski', name: 'Aşk & İlişkiler', description: 'Romantik içerikler', icon: '💑', order: 6, isFree: false, ageRating: 'all' },
  { id: 'cat-itiraf', slug: 'itiraf', name: 'İtiraflar', description: 'Cesur itiraflar', icon: '🤫', order: 7, isFree: false, ageRating: 'all' },
  { id: 'cat-parti', slug: 'parti', name: 'Parti', description: 'Parti oyunları', icon: '🎉', order: 8, isFree: false, ageRating: 'all' },
  { id: 'cat-eglence', slug: 'eglence', name: 'Eğlence', description: 'Eğlenceli içerikler', icon: '😂', order: 9, isFree: false, ageRating: 'all' },
  { id: 'cat-black-humor', slug: 'black-humor', name: 'Black Humor', description: 'Kara mizah', icon: '🖤', order: 10, isFree: false, ageRating: '16+' },
  { id: 'cat-tuhaf-absurt', slug: 'tuhaf-absurt', name: 'Tuhaf & Absürt', description: 'Absürt görevler', icon: '🌀', order: 11, isFree: false, ageRating: 'all' },
  { id: 'cat-zor-sorular', slug: 'zor-sorular', name: 'Zor Sorular', description: 'Zorlayıcı sorular', icon: '🧠', order: 12, isFree: false, ageRating: 'all' },
  { id: 'cat-film', slug: 'film-dizi', name: 'Film & Dizi', description: 'Popüler kültür', icon: '🎬', order: 13, isFree: false, ageRating: 'all' },
  { id: 'cat-muzik', slug: 'muzik', name: 'Müzik', description: 'Müzik soruları', icon: '🎵', order: 14, isFree: false, ageRating: 'all' },
  { id: 'cat-spor', slug: 'spor', name: 'Spor', description: 'Spor içerikleri', icon: '⚽', order: 15, isFree: false, ageRating: 'all' },
  { id: 'cat-oyun', slug: 'oyun', name: 'Oyun', description: 'Oyun dünyası', icon: '🎮', order: 16, isFree: false, ageRating: 'all' },
  { id: 'cat-cocukluk', slug: 'cocukluk-anilari', name: 'Çocukluk Anıları', description: 'Nostaljik sorular', icon: '🧸', order: 17, isFree: false, ageRating: 'all' },
  { id: 'cat-18', slug: '18-plus', name: '+18', description: 'Yetişkin içerik', icon: '🔞', order: 18, isFree: false, ageRating: '18+' },
  { id: 'cat-kim-daha', slug: 'kim-daha', name: 'Kim Daha...?', description: 'Kim daha soruları', icon: '⚖️', order: 19, isFree: false, ageRating: 'all' },
  { id: 'cat-arkadaslik-krizi', slug: 'arkadaslik-krizi', name: 'Arkadaşlık Krizi', description: 'Arkadaş grubu dram', icon: '💥', order: 20, isFree: false, ageRating: 'all' },
];

const BADGES = [
  { id: 'first-quiz', name: 'İlk Test', description: 'İlk testini oluştur', icon: '📝', rarity: 'common', condition: 'quizzes_created >= 1' },
  { id: 'first-game', name: 'İlk Oyun', description: 'İlk oyununu oyna', icon: '🎮', rarity: 'common', condition: 'games_played >= 1' },
  { id: 'ten-quiz', name: '10 Test', description: '10 test oluştur', icon: '📚', rarity: 'rare', condition: 'quizzes_created >= 10' },
  { id: 'first-win', name: 'İlk Galibiyet', description: 'İlk galibiyetini kazan', icon: '🏆', rarity: 'common', condition: 'wins >= 1' },
  { id: 'nkt-veteran', name: 'NKT Veteran', description: '50 oyun tamamla', icon: '⭐', rarity: 'legendary', condition: 'games_played >= 50' },
];

const FEATURE_FLAGS = [
  { key: 'friend_room', label: 'Arkadaş Ortamı', enabled: true },
  { key: 'premium', label: 'Premium', enabled: true },
  { key: 'ai_generation', label: 'AI İçerik', enabled: true },
  { key: 'ads', label: 'Reklamlar', enabled: true },
  { key: 'custom_category', label: 'Özel Kategori', enabled: true },
  { key: 'adult_18', label: '+18', enabled: true },
  { key: 'leaderboard', label: 'Leaderboard', enabled: true },
  { key: 'notifications', label: 'Bildirimler', enabled: true },
];

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    console.error('Seed blocked in production. Set ALLOW_PRODUCTION_SEED=true to run explicitly.');
    process.exit(1);
  }

  console.log('Seeding database...');

  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: cat.id },
      create: { ...cat, supportedContentTypes: ['QUESTION', 'CHALLENGE', 'PERFORMANCE'], minimumContentTarget: 300, isActive: true },
      update: { name: cat.name, isFree: cat.isFree, ageRating: cat.ageRating },
    });
  }
  console.log(`✓ ${CATEGORIES.length} categories`);

  for (const badge of BADGES) {
    await prisma.badge.upsert({ where: { id: badge.id }, create: badge, update: badge });
  }
  console.log(`✓ ${BADGES.length} badges`);

  for (const flag of FEATURE_FLAGS) {
    await prisma.featureFlag.upsert({ where: { key: flag.key }, create: { ...flag, environment: 'all' }, update: { label: flag.label } });
  }
  console.log(`✓ ${FEATURE_FLAGS.length} feature flags`);

  const adminEmail = process.env.ADMIN_SEED_EMAIL ?? 'admin@localhost';
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminPassword) {
    console.error('ADMIN_SEED_PASSWORD is required. Set it in your .env file (min 8 characters).');
    process.exit(1);
  }
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, displayName: 'Local Admin', passwordHash: await bcrypt.hash(adminPassword, 12), role: 'SUPER_ADMIN' },
    update: {},
  });
  console.log('✓ Admin user');

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
