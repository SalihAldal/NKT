import { useEffect, useState } from 'react';
import { platformApi, withAuth } from '../services/admin-auth';
import type { AdminPurchaseRecord } from '../services/platform-api';

export function Purchases() {
  const [items, setItems] = useState<AdminPurchaseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const result = await withAuth(() => platformApi.listPurchases({ page, pageSize: 25 }));
        setItems(result.items);
        setTotal(result.total);
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  if (loading) return <div className="page-title">Yükleniyor...</div>;

  return (
    <div>
      <h1 className="page-title">Satın Almalar</h1>
      <p className="page-desc">Hassas ödeme bilgileri gösterilmez — yalnızca metadata.</p>
      {items.length === 0 ? (
        <p className="muted-text">Satın alma kaydı bulunamadı.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Kullanıcı</th><th>Ürün</th><th>Platform</th><th>Durum</th><th>Tarih</th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className={p.state === 'duplicate' ? 'warning-row' : ''}>
                  <td>{p.id.slice(0, 8)}...</td>
                  <td>{p.userName}</td>
                  <td>{p.productId}</td>
                  <td>{p.platform}</td>
                  <td><span className={`badge badge-${p.state === 'completed' ? 'success' : p.state === 'duplicate' ? 'error' : 'warning'}`}>{p.state}</span></td>
                  <td>{new Date(p.createdAt).toLocaleDateString('tr-TR')}</td>
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
