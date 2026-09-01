import { useEffect, useState } from 'react';
import { platformApi, withAuth } from '../services/admin-auth';
import type { AdminRoomRecord } from '../services/platform-api';

export function Rooms() {
  const [rooms, setRooms] = useState<AdminRoomRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<AdminRoomRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await withAuth(() =>
        platformApi.listRooms({ status: status || undefined, page, pageSize: 25 }),
      );
      setRooms(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, status]);

  const inspect = async (roomId: string) => {
    const room = await withAuth(() => platformApi.getRoom(roomId));
    setSelected(room);
  };

  const closeRoom = async (roomId: string) => {
    const reason = prompt('Kapatma nedeni:');
    if (!reason) return;
    await withAuth(() => platformApi.closeRoom(roomId, reason));
    void load();
    setSelected(null);
  };

  if (loading && rooms.length === 0) return <div className="page-title">Yükleniyor...</div>;

  return (
    <div>
      <h1 className="page-title">Odalar</h1>
      <div className="toolbar">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tüm</option>
          <option value="lobby">Lobby</option>
          <option value="playing">Oynanıyor</option>
          <option value="completed">Tamamlandı</option>
          <option value="closed">Kapatıldı</option>
        </select>
      </div>
      {rooms.length === 0 ? (
        <p className="muted-text">Aktif oda bulunamadı.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Kod</th><th>Host</th><th>Oyuncu</th><th>Kategori</th><th>Premium</th><th>Durum</th><th>İşlem</th></tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.code}</strong></td>
                  <td>{r.hostName}</td>
                  <td>{r.playerCount}/{r.maxPlayers}</td>
                  <td>{r.categoryName ?? r.categoryId ?? '—'}</td>
                  <td>{r.isPremiumRoom ? '👑' : '—'}</td>
                  <td><span className={`badge badge-${r.status === 'playing' ? 'success' : r.status === 'closed' ? 'error' : 'warning'}`}>{r.status}</span></td>
                  <td>
                    <button className="btn-outline btn-sm" onClick={() => void inspect(r.id)}>İncele</button>
                    {r.status !== 'closed' ? <button className="btn-outline btn-sm" onClick={() => void closeRoom(r.id)}>Kapat</button> : null}
                  </td>
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
      {selected ? (
        <div className="detail-panel">
          <h3>Oda {selected.code}</h3>
          <p>Host: {selected.hostName} | Durum: {selected.status}</p>
          <p>Oluşturulma: {new Date(selected.createdAt).toLocaleString('tr-TR')}</p>
          <p>Bitiş: {new Date(selected.expiresAt).toLocaleString('tr-TR')}</p>
          <button className="btn-outline" onClick={() => setSelected(null)}>Kapat</button>
        </div>
      ) : null}
    </div>
  );
}
