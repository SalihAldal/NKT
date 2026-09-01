import type { GameContent } from '@/domain/models/content';
import type { DifficultyLevel } from '@/domain/constants/enums';
import { GAME_CONTENT_TYPE } from '@/domain/constants/enums';
import { ANSWER_TYPE, MODERATION_STATUS } from '@/domain/constants/enums';
import { FIXED_CATEGORIES, getCategoryById } from '@/domain/constants/categories';
import { getCategoryContentMix } from '@/domain/constants/category-mix';
import { CONTENT_QUALITY_STATUS } from '@/domain/constants/content';
import { CONTENT_DATASET_VERSION, CONTENT_PER_CATEGORY_TARGET } from '@/domain/constants/content-version';
import { normalizeContentText } from './content-normalizer';
import { computeQualityScore } from './content-quality-score';

type ContentType = (typeof GAME_CONTENT_TYPE)[keyof typeof GAME_CONTENT_TYPE];
type Difficulty = DifficultyLevel;

const pick = <T>(arr: readonly T[], index: number): T => arr[index % arr.length]!;

const THEMES = ['tercih', 'tahmin', 'gecmis', 'kisilik', 'iliski', 'senaryo', 'karsilastirma', 'komik', 'itiraf', 'hayal', 'secim', 'hizli'] as const;

export interface TypeCounts {
  question: number;
  challenge: number;
  performance: number;
}

export const computeTypeCounts = (categoryId: string, target: number): TypeCounts => {
  const cat = getCategoryById(categoryId);
  const mix = getCategoryContentMix(categoryId);
  const supported = new Set(cat?.supportedContentTypes ?? ['question']);
  const raw = {
    question: Math.round((target * (mix.question ?? 0)) / 100),
    challenge: Math.round((target * (mix.challenge ?? 0)) / 100),
    performance: Math.round((target * (mix.performance ?? 0)) / 100),
  };
  if (!supported.has('question')) raw.question = 0;
  if (!supported.has('challenge')) raw.challenge = 0;
  if (!supported.has('performance')) raw.performance = 0;
  const sum = raw.question + raw.challenge + raw.performance;
  const diff = target - sum;
  const fallback = supported.has('question') ? 'question' : supported.has('challenge') ? 'challenge' : 'performance';
  raw[fallback] += diff;
  return raw;
};

const buildCombo = (banks: readonly (readonly string[])[], index: number): string =>
  banks.map((b, i) => pick(b, index * (i + 3) * 997 + index * index + i * 13)).join(' ').replace(/\s+/g, ' ').trim();

const CLOSERS = [
  'Ne dersin?', 'Sen ne yapardın?', 'Açıkla.', 'Kısaca anlat.', 'Detaylı cevapla.',
  'İlk tepkin ne olur?', 'Samimi ol.', 'Düşün ve söyle.', 'Hızlı cevap ver.', 'Cesurca cevapla.',
  'Komik cevap ver.', 'Ciddi cevapla.', 'Gruptan birini seç.', 'Partnerine sor.', 'Arkadaşına sor.',
  'Neden öyle düşünüyorsun?', 'Bir örnek ver.', 'En son ne zaman oldu?', 'Hatırlıyor musun?', 'Paylaşır mısın?',
  'Gizli tutar mısın?', 'Herkes duysun.', 'Sadece grup bilsin.', 'İtiraf et.', 'Tahmin et.',
  'Doğru mu?', 'Yanlış mı?', 'Emin misin?', 'Şaşırtıcı mı?', 'Beklenmedik mi?',
  'Komik mi ciddi mi?', 'Utandırır mı?', 'Eğlenceli mi?', 'Zor mu?', 'Kolay mı?',
  'Geçmişten bir an.', 'Gelecekten bir hayal.', 'Şu an ne hissediyorsun?', 'İlk aklına gelen.', 'En son aklına gelen.',
  'Grup ne der?', 'Tek başına ne yapardın?', 'Partnerinle ne yapardın?', 'Arkadaşlarınla ne yapardın?', 'Ailenden gizler misin?',
  'Sosyal medyada paylaşır mısın?', 'Asla söylemezsin?', 'Hemen söylersin?', 'Biraz düşünürsün?', 'Cevap vermekten kaçınır mısın?',
  'Gülerek mi cevaplarsın?', 'Ciddiyetle mi?', 'Şaka yaparak mı?', 'İroniyle mi?', 'Samimiyetle mi?',
  'En sevdiğin hangisi?', 'En nefret ettiğin hangisi?', 'Kararsız mısın?', 'Net cevap ver.', 'İki seçenek sun.',
  'Birini seç.', 'Sıralama yap.', 'Puan ver.', 'Yıldız ver.', 'Evet ya da hayır de.',
  'Belki de.', 'Duruma göre.', 'Her zaman mı?', 'Hiç mi?', 'Bazen mi?',
  'Sık sık mı?', 'Nadiren mi?', 'Unutulmaz mı?', 'Sıradan mı?', 'Özel mi?',
  'Komik bir anı ekle.', 'Ciddi bir anı ekle.', 'Kısa tut.', 'Uzun anlat.', 'Tek cümleyle cevapla.',
  'Üç kelimeyle cevapla.', 'Bir kelimeyle cevapla.', 'Emoji ile cevapla.', 'Ses tonunla cevapla.', 'Mimikle cevapla.',
  'Grup oylaması yap.', 'Partnerine danış.', 'Kendi kararını ver.', 'Çoğunluğa uy.', 'Farklı düşün.',
  'Şaşırt bizi.', 'Beklentiyi kır.', 'Tahminimizden farklı mı?', 'Herkes aynı mı der?', 'Farklı cevaplar çıkar mı?',
  'En popüler cevap ne?', 'En az beklenen ne?', 'Grupta tartışma çıkar mı?', 'Kahkaha atar mısınız?', 'Utanırsınız mı?',
  'Derin bir soru mu?', 'Yüzeysel mi?', 'Eğlence için mi?', 'Ciddi sohbet için mi?', 'Gece muhabbeti için mi?',
  'Parti ortamında mı?', 'Sakin ortamda mı?', 'İlk buluşmada sorulur mu?', 'Yıllar sonra sorulur mu?', 'Hemen sorulur mu?',
] as const;

type ComboTemplate = readonly (readonly string[])[];
type CategoryBanks = Partial<Record<ContentType, readonly ComboTemplate[]>>;

const BANKS: Record<string, CategoryBanks> = {
  'cat-korku': {
    question: [
      [['Karanlıkta', 'Gece yalnızken', 'Fırtınalı bir gecede', 'Eski bir evde', 'Sessiz bir apartmanda', 'Issız bir yolda', 'Kamp alanında gece', 'Otel odasında gece'], ['bodrum katında', 'koridorda', 'tavan arasında', 'banyoda', 'merdiven boşluğunda', 'balkonda', 'garajda', 'mutfakta'], ['bir ses duysan', 'ışıklar sönse', 'kapı kendi kendine açılsa', 'ayna arkanda biri olsa', 'telefon çalsa', 'perde hareket etse', 'musluk damlasa', 'rüzgar estiğinde'], ['ilk ne yapardın?', 'nasıl tepki verirdin?', 'kime mesaj atardın?', 'hangi odaya bakardın?', 'nereye saklanırdın?']],
      [['Korku filminde', 'Gerilim dizisinde', 'Klasik bir korku hikâyesinde', 'Bir hayalet hikâyesinde'], ['tek başına kalsan', 'grupla olsan', 'partnerinle olsan', 'yabancılarla olsan'], ['hangi karakter', 'hangi sahne', 'hangi an', 'hangi mekan'], ['seni en çok ürpertir?', 'en çok korkutur?', 'en çok etkiler?', 'en çok gerer?']],
    ],
    challenge: [
      [['Işıkları kapat ve', 'Gözlerini kapatıp', 'Aynaya bakarak', 'Karanlıkta durarak', 'Sessizce oturarak'], ['5', '8', '10', '12', '15', '20'], ['saniye boyunca', 'saniye'], ['konuşmadan bekle.', 'nefesini kontrol et.', 'korku yüzünü yap.', 'sessiz kal.', 'hareket etme.']],
    ],
    performance: [
      [['Bir korku filmindeki', 'Bir gerilim dizisindeki', 'Klasik bir korku sahnesindeki', 'Bir korku oyunundaki'], ['panik anını', 'kaçış sahnesini', 'ilk şok anını', 'karanlıkta yürüme sahnesini', 'son sahneyi'], ['canlandır.', 'taklit et.', 'oyna.', 'göster.']],
    ],
  },
  'cat-cesaret': {
    challenge: [
      [['Gruba', 'Odaya', 'Herkesin önünde', 'Arkadaşlarına', 'Partnerine'], ['10', '15', '20', '30', '45'], ['saniye boyunca', 'bir tur boyunca'], ['komik bir dans yap.', 'sevdiğin şarkıdan bir kıta söyle.', 'taklit yap.', 'komik bir ses çıkar.', 'şaka yap.', 'komik bir hareket yap.']],
      [['Cesaret gerektiren', 'Komik bir', 'Sosyal bir', 'Eğlenceli bir'], ['görevi', 'meydan okumayı', 'mini performansı', 'taklidi'], ['şimdi yap.', 'gruba göster.', 'dene.', 'sergile.']],
    ],
    performance: [
      [['Ünlü bir karakterin', 'Komik bir ünlünün', 'Sevdiğin bir dizi karakterinin', 'Bir çizgi film karakterinin'], ['konuşma tarzını', 'mimiklerini', 'yürüyüşünü', 'sesini', 'jestlerini'], ['taklit et.', 'canlandır.', 'göster.']],
    ],
  },
  'cat-taniyorsun': {
    question: [
      [['Arkadaşının', 'Partnerinin', 'Grubun en sessiz üyesinin', 'En komik arkadaşının', 'En ciddi arkadaşının', 'En dağınık arkadaşının'], ['en sevdiği', 'en nefret ettiği', 'gizlice izlediği', 'sürekli konuştuğu', 'en çok kullandığı', 'en çok aldığı'], ['yemek', 'dizi', 'müzik türü', 'tatil yeri', 'uygulama', 'renk', 'spor', 'marka', 'içecek', 'şarkı'], ['nedir?', 'hangisidir?', 'tahmin et.', 'bilir misin?']],
      [['Bu kişinin', 'Partnerinin', 'Arkadaşının', 'Grup arkadaşının'], ['en büyük', 'en gizli', 'en komik', 'en garip', 'en tatlı'], ['alışkanlığı', 'korkusu', 'hayali', 'takıntısı', 'özelliği'], ['ne olabilir?', 'nedir?', 'tahmin et.']],
    ],
  },
  'cat-utandiran': {
    question: [
      [['En utandığın', 'Gizli tuttuğun', 'Kimseye söylemediğin', 'Yüzün kızardığı', 'Ailenden gizlediğin'], ['an', 'alışkanlık', 'hikâye', 'mesaj', 'fotoğraf', 'ses kaydı', 'arama'], ['ne olabilir?', 'nedir?', 'paylaşır mısın?', 'anlatır mısın?']],
    ],
    challenge: [
      [['En utanç verici', 'En komik', 'En garip', 'En şaşırtıcı'], ['anını', 'hikâyeni', 'taklidini', 'hatıranı'], ['5 saniyede anlat.', 'kısaca anlat.', 'canlandır.', 'göster.', 'paylaş.']],
    ],
    performance: [
      [['En utandığın anındaki', 'Utanınca', 'Yüzün kızarınca', 'Mahcup olduğunda'], ['yüz ifadeni', 'halini', 'davranışını', 'beden dilini'], ['göster.', 'canlandır.', 'sergile.']],
    ],
  },
  'cat-gece': {
    question: [
      [['Gece sohbetinde', 'Sabaha kadar konuşurken', 'Yastık muhabbetinde', 'Gece 3\'te', 'Uykusuz bir gecede', 'Yıldızlı bir gecede'], ['hangi konuyu', 'hangi soruyu', 'hangi itirafı', 'hangi anıyı', 'hangi sırrı'], ['açmak isterdin?', 'konuşmak isterdin?', 'duymak isterdin?', 'paylaşmak isterdin?']],
      [['Gece', 'Uykusuzken', 'Yalnızken gece', 'Sessiz bir gecede'], ['en çok', 'ilk', 'son', 'derinlemesine'], ['düşündüğün', 'özlediğin', 'merak ettiğin', 'hayal ettiğin'], ['şey', 'kişi', 'an', 'yer'], ['ne?', 'kim?', 'neresi?']],
    ],
  },
  'cat-ask-iliski': {
    question: [
      [['İlişkilerde', 'Aşkta', 'Flörtte', 'Romantik bir ortamda', 'İlk buluşmada'], ['en önemli', 'en zor', 'en güzel', 'en komik', 'en romantik', 'en utandıran'], ['şey', 'an', 'özellik', 'kural', 'jest', 'söz'], ['senin için nedir?', 'ne olurdu?', 'nasıl olur?']],
    ],
  },
  'cat-itiraf': {
    question: [
      [['Hiç kimseye söylemediğin', 'Gizli tuttuğun', 'İçinden geçirip söylemediğin', 'Sadece düşündüğün'], ['bir', 'küçük bir', 'cesur bir', 'samimi bir'], ['itirafın', 'düşüncen', 'hayalin', 'sırrın', 'pişmanlığın'], ['ne olurdu?', 'paylaşır mısın?', 'söyler misin?']],
    ],
    challenge: [
      [['Komik', 'Cesur', 'Samimi', 'Gizli', 'Dürüst'], ['bir itiraf', 'bir sır', 'bir düşünce', 'bir pişmanlık'], ['yap.', 'paylaş.', 'söyle.', 'anlat.']],
    ],
  },
  'cat-parti': {
    question: [
      [['Partide', 'Kutlamada', 'Eğlencede', 'Gece dışarıda', 'Doğum gününde', 'Düğünde'], ['ne yapmayı', 'kimi seçmeyi', 'hangi oyunu', 'hangi müziği', 'hangi dansı'], ['tercih ederdin?', 'seçerdin?', 'dinlersin?', 'yaparsın?']],
    ],
    challenge: [
      [['Herkesin önünde', 'Gruba', 'Odaya', 'Dans pistinde'], ['5', '10', '15', '20', '30'], ['saniye boyunca', 'bir tur'], ['parti dansı yap.', 'komik hareket yap.', 'şarkı söyle.', 'taklit yap.', 'coş.']],
    ],
    performance: [
      [['Bir parti anındaki', 'Kutlamadaki', 'Eğlencedeki', 'Dans pistindeki'], ['coşkulu', 'komik', 'şaşkın', 'mutlu', 'enerjik'], ['halini', 'yüzünü', 'hareketini', 'dansını'], ['canlandır.', 'göster.', 'sergile.']],
    ],
  },
  'cat-eglence': {
    question: [
      [['En komik', 'En absürt', 'En eğlenceli', 'En saçma', 'En unutulmaz'], ['anın', 'hikâyen', 'taklidin', 'fikrin', 'şakan', 'olayın'], ['ne olurdu?', 'hangisi?', 'nedir?', 'anlat.']],
    ],
    challenge: [
      [['Komik', 'Saçma', 'Absürt', 'Eğlenceli', 'Şaşırtıcı'], ['bir taklit', 'bir ses', 'bir hareket', 'bir şaka'], ['yap.', 'göster.', 'sergile.']],
    ],
    performance: [
      [['En güldüğün', 'En komik', 'En absürt', 'En eğlenceli'], ['anı', 'olay', 'taklit', 'halin'], ['sesle', 'mimikle', 'hareketle'], ['canlandır.', 'göster.']],
    ],
  },
  'cat-black-humor': {
    question: [
      [['Kara mizah seven biri olarak', 'İroniyle', 'Gülerek', 'Alaycı bir şekilde', 'Esprili bir şekilde'], ['hangi durumu', 'hangi konuyu', 'hangi şakayı', 'hangi yorumu'], ['komik bulursun?', 'anlatırsın?', 'paylaşırsın?', 'söylersin?']],
    ],
    challenge: [
      [['Kara mizah tadında', 'İronik bir', 'Komik ama karanlık', 'Esprili bir'], ['kısa cümle', 'yorum', 'şaka', 'gözlem'], ['kur.', 'söyle.', 'paylaş.']],
    ],
    performance: [
      [['Komik bir durumda', 'İronik bir anda', 'Şaka yaparken', 'Gülerken'], ['sıkıldığın', 'şaşırdığın', 'güldüğün', 'düşündüğün'], ['yüz ifadesini', 'halini', 'mimiklerini'], ['göster.', 'canlandır.']],
    ],
  },
  'cat-tuhaf-absurt': {
    question: [
      [['Eğer', 'Diyelim ki', 'Bir gün', 'Yarın', 'Bir sabah uyandığında'], ['tavuklar konuşsa', 'zaman ters aksa', 'herkes aynı renkte olsa', 'yerçekimi yarıya inse', 'kediler yönetsin', 'para yemek olsa'], ['ne olurdu?', 'ilk ne yapardın?', 'nasıl olurdu?', 'ne yapardın?']],
    ],
    challenge: [
      [['Absürt bir', 'Garip bir', 'Tuhaf bir', 'Saçma bir'], ['hayvan', 'nesne', 'karakter', 'ses', 'robot'], ['taklidi yap.', 'sesini çıkar.', 'hareketini yap.', 'canlandır.']],
    ],
    performance: [
      [['En absürt', 'En tuhaf', 'En garip', 'En saçma'], ['rüyanı', 'halini', 'davranışını', 'fikrini'], ['3', '5', '7', '10'], ['saniyede canlandır.', 'saniye göster.', 'saniye sergile.']],
    ],
  },
  'cat-zor-sorular': {
    question: [
      [['Hayatında', 'Dünyada', 'İnsanlık için', 'Gelecekte', 'Toplumda'], ['en zor', 'en önemli', 'en tartışmalı', 'en derin', 'en kritik'], ['karar', 'soru', 'dilemma', 'seçim', 'sorun'], ['ne olurdu?', 'hangisi?', 'nasıl karar verirsin?', 'ne yapardın?']],
    ],
  },
  'cat-film': {
    question: [
      [['Hangi film', 'Hangi dizi', 'Hangi karakter', 'Hangi replik', 'Hangi sahne', 'Hangi yönetmen'], ['seni', 'arkadaşını', 'herkesi', 'ailemi', 'partnerini'], ['en çok etkiler?', 'güldürür?', 'ağlatır?', 'şaşırtır?', 'düşündürür?']],
    ],
  },
  'cat-muzik': {
    question: [
      [['En sevdiğin', 'Gizlice dinlediğin', 'Herkesin bilmediği', 'En çok dinlediğin', 'Nostaljik'], ['şarkı', 'sanatçı', 'albüm', 'tür', 'konser', 'playlist'], ['hangisi?', 'nedir?', 'kim?', 'ne?']],
    ],
  },
  'cat-spor': {
    question: [
      [['Hangi spor', 'Hangi takım', 'Hangi sporcu', 'Hangi maç', 'Hangi lig', 'Hangi pozisyon'], ['senin favorin?', 'en çok izlediğin?', 'tuttuğun?', 'takip ettiğin?', 'oynadığın?']],
    ],
  },
  'cat-oyun': {
    question: [
      [['Hangi oyun', 'Hangi karakter', 'Hangi konsol', 'Hangi skin', 'Hangi harita', 'Hangi mod'], ['en çok oynadığın?', 'favorin?', 'nostaljik favorin?', 'en çok kazandığın?', 'en çok kaybettiğin?']],
    ],
  },
  'cat-cocukluk': {
    question: [
      [['Çocukken', 'Küçükken', 'İlkokulda', 'Lisede', 'Mahallede'], ['en sevdiğin', 'en komik', 'en utandığın', 'en unutamadığın', 'en nostaljik'], ['anı', 'oyun', 'arkadaş', 'öğretmen', 'hediye', 'yer'], ['ne?', 'kim?', 'neresi?']],
    ],
  },
  'cat-18': {
    question: [
      [['Yetişkin bir ilişkide', 'Flörtte', 'Romantik bir ortamda', 'Samimi bir sohbette', 'Yakınlıkta'], ['en çekici', 'en cesur', 'en komik', 'en samimi', 'en romantik'], ['özellik', 'an', 'itiraf', 'soru', 'jest'], ['ne olurdu?', 'nedir?', 'nasıl olur?']],
    ],
    challenge: [
      [['Cesur ama saygılı', 'Samimi', 'Romantik', 'Flörtöz'], ['bir itiraf', 'bir soru', 'bir kompliman', 'bir mesaj'], ['yap.', 'söyle.', 'paylaş.']],
    ],
  },
  'cat-kim-daha': {
    question: [
      [['Kim daha', 'Grupta kim daha', 'Arkadaşlarınızdan kim daha', 'Bu odada kim daha'], ['çok güler', 'geç kalır', 'yemek yer', 'konuşur', 'utangaç', 'cesur', 'tembel', 'düzenli', 'komik', 'ciddi', 'hızlı', 'yavaş', 'gürültülü', 'sakin', 'dikkatli', 'dağınık', 'kıskanç', 'sabırlı', 'inatçı', 'yardımsever'], ['?', 'olur?', 'derdin?', 'yapar?']],
    ],
  },
  'cat-arkadaslik-krizi': {
    question: [
      [['Arkadaş grubunda', 'Dostluk ilişkisinde', 'Kıskançlık anında', 'Grup içinde', 'Arkadaşlıkta'], ['en dramatik', 'en komik', 'en zor', 'en garip', 'en unutulmaz'], ['durum', 'an', 'kriz', 'olay', 'tartışma'], ['ne olurdu?', 'nasıl çözülür?', 'ne yapardın?', 'nasıl biter?']],
    ],
    challenge: [
      [['Arkadaşlık krizindeki', 'Drama anındaki', 'Barışma anındaki', 'Tartışma anındaki'], ['tartışma', 'barışma', 'şaka', 'olay', 'kriz'], ['anı', 'halini', 'yüzünü'], ['canlandır.', 'göster.', 'sergile.']],
    ],
    performance: [
      [['Drama queen', 'Drama king', 'Barışan arkadaş', 'Kızan arkadaş'], ['moduna', 'haline', 'yüzüne', 'sesine'], ['3', '5', '7'], ['saniye gir.', 'saniye geç.', 'saniye canlandır.']],
    ],
  },
};

const DIFFICULTY_PREFIX: Record<Difficulty, readonly string[]> = {
  1: ['', 'Hızlı cevap:', 'Kolay:'],
  2: ['', 'Biraz düşün:', 'Detaylı cevap ver:'],
  3: ['', 'Derinlemesine düşün:', 'Cesurca cevapla:', 'Zor:'],
};

const generatePrompt = (categoryId: string, type: ContentType, difficulty: Difficulty, index: number): string => {
  const templates = BANKS[categoryId]?.[type];
  if (!templates?.length) {
    const name = getCategoryById(categoryId)?.name ?? categoryId;
    return `${name} — ${type} görevi ${index + 1}: ${pick(CLOSERS, index)}`;
  }
  const templateIdx = index % templates.length;
  const subIndex = Math.floor(index / templates.length) + index;
  const template = templates[templateIdx]!;
  const base = buildCombo(template, subIndex * 3 + difficulty * 7 + index);
  const prefix = pick(DIFFICULTY_PREFIX[difficulty], index);
  const closer = pick(CLOSERS, index * 31 + difficulty * 7);
  const core = prefix ? `${prefix} ${base}` : base;
  return `${core} ${closer}`;
};

const buildContent = (
  categoryId: string,
  type: ContentType,
  difficulty: Difficulty,
  prompt: string,
  index: number,
): Omit<GameContent, 'id'> => {
  const cat = getCategoryById(categoryId)!;
  const isQ = type === GAME_CONTENT_TYPE.QUESTION;
  const now = new Date().toISOString();
  const base: Omit<GameContent, 'id'> = {
    categoryId,
    type,
    difficulty,
    prompt,
    answerType: isQ ? ANSWER_TYPE.TEXT : ANSWER_TYPE.ACTION,
    tags: [pick(THEMES, index), type, `d${difficulty}`],
    ageRating: cat.ageRating === '18+' ? '18+' : cat.ageRating === '16+' ? '16+' : 'all',
    premium: !cat.isFree,
    active: true,
    moderationStatus: MODERATION_STATUS.APPROVED,
    qualityStatus: CONTENT_QUALITY_STATUS.ACTIVE,
    locale: 'tr-TR',
    contentVersion: CONTENT_DATASET_VERSION,
    normalizedIdentity: normalizeContentText(prompt),
    aiGenerated: false,
    safetyFlags: [],
    diversityTheme: pick(THEMES, index),
    usageCount: 0,
    completionCount: 0,
    skipCount: 0,
    timeoutCount: 0,
    reportCount: 0,
    averageResponseTimeMs: 0,
    createdAt: now,
    updatedAt: now,
  };
  if (isQ && index % 4 === 0) {
    base.answerType = ANSWER_TYPE.CHOICE;
    base.options = [
      { id: 'a', text: pick(['Kesinlikle', 'Evet', 'Tabii', 'Bence öyle'], index), isCorrect: true },
      { id: 'b', text: pick(['Hayır', 'Pek değil', 'Şüpheli', 'Bilmiyorum'], index + 1) },
      { id: 'c', text: pick(['Belki', 'Olabilir', 'Duruma göre', 'Kararsızım'], index + 2) },
      { id: 'd', text: pick(['Asla', 'İmkânsız', 'Kesinlikle hayır', 'Hiç'], index + 3) },
    ];
    base.correctAnswer = 'a';
  } else if (isQ) {
    base.correctAnswer = 'cevap';
  }
  base.qualityScore = computeQualityScore(base as GameContent);
  return base;
};

export const generateCategoryDataset = (
  categoryId: string,
  target = CONTENT_PER_CATEGORY_TARGET,
): Omit<GameContent, 'id'>[] => {
  const cat = getCategoryById(categoryId);
  if (!cat) throw new Error(`Unknown category: ${categoryId}`);

  const typeCounts = computeTypeCounts(categoryId, target);
  const items: Omit<GameContent, 'id'>[] = [];
  const seen = new Set<string>();

  const queue: Array<{ type: ContentType; count: number }> = [
    { type: GAME_CONTENT_TYPE.QUESTION, count: typeCounts.question },
    { type: GAME_CONTENT_TYPE.CHALLENGE, count: typeCounts.challenge },
    { type: GAME_CONTENT_TYPE.PERFORMANCE, count: typeCounts.performance },
  ].filter((t) => t.count > 0 && cat.supportedContentTypes.includes(t.type));

  let globalIndex = 0;

  for (const { type, count } of queue) {
    const perDiff = Math.floor(count / 3);
    let remainder = count - perDiff * 3;

    for (let diff = 1 as Difficulty; diff <= 3; diff++) {
      const need = perDiff + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;

      for (let i = 0; i < need; i++) {
        let prompt = generatePrompt(categoryId, type, diff, globalIndex);
        let attempt = 0;
        while (seen.has(normalizeContentText(prompt)) && attempt < 50) {
          globalIndex++;
          prompt = generatePrompt(categoryId, type, diff, globalIndex);
          attempt++;
        }
        seen.add(normalizeContentText(prompt));
        items.push(buildContent(categoryId, type, diff, prompt, globalIndex));
        globalIndex++;
      }
    }
  }

  while (items.length < target) {
    const type = pick(cat.supportedContentTypes, items.length);
    const diff = ((items.length % 3) + 1) as Difficulty;
    let prompt = generatePrompt(categoryId, type, diff, globalIndex);
    let attempt = 0;
    while (seen.has(normalizeContentText(prompt)) && attempt < 50) {
      globalIndex++;
      prompt = generatePrompt(categoryId, type, diff, globalIndex);
      attempt++;
    }
    seen.add(normalizeContentText(prompt));
    items.push(buildContent(categoryId, type, diff, prompt, globalIndex));
    globalIndex++;
  }

  return items.slice(0, target);
};

export const generateFullDataset = (targetPerCategory = CONTENT_PER_CATEGORY_TARGET): GameContent[] => {
  const all: GameContent[] = [];
  for (const cat of FIXED_CATEGORIES) {
    const partial = generateCategoryDataset(cat.id, targetPerCategory);
    partial.forEach((p, i) => {
      all.push({ ...p, id: `content-${cat.id}-${String(i).padStart(4, '0')}` });
    });
  }
  return all;
};

export const getDatasetStats = (items: GameContent[]) => {
  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const byType: Record<string, number> = {};
  for (const item of items) {
    byCategory[item.categoryId] = (byCategory[item.categoryId] ?? 0) + 1;
    byDifficulty[item.difficulty] = (byDifficulty[item.difficulty] ?? 0) + 1;
    byType[item.type] = (byType[item.type] ?? 0) + 1;
  }
  return { total: items.length, byCategory, byDifficulty, byType };
};

export const verifyDifficultyDistribution = (items: GameContent[], categoryId: string) => {
  const catItems = items.filter((i) => i.categoryId === categoryId);
  const d1 = catItems.filter((i) => i.difficulty === 1).length;
  const d2 = catItems.filter((i) => i.difficulty === 2).length;
  const d3 = catItems.filter((i) => i.difficulty === 3).length;
  return { d1, d2, d3, total: catItems.length, balanced: d1 >= 90 && d2 >= 90 && d3 >= 90 };
};
