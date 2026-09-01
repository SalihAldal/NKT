import { useEffect, useState } from 'react';
import { adminApi } from '../services/admin-api';
import type { AdminRevenueStats } from '../contracts/admin-api';

export function Revenue() {
  const [stats, setStats] = useState<AdminRevenueStats | null>(null);

  useEffect(() => {
    void adminApi.getRevenueStats().then(setStats);
  }, []);

  if (!stats) return <div className="page-title">Yükleniyor...</div>;

  const cards = [
    { label: 'Aktif Premium', value: stats.activePremium },
    { label: 'Haftalık Abone', value: stats.weeklySubscribers },
    { label: 'Aylık Abone', value: stats.monthlySubscribers },
    { label: 'Süresi Dolmuş', value: stats.expired },
    { label: 'Dönüşüm Oranı', value: `${stats.conversionRate}%` },
    { label: 'Satın Alma', value: stats.purchases },
    { label: 'Restore', value: stats.restoreCount },
    { label: 'Ad Impression', value: stats.adImpressions.toLocaleString('tr-TR') },
    { label: 'Rewarded Tamamlama', value: stats.rewardedCompletions },
  ];

  return (
    <div>
      <h1 className="page-title">Revenue Dashboard</h1>
      <div className="grid">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <h3>{c.label}</h3>
            <div className="value">{c.value}</div>
          </div>
        ))}
      </div>
      <h2 style={{ marginTop: 24 }}>Monetization Config</h2>
      <table className="data-table">
        <thead>
          <tr><th>Ayar</th><th>Değer</th></tr>
        </thead>
        <tbody>
          <tr><td>Weekly Product</td><td>{stats.weeklyProductActive ? 'Aktif' : 'Pasif'}</td></tr>
          <tr><td>Monthly Product</td><td>{stats.monthlyProductActive ? 'Aktif' : 'Pasif'}</td></tr>
          <tr><td>Ads Enabled</td><td>{stats.adsEnabled ? 'Evet' : 'Hayır'}</td></tr>
          <tr><td>Rewarded Enabled</td><td>{stats.rewardedEnabled ? 'Evet' : 'Hayır'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
