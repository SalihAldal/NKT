import { MINIMUM_CONTENT_TARGET } from './enums';
import { GAME_CONTENT_TYPE } from './enums';

export type CategoryAgeRating = 'all' | '13+' | '16+' | '18+';

export interface CategoryDefinition {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  isFree: boolean;
  isActive: boolean;
  minimumContentTarget: number;
  supportedContentTypes: Array<(typeof GAME_CONTENT_TYPE)[keyof typeof GAME_CONTENT_TYPE]>;
  ageRating: CategoryAgeRating;
  createdAt: string;
  updatedAt: string;
}

const NOW = '2026-01-01T00:00:00.000Z';

const def = (
  id: string,
  slug: string,
  name: string,
  description: string,
  icon: string,
  order: number,
  isFree: boolean,
  types: readonly CategoryDefinition['supportedContentTypes'][number][],
  ageRating: CategoryAgeRating = 'all',
): CategoryDefinition => ({
  id,
  slug,
  name,
  description,
  icon,
  order,
  isFree,
  isActive: true,
  minimumContentTarget: MINIMUM_CONTENT_TARGET,
  supportedContentTypes: [...types],
  ageRating,
  createdAt: NOW,
  updatedAt: NOW,
});

const Q = [GAME_CONTENT_TYPE.QUESTION] as const;
const QC = [GAME_CONTENT_TYPE.QUESTION, GAME_CONTENT_TYPE.CHALLENGE] as const;
const QCP = [GAME_CONTENT_TYPE.QUESTION, GAME_CONTENT_TYPE.CHALLENGE, GAME_CONTENT_TYPE.PERFORMANCE] as const;
const CP = [GAME_CONTENT_TYPE.CHALLENGE, GAME_CONTENT_TYPE.PERFORMANCE] as const;

/** 20 fixed product categories — 5 free, 15 premium. PRODUCT: not deletable */
export const FIXED_CATEGORIES: readonly CategoryDefinition[] = [
  def('cat-korku', 'korku', 'Korku', 'Gerilim ve korku temalı içerikler', '👻', 1, true, QCP),
  def('cat-cesaret', 'cesaret', 'Cesaret', 'Cesaret görevleri ve meydan okumalar', '🔥', 2, true, CP),
  def('cat-taniyorsun', 'ne-kadar-taniyorsun', 'Ne Kadar Tanıyorsun?', 'Arkadaşlarını ne kadar tanıdığını test et', '💜', 3, true, Q),
  def('cat-utandiran', 'utandiran-sorular', 'Utandıran Sorular', 'Biraz utandıran ama eğlenceli sorular', '😳', 4, true, QC),
  def('cat-gece', 'gece-muhabbeti', 'Gece Muhabbeti', 'Gece sohbetleri için derin sorular', '🌙', 5, true, Q),
  def('cat-ask-iliski', 'ask-iliski', 'Aşk & İlişkiler', 'Romantik ve ilişki temalı içerikler', '💑', 6, false, Q),
  def('cat-itiraf', 'itiraf', 'İtiraflar', 'Cesur itiraflar ve sırlar', '🤫', 7, false, QC),
  def('cat-parti', 'parti', 'Parti', 'Partiler için hızlı oyunlar', '🎉', 8, false, QCP),
  def('cat-eglence', 'eglence', 'Eğlence', 'Eğlenceli ve komik içerikler', '😂', 9, false, QCP),
  def('cat-black-humor', 'black-humor', 'Black Humor', 'Kara mizah temalı içerikler', '🖤', 10, false, QC, '16+'),
  def('cat-tuhaf-absurt', 'tuhaf-absurt', 'Tuhaf & Absürt', 'Garip ve absürt görevler', '🌀', 11, false, QCP),
  def('cat-zor-sorular', 'zor-sorular', 'Zor Sorular', 'Zorlayıcı ve derin sorular', '🧠', 12, false, Q),
  def('cat-film', 'film-dizi', 'Film & Dizi', 'Popüler kültür soruları', '🎬', 13, false, Q),
  def('cat-muzik', 'muzik', 'Müzik', 'Müzik ve sanat temalı sorular', '🎵', 14, false, Q),
  def('cat-spor', 'spor', 'Spor', 'Spor ve rekabet içerikleri', '⚽', 15, false, Q),
  def('cat-oyun', 'oyun', 'Oyun', 'Oyun dünyası temalı içerikler', '🎮', 16, false, Q),
  def('cat-cocukluk', 'cocukluk-anilari', 'Çocukluk Anıları', 'Nostaljik çocukluk soruları', '🧸', 17, false, Q),
  def('cat-18', '18-plus', '+18', 'Yetişkinlere özel içerikler', '🔞', 18, false, QC, '18+'),
  def('cat-kim-daha', 'kim-daha', 'Kim Daha...?', 'Kim daha çok / daha iyi tarzı sorular', '⚖️', 19, false, Q),
  def('cat-arkadaslik-krizi', 'arkadaslik-krizi', 'Arkadaşlık Krizi', 'Arkadaş grubu dram ve eğlence', '💥', 20, false, QC),
] as const;

export const PRODUCT_CATEGORY_COUNT = 20;
export const MIN_FREE_CATEGORIES = 5;

export const FREE_CATEGORY_IDS = FIXED_CATEGORIES.filter((c) => c.isFree).map((c) => c.id);
export const PREMIUM_CATEGORY_IDS = FIXED_CATEGORIES.filter((c) => !c.isFree).map((c) => c.id);

export const getCategoryById = (id: string): CategoryDefinition | undefined =>
  FIXED_CATEGORIES.find((c) => c.id === id);

export const getCategoryBySlug = (slug: string): CategoryDefinition | undefined =>
  FIXED_CATEGORIES.find((c) => c.slug === slug);

export const getCategoryContentTypes = (categoryId: string) =>
  getCategoryById(categoryId)?.supportedContentTypes ?? [
    GAME_CONTENT_TYPE.QUESTION,
    GAME_CONTENT_TYPE.CHALLENGE,
    GAME_CONTENT_TYPE.PERFORMANCE,
  ];
