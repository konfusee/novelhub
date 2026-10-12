import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
export function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  return isAuthenticated ? (
    children
  ) : (
    <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  );
}
export function RoleRoute({ role, children, authorOnboarding = false }) {
  const { isAuthenticated, hasRole } = useAuth();
  const location = useLocation();
  if (!isAuthenticated)
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  if (hasRole(role)) return children;
  if (role === 'author' && authorOnboarding) return <Navigate to="/author/apply" replace />;
  return <Navigate to="/403" state={{ from: location.pathname }} replace />;
}
