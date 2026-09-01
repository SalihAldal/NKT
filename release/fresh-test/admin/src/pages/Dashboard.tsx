import { useEffect, useState } from 'react';
import { adminApi } from '../services/admin-api';
import type { AdminCategoryDto, AdminDashboardStats } from '../contracts/admin-api';

export function Dashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [categories, setCategories] = useState<AdminCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const [s, c] = await Promise.all([adminApi.getDashboard(), adminApi.listCategories()]);
        setStats(s);
        setCategories(c);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Dashboard yüklenemedi');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="page-title">Yükleniyor...</div>;
  if (error) return <div className="page-title login-error">{error}</div>;
  if (!stats) return <div className="page-title">Veri yok</div>;

  const cards = [
    { label: 'Toplam İçerik', value: stats.totalContent.toLocaleString('tr-TR') },
    { label: 'Aktif İçerik', value: (stats.activeContent ?? 0).toLocaleString('tr-TR') },
    { label: 'Review Queue', value: stats.reviewQueueCount ?? 0 },
    { label: 'Ortalama Kalite', value: `${stats.averageQualityScore ?? 0}/100` },
    { label: 'Premium İçerik', value: (stats.premiumContent ?? 0).toLocaleString('tr-TR') },
    { label: 'Ücretsiz İçerik', value: (stats.freeContent ?? 0).toLocaleString('tr-TR') },
    { label: '+18 İçerik', value: stats.adult18Content ?? 0 },
    { label: 'Hedef Altı Kategori', value: stats.categoriesBelowTarget },
    { label: 'Content Version', value: stats.contentVersion ?? '—' },
    { label: 'Toplam Kullanıcı', value: stats.totalUsers.toLocaleString('tr-TR') },
    { label: 'Günlük Aktif', value: stats.dau.toLocaleString('tr-TR') },
    { label: 'Bekleyen Rapor', value: stats.reportsPending },
  ];

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <div className="grid">
        {cards.map((s) => (
          <div key={s.label} className="card">
            <h3>{s.label}</h3>
            <div className="value">{s.value}</div>
          </div>
        ))}
      </div>
      <h2 className="page-title" style={{ fontSize: '1.25rem' }}>Kategori İçerik Hedefi (300)</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Kategori</th>
            <th>İlerleme</th>
            <th>Kalite</th>
            <th>Review</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat.id} className={cat.warning ? 'warning-row' : ''}>
              <td>{cat.name}</td>
              <td>
                {cat.contentCount} / {cat.minimumContentTarget} ({cat.progress ?? 0}%)
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(100, cat.progress ?? 0)}%` }}
                  />
                </div>
              </td>
              <td>{cat.qualityScore ?? '—'}</td>
              <td>{cat.reviewQueue ?? 0}</td>
              <td>{cat.incomplete || cat.warning ? 'INCOMPLETE' : 'OK'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
