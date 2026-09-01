import { useState } from 'react';
import { mockReports } from '../data/mock';

interface Props {
  title: string;
  columns: string[];
}

export function GenericList({ title, columns }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const isReports = title.includes('Şikayet');
  const data = isReports ? mockReports : Array.from({ length: 15 }, (_, i) => ({ id: i }));

  return (
    <div>
      <h1 className="page-title">{title}</h1>
      <div className="toolbar">
        <input placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn">Yeni Ekle</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}<th>İşlem</th></tr></thead>
          <tbody>
            {isReports
              ? mockReports.map((r) => (
                  <tr key={r.id}>
                    <td>{r.type}</td><td>{r.reporter}</td><td>{r.target}</td>
                    <td><span className={`badge ${r.status === 'resolved' ? 'badge-success' : 'badge-warning'}`}>{r.status}</span></td>
                    <td>{r.createdAt}</td>
                    <td><button className="btn btn-outline">İncele</button></td>
                  </tr>
                ))
              : data.map((row, i) => (
                  <tr key={row.id}>
                    {columns.map((c) => <td key={c}>{`${c} #${i + 1 + (page - 1) * 10}`}</td>)}
                    <td><button className="btn btn-outline">Detay</button></td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        {[1, 2, 3].map((p) => (
          <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
        ))}
      </div>
    </div>
  );
}
