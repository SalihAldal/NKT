import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { AdminRole } from '../context/AuthContext';

interface Props {
  children: React.ReactNode;
  roles?: AdminRole[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { admin, loading } = useAuth();

  if (loading) return <div className="login-page"><p>Yükleniyor...</p></div>;
  if (!admin) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(admin.role)) {
    return (
      <div className="login-page">
        <h2>Yetkisiz Erişim</h2>
        <p>Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }
  return <>{children}</>;
}
