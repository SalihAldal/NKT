import { useEffect, useState } from 'react';
import { platformApi, withAuth } from '../services/admin-auth';
import type { FeatureFlag, SystemHealthCheck } from '../services/platform-api';

export function SystemPage() {
  const [health, setHealth] = useState<SystemHealthCheck[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [h, f] = await withAuth(() =>
        Promise.all([platformApi.getSystemHealth(), platformApi.listFeatureFlags()]),
      );
      setHealth(h);
      setFlags(f);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const toggleFlag = async (key: string, enabled: boolean) => {
    await withAuth(() => platformApi.updateFeatureFlag(key, enabled, 'Admin toggle'));
    void load();
  };

  if (loading) return <div className="page-title">Yükleniyor...</div>;

  return (
    <div>
      <h1 className="page-title">Sistem</h1>
      <h2 className="section-heading">Sağlık Durumu</h2>
      <div className="grid">
        {health.map((h) => (
          <div key={h.service} className="card">
            <h3>{h.service}</h3>
            <div className={`value health-${h.status.toLowerCase()}`}>{h.status}</div>
            <p className="muted-text">{h.message}</p>
          </div>
        ))}
      </div>
      <h2 className="section-heading">Feature Flags</h2>
      {flags.length === 0 ? (
        <p className="muted-text">Feature flag bulunamadı.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Flag</th><th>Label</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.key}>
                  <td><code>{f.key}</code></td>
                  <td>{f.label}</td>
                  <td>{f.enabled ? '✅ Aktif' : '❌ Kapalı'}</td>
                  <td>
                    <button className="btn-outline btn-sm" onClick={() => void toggleFlag(f.key, !f.enabled)}>
                      {f.enabled ? 'Kapat' : 'Aç'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
