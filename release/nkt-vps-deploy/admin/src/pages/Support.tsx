import { useEffect, useState } from 'react';
import { platformApi, withAuth } from '../services/admin-auth';
import type { SupportTicket } from '../services/platform-api';

export function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await withAuth(() =>
        platformApi.listSupportTickets({ status: status || undefined, page, pageSize: 25 }),
      );
      setTickets(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, status]);

  const resolve = async (id: string) => {
    const note = prompt('Çözüm notu:');
    if (!note) return;
    await withAuth(() => platformApi.resolveSupportTicket(id, 'resolved', note));
    void load();
  };

  if (loading && tickets.length === 0) return <div className="page-title">Yükleniyor...</div>;

  return (
    <div>
      <h1 className="page-title">Destek Merkezi</h1>
      <div className="toolbar">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tüm</option>
          <option value="open">Açık</option>
          <option value="pending">Beklemede</option>
          <option value="resolved">Çözüldü</option>
          <option value="closed">Kapalı</option>
        </select>
      </div>
      {tickets.length === 0 ? (
        <p className="muted-text">Destek talebi bulunamadı.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Kullanıcı</th><th>Kategori</th><th>Mesaj</th><th>Öncelik</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>{t.id.slice(0, 8)}...</td>
                  <td>{t.userName}</td>
                  <td>{t.category}</td>
                  <td className="prompt-cell">{t.message}</td>
                  <td>{t.priority}</td>
                  <td>{t.status}</td>
                  <td>{t.status === 'open' || t.status === 'pending' ? <button className="btn-outline btn-sm" onClick={() => void resolve(t.id)}>Çöz</button> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Önceki</button>
        <span>{page} / {Math.ceil(total / 25) || 1}</span>
        <button disabled={page * 25 >= total} onClick={() => setPage((p) => p + 1)}>Sonraki</button>
      </div>
    </div>
  );
}
