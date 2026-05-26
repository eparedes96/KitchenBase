import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { FullScreenLoader } from "@/components/common/FullScreenLoader";

/**
 * ProtectedRoute — only renders children if the user is authenticated.
 * Otherwise redirects to /welcome, preserving the requested location.
 */
export function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!session) {
    return <Navigate to="/welcome" replace state={{ from: location }} />;
  }

  return children;
}
