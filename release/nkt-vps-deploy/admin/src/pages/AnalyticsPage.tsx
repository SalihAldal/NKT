import { useEffect, useState } from 'react';
import { platformApi, withAuth } from '../services/admin-auth';
import type { AnalyticsData, ContentAnalyticsRow } from '../services/platform-api';

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [content, setContent] = useState<ContentAnalyticsRow[]>([]);
  const [range, setRange] = useState<'today' | '7d' | '30d' | '90d'>('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [analytics, categoryStats] = await withAuth(() =>
          Promise.all([platformApi.getAnalytics(range), platformApi.getContentAnalytics()]),
        );
        setData(analytics);
        setContent(categoryStats);
      } finally {
        setLoading(false);
      }
    })();
  }, [range]);

  if (loading || !data) return <div className="page-title">Yükleniyor...</div>;

  const cards = [
    { label: 'Analytics Events', value: data.events },
    { label: 'Yeni Kullanıcı', value: data.newUsers },
    { label: 'Oluşturulan Oda', value: data.roomsCreated },
    { label: 'Oynanan Oyun', value: data.gamesPlayed },
    { label: 'Premium Dönüşüm', value: data.premiumConversions },
    { label: '7 Gün Retention', value: `${data.retention7d}%` },
    { label: '30 Gün Retention', value: `${data.retention30d}%` },
  ];

  return (
    <div>
      <h1 className="page-title">Analytics</h1>
      <div className="toolbar">
        <select value={range} onChange={(e) => setRange(e.target.value as typeof range)}>
          <option value="today">Bugün</option>
          <option value="7d">7 Gün</option>
          <option value="30d">30 Gün</option>
          <option value="90d">90 Gün</option>
        </select>
      </div>
      <div className="grid">
        {cards.map((c) => (
          <div key={c.label} className="card"><h3>{c.label}</h3><div className="value">{c.value}</div></div>
        ))}
      </div>
      <h2 className="section-heading">Kategori Analitiği</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Kategori</th><th>İçerik</th><th>Tamamlama</th><th>Skip</th><th>Rapor</th><th>Kalite</th></tr></thead>
          <tbody>
            {content.map((c) => (
              <tr key={c.categoryId}>
                <td>{c.name}</td>
                <td>{c.contentCount}</td>
                <td>{(c.completionRate * 100).toFixed(0)}%</td>
                <td>{(c.skipRate * 100).toFixed(0)}%</td>
                <td>{(c.reportRate * 100).toFixed(1)}%</td>
                <td>{c.quality}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
