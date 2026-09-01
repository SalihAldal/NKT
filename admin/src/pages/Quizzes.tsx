import { useEffect, useState } from 'react';
import { platformApi, withAuth } from '../services/admin-auth';

interface QuizRow {
  id: string;
  title: string;
  ownerName: string;
  questionCount: number;
  completionCount: number;
  status: string;
  createdAt: string;
}

export function Quizzes() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<QuizRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageSize = 10;

  const load = async () => {
    setLoading(true);
    try {
      const result = await withAuth(() =>
        platformApi.listQuizzes({
          search: search || undefined,
          status: statusFilter || undefined,
          page,
          pageSize,
        }),
      );
      setItems(result.items as unknown as QuizRow[]);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, statusFilter]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  if (loading && items.length === 0) return <div className="page-title">Yükleniyor...</div>;

  return (
    <div>
      <h1 className="page-title">Quizler</h1>
      <div className="toolbar">
        <input placeholder="Quiz ara..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void load()} />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Tümü</option>
          <option value="published">Yayında</option>
          <option value="draft">Taslak</option>
        </select>
        <button className="btn" onClick={() => void load()}>Ara</button>
      </div>
      {items.length === 0 ? (
        <p className="muted-text">Quiz bulunamadı.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Başlık</th><th>Oluşturan</th><th>Soru</th><th>Çözülme</th><th>Durum</th><th>Tarih</th></tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q.id}>
                  <td>{q.title}</td>
                  <td>{q.ownerName}</td>
                  <td>{q.questionCount}</td>
                  <td>{q.completionCount}</td>
                  <td><span className={`badge ${q.status === 'published' ? 'badge-success' : 'badge-warning'}`}>{q.status}</span></td>
                  <td>{new Date(q.createdAt).toLocaleDateString('tr-TR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Önceki</button>
        <span>{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sonraki</button>
      </div>
    </div>
  );
}
