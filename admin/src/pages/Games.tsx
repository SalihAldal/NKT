import { useEffect, useState } from 'react';
import { platformApi, withAuth } from '../services/admin-auth';
import type { AdminGameRecord } from '../services/platform-api';

export function Games() {
  const [games, setGames] = useState<AdminGameRecord[]>([]);
  const [selected, setSelected] = useState<AdminGameRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await withAuth(() => platformApi.listGames({ pageSize: 50 }));
      setGames(result.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const inspect = async (gameId: string) => {
    const game = await withAuth(() => platformApi.getGame(gameId));
    setSelected({
      ...game,
      scores: (game.scores as AdminGameRecord['scores']) ?? [],
    });
  };

  if (loading) return <div className="page-title">Yükleniyor...</div>;

  return (
    <div>
      <h1 className="page-title">Oyunlar</h1>
      {games.length === 0 ? (
        <p className="muted-text">Oyun kaydı bulunamadı.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Oda</th><th>Kategori</th><th>Stage</th><th>Oyuncu</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id}>
                  <td>{g.id.slice(0, 8)}...</td>
                  <td>{g.roomCode ?? g.roomId.slice(0, 8)}</td>
                  <td>{g.categoryName}</td>
                  <td>{g.currentStage}/{g.totalStages}</td>
                  <td>{g.playerCount}</td>
                  <td><span className={`badge badge-${g.status === 'active' ? 'success' : g.status === 'aborted' ? 'error' : 'warning'}`}>{g.status}</span></td>
                  <td>
                    <button className="btn-outline btn-sm" onClick={() => void inspect(g.id)}>İncele</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected ? (
        <div className="detail-panel">
          <h3>Oyun {selected.id.slice(0, 8)}...</h3>
          <p>Kategori: {selected.categoryName} | Durum: {selected.status}</p>
          <table><thead><tr><th>#</th><th>Oyuncu</th><th>Skor</th></tr></thead>
            <tbody>{(selected.scores ?? []).map((s) => <tr key={s.userId}><td>{s.rank}</td><td>{s.name ?? s.userId}</td><td>{s.score}</td></tr>)}</tbody>
          </table>
          <button className="btn-outline" onClick={() => setSelected(null)}>Kapat</button>
        </div>
      ) : null}
    </div>
  );
}
