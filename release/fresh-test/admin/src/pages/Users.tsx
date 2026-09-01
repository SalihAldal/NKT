import { useEffect, useState } from 'react';
import { platformApi, withAuth } from '../services/admin-auth';
import type { AdminUserRecord } from '../services/platform-api';

export function Users() {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<AdminUserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await withAuth(() =>
        platformApi.listUsers({ search: search || undefined, status: status || undefined, page, pageSize: 25 }),
      );
      setUsers(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yükleme hatası');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, status]);

  const handleSuspend = async (userId: string) => {
    const reason = prompt('Askıya alma nedeni:');
    if (!reason) return;
    await withAuth(() => platformApi.suspendUser(userId, reason));
    void load();
  };

  const handleUnsuspend = async (userId: string) => {
    await withAuth(() => platformApi.unsuspendUser(userId, 'Restored by admin'));
    void load();
  };

  if (loading && users.length === 0) return <div className="page-title">Yükleniyor...</div>;

  return (
    <div>
      <h1 className="page-title">Kullanıcılar</h1>
      {error ? <p className="login-error">{error}</p> : null}
      <div className="toolbar">
        <input placeholder="Ara (username, isim, id)..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void load()} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tüm Durumlar</option>
          <option value="active">Aktif</option>
          <option value="suspended">Askıda</option>
        </select>
        <button className="btn" onClick={() => void load()}>Ara</button>
      </div>
      {users.length === 0 ? (
        <p className="muted-text">Kullanıcı bulunamadı.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Tip</th>
                <th>Premium</th>
                <th>Durum</th>
                <th>Quiz</th>
                <th>Son Aktif</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} onClick={() => setSelected(u)} style={{ cursor: 'pointer' }}>
                  <td>
                    <strong>{u.displayName}</strong>
                    <br /><span className="muted-text">@{u.username}</span>
                  </td>
                  <td>{u.accountType === 'guest_linked' ? 'Guest' : 'Kayıtlı'}</td>
                  <td>{u.isPremium ? '👑' : '—'}</td>
                  <td><span className={`badge badge-${u.status === 'active' ? 'success' : u.status === 'suspended' ? 'error' : 'warning'}`}>{u.status}</span></td>
                  <td>{u.quizzesCreated}</td>
                  <td>{new Date(u.lastActiveAt).toLocaleDateString('tr-TR')}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {u.status === 'suspended' ? (
                      <button className="btn-outline btn-sm" onClick={() => void handleUnsuspend(u.id)}>Aktifleştir</button>
                    ) : (
                      <button className="btn-outline btn-sm" onClick={() => void handleSuspend(u.id)}>Askıya Al</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Önceki</button>
        <span>Sayfa {page} / {Math.ceil(total / 25) || 1}</span>
        <button disabled={page * 25 >= total} onClick={() => setPage((p) => p + 1)}>Sonraki</button>
      </div>
      {selected ? (
        <div className="detail-panel">
          <h3>{selected.displayName} — Detay</h3>
          <p>ID: {selected.id} | Oyun: {selected.gamesPlayed} | Arkadaş: {selected.friendsCount}</p>
          <p>Uyarı: {selected.warningCount} | İçerik kısıt: {selected.contentRestricted ? 'Evet' : 'Hayır'}</p>
          <button className="btn-outline" onClick={() => setSelected(null)}>Kapat</button>
        </div>
      ) : null}
    </div>
  );
}
