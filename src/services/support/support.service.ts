export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
}

export const HELP_ARTICLES: HelpArticle[] = [
  { id: 'create-quiz', category: 'Quiz', title: 'Quiz nasıl oluşturulur?', content: 'Ana Sayfa → Beni Ne Kadar Tanıyorsun? → Kategori seç → Soruları ekle → Paylaş. Arkadaşların link ile testi çözebilir.' },
  { id: 'friend-room', category: 'Oyun', title: 'Arkadaş Ortamı nasıl oynanır?', content: 'Ana Sayfa → Arkadaş Ortamı → Oda oluştur veya koda katıl. Lobide hazır ol, host oyunu başlatır. Kategori seç ve eğlen!' },
  { id: 'room-code', category: 'Oyun', title: 'Oda kodu nasıl kullanılır?', content: '6 haneli oda kodunu arkadaşlarınla paylaş. Katılmak için Arkadaş Ortamı → Odaya Katıl → kodu gir.' },
  { id: 'premium', category: 'Premium', title: 'Premium nedir?', content: '15 premium kategori, AI soru üretimi, reklamsız deneyim, özel kategoriler ve premium oda özellikleri. Profil → Premium\'a Geç.' },
  { id: 'restore', category: 'Premium', title: 'Satın alımı geri yükle', content: 'Premium ekranında "Satın alımlarımı geri yükle" butonuna bas. Apple/Google hesabınla satın aldığın abonelik otomatik senkronize edilir.' },
  { id: 'custom-category', category: 'Premium', title: 'Özel kategori', content: 'Premium kullanıcılar kendi kategorilerini oluşturabilir. Profil → Kategorilerim → Yeni Kategori.' },
  { id: 'report-block', category: 'Güvenlik', title: 'Şikayet ve engelleme', content: 'Bir kullanıcıyı profilinden engelleyebilir veya Ayarlar → Bize Ulaşın üzerinden şikayet edebilirsin.' },
  { id: 'delete-account', category: 'Hesap', title: 'Hesap silme', content: 'Ayarlar → Hesabımı Sil. Profil, arkadaşlık, davet ve bildirim verilerin gizlilik politikasına uygun şekilde silinir veya anonimleştirilir.' },
];

export type SupportCategory = 'bug' | 'content' | 'account' | 'payment' | 'other';

export interface SupportTicket {
  id: string;
  userId: string;
  category: SupportCategory;
  description: string;
  createdAt: string;
}

class SupportServiceImpl {
  private tickets: SupportTicket[] = [];

  getHelpArticles(): HelpArticle[] {
    return HELP_ARTICLES;
  }

  async submitTicket(userId: string, category: SupportCategory, description: string): Promise<SupportTicket> {
    const ticket: SupportTicket = {
      id: `ticket-${Date.now()}`,
      userId,
      category,
      description,
      createdAt: new Date().toISOString(),
    };
    this.tickets.push(ticket);
    return ticket;
  }

  _reset() { this.tickets = []; }
}

export const supportService = new SupportServiceImpl();
