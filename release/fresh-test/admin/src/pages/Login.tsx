import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Geçersiz e-posta veya şifre');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>NKT Admin</h1>
        <p className="login-sub">Operasyon paneline giriş yap</p>
        <form onSubmit={handleSubmit}>
          <label>E-posta</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          <label>Şifre</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          {error ? <p className="login-error">{error}</p> : null}
          <button type="submit" className="btn" disabled={loading}>{loading ? 'Giriş...' : 'Giriş Yap'}</button>
        </form>
        {import.meta.env.DEV && import.meta.env.VITE_ADMIN_SEED_HINT ? (
          <p className="login-hint">{import.meta.env.VITE_ADMIN_SEED_HINT}</p>
        ) : null}
      </div>
    </div>
  );
}
