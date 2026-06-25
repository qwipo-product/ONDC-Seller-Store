import { Navigate, useLocation } from "react-router";
import type { ReactNode } from "react";
import { useAuth, type Role } from "../lib/auth-context";

interface ProtectedRouteProps {
  allow: Role | Role[];
  children: ReactNode;
}

// Client-side route guard.
// - Not authenticated → /login
// - Wrong role → own home
export function ProtectedRoute({ allow, children }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  const allowed = Array.isArray(allow) ? allow : [allow];

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!allowed.includes(user.role)) {
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    if (user.role === "designer") return <Navigate to="/design" replace />;
    if (user.role === "catalog-admin") return <Navigate to="/catalog-portal" replace />;
    if (user.role === "brand-manager") return <Navigate to="/catalog-portal" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
