import { useEffect, useState } from 'react';
import { adminApi } from '../services/admin-api';
import type { AdminSocialStats } from '../contracts/social-api';

export function SocialDashboard() {
  const [stats, setStats] = useState<AdminSocialStats | null>(null);

  useEffect(() => {
    adminApi.getSocialStats().then(setStats);
  }, []);

  if (!stats) return <p className="muted">Yükleniyor...</p>;

  const cards = [
    { label: 'Günlük Arkadaşlık İsteği', value: stats.dailyFriendRequests },
    { label: 'Kabul Oranı', value: `${(stats.acceptanceRate * 100).toFixed(1)}%` },
    { label: 'Davet Dönüşümü', value: `${(stats.inviteConversion * 100).toFixed(1)}%` },
    { label: 'Oda Davet Dönüşümü', value: `${(stats.roomInviteConversion * 100).toFixed(1)}%` },
    { label: 'Quiz Paylaşım Dönüşümü', value: `${(stats.quizShareConversion * 100).toFixed(1)}%` },
    { label: 'Aktif Sosyal Kullanıcı', value: stats.activeSocialUsers },
    { label: 'Viral Katsayı (proxy)', value: stats.viralCoefficient.toFixed(2) },
    { label: 'Bildirim Açılma Oranı', value: `${(stats.notificationOpenRate * 100).toFixed(1)}%` },
    { label: 'Toplam Arkadaşlık', value: stats.totalFriendships },
    { label: 'Bekleyen Davet', value: stats.pendingInvitations },
    { label: 'Engellenen', value: stats.blockedUsers },
    { label: 'Bekleyen Şikayet', value: stats.pendingReports },
  ];

  return (
    <div>
      <h2>Sosyal Analytics</h2>
      <div className="stats-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <span className="stat-label">{c.label}</span>
            <span className="stat-value">{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
