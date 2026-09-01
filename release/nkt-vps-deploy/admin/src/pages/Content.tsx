import { useEffect, useState } from 'react';
import { adminApi } from '../services/admin-api';
import type { AdminCategoryDto, AdminContentDto, AdminGenerationBatchDto } from '../contracts/admin-api';
import { MobilePreview } from '../components/MobilePreview';

export function Content() {
  const [categories, setCategories] = useState<AdminCategoryDto[]>([]);
  const [items, setItems] = useState<AdminContentDto[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [moderationStatus, setModerationStatus] = useState('');
  const [showReviewQueue, setShowReviewQueue] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [preview, setPreview] = useState<AdminContentDto | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batches, setBatches] = useState<AdminGenerationBatchDto[]>([]);
  const [genCategory, setGenCategory] = useState('cat-korku');
  const [genCount, setGenCount] = useState(10);
  const [page, setPage] = useState(1);

  const load = async () => {
    const res = showReviewQueue
      ? await adminApi.listReviewQueue({ categoryId: categoryId || undefined, page })
      : await adminApi.listContent({
          search,
          categoryId: categoryId || undefined,
          moderationStatus: moderationStatus || undefined,
          page,
          pageSize: 50,
        });
    setItems(res.items);
    setTotal(res.total);
    const b = await adminApi.listGenerationBatches();
    setBatches(b);
  };

  useEffect(() => { void adminApi.listCategories().then(setCategories); }, []);

  useEffect(() => { void load(); }, [search, categoryId, moderationStatus, showReviewQueue, page]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = file.name.endsWith('.csv')
      ? await adminApi.importContentCsv(text)
      : await adminApi.importContentJson(JSON.parse(text));
    setImportResult(`Imported: ${result.imported}, Rejected: ${result.rejected}, Duplicate: ${result.duplicate}`);
    void load();
  };

  const handleExport = async (format: 'json' | 'csv') => {
    const data = format === 'json'
      ? await adminApi.exportContentJson(categoryId || undefined)
      : await adminApi.exportContentCsv(categoryId || undefined);
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-export.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulk = async (action: 'approve' | 'reject' | 'hide') => {
    const result = await adminApi.bulkModerateContent([...selected], action);
    setImportResult(`Bulk ${action}: ${result.success} başarılı, ${result.skipped} atlandı`);
    setSelected(new Set());
    void load();
  };

  const handleGenerate = async () => {
    const batch = await adminApi.createGenerationBatch({ categoryId: genCategory, count: genCount });
    setImportResult(`AI Batch ${batch.id}: ${batch.generatedCount} içerik oluşturuldu (DRAFT)`);
    void load();
  };

  const qualityLabel = (score?: number) => {
    if (!score) return '—';
    if (score >= 90) return `Excellent (${score})`;
    if (score >= 70) return `Good (${score})`;
    if (score >= 50) return `Review (${score})`;
    return `Poor (${score})`;
  };

  return (
    <div>
      <h2>İçerik Yönetimi</h2>
      <div className="toolbar">
        <input placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Tüm Kategoriler</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={moderationStatus} onChange={(e) => setModerationStatus(e.target.value)}>
          <option value="">Tüm Moderation</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
        <button type="button" onClick={() => setShowReviewQueue(!showReviewQueue)}>
          {showReviewQueue ? 'Tüm İçerik' : 'Review Queue'}
        </button>
        <label className="import-btn">
          Import
          <input type="file" accept=".json,.csv" onChange={handleImport} hidden />
        </label>
        <button type="button" onClick={() => handleExport('json')}>JSON Export</button>
        <button type="button" onClick={() => handleExport('csv')}>CSV Export</button>
      </div>

      <div className="card" style={{ margin: '12px 0' }}>
        <h3>AI İçerik Üretimi</h3>
        <select value={genCategory} onChange={(e) => setGenCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input type="number" min={1} max={100} value={genCount} onChange={(e) => setGenCount(Number(e.target.value))} />
        <button type="button" onClick={handleGenerate}>Generate → DRAFT</button>
        {batches.length > 0 ? <p>Son batch: {batches[0]!.id} — {batches[0]!.status}</p> : null}
      </div>

      {selected.size > 0 ? (
        <div className="toolbar">
          <span>{selected.size} seçili</span>
          <button type="button" onClick={() => handleBulk('approve')}>Bulk Approve</button>
          <button type="button" onClick={() => handleBulk('reject')}>Bulk Reject</button>
          <button type="button" onClick={() => handleBulk('hide')}>Bulk Disable</button>
        </div>
      ) : null}

      {importResult ? <p className="import-result">{importResult}</p> : null}

      {preview ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Mobile Önizleme</h3>
          <MobilePreview type={preview.type} prompt={preview.prompt} difficulty={preview.difficulty} />
          <p><strong>Moderation:</strong> {preview.moderationStatus} · <strong>Quality:</strong> {qualityLabel(preview.qualityScore)}</p>
          {preview.aiGenerated ? <span className="badge">AI Generated</span> : null}
          <button type="button" onClick={() => setPreview(null)}>Kapat</button>
        </div>
      ) : null}

      <p>Toplam: {total} kayıt · Sayfa {page}</p>
      <table className="data-table">
        <thead>
          <tr>
            <th></th>
            <th>Prompt</th>
            <th>Kategori</th>
            <th>Tip</th>
            <th>Zorluk</th>
            <th>Kalite</th>
            <th>Mod</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} /></td>
              <td className="prompt-cell">
                {c.aiGenerated ? <span title="AI">🤖 </span> : null}
                {c.prompt}
              </td>
              <td><code>{c.categoryId}</code></td>
              <td>{c.type}</td>
              <td>{c.difficulty}</td>
              <td>{qualityLabel(c.qualityScore)}</td>
              <td>{c.moderationStatus}</td>
              <td>
                <button type="button" onClick={() => setPreview(c)}>Önizle</button>
                <button type="button" onClick={() => adminApi.moderateContent(c.id, 'approve').then(load)}>Onayla</button>
                <button type="button" onClick={() => adminApi.moderateContent(c.id, 'reject').then(load)}>Reddet</button>
                <button type="button" onClick={() => adminApi.deleteContent(c.id).then(load)}>Sil</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="toolbar">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Önceki</button>
        <button type="button" disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>Sonraki</button>
      </div>
    </div>
  );
}
