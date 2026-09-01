import { Routes, Route, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { Quizzes } from './pages/Quizzes';
import { Rooms } from './pages/Rooms';
import { Games } from './pages/Games';
import { Categories } from './pages/Categories';
import { Content } from './pages/Content';
import { Revenue } from './pages/Revenue';
import { SocialDashboard } from './pages/SocialDashboard';
import { Moderation } from './pages/Moderation';
import { Support } from './pages/Support';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AuditLog } from './pages/AuditLog';
import { SystemPage } from './pages/SystemPage';
import { Purchases } from './pages/Purchases';
import { LoginPage } from './pages/Login';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', section: 'main' },
  { to: '/users', label: 'Kullanıcılar', section: 'ops' },
  { to: '/quizzes', label: 'Quizler', section: 'ops' },
  { to: '/rooms', label: 'Odalar', section: 'ops' },
  { to: '/games', label: 'Oyunlar', section: 'ops' },
  { to: '/content', label: 'İçerik', section: 'content' },
  { to: '/categories', label: 'Kategoriler', section: 'content' },
  { to: '/moderation', label: 'Moderasyon', section: 'content' },
  { to: '/premium', label: 'Premium', section: 'revenue' },
  { to: '/purchases', label: 'Satın Almalar', section: 'revenue' },
  { to: '/social', label: 'Sosyal', section: 'social' },
  { to: '/support', label: 'Destek', section: 'social' },
  { to: '/analytics', label: 'Analytics', section: 'insights' },
  { to: '/audit', label: 'Audit Log', section: 'system' },
  { to: '/system', label: 'Sistem', section: 'system' },
];

function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    void logout().then(() => navigate('/login'));
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>NKT Admin</h1>
        {admin ? (
          <div className="admin-info">
            <span className="admin-name">{admin.displayName}</span>
            <span className="admin-role">{admin.role}</span>
          </div>
        ) : null}
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="btn-outline logout-btn" onClick={handleLogout}>Çıkış</button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="quizzes" element={<Quizzes />} />
        <Route path="rooms" element={<Rooms />} />
        <Route path="games" element={<Games />} />
        <Route path="content" element={<Content />} />
        <Route path="questions" element={<Content />} />
        <Route path="categories" element={<Categories />} />
        <Route path="moderation" element={<Moderation />} />
        <Route path="premium" element={<Revenue />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="social" element={<SocialDashboard />} />
        <Route path="support" element={<Support />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="audit" element={<AuditLog />} />
        <Route path="system" element={<SystemPage />} />
      </Route>
    </Routes>
  );
}
