import { useEffect, useState } from 'react';
import { platformApi, withAuth } from '../services/admin-auth';
import type { AuditLogEntry } from '../services/platform-api';

export function AuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const result = await withAuth(() =>
          platformApi.listAuditLogs({ action: actionFilter || undefined, page, pageSize: 30 }),
        );
        setLogs(result.items);
        setTotal(result.total);
      } finally {
        setLoading(false);
      }
    })();
  }, [page, actionFilter]);

  if (loading && logs.length === 0) return <div className="page-title">Yükleniyor...</div>;

  return (
    <div>
      <h1 className="page-title">Audit Log</h1>
      <div className="toolbar">
        <input placeholder="Action filtre..." value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Zaman</th><th>Admin</th><th>Action</th><th>Hedef</th><th>Neden</th></tr>
          </thead>
          <tbody>
            {logs.length === 0 ? <tr><td colSpan={5}>Henüz kayıt yok — admin işlemi yapınca görünür</td></tr> : logs.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.timestamp).toLocaleString('tr-TR')}</td>
                <td>{l.adminEmail}</td>
                <td><code>{l.action}</code></td>
                <td>{l.targetType}:{l.targetId}</td>
                <td>{l.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Önceki</button>
        <span>{page} / {Math.ceil(total / 30) || 1}</span>
        <button disabled={page * 30 >= total} onClick={() => setPage((p) => p + 1)}>Sonraki</button>
      </div>
    </div>
  );
}
