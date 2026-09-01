import { useEffect, useState } from 'react';
import { platformApi, withAuth } from '../services/admin-auth';
import type { AdminReport } from '../services/platform-api';

export function Moderation() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [customCats, setCustomCats] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const queue = await withAuth(() => platformApi.getModerationQueue());
      setReports(queue.reports);
      setCustomCats(queue.customCategories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const resolve = async (id: string, status: 'resolved' | 'rejected') => {
    await withAuth(() => platformApi.resolveReport(id, status, `Admin ${status}`));
    void load();
  };

  const moderateCustom = async (id: string, action: 'approve' | 'reject') => {
    await withAuth(() => platformApi.moderateCustomCategory(id, action));
    void load();
  };

  if (loading) return <div className="page-title">Yükleniyor...</div>;

  return (
    <div>
      <h1 className="page-title">Moderasyon Merkezi</h1>
      <h2 className="section-heading">Bekleyen Raporlar ({reports.length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Öncelik</th><th>Tip</th><th>Neden</th><th>Raporlayan</th><th>Durum</th><th>İşlem</th></tr>
          </thead>
          <tbody>
            {reports.length === 0 ? <tr><td colSpan={6}>Bekleyen rapor yok</td></tr> : reports.map((r) => (
              <tr key={r.id}>
                <td><span className={`badge badge-${r.priority === 'critical' ? 'error' : r.priority === 'high' ? 'warning' : 'success'}`}>{r.priority}</span></td>
                <td>{r.targetType}</td>
                <td>{r.reason}</td>
                <td>{r.reporterName}</td>
                <td>{r.status}</td>
                <td>
                  <button className="btn-outline btn-sm" onClick={() => void resolve(r.id, 'resolved')}>Çöz</button>
                  <button className="btn-outline btn-sm" onClick={() => void resolve(r.id, 'rejected')}>Reddet</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="section-heading">Özel Kategoriler ({customCats.length})</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Ad</th><th>Durum</th><th>İşlem</th></tr></thead>
          <tbody>
            {customCats.length === 0 ? <tr><td colSpan={3}>Bekleyen özel kategori yok</td></tr> : customCats.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.status}</td>
                <td>
                  <button className="btn-outline btn-sm" onClick={() => void moderateCustom(c.id, 'approve')}>Onayla</button>
                  <button className="btn-outline btn-sm" onClick={() => void moderateCustom(c.id, 'reject')}>Reddet</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
